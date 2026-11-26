import type { Box3Data, CeilingDef, RectXZ, WallDef } from "@/types/world";

/**
 * Converts declarative wall/ceiling definitions into axis-aligned boxes for
 * rendering (solids, glass, trim) and collision. Pure functions — unit tested.
 */

export interface WallPieces {
  solids: Box3Data[];
  glass: Box3Data[];
  trim: Box3Data[];
  colliders: Box3Data[];
}

export interface CeilingPieces {
  slabs: Box3Data[];
  glass: Box3Data[];
  trim: Box3Data[];
  collider: Box3Data;
}

const BASEBOARD_HEIGHT = 0.16;
const CROWN_HEIGHT = 0.16;
const FRAME_WIDTH = 0.12;
const GLASS_THICKNESS = 0.04;
/** How far door/window frames reach into their opening (see buildWall). */
const REVEAL = 0.02;

/** Box spanning [a0, a1] along the wall's run axis and [y0, y1] vertically. */
function wallBox(w: WallDef, a0: number, a1: number, y0: number, y1: number, thickness = w.thickness): Box3Data {
  const half = thickness / 2;
  return w.axis === "x"
    ? { minX: a0, maxX: a1, minY: y0, maxY: y1, minZ: w.at - half, maxZ: w.at + half }
    : { minX: w.at - half, maxX: w.at + half, minY: y0, maxY: y1, minZ: a0, maxZ: a1 };
}

export function validateWall(w: WallDef): string[] {
  const errors: string[] = [];
  if (w.to <= w.from) errors.push(`${w.id}: 'to' must be greater than 'from'`);
  const sorted = [...w.openings].sort((a, b) => a.start - b.start);
  let cursor = w.from;
  for (const o of sorted) {
    if (o.start < cursor) errors.push(`${w.id}: opening at ${o.start} overlaps previous opening or wall start`);
    if (o.end > w.to) errors.push(`${w.id}: opening at ${o.start} extends past wall end`);
    if (o.end <= o.start) errors.push(`${w.id}: opening at ${o.start} has non-positive width`);
    if (o.top > w.height || o.bottom < 0 || o.top <= o.bottom)
      errors.push(`${w.id}: opening at ${o.start} has invalid vertical extent`);
    if (o.kind === "door" && o.bottom !== 0) errors.push(`${w.id}: door at ${o.start} must start at floor level`);
    cursor = o.end;
  }
  return errors;
}

export function buildWall(w: WallDef): WallPieces {
  const errors = validateWall(w);
  if (errors.length > 0) throw new Error(`Invalid wall definition:\n${errors.join("\n")}`);

  const pieces: WallPieces = { solids: [], glass: [], trim: [], colliders: [] };
  const h = w.height;
  const openings = [...w.openings].sort((a, b) => a.start - b.start);

  const addSolid = (a0: number, a1: number, y0: number, y1: number) => {
    if (a1 - a0 < 1e-4 || y1 - y0 < 1e-4) return;
    pieces.solids.push(wallBox(w, a0, a1, y0, y1));
    if (y0 === 0) pieces.trim.push(wallBox(w, a0, a1, 0, Math.min(BASEBOARD_HEIGHT, y1), w.thickness + 0.05));
    if (y1 === h) pieces.trim.push(wallBox(w, a0, a1, h - CROWN_HEIGHT, h, w.thickness + 0.06));
  };

  let cursor = w.from;
  for (const o of openings) {
    if (o.start > cursor) {
      addSolid(cursor, o.start, 0, h);
      pieces.colliders.push(wallBox(w, cursor, o.start, 0, h));
    }
    addSolid(o.start, o.end, 0, o.bottom);
    addSolid(o.start, o.end, o.top, h);

    if (o.kind === "door") {
      // Walkable: only the lintel above the doorway collides.
      if (o.top < h) pieces.colliders.push(wallBox(w, o.start, o.end, o.top, h));
      const t = w.thickness + 0.08;
      // Frame pieces reach REVEAL into the opening so they cover the wall's
      // end faces instead of sharing their plane (which z-fights as jagged
      // cream/walnut stripes). Visual only: the collider gap is unchanged.
      pieces.trim.push(wallBox(w, o.start - FRAME_WIDTH, o.start + REVEAL, 0, o.top + FRAME_WIDTH, t));
      pieces.trim.push(wallBox(w, o.end - REVEAL, o.end + FRAME_WIDTH, 0, o.top + FRAME_WIDTH, t));
      pieces.trim.push(wallBox(w, o.start - FRAME_WIDTH, o.end + FRAME_WIDTH, o.top - REVEAL, o.top + FRAME_WIDTH + 0.04, t));
    } else {
      // Glazed: the full opening still blocks movement.
      pieces.colliders.push(wallBox(w, o.start, o.end, 0, h));
      pieces.glass.push(wallBox(w, o.start, o.end, o.bottom, o.top, GLASS_THICKNESS));
      const fw = 0.07;
      const ft = w.thickness + 0.04;
      if (o.bottom > 0) pieces.trim.push(wallBox(w, o.start - 0.1, o.end + 0.1, o.bottom - 0.07, o.bottom + REVEAL, w.thickness + 0.14));
      pieces.trim.push(wallBox(w, o.start - fw, o.end + fw, o.top - REVEAL, o.top + fw, ft));
      pieces.trim.push(wallBox(w, o.start - fw, o.start + REVEAL, o.bottom, o.top, ft));
      pieces.trim.push(wallBox(w, o.end - REVEAL, o.end + fw, o.bottom, o.top, ft));
      // Mullions: thin bars that cast lovely shadow patterns.
      const width = o.end - o.start;
      const height = o.top - o.bottom;
      const verticals = Math.max(0, Math.round(width / 1.3) - 1);
      for (let i = 1; i <= verticals; i++) {
        const a = o.start + (width * i) / (verticals + 1);
        pieces.trim.push(wallBox(w, a - 0.03, a + 0.03, o.bottom, o.top, 0.1));
      }
      if (height > 2.4) {
        const y = o.bottom + height * 0.72;
        pieces.trim.push(wallBox(w, o.start, o.end, y - 0.03, y + 0.03, 0.1));
      }
    }
    cursor = o.end;
  }
  if (cursor < w.to) {
    addSolid(cursor, w.to, 0, h);
    pieces.colliders.push(wallBox(w, cursor, w.to, 0, h));
  }
  return pieces;
}

