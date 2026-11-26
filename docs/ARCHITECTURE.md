# MEMORA — Phase 1 Architecture

Phase 1 is a single-player, client-only 3D museum. There is no backend, no
authentication and no multiplayer yet. This document records the main
technical decisions so later phases can build on them.

## Stack

| Package | Version | Why |
| --- | --- | --- |
| next | 16.4.6 | App Router shell, static export of the landing route |
| react / react-dom | 19.3.1 | Highest version inside R3F 9's peer range (`<19.4`) |
| three | 0.187.0 | Renderer |
| @react-three/fiber | 9.8.2 | Declarative scene graph and frame loop |
| @react-three/drei | 10.7.9 | Only `Sky` is used — kept small on purpose |
| zustand | 5.1.0 | UI state + persisted settings |
| tailwindcss | 4.3.5 | HUD and menu styling |
| typescript | 5.9.3 | Strict mode with `noUncheckedIndexedAccess` (TS 7 skipped until Next's tooling supports it) |
| vitest | 5.1.2 (dev) | Unit tests for the pure systems |

No physics engine, model loader or font library is installed (see the decisions below).

## Directory layout

```
src/
  app/                    Next.js App Router entry (layout, page, global CSS)
  components/
    ClientGame.tsx        Client-only boundary (dynamic import, ssr: false) + boot screen
    GameRoot.tsx          Game shell: canvas + UI layers + input hooks
    game/                 Everything inside the <Canvas>
      GameCanvas.tsx      Renderer setup, quality → DPR/shadows, debug hook
      MuseumWorld.tsx     Composes the static world
      MuseumRoom.tsx      Per-room architecture, merged per material
      Lighting.tsx        Sun (shadow frustum follows the player), sky fill, interior lights
      Player.tsx          Positions the character model, runs the animator
      PlayerController.tsx  Input → motor → animation state, area & interaction tracking
      ThirdPersonCamera.tsx Orbit camera with collision
      CollisionWorld.tsx  Debug visualisation of collision volumes
      character/          Procedural character + the model adapter interface
      environment/        Furniture, photographs, signage, garden, outdoors, instancing helper
    ui/                   HUD, mobile controls, pause/settings menu, inspect overlay, title screen
  systems/                Framework-free game logic (unit tested)
    world/                Layout → render boxes + colliders; area lookup
    movement/             Collision queries and the kinematic character motor
    camera/               Ray casts for camera collision
    animation/            Procedural, cross-faded animation clips
    interaction/          Interactable lookup
    input/                Mutable input state + pointer-lock helpers
    runtime.ts            Per-frame shared player state
  stores/gameStore.ts     Zustand store (UI state, persisted settings)
  config/                 Gameplay constants and all world data (layout, decor, memories)
  lib/                    Math, PRNG, geometry merging, materials, procedural textures
  hooks/                  Desktop controls, input-device detection, fullscreen
  types/                  Shared types
public/models|textures|audio  Reserved for later phases
```

## Key decisions

### 1. Layout is data; geometry and colliders are derived from it
`config/museumLayout.ts` describes walls (with door and window openings),
ceilings (with skylights) and floors. `systems/world/wallBuilder.ts` turns
each wall into render boxes, glass panes, trim **and** collision boxes. The
same is true for furniture in `config/decorLayout.ts`. Because visuals and
collision come from one source, they can't drift apart. Tests check this:
a flood fill from the spawn point must reach all four areas, must **not**
reach outside the building, and must reach a viewing spot for every photograph.

### 2. A custom kinematic controller instead of a physics engine
The museum is made of axis-aligned boxes and upright cylinders, so an
upright-cylinder-vs-AABB solver covers everything Phase 1 needs: wall
sliding, step-up onto low ledges, ground snapping, ceilings, gravity, coyote
time and jump buffering. It is about 300 lines, allocation-free per frame,
deterministic and unit tested in Node. Rapier/cannon would add a WASM or JS
dependency and an asynchronous init step for no gain yet. If later phases
need dynamic rigid bodies, the `Collider` data can feed a physics engine directly.

### 3. Mutable hot path, React for structure
Input (`systems/input/inputState.ts`) and per-frame player data
(`systems/runtime.ts`) are plain mutable objects read inside `useFrame`.
Zustand holds only state that changes rarely (menus, current area, nearby
interactable, settings), and setters de-duplicate so the HUD re-renders only
on real changes. Frame order is explicit through negative `useFrame`
priorities: controller (-3) → player visuals (-2) → camera (-1) → render.
Negative priorities keep R3F's automatic rendering on.

### 4. Swappable character model
`components/game/character/types.ts` defines `CharacterModelHandle`
(`applyPose(pose)`). The animator (`systems/animation/characterAnimator.ts`)
outputs rotations for named joints (hips, spine, chest, head, arms, legs) and
blends the clips **idle, walk, run, jump, inspect** with smooth weight
cross-fades plus a landing squash. To use a rigged GLB later, write a
component that implements the same handle, either by mapping joints to bones
or by driving an `AnimationMixer` from `animator.weights`. Movement code doesn't change.

### 5. Draw-call budget
* Room architecture is merged per material (walls, trim, ceiling, glass,
  floor), so each room costs about 5 draw calls and is culled as a unit.
* All photographs share one canvas **atlas**; all wall labels share
  another; signs share a third. Each set is one draw call.
* Repeated decor (frames, benches, plants, trees, hedges, flowers, stepping
  stones, lamps) uses `InstancedMesh` through `environment/Instanced.tsx`.
* The sun's shadow camera covers 48 m × 48 m around the player and snaps to
  shadow-map texels, so a 2048² (high) or 1024² (medium) map stays sharp
  without shimmering. Low quality turns real-time shadows off and uses a
  blob shadow under the character.

### 6. Procedural assets
Placeholder photographs, wood planks, grass, labels and signage are painted
with Canvas 2D at runtime (`lib/textures/`), and the environment map is three's
`RoomEnvironment`. Nothing is fetched from a CDN and there are no licensing
questions. The page's JavaScript stays small and the Three.js bundle is
code-split (`next/dynamic`, `ssr: false`).

### 7. Input model
* **Desktop:** `KeyboardEvent.code`, so WASD works on any keyboard layout.
  Clicking the 3D view requests pointer lock; if the browser refuses, mouse
  dragging works as a fallback. When the lock is released (Esc), the pause
  menu opens. If you were inspecting a photograph, Esc closes that view instead.
* **Touch:** the left stick has a dead zone and analog speed. Dragging on the
  right side rotates the camera. Jump, run (toggle) and interact are large
  buttons. Each control tracks its own pointer id, so you can move, look and
  jump at the same time.
* While a menu or the inspect view is open, movement and jumping are ignored;
  gravity still applies.

### 8. Testing hooks
Adding `?debug` to the URL exposes `window.__MEMORA__ = { runtime, store }`,
which the automated browser tests use to read the player's position and state.
It does nothing unless the flag is present. Settings → Developer → "Show
collision volumes" draws every collider: red ones also block the camera, blue
ones block only the player.

## Windows note
`npm test` runs through `scripts/test.mjs`. That script upper-cases the drive
letter of the working directory before starting Vitest. Without it, Vitest
fails with "failed to find the current suite" whenever the project is opened
as `d:\…` instead of `D:\…`.
