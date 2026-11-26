import { mulberry32 } from "@/lib/random";
import type { Memory } from "@/types/memory";

/**
 * Paints stylised placeholder "photographs" with Canvas 2D. Deterministic per
 * memory seed and resolution-independent, so the same painter fills both the
 * low-res in-world atlas and the high-res inspection view.
 */

type Ctx = CanvasRenderingContext2D;
type Rand = () => number;

function vgrad(ctx: Ctx, h: number, stops: [number, string][]) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}

/** Fills a noisy ridge from baseY (fraction of h) down to the bottom. */
function ridge(ctx: Ctx, w: number, h: number, rand: Rand, baseY: number, amp: number, freq: number, color: string | CanvasGradient, jagged = 0) {
  const p1 = rand() * 10;
  const p2 = rand() * 10;
  const p3 = rand() * 10;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, h);
  const segments = 48;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const n =
      Math.sin(t * freq * 6.28 + p1) * 0.5 +
      Math.sin(t * freq * 13.1 + p2) * 0.3 +
      Math.sin(t * freq * 27.7 + p3) * 0.2 +
      (jagged > 0 ? (rand() - 0.5) * jagged : 0);
    ctx.lineTo(t * w, (baseY - n * amp) * h);
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
}

function disc(ctx: Ctx, x: number, y: number, r: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function glow(ctx: Ctx, x: number, y: number, r: number, color: string) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

function pine(ctx: Ctx, x: number, baseY: number, height: number, color: string) {
  const w = height * 0.36;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, baseY - height);
  for (let i = 1; i <= 3; i++) {
    const y = baseY - height + (height * i) / 3.2;
    ctx.lineTo(x + (w * i) / 3, y);
    ctx.lineTo(x + (w * i) / 6, y);
  }
  ctx.lineTo(x + w * 0.5, baseY);
  ctx.lineTo(x - w * 0.5, baseY);
  for (let i = 3; i >= 1; i--) {
    const y = baseY - height + (height * i) / 3.2;
    ctx.lineTo(x - (w * i) / 6, y);
    ctx.lineTo(x - (w * i) / 3, y);
  }
  ctx.closePath();
  ctx.fill();
}

function roundTree(ctx: Ctx, x: number, baseY: number, size: number, trunk: string, leaves: string) {
  ctx.fillStyle = trunk;
  ctx.fillRect(x - size * 0.06, baseY - size * 0.6, size * 0.12, size * 0.6);
  disc(ctx, x, baseY - size * 0.75, size * 0.38, leaves);
  disc(ctx, x - size * 0.22, baseY - size * 0.6, size * 0.26, leaves);
  disc(ctx, x + size * 0.24, baseY - size * 0.62, size * 0.28, leaves);
}

function water(ctx: Ctx, w: number, h: number, y0: number, top: string, bottom: string, rand: Rand, sparkle: string) {
  ctx.fillStyle = vgrad(ctx, h, [
    [y0 / h, top],
    [1, bottom],
  ]);
  ctx.fillRect(0, y0, w, h - y0);
  ctx.fillStyle = sparkle;
  for (let i = 0; i < 70; i++) {
    const y = y0 + Math.pow(rand(), 1.6) * (h - y0);
    const lw = (0.02 + rand() * 0.08) * w * (0.4 + (y - y0) / (h - y0));
    ctx.globalAlpha = 0.15 + rand() * 0.35;
    ctx.fillRect(rand() * w, y, lw, Math.max(1, h * 0.003));
  }
  ctx.globalAlpha = 1;
}

function stars(ctx: Ctx, w: number, h: number, rand: Rand, count: number, maxY: number) {
  ctx.fillStyle = "#fff8e8";
  for (let i = 0; i < count; i++) {
    ctx.globalAlpha = 0.3 + rand() * 0.7;
    const s = Math.max(1, w * 0.0025 * rand());
    ctx.fillRect(rand() * w, rand() * maxY * h, s, s);
  }
  ctx.globalAlpha = 1;
}

