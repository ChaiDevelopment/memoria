"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { MEMORY_BY_ID, PHOTO_PLACEMENTS } from "@/config/memories";
import { texturedQuadsGeometry, type InstanceTransform, type TexturedQuad } from "@/lib/geometry";
import { facingToNormal, facingToRotationY } from "@/lib/math";
import { getMaterials } from "@/lib/materials";
import { createLabelAtlas, createPhotoAtlas } from "@/lib/textures/proceduralTextures";
import { useGameStore } from "@/stores/gameStore";
import type { PhotoPlacement } from "@/types/memory";
import { Instanced } from "./Instanced";

const FRAME_COLORS: Record<PhotoPlacement["frame"], string> = {
  oak: "#94643f",
  black: "#2b2724",
  gold: "#c39a55",
  white: "#efe9df",
};

const FRAME_BORDER = 0.06;
const FRAME_DEPTH = 0.05;
const LABEL_W = 0.36;
const LABEL_H = LABEL_W / 2.56;

interface PhotoLayout {
  placement: PhotoPlacement;
  width: number;
  height: number;
  mat: number;
  rotY: number;
  n: { x: number; z: number };
  /** Local right axis (viewer's right). */
  r: { x: number; z: number };
}

function layoutFor(p: PhotoPlacement): PhotoLayout {
  const memory = MEMORY_BY_ID.get(p.memoryId);
  if (!memory) throw new Error(`Unknown memory ${p.memoryId}`);
  const rotY = facingToRotationY(p.facing);
  return {
    placement: p,
    width: p.height * memory.aspect,
    height: p.height,
    mat: p.mount === "easel" ? 0.045 : 0.085,
    rotY,
    n: facingToNormal(p.facing),
    r: { x: Math.cos(rotY), z: -Math.sin(rotY) },
  };
}

/** Where the label goes: beside small wall photos, below large ones and on easels. */
function labelPosition(l: PhotoLayout): { x: number; y: number; z: number } {
  const p = l.placement;
  const outerW = l.width / 2 + l.mat + FRAME_BORDER;
  const outerH = l.height / 2 + l.mat + FRAME_BORDER;
  const out = 0.03;
  if (p.mount === "wall" && p.height < 1.2) {
    const off = outerW + 0.22 + LABEL_W / 2;
    return { x: p.x + l.r.x * off + l.n.x * out, y: p.y - l.height * 0.25, z: p.z + l.r.z * off + l.n.z * out };
  }
  return { x: p.x + l.n.x * out, y: p.y - outerH - 0.08 - LABEL_H / 2, z: p.z + l.n.z * out };
}

function loadImage(url: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.decoding = "async";
  img.src = url;
  return img.decode().then(() => img);
}

/**
 * Loads the thumbnails of the visitor's photos assigned to frames.
 * Until they arrive (or if some fail) the placeholder paintings stay up.
 */
function useExhibitImages(): ReadonlyMap<string, HTMLImageElement> | undefined {
  const exhibits = useGameStore((s) => s.exhibits);
  const [images, setImages] = useState<ReadonlyMap<string, HTMLImageElement>>();
  useEffect(() => {
    const entries = Object.entries(exhibits);
    if (entries.length === 0) {
      setImages(undefined);
      return;
    }
    let cancelled = false;
    Promise.all(
      entries.map(([slot, photo]) =>
        loadImage(photo.thumbUrl).then(
          (img) => [slot, img] as const,
          () => null,
        ),
      ),
    ).then((results) => {
      if (cancelled) return;
      const loaded = results.filter((r): r is readonly [string, HTMLImageElement] => r !== null);
      if (loaded.length < entries.length) console.warn(`[MEMORA] ${entries.length - loaded.length} photo(s) could not be loaded.`);
      setImages(new Map(loaded));
    });
    return () => {
      cancelled = true;
    };
  }, [exhibits]);
  return images;
}

