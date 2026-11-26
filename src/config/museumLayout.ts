import type { AreaDef, CeilingDef, FloorDef, WallDef } from "@/types/world";

/**
 * MEMORA museum floor plan (meters, Y-up, +Z = south, -Z = north).
 *
 *                  z=-24 ┌──────── window ────────┐
 *     Memory Garden      │   Main Memory Gallery   │
 *     (outdoor,     door ┤   x ∈ [-12, 12]         │
 *      x ∈ [-42,-9])     │   z ∈ [-24, 0]          │
 *                   z=0  └───────┐  door  ┌────────┘
 *                         ┌──────┘        └──────┐        Timeline Hall
 *                    door ┤   Grand Lobby        ├ door ──── x ∈ [9, 41], z ∈ [3, 11] ──┐
 *                         │   x ∈ [-9, 9]        │                                      │
 *                   z=14  └──── glass entrance ──┘──────────────────────────────────────┘
 *
 * Every wall here generates both render geometry and collision boxes, so the
 * two can never drift apart. Openings of kind "door" are walkable; "window"
 * openings are glazed and still block movement.
 */

export const WALL_THICKNESS = 0.4;
const T = WALL_THICKNESS;
const H = T / 2;

export const LOBBY_HEIGHT = 7;
export const GALLERY_HEIGHT = 6;
export const TIMELINE_HEIGHT = 5;

export const SPAWN = { x: 0, y: 0, z: 11, facing: Math.PI } as const;

export const AREAS: AreaDef[] = [
  {
    id: "lobby",
    name: "Grand Entrance Lobby",
    subtitle: "Welcome to the museum",
    bounds: { minX: -9, maxX: 9, minZ: 0, maxZ: 14 },
    indoor: true,
  },
  {
    id: "gallery",
    name: "Main Memory Gallery",
    subtitle: "Moments worth keeping",
    bounds: { minX: -12, maxX: 12, minZ: -24, maxZ: 0 },
    indoor: true,
  },
  {
    id: "timeline",
    name: "Timeline Hall",
    subtitle: "The years, one by one",
    bounds: { minX: 9, maxX: 41, minZ: 3, maxZ: 11 },
    indoor: true,
  },
  {
    id: "garden",
    name: "Memory Garden",
    subtitle: "Where memories grow",
    bounds: { minX: -42, maxX: -9, minZ: -28, maxZ: 18 },
    indoor: false,
  },
];

export const WALLS: WallDef[] = [
  // ── Grand Lobby ────────────────────────────────────────────────────────
  {
    id: "lobby-north",
    area: "lobby",
    axis: "x",
    at: 0,
    from: -12 - H,
    to: 12 + H,
    height: LOBBY_HEIGHT,
    thickness: T,
    openings: [{ kind: "door", start: -2.5, end: 2.5, bottom: 0, top: 4.4 }],
  },
  {
    id: "lobby-south",
    area: "lobby",
    axis: "x",
    at: 14,
    from: -9 - H,
    to: 9 + H,
    height: LOBBY_HEIGHT,
    thickness: T,
    exterior: true,
    openings: [
      { kind: "window", start: -7.6, end: -3.8, bottom: 0.7, top: 5.6 },
      // Glazed main entrance (closed in Phase 1).
      { kind: "window", start: -2.2, end: 2.2, bottom: 0, top: 4.6 },
      { kind: "window", start: 3.8, end: 7.6, bottom: 0.7, top: 5.6 },
    ],
  },
  {
    id: "lobby-west",
    area: "lobby",
    axis: "z",
    at: -9,
    from: H,
    to: 14 + H,
    height: LOBBY_HEIGHT,
    thickness: T,
    openings: [
      { kind: "window", start: 1.4, end: 3.6, bottom: 1.0, top: 5.0 },
      { kind: "door", start: 5, end: 9, bottom: 0, top: 3.6 },
      { kind: "window", start: 10.4, end: 12.6, bottom: 1.0, top: 5.0 },
    ],
  },
  {
    id: "lobby-east",
    area: "lobby",
    axis: "z",
    at: 9,
    from: H,
    to: 14 + H,
    height: LOBBY_HEIGHT,
    thickness: T,
    openings: [{ kind: "door", start: 5, end: 9, bottom: 0, top: 3.8 }],
  },

  // ── Main Memory Gallery ────────────────────────────────────────────────
  {
    id: "gallery-west",
    area: "gallery",
    axis: "z",
    at: -12,
    from: -24 - H,
    to: -H,
    height: GALLERY_HEIGHT,
    thickness: T,
    openings: [
      { kind: "window", start: -21.5, end: -17.5, bottom: 1.0, top: 4.6 },
      { kind: "door", start: -14, end: -10, bottom: 0, top: 3.4 },
      { kind: "window", start: -6.5, end: -2.5, bottom: 1.0, top: 4.6 },
    ],
  },
  {
    id: "gallery-east",
    area: "gallery",
    axis: "z",
    at: 12,
    from: -24 - H,
    to: -H,
    height: GALLERY_HEIGHT,
    thickness: T,
    exterior: true,
    openings: [],
  },
  {
    id: "gallery-north",
    area: "gallery",
    axis: "x",
    at: -24,
    from: -12 - H,
    to: 12 + H,
    height: GALLERY_HEIGHT,
    thickness: T,
    exterior: true,
    openings: [{ kind: "window", start: -4, end: 4, bottom: 0.8, top: 4.8 }],
  },
  // Free-standing exhibition partitions.
  {
    id: "gallery-partition-west",
    area: "gallery",
    axis: "z",
    at: -6,
    from: -18.5,
    to: -7.5,
    height: 3.4,
    thickness: 0.3,
    openings: [],
  },
  {
    id: "gallery-partition-east",
    area: "gallery",
    axis: "z",
    at: 6,
    from: -18.5,
    to: -7.5,
    height: 3.4,
    thickness: 0.3,
    openings: [],
  },

  // ── Timeline Hall ──────────────────────────────────────────────────────
  {
    id: "timeline-north",
    area: "timeline",
    axis: "x",
    at: 3,
    from: 9 + H,
    to: 41 + H,
    height: TIMELINE_HEIGHT,
    thickness: T,
    exterior: true,
    openings: [],
  },
  {
    id: "timeline-south",
    area: "timeline",
    axis: "x",
    at: 11,
    from: 9 + H,
    to: 41 + H,
    height: TIMELINE_HEIGHT,
    thickness: T,
    exterior: true,
    openings: [
      { kind: "window", start: 14, end: 17, bottom: 1.0, top: 3.9 },
      { kind: "window", start: 22, end: 25, bottom: 1.0, top: 3.9 },
      { kind: "window", start: 30, end: 33, bottom: 1.0, top: 3.9 },
    ],
  },
  {
    id: "timeline-east",
    area: "timeline",
    axis: "z",
    at: 41,
    from: 3 + H,
    to: 11 - H,
    height: TIMELINE_HEIGHT,
    thickness: T,
    exterior: true,
    openings: [{ kind: "window", start: 5, end: 9, bottom: 0.6, top: 4.2 }],
  },
];

