import * as THREE from "three";

/**
 * Shared material palette. One instance of each material is reused by every
 * mesh, which keeps shader programs and state changes to a minimum.
 * Flat shading gives the faceted low-poly look.
 */

function std(color: string, opts: THREE.MeshStandardMaterialParameters = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...opts });
}

function createMaterials() {
  return {
    wall: std("#efe6d4", { roughness: 0.95 }),
    wallWarm: std("#e9dcc4", { roughness: 0.95 }),
    ceiling: std("#f6f0e4", { roughness: 1 }),
    trim: std("#7a5236", { roughness: 0.6 }),
    trimLight: std("#c9a77a", { roughness: 0.6 }),
    glass: new THREE.MeshStandardMaterial({
      color: "#cfe6ee",
      roughness: 0.05,
      metalness: 0.1,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    brass: std("#c9a25e", { roughness: 0.35, metalness: 0.75 }),
    blackMetal: std("#2a2622", { roughness: 0.45, metalness: 0.5 }),
    oak: std("#9c6b43", { roughness: 0.55, flatShading: true }),
    darkWood: std("#5a3b28", { roughness: 0.6, flatShading: true }),
    walnut: std("#6e4a32", { roughness: 0.55 }),
    marble: std("#efeae2", { roughness: 0.25, flatShading: true }),
    stone: std("#cfc6b6", { roughness: 0.9, flatShading: true }),
    stoneDark: std("#9d9486", { roughness: 0.9, flatShading: true }),
    paper: std("#fbf8f1", { roughness: 0.9 }),
    leaf: std("#5f8f4e", { roughness: 0.8, flatShading: true }),
    leafDark: std("#3f6e45", { roughness: 0.8, flatShading: true }),
    hedge: std("#4d7a44", { roughness: 0.9, flatShading: true }),
    bark: std("#6b4a35", { roughness: 0.9, flatShading: true }),
    terracotta: std("#c0714f", { roughness: 0.8, flatShading: true }),
    ceramic: std("#e8e1d4", { roughness: 0.4, flatShading: true }),
    water: new THREE.MeshStandardMaterial({ color: "#6fb5c9", roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.85 }),
    lampGlow: new THREE.MeshStandardMaterial({ color: "#fff1d0", emissive: "#ffd89a", emissiveIntensity: 2.2, roughness: 0.4 }),
    sculpture: std("#e8d9c4", { roughness: 0.3, metalness: 0.1, flatShading: true }),
    crystal: new THREE.MeshStandardMaterial({
      color: "#f3d7a6",
      emissive: "#d49a4a",
      emissiveIntensity: 0.35,
      roughness: 0.15,
      metalness: 0.3,
      flatShading: true,
    }),
    fabric: std("#8c4a3a", { roughness: 1 }),
    cushion: std("#4b5d6e", { roughness: 1, flatShading: true }),
    whiteInstanced: std("#ffffff", { roughness: 0.85, flatShading: true }),
    whiteSmooth: std("#ffffff", { roughness: 0.7 }),
  };
}

export type MaterialLibrary = ReturnType<typeof createMaterials>;

let library: MaterialLibrary | null = null;

export function getMaterials(): MaterialLibrary {
  if (!library) library = createMaterials();
  return library;
}
