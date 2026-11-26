/** Placeholder "memory" (photograph) data. Phase 2 will source these from user uploads. */

export type SceneKind =
  | "sunset-sea"
  | "mountains"
  | "forest"
  | "night-city"
  | "meadow"
  | "beach"
  | "snow"
  | "lake"
  | "desert"
  | "lanterns"
  | "autumn";

export interface Memory {
  id: string;
  title: string;
  year: number;
  caption: string;
  scene: SceneKind;
  seed: number;
  /** width / height */
  aspect: number;
}

export type Facing = "+x" | "-x" | "+z" | "-z";

/** Where a framed photograph hangs or stands in the world. */
export interface PhotoPlacement {
  memoryId: string;
  /** Center of the photo surface. */
  x: number;
  y: number;
  z: number;
  /** Direction the photo faces (towards the viewer). */
  facing: Facing;
  /** Height of the printed photo in meters (width derives from aspect). */
  height: number;
  frame: "oak" | "black" | "gold" | "white";
  /** Freestanding photos (garden easels) get a stand instead of a wall mount. */
  mount: "wall" | "easel";
  /** Frame width / height for frames without a placeholder memory (Memory Rooms). */
  aspect?: number;
}
