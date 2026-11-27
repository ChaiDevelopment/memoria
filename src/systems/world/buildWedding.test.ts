import { describe, expect, it } from "vitest";
import { findInteractable } from "@/systems/interaction/interactables";
import { buildWeddingWorld, framesFor, MAX_WEDDING_FRAMES, SPAWN_WEDDING, weddingFrameSlots } from "./buildWedding";
import { areaAt, areaInfo } from "./areas";

const inside = (x: number, y: number, z: number, c: { kind: string } & Record<string, number | string | boolean>) =>
  c.kind === "box"
    ? x > (c.minX as number) && x < (c.maxX as number) && y >= (c.minY as number) && y < (c.maxY as number) && z > (c.minZ as number) && z < (c.maxZ as number)
    : Math.hypot(x - (c.x as number), z - (c.z as number)) < (c.radius as number) && y >= (c.minY as number) && y < (c.maxY as number);

describe("wedding venue", () => {
  for (const setting of ["outdoor", "indoor"] as const) {
    it(`${setting}: the spawn and the whole aisle are free to walk`, () => {
      const w = buildWeddingWorld(setting, MAX_WEDDING_FRAMES);
      for (let z = SPAWN_WEDDING.z; z > -14; z -= 0.5) {
        for (const x of [-0.9, 0, 0.9]) {
          const hit = w.colliders.find((c) => inside(x, 0.5, z, c as never));
          expect(hit, `blocked at (${x}, ${z})`).toBeUndefined();
        }
      }
    });
  }

  it("only stands frames for the photos there are (two hero frames minimum)", () => {
    expect(framesFor(0, "outdoor")).toHaveLength(2);
    expect(framesFor(10, "outdoor")).toHaveLength(10);
    expect(framesFor(999, "outdoor")).toHaveLength(MAX_WEDDING_FRAMES);
    expect(buildWeddingWorld("outdoor", 5).interactables.filter((i) => i.kind === "photo")).toHaveLength(5);
    expect(weddingFrameSlots("indoor", 7).map((s) => s.slotId)).toEqual(framesFor(7, "indoor").map((p) => p.memoryId));
    // The ballroom hangs fewer, larger wall frames (its walls are mostly windows).
    expect(new Set(framesFor(999, "indoor").map((p) => p.memoryId)).size).toBe(30);
  });

  it("puts the info board, envelope and wishes wall within reach", () => {
    const w = buildWeddingWorld("outdoor", 0);
    expect(findInteractable(-3.8, 21.5, -Math.PI / 2, w.interactables)?.kind).toBe("info");
    expect(findInteractable(3.8, 21.5, Math.PI / 2, w.interactables)?.kind).toBe("envelope");
    expect(findInteractable(-11.7, -11.5, Math.PI, w.interactables)?.kind).toBe("guestbook");
  });

  it("keeps the info board, envelope and wishes wall reachable in both venues", () => {
    for (const setting of ["outdoor", "indoor"] as const) {
      const w = buildWeddingWorld(setting, MAX_WEDDING_FRAMES);
      expect(findInteractable(-3.8, 21.5, -Math.PI / 2, w.interactables)?.kind, setting).toBe("info");
      expect(findInteractable(3.8, 21.5, Math.PI / 2, w.interactables)?.kind, setting).toBe("envelope");
      expect(findInteractable(-11.7, -11.5, Math.PI, w.interactables)?.kind, setting).toBe("guestbook");
      // Where a guest stands to use them is free of colliders.
      for (const [x, z] of [[-3.8, 21.5], [3.8, 21.5], [-11.7, -11.5]] as const) {
        expect(w.colliders.find((c) => inside(x, 0.5, z, c as never)), `${setting} (${x}, ${z})`).toBeUndefined();
      }
    }
  });

  it("builds two different venues with structural colliders that also stop the camera", () => {
    const garden = buildWeddingWorld("outdoor", 0);
    const ballroom = buildWeddingWorld("indoor", 0);
    const cams = (w: typeof garden) => w.cameraColliders.filter((c) => c.kind === "cylinder").length;
    // Garden: 4 pergola posts + 4 trees + the fountain's column. Ballroom: its pilasters are part of the walls.
    expect(cams(garden)).toBe(9);
    expect(cams(ballroom)).toBe(0);
    // Ballroom stage: two steps of 0.25 m, within the 0.32 m climbing limit.
    const steps = ballroom.colliders.filter((c) => c.kind === "box" && c.minY === 0 && (c.maxY === 0.25 || c.maxY === 0.5));
    expect(steps).toHaveLength(2);
    // The ballroom seats guests at round tables, the garden in rows.
    expect(ballroom.colliders.filter((c) => c.kind === "cylinder" && Math.abs(c.radius - 1.6) < 1e-9)).toHaveLength(10);
    expect(garden.colliders.filter((c) => c.kind === "box" && c.maxY === 0.95)).toHaveLength(16);
  });

  it("lets a guest walk from the aisle onto the stage in front of the thrones", () => {
    for (const setting of ["outdoor", "indoor"] as const) {
      const w = buildWeddingWorld(setting, 0);
      for (let z = -13; z > -16.6; z -= 0.4) {
        const solid = w.colliders.find((c) => inside(0, 1.0, z, c as never));
        expect(solid, `${setting} blocked at z=${z}`).toBeUndefined();
      }
    }
  });

  it("names its areas", () => {
    const w = buildWeddingWorld("indoor", 0);
    expect(areaAt(0, -16, w.areas)?.id).toBe("w-stage");
    expect(areaInfo("w-stage")?.name).toBe("Pelaminan");
    expect(areaInfo(areaAt(0, 22, w.areas)!.id)?.name).toBe("Gerbang Bahagia");
  });
});