export function Photographs({ atlasCell }: { atlasCell: number }) {
  const mats = getMaterials();
  const exhibits = useGameStore((s) => s.exhibits);
  const exhibitImages = useExhibitImages();
  const photoAtlas = useMemo(() => createPhotoAtlas(atlasCell, exhibitImages), [atlasCell, exhibitImages]);
  const labelAtlas = useMemo(
    () => createLabelAtlas(new Map(Object.entries(exhibits).map(([slot, p]) => [slot, { title: p.title, year: p.year }]))),
    [exhibits],
  );

  const built = useMemo(() => {
    const layouts = PHOTO_PLACEMENTS.map(layoutFor);
    const frames: InstanceTransform[] = [];
    const mounts: InstanceTransform[] = [];
    const lightBars: InstanceTransform[] = [];
    const lightGlows: InstanceTransform[] = [];
    const easelWood: InstanceTransform[] = [];
    const photoQuads: TexturedQuad[] = [];
    const labelQuads: TexturedQuad[] = [];

    for (const l of layouts) {
      const p = l.placement;
      const { n, r, rotY } = l;
      const outerW = l.width + 2 * (l.mat + FRAME_BORDER);
      const outerH = l.height + 2 * (l.mat + FRAME_BORDER);
      frames.push({ x: p.x - n.x * 0.005, y: p.y, z: p.z - n.z * 0.005, rotationY: rotY, sx: outerW, sy: outerH, sz: FRAME_DEPTH, color: FRAME_COLORS[p.frame] });
      mounts.push({ x: p.x + n.x * 0.024, y: p.y, z: p.z + n.z * 0.024, rotationY: rotY, sx: l.width + 2 * l.mat, sy: l.height + 2 * l.mat, sz: 0.008 });
      const uv = photoAtlas.rects.get(p.memoryId);
      if (!uv) throw new Error(`Missing atlas cell for ${p.memoryId}`);
      photoQuads.push({ x: p.x + n.x * 0.03, y: p.y, z: p.z + n.z * 0.03, rotationY: rotY, width: l.width, height: l.height, uv });

      const labelUv = labelAtlas.rects.get(p.memoryId);
      if (!labelUv) throw new Error(`Missing label for ${p.memoryId}`);
      const lp = labelPosition(l);
      labelQuads.push({ ...lp, x: lp.x + n.x * 0.012, z: lp.z + n.z * 0.012, rotationY: rotY, width: LABEL_W, height: LABEL_H, uv: labelUv });
      mounts.push({ x: lp.x, y: lp.y, z: lp.z, rotationY: rotY, sx: LABEL_W + 0.02, sy: LABEL_H + 0.02, sz: 0.02, color: "#e9e1d2" });

      if (p.mount === "wall") {
        const top = p.y + outerH / 2 + 0.1;
        lightBars.push({ x: p.x + n.x * 0.13, y: top, z: p.z + n.z * 0.13, rotationY: rotY, sx: Math.max(0.4, l.width * 0.55), sy: 0.045, sz: 0.07 });
        lightBars.push({ x: p.x + n.x * 0.06, y: top + 0.02, z: p.z + n.z * 0.06, rotationY: rotY, sx: 0.04, sy: 0.04, sz: 0.12 });
        lightGlows.push({ x: p.x + n.x * 0.13, y: top - 0.026, z: p.z + n.z * 0.13, rotationY: rotY, sx: Math.max(0.36, l.width * 0.5), sy: 0.01, sz: 0.04 });
      } else {
        const legH = p.y + outerH / 2 + 0.1;
        for (const side of [-1, 1]) {
          const off = (outerW / 2 + 0.04) * side;
          easelWood.push({ x: p.x + r.x * off - n.x * 0.06, y: legH / 2, z: p.z + r.z * off - n.z * 0.06, rotationY: rotY, sx: 0.06, sy: legH, sz: 0.06 });
          // Feet.
          easelWood.push({ x: p.x + r.x * off - n.x * 0.06, y: 0.03, z: p.z + r.z * off - n.z * 0.06, rotationY: rotY, sx: 0.08, sy: 0.06, sz: 0.6 });
        }
        // Ledge and top rail.
        easelWood.push({ x: p.x + n.x * 0.02, y: p.y - outerH / 2 - 0.03, z: p.z + n.z * 0.02, rotationY: rotY, sx: outerW + 0.16, sy: 0.05, sz: 0.12 });
        easelWood.push({ x: p.x - n.x * 0.06, y: legH - 0.03, z: p.z - n.z * 0.06, rotationY: rotY, sx: outerW + 0.16, sy: 0.05, sz: 0.06 });
      }
    }

    return {
      frames,
      mounts,
      lightBars,
      lightGlows,
      easelWood,
      photos: texturedQuadsGeometry(photoQuads),
      labels: texturedQuadsGeometry(labelQuads),
    };
  }, [photoAtlas, labelAtlas]);

  const photoMaterial = useMemo(() => new THREE.MeshStandardMaterial({ map: photoAtlas.texture, roughness: 0.55 }), [photoAtlas]);
  const labelMaterial = useMemo(() => new THREE.MeshStandardMaterial({ map: labelAtlas.texture, roughness: 0.9 }), [labelAtlas]);
  const boxGeometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);

  useEffect(
    () => () => {
      photoAtlas.texture.dispose();
      labelAtlas.texture.dispose();
      photoMaterial.dispose();
      labelMaterial.dispose();
      built.photos?.dispose();
      built.labels?.dispose();
      boxGeometry.dispose();
    },
    [photoAtlas, labelAtlas, photoMaterial, labelMaterial, built, boxGeometry],
  );

  return (
    <group name="photographs">
      <Instanced geometry={boxGeometry} material={mats.whiteInstanced} items={built.frames} />
      <Instanced geometry={boxGeometry} material={mats.paper} items={built.mounts} castShadow={false} />
      <Instanced geometry={boxGeometry} material={mats.brass} items={built.lightBars} />
      <Instanced geometry={boxGeometry} material={mats.lampGlow} items={built.lightGlows} castShadow={false} />
      <Instanced geometry={boxGeometry} material={mats.oak} items={built.easelWood} />
      {built.photos && <mesh geometry={built.photos} material={photoMaterial} receiveShadow />}
      {built.labels && <mesh geometry={built.labels} material={labelMaterial} receiveShadow />}
      <InteractionHighlight />
    </group>
  );
}

