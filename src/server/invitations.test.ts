import { describe, expect, it } from "vitest";
import {
  canManage,
  claimSeat,
  coupleRoleOf,
  createInvitationSchema,
  firstEventStart,
  invitationToValues,
  isMapsUrl,
  keywordProblem,
  openSeat,
  parseInvitations,
  parseRsvps,
  parseWishes,
  rsvpSchema,
  summarizeRsvps,
  titleFor,
  weddingDetailsSchema,
  type WeddingInvitation,
} from "./invitations";
import { decodeVisitorPass, issueVisitorPass, keywordHash } from "./worldAccess";

const details = weddingDetailsSchema.parse({
  brideName: "Rina",
  groomName: "Dimas",
  setting: "indoor",
  events: [
    { label: "Resepsi", date: "2026-12-20", time: "11:00" },
    { label: "Akad Nikah", date: "2026-12-20", time: "08:00", mapsUrl: "https://maps.app.goo.gl/abc123" },
  ],
  banks: [{ bank: "BCA", number: "123 456 7890", holder: "Rina" }],
});

const base: Omit<WeddingInvitation, "row"> = {
  keyword: "dimas-rina",
  theme: "wedding",
  title: "The Wedding of Dimas & Rina",
  owner: "rina@gmail.com",
  folderId: "folder1234567",
  published: true,
  created: "2026-11-27T00:00:00.000Z",
  brideEmail: "rina@gmail.com",
  groomEmail: "",
  pairCodeHash: "hash-1",
  details,
};

describe("invitation rows", () => {
  it("round-trip through the Sheet", () => {
    const [inv] = parseInvitations([invitationToValues(base)]);
    expect(inv).toMatchObject({ row: 2, keyword: "dimas-rina", owner: "rina@gmail.com", brideEmail: "rina@gmail.com", groomEmail: "", published: true });
    if (inv?.theme !== "wedding") throw new Error("expected a wedding");
    expect(inv.details.setting).toBe("indoor");
    expect(inv.details.banks[0]!.number).toBe("123 456 7890");
  });

  it("round-trips a museum world too", () => {
    const museum = { ...base, keyword: "museum-kita", theme: "museum" as const, title: "Museum Kita", brideEmail: "", details: { name: "Museum Kita", welcome: "Selamat datang" } };
    const [w] = parseInvitations([invitationToValues(museum)]);
    expect(w).toMatchObject({ theme: "museum", keyword: "museum-kita", title: "Museum Kita", details: { name: "Museum Kita" } });
    expect(titleFor(museum)).toBe("Museum Kita");
    // A museum row whose details don't fit is skipped, not mistaken for a wedding.
    expect(parseInvitations([[...invitationToValues(museum).slice(0, 10), JSON.stringify({ brideName: "A", groomName: "B" })]])).toHaveLength(0);
  });

  it("skips rows without a valid keyword or details, and honours Published", () => {
    const rows = [["", "wedding"], ["ab", "wedding", "", "", "", "", "", "", "", "", "{}"], [...invitationToValues(base)]];
    rows[2]![5] = "FALSE";
    const list = parseInvitations(rows);
    expect(list).toHaveLength(1);
    expect(list[0]!.row).toBe(4);
    expect(list[0]!.published).toBe(false);
    expect(parseInvitations([[...invitationToValues(base).slice(0, 10), "not json"]])).toHaveLength(0);
  });
});

describe("keywords", () => {
  it("rejects taken, reserved and malformed keywords", () => {
    expect(keywordProblem("Dimas-Rina", ["dimas-rina"])).toMatch(/sudah dipakai/);
    expect(keywordProblem("admin", [])).toMatch(/tidak bisa/);
    expect(keywordProblem("a/b", [])).toMatch(/huruf/);
    expect(keywordProblem("", [])).toMatch(/Isi/);
    expect(keywordProblem("rina-dimas-2026", ["dimas-rina"])).toBeNull();
  });
});

describe("details", () => {
  it("only accepts Google Maps links", () => {
    expect(isMapsUrl("https://maps.app.goo.gl/x1")).toBe(true);
    expect(isMapsUrl("https://www.google.com/maps/place/Jakarta")).toBe(true);
    expect(isMapsUrl("https://goo.gl/maps/abc")).toBe(true);
    expect(isMapsUrl("https://www.google.com/search?q=x")).toBe(false);
    expect(isMapsUrl("http://maps.app.goo.gl/x1")).toBe(false);
    expect(isMapsUrl("https://evil.example/maps")).toBe(false);
    expect(isMapsUrl("javascript:alert(1)")).toBe(false);
    expect(weddingDetailsSchema.safeParse({ ...details, events: [{ label: "Akad", date: "2026-12-20", mapsUrl: "https://evil.example" }] }).success).toBe(false);
  });

  it("validates bank numbers and requires the privacy agreement", () => {
    expect(weddingDetailsSchema.safeParse({ ...details, banks: [{ bank: "BCA", number: "abc", holder: "R" }] }).success).toBe(false);
    expect(createInvitationSchema.safeParse({ theme: "wedding", keyword: "x-y-z", role: "bride", details, agree: false }).success).toBe(false);
    expect(createInvitationSchema.safeParse({ theme: "wedding", keyword: "x-y-z", role: "bride", details, agree: true }).success).toBe(true);
    expect(createInvitationSchema.safeParse({ theme: "museum", keyword: "x-y-z", details: { name: "Museum Kita" }, agree: true }).success).toBe(true);
    expect(createInvitationSchema.safeParse({ theme: "museum", keyword: "x-y-z", details: { name: "" }, agree: true }).success).toBe(false);
  });

  it("counts down to the earliest event", () => {
    expect(firstEventStart(details)).toBe("2026-12-20T08:00:00");
    expect(firstEventStart({ events: [] })).toBeNull();
  });
});

