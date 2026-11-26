import * as THREE from "three";
import { MEMORIES } from "@/config/memories";
import type { SignDef } from "@/config/museumLayout";
import { mulberry32 } from "@/lib/random";
import type { Memory } from "@/types/memory";
import { paintMemory } from "./photoPainter";

/**
 * Runtime-generated textures. Generating them procedurally keeps the bundle
 * tiny, avoids third-party asset licensing questions, and lets several images
 * share one texture (atlas) so they render in a single draw call.
 */

export interface UvRect {
  u0: number;
  v0: number;
  u1: number;
  v1: number;
}

export interface Atlas {
  texture: THREE.CanvasTexture;
  rects: Map<string, UvRect>;
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  return [canvas, ctx];
}

function finishTexture(canvas: HTMLCanvasElement, anisotropy = 4): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/** Draws `img` into the rect, scaled to cover it and centre-cropped (CSS object-fit: cover). */
function drawCover(ctx: CanvasRenderingContext2D, img: CanvasImageSource & { width: number; height: number }, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / img.width, h / img.height);
  const sw = w / scale;
  const sh = h / scale;
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
}

/**
 * All museum photographs packed into one texture. Frames with a real photo
 * (`photos`, keyed by frame slot id) show it cropped to fit; the rest show
 * the procedurally painted placeholder.
 */
export function createPhotoAtlas(cell: number, photos?: ReadonlyMap<string, HTMLImageElement>): Atlas {
  const cols = Math.ceil(Math.sqrt(MEMORIES.length));
  const rows = Math.ceil(MEMORIES.length / cols);
  const [canvas, ctx] = makeCanvas(cols * cell, rows * cell);
  const rects = new Map<string, UvRect>();
  MEMORIES.forEach((memory, i) => {
    const cx = (i % cols) * cell;
    const cy = Math.floor(i / cols) * cell;
    const pad = 2;
    const inner = cell - pad * 2;
    const w = memory.aspect >= 1 ? inner : Math.round(inner * memory.aspect);
    const h = memory.aspect >= 1 ? Math.round(inner / memory.aspect) : inner;
    const x = cx + Math.round((cell - w) / 2);
    const y = cy + Math.round((cell - h) / 2);
    const photo = photos?.get(memory.id);
    if (photo) drawCover(ctx, photo, x, y, w, h);
    else paintMemory(ctx, memory, x, y, w, h);
    rects.set(memory.id, {
      u0: x / canvas.width,
      u1: (x + w) / canvas.width,
      // Canvas Y grows downwards; texture V grows upwards (flipY = true).
      v0: 1 - (y + h) / canvas.height,
      v1: 1 - y / canvas.height,
    });
  });
  return { texture: finishTexture(canvas, 8), rects };
}

/** Museum wall labels (year + title) for every frame; `overrides` replaces placeholder text. */
export function createLabelAtlas(overrides?: ReadonlyMap<string, { title: string; year: number | null }>): Atlas {
  const cw = 512;
  const ch = 200;
  const cols = 4;
  const rows = Math.ceil(MEMORIES.length / cols);
  const [canvas, ctx] = makeCanvas(cw * cols, ch * rows);
  const rects = new Map<string, UvRect>();
  MEMORIES.forEach((memory: Memory, i) => {
    const x = (i % cols) * cw;
    const y = Math.floor(i / cols) * ch;
    ctx.fillStyle = "#f7f1e6";
    ctx.fillRect(x, y, cw, ch);
    ctx.fillStyle = "#b08d57";
    ctx.fillRect(x + 28, y + 26, 6, ch - 52);
    ctx.fillStyle = "#2b2118";
    ctx.font = "600 50px Georgia, 'Times New Roman', serif";
    ctx.textBaseline = "top";
    const text = overrides?.get(memory.id) ?? memory;
    ctx.fillText(text.year === null ? "—" : String(text.year), x + 52, y + 24);
    ctx.font = "italic 34px Georgia, 'Times New Roman', serif";
    wrapText(ctx, text.title, x + 52, y + 86, cw - 80, 38, 2);
    rects.set(memory.id, { u0: x / canvas.width, u1: (x + cw) / canvas.width, v0: 1 - (y + ch) / canvas.height, v1: 1 - y / canvas.height });
  });
  return { texture: finishTexture(canvas), rects };
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number) {
  const words = text.split(" ");
  let line = "";
  let lines = 0;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y + lines * lineHeight);
      lines++;
      line = word;
      if (lines >= maxLines) return;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, y + lines * lineHeight);
}

