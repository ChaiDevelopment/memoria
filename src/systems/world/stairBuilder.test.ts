import { describe, expect, it } from "vitest";
import { PLAYER } from "@/config/gameConfig";
import { createMotorState, stepMotor } from "@/systems/movement/characterMotor";
import type { Collider } from "@/types/world";
import { buildStairFlight, validateStair, type StairFlightDef } from "./stairBuilder";

const flight: StairFlightDef = {
  id: "test",
  area: "lobby",
  x: 0,
  z: 0,
  baseY: 0,
  direction: "-z",
  width: 2.4,
  steps: 19,
  rise: 0.2,
  run: 0.32,
  railings: { left: true, right: true },
};

function collidersFor(def: StairFlightDef, extra: Collider[] = []): Collider[] {
  const s = buildStairFlight(def);
  const boxes: Collider[] = [...s.treads, ...s.railings].map((b) => ({ kind: "box" as const, blocksCamera: false, ...b }));
  return [...boxes, ...extra];
}

describe("stair flights", () => {
  it("rejects risers higher than the player's step height", () => {
    expect(validateStair({ ...flight, rise: PLAYER.stepHeight + 0.01 }).length).toBeGreaterThan(0);
    expect(validateStair(flight)).toEqual([]);
  });

  it("builds one tread per step, rising by exactly one riser each, in the climbing direction", () => {
    const s = buildStairFlight(flight);
    expect(s.treads).toHaveLength(19);
    expect(s.topY).toBeCloseTo(3.8);
    expect(s.top.z).toBeCloseTo(-19 * 0.32);
    expect(s.treads[0]!.maxZ).toBeCloseTo(0);
    expect(s.treads[1]!.maxY - s.treads[0]!.maxY).toBeCloseTo(0.2);
    expect(s.treads.every((t, i) => i === 0 || t.maxZ <= s.treads[i - 1]!.minZ + 1e-9)).toBe(true);
    expect(s.railings).toHaveLength(38);
  });

  it("lets the motor walk up the whole flight and back down without leaving it", () => {
    const colliders = collidersFor(flight, [
      // Landing at the top so the player has somewhere to stand.
      { kind: "box", blocksCamera: true, minX: -1.2, maxX: 1.2, minZ: -9, maxZ: -19 * 0.32, minY: 0, maxY: 3.8 },
    ]);
    const state = createMotorState(0, 0, 1, Math.PI);
    let t = 0;
    while (state.position.z > -6.5 && t < 15) {
      stepMotor(state, { moveX: 0, moveZ: -1, run: false, jump: false }, 1 / 60, colliders);
      t += 1 / 60;
    }
    expect(t).toBeLessThan(15);
    expect(state.position.y).toBeCloseTo(3.8, 1);
    expect(Math.abs(state.position.x)).toBeLessThan(1.2);

    t = 0;
    while (state.position.z < 1 && t < 15) {
      stepMotor(state, { moveX: 0, moveZ: 1, run: true, jump: false }, 1 / 60, colliders);
      t += 1 / 60;
    }
    expect(state.position.y).toBe(0);
    expect(state.grounded).toBe(true);
  });

  it("railings stop the player stepping off the side", () => {
    const colliders = collidersFor(flight);
    const state = createMotorState(0, 0, 1, Math.PI);
    // Climb halfway, then push sideways.
    for (let i = 0; i < 90; i++) stepMotor(state, { moveX: 0, moveZ: -1, run: false, jump: false }, 1 / 60, colliders);
    const y = state.position.y;
    expect(y).toBeGreaterThan(1);
    for (let i = 0; i < 120; i++) stepMotor(state, { moveX: 1, moveZ: 0, run: true, jump: false }, 1 / 60, colliders);
    expect(state.position.x).toBeLessThanOrEqual(1.2 - PLAYER.radius + 1e-6);
    expect(state.position.y).toBeGreaterThan(y - 0.01);
  });

  it("supports every travel direction", () => {
    for (const direction of ["+x", "-x", "+z", "-z"] as const) {
      const s = buildStairFlight({ ...flight, direction, steps: 3 });
      const first = s.treads[0]!;
      const last = s.treads[2]!;
      expect(last.maxY).toBeGreaterThan(first.maxY);
      const axis = direction[1] === "x" ? "X" : "Z";
      const sign = direction[0] === "+" ? 1 : -1;
      const firstMid = (first[`min${axis}`] + first[`max${axis}`]) / 2;
      const lastMid = (last[`min${axis}`] + last[`max${axis}`]) / 2;
      expect(Math.sign(lastMid - firstMid)).toBe(sign);
    }
  });
});