describe("the couple's seats", () => {
  it("knows who the bride and groom are", () => {
    expect(coupleRoleOf(base, "RINA@gmail.com ")).toBe("bride");
    expect(coupleRoleOf(base, "guest@gmail.com")).toBeNull();
    expect(coupleRoleOf(base, null)).toBeNull();
    expect(canManage(base, "rina@gmail.com")).toBe(true);
    expect(canManage(base, "guest@gmail.com")).toBe(false);
    expect(openSeat(base)).toBe("groom");
  });

  it("locks the partner in with the one-time link, and only once", () => {
    const ok = claimSeat(base, "dimas@gmail.com", "hash-1");
    expect(ok).toEqual({ ok: true, role: "groom", brideEmail: "rina@gmail.com", groomEmail: "dimas@gmail.com" });
    expect(claimSeat(base, "dimas@gmail.com", "wrong")).toEqual({ ok: false, code: "invalid_link" });
    expect(claimSeat({ ...base, pairCodeHash: "" }, "dimas@gmail.com", "")).toEqual({ ok: false, code: "invalid_link" });
    expect(claimSeat(base, "rina@gmail.com", "hash-1")).toEqual({ ok: false, code: "already_partner" });
    expect(claimSeat({ ...base, groomEmail: "dimas@gmail.com" }, "other@gmail.com", "hash-1")).toEqual({ ok: false, code: "seats_taken" });
  });
});

describe("wishes", () => {
  it("keeps one invitation's wishes, newest first", () => {
    const rows = [
      ["t1", "dimas-rina", "Budi", "Selamat!", "visitor"],
      ["t2", "other-world", "X", "Bukan untuk kalian", "visitor"],
      ["t3", "dimas-rina", "Rina", "Terima kasih semua", "bride"],
      ["t4", "dimas-rina", "", "", "visitor"],
    ];
    const w = parseWishes(rows, "dimas-rina");
    expect(w.map((x) => x.message)).toEqual(["Terima kasih semua", "Selamat!"]);
    expect(w[0]!.role).toBe("bride");
  });
});

describe("visitor passes across worlds", () => {
  it("carry the hash of the world they were issued for", async () => {
    const secret = btoa("s".repeat(32));
    const { value } = await issueVisitorPass({ id: "abcdef123456", name: "Budi" }, { keyword: "dimas-rina" }, secret, 1000);
    const pass = await decodeVisitorPass(value, secret, 2000);
    expect(pass).toEqual({ id: "abcdef123456", name: "Budi", kh: await keywordHash("dimas-rina") });
    expect(await decodeVisitorPass(value, secret, 1000 + 4 * 86_400_000)).toBeNull();
  });
});

describe("RSVP", () => {
  it("keeps the latest answer per guest, for this invitation only, and totals people", () => {
    const rows = [
      ["2026-11-01", "dimas-rina", "g1", "Budi", "TRUE", "2"],
      ["2026-11-02", "dimas-rina", "g2", "Sari", "FALSE", "0"],
      ["2026-11-03", "other-world", "g3", "X", "TRUE", "5"],
      ["2026-11-04", "dimas-rina", "g1", "Budi", "TRUE", "3"],
      ["2026-11-05", "dimas-rina", "", "NoId", "TRUE", "1"],
    ];
    const list = parseRsvps(rows, "dimas-rina");
    expect(list.map((r) => [r.name, r.attending, r.count, r.row])).toEqual([
      ["Budi", true, 3, 5],
      ["Sari", false, 0, 3],
    ]);
    expect(summarizeRsvps(list)).toEqual({ attendingGuests: 1, attendingPeople: 3, notAttending: 1 });
  });

  it("validates answers", () => {
    expect(rsvpSchema.parse({ attending: false })).toEqual({ attending: false, count: 0 });
    expect(rsvpSchema.parse({ attending: false, count: 0 })).toEqual({ attending: false, count: 0 });
    expect(rsvpSchema.parse({ attending: true })).toEqual({ attending: true, count: 1 });
    expect(rsvpSchema.safeParse({ attending: true, count: 0 }).success).toBe(false);
    expect(rsvpSchema.safeParse({ attending: true, count: 11 }).success).toBe(false);
    expect(rsvpSchema.safeParse({ attending: "ya" }).success).toBe(false);
  });
});
