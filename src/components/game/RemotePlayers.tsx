"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { SWEATER_COLORS, type PeerInfo } from "@/shared/presence";
import { useGameStore } from "@/stores/gameStore";
import { CharacterAnimator } from "@/systems/animation/characterAnimator";
import { INTERP_DELAY_MS, remotePeers, sampleAt } from "@/systems/presence/remotePeers";
import { ProceduralCharacter } from "./character/ProceduralCharacter";
import type { CharacterModelHandle } from "./character/types";

/**
 * Other visitors in the museum. React only re-renders when someone joins or
 * leaves; positions are read from the mutable peer registry every frame and
 * interpolated slightly behind real time for smooth movement.
 */
export function RemotePlayers() {
  const peers = useGameStore((s) => s.peers);
  return (
    <group name="remote-players">
      {peers.map((p) => (
        <RemoteAvatar key={p.id} peer={p} />
      ))}
    </group>
  );
}

function RemoteAvatar({ peer }: { peer: PeerInfo }) {
  const root = useRef<THREE.Group>(null);
  const model = useRef<CharacterModelHandle>(null);
  const animator = useMemo(() => new CharacterAnimator(), []);
  const wedding = useGameStore((s) => s.world.kind === "wedding");
  // The couple are labelled (and dressed) as such — the server decides who they are.
  const label = peer.couple ? `${peer.name} · Pengantin` : peer.guest && !wedding ? `${peer.name} · Guest` : peer.name;
  const tag = useMemo(() => createNameTag(label, !!peer.couple), [label, peer.couple]);
  useEffect(() => () => (tag.material.map?.dispose(), tag.material.dispose()), [tag]);

  useFrame((_, rawDt) => {
    const g = root.current;
    const entry = remotePeers.get(peer.id);
    const s = entry ? sampleAt(entry, performance.now() - INTERP_DELAY_MS) : null;
    if (!g) return;
    g.visible = s !== null;
    if (!s) return;
    g.position.set(s.x, s.y, s.z);
    g.rotation.y = s.f;
    const pose = animator.update(Math.min(rawDt, 0.1), { state: s.a, horizontalSpeed: s.v, verticalVelocity: s.vy, landed: false });
    model.current?.applyPose(pose);
  });

  return (
    <group ref={root} name={`visitor-${peer.name}`} visible={false}>
      <ProceduralCharacter ref={model} sweater={SWEATER_COLORS[peer.color % SWEATER_COLORS.length]} outfit={peer.couple === "bride" ? "gown" : peer.couple === "groom" ? "suit" : "explorer"} />
      <primitive object={tag} position={[0, 2.15, 0]} />
    </group>
  );
}

/** A small floating name label (canvas sprite — no font loading, one draw call). */
function createNameTag(name: string, couple = false): THREE.Sprite {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const font = "600 44px ui-sans-serif, system-ui, sans-serif";
  canvas.height = 72;
  if (ctx) {
    ctx.font = font;
    canvas.width = Math.ceil(ctx.measureText(name).width) + 48;
    ctx.font = font;
    ctx.fillStyle = couple ? "rgba(166,124,58,0.9)" : "rgba(27,20,15,0.72)";
    const r = 30;
    ctx.beginPath();
    ctx.roundRect(0, 6, canvas.width, 60, r);
    ctx.fill();
    ctx.fillStyle = "#f6ecd9";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(name, canvas.width / 2, 37);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  const h = 0.28;
  sprite.scale.set((h * canvas.width) / canvas.height, h, 1);
  sprite.renderOrder = 5;
  return sprite;
}
