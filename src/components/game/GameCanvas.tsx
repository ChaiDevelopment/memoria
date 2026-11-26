"use client";

import { Canvas } from "@react-three/fiber";
import { Suspense, useEffect, useMemo } from "react";
import * as THREE from "three";
import { CAMERA } from "@/config/gameConfig";
import { gameStore, useGameStore } from "@/stores/gameStore";
import { createPlayerRuntime } from "@/systems/runtime";
import type { QualityLevel } from "@/types/game";
import { Lighting } from "./Lighting";
import { MuseumWorld } from "./MuseumWorld";
import { Player } from "./Player";
import { PlayerController } from "./PlayerController";
import { ThirdPersonCamera } from "./ThirdPersonCamera";

const DPR: Record<QualityLevel, [number, number]> = {
  low: [0.75, 1],
  medium: [1, 1.5],
  high: [1, 2],
};

declare global {
  interface Window {
    /** Exposed only with `?debug` in the URL — used by automated browser tests. */
    __MEMORA__?: { runtime: ReturnType<typeof createPlayerRuntime>; store: typeof gameStore };
  }
}

export default function GameCanvas({ onReady }: { onReady?: () => void }) {
  const runtime = useMemo(() => createPlayerRuntime(), []);
  const quality = useGameStore((s) => s.settings.quality);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("debug")) {
      window.__MEMORA__ = { runtime, store: gameStore };
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
      gl={{ antialias: quality !== "low", powerPreference: "high-performance", stencil: false }}
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
        <MuseumWorld quality={quality} />
      </Suspense>
      <Lighting runtime={runtime} quality={quality} />
      <PlayerController runtime={runtime} />
      <Player runtime={runtime} blobShadow={quality === "low"} />
      <ThirdPersonCamera runtime={runtime} />
    </Canvas>
  );
}
