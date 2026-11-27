import { PLAYER } from "@/config/gameConfig";
import { clamp, damp } from "@/lib/math";
import type { AnimationStateName } from "@/types/game";

/**
 * Procedural animation for the humanoid rig. Each clip is a function that
 * writes joint rotations into a pose buffer; clips are cross-faded with
 * per-state weights so transitions are always smooth.
 *
 * The animator is model-agnostic: it outputs rotations for named joints.
 * A future GLB character can either map these joints to its bones, or keep
 * the same `weights` and drive an AnimationMixer with them instead.
 */

export const JOINTS = [
  "hips",
  "spine",
  "chest",
  "head",
  "lUpperArm",
  "lForearm",
  "rUpperArm",
  "rForearm",
  "lThigh",
  "lShin",
  "rThigh",
  "rShin",
  "lFoot",
  "rFoot",
] as const;

export type JointName = (typeof JOINTS)[number];

const J = Object.fromEntries(JOINTS.map((name, i) => [name, i * 3])) as Record<JointName, number>;
/** Last slot holds the vertical hips offset. */
const HIPS_Y = JOINTS.length * 3;
export const POSE_SIZE = HIPS_Y + 1;

export type Pose = Float32Array;

function set(p: Pose, joint: JointName, x: number, y = 0, z = 0) {
  const i = J[joint];
  p[i] = x;
  p[i + 1] = y;
  p[i + 2] = z;
}

export function readJoint(p: Pose, joint: JointName): [number, number, number] {
  const i = J[joint];
  return [p[i]!, p[i + 1]!, p[i + 2]!];
}

export function readHipsOffset(p: Pose): number {
  return p[HIPS_Y]!;
}

// Sign conventions (model faces +Z, character's left is +X):
//  limb x-rotation < 0 swings it forward; shin/forearm x > 0 / < 0 bends knee/elbow;
//  upper-arm z > 0 raises the left arm sideways (right arm uses z < 0).

function idle(p: Pose, t: number) {
  const breath = Math.sin(t * 2.1);
  p.fill(0);
  set(p, "hips", 0, Math.sin(t * 0.5) * 0.03, Math.sin(t * 0.8) * 0.012);
  set(p, "spine", 0.02 * breath);
  set(p, "chest", 0.025 * breath);
  set(p, "head", 0.04 * Math.sin(t * 0.7), Math.sin(t * 0.37) * 0.22, 0);
  set(p, "lUpperArm", 0.04 * breath, 0, 0.09 + 0.015 * breath);
  set(p, "rUpperArm", 0.04 * breath, 0, -0.09 - 0.015 * breath);
  set(p, "lForearm", -0.18);
  set(p, "rForearm", -0.18);
  set(p, "lThigh", 0, 0, 0.035);
  set(p, "rThigh", 0, 0, -0.035);
  set(p, "lShin", 0.04);
  set(p, "rShin", 0.04);
  p[HIPS_Y] = -0.006 + 0.006 * breath;
}

function walk(p: Pose, phase: number) {
  const s = Math.sin(phase);
  const c = Math.cos(phase);
  p.fill(0);
  set(p, "hips", 0, 0.12 * s, 0.03 * c);
  set(p, "spine", 0.05, -0.06 * s);
  set(p, "chest", 0.02, -0.1 * s);
  set(p, "head", -0.02, 0.06 * s);
  set(p, "lThigh", -0.55 * s, 0, 0.02);
  set(p, "rThigh", 0.55 * s, 0, -0.02);
  set(p, "lShin", 0.12 + 0.8 * Math.max(0, c));
  set(p, "rShin", 0.12 + 0.8 * Math.max(0, -c));
  set(p, "lFoot", 0.25 * s);
  set(p, "rFoot", -0.25 * s);
  set(p, "lUpperArm", 0.45 * s, 0, 0.08);
  set(p, "rUpperArm", -0.45 * s, 0, -0.08);
  set(p, "lForearm", -0.3 - 0.25 * Math.max(0, -s));
  set(p, "rForearm", -0.3 - 0.25 * Math.max(0, s));
  p[HIPS_Y] = -0.02 + 0.025 * Math.cos(2 * phase);
}

