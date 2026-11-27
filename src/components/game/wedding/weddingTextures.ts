import * as THREE from "three";

/**
 * Canvas textures for the wedding venue's signs: the couple's welcome sign,
 * the event board and the wishes wall ("Ucapan & Doa"). Drawn once per change.
 */

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return { c, ctx: c.getContext("2d")! };
}

function texture(c: HTMLCanvasElement) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Wraps `text` into at most `maxLines` lines of `width` px (the last one ends with "…" if cut). */
export function wrapLines(ctx: CanvasRenderingContext2D, text: string, width: number, maxLines: number): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let line = "";
  for (let i = 0; i < words.length; i++) {
    const next = line ? `${line} ${words[i]}` : words[i]!;
    if (ctx.measureText(next).width > width && line) {
      lines.push(line);
      line = words[i]!;
      if (lines.length === maxLines) {
        lines[maxLines - 1] = `${lines[maxLines - 1]!.replace(/\s*\S*$/, "")}…`;
        return lines;
      }
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

function ornament(ctx: CanvasRenderingContext2D, cx: number, y: number, w: number) {
  ctx.strokeStyle = "#c9a25e";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, y);
  ctx.lineTo(cx - 12, y);
  ctx.moveTo(cx + 12, y);
  ctx.lineTo(cx + w / 2, y);
  ctx.stroke();
  ctx.fillStyle = "#c9a25e";
  ctx.beginPath();
  ctx.moveTo(cx, y - 7);
  ctx.lineTo(cx + 7, y);
  ctx.lineTo(cx, y + 7);
  ctx.lineTo(cx - 7, y);
  ctx.fill();
}

/** The hanging sign under the flower arch: "Groom & Bride". */
export function coupleSignTexture(groom: string, bride: string): THREE.CanvasTexture {
  const { c, ctx } = canvas(1024, 256);
  ctx.fillStyle = "#fbf6ec";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = "#c9a25e";
  ctx.lineWidth = 6;
  ctx.strokeRect(14, 14, c.width - 28, c.height - 28);
  ctx.textAlign = "center";
  ctx.fillStyle = "#a07a3e";
  ctx.font = "italic 34px Georgia, serif";
  ctx.fillText("The Wedding of", 512, 78);
  ctx.fillStyle = "#3a2c1f";
  let size = 86;
  const text = `${groom} & ${bride}`;
  do {
    ctx.font = `${size}px Georgia, serif`;
    size -= 4;
  } while (ctx.measureText(text).width > 920 && size > 30);
  ctx.fillText(text, 512, 178);
  return texture(c);
}

export interface BoardEvent {
  label: string;
  date: string;
  time: string;
  place: string;
}

const dateLabel = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
};

/** The event board at the entrance. */
export function infoBoardTexture(groom: string, bride: string, events: readonly BoardEvent[]): THREE.CanvasTexture {
  const { c, ctx } = canvas(640, 860);
  ctx.fillStyle = "#fbf6ec";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = "#c9a25e";
  ctx.lineWidth = 4;
  ctx.strokeRect(18, 18, c.width - 36, c.height - 36);
  ctx.textAlign = "center";
  ctx.fillStyle = "#a07a3e";
  ctx.font = "600 22px Georgia, serif";
  ctx.fillText("INFO ACARA", 320, 82);
  ornament(ctx, 320, 108, 260);
  ctx.fillStyle = "#3a2c1f";
  ctx.font = "italic 44px Georgia, serif";
  ctx.fillText(groom, 320, 176);
  ctx.font = "italic 30px Georgia, serif";
  ctx.fillText("&", 320, 218);
  ctx.font = "italic 44px Georgia, serif";
  ctx.fillText(bride, 320, 268);
  let y = 340;
  for (const ev of events.slice(0, 3)) {
    ctx.fillStyle = "#a07a3e";
    ctx.font = "600 26px Georgia, serif";
    ctx.fillText(ev.label, 320, y);
    ctx.fillStyle = "#3a2c1f";
    ctx.font = "24px Georgia, serif";
    ctx.fillText(ev.date ? dateLabel(ev.date) : "", 320, y + 36);
    ctx.font = "22px Georgia, serif";
    const line = [ev.time && `Pukul ${ev.time}`, ev.place].filter(Boolean).join(" · ");
    for (const [i, l] of wrapLines(ctx, line, 540, 2).entries()) ctx.fillText(l, 320, y + 70 + i * 28);
    y += 150;
  }
  ctx.fillStyle = "#8a6a3c";
  ctx.font = "italic 22px Georgia, serif";
  ctx.fillText("Tekan E untuk detail & lokasi", 320, c.height - 54);
  return texture(c);
}

