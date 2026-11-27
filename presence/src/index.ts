import { DurableObject } from "cloudflare:workers";
import { authorize } from "../../src/shared/presenceAuth";
import {
  CHAT_HISTORY,
  colorIndexFor,
  chosenName,
  displayName,
  MAX_PEERS,
  MIN_CHAT_INTERVAL_MS,
  MIN_STATE_INTERVAL_MS,
  parseClientMessage,
  PING_MESSAGE,
  PONG_MESSAGE,
  type ChatEntry,
  type PeerInfo,
  type PeerState,
  type ServerMessage,
} from "../../src/shared/presence";

/**
 * MEMORA presence server — a small standalone Worker.
 *
 *   GET /ws?token=…  → WebSocket into the museum's Durable Object
 *   GET /health      → "ok"
 *
 * The token is minted by the main app (/api/presence/token) for allow-listed,
 * signed-in visitors and signed with the shared SESSION_SECRET; it lives one
 * minute and is only used to open the socket.
 *
 * The Durable Object uses the WebSocket Hibernation API: between messages it
 * can be evicted from memory, each socket's peer data lives in its
 * attachment, and keep-alive pings are answered by the runtime without
 * waking it — all of which keeps usage inside the free tier.
 */

export interface Env {
  PRESENCE: DurableObjectNamespace<MuseumPresence>;
  SESSION_SECRET: string;
}

interface Attachment {
  peer: PeerInfo;
  s: PeerState | null;
  last: number;
  /** Last chat message / reaction (ms), for rate limiting. */
  lastChat?: number;
}

const CHAT_KEY = "chat";
/** Chat history older than this is not shown to newcomers. */
const CHAT_MAX_AGE_MS = 6 * 60 * 60 * 1000;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health") return new Response("ok");
    if (url.pathname !== "/ws") return new Response("Not found", { status: 404 });
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") return new Response("Expected a WebSocket", { status: 426 });

    const claims = await authorize(url.searchParams.get("token"), env.SESSION_SECRET);
    if (!claims) return new Response("Unauthorized", { status: 401 });

    const stub = env.PRESENCE.get(env.PRESENCE.idFromName(claims.room));
    const headers = new Headers(request.headers);
    const couple = claims.couple === "bride" || claims.couple === "groom" ? claims.couple : undefined;
    headers.set("x-memora-user", JSON.stringify({ email: claims.email, name: claims.name, guest: claims.guest === true, couple }));
    return stub.fetch(new Request(request.url, { headers }));
  },
} satisfies ExportedHandler<Env>;

export class MuseumPresence extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // Keep-alive answered by the runtime: no wake-up, no billed duration.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(PING_MESSAGE, PONG_MESSAGE));
  }

  override async fetch(request: Request): Promise<Response> {
    let user: { email: string; name: string; guest?: boolean; couple?: "bride" | "groom" };
    try {
      user = JSON.parse(request.headers.get("x-memora-user") ?? "");
    } catch {
      return new Response("Bad request", { status: 400 });
    }

    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    const others = this.ctx.getWebSockets();
    if (others.length >= MAX_PEERS) {
      this.ctx.acceptWebSocket(server);
      server.send(JSON.stringify({ t: "full" } satisfies ServerMessage));
      server.close(1013, "Museum is full");
      return new Response(null, { status: 101, webSocket: client });
    }

    const peer: PeerInfo = {
      id: crypto.randomUUID().slice(0, 8),
      name: user.guest || user.couple ? chosenName(user.name, user.email) : displayName(user.name, user.email),
      color: colorIndexFor(user.email),
      ...(user.guest ? { guest: true } : {}),
      ...(user.couple === "bride" || user.couple === "groom" ? { couple: user.couple } : {}),
    };
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ peer, s: null, last: 0 } satisfies Attachment);

    const peers = others.map((ws) => ws.deserializeAttachment() as Attachment | null).filter((a): a is Attachment => !!a).map((a) => ({ ...a.peer, s: a.s }));
    const history = ((await this.ctx.storage.get<ChatEntry[]>(CHAT_KEY)) ?? []).filter((m) => Date.now() - m.at < CHAT_MAX_AGE_MS);
    server.send(JSON.stringify({ t: "welcome", id: peer.id, peers, chat: history } satisfies ServerMessage));
    this.broadcast({ t: "join", peer }, server);
    return new Response(null, { status: 101, webSocket: client });
  }

  override async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const msg = parseClientMessage(typeof message === "string" ? message : null);
    if (!msg) return;
    const att = ws.deserializeAttachment() as Attachment | null;
    if (!att) return;
    const now = Date.now();
    if (msg.t === "chat" || msg.t === "react") {
      if (now - (att.lastChat ?? 0) < MIN_CHAT_INTERVAL_MS) return; // rate limit
      att.lastChat = now;
      ws.serializeAttachment(att);
      if (msg.t === "react") {
        this.broadcast({ t: "react", id: att.peer.id, e: msg.e }, null);
        return;
      }
      const entry: ChatEntry = {
        id: att.peer.id,
        name: att.peer.name,
        text: msg.text,
        at: now,
        ...(att.peer.guest ? { guest: true } : {}),
        ...(att.peer.couple ? { couple: att.peer.couple } : {}),
      };
      // Everyone (the sender too) gets the server's cleaned-up copy.
      this.broadcast({ t: "chat", m: entry }, null);
      const history = ((await this.ctx.storage.get<ChatEntry[]>(CHAT_KEY)) ?? []).filter((m) => now - m.at < CHAT_MAX_AGE_MS);
      history.push(entry);
      await this.ctx.storage.put(CHAT_KEY, history.slice(-CHAT_HISTORY));
      return;
    }
    if (now - att.last < MIN_STATE_INTERVAL_MS) return; // rate limit
    att.s = msg.s;
    att.last = now;
    ws.serializeAttachment(att);
    this.broadcast({ t: "state", id: att.peer.id, s: msg.s }, ws);
  }

  override async webSocketClose(ws: WebSocket): Promise<void> {
    this.leave(ws);
  }

  override async webSocketError(ws: WebSocket): Promise<void> {
    this.leave(ws);
  }

  private leave(ws: WebSocket) {
    const att = ws.deserializeAttachment() as Attachment | null;
    if (att) this.broadcast({ t: "leave", id: att.peer.id }, ws);
    try {
      ws.close(1000, "bye");
    } catch {
      /* already closed */
    }
  }

  private broadcast(msg: ServerMessage, except: WebSocket | null) {
    const data = JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except) continue;
      try {
        ws.send(data);
      } catch {
        /* socket closing; its close handler announces the leave */
      }
    }
  }
}
