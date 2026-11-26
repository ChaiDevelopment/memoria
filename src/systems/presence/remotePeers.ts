import type { PeerInfo, PeerState } from "@/shared/presence";
import type { PlayerRuntime } from "@/systems/runtime";

/**
 * Per-frame multiplayer data, kept outside React (like the local player's
 * runtime). The presence connection writes timestamped samples; remote
 * avatars read them each frame and interpolate ~INTERP_DELAY_MS behind
 * real time, which hides network jitter.
 */

export const INTERP_DELAY_MS = 150;
const MAX_SAMPLES = 20;

interface Sample {
  t: number;
  s: PeerState;
}

export interface RemotePeer {
  info: PeerInfo;
  samples: Sample[];
}

export const remotePeers = new Map<string, RemotePeer>();

export function upsertPeer(info: PeerInfo, s: PeerState | null, now = performance.now()) {
  const existing = remotePeers.get(info.id);
  const peer = existing ?? { info, samples: [] };
  peer.info = info;
  if (s) pushSample(peer, s, now);
  remotePeers.set(info.id, peer);
}

export function pushState(id: string, s: PeerState, now = performance.now()) {
  const peer = remotePeers.get(id);
  if (peer) pushSample(peer, s, now);
}

function pushSample(peer: RemotePeer, s: PeerState, now: number) {
  peer.samples.push({ t: now, s });
  if (peer.samples.length > MAX_SAMPLES) peer.samples.splice(0, peer.samples.length - MAX_SAMPLES);
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpAngle = (a: number, b: number, t: number) => {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};

/** The peer's interpolated state at `renderTime` (null until the first sample). */
export function sampleAt(peer: RemotePeer, renderTime: number): PeerState | null {
  const samples = peer.samples;
  if (samples.length === 0) return null;
  const last = samples[samples.length - 1]!;
  if (renderTime >= last.t) return last.s;
  for (let i = samples.length - 1; i > 0; i--) {
    const a = samples[i - 1]!;
    const b = samples[i]!;
    if (renderTime >= a.t) {
      const k = (renderTime - a.t) / Math.max(1, b.t - a.t);
      return { ...b.s, x: lerp(a.s.x, b.s.x, k), y: lerp(a.s.y, b.s.y, k), z: lerp(a.s.z, b.s.z, k), f: lerpAngle(a.s.f, b.s.f, k) };
    }
  }
  return samples[0]!.s;
}

/** The local player's runtime, published by the canvas so the presence connection can read it. */
let localRuntime: PlayerRuntime | null = null;
export function setLocalRuntime(runtime: PlayerRuntime | null) {
  localRuntime = runtime;
}
export function getLocalRuntime(): PlayerRuntime | null {
  return localRuntime;
}
