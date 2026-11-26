"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useState, type FormEvent } from "react";
import { api, ApiClientError } from "@/lib/apiClient";
import { CloseIcon } from "@/components/ui/icons";

interface Photo {
  id: string;
  title: string;
  year: number | null;
  story: string;
  takenAt: string | null;
  width: number | null;
  height: number | null;
  filename: string;
  url: string;
  thumbUrl: string;
}

/**
 * "Our memories": every photo in the shared Google Drive folder. Adding a
 * photo = dropping it into that folder; this page picks it up on refresh.
 */
export function PhotosClient({ driveFolderUrl }: { driveFolderUrl: string }) {
  const [photos, setPhotos] = useState<Photo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState<Photo | null>(null);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await api<{ photos: Photo[] }>("/api/photos");
      setPhotos(data.photos);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not load the photos.");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl">Our memories</h1>
          <p className="mt-1 text-sm text-ivory/60">Everything in your shared Google Drive folder.</p>
        </div>
        <Link href="/" className="text-sm text-gold underline-offset-4 hover:underline">
          ← Back to the museum
        </Link>
      </div>

      <section className="account-card flex flex-col gap-4 rounded-3xl p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <h2 className="font-medium">Add photos</h2>
          <p className="text-sm text-ivory/60">Put photos in the shared Drive folder — they appear here automatically. Tap a photo to give it a title and a story.</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <a href={driveFolderUrl} target="_blank" rel="noopener noreferrer" className="primary-button">
            Open Drive folder
          </a>
          <button
            type="button"
            onClick={() => load()}
            disabled={refreshing}
            className="rounded-full border border-ivory/15 px-4 py-2.5 text-sm hover:border-gold/60 disabled:cursor-wait disabled:opacity-50"
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </section>

      {error ? (
        <p role="alert" className="rounded-2xl border border-ember/40 bg-ember/10 p-4 text-sm">
          {error}{" "}
          <button type="button" className="text-gold underline" onClick={() => load()}>
            Retry
          </button>
        </p>
      ) : photos === null ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4" aria-busy="true">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="aspect-square animate-pulse rounded-2xl bg-ivory/5" />
          ))}
        </div>
      ) : photos.length === 0 ? (
        <div className="account-card rounded-3xl px-6 py-14 text-center">
          <p className="font-display text-2xl">Your museum is waiting</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-ivory/60">Add a few favourite photos to the shared Drive folder, then press Refresh.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4" aria-label="Photos">
          {photos.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => setEditing(p)} className="photo-tile group block w-full text-left">
                <span className="block aspect-square overflow-hidden rounded-2xl bg-ivory/5">
                  <img src={p.thumbUrl} alt={p.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                </span>
                <span className="mt-2 block truncate font-display text-[15px] italic">{p.title}</span>
                <span className="block text-xs text-ivory/50">{p.year ?? "Year unknown"}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <EditDialog
          photo={editing}
          onClose={() => setEditing(null)}
          onSaved={(patch) => {
            setPhotos((list) => list?.map((x) => (x.id === patch.id ? { ...x, ...patch } : x)) ?? list);
            setEditing(null);
          }}
          onHidden={(id) => {
            setPhotos((list) => list?.filter((x) => x.id !== id) ?? list);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function EditDialog({
  photo,
  onClose,
  onSaved,
  onHidden,
}: {
  photo: Photo;
  onClose: () => void;
  onSaved: (p: Pick<Photo, "id" | "title" | "year" | "story">) => void;
  onHidden: (id: string) => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ids = { title: useId(), year: useId(), story: useId() };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const yearRaw = String(form.get("year") ?? "").trim();
    setPending(true);
    setError(null);
    try {
      const { photo: saved } = await api<{ photo: Pick<Photo, "id" | "title" | "year" | "story"> }>(`/api/photos/${photo.id}`, {
        method: "PATCH",
        body: { title: String(form.get("title") ?? ""), story: String(form.get("story") ?? ""), year: yearRaw ? Number(yearRaw) : null },
      });
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
      setPending(false);
    }
  }

  async function hide() {
    if (!window.confirm(`Hide “${photo.title}” from the museum? The photo stays in Google Drive, and you can bring it back by setting "Hidden" to FALSE in the Sheet.`)) return;
    setPending(true);
    try {
      await api(`/api/photos/${photo.id}`, { method: "PATCH", body: { hidden: true } });
      onHidden(photo.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not hide the photo.");
      setPending(false);
    }
  }

  return (
    <div className="inspect-backdrop fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4" role="dialog" aria-modal="true" aria-label={`Edit ${photo.title}`} onClick={onClose}>
      <div className="inspect-card my-auto grid w-full max-w-4xl gap-6 rounded-3xl p-4 sm:p-6 md:grid-cols-[1.3fr_1fr]" onClick={(e) => e.stopPropagation()}>
        <div className="overflow-hidden rounded-xl bg-[#2a2018] p-2">
          <img src={photo.url} alt={photo.title} className="mx-auto max-h-[62vh] w-full rounded-md object-contain" />
        </div>
        <form onSubmit={save} className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl">Edit memory</h2>
            <button type="button" onClick={onClose} aria-label="Close" className="hud-button">
              <CloseIcon size={16} />
            </button>
          </div>
          <label htmlFor={ids.title} className="flex flex-col gap-1.5 text-sm text-ivory/80">
            Title
            <input id={ids.title} name="title" defaultValue={photo.title} maxLength={120} required className="account-input" />
          </label>
          <label htmlFor={ids.year} className="flex flex-col gap-1.5 text-sm text-ivory/80">
            Year
            <input id={ids.year} name="year" type="number" inputMode="numeric" min={1800} max={new Date().getFullYear() + 1} defaultValue={photo.year ?? ""} className="account-input" />
          </label>
          <label htmlFor={ids.story} className="flex flex-col gap-1.5 text-sm text-ivory/80">
            Story
            <textarea id={ids.story} name="story" defaultValue={photo.story} maxLength={1000} rows={4} className="account-input resize-y" />
          </label>
          <p className="text-xs text-ivory/40">{photo.filename}</p>
          {error && (
            <p role="alert" className="rounded-xl border border-ember/40 bg-ember/10 px-3 py-2 text-sm">
              {error}
            </p>
          )}
          <div className="mt-auto flex items-center justify-between gap-3 pt-2">
            <button type="button" onClick={hide} disabled={pending} className="text-sm text-[#f2a58a] hover:underline disabled:opacity-50">
              Hide from museum
            </button>
            <button type="submit" disabled={pending} className="primary-button disabled:opacity-60">
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
