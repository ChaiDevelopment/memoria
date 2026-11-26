import { clearVisitorPass } from "@/server/auth/viewer";
import { assertSameOrigin, handler, json } from "@/server/http";

/** Ends a visitor's visit (clears the visitor pass). */
export const POST = handler(async (request: Request) => {
  assertSameOrigin(request);
  await clearVisitorPass();
  return json({ ok: true });
});
