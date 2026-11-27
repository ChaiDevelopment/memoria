export type AnimationStateName = "idle" | "walk" | "run" | "jump" | "inspect" | "sit";

export type QualityLevel = "low" | "medium" | "high";

export interface GameSettings {
  mouseSensitivity: number;
  touchSensitivity: number;
  invertY: boolean;
  quality: QualityLevel;
  showFps: boolean;
  showHints: boolean;
  cameraDistance: number;
}
