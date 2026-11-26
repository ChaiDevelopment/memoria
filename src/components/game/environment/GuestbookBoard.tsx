"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { GUESTBOOK_STAND } from "@/config/grandMuseum";
import { facingToRotationY } from "@/lib/math";
import { getMaterials } from "@/lib/materials";
import { useGameStore } from "@/stores/gameStore";

/** Draws the latest guest book messages onto the board's face. */
function boardTexture(entries: readonly { name: string; message: string }[]): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 640;
  c.height = 640;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#f4ecdc";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.textAlign = "center";
  ctx.fillStyle = "#3a2c1f";
  ctx.font = "500 46px Georgia, serif";
  ctx.fillText("Guest Book", 320, 72);
  ctx.fillStyle = "#a07a3e";
  ctx.font = "italic 22px Georgia, serif";
  ctx.fillText(entries.length ? "Words from our visitors" : "Press E to sign the book", 320, 108);
  ctx.strokeStyle = "#c9a25e";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(220, 126);
  ctx.lineTo(420, 126);
  ctx.stroke();

  ctx.textAlign = "left";
  let y = 170;
  for (const e of entries.slice(0, 5)) {
    ctx.fillStyle = "#3a2c1f";
    ctx.font = "italic 24px Georgia, serif";
    const words = e.message.replace(/\s+/g, " ").split(" ");
    let line = "";
    let lines = 0;
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (ctx.measureText(next).width > 560 && line) {
        ctx.fillText(line, 40, y);
        y += 30;
        line = w;
        if (++lines >= 2) {
          line = `${line.slice(0, 20)}…`;
          break;
        }
      } else line = next;
    }
    ctx.fillText(lines >= 2 ? line : line, 40, y);
    y += 28;
    ctx.fillStyle = "#8a6a3c";
    ctx.font = "18px Georgia, serif";
    ctx.fillText(`— ${e.name}`, 60, y);
    y += 42;
    if (y > 600) break;
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** A walnut notice board in the Entrance Court showing the newest guest book messages. */
export function GuestbookBoard() {
  const mats = getMaterials();
  const entries = useGameStore((s) => s.guestbook);
  const g = GUESTBOOK_STAND;
  const geo = useMemo(
    () => ({
      post: new THREE.BoxGeometry(0.1, g.height, 0.1),
      frame: new THREE.BoxGeometry(g.width, 1.2, 0.08),
      face: new THREE.PlaneGeometry(g.width - 0.16, 1.06),
      roof: new THREE.BoxGeometry(g.width + 0.2, 0.06, 0.32),
    }),
    [g.width, g.height],
  );
  useEffect(() => () => Object.values(geo).forEach((x) => x.dispose()), [geo]);
  const face = useMemo(() => new THREE.MeshStandardMaterial({ map: boardTexture(entries), roughness: 0.9 }), [entries]);
  useEffect(() => () => (face.map?.dispose(), face.dispose()), [face]);

  return (
    <group name="guestbook" position={[g.x, 0, g.z]} rotation={[0, facingToRotationY(g.facing), 0]}>
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={geo.post} material={mats.walnut} position={[s * (g.width / 2 - 0.05), g.height / 2, -0.02]} castShadow />
      ))}
      <mesh geometry={geo.frame} material={mats.walnut} position={[0, 1.3, -0.02]} castShadow />
      <mesh geometry={geo.face} material={face} position={[0, 1.3, 0.025]} />
      <mesh geometry={geo.roof} material={mats.brass} position={[0, g.height + 0.03, 0]} castShadow />
    </group>
  );
}
