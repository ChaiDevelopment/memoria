"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { api, ApiClientError } from "@/lib/apiClient";
import { useGameStore } from "@/stores/gameStore";
import { requestPointerLock } from "@/systems/input/pointerLock";
import { EmblemIcon } from "./icons";

const LAST_VISIT_KEY = "memora:visiting";
const MAX_NAME = 24;

type Step = "landing" | "join" | "welcome" | "not-found";

/**
 * MEMORA's landing page, shown over the live (slowly orbiting) museum view:
 * branding, "Join World" (name + keyword → read-only visitor pass), and a
 * quiet way in for the museum's owners. Signed-in owners and visitors with
 * a valid pass go straight to "Enter".
 */
export function TitleScreen({ ready, initialKeyword }: { ready: boolean; initialKeyword?: string }) {
  const phase = useGameStore((s) => s.phase);
  const enterMuseum = useGameStore((s) => s.enterMuseum);
  const isTouch = useGameStore((s) => s.isTouch);
  const museumName = useGameStore((s) => s.museumName);
  const viewer = useGameStore((s) => s.viewer);
  const viewerStatus = useGameStore((s) => s.viewerStatus);
  const refreshAccess = useGameStore((s) => s.refreshAccess);

  const [step, setStep] = useState<Step>(initialKeyword ? "join" : "landing");
  const [name, setName] = useState("");
  const [keyword, setKeyword] = useState(initialKeyword ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [soon, setSoon] = useState(false);
  const nameInput = useRef<HTMLInputElement>(null);

  // A visitor whose pass expired (or whose museum closed) gets a gentle note.
  useEffect(() => {
    if (viewerStatus !== "ready") return;
    if (viewer?.role === "visitor") {
      localStorage.setItem(LAST_VISIT_KEY, "1");
      setStep((s) => (s === "landing" || s === "join" ? "welcome" : s));
    } else if (!viewer && localStorage.getItem(LAST_VISIT_KEY)) {
      localStorage.removeItem(LAST_VISIT_KEY);
      setNotice("Your visit has ended. Enter the keyword again to come back in.");
    }
  }, [viewer, viewerStatus]);

  useEffect(() => {
    if (step === "join") nameInput.current?.focus();
  }, [step]);

  if (phase !== "title") return null;

  const enter = () => {
    enterMuseum();
    if (!isTouch) requestPointerLock();
  };

  const join = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleanName = name.replace(/\s+/g, " ").trim();
    const cleanKeyword = keyword.replace(/\s+/g, "").toLowerCase();
    if (!cleanName) return setError("Please tell us your name.");
    if (!cleanKeyword) return setError("Please enter the museum's keyword.");
    setBusy(true);
    try {
      await api("/api/world/join", { method: "POST", body: { keyword: cleanKeyword, name: cleanName } });
      localStorage.setItem(LAST_VISIT_KEY, "1");
      refreshAccess();
      setStep("welcome");
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 404) setStep("not-found");
      else if (err instanceof ApiClientError && err.status < 500) setError(err.message);
      else setError("We couldn't reach MEMORA. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const leave = async () => {
    await api("/api/world/leave", { method: "POST", body: {} }).catch(() => undefined);
    localStorage.removeItem(LAST_VISIT_KEY);
    setStep("landing");
    refreshAccess();
  };

  const loading = viewerStatus === "loading";
  const enterLabel = !ready || loading ? "Preparing the galleries…" : "Enter Museum";

  return (
    <div className="title-backdrop absolute inset-0 z-50 flex flex-col items-center justify-end overflow-y-auto px-5 pb-[max(40px,env(safe-area-inset-bottom))] pt-10 sm:justify-center sm:pb-0">
      <div className="title-rise flex w-full max-w-md flex-col items-center text-center">
        <EmblemIcon size={36} className="mb-3 text-gold" />
        <h1 className="font-display text-5xl tracking-[0.42em] text-ivory drop-shadow-[0_4px_24px_rgba(0,0,0,0.35)] sm:text-7xl">MEMORA</h1>
        <div className="my-4 h-px w-40 bg-gradient-to-r from-transparent via-gold to-transparent" />

        {/* Owners and visitors who are already inside. */}
        {viewer && step !== "not-found" ? (
          <div className="step-in flex flex-col items-center">
            <p className="text-xs uppercase tracking-[0.25em] text-gold/90">{viewer.role === "visitor" ? "Welcome to" : `Welcome back, ${viewer.name}`}</p>
            <p className="mt-2 font-display text-2xl italic text-ivory sm:text-3xl">{museumName}</p>
            {viewer.role === "visitor" && <p className="mt-2 text-sm text-ivory/65">You're visiting as <span className="text-ivory">{viewer.name}</span>.</p>}
            <button type="button" onClick={enter} disabled={!ready || loading} className="primary-button mt-8 min-w-[220px] text-base disabled:cursor-wait disabled:opacity-60" data-testid="enter-museum">
              {enterLabel}
            </button>
            <p className="mt-4 text-xs text-ivory/50">{isTouch ? "Left stick to move · drag on the right to look around" : "WASD to move · mouse to look · Shift to run · E to interact"}</p>
            {viewer.role === "visitor" ? (
              <button type="button" onClick={leave} className="mt-5 text-xs text-ivory/55 underline-offset-4 hover:text-ivory hover:underline">
                Not {viewer.name}? Leave this world
              </button>
            ) : (
              <Link href="/photos" className="mt-5 text-sm text-gold/90 underline-offset-4 hover:text-gold hover:underline">
                Manage your photos →
              </Link>
            )}
          </div>
        ) : step === "join" ? (
          <form onSubmit={join} className="step-in hud-panel w-full rounded-3xl p-5 text-left sm:p-6" noValidate>
            <h2 className="font-display text-2xl text-ivory">Join a World</h2>
            <p className="mt-1 text-sm text-ivory/60">Before entering, what should we call you?</p>
            <label className="mt-5 block text-xs font-semibold uppercase tracking-[0.18em] text-ivory/60" htmlFor="visitor-name">
              Your name
            </label>
            <input
              ref={nameInput}
              id="visitor-name"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, MAX_NAME))}
              maxLength={MAX_NAME}
              autoComplete="nickname"
              placeholder="Enter your name..."
              className="join-input mt-1.5"
            />
            <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.18em] text-ivory/60" htmlFor="world-keyword">
              Museum keyword
            </label>
            <input
              id="world-keyword"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value.slice(0, 64))}
              maxLength={64}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="Enter museum keyword..."
              className="join-input mt-1.5"
            />
            {error && (
              <p role="alert" className="mt-4 rounded-xl border border-ember/40 bg-ember/10 px-3 py-2 text-sm text-ivory">
                {error}
              </p>
            )}
            <div className="mt-6 flex items-center gap-3">
              <button type="button" onClick={() => (setStep("landing"), setError(null))} className="rounded-full px-4 py-2.5 text-sm text-ivory/70 hover:text-ivory">
                Back
              </button>
              <button type="submit" disabled={busy} className="primary-button ml-auto min-w-[160px] disabled:opacity-60" data-testid="join-world-submit">
                {busy ? "Searching…" : "Join World"}
              </button>
            </div>
          </form>
        ) : step === "not-found" ? (
          <div className="step-in hud-panel w-full rounded-3xl p-6" role="alert">
            <h2 className="font-display text-2xl text-ivory">World Not Found</h2>
            <p className="mt-2 text-sm text-ivory/70">We couldn't find a museum with that keyword. Please check the keyword and try again.</p>
            <button type="button" onClick={() => setStep("join")} className="primary-button mt-6 min-w-[180px]">
              Try again
            </button>
          </div>
        ) : (
          <div className="step-in flex flex-col items-center">
            <p className="font-display text-3xl text-ivory sm:text-4xl">Every Memory Has a World.</p>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-ivory/70">Enter a world of memories. Discover and explore a virtual museum using its unique keyword.</p>
            {notice && <p className="mt-4 rounded-xl border border-gold/30 bg-gold/10 px-3 py-2 text-sm text-ivory/85">{notice}</p>}
            <button type="button" onClick={() => setStep("join")} className="primary-button mt-8 min-w-[220px] text-base" data-testid="join-world">
              Join World
            </button>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm">
              <a href="/login?next=/" className="text-gold/90 underline-offset-4 hover:text-gold hover:underline">
                Owner sign in
              </a>
              <span className="text-ivory/25">·</span>
              <button type="button" onClick={() => setSoon((v) => !v)} className="text-ivory/65 underline-offset-4 hover:text-ivory hover:underline">
                Create your world
              </button>
            </div>
            {soon && <p className="mt-3 text-xs text-ivory/55">Bring your own memories to MEMORA — coming soon.</p>}
            <button type="button" onClick={enter} disabled={!ready} className="mt-6 text-xs text-ivory/45 underline-offset-4 hover:text-ivory/80 hover:underline disabled:opacity-40" data-testid="enter-museum">
              {ready ? "Or take a quick tour of the demo museum" : "Preparing the galleries…"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
