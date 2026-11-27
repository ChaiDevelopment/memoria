"use client";

import { Bloom, BrightnessContrast, EffectComposer, HueSaturation, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import type { QualityLevel } from "@/types/game";

/**
 * The "illustrated" finish: lamps, candles and string lights glow (bloom),
 * colours are a touch warmer and richer, with a soft vignette. Skipped on
 * Low quality so phones stay smooth.
 */
export function PostFX({ quality, warm }: { quality: QualityLevel; warm: boolean }) {
  if (quality === "low") return null;
  return (
    <EffectComposer multisampling={quality === "high" ? 2 : 0} enableNormalPass={false}>
      {/* Only light sources glow (emissive > 1), not every sunlit white surface. */}
      <Bloom mipmapBlur luminanceThreshold={1.1} luminanceSmoothing={0.12} intensity={warm ? 1 : 0.6} radius={0.7} />
      <HueSaturation saturation={warm ? 0.14 : 0.06} />
      <BrightnessContrast brightness={-0.03} contrast={warm ? 0.1 : 0.04} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Vignette offset={0.32} darkness={warm ? 0.42 : 0.3} />
    </EffectComposer>
  );
}
