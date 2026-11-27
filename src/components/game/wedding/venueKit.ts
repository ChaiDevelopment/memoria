"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";

/** Memoised value that is disposed when it changes or unmounts. */
export function useDisposable<T extends { dispose(): void }>(make: () => T, deps: readonly unknown[]): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const v = useMemo(make, deps);
  useEffect(() => () => v.dispose(), [v]);
  return v;
}

/** Deterministic pseudo-random numbers (decor must look the same for every guest). */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

const std = (color: string, o: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o });

function makeKit() {
  return {
    m: {
      // Shared
      white: std("#ffffff", { roughness: 0.85, flatShading: true }),
      satin: std("#fbf7ef", { roughness: 0.45 }),
      cream: std("#f4ecdd", { roughness: 0.7 }),
      champagne: std("#efe0c4", { roughness: 0.55 }),
      gold: std("#d4b072", { roughness: 0.3, metalness: 0.8 }),
      goldDark: std("#a9844a", { roughness: 0.35, metalness: 0.75 }),
      blush: std("#efb8b8", { roughness: 0.75, flatShading: true }),
      greenery: std("#6f9a5b", { roughness: 0.85, flatShading: true }),
      wire: std("#3a2f28", { roughness: 0.9 }),
      bulb: new THREE.MeshStandardMaterial({ color: "#fff4d6", emissive: "#ffcf7a", emissiveIntensity: 2.4, roughness: 0.4 }),
      flame: new THREE.MeshStandardMaterial({ color: "#fff1c9", emissive: "#ffb85c", emissiveIntensity: 3, roughness: 0.5 }),
      petal: new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.9, side: THREE.DoubleSide }),
      // Garden
      grassDeep: std("#5d8c4e", { roughness: 0.95, flatShading: true }),
      wood: std("#a87b52", { roughness: 0.7, flatShading: true }),
      woodDark: std("#7a5538", { roughness: 0.75, flatShading: true }),
      woodLight: std("#c9a57c", { roughness: 0.7, flatShading: true }),
      stone: std("#cfc6b6", { roughness: 0.9, flatShading: true }),
      water: new THREE.MeshStandardMaterial({ color: "#7fb9c9", roughness: 0.08, metalness: 0.25 }),
      fabric: std("#fffaf2", { roughness: 0.95, side: THREE.DoubleSide }),
      bark: std("#6b4a35", { roughness: 0.9, flatShading: true }),
      firefly: new THREE.MeshBasicMaterial({ color: "#ffe9a3" }),
      // Ballroom
      burgundy: std("#7d2333", { roughness: 0.9 }),
      burgundyDeep: std("#5e1825", { roughness: 0.95 }),
      velvet: std("#8b2f3c", { roughness: 0.95 }),
      ivoryWall: std("#f1e6d4", { roughness: 0.9 }),
      panel: std("#e7d7bd", { roughness: 0.85 }),
      ceiling: std("#f6efe4", { roughness: 1 }),
      ceilingTray: std("#efe4d0", { roughness: 1 }),
      cove: new THREE.MeshStandardMaterial({ color: "#fff3dc", emissive: "#ffd9a0", emissiveIntensity: 1.1, roughness: 1 }),
      nightGlass: new THREE.MeshStandardMaterial({ color: "#2b3a5e", emissive: "#1e2a4a", emissiveIntensity: 0.6, roughness: 0.15, metalness: 0.3 }),
      crystal: new THREE.MeshStandardMaterial({ color: "#fff6e4", emissive: "#ffd79a", emissiveIntensity: 1.3, roughness: 0.1, metalness: 0.3, flatShading: true }),
      tablecloth: std("#f2e5cc", { roughness: 0.75 }),
      marbleColumn: std("#f3eee6", { roughness: 0.3, flatShading: true }),
    },
    g: {
      box: new THREE.BoxGeometry(1, 1, 1),
      cylinder: new THREE.CylinderGeometry(1, 1, 1, 14),
      cylinderLow: new THREE.CylinderGeometry(1, 1, 1, 7),
      tableTop: new THREE.CylinderGeometry(1, 1, 1, 20),
      cloth: new THREE.CylinderGeometry(1, 1.12, 1, 20, 1, true),
      flower: new THREE.IcosahedronGeometry(0.16, 0),
      bush: new THREE.DodecahedronGeometry(1, 0),
      crown: new THREE.IcosahedronGeometry(1, 0),
      cone: new THREE.ConeGeometry(1, 1, 8),
      bulb: new THREE.SphereGeometry(0.05, 6, 4),
      orb: new THREE.SphereGeometry(1, 10, 6),
      petal: new THREE.CircleGeometry(0.035, 5).rotateX(-Math.PI / 2),
      stoneSlab: new THREE.CylinderGeometry(1, 1, 1, 6),
      plane: new THREE.PlaneGeometry(1, 1),
      halfDisc: new THREE.CircleGeometry(1, 20, 0, Math.PI),
      halfRing: new THREE.TorusGeometry(1, 0.06, 6, 28, Math.PI),
      ring: new THREE.TorusGeometry(1, 0.04, 6, 32),
    },
  };
}

export type VenueKit = ReturnType<typeof makeKit>;

export function useVenueKit(): VenueKit {
  const kit = useMemo(makeKit, []);
  useEffect(
    () => () => {
      Object.values(kit.m).forEach((x) => x.dispose());
      Object.values(kit.g).forEach((x) => x.dispose());
    },
    [kit],
  );
  return kit;
}
