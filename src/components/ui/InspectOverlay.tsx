"use client";

import { useMemo } from "react";
import { MEMORY_BY_ID } from "@/config/memories";
import { renderMemoryDataUrl } from "@/lib/textures/photoPainter";
import { useGameStore } from "@/stores/gameStore";
import { CloseIcon } from "./icons";

/**
 * Close-up view of a photograph. Phase 1 shows placeholder content; later
 * phases attach real photos, stories and reactions here.
 */
export function InspectOverlay() {
  const inspectingId = useGameStore((s) => s.inspectingId);
  if (!inspectingId) return null;
  return <InspectCard memoryId={inspectingId} />;
}

function InspectCard({ memoryId }: { memoryId: string }) {
  const closeInspect = useGameStore((s) => s.closeInspect);
  const isTouch = useGameStore((s) => s.isTouch);
  const memory = MEMORY_BY_ID.get(memoryId);
  const src = useMemo(() => (memory ? renderMemoryDataUrl(memory, 1280) : null), [memory]);
  if (!memory || !src) return null;

  const portrait = memory.aspect < 1;
  return (
    <div className="inspect-backdrop absolute inset-0 z-30 flex items-center justify-center p-4 sm:p-8" role="dialog" aria-modal="true" aria-label={`Inspecting ${memory.title}`}>
      <div className={`inspect-card flex max-h-full w-full flex-col gap-5 rounded-3xl p-4 sm:p-6 ${portrait ? "max-w-[820px] md:flex-row" : "max-w-[980px]"}`}>
        <div className={`relative min-h-0 overflow-hidden rounded-lg bg-[#2a2018] p-2.5 shadow-[0_18px_50px_rgba(0,0,0,0.45)] sm:p-3.5 ${portrait ? "md:w-[55%]" : ""}`}>
          <img src={src} alt={memory.title} className="block max-h-[58vh] w-full rounded-sm object-contain" draggable={false} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-between gap-4">
          <div>
            <div className="mb-1 font-display text-4xl text-gold">{memory.year}</div>
            <h2 className="font-display text-2xl italic text-ivory sm:text-3xl">{memory.title}</h2>
            <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-ivory/80">{memory.caption}</p>
            <p className="mt-4 inline-block rounded-full border border-ivory/15 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-ivory/45">Placeholder memory</p>
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
