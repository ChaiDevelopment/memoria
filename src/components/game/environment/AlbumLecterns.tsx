"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { Lectern } from "@/config/grandMuseum";
import { facingToRotationY } from "@/lib/math";
import { getMaterials } from "@/lib/materials";
import { useGameStore } from "@/stores/gameStore";

const PAGE_W = 0.62;
const PAGE_H = 0.42;
/** Book tilt towards the reader (radians from horizontal). */
const TILT = 0.42;
const TOP = 1.06;

/** Open-book page texture: chapter number + title on the left, period on the right. */
function pageTexture(n: number, title: string, period: string): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 348;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#f6efe1";
  ctx.fillRect(0, 0, c.width, c.height);
  // Gutter shadow.
  const g = ctx.createLinearGradient(236, 0, 276, 0);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(0.5, "rgba(90,60,30,0.28)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(236, 0, 40, c.height);
  ctx.textAlign = "center";
  ctx.fillStyle = "#a07a3e";
  ctx.font = "600 20px Georgia, serif";
  ctx.fillText(`BAB ${n}`, 128, 70);
  ctx.fillStyle = "#3a2c1f";
  ctx.font = "italic 30px Georgia, serif";
  // Wrap the title over up to three lines.
  const words = title.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > 210 && line) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  lines.slice(0, 4).forEach((l, i) => ctx.fillText(l, 128, 130 + i * 38));
  ctx.fillStyle = "#8a6a3c";
  ctx.font = "italic 20px Georgia, serif";
  ctx.fillText(period, 384, 150);
  ctx.strokeStyle = "#c9a25e";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(334, 175);
  ctx.lineTo(434, 175);
  ctx.stroke();
  ctx.fillStyle = "#b9a98f";
  ctx.font = "16px Georgia, serif";
  ctx.fillText("Album Kata", 384, 215);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** The Album Kata on the balconies: a walnut lectern with an open book for every chapter. */
export function AlbumLecterns({ lecterns }: { lecterns: readonly Lectern[] }) {
  const mats = getMaterials();
  const album = useGameStore((s) => s.album);
  const geo = useMemo(
    () => ({
      post: new THREE.BoxGeometry(0.34, TOP - 0.06, 0.26),
      base: new THREE.BoxGeometry(0.56, 0.06, 0.44),
      board: new THREE.BoxGeometry(PAGE_W + 0.1, 0.04, PAGE_H + 0.1),
      page: new THREE.PlaneGeometry(PAGE_W, PAGE_H),
      lamp: new THREE.CylinderGeometry(0.012, 0.012, 0.34, 6),
      shade: new THREE.ConeGeometry(0.07, 0.08, 10, 1, true),
    }),
    [],
  );
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);

  const pages = useMemo(
    () =>
      lecterns.map((l) => {
        const ch = album[l.index];
        return new THREE.MeshStandardMaterial({ map: pageTexture(l.index + 1, ch?.title ?? "", ch?.period ?? ""), roughness: 0.9 });
      }),
    [lecterns, album],
  );
  useEffect(() => () => pages.forEach((m) => (m.map?.dispose(), m.dispose())), [pages]);

  return (
    <group name="album-lecterns">
      {lecterns.map((l, i) => (
        <group key={l.index} position={[l.x, l.y, l.z]} rotation={[0, facingToRotationY(l.facing), 0]}>
          <mesh geometry={geo.base} material={mats.walnut} position={[0, 0.03, 0]} castShadow receiveShadow />
          <mesh geometry={geo.post} material={mats.walnut} position={[0, (TOP - 0.06) / 2 + 0.03, -0.04]} castShadow />
          {/* Book rest, leaning towards the reader (+Z local). */}
          <group position={[0, TOP, 0]} rotation={[TILT, 0, 0]}>
            <mesh geometry={geo.board} material={mats.darkWood} castShadow />
            <mesh geometry={geo.page} material={pages[i]} position={[0, 0.022, 0]} rotation={[-Math.PI / 2, 0, 0]} />
          </group>
          {/* Little brass reading lamp. */}
          <mesh geometry={geo.lamp} material={mats.brass} position={[0.3, TOP + 0.17, -0.12]} />
          <mesh geometry={geo.shade} material={mats.lampGlow} position={[0.3, TOP + 0.34, -0.12]} />
        </group>
      ))}
    </group>
  );
}
