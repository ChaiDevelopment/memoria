import { describe, expect, it } from "vitest";
import { base64UrlEncode, signValue } from "@/server/crypto";
import { remotePeers, sampleAt, upsertPeer, pushState } from "@/systems/presence/remotePeers";
import { authorize } from "./presenceAuth";
import { chosenName, colorIndexFor, displayName, parseClientMessage, sanitizeState, SWEATER_COLORS, stateChanged, type PeerState } from "./presence";

const state: PeerState = { x: 1, y: 0, z: 2, f: 0.5, a: "walk", v: 3, vy: 0 };

describe("presence protocol", () => {
  it("accepts a valid state message", () => {
    expect(parseClientMessage(JSON.stringify({ t: "state", s: state }))).toEqual({ t: "state", s: state });
  });

  it("rejects malformed, oversized or unknown messages", () => {
    expect(parseClientMessage("not json")).toBeNull();
    expect(parseClientMessage(JSON.stringify({ t: "chat", text: "hi" }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ t: "state", s: { ...state, a: "fly" } }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ t: "state", s: { ...state, x: "1" } }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ t: "state", s: { ...state, x: Number.NaN } }))).toBeNull();
    expect(parseClientMessage("x".repeat(600))).toBeNull();
    expect(parseClientMessage(42)).toBeNull();
  });

  it("clamps out-of-range numbers instead of trusting them", () => {
    const s = sanitizeState({ ...state, x: 1e9, y: -1e9, v: 999 });
    expect(s).toMatchObject({ x: 500, y: -10, v: 20 });
  });

  it("gives each person a stable sweater colour", () => {
    const a = colorIndexFor("someone@gmail.com");
    expect(colorIndexFor("someone@gmail.com")).toBe(a);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(SWEATER_COLORS.length);
  });

  it("derives a short display name", () => {
    expect(displayName("Ayu Lestari", "ayu@gmail.com")).toBe("Ayu");
    expect(displayName(null, "rico.tp@gmail.com")).toBe("rico.tp");
    expect(displayName("   ", "x@y.z")).toBe("x");
    expect(chosenName("  Pak   Budi ", "g@visitor.memora")).toBe("Pak Budi");
    expect(chosenName("", "g@visitor.memora")).toBe("g");
  });

  it("only re-sends when something visibly changed", () => {
    expect(stateChanged(null, state)).toBe(true);
    expect(stateChanged(state, { ...state, x: 1.01 })).toBe(false);
    expect(stateChanged(state, { ...state, x: 1.2 })).toBe(true);
    expect(stateChanged(state, { ...state, a: "run" })).toBe(true);
  });
});

describe("presence tickets", () => {
  const secret = base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)));
  const claims = { email: "a@b.co", name: "A", room: "main", exp: 10_000 };

  it("accepts a valid, unexpired ticket", async () => {
    expect(await authorize(await signValue(claims, secret), secret, 5_000)).toEqual(claims);
  });

  it("rejects expired, forged or missing tickets", async () => {
    expect(await authorize(await signValue(claims, secret), secret, 20_000)).toBeNull();
    const other = base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)));
    expect(await authorize(await signValue(claims, other), secret, 5_000)).toBeNull();
    expect(await authorize(null, secret)).toBeNull();
    expect(await authorize("x.y", undefined)).toBeNull();
  });
});

describe("remote peer interpolation", () => {
  it("interpolates between samples and holds the latest one", () => {
    remotePeers.clear();
    upsertPeer({ id: "p", name: "P", color: 0 }, { ...state, x: 0, f: 0 }, 1000);
    pushState("p", { ...state, x: 2, f: 0.4 }, 1200);
    const peer = remotePeers.get("p")!;
    expect(sampleAt(peer, 1100)).toMatchObject({ x: 1, f: 0.2 });
    expect(sampleAt(peer, 5000)?.x).toBe(2);
    expect(sampleAt(peer, 0)?.x).toBe(0);
    remotePeers.clear();
  });
});
