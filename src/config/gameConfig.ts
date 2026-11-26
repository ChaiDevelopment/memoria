/**
 * Tunable gameplay constants. Kept in one place so feel can be iterated without
 * touching system code.
 */

export const PLAYER = {
  /** Collision cylinder radius (m). */
  radius: 0.32,
  /** Collision cylinder height (m). */
  height: 1.72,
  /** Max ledge the player walks onto without jumping (m). */
  stepHeight: 0.32,
  walkSpeed: 3.1,
  runSpeed: 6.4,
  /** Exponential velocity-approach rates (1/s). */
  groundAcceleration: 13,
  airAcceleration: 3.5,
  gravity: 22,
  jumpVelocity: 7.1,
  maxFallSpeed: 30,
  /** Grace windows for responsive jumping (s). */
  coyoteTime: 0.1,
  jumpBufferTime: 0.14,
  /** How quickly the character turns to face its movement direction (1/s). */
  turnRate: 14,
} as const;

export const CAMERA = {
  fov: 55,
  near: 0.08,
  far: 260,
  defaultDistance: 4.4,
  minDistance: 2.2,
  maxDistance: 7.5,
  /** Closest the camera may be pushed by collisions. */
  collisionMinDistance: 0.55,
  /** Gap kept between the camera and a wall it collides with. */
  collisionPadding: 0.28,
  pivotHeight: 1.5,
  /** Vertical rotation limits (rad). Positive pitch = camera above the player. */
  minPitch: -0.42,
  maxPitch: 1.15,
  defaultPitch: 0.28,
  /** Follow smoothing rates (1/s). */
  followRate: 16,
  followRateVertical: 9,
  /** Pull-in is fast (avoid clipping), push-out is gentle (avoid popping). */
  zoomInRate: 28,
  zoomOutRate: 4.5,
  /** Base radians per pixel before the user sensitivity multiplier. */
  mouseRadiansPerPixel: 0.0022,
  touchRadiansPerPixel: 0.0055,
  /** Below this distance the character fades out so the camera never sees inside it. */
  hidePlayerDistance: 0.85,
} as const;

export const INTERACTION = {
  range: 2.7,
  /** Minimum dot(player facing, direction to object) to count as "looking at it". */
  facingThreshold: 0.2,
} as const;

export const WORLD = {
  /** Shadow frustum half-size around the player (m). */
  shadowExtent: 24,
  sunDirection: [-0.42, 0.74, 0.52] as const,
} as const;
