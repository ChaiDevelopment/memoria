"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useGameStore } from "@/stores/gameStore";

/** How long a chat message floats over its sender's head (ms). */
export const BUBBLE_MS = 6000;
const REACTION_MS = 2200;

function wrap(ctx: CanvasRenderingContext2D, text: string, width: number, maxLines: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > width && line) {
      lines.push(line);
      line = w;
      if (lines.length === maxLines) break;
    } else line = next;
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length) lines[maxLines - 1] = `${lines[maxLines - 1]!.slice(0, -1)}…`;
  return lines;
}

/** A white speech bubble with a little tail (canvas sprite; no font loading). */
function bubbleSprite(text: string): THREE.Sprite {
  const c = document.createElement("canvas");
  const ctx = c.getContext("2d")!;
  const font = "500 34px ui-sans-serif, system-ui, sans-serif";
  ctx.font = font;
  const lines = wrap(ctx, text, 460, 3);
  const w = Math.min(520, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 48);
  const h = lines.length * 42 + 30;
  c.width = Math.ceil(w);
  c.height = h + 18;
  ctx.font = font;
  ctx.fillStyle = "rgba(255,252,245,0.96)";
  ctx.beginPath();
  ctx.roundRect(0, 0, c.width, h, 24);
  ctx.moveTo(c.width / 2 - 14, h - 1);
  ctx.lineTo(c.width / 2, h + 16);
  ctx.lineTo(c.width / 2 + 14, h - 1);
  ctx.fill();
  ctx.fillStyle = "#2a1f17";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  lines.forEach((l, i) => ctx.fillText(l, c.width / 2, 15 + 21 + i * 42));
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  const scale = 0.0042;
  sprite.scale.set(c.width * scale, c.height * scale, 1);
  sprite.center.set(0.5, 0);
  sprite.renderOrder = 6;
  return sprite;
}

function emojiSprite(e: string): THREE.Sprite {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d")!;
  ctx.font = "96px 'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(e, 64, 72);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sprite.scale.set(0.45, 0.45, 1);
  sprite.renderOrder = 7;
  return sprite;
}

/** Speech bubble and floating reactions for one person, drawn above their head. */
export function ChatOverhead({ peerId, height = 2.4 }: { peerId: string | null; height?: number }) {
  const latest = useGameStore((s) => {
    if (!peerId) return null;
    for (let i = s.chat.length - 1; i >= 0; i--) if (s.chat[i]!.id === peerId) return s.chat[i]!;
    return null;
  });
  const reactions = useGameStore((s) => s.reactions);
  const mine = useMemo(() => (peerId ? reactions.filter((r) => r.id === peerId) : []), [reactions, peerId]);

  // Show a message only while it is fresh — not the old history a newcomer receives.
  const [visible, setVisible] = useState<string | null>(null);
  useEffect(() => {
    if (!latest) return;
    const left = BUBBLE_MS - Math.max(0, Date.now() - latest.at);
    if (left <= 500) return;
    setVisible(latest.text);
    const t = setTimeout(() => setVisible(null), left);
    return () => clearTimeout(t);
  }, [latest]);

  const bubble = useMemo(() => (visible ? bubbleSprite(visible) : null), [visible]);
  useEffect(() => () => {
    if (!bubble) return;
    bubble.material.map?.dispose();
    bubble.material.dispose();
  }, [bubble]);

  return (
    <group position={[0, height, 0]}>
      {bubble && <primitive object={bubble} />}
      {mine.map((r) => (
        <FloatingEmoji key={r.key} e={r.e} />
      ))}
    </group>
  );
}

function FloatingEmoji({ e }: { e: string }) {
  const sprite = useMemo(() => emojiSprite(e), [e]);
  useEffect(() => () => (sprite.material.map?.dispose(), sprite.material.dispose()), [sprite]);
  const born = useRef(performance.now());
  const drift = useRef((Math.random() - 0.5) * 0.5);
  useFrame(() => {
    const t = (performance.now() - born.current) / REACTION_MS;
    sprite.visible = t < 1;
    if (t >= 1) return;
    sprite.position.set(drift.current * t, 0.2 + t * 1.1, 0);
    sprite.material.opacity = t < 0.15 ? t / 0.15 : 1 - Math.max(0, (t - 0.6) / 0.4);
    const s = 0.35 + Math.min(1, t * 5) * 0.15;
    sprite.scale.set(s, s, 1);
  });
  return <primitive object={sprite} />;
}
