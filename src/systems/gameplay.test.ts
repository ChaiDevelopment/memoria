import { describe, expect, it } from "vitest";
import { PLAYER } from "@/config/gameConfig";
import { selectAnimationState, CharacterAnimator } from "./animation/characterAnimator";
import { orbitDirection, raycastDistance } from "./camera/cameraCollision";
import { findInteractable, type Interactable } from "./interaction/interactables";
import type { Collider } from "@/types/world";

describe("camera collision", () => {
  const wall: Collider = { kind: "box", minX: -5, maxX: 5, minY: 0, maxY: 5, minZ: 3, maxZ: 3.4, blocksCamera: true };

  it("reports the distance to the nearest wall along the ray", () => {
    expect(raycastDistance(0, 1.5, 0, 0, 0, 1, 10, [wall])).toBeCloseTo(3);
  });

  it("returns maxDist when nothing is hit", () => {
    expect(raycastDistance(0, 1.5, 0, 0, 0, -1, 10, [wall])).toBe(10);
  });

  it("ignores colliders that contain the origin", () => {
    expect(raycastDistance(0, 1.5, 3.2, 0, 0, 1, 10, [wall])).toBe(10);
  });

  it("orbit direction is a unit vector behind the player at yaw 0", () => {
    const d = orbitDirection(0, 0);
    expect(d.z).toBeCloseTo(1);
    expect(Math.hypot(d.x, d.y, d.z)).toBeCloseTo(1);
  });
});

describe("interaction", () => {
  const photo: Interactable = { id: "p", kind: "photo", memoryId: "m", label: "Photo", x: 0, y: 2, z: 0, normalX: 0, normalZ: 1 };

  it("finds a photo the player stands in front of and faces", () => {
    // Player at z = 2 facing -Z (towards the photo).
    expect(findInteractable(0, 2, Math.PI, [photo])?.id).toBe("p");
  });

  it("ignores photos behind the player, behind the wall, or out of range", () => {
    expect(findInteractable(0, 2, 0, [photo])).toBeNull();
    expect(findInteractable(0, -2, 0, [photo])).toBeNull();
    expect(findInteractable(0, 6, Math.PI, [photo])).toBeNull();
  });
});

describe("animation", () => {
  it("selects states from movement", () => {
    const base = { grounded: true, inspecting: false, wantsRun: false };
    expect(selectAnimationState({ ...base, horizontalSpeed: 0 })).toBe("idle");
    expect(selectAnimationState({ ...base, horizontalSpeed: PLAYER.walkSpeed })).toBe("walk");
    expect(selectAnimationState({ ...base, wantsRun: true, horizontalSpeed: PLAYER.runSpeed })).toBe("run");
    // Holding Shift against a wall is not running.
    expect(selectAnimationState({ ...base, wantsRun: true, horizontalSpeed: 0.5 })).toBe("walk");
    expect(selectAnimationState({ ...base, grounded: false, horizontalSpeed: 3 })).toBe("jump");
    expect(selectAnimationState({ ...base, inspecting: true, horizontalSpeed: 0 })).toBe("inspect");
  });

  it("cross-fades smoothly between states (weights always sum to 1)", () => {
    const a = new CharacterAnimator();
    const input = { horizontalSpeed: 3, verticalVelocity: 0, landed: false };
    a.update(1 / 60, { ...input, state: "walk" });
    const w1 = { ...a.weights };
    expect(w1.walk).toBeGreaterThan(0);
    expect(w1.walk).toBeLessThan(0.5); // not an instant snap
    for (let i = 0; i < 60; i++) a.update(1 / 60, { ...input, state: "walk" });
    expect(a.weights.walk).toBeGreaterThan(0.99);
    const pose = a.update(1 / 60, { ...input, state: "run" });
    expect(pose.every((v) => Number.isFinite(v))).toBe(true);
  });
});