function run(p: Pose, phase: number) {
  const s = Math.sin(phase);
  const c = Math.cos(phase);
  p.fill(0);
  set(p, "hips", 0, 0.16 * s, 0.04 * c);
  set(p, "spine", 0.2, -0.08 * s);
  set(p, "chest", 0.06, -0.18 * s);
  set(p, "head", -0.16, 0.08 * s);
  set(p, "lThigh", -0.3 - 0.85 * s, 0, 0.03);
  set(p, "rThigh", -0.3 + 0.85 * s, 0, -0.03);
  set(p, "lShin", 0.35 + 1.25 * Math.max(0, c));
  set(p, "rShin", 0.35 + 1.25 * Math.max(0, -c));
  set(p, "lFoot", 0.3 * s);
  set(p, "rFoot", -0.3 * s);
  set(p, "lUpperArm", 0.85 * s, 0, 0.14);
  set(p, "rUpperArm", -0.85 * s, 0, -0.14);
  set(p, "lForearm", -1.35);
  set(p, "rForearm", -1.35);
  p[HIPS_Y] = -0.06 + 0.05 * Math.cos(2 * phase);
}

function jump(p: Pose, verticalVelocity: number) {
  // u = 1 at take-off, 0 at apex, -1 falling fast.
  const u = clamp(verticalVelocity / PLAYER.jumpVelocity, -1, 1);
  const fall = Math.max(0, -u);
  p.fill(0);
  set(p, "spine", -0.06 + 0.1 * fall);
  set(p, "chest", -0.04);
  set(p, "head", -0.1 + 0.12 * fall);
  set(p, "lThigh", -0.95 + 0.45 * fall, 0, 0.06);
  set(p, "lShin", 1.25 - 0.7 * fall);
  set(p, "rThigh", -0.15 + 0.1 * fall, 0, -0.06);
  set(p, "rShin", 0.55 - 0.25 * fall);
  set(p, "lFoot", 0.3);
  set(p, "rFoot", 0.2);
  set(p, "lUpperArm", -0.35, 0, 0.75 + 0.35 * u);
  set(p, "rUpperArm", -0.35, 0, -0.75 - 0.35 * u);
  set(p, "lForearm", -0.45);
  set(p, "rForearm", -0.45);
}

function inspect(p: Pose, t: number) {
  const sway = Math.sin(t * 0.9);
  p.fill(0);
  set(p, "hips", 0, 0.05, 0.03);
  set(p, "spine", -0.03);
  set(p, "chest", -0.03, -0.06);
  set(p, "head", -0.18 + 0.03 * sway, 0.05, 0.08 + 0.03 * sway);
  // Right hand thoughtfully raised to the chin, left hand behind the back.
  set(p, "rUpperArm", -1.05, 0.25, -0.32);
  set(p, "rForearm", -2.05, 0, 0);
  set(p, "lUpperArm", 0.4, 0, 0.12);
  set(p, "lForearm", -0.85);
  set(p, "lThigh", 0.04, 0, 0.06);
  set(p, "rThigh", -0.06, 0, -0.03);
  set(p, "lShin", 0.08);
  set(p, "rShin", 0.12);
  p[HIPS_Y] = -0.01;
}

