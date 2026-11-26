"use client";

import dynamic from "next/dynamic";
import { useCallback, useRef, useState } from "react";
import { useDesktopControls } from "@/hooks/useDesktopControls";
import { useInputDevice } from "@/hooks/useInputDevice";
import { useMuseumExhibits } from "@/hooks/useMuseumExhibits";
import { GameErrorBoundary } from "./ui/ErrorBoundary";
import { GameHUD } from "./ui/GameHUD";
import { InspectOverlay } from "./ui/InspectOverlay";
import { MobileControls } from "./ui/MobileControls";
import { SettingsMenu } from "./ui/SettingsMenu";
import { TitleScreen } from "./ui/TitleScreen";

// The Three.js bundle is split out and loaded on demand.
const GameCanvas = dynamic(() => import("./game/GameCanvas"), { ssr: false });

/** Client-only game shell: 3D canvas + layered UI + input wiring. */
export default function GameRoot() {
  const surface = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const onReady = useCallback(() => setReady(true), []);
  useDesktopControls(surface);
  useInputDevice();
  useMuseumExhibits();

  return (
    <div ref={surface} id="memora-game" className="fixed inset-0 overflow-hidden bg-[#e6dccb] select-none" onContextMenu={(e) => e.preventDefault()}>
      <GameErrorBoundary>
        <GameCanvas onReady={onReady} />
        <MobileControls />
        <GameHUD />
        <InspectOverlay />
        <SettingsMenu />
        <TitleScreen ready={ready} />
      </GameErrorBoundary>
    </div>
  );
}