/** Wayfinding signs. Each sign gets a cell matching its aspect ratio. */
export function createSignAtlas(signs: readonly SignDef[]): Atlas {
  const pxPerMeter = 220;
  const cells = signs.map((s) => ({ s, w: Math.round(s.width * pxPerMeter), h: Math.round(s.height * pxPerMeter) }));
  const width = Math.max(...cells.map((c) => c.w));
  const height = cells.reduce((acc, c) => acc + c.h + 4, 0);
  const [canvas, ctx] = makeCanvas(width, height);
  const rects = new Map<string, UvRect>();
  let y = 0;
  for (const { s, w, h } of cells) {
    ctx.save();
    ctx.translate(0, y);
    if (s.style === "hero") {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#3a2c1f";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const titleSize = h * (s.subtitle ? 0.5 : 0.7);
      ctx.font = `500 ${titleSize}px Georgia, 'Times New Roman', serif`;
      drawSpaced(ctx, s.title, w / 2, h * (s.subtitle ? 0.38 : 0.5), titleSize * 0.28);
      if (s.subtitle) {
        ctx.fillStyle = "#8a6a3c";
        ctx.font = `italic ${h * 0.2}px Georgia, 'Times New Roman', serif`;
        ctx.fillText(s.subtitle, w / 2, h * 0.8);
      }
    } else {
      ctx.fillStyle = "#2f241b";
      roundRect(ctx, 0, 0, w, h, h * 0.18);
      ctx.fill();
      ctx.strokeStyle = "#c9a25e";
      ctx.lineWidth = h * 0.05;
      roundRect(ctx, h * 0.08, h * 0.08, w - h * 0.16, h - h * 0.16, h * 0.12);
      ctx.stroke();
      ctx.fillStyle = "#f3e3c3";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `500 ${h * 0.42}px Georgia, 'Times New Roman', serif`;
      drawSpaced(ctx, s.title.toUpperCase(), w / 2, h * 0.53, h * 0.06);
    }
    ctx.restore();
    rects.set(s.id, { u0: 0, u1: w / width, v0: 1 - (y + h) / height, v1: 1 - y / height });
    y += h + 4;
  }
  return { texture: finishTexture(canvas, 8), rects };
}

function drawSpaced(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, spacing: number) {
  const chars = [...text];
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
  let x = cx - total / 2;
  const align = ctx.textAlign;
  ctx.textAlign = "left";
  chars.forEach((c, i) => {
    ctx.fillText(c, x, cy);
    x += widths[i]! + spacing;
  });
  ctx.textAlign = align;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Warm oak plank floor. One tile covers `metersPerTile` meters. */
export function createWoodTexture(size = 1024): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(size, size);
  const rand = mulberry32(99);
  const planks = 8;
  const ph = size / planks;
  const tones = ["#b9875a", "#c49162", "#ad7b50", "#c99a6b", "#b38259", "#bd8b5c"];
  for (let row = 0; row < planks; row++) {
    let x = -rand() * size * 0.5;
    while (x < size) {
      const len = size * (0.35 + rand() * 0.4);
      const tone = tones[Math.floor(rand() * tones.length)]!;
      ctx.fillStyle = tone;
      ctx.fillRect(x, row * ph, len, ph);
      // Grain.
      for (let g = 0; g < 9; g++) {
        ctx.strokeStyle = `rgba(90,55,30,${0.05 + rand() * 0.08})`;
        ctx.lineWidth = 1 + rand() * 1.5;
        const gy = row * ph + rand() * ph;
        ctx.beginPath();
        ctx.moveTo(x, gy);
        ctx.bezierCurveTo(x + len * 0.3, gy + (rand() - 0.5) * 8, x + len * 0.6, gy + (rand() - 0.5) * 8, x + len, gy);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(60,35,20,0.55)";
      ctx.fillRect(x, row * ph, 2, ph);
      x += len;
    }
    ctx.fillStyle = "rgba(60,35,20,0.45)";
    ctx.fillRect(0, row * ph, size, 2);
  }
  // Wrap the leftmost overhang to the right edge for seamless tiling.
  const tex = finishTexture(canvas, 8);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** Soft mottled grass used on the ground plane. */
export function createGrassTexture(size = 512): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(size, size);
  const rand = mulberry32(7);
  ctx.fillStyle = "#86a85f";
  ctx.fillRect(0, 0, size, size);
  const tones = ["#7c9f57", "#91b268", "#7a9a52", "#9bbb70", "#87a45c"];
  for (let i = 0; i < 1400; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 4 + rand() * 18;
    ctx.fillStyle = tones[i % tones.length]!;
    ctx.globalAlpha = 0.25 + rand() * 0.3;
    // Draw wrapped copies so the texture tiles without seams.
    for (const ox of [-size, 0, size]) {
      for (const oy of [-size, 0, size]) {
        ctx.beginPath();
        ctx.arc(x + ox, y + oy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.globalAlpha = 1;
  const tex = finishTexture(canvas, 8);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}