export interface WishCard {
  name: string;
  message: string;
  role?: string;
}

const CARD_COLORS = ["#fdf1f0", "#f3f7ee", "#fbf3e2", "#eef3f8", "#f7eff7", "#fdf6ea"];

/** The wishes wall: the latest messages as little cards, each signed with its writer's name. */
export function wishesWallTexture(wishes: readonly WishCard[]): THREE.CanvasTexture {
  const { c, ctx } = canvas(1380, 780);
  ctx.fillStyle = "#f6efe2";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.textAlign = "center";
  ctx.fillStyle = "#3a2c1f";
  ctx.font = "italic 58px Georgia, serif";
  ctx.fillText("Ucapan & Doa", 690, 80);
  ctx.fillStyle = "#a07a3e";
  ctx.font = "italic 24px Georgia, serif";
  ctx.fillText(wishes.length ? "dari para tamu untuk kedua mempelai" : "Jadilah yang pertama menulis ucapan — tekan E", 690, 118);
  ornament(ctx, 690, 142, 360);

  const cols = 4;
  const cardW = 300;
  const cardH = 280;
  const gap = 26;
  const x0 = (c.width - (cols * cardW + (cols - 1) * gap)) / 2;
  wishes.slice(0, 8).forEach((w, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = x0 + col * (cardW + gap);
    const y = 170 + row * (cardH + 24);
    ctx.save();
    ctx.translate(x + cardW / 2, y + cardH / 2);
    ctx.rotate(((i * 37) % 7 - 3) * 0.006);
    ctx.shadowColor = "rgba(60,40,20,0.18)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = CARD_COLORS[i % CARD_COLORS.length]!;
    ctx.fillRect(-cardW / 2, -cardH / 2, cardW, cardH);
    ctx.shadowColor = "transparent";
    ctx.fillStyle = "#c9a25e";
    ctx.fillRect(-18, -cardH / 2 - 6, 36, 14);
    ctx.textAlign = "left";
    ctx.fillStyle = "#3a2c1f";
    ctx.font = "italic 23px Georgia, serif";
    wrapLines(ctx, `“${w.message}”`, cardW - 40, 6).forEach((l, j) => ctx.fillText(l, -cardW / 2 + 20, -cardH / 2 + 42 + j * 30));
    ctx.fillStyle = "#8a6a3c";
    ctx.font = "600 21px Georgia, serif";
    const sign = w.role === "bride" || w.role === "groom" ? `— ${w.name} (mempelai)` : `— ${w.name}`;
    ctx.fillText(wrapLines(ctx, sign, cardW - 40, 1)[0] ?? "", -cardW / 2 + 20, cardH / 2 - 24);
    ctx.restore();
  });
  return texture(c);
}

/** The digital envelope box's label. */
export function envelopeLabelTexture(): THREE.CanvasTexture {
  const { c, ctx } = canvas(512, 200);
  ctx.fillStyle = "#fbf6ec";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = "#c9a25e";
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, c.width - 20, c.height - 20);
  ctx.textAlign = "center";
  ctx.fillStyle = "#3a2c1f";
  ctx.font = "italic 48px Georgia, serif";
  ctx.fillText("Amplop Digital", 256, 96);
  ctx.fillStyle = "#8a6a3c";
  ctx.font = "italic 24px Georgia, serif";
  ctx.fillText("Tekan E untuk tanda kasih", 256, 148);
  return texture(c);
}