export const CEILINGS: CeilingDef[] = [
  {
    area: "lobby",
    rect: { minX: -9 - H, maxX: 9 + H, minZ: -H, maxZ: 14 + H },
    height: LOBBY_HEIGHT,
    thickness: 0.35,
    skylights: [{ minX: -4, maxX: 4, minZ: 4.5, maxZ: 9.5 }],
  },
  {
    area: "gallery",
    rect: { minX: -12 - H, maxX: 12 + H, minZ: -24 - H, maxZ: -H },
    height: GALLERY_HEIGHT,
    thickness: 0.35,
    skylights: [{ minX: -2.5, maxX: 2.5, minZ: -21, maxZ: -3 }],
  },
  {
    area: "timeline",
    rect: { minX: 9 + H, maxX: 41 + H, minZ: 3 - H, maxZ: 11 + H },
    height: TIMELINE_HEIGHT,
    thickness: 0.35,
    skylights: [12.5, 18.5, 24.5, 30.5, 36.5].map((x) => ({
      minX: x,
      maxX: x + 3,
      minZ: 5.5,
      maxZ: 8.5,
    })),
  },
];

export const FLOORS: FloorDef[] = [
  { area: "lobby", rect: { minX: -9 - H, maxX: 9 + H, minZ: 0, maxZ: 14 + H }, material: "wood" },
  { area: "gallery", rect: { minX: -12 - H, maxX: 12 + H, minZ: -24 - H, maxZ: 0 }, material: "wood" },
  { area: "timeline", rect: { minX: 9 + H, maxX: 41 + H, minZ: 3 - H, maxZ: 11 + H }, material: "wood" },
];

/** Signs above doorways: text is rendered into a canvas atlas at runtime. */
export interface SignDef {
  id: string;
  title: string;
  subtitle?: string;
  x: number;
  y: number;
  z: number;
  facing: "+x" | "-x" | "+z" | "-z";
  width: number;
  height: number;
  style: "hero" | "plaque";
}

export const SIGNS: SignDef[] = [
  { id: "hero", title: "MEMORA", subtitle: "A Shared World of Memories", x: 0, y: 6.0, z: H + 0.03, facing: "+z", width: 6.4, height: 1.6, style: "hero" },
  { id: "to-gallery", title: "Main Memory Gallery", x: 0, y: 4.75, z: H + 0.03, facing: "+z", width: 3.2, height: 0.5, style: "plaque" },
  { id: "to-timeline", title: "Timeline Hall", x: 9 - H - 0.03, y: 4.2, z: 7, facing: "-x", width: 2.8, height: 0.5, style: "plaque" },
  { id: "to-garden", title: "Memory Garden", x: -9 + H + 0.03, y: 4.0, z: 7, facing: "+x", width: 2.8, height: 0.5, style: "plaque" },
  { id: "gallery-to-garden", title: "Memory Garden", x: -12 + H + 0.03, y: 3.8, z: -12, facing: "+x", width: 2.8, height: 0.5, style: "plaque" },
  { id: "gallery-to-lobby", title: "Grand Lobby", x: 0, y: 4.75, z: -H - 0.03, facing: "-z", width: 2.8, height: 0.5, style: "plaque" },
  { id: "timeline-title", title: "Timeline Hall", subtitle: "Walk through the years", x: 40.77, y: 4.6, z: 7, facing: "-x", width: 3.4, height: 0.7, style: "hero" },
  { id: "garden-to-lobby", title: "Grand Lobby", x: -9 - H - 0.03, y: 4.0, z: 7, facing: "-x", width: 2.6, height: 0.5, style: "plaque" },
  { id: "garden-to-gallery", title: "Main Memory Gallery", x: -12 - H - 0.03, y: 3.8, z: -12, facing: "-x", width: 3.0, height: 0.5, style: "plaque" },
];
