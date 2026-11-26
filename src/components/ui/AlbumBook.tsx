"use client";

import { useEffect, useState } from "react";
import { useGameStore } from "@/stores/gameStore";
import { exitPointerLock } from "@/systems/input/pointerLock";
import { CloseIcon } from "./icons";

/**
 * Reading an Album Kata chapter: its photos on the left, the words on the
 * right, and page turns to the previous / next chapter.
 */
export function AlbumBook() {
  const index = useGameStore((s) => s.albumIndex);
  if (index === null) return null;
  return <AlbumPage index={index} />;
}

function AlbumPage({ index }: { index: number }) {
  const album = useGameStore((s) => s.album);
  const openAlbum = useGameStore((s) => s.openAlbum);
  const close = useGameStore((s) => s.closeAlbum);
  const isTouch = useGameStore((s) => s.isTouch);
  const chapter = album[index];
  const [photo, setPhoto] = useState(0);

  useEffect(() => setPhoto(0), [index]);
  useEffect(() => {
    exitPointerLock();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") openAlbum(index + 1);
      if (e.key === "ArrowLeft") openAlbum(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, openAlbum]);

  if (!chapter) return null;
  const main = chapter.photos[photo] ?? chapter.photos[0];

  return (
    <div className="inspect-backdrop absolute inset-0 z-30 flex items-center justify-center p-3 sm:p-8" role="dialog" aria-modal="true" aria-label={`Album Kata: ${chapter.title}`}>
      <div className="inspect-card relative flex max-h-full w-full max-w-[1040px] flex-col gap-5 overflow-y-auto rounded-3xl p-4 sm:p-6 md:flex-row">
        <button type="button" onClick={close} className="absolute right-3 top-3 z-10 rounded-full bg-black/30 p-2 text-ivory/70 hover:bg-ivory/10 hover:text-ivory" aria-label="Close">
          <CloseIcon />
        </button>

        {main && (
          <div className="flex min-h-0 flex-col gap-2 md:w-[52%]">
            <div className="overflow-hidden rounded-lg bg-[#2a2018] p-2 shadow-[0_18px_50px_rgba(0,0,0,0.45)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img key={main.id} src={main.url} alt="" className="max-h-[52vh] w-full rounded object-contain" />
            </div>
            {chapter.photos.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {chapter.photos.map((p, i) => (
                  <button key={p.id} type="button" onClick={() => setPhoto(i)} className={`h-14 w-14 shrink-0 overflow-hidden rounded-md border-2 ${i === photo ? "border-gold" : "border-transparent opacity-70 hover:opacity-100"}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.thumbUrl} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col justify-center gap-3 px-1 md:px-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">
            Album Kata · Bab {index + 1} dari {album.length}
          </p>
          <h2 className="font-display text-3xl leading-tight text-ivory sm:text-4xl">{chapter.title}</h2>
          {chapter.period && <p className="font-display text-sm italic text-ivory/60">{chapter.period}</p>}
          <p className="whitespace-pre-line font-display text-lg leading-relaxed text-ivory/90">{chapter.words}</p>

          <div className="mt-4 flex items-center gap-3">
            <button type="button" disabled={index === 0} onClick={() => openAlbum(index - 1)} className="rounded-full border border-ivory/20 px-4 py-2 text-sm text-ivory/80 transition hover:border-gold hover:text-ivory disabled:opacity-30">
              ← Sebelumnya
            </button>
            <button type="button" disabled={index === album.length - 1} onClick={() => openAlbum(index + 1)} className="rounded-full bg-gold px-4 py-2 text-sm font-semibold text-ink transition hover:brightness-110 disabled:opacity-30">
              Berikutnya →
            </button>
            {!isTouch && <span className="ml-auto text-[11px] text-ivory/40">← → balik halaman · E tutup</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
