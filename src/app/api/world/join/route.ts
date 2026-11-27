import { grantVisitorPass } from "@/server/auth/viewer";
import { randomToken } from "@/server/crypto";
import { ApiError, assertSameOrigin, handler, json } from "@/server/http";
import { invitationByKeyword } from "@/server/invitationService";
import { worldSettings } from "@/server/photos/service";
import { createRateLimiter, isValidKeyword, matchesWorld, normalizeKeyword, sanitizeVisitorName } from "@/server/worldAccess";

const attempts = createRateLimiter(12, 60_000);

/**
 * "Join World": a visitor gives a keyword and a name, and gets a read-only
 * visitor pass for that world — the museum or a wedding invitation. No
 * account needed. Unknown, unpublished or private worlds all answer the
 * same "World Not Found".
 */
export const POST = handler(async (request: Request) => {
  assertSameOrigin(request);
  const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!attempts(ip)) throw new ApiError(429, "too_many_attempts", "Too many attempts. Please wait a minute and try again.");

  const body = (await request.json().catch(() => null)) as { keyword?: unknown; name?: unknown } | null;
  const keyword = normalizeKeyword(body?.keyword);
  if (!keyword) throw new ApiError(400, "keyword_required", "Please enter the world's keyword.");
  if (!isValidKeyword(keyword)) throw new ApiError(400, "invalid_keyword", "Keywords use letters, numbers and dashes (3–64 characters).");
  const name = sanitizeVisitorName(body?.name);
  if (!name) throw new ApiError(400, "name_required", "Please tell us your name.");

  const museum = await worldSettings();
  if (museum && (await matchesWorld(keyword, museum))) {
    await grantVisitorPass({ id: randomToken(12), name }, museum);
    return json({ world: { kind: "museum", name: museum.name }, visitor: { name } }, { headers: { "cache-control": "no-store" } });
  }
  const invitation = await invitationByKeyword(keyword);
  if (invitation?.published) {
    await grantVisitorPass({ id: randomToken(12), name }, invitation);
    return json({ world: { kind: "invitation", name: invitation.title }, visitor: { name } }, { headers: { "cache-control": "no-store" } });
  }
  throw new ApiError(404, "world_not_found", "We couldn't find a world with that keyword. Please check the keyword and try again.");
});
