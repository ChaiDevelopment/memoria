"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { MAX_CHAT_LENGTH, REACTIONS, type ChatEntry } from "@/shared/presence";
import { useGameStore } from "@/stores/gameStore";
import { sendPresence } from "@/systems/presence/remotePeers";
import { exitPointerLock } from "@/systems/input/pointerLock";

/** Messages fade from the log after this long (unless the chat is open). */
const FADE_MS = 20_000;

/**
 * World chat: a small log of recent messages, an input (Enter / 💬) and quick
 * reactions. Messages go through the multiplayer server to everyone in the
 * same world; they also appear as speech bubbles over the sender's head.
 */
export function ChatBox() {
  const phase = useGameStore((s) => s.phase);
  const online = useGameStore((s) => s.presence === "online");
  const chat = useGameStore((s) => s.chat);
  const open = useGameStore((s) => s.chatOpen);
  const openChat = useGameStore((s) => s.openChat);
  const closeChat = useGameStore((s) => s.closeChat);
  const selfId = useGameStore((s) => s.selfId);
  const isTouch = useGameStore((s) => s.isTouch);
  const menuOpen = useGameStore((s) => s.menuOpen);
  const [text, setText] = useState("");
  const [picker, setPicker] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [note, setNote] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const log = useRef<HTMLUListElement>(null);
  const lastSent = useRef(0);

  // Re-render now and then so old messages fade out of the log.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 2000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (open) exitPointerLock();
  }, [open]);
  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [chat, open]);

  if (phase !== "playing" || !online || menuOpen) return null;

  const tooFast = () => {
    const t = Date.now();
    if (t - lastSent.current < 1000) return true;
    lastSent.current = t;
    return false;
  };
  const send = (e: FormEvent) => {
    e.preventDefault();
    const clean = text.replace(/\s+/g, " ").trim();
    if (!clean) return closeChat();
    if (tooFast()) return setNote("Pelan-pelan ya — tunggu sebentar.");
    if (!sendPresence({ t: "chat", text: clean })) return setNote("Chat belum tersambung. Coba lagi sebentar.");
    setText("");
    setNote(null);
    closeChat();
  };
  const react = (e: (typeof REACTIONS)[number]) => {
    if (tooFast()) return;
    sendPresence({ t: "react", e });
    setPicker(false);
  };

  const recent: ChatEntry[] = open ? chat.slice(-30) : chat.filter((m) => now - m.at < FADE_MS).slice(-5);
  const place = isTouch ? "left-[max(14px,env(safe-area-inset-left))] top-[max(150px,calc(env(safe-area-inset-top)+136px))] w-[min(78vw,340px)]" : "bottom-[max(16px,env(safe-area-inset-bottom))] left-[max(16px,env(safe-area-inset-left))] w-[min(30vw,380px)] min-w-[300px]";

  return (
    // The wrapper lets touches through (dragging to look around); only its controls catch them.
    <div className={`pointer-events-none absolute z-20 flex flex-col gap-2 ${place}`} data-testid="chat">
      {recent.length > 0 && (
        <ul ref={log} className={`flex flex-col gap-1 overflow-y-auto ${open ? "hud-panel pointer-events-auto max-h-[40vh] rounded-2xl p-3" : ""}`} aria-live="polite">
          {recent.map((m, i) => (
            <li key={`${m.at}-${m.id}-${i}`} className={`text-[13px] leading-snug ${open ? "" : "w-fit rounded-xl bg-black/35 px-2.5 py-1 backdrop-blur-sm"}`}>
              <span className={`mr-1.5 font-semibold ${m.couple ? "text-gold" : m.id === selfId ? "text-[#f3d7a6]" : "text-ivory/90"}`}>
                {m.couple ? "💍 " : ""}
                {m.name}
              </span>
              <span className="break-words text-ivory/90">{m.text}</span>
            </li>
          ))}
        </ul>
      )}

      {open ? (
        <form onSubmit={send} className="pointer-events-auto flex items-center gap-2" data-testid="chat-form">
          <input
            ref={input}
            // Focus at once, so the first letters typed after Enter aren't lost.
            autoFocus
            value={text}
            onChange={(e) => (setText(e.target.value.slice(0, MAX_CHAT_LENGTH)), setNote(null))}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Escape") closeChat();
            }}
            onBlur={() => isTouch || setTimeout(() => !text && closeChat(), 120)}
            maxLength={MAX_CHAT_LENGTH}
            enterKeyHint="send"
            placeholder="Ketik pesan… (Enter untuk kirim)"
            aria-label="Pesan chat"
            className="join-input flex-1 !py-2 text-sm"
            data-testid="chat-input"
          />
          <button type="submit" className="primary-button !px-4 !py-2 text-sm">
            Kirim
          </button>
        </form>
      ) : (
        <div className="pointer-events-auto flex w-fit items-center gap-2">
          <button type="button" onClick={openChat} className="hud-panel rounded-full px-3.5 py-2 text-sm text-ivory/90 hover:text-gold" data-testid="chat-open">
            💬 {isTouch ? "Chat" : <span className="text-ivory/60">Tekan Enter untuk chat</span>}
          </button>
          <button type="button" onClick={() => setPicker((v) => !v)} aria-expanded={picker} className="hud-panel rounded-full px-3 py-2 text-sm" aria-label="Reaksi" data-testid="react-open">
            😊
          </button>
          {picker && (
            <div className="hud-panel flex gap-1 rounded-full px-2 py-1" role="menu">
              {REACTIONS.map((e) => (
                <button key={e} type="button" onClick={() => react(e)} className="rounded-full px-1.5 py-1 text-lg transition-transform hover:scale-125" aria-label={`Reaksi ${e}`} data-testid={`react-${e}`}>
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {note && <p className="text-xs text-ember">{note}</p>}
    </div>
  );
}