/** Seated on a chair: hips drop to seat height, thighs forward, shins down, hands in the lap. */
export const SIT_HIPS_DROP = -0.44;
function sit(p: Pose, t: number) {
  const breath = Math.sin(t * 2.1);
  p.fill(0);
  set(p, "spine", -0.05 + 0.015 * breath);
  set(p, "chest", 0.02 * breath);
  set(p, "head", 0.06 + 0.03 * Math.sin(t * 0.6), Math.sin(t * 0.33) * 0.25, 0);
  set(p, "lThigh", -1.5, 0, 0.07);
  set(p, "rThigh", -1.5, 0, -0.07);
  set(p, "lShin", 1.5);
  set(p, "rShin", 1.5);
  set(p, "lUpperArm", -0.42, 0, 0.12);
  set(p, "rUpperArm", -0.42, 0, -0.12);
  set(p, "lForearm", -0.95, 0, 0);
  set(p, "rForearm", -0.95, 0, 0);
  p[HIPS_Y] = SIT_HIPS_DROP;
}

export interface AnimatorInput {
  state: AnimationStateName;
  horizontalSpeed: number;
  verticalVelocity: number;
  landed: boolean;
}

const STATES: AnimationStateName[] = ["idle", "walk", "run", "jump", "inspect", "sit"];

export class CharacterAnimator {
  readonly weights: Record<AnimationStateName, number> = { idle: 1, walk: 0, run: 0, jump: 0, inspect: 0, sit: 0 };
  readonly pose: Pose = new Float32Array(POSE_SIZE);
  private readonly scratch: Pose = new Float32Array(POSE_SIZE);
  private time = 0;
  private phase = 0;
  private landImpulse = 0;
  /** Cross-fade speed (1/s): ~0.15 s transitions. */
  blendRate = 11;

  update(dt: number, inp: AnimatorInput): Pose {
    this.time += dt;
    const runBlend = this.weights.run / Math.max(1e-3, this.weights.run + this.weights.walk);
    const stride = 1.9 + (2.7 - 1.9) * runBlend;
    this.phase = (this.phase + (inp.horizontalSpeed * dt * Math.PI * 2) / stride) % (Math.PI * 2);
    if (inp.landed) this.landImpulse = 1;
    this.landImpulse = Math.max(0, this.landImpulse - dt * 4.5);

    const k = damp(this.blendRate, dt);
    let total = 0;
    for (const s of STATES) {
      const target = s === inp.state ? 1 : 0;
      this.weights[s] += (target - this.weights[s]) * k;
      total += this.weights[s];
    }

    this.pose.fill(0);
    for (const s of STATES) {
      const w = this.weights[s] / total;
      if (w < 1e-3) continue;
      const p = this.scratch;
      switch (s) {
        case "idle":
          idle(p, this.time);
          break;
        case "walk":
          walk(p, this.phase);
          break;
        case "run":
          run(p, this.phase);
          break;
        case "jump":
          jump(p, inp.verticalVelocity);
          break;
        case "inspect":
          inspect(p, this.time);
          break;
        case "sit":
          sit(p, this.time);
          break;
      }
      for (let i = 0; i < POSE_SIZE; i++) this.pose[i]! += p[i]! * w;
    }

    // Landing squash, layered on top of whatever is playing.
    if (this.landImpulse > 0) {
      const e = Math.sin(this.landImpulse * Math.PI) * 0.9;
      this.pose[HIPS_Y]! -= 0.09 * e;
      this.pose[J.spine]! += 0.18 * e;
      this.pose[J.lThigh]! -= 0.3 * e;
      this.pose[J.rThigh]! -= 0.3 * e;
      this.pose[J.lShin]! += 0.6 * e;
      this.pose[J.rShin]! += 0.6 * e;
    }
    return this.pose;
  }
}

/** Chooses the animation state from movement data. Pure — unit tested. */
export function selectAnimationState(opts: {
  grounded: boolean;
  horizontalSpeed: number;
  inspecting: boolean;
  wantsRun: boolean;
  seated?: boolean;
}): AnimationStateName {
  if (opts.seated) return "sit";
  if (opts.inspecting) return "inspect";
  if (!opts.grounded) return "jump";
  if (opts.horizontalSpeed < 0.35) return "idle";
  if (opts.wantsRun && opts.horizontalSpeed > (PLAYER.walkSpeed + PLAYER.runSpeed) / 2 - 0.4) return "run";
  return "walk";
}
