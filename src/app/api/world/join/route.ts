import { grantVisitorPass } from "@/server/auth/viewer";
import { randomToken } from "@/server/crypto";
import { ApiError, assertSameOrigin, handler, json } from "@/server/http";
import { worldSettings } from "@/server/photos/service";
import { createRateLimiter, isValidKeyword, matchesWorld, normalizeKeyword, sanitizeVisitorName } from "@/server/worldAccess";

const attempts = createRateLimiter(12, 60_000);

/**
 * "Join World": a visitor gives the museum's keyword and a name, and gets a
 * read-only visitor pass. No account needed. Unknown, unpublished or
 * private worlds all answer the same "World Not Found".
 */
export const POST = handler(async (request: Request) => {
  assertSameOrigin(request);
  const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!attempts(ip)) throw new ApiError(429, "too_many_attempts", "Too many attempts. Please wait a minute and try again.");

  const body = (await request.json().catch(() => null)) as { keyword?: unknown; name?: unknown } | null;
  const keyword = normalizeKeyword(body?.keyword);
  if (!keyword) throw new ApiError(400, "keyword_required", "Please enter the museum's keyword.");
  if (!isValidKeyword(keyword)) throw new ApiError(400, "invalid_keyword", "Keywords use letters, numbers and dashes (3–64 characters).");
  const name = sanitizeVisitorName(body?.name);
  if (!name) throw new ApiError(400, "name_required", "Please tell us your name.");

  const settings = await worldSettings();
  if (!settings || !(await matchesWorld(keyword, settings))) {
    throw new ApiError(404, "world_not_found", "We couldn't find a museum with that keyword. Please check the keyword and try again.");
  }
  await grantVisitorPass({ id: randomToken(12), name }, settings);
  return json({ world: { name: settings.name }, visitor: { name } }, { headers: { "cache-control": "no-store" } });
});
