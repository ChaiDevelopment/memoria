import { PLAYER } from "@/config/gameConfig";
import type { AreaId, Box3Data } from "@/types/world";

/**
 * Stair flights as data. Each tread is a solid box whose top is one riser
 * higher than the previous, so the existing kinematic controller climbs it
 * with its normal step-up (riser ≤ PLAYER.stepHeight) and descends with its
 * snap-down — no slopes or physics needed. Pure functions — unit tested.
 */

export type StairDirection = "+x" | "-x" | "+z" | "-z";

export interface StairFlightDef {
  id: string;
  area: AreaId;
  /** Centre of the flight's bottom edge (where the first tread starts). */
  x: number;
  z: number;
  /** Floor height the flight starts from. */
  baseY: number;
  /** Direction of travel when climbing. */
  direction: StairDirection;
  width: number;
  steps: number;
  rise: number;
  run: number;
  /** Railings on the climber's left / right side. */
  railings: { left: boolean; right: boolean };
}

export interface StairPieces {
  /** Solid treads: rendered and used as (non-camera) colliders. */
  treads: Box3Data[];
  /** Railings: rendered and used as colliders (≥ 1 m above each tread). */
  railings: Box3Data[];
  topY: number;
  /** Centre of the flight's top edge. */
  top: { x: number; z: number };
}

export const RAILING_HEIGHT = 1.0;
const RAILING_THICKNESS = 0.08;

export function validateStair(def: StairFlightDef): string[] {
  const errors: string[] = [];
  if (def.rise > PLAYER.stepHeight) errors.push(`${def.id}: riser ${def.rise} m is higher than the step height ${PLAYER.stepHeight} m`);
  if (def.rise <= 0 || def.run <= 0 || def.steps < 1 || def.width <= 0) errors.push(`${def.id}: rise, run, steps and width must be positive`);
  if (def.width < PLAYER.radius * 2 + 0.2) errors.push(`${def.id}: too narrow for the player`);
  return errors;
}

/** Axis-aligned box from along/lateral ranges in the flight's local frame. */
function localBox(def: StairFlightDef, a0: number, a1: number, l0: number, l1: number, y0: number, y1: number): Box3Data {
  const sign = def.direction[0] === "+" ? 1 : -1;
  const along = [def.direction[1] === "x" ? def.x : def.z, sign] as const;
  const latCentre = def.direction[1] === "x" ? def.z : def.x;
  const p0 = along[0] + sign * a0;
  const p1 = along[0] + sign * a1;
  const [minA, maxA] = p0 < p1 ? [p0, p1] : [p1, p0];
  const minL = latCentre + l0;
  const maxL = latCentre + l1;
  return def.direction[1] === "x"
    ? { minX: minA, maxX: maxA, minZ: minL, maxZ: maxL, minY: y0, maxY: y1 }
    : { minX: minL, maxX: maxL, minZ: minA, maxZ: maxA, minY: y0, maxY: y1 };
}

export function buildStairFlight(def: StairFlightDef): StairPieces {
  const errors = validateStair(def);
  if (errors.length) throw new Error(`Invalid stair flight:\n${errors.join("\n")}`);
  const half = def.width / 2;
  const treads: Box3Data[] = [];
  const railings: Box3Data[] = [];
  // Which lateral side is the climber's left: facing +z, left is +x; facing +x, left is -z.
  const leftSign = def.direction === "+z" || def.direction === "-x" ? 1 : -1;
  const sides: number[] = [];
  if (def.railings.left) sides.push(leftSign);
  if (def.railings.right) sides.push(-leftSign);

  for (let i = 0; i < def.steps; i++) {
    const top = def.baseY + (i + 1) * def.rise;
    treads.push(localBox(def, i * def.run, (i + 1) * def.run, -half, half, def.baseY, top));
    for (const s of sides) {
      const [l0, l1] = s > 0 ? [half, half + RAILING_THICKNESS] : [-half - RAILING_THICKNESS, -half];
      railings.push(localBox(def, i * def.run, (i + 1) * def.run, l0, l1, def.baseY, top + RAILING_HEIGHT));
    }
  }

  const length = def.steps * def.run;
  const sign = def.direction[0] === "+" ? 1 : -1;
  const top = def.direction[1] === "x" ? { x: def.x + sign * length, z: def.z } : { x: def.x, z: def.z + sign * length };
  return { treads, railings, topY: def.baseY + def.steps * def.rise, top };
}
