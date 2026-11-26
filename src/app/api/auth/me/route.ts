import { getCurrentUser } from "@/server/auth/session";
import { handler, json } from "@/server/http";

export const GET = handler(async () => {
  const user = await getCurrentUser();
  return json({ user }, { headers: { "cache-control": "no-store" } });
});
