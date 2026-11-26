import { describe, expect, it } from "vitest";
import { WALLS } from "@/config/museumLayout";
import type { WallDef } from "@/types/world";
import { buildCeiling, buildWall, rectMinusHoles, validateWall } from "./wallBuilder";

const baseWall: WallDef = {
  id: "test",
  area: "lobby",
  axis: "x",
  at: 0,
  from: 0,
  to: 10,
  height: 5,
  thickness: 0.4,
  openings: [],
};

describe("validateWall", () => {
  it("accepts every wall in the museum layout", () => {
    for (const w of WALLS) expect(validateWall(w), w.id).toEqual([]);
  });

  it("rejects overlapping openings", () => {
    const errors = validateWall({
      ...baseWall,
      openings: [
        { kind: "door", start: 2, end: 5, bottom: 0, top: 3 },
        { kind: "window", start: 4, end: 6, bottom: 1, top: 3 },
      ],
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it("rejects doors that do not reach the floor", () => {
    expect(validateWall({ ...baseWall, openings: [{ kind: "door", start: 2, end: 4, bottom: 0.5, top: 3 }] }).length).toBe(1);
  });
});

describe("buildWall", () => {
  it("produces one full-height collider for a solid wall", () => {
    const pieces = buildWall(baseWall);
    expect(pieces.colliders).toHaveLength(1);
    expect(pieces.colliders[0]).toMatchObject({ minX: 0, maxX: 10, minY: 0, maxY: 5, minZ: -0.2, maxZ: 0.2 });
  });

  it("leaves a walkable gap for doors (only the lintel collides)", () => {
    const pieces = buildWall({ ...baseWall, openings: [{ kind: "door", start: 4, end: 6, bottom: 0, top: 3 }] });
    const inDoor = pieces.colliders.filter((c) => c.minX < 5 && c.maxX > 5);
    expect(inDoor).toHaveLength(1);
    expect(inDoor[0]!.minY).toBe(3);
  });

  it("keeps windows solid for collision but renders glass", () => {
    const pieces = buildWall({ ...baseWall, openings: [{ kind: "window", start: 4, end: 6, bottom: 1, top: 3 }] });
    const inWindow = pieces.colliders.filter((c) => c.minX < 5 && c.maxX > 5);
    expect(inWindow).toHaveLength(1);
    expect(inWindow[0]).toMatchObject({ minY: 0, maxY: 5 });
    expect(pieces.glass).toHaveLength(1);
    // Solid render pieces below and above the window.
    expect(pieces.solids.filter((s) => s.minX === 4 && s.maxX === 6)).toHaveLength(2);
  });

  it("supports walls running along Z", () => {
    const pieces = buildWall({ ...baseWall, axis: "z", at: 3 });
    expect(pieces.colliders[0]).toMatchObject({ minX: 2.8, maxX: 3.2, minZ: 0, maxZ: 10 });
  });
});

describe("rectMinusHoles", () => {
  const area = (r: { minX: number; maxX: number; minZ: number; maxZ: number }) => (r.maxX - r.minX) * (r.maxZ - r.minZ);

  it("subtracts holes exactly", () => {
    const rect = { minX: 0, maxX: 10, minZ: 0, maxZ: 6 };
    const holes = [
      { minX: 1, maxX: 3, minZ: 2, maxZ: 4 },
      { minX: 6, maxX: 9, minZ: 1, maxZ: 5 },
    ];
    const parts = rectMinusHoles(rect, holes);
    const total = parts.reduce((acc, p) => acc + area(p), 0);
    expect(total).toBeCloseTo(area(rect) - holes.reduce((acc, h) => acc + area(h), 0));
    // No part may overlap a hole.
    for (const p of parts)
      for (const h of holes) {
        const overlapX = Math.min(p.maxX, h.maxX) - Math.max(p.minX, h.minX);
        const overlapZ = Math.min(p.maxZ, h.maxZ) - Math.max(p.minZ, h.minZ);
        expect(overlapX > 1e-9 && overlapZ > 1e-9).toBe(false);
      }
  });

  it("returns the rect unchanged without holes", () => {
    expect(rectMinusHoles({ minX: 0, maxX: 2, minZ: 0, maxZ: 2 }, [])).toEqual([{ minX: 0, maxX: 2, minZ: 0, maxZ: 2 }]);
  });
});

describe("buildCeiling", () => {
  it("collides over the full rectangle, including skylights", () => {
    const c = buildCeiling({ area: "lobby", rect: { minX: 0, maxX: 10, minZ: 0, maxZ: 10 }, height: 5, thickness: 0.3, skylights: [{ minX: 3, maxX: 7, minZ: 3, maxZ: 7 }] });
    expect(c.collider).toMatchObject({ minX: 0, maxX: 10, minY: 5, maxY: 5.3 });
    expect(c.glass).toHaveLength(1);
    expect(c.slabs.length).toBeGreaterThan(1);
  });
});

describe("frame trim", () => {
  it("covers the wall's end faces at openings instead of sharing their plane (no z-fighting)", () => {
    const wall = { ...baseWall, openings: [{ kind: "door" as const, start: 4, end: 6, bottom: 0, top: 3 }] };
    const pieces = buildWall(wall);
    // The solid piece left of the door ends at x = 4; some trim must extend past it into the opening.
    const solidEnd = Math.max(...pieces.solids.filter((s) => s.maxX <= 4 + 1e-9).map((s) => s.maxX));
    expect(solidEnd).toBe(4);
    expect(pieces.trim.some((t) => t.minX < 4 && t.maxX > 4 && t.minY === 0)).toBe(true);
    // Collision gap is unchanged.
    expect(pieces.colliders.filter((c) => c.minX < 5 && c.maxX > 5 && c.minY < 1)).toHaveLength(0);
  });
});
