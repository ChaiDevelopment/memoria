"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo } from "react";
import * as THREE from "three";
import { CAMERA } from "@/config/gameConfig";
import { gameStore, useGameStore } from "@/stores/gameStore";
import { remotePeers, setLocalRuntime } from "@/systems/presence/remotePeers";
import { createPlayerRuntime } from "@/systems/runtime";
import { getWorld } from "@/systems/world/buildWorld";
import type { QualityLevel } from "@/types/game";
import { Lighting } from "./Lighting";
import { MuseumWorld } from "./MuseumWorld";
import { Player } from "./Player";
import { PlayerController } from "./PlayerController";
import { RemotePlayers } from "./RemotePlayers";
import { ThirdPersonCamera } from "./ThirdPersonCamera";

const DPR: Record<QualityLevel, [number, number]> = {
  low: [0.75, 1],
  medium: [1, 1.5],
  high: [1, 2],
};

declare global {
  interface Window {
    /** Exposed only with `?debug` in the URL — used by automated browser tests. */
    __MEMORA__?: {
      runtime: ReturnType<typeof createPlayerRuntime>;
      store: typeof gameStore;
      remotePeers: typeof remotePeers;
      three?: { gl: THREE.WebGLRenderer; scene: THREE.Scene };
    };
  }
}

export default function GameCanvas({ onReady }: { onReady?: () => void }) {
  const runtime = useMemo(() => createPlayerRuntime(), []);
  const quality = useGameStore((s) => s.settings.quality);
  // The world grows Memory Rooms when the visitor has more photos than frames.
  const wingFrames = useGameStore((s) => s.wingFrames);
  const albumChapters = useGameStore((s) => s.album.length);
  const world = useMemo(() => getWorld(wingFrames, albumChapters), [wingFrames, albumChapters]);

  // Let the multiplayer connection read the local player's position.
  useEffect(() => {
    setLocalRuntime(runtime);
    return () => setLocalRuntime(null);
  }, [runtime]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("debug")) {
      window.__MEMORA__ = { runtime, store: gameStore, remotePeers };
      return () => {
        delete window.__MEMORA__;
      };
    }
  }, [runtime]);

  return (
    <Canvas
      // PCF shadows; individual lights decide whether they cast (quality setting).
      shadows="percentage"
      dpr={DPR[quality]}
      // MSAA stays on for Low too: it is nearly free on mobile (tile-based) GPUs
      // and removes the jagged window/door edges; Low still saves via DPR + no shadows.
      gl={{ antialias: true, powerPreference: "high-performance", stencil: false }}
      camera={{ fov: CAMERA.fov, near: CAMERA.near, far: CAMERA.far, position: [0, 3, 16] }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
        onReady?.();
      }}
      style={{ position: "absolute", inset: 0, touchAction: "none" }}
    >
      <color attach="background" args={["#e6dccb"]} />
      <Suspense fallback={null}>
        <MuseumWorld world={world} quality={quality} />
      </Suspense>
      <Lighting runtime={runtime} quality={quality} />
      <PlayerController runtime={runtime} world={world} />
      <Player runtime={runtime} blobShadow={quality === "low"} />
      <RemotePlayers />
      <ThirdPersonCamera runtime={runtime} world={world} />
      <DebugThree />
    </Canvas>
  );
}

/** With `?debug`, exposes the renderer and scene to automated performance checks. */
function DebugThree() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("debug")) return;
    const id = setInterval(() => {
      if (!window.__MEMORA__) return;
      window.__MEMORA__.three = { gl, scene };
      clearInterval(id);
    }, 200);
    return () => clearInterval(id);
  }, [gl, scene]);
  return null;
}
