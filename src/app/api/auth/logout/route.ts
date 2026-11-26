import { destroySession } from "@/server/auth/session";
import { assertSameOrigin, handler, json } from "@/server/http";

export const POST = handler(async (request: Request) => {
  assertSameOrigin(request);
  await destroySession();
  return json({ ok: true });
});