const painters: Record<Memory["scene"], (ctx: Ctx, w: number, h: number, r: Rand) => void> = {
  "sunset-sea": (ctx, w, h, r) => {
    ctx.fillStyle = vgrad(ctx, h, [
      [0, "#3d3a6b"],
      [0.35, "#c96b6b"],
      [0.58, "#f6b26b"],
      [0.62, "#ffd59a"],
    ]);
    ctx.fillRect(0, 0, w, h);
    const sx = w * (0.3 + r() * 0.4);
    glow(ctx, sx, h * 0.58, w * 0.35, "rgba(255,214,150,0.8)");
    disc(ctx, sx, h * 0.58, w * 0.06, "#fff0c8");
    water(ctx, w, h, h * 0.6, "#c7756b", "#2f2e52", r, "#ffe0a8");
    ctx.fillStyle = "rgba(255,230,180,0.5)";
    ctx.fillRect(sx - w * 0.05, h * 0.6, w * 0.1, h * 0.4);
    if (r() > 0.4) ridge(ctx, w, h, r, 0.63, 0.06, 0.6, "#2c2440");
  },
  mountains: (ctx, w, h, r) => {
    ctx.fillStyle = vgrad(ctx, h, [
      [0, "#6fa3d8"],
      [0.6, "#cfe4f2"],
    ]);
    ctx.fillRect(0, 0, w, h);
    disc(ctx, w * (0.2 + r() * 0.6), h * 0.18, w * 0.05, "#fffbe8");
    ridge(ctx, w, h, r, 0.5, 0.2, 1.1, "#8ea3bf", 0.25);
    // Snow caps: a lighter copy clipped near the peaks.
    ridge(ctx, w, h, r, 0.58, 0.16, 1.4, "#61788f", 0.3);
    ridge(ctx, w, h, r, 0.75, 0.06, 1.8, "#3d5a48");
    for (let i = 0; i < 26; i++) pine(ctx, r() * w, h * (0.8 + r() * 0.2), h * (0.1 + r() * 0.12), r() > 0.5 ? "#284a3a" : "#1f3b2f");
  },
  forest: (ctx, w, h, r) => {
    ctx.fillStyle = vgrad(ctx, h, [
      [0, "#d9e6d3"],
      [1, "#9db99a"],
    ]);
    ctx.fillRect(0, 0, w, h);
    const layers = ["#a9c2a2", "#7f9f7c", "#557a59", "#2f5240"];
    layers.forEach((color, i) => {
      const base = 0.62 + i * 0.12;
      for (let k = 0; k < 14 + i * 3; k++) pine(ctx, r() * w, h * (base + r() * 0.05), h * (0.25 + i * 0.07 + r() * 0.1), color);
      ctx.fillStyle = color;
      ctx.fillRect(0, h * (base + 0.04), w, h);
    });
    glow(ctx, w * 0.7, h * 0.15, w * 0.5, "rgba(255,250,220,0.45)");
  },
  "night-city": (ctx, w, h, r) => {
    ctx.fillStyle = vgrad(ctx, h, [
      [0, "#0e1330"],
      [0.7, "#2d2f5e"],
      [1, "#4a3b5e"],
    ]);
    ctx.fillRect(0, 0, w, h);
    stars(ctx, w, h, r, 90, 0.5);
    disc(ctx, w * (0.15 + r() * 0.7), h * 0.17, w * 0.04, "#f6ecd0");
    for (let layer = 0; layer < 2; layer++) {
      let x = -10;
      while (x < w) {
        const bw = w * (0.05 + r() * 0.08);
        const bh = h * (0.2 + r() * 0.35) * (layer === 0 ? 0.8 : 1);
        const top = h * (layer === 0 ? 0.62 : 0.72) - bh + h * 0.2;
        ctx.fillStyle = layer === 0 ? "#252a4d" : "#161a33";
        ctx.fillRect(x, top, bw, h - top);
        for (let wy = top + h * 0.02; wy < h; wy += h * 0.035) {
          for (let wx = x + bw * 0.12; wx < x + bw * 0.85; wx += bw * 0.2) {
            if (r() > 0.55) {
              ctx.fillStyle = r() > 0.3 ? "#ffd58a" : "#ffeccc";
              ctx.fillRect(wx, wy, bw * 0.08, h * 0.012);
            }
          }
        }
        x += bw + w * 0.005;
      }
    }
  },
  meadow: (ctx, w, h, r) => {
    ctx.fillStyle = vgrad(ctx, h, [
      [0, "#8cc2ec"],
      [0.55, "#e6f1f4"],
    ]);
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) {
      const cx = r() * w;
      const cy = h * (0.12 + r() * 0.2);
      for (let k = 0; k < 4; k++) disc(ctx, cx + (k - 1.5) * w * 0.035, cy + (k % 2) * h * 0.01, w * (0.03 + r() * 0.02), "rgba(255,255,255,0.9)");
    }
    ridge(ctx, w, h, r, 0.6, 0.06, 0.8, "#9cc47a");
    ridge(ctx, w, h, r, 0.72, 0.05, 0.6, "#7cae5d");
    roundTree(ctx, w * (0.2 + r() * 0.6), h * 0.7, h * 0.35, "#5b4030", "#4d8a45");
    const colors = ["#f6d55c", "#ed553b", "#f2f2f2", "#c47ac0", "#ffffff"];
    for (let i = 0; i < 260; i++) {
      const y = h * (0.72 + Math.pow(r(), 0.8) * 0.28);
      disc(ctx, r() * w, y, w * 0.004 * (0.6 + (y / h - 0.7) * 4), colors[i % colors.length]!);
    }
  },
  beach: (ctx, w, h, r) => {
    ctx.fillStyle = vgrad(ctx, h, [
      [0, "#4fa6dd"],
      [0.5, "#bfe6f5"],
    ]);
    ctx.fillRect(0, 0, w, h);
    water(ctx, w, h, h * 0.5, "#2fb3c4", "#7fd8d0", r, "#ffffff");
    ctx.fillStyle = "#f1dcaa";
    ctx.beginPath();
    ctx.moveTo(0, h * 0.78);
    ctx.quadraticCurveTo(w * 0.5, h * (0.66 + r() * 0.08), w, h * 0.82);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = h * 0.008;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.775);
    ctx.quadraticCurveTo(w * 0.5, h * 0.7, w, h * 0.815);
    ctx.stroke();
    const ux = w * (0.2 + r() * 0.5);
    ctx.fillStyle = "#e45b4f";
    ctx.beginPath();
    ctx.moveTo(ux - w * 0.08, h * 0.74);
    ctx.quadraticCurveTo(ux, h * 0.64, ux + w * 0.08, h * 0.74);
    ctx.fill();
    ctx.fillStyle = "#5b4030";
    ctx.fillRect(ux - 1, h * 0.72, Math.max(2, w * 0.004), h * 0.12);
  },
  snow: (ctx, w, h, r) => {
    ctx.fillStyle = vgrad(ctx, h, [
      [0, "#9fb3cf"],
      [0.6, "#e9eef5"],
    ]);
    ctx.fillRect(0, 0, w, h);
    ridge(ctx, w, h, r, 0.55, 0.08, 0.9, "#cdd8e6");
    ridge(ctx, w, h, r, 0.7, 0.05, 0.7, "#f6f8fb");
    for (let i = 0; i < 18; i++) pine(ctx, r() * w, h * (0.6 + r() * 0.15), h * (0.12 + r() * 0.1), "#3e5a5a");
    const cx = w * (0.25 + r() * 0.4);
    const cy = h * 0.8;
    ctx.fillStyle = "#6b4a36";
    ctx.fillRect(cx, cy - h * 0.12, w * 0.18, h * 0.12);
    ctx.fillStyle = "#fbfbfb";
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.02, cy - h * 0.11);
    ctx.lineTo(cx + w * 0.09, cy - h * 0.22);
    ctx.lineTo(cx + w * 0.2, cy - h * 0.11);
    ctx.fill();
    ctx.fillStyle = "#ffc86b";
    ctx.fillRect(cx + w * 0.03, cy - h * 0.08, w * 0.04, h * 0.04);
    glow(ctx, cx + w * 0.05, cy - h * 0.06, w * 0.08, "rgba(255,200,107,0.6)");
    ctx.fillStyle = "#ffffff";
    for (let i = 0; i < 160; i++) {
      ctx.globalAlpha = 0.5 + r() * 0.5;
      disc(ctx, r() * w, r() * h, w * 0.003 * (0.5 + r()), "#ffffff");
    }
    ctx.globalAlpha = 1;
  },
  lake: (ctx, w, h, r) => {
    ctx.fillStyle = vgrad(ctx, h, [
      [0, "#f2c7a5"],
      [0.5, "#f7e5cf"],
    ]);
    ctx.fillRect(0, 0, w, h);
    glow(ctx, w * 0.5, h * 0.45, w * 0.45, "rgba(255,236,200,0.7)");
    ridge(ctx, w, h, r, 0.42, 0.08, 0.9, "#a7a1b8");
    ridge(ctx, w, h, r, 0.5, 0.05, 1.3, "#6f7f86");
    // Mirror image of the far shore.
    ctx.save();
    ctx.translate(0, h);
    ctx.scale(1, -1);
    ctx.globalAlpha = 0.35;
    ridge(ctx, w, h, mulberry32(7), 0.5, 0.05, 1.3, "#6f7f86");
    ctx.restore();
    ctx.globalAlpha = 1;
    water(ctx, w, h, h * 0.52, "rgba(200,190,200,0.85)", "rgba(80,95,120,0.95)", r, "#fff3dd");
    ctx.fillStyle = "#5a4636";
    const px = w * (0.55 + r() * 0.2);
    ctx.fillRect(px, h * 0.68, w * 0.4, h * 0.025);
    for (let i = 0; i < 6; i++) ctx.fillRect(px + (i * w * 0.4) / 6, h * 0.68, w * 0.006, h * 0.08);
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.fillRect(0, h * 0.5, w, h * 0.06);
  },
  desert: (ctx, w, h, r) => {
    ctx.fillStyle = vgrad(ctx, h, [
      [0, "#f0a35e"],
      [0.5, "#fbe1a6"],
    ]);
    ctx.fillRect(0, 0, w, h);
    disc(ctx, w * (0.2 + r() * 0.6), h * 0.3, w * 0.07, "#fff2cc");
    ridge(ctx, w, h, r, 0.55, 0.08, 0.5, "#e7a764");
    ridge(ctx, w, h, r, 0.68, 0.09, 0.45, "#d98c4c");
    ridge(ctx, w, h, r, 0.82, 0.06, 0.4, "#b8683a");
    ctx.strokeStyle = "rgba(255,240,210,0.35)";
    ctx.lineWidth = Math.max(1, w * 0.003);
    for (let i = 0; i < 10; i++) {
      const y = h * (0.75 + r() * 0.25);
      ctx.beginPath();
      ctx.moveTo(r() * w, y);
      ctx.quadraticCurveTo(r() * w, y - h * 0.03, r() * w, y + h * 0.01);
      ctx.stroke();
    }
  },
  lanterns: (ctx, w, h, r) => {
    ctx.fillStyle = vgrad(ctx, h, [
      [0, "#1c1030"],
      [1, "#3d1f2f"],
    ]);
    ctx.fillRect(0, 0, w, h);
    const hues = ["255,170,90", "255,120,80", "255,210,130", "255,150,120"];
    for (let i = 0; i < 70; i++) {
      const x = r() * w;
      const y = r() * h;
      const rad = w * (0.01 + Math.pow(r(), 3) * 0.06);
      const c = hues[i % hues.length]!;
      glow(ctx, x, y, rad * 3, `rgba(${c},0.35)`);
      disc(ctx, x, y, rad, `rgba(${c},${0.35 + r() * 0.5})`);
    }
    ctx.strokeStyle = "rgba(40,20,30,0.9)";
    ctx.lineWidth = Math.max(1, h * 0.004);
    ctx.beginPath();
    ctx.moveTo(0, h * 0.25);
    ctx.quadraticCurveTo(w * 0.5, h * 0.42, w, h * 0.22);
    ctx.stroke();
    for (let i = 1; i < 8; i++) {
      const t = i / 8;
      const y = (1 - t) * (1 - t) * h * 0.25 + 2 * (1 - t) * t * h * 0.42 + t * t * h * 0.22;
      glow(ctx, t * w, y + h * 0.05, w * 0.06, "rgba(255,170,80,0.5)");
      ctx.fillStyle = i % 2 ? "#ff9a4d" : "#ffcc66";
      ctx.fillRect(t * w - w * 0.018, y + h * 0.02, w * 0.036, h * 0.06);
    }
  },
  autumn: (ctx, w, h, r) => {
    ctx.fillStyle = vgrad(ctx, h, [
      [0, "#e9c99a"],
      [0.6, "#f5e6cc"],
    ]);
    ctx.fillRect(0, 0, w, h);
    ridge(ctx, w, h, r, 0.62, 0.05, 0.8, "#c99a5b");
    const leaves = ["#d9772b", "#c4512a", "#e6a23c", "#a8452a"];
    for (let i = 0; i < 9; i++) {
      roundTree(ctx, (i / 8) * w + (r() - 0.5) * w * 0.08, h * (0.72 + r() * 0.06), h * (0.4 + r() * 0.2), "#4d3426", leaves[i % leaves.length]!);
    }
    ctx.fillStyle = "#b98a52";
    ctx.beginPath();
    ctx.moveTo(w * 0.42, h);
    ctx.quadraticCurveTo(w * 0.5, h * 0.82, w * 0.52, h * 0.74);
    ctx.lineTo(w * 0.55, h * 0.74);
    ctx.quadraticCurveTo(w * 0.6, h * 0.85, w * 0.7, h);
    ctx.fill();
    for (let i = 0; i < 140; i++) disc(ctx, r() * w, h * (0.76 + r() * 0.24), w * 0.004, leaves[i % leaves.length]!);
  },
};

/** Paints a memory into the rectangle (x, y, w, h) of the given context. */
export function paintMemory(ctx: Ctx, memory: Memory, x: number, y: number, w: number, h: number) {
  const rand = mulberry32(memory.seed * 9973);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.translate(x, y);
  painters[memory.scene](ctx, w, h, rand);

  // Photographic finish: warm grade, vignette and grain.
  ctx.globalCompositeOperation = "soft-light";
  ctx.fillStyle = "rgba(255,200,140,0.35)";
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = "source-over";
  const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(30,15,5,0.42)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
  const grains = Math.floor((w * h) / 90);
  for (let i = 0; i < grains; i++) {
    ctx.fillStyle = rand() > 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)";
    ctx.fillRect(rand() * w, rand() * h, 1, 1);
  }
  ctx.restore();
}

/** High-resolution data URL for the inspection overlay. */
export function renderMemoryDataUrl(memory: Memory, longSide = 1280): string {
  const w = memory.aspect >= 1 ? longSide : Math.round(longSide * memory.aspect);
  const h = memory.aspect >= 1 ? Math.round(longSide / memory.aspect) : longSide;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  paintMemory(ctx, memory, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.9);
}
