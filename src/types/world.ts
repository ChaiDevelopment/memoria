/** Core world/geometry types shared by rendering, collision and gameplay systems. */

export type Vec3Tuple = [number, number, number];

/** Axis-aligned box described by its min/max corners (world units = meters). */
export interface Box3Data {
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
}

export interface BoxCollider extends Box3Data {
  kind: "box";
  /** Whether the third-person camera should be pushed in front of this collider. */
  blocksCamera: boolean;
}

export interface CylinderCollider {
  kind: "cylinder";
  x: number;
  z: number;
  radius: number;
  minY: number;
  maxY: number;
  blocksCamera: boolean;
}

export type Collider = BoxCollider | CylinderCollider;

/**
 * Fixed areas, plus spaces added as the collection grows: ground-floor
 * East Wing rooms ("room-1"…), upper-floor galleries and upper rooms ("upper-1"…).
 */
export type AreaId =
  | "lobby"
  | "gallery"
  | "timeline"
  | "garden"
  | "atrium"
  | "entrance"
  | "sky-gallery"
  | "upper-gallery"
  | "rooftop"
  | `room-${number}`
  | `upper-${number}`
  | `hall-${number}-${number}`
  | `balcony-${number}`;

export interface AreaDef {
  id: AreaId;
  name: string;
  subtitle: string;
  /** XZ bounds used to detect which area the player is in. */
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  indoor: boolean;
  /** Floor height of this area (0 = ground floor). Areas on other floors are ignored by areaAt. */
  elevation?: number;
}

export type OpeningKind = "door" | "window";

export interface WallOpening {
  kind: OpeningKind;
  /** Start/end along the wall's run axis (world coordinates). */
  start: number;
  end: number;
  /** Bottom/top height of the opening, relative to the wall's base. Doors start at a floor. */
  bottom: number;
  top: number;
}

export interface WallDef {
  id: string;
  area: AreaId;
  /** "x": the wall runs along the X axis at z = `at`. "z": runs along Z at x = `at`. */
  axis: "x" | "z";
  at: number;
  from: number;
  to: number;
  height: number;
  thickness: number;
  openings: WallOpening[];
  /** Interior walls get trim on both faces; all walls get baseboards. */
  exterior?: boolean;
  /** Height the wall stands on (upper-floor walls). Default 0. */
  baseY?: number;
}

export interface RectXZ {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface CeilingDef {
  area: AreaId;
  rect: RectXZ;
  /** Underside height of the slab. */
  height: number;
  thickness: number;
  skylights: RectXZ[];
  /**
   * When true the skylight holes are real openings for collision too (an
   * atrium balcony ring with stairs rising through it). By default the slab
   * collides over its full rectangle (glass skylights are solid).
   */
  openHoles?: boolean;
  /** Wooden glazing bars across the skylights (default true). */
  glazingBars?: boolean;
}

export interface FloorDef {
  area: AreaId;
  rect: RectXZ;
  material: "wood" | "stone";
  /** Floor surface height (upper floors). Default 0. */
  y?: number;
}
