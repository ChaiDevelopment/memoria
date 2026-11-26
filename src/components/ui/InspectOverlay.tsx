"use client";

import { useMemo } from "react";
import { MEMORY_BY_ID } from "@/config/memories";
import { renderMemoryDataUrl } from "@/lib/textures/photoPainter";
import { useGameStore } from "@/stores/gameStore";
import { CloseIcon } from "./icons";

/**
 * Close-up view of a photograph: the visitor's own photo (shown whole, even
 * if the frame crops it) or, for empty frames, the placeholder painting.
 */
export function InspectOverlay() {
  const inspectingId = useGameStore((s) => s.inspectingId);
  if (!inspectingId) return null;
  return <InspectCard slotId={inspectingId} />;
}

interface View {
  title: string;
  year: number | null;
  text: string;
  src: string;
  portrait: boolean;
  placeholder: boolean;
}

function InspectCard({ slotId }: { slotId: string }) {
  const closeInspect = useGameStore((s) => s.closeInspect);
  const isTouch = useGameStore((s) => s.isTouch);
  const exhibit = useGameStore((s) => s.exhibits[slotId]);

  const view = useMemo<View | null>(() => {
    if (exhibit) {
      return {
        title: exhibit.title,
        year: exhibit.year,
        text: exhibit.story,
        src: exhibit.url,
        portrait: !!exhibit.width && !!exhibit.height && exhibit.height > exhibit.width,
        placeholder: false,
      };
    }
    const memory = MEMORY_BY_ID.get(slotId);
    if (!memory) return null;
    return {
      title: memory.title,
      year: memory.year,
      text: memory.caption,
      src: renderMemoryDataUrl(memory, 1280),
      portrait: memory.aspect < 1,
      placeholder: true,
    };
  }, [exhibit, slotId]);
  if (!view) return null;

  return (
    <div className="inspect-backdrop absolute inset-0 z-30 flex items-center justify-center p-4 sm:p-8" role="dialog" aria-modal="true" aria-label={`Inspecting ${view.title}`}>
      <div className={`inspect-card flex max-h-full w-full flex-col gap-5 rounded-3xl p-4 sm:p-6 ${view.portrait ? "max-w-[820px] md:flex-row" : "max-w-[980px]"}`}>
        <div className={`relative min-h-0 overflow-hidden rounded-lg bg-[#2a2018] p-2.5 shadow-[0_18px_50px_rgba(0,0,0,0.45)] sm:p-3.5 ${view.portrait ? "md:w-[55%]" : ""}`}>
          <img src={view.src} alt={view.title} className="block max-h-[58vh] w-full rounded-sm object-contain" draggable={false} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-between gap-4">
          <div>
            {view.year !== null && <div className="mb-1 font-display text-4xl text-gold">{view.year}</div>}
            <h2 className="font-display text-2xl italic text-ivory sm:text-3xl">{view.title}</h2>
            {view.text ? (
              <p className="mt-3 max-w-prose whitespace-pre-line text-[15px] leading-relaxed text-ivory/80">{view.text}</p>
            ) : (
              !view.placeholder && (
                <p className="mt-3 text-sm text-ivory/45">
                  No story yet — add one on the{" "}
                  <a href="/photos" className="text-gold underline-offset-4 hover:underline">
                    photos page
                  </a>
                  .
                </p>
              )
            )}
            {view.placeholder && (
              <p className="mt-4 inline-block rounded-full border border-ivory/15 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-ivory/45">Placeholder memory</p>
            )}
          </div>
          <div className="flex items-center justify-between gap-3">
            {!isTouch && <span className="text-xs text-ivory/50">Press E or Esc to step back</span>}
            <button type="button" onClick={closeInspect} className="primary-button ml-auto flex items-center gap-2">
              <CloseIcon size={16} /> Step back
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
