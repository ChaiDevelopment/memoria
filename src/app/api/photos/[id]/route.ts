import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import { assertSameOrigin, handler, json, readJson } from "@/server/http";
import { photoUpdateSchema, updatePhoto } from "@/server/photos/service";

type Ctx = { params: Promise<{ id: string }> };
const idSchema = z.string().regex(/^[A-Za-z0-9_-]{10,200}$/, "Invalid photo id");

/** Edit title / year / story, or hide a photo from the museum. */
export const PATCH = handler(async (request: Request, ctx: Ctx) => {
  assertSameOrigin(request);
  await requireUser();
  const id = idSchema.parse((await ctx.params).id);
  const patch = await readJson(request, photoUpdateSchema);
  return json({ photo: await updatePhoto(id, patch) });
});
