import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Default setup: no incremental cache needed — MEMORA's pages are either
// fully static (the 3D museum) or rendered per request (photos, login).
export default defineCloudflareConfig();
