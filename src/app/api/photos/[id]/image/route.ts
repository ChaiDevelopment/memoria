import { z } from "zod";
import { requireViewer } from "@/server/auth/viewer";
import { handler } from "@/server/http";
import { photoImage } from "@/server/photos/service";

type Ctx = { params: Promise<{ id: string }> };
const idSchema = z.string().regex(/^[A-Za-z0-9_-]{10,200}$/, "Invalid photo id");
const SIZES = { thumb: 512, display: 2048 } as const;

/**
 * Streams a photo from Google Drive (resized by Drive). Only people inside
 * the museum (owners, or visitors with a keyword pass) can load images; only
 * files in the museum folder are served, and the folder itself stays private.
 */
export const GET = handler(async (request: Request, ctx: Ctx) => {
  await requireViewer();
  const id = idSchema.parse((await ctx.params).id);
  const sizeParam = new URL(request.url).searchParams.get("size");
  const size = sizeParam === "display" ? SIZES.display : SIZES.thumb;
  const image = await photoImage(id, size);
  return new Response(image.body, {
    headers: {
      "content-type": image.contentType,
      "cache-control": "private, max-age=86400",
      "x-content-type-options": "nosniff",
    },
  });
});
