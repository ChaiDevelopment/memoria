"use client";

import { useCallback, useEffect, useState } from "react";

type WebkitDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
  webkitFullscreenEnabled?: boolean;
};
type WebkitElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };

/** Fullscreen API with the Safari prefix. `supported` is false on iPhone Safari. */
export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    const doc = document as WebkitDocument;
    setSupported(Boolean(doc.fullscreenEnabled || doc.webkitFullscreenEnabled));
    const update = () => setIsFullscreen(Boolean(doc.fullscreenElement || doc.webkitFullscreenElement));
    update();
    document.addEventListener("fullscreenchange", update);
    document.addEventListener("webkitfullscreenchange", update);
    return () => {
      document.removeEventListener("fullscreenchange", update);
      document.removeEventListener("webkitfullscreenchange", update);
    };
  }, []);

  const toggle = useCallback(async () => {
    const doc = document as WebkitDocument;
    try {
      if (doc.fullscreenElement || doc.webkitFullscreenElement) {
        await (doc.exitFullscreen ? doc.exitFullscreen() : doc.webkitExitFullscreen?.());
      } else {
        const el = document.documentElement as WebkitElement;
        await (el.requestFullscreen ? el.requestFullscreen({ navigationUI: "hide" }) : el.webkitRequestFullscreen?.());
      }
    } catch (err) {
      console.warn("[MEMORA] Fullscreen request was rejected:", err);
    }
  }, []);

  return { isFullscreen, supported, toggle };
}