/** Polished marble tiles with soft veins and a thin inlay (ballroom floor; repeats). */
export function marbleTexture(size = 512): THREE.CanvasTexture {
  const { c, ctx } = canvas(size, size);
  ctx.fillStyle = "#efe8dc";
  ctx.fillRect(0, 0, size, size);
  let seed = 7;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  ctx.lineCap = "round";
  for (let i = 0; i < 26; i++) {
    ctx.strokeStyle = `rgba(150,135,115,${0.05 + r() * 0.12})`;
    ctx.lineWidth = 0.6 + r() * 1.8;
    ctx.beginPath();
    let x = r() * size;
    let y = r() * size;
    ctx.moveTo(x, y);
    for (let k = 0; k < 6; k++) {
      x += (r() - 0.5) * 140;
      y += (r() - 0.3) * 120;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // Tile joints and a diamond inlay at the corners.
  ctx.strokeStyle = "rgba(170,140,95,0.55)";
  ctx.lineWidth = 3;
  ctx.strokeRect(0, 0, size, size);
  ctx.fillStyle = "#c9a56a";
  const d = size * 0.07;
  for (const [x, y] of [[0, 0], [size, 0], [0, size], [size, size]] as const) {
    ctx.beginPath();
    ctx.moveTo(x, y - d);
    ctx.lineTo(x + d, y);
    ctx.lineTo(x, y + d);
    ctx.lineTo(x - d, y);
    ctx.fill();
  }
  const t = texture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Ivory backdrop panel with a gold arch, scrollwork and a monogram (ballroom stage). */
export function ornateBackdropTexture(groom: string, bride: string): THREE.CanvasTexture {
  const { c, ctx } = canvas(1300, 520);
  const g = ctx.createLinearGradient(0, 0, 0, c.height);
  g.addColorStop(0, "#f7efe0");
  g.addColorStop(1, "#ead9bb");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = "#c39a55";
  ctx.lineWidth = 10;
  ctx.strokeRect(16, 16, c.width - 32, c.height - 32);
  ctx.lineWidth = 3;
  ctx.strokeRect(36, 36, c.width - 72, c.height - 72);
  // Repeating scroll panels.
  ctx.lineWidth = 4;
  for (let i = 0; i < 8; i++) {
    const x = 90 + i * 160;
    if (x > 420 && x < 880) continue;
    ctx.beginPath();
    ctx.ellipse(x, 260, 46, 150, 0, 0, Math.PI * 2);
    ctx.stroke();
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(x + s * 18, 120, 18, 0, Math.PI * 2);
      ctx.arc(x + s * 18, 400, 18, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  // Central arch with a monogram.
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(470, 500);
  ctx.lineTo(470, 230);
  ctx.arc(650, 230, 180, Math.PI, 0);
  ctx.lineTo(830, 500);
  ctx.stroke();
  ctx.fillStyle = "#b8904c";
  ctx.textAlign = "center";
  ctx.font = "italic 150px Georgia, serif";
  ctx.fillText(`${groom.trim()[0] ?? ""}&${bride.trim()[0] ?? ""}`, 650, 300);
  ctx.font = "italic 30px Georgia, serif";
  ctx.fillText(`${groom} · ${bride}`, 650, 370);
  return texture(c);
}

/** The entrance easel: "Welcome to our Wedding" and the couple's names (content area of welcome-sign.glb). */
export function welcomeSignTexture(groom: string, bride: string): THREE.CanvasTexture {
  const { c, ctx } = canvas(768, 640);
  ctx.fillStyle = "#e8cfa9";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.textAlign = "center";
  ctx.fillStyle = "#5a3b28";
  ctx.font = "italic 88px Georgia, serif";
  ctx.fillText("Welcome", 384, 170);
  ctx.font = "italic 52px Georgia, serif";
  ctx.fillText("to our", 384, 250);
  ctx.font = "italic 88px Georgia, serif";
  ctx.fillText("Wedding", 384, 350);
  ornament(ctx, 384, 405, 300);
  ctx.fillStyle = "#7a5538";
  let size = 50;
  const names = `${groom} & ${bride}`;
  do {
    ctx.font = `italic ${size}px Georgia, serif`;
    size -= 2;
  } while (ctx.measureText(names).width > 640 && size > 24);
  ctx.fillText(names, 384, 490);
  ctx.font = "44px Georgia, serif";
  ctx.fillText("♡", 384, 570);
  return texture(c);
}