/** Splits a rectangle into sub-rectangles that exclude the given (non-overlapping) holes. */
export function rectMinusHoles(rect: RectXZ, holes: RectXZ[]): RectXZ[] {
  const xs = new Set<number>([rect.minX, rect.maxX]);
  for (const hole of holes) {
    xs.add(Math.min(Math.max(hole.minX, rect.minX), rect.maxX));
    xs.add(Math.min(Math.max(hole.maxX, rect.minX), rect.maxX));
  }
  const breaks = [...xs].sort((a, b) => a - b);
  const out: RectXZ[] = [];
  for (let i = 0; i < breaks.length - 1; i++) {
    const x0 = breaks[i]!;
    const x1 = breaks[i + 1]!;
    if (x1 - x0 < 1e-6) continue;
    const covering = holes
      .filter((hole) => hole.minX <= x0 + 1e-6 && hole.maxX >= x1 - 1e-6)
      .sort((a, b) => a.minZ - b.minZ);
    let z = rect.minZ;
    for (const hole of covering) {
      if (hole.minZ > z) out.push({ minX: x0, maxX: x1, minZ: z, maxZ: hole.minZ });
      z = Math.max(z, hole.maxZ);
    }
    if (z < rect.maxZ) out.push({ minX: x0, maxX: x1, minZ: z, maxZ: rect.maxZ });
  }
  return out;
}

export function buildCeiling(c: CeilingDef): CeilingPieces {
  const y0 = c.height;
  const y1 = c.height + c.thickness;
  const slabs = rectMinusHoles(c.rect, c.skylights).map((r) => ({ ...r, minY: y0, maxY: y1 }));
  const glass: Box3Data[] = [];
  const trim: Box3Data[] = [];
  for (const s of c.skylights) {
    glass.push({ ...s, minY: y1 - 0.06, maxY: y1 - 0.02 });
    const b = 0.14;
    // Coffer frame below the opening.
    trim.push({ minX: s.minX - b, maxX: s.maxX + b, minZ: s.minZ - b, maxZ: s.minZ, minY: y0 - 0.14, maxY: y0 + 0.02 });
    trim.push({ minX: s.minX - b, maxX: s.maxX + b, minZ: s.maxZ, maxZ: s.maxZ + b, minY: y0 - 0.14, maxY: y0 + 0.02 });
    trim.push({ minX: s.minX - b, maxX: s.minX, minZ: s.minZ, maxZ: s.maxZ, minY: y0 - 0.14, maxY: y0 + 0.02 });
    trim.push({ minX: s.maxX, maxX: s.maxX + b, minZ: s.minZ, maxZ: s.maxZ, minY: y0 - 0.14, maxY: y0 + 0.02 });
    // Glazing bars across the long axis.
    const alongX = s.maxX - s.minX >= s.maxZ - s.minZ;
    const span = alongX ? s.maxX - s.minX : s.maxZ - s.minZ;
    const bars = Math.max(0, Math.round(span / 1.5) - 1);
    for (let i = 1; i <= bars; i++) {
      const t = i / (bars + 1);
      if (alongX) {
        const x = s.minX + span * t;
        trim.push({ minX: x - 0.04, maxX: x + 0.04, minZ: s.minZ, maxZ: s.maxZ, minY: y1 - 0.12, maxY: y1 - 0.02 });
      } else {
        const z = s.minZ + span * t;
        trim.push({ minX: s.minX, maxX: s.maxX, minZ: z - 0.04, maxZ: z + 0.04, minY: y1 - 0.12, maxY: y1 - 0.02 });
      }
    }
  }
  return { slabs, glass, trim, collider: { ...c.rect, minY: y0, maxY: y1 } };
}