/** A soft pulsing frame around the photograph the player can currently inspect. */
function InteractionHighlight() {
  const nearby = useGameStore((s) => s.nearby);
  const inspecting = useGameStore((s) => s.inspectingId);
  const ref = useRef<THREE.Mesh>(null);
  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ color: "#ffd88a", transparent: true, opacity: 0.6, depthWrite: false, toneMapped: false }),
    [],
  );
  const layout = useMemo(() => {
    if (!nearby) return null;
    const p = PHOTO_PLACEMENTS.find((pl) => pl.memoryId === nearby.memoryId);
    return p ? layoutFor(p) : null;
  }, [nearby]);

  const geometry = useMemo(() => {
    if (!layout) return null;
    const w = layout.width + 2 * (layout.mat + FRAME_BORDER) + 0.08;
    const h = layout.height + 2 * (layout.mat + FRAME_BORDER) + 0.08;
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2, -h / 2);
    shape.lineTo(w / 2, -h / 2);
    shape.lineTo(w / 2, h / 2);
    shape.lineTo(-w / 2, h / 2);
    shape.closePath();
    const t = 0.035;
    const hole = new THREE.Path();
    hole.moveTo(-w / 2 + t, -h / 2 + t);
    hole.lineTo(-w / 2 + t, h / 2 - t);
    hole.lineTo(w / 2 - t, h / 2 - t);
    hole.lineTo(w / 2 - t, -h / 2 + t);
    hole.closePath();
    shape.holes.push(hole);
    return new THREE.ShapeGeometry(shape);
  }, [layout]);

  useEffect(() => () => geometry?.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  useFrame(({ clock }) => {
    if (ref.current) material.opacity = 0.35 + 0.3 * (0.5 + 0.5 * Math.sin(clock.elapsedTime * 4));
  });

  if (!layout || !geometry || inspecting) return null;
  const p = layout.placement;
  return (
    <mesh
      ref={ref}
      geometry={geometry}
      material={material}
      position={[p.x + layout.n.x * 0.04, p.y, p.z + layout.n.z * 0.04]}
      rotation={[0, layout.rotY, 0]}
      renderOrder={3}
    />
  );
}
