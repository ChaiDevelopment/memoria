# MEMORA

**A Shared World of Memories.** MEMORA is a cozy, low-poly 3D museum where people display their photographs and explore memories together.

This repository is at **Phase 1: 3D world foundation**. It is a single-player, client-only museum you can explore. There is no backend, no accounts and no multiplayer yet.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start   # production build
npm test           # unit tests (Vitest)
npm run typecheck
```

Requires Node 20+.

## Controls

| Desktop | Touch |
| --- | --- |
| **W A S D** move · **Mouse** look (click the view) · **Shift** run · **Space** jump · **E** interact · **Wheel** zoom · **Esc** menu | Left stick moves · drag on the right half to look · run toggle · jump · hand button inspects |

## The museum

Spawn is in the **Grand Entrance Lobby**. Doors from the lobby lead north to the **Main Memory Gallery**, east to the **Timeline Hall** and west to the **Memory Garden**. The gallery also opens into the garden. Walk up to a photograph and press **E** to inspect it.

Settings (sensitivity, invert Y, camera distance, graphics quality, hints, FPS) persist in `localStorage`. **Settings → Developer → Show collision volumes** draws all colliders.

## Your own photos

Sign in with Google at `/photos` (only accounts in `ALLOWED_EMAILS` can enter).
Photos come from a shared Google Drive folder; titles, years and stories are
kept in a Google Sheet. No database is needed. Setup and the Cloudflare deploy
are described in [docs/BACKEND.md](docs/BACKEND.md); copy `.env.example` to
`.env.local` for local development.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the 3D world's technical design.
