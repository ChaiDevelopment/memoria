import { describe, expect, it } from "vitest";
import { parseGuestbook, sanitizeMessage } from "./guestbook";
import { createRateLimiter, isValidKeyword, issueVisitorPass, matchesWorld, normalizeKeyword, parseSettings, readVisitorPass, sanitizeVisitorName, type WorldSettings } from "./worldAccess";

const SECRET = btoa("x".repeat(32));
const world: WorldSettings = { keyword: "chaisayangnurma", name: "The Museum of Small Moments", published: true };

describe("keywords", () => {
  it("normalizes case and spaces", () => {
    expect(normalizeKeyword("  ChaiSayang Nurma ")).toBe("chaisayangnurma");
    expect(normalizeKeyword(42)).toBe("");
    expect(isValidKeyword("chaisayangnurma")).toBe(true);
    expect(isValidKeyword("ab")).toBe(false);
    expect(isValidKeyword("no/slashes")).toBe(false);
  });

  it("matches only the published world's keyword", async () => {
    expect(await matchesWorld(" CHAISAYANGNURMA ", world)).toBe(true);
    expect(await matchesWorld("chaisayang", world)).toBe(false);
    expect(await matchesWorld("chaisayangnurma", { ...world, published: false })).toBe(false);
    expect(await matchesWorld("chaisayangnurma", null)).toBe(false);
  });

  it("reads the Settings tab", () => {
    expect(parseSettings([["Keyword", " ChaiSayangNurma "], ["Museum name", "Small Moments"], ["Published", "TRUE"]])).toEqual({ keyword: "chaisayangnurma", name: "Small Moments", published: true });
    expect(parseSettings([["Keyword", "x"]])).toBeNull();
    expect(parseSettings([["Keyword", "chaisayangnurma"], ["Published", "FALSE"]])?.published).toBe(false);
  });
});

describe("visitor names", () => {
  it("trims, collapses, strips markup and limits length", () => {
    expect(sanitizeVisitorName("  Budi   Santoso ")).toBe("Budi Santoso");
    expect(sanitizeVisitorName("<script>x</script>")).toBe("scriptx/script");
    expect(sanitizeVisitorName("   ")).toBeNull();
    expect(sanitizeVisitorName("​​")).toBeNull();
    expect(sanitizeVisitorName("a".repeat(100))).toHaveLength(24);
  });
});

describe("visitor passes", () => {
  it("round-trips while the world stays published with the same keyword", async () => {
    const { value } = await issueVisitorPass({ id: "abcdef123456", name: "Budi" }, world, SECRET, 1000);
    expect(await readVisitorPass(value, SECRET, world, 2000)).toEqual({ id: "abcdef123456", name: "Budi" });
  });

  it("stops working when expired, unpublished, re-keyed or forged", async () => {
    const { value } = await issueVisitorPass({ id: "abcdef123456", name: "Budi" }, world, SECRET, 1000);
    expect(await readVisitorPass(value, SECRET, world, 1000 + 4 * 86_400_000)).toBeNull();
    expect(await readVisitorPass(value, SECRET, { ...world, published: false }, 2000)).toBeNull();
    expect(await readVisitorPass(value, SECRET, { ...world, keyword: "another-world" }, 2000)).toBeNull();
    expect(await readVisitorPass(value, btoa("y".repeat(32)), world, 2000)).toBeNull();
    expect(await readVisitorPass(`${value}x`, SECRET, world, 2000)).toBeNull();
    expect(await readVisitorPass(undefined, SECRET, world, 2000)).toBeNull();
  });
});

describe("rate limiter", () => {
  it("allows a burst, then blocks until the window passes", () => {
    const allow = createRateLimiter(2, 1000);
    expect(allow("ip", 0)).toBe(true);
    expect(allow("ip", 10)).toBe(true);
    expect(allow("ip", 20)).toBe(false);
    expect(allow("other", 20)).toBe(true);
    expect(allow("ip", 1500)).toBe(true);
  });
});

describe("guest book", () => {
  it("sanitizes messages", () => {
    expect(sanitizeMessage("  hai   kalian \n\n\n\n semoga langgeng ")).toBe("hai kalian \n\n semoga langgeng");
    expect(sanitizeMessage(" ")).toBeNull();
    expect(sanitizeMessage("x".repeat(400))).toHaveLength(280);
  });

  it("lists newest first and marks owners", () => {
    const entries = parseGuestbook([
      ["2026-11-01", "Budi", "Pertama!", "visitor"],
      ["2026-11-02", "Chai", "Terima kasih", "owner"],
      ["2026-11-03", "", "", "visitor"],
    ]);
    expect(entries.map((e) => e.message)).toEqual(["Terima kasih", "Pertama!"]);
    expect(entries[0]!.guest).toBe(false);
    expect(entries[1]!.guest).toBe(true);
  });
});
