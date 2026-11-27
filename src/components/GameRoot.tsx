"use client";

import dynamic from "next/dynamic";
import { useCallback, useRef, useState } from "react";
import { useDesktopControls } from "@/hooks/useDesktopControls";
import { useInputDevice } from "@/hooks/useInputDevice";
import { useMuseumExhibits } from "@/hooks/useMuseumExhibits";
import { usePresence } from "@/hooks/usePresence";
import { GameErrorBoundary } from "./ui/ErrorBoundary";
import { GameHUD } from "./ui/GameHUD";
import { AlbumBook } from "./ui/AlbumBook";
import { ChatBox } from "./ui/ChatBox";
import { GuestbookPanel } from "./ui/GuestbookPanel";
import { InspectOverlay } from "./ui/InspectOverlay";
import { LiftMenu } from "./ui/LiftMenu";
import { MobileControls } from "./ui/MobileControls";
import { SettingsMenu } from "./ui/SettingsMenu";
import { TitleScreen } from "./ui/TitleScreen";
import { WeddingPanels } from "./ui/WeddingPanels";

// The Three.js bundle is split out and loaded on demand.
const GameCanvas = dynamic(() => import("./game/GameCanvas"), { ssr: false });

/** Client-only game shell: 3D canvas + layered UI + input wiring. */
export default function GameRoot({ initialKeyword, initialName }: { initialKeyword?: string; initialName?: string }) {
  const surface = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const onReady = useCallback(() => setReady(true), []);
  useDesktopControls(surface);
  useInputDevice();
  useMuseumExhibits();
  usePresence();

  return (
    <div ref={surface} id="memora-game" className="fixed inset-0 overflow-hidden bg-[#e6dccb] select-none" onContextMenu={(e) => e.preventDefault()}>
      <GameErrorBoundary>
        <GameCanvas onReady={onReady} />
        <MobileControls />
        <GameHUD />
        <ChatBox />
        <InspectOverlay />
        <LiftMenu />
        <AlbumBook />
        <SettingsMenu />
        <GuestbookPanel />
        <WeddingPanels />
        <TitleScreen ready={ready} initialKeyword={initialKeyword} initialName={initialName} />
      </GameErrorBoundary>
    </div>
  );
}
