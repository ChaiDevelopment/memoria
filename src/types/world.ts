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

/** Fixed areas, plus the Memory Rooms added as the collection grows ("room-1", "room-2", …). */
export type AreaId = "lobby" | "gallery" | "timeline" | "garden" | `room-${number}`;

export interface AreaDef {
  id: AreaId;
  name: string;
  subtitle: string;
  /** XZ bounds used to detect which area the player is in. */
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  indoor: boolean;
}

export type OpeningKind = "door" | "window";

export interface WallOpening {
  kind: OpeningKind;
  /** Start/end along the wall's run axis (world coordinates). */
  start: number;
  end: number;
  /** Bottom/top height of the opening. Doors start at 0. */
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
}

export interface FloorDef {
  area: AreaId;
  rect: RectXZ;
  material: "wood" | "stone";
}
