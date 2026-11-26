import { PLAYER } from "@/config/gameConfig";
import { damp, lerpAngle } from "@/lib/math";
import type { Collider } from "@/types/world";
import { ceilingHeight, groundHeight, resolveHorizontal, type CharacterShape, type Position } from "./collision";

/**
 * Kinematic character motor: velocity integration, gravity, jumping (with
 * coyote time and input buffering), ground/ceiling detection and wall sliding.
 * Independent of rendering and of the character model.
 */

export interface MotorState {
  position: Position;
  velocity: Position;
  grounded: boolean;
  /** Yaw the character faces (radians, 0 = +Z). */
  facing: number;
  /** Measured horizontal speed after collisions (m/s) — drives animation. */
  horizontalSpeed: number;
  coyoteTimer: number;
  jumpBufferTimer: number;
}

export interface MotorInput {
  /** Desired world-space move direction; magnitude 0..1 (analog). */
  moveX: number;
  moveZ: number;
  run: boolean;
  /** True on the frame a jump was requested. */
  jump: boolean;
  /** Optional yaw to turn towards when not moving (e.g. while inspecting). */
  faceTowards?: number | null;
}

export interface MotorEvents {
  jumped: boolean;
  landed: boolean;
}

export type MotorConfig = typeof PLAYER;

export function createMotorState(x: number, y: number, z: number, facing: number): MotorState {
  return {
    position: { x, y, z },
    velocity: { x: 0, y: 0, z: 0 },
    grounded: true,
    facing,
    horizontalSpeed: 0,
    coyoteTimer: 0,
    jumpBufferTimer: 0,
  };
}

const scratch: Position = { x: 0, y: 0, z: 0 };

export function stepMotor(
  state: MotorState,
  input: MotorInput,
  dt: number,
  colliders: readonly Collider[],
  cfg: MotorConfig = PLAYER,
): MotorEvents {
  const events: MotorEvents = { jumped: false, landed: false };
  const shape: CharacterShape = cfg;
  const pos = state.position;
  const vel = state.velocity;

  // ── Desired horizontal velocity ────────────────────────────────────────
  let mx = input.moveX;
  let mz = input.moveZ;
  const mag = Math.hypot(mx, mz);
  if (mag > 1) {
    mx /= mag;
    mz /= mag;
  }
  const speed = input.run ? cfg.runSpeed : cfg.walkSpeed;
  const targetX = mx * speed;
  const targetZ = mz * speed;
  const accel = damp(state.grounded ? cfg.groundAcceleration : cfg.airAcceleration, dt);
  vel.x += (targetX - vel.x) * accel;
  vel.z += (targetZ - vel.z) * accel;

  // ── Facing ─────────────────────────────────────────────────────────────
  if (mag > 0.08) {
    state.facing = lerpAngle(state.facing, Math.atan2(mx, mz), damp(cfg.turnRate, dt));
  } else if (input.faceTowards != null) {
    state.facing = lerpAngle(state.facing, input.faceTowards, damp(cfg.turnRate * 0.6, dt));
  }

  // ── Jumping (buffered input + coyote time) ─────────────────────────────
  state.jumpBufferTimer = input.jump ? cfg.jumpBufferTime : Math.max(0, state.jumpBufferTimer - dt);
  state.coyoteTimer = state.grounded ? cfg.coyoteTime : Math.max(0, state.coyoteTimer - dt);
  if (state.jumpBufferTimer > 0 && state.coyoteTimer > 0) {
    vel.y = cfg.jumpVelocity;
    state.grounded = false;
    state.coyoteTimer = 0;
    state.jumpBufferTimer = 0;
    events.jumped = true;
  }

  // ── Gravity ────────────────────────────────────────────────────────────
  vel.y = Math.max(vel.y - cfg.gravity * dt, -cfg.maxFallSpeed);

  // ── Integrate with sub-steps to prevent tunnelling ─────────────────────
  const startX = pos.x;
  const startZ = pos.z;
  const travel = Math.max(Math.hypot(vel.x, vel.z), Math.abs(vel.y)) * dt;
  const steps = Math.min(8, Math.max(1, Math.ceil(travel / (cfg.radius * 0.5))));
  const h = dt / steps;
  const wasGrounded = state.grounded;

  for (let s = 0; s < steps; s++) {
    pos.x += vel.x * h;
    pos.z += vel.z * h;
    resolveHorizontal(pos, shape, colliders);

    const prevY = pos.y;
    pos.y += vel.y * h;

    // Ceiling.
    if (vel.y > 0) {
      scratch.x = pos.x;
      scratch.y = prevY;
      scratch.z = pos.z;
      const ceiling = ceilingHeight(scratch, shape, colliders);
      if (pos.y + cfg.height > ceiling) {
        pos.y = ceiling - cfg.height;
        vel.y = 0;
      }
    }

    // Ground: step up onto low ledges, snap down small drops when walking.
    const ground = groundHeight(pos, shape, colliders, cfg.stepHeight);
    if (vel.y <= 0 && pos.y <= ground + 1e-4) {
      if (!state.grounded && !wasGrounded) events.landed = true;
      pos.y = ground;
      vel.y = 0;
      state.grounded = true;
    } else if (state.grounded && vel.y <= 0 && pos.y - ground <= cfg.stepHeight) {
      pos.y = ground;
      vel.y = 0;
    } else {
      state.grounded = false;
    }
  }

  // Safety net: never fall through the world floor.
  if (pos.y < 0) {
    pos.y = 0;
    vel.y = 0;
    state.grounded = true;
  }

  state.horizontalSpeed = dt > 0 ? Math.hypot(pos.x - startX, pos.z - startZ) / dt : 0;
  return events;
}
