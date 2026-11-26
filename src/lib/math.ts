export const clamp = (v: number, min: number, max: number) => (v < min ? min : v > max ? max : v);

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Frame-rate independent smoothing factor for exponential approach at `rate` (1/s). */
export const damp = (rate: number, dt: number) => 1 - Math.exp(-rate * dt);

/** Wrap an angle to (-PI, PI]. */
export function wrapAngle(a: number): number {
  const TAU = Math.PI * 2;
  a = a % TAU;
  if (a > Math.PI) a -= TAU;
  else if (a <= -Math.PI) a += TAU;
  return a;
}

/** Interpolate angles along the shortest arc. */
export function lerpAngle(a: number, b: number, t: number): number {
  return a + wrapAngle(b - a) * t;
}

/** Rotation (radians about +Y) that turns a +Z-facing object to face the given facing token. */
export function facingToRotationY(facing: "+x" | "-x" | "+z" | "-z"): number {
  switch (facing) {
    case "+z":
      return 0;
    case "-z":
      return Math.PI;
    case "+x":
      return Math.PI / 2;
    case "-x":
      return -Math.PI / 2;
  }
}

export function facingToNormal(facing: "+x" | "-x" | "+z" | "-z"): { x: number; z: number } {
  switch (facing) {
    case "+z":
      return { x: 0, z: 1 };
    case "-z":
      return { x: 0, z: -1 };
    case "+x":
      return { x: 1, z: 0 };
    case "-x":
      return { x: -1, z: 0 };
  }
}
