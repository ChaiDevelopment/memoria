"use client";

import { useEffect } from "react";
import { api, ApiClientError } from "@/lib/apiClient";
import { PING_MESSAGE, parseServerMessage, stateChanged, type PeerState } from "@/shared/presence";
import { gameStore, useGameStore } from "@/stores/gameStore";
import { getLocalRuntime, pushState, remotePeers, setPresenceSender, upsertPeer } from "@/systems/presence/remotePeers";

const SEND_INTERVAL_MS = 200; // ≤ 5 updates/s, and only when something changed
const PING_INTERVAL_MS = 25_000;

function currentState(): PeerState | null {
  const r = getLocalRuntime();
  if (!r) return null;
  const p = r.motor.position;
  return { x: p.x, y: p.y, z: p.z, f: r.motor.facing, a: r.anim.state, v: r.motor.horizontalSpeed, vy: r.motor.velocity.y };
}

/**
 * Connects signed-in visitors to the multiplayer presence server and keeps
 * the remote-peer registry up to date. Signed-out visitors, or servers
 * without PRESENCE_URL, simply stay solo.
 */
export function usePresence() {
  // Reconnect when someone joins with the keyword (or leaves).
  const accessVersion = useGameStore((st) => st.accessVersion);
  useEffect(() => {
    let socket: WebSocket | null = null;
    let stopped = false;
    let retry = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let sendTimer: ReturnType<typeof setInterval> | undefined;
    let pingTimer: ReturnType<typeof setInterval> | undefined;
    let lastSent: PeerState | null = null;

    const syncPeers = () => {
      gameStore.getState().setPresence("online", [...remotePeers.values()].map((p) => p.info));
    };

    const cleanup = () => {
      setPresenceSender(null);
      gameStore.getState().setSelfId(null);
      clearInterval(sendTimer);
      clearInterval(pingTimer);
      remotePeers.clear();
      lastSent = null;
    };

    const scheduleReconnect = () => {
      if (stopped) return;
      cleanup();
      gameStore.getState().setPresence("connecting", []);
      const delay = Math.min(30_000, 1000 * 2 ** retry++);
      retryTimer = setTimeout(connect, delay);
    };

    async function connect() {
      if (stopped) return;
      let ticket: { token: string | null; url: string | null };
      try {
        ticket = await api<{ token: string | null; url: string | null }>("/api/presence/token");
      } catch (err) {
        // Not signed in / not invited / not configured: stay solo, don't retry.
        if (err instanceof ApiClientError && [401, 403, 503].includes(err.status)) {
          gameStore.getState().setPresence("off", []);
          return;
        }
        scheduleReconnect();
        return;
      }
      if (stopped) return;
      if (!ticket.token || !ticket.url) {
        gameStore.getState().setPresence("off", []);
        return;
      }
      gameStore.getState().setPresence("connecting");
      const ws = new WebSocket(`${ticket.url}/ws?token=${encodeURIComponent(ticket.token)}`);
      socket = ws;

      ws.onopen = () => {
        retry = 0;
        setPresenceSender((msg) => {
          if (ws.readyState !== WebSocket.OPEN) return false;
          ws.send(JSON.stringify(msg));
          return true;
        });
        sendTimer = setInterval(() => {
          if (ws.readyState !== WebSocket.OPEN || document.hidden) return;
          const s = currentState();
          if (!s || !stateChanged(lastSent, s)) return;
          ws.send(JSON.stringify({ t: "state", s }));
          lastSent = s;
        }, SEND_INTERVAL_MS);
        pingTimer = setInterval(() => ws.readyState === WebSocket.OPEN && ws.send(PING_MESSAGE), PING_INTERVAL_MS);
      };

      ws.onmessage = (event) => {
        const msg = parseServerMessage(event.data);
        if (!msg) return;
        switch (msg.t) {
          case "welcome":
            gameStore.getState().setSelfId(msg.id);
            gameStore.getState().addChat(msg.chat ?? [], true);
            remotePeers.clear();
            for (const p of msg.peers) upsertPeer({ id: p.id, name: p.name, color: p.color, ...(p.guest ? { guest: true } : {}), ...(p.couple ? { couple: p.couple } : {}) }, p.s);
            lastSent = null; // announce our position to everyone right away
            syncPeers();
            break;
          case "join":
            upsertPeer(msg.peer, null);
            lastSent = null; // so the newcomer sees us immediately
            syncPeers();
            break;
          case "leave":
            remotePeers.delete(msg.id);
            syncPeers();
            break;
          case "state":
            pushState(msg.id, msg.s);
            break;
          case "chat":
            gameStore.getState().addChat([msg.m]);
            break;
          case "react":
            gameStore.getState().addReaction(msg.id, msg.e);
            break;
          case "full":
            stopped = true;
            gameStore.getState().setPresence("off", []);
            break;
        }
      };

      ws.onclose = () => {
        if (socket === ws) socket = null;
        scheduleReconnect();
      };
      ws.onerror = () => ws.close();
    }

    void connect();
    return () => {
      stopped = true;
      clearTimeout(retryTimer);
      cleanup();
      socket?.close(1000, "leaving");
      gameStore.getState().setPresence("off", []);
    };
  }, [accessVersion]);
}
