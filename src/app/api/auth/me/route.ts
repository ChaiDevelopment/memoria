import { getViewer } from "@/server/auth/viewer";
import { handler, json } from "@/server/http";
import { worldSettings } from "@/server/photos/service";

/** Who is here: the signed-in owner, a keyword visitor, or nobody — and, for them, the museum's name. */
export const GET = handler(async () => {
  const viewer = await getViewer();
  const world = viewer ? await worldSettings().catch(() => null) : null;
  return json(
    {
      user: viewer?.role === "owner" ? viewer.user : null,
      visitor: viewer?.role === "visitor" ? { name: viewer.name } : null,
      world: world ? { name: world.name } : null,
    },
    { headers: { "cache-control": "no-store" } },
  );
});
