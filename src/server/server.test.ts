import { generateKeyPairSync } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isAllowed, readSession } from "./auth/session";
import { base64UrlDecode, base64UrlDecodeText, base64UrlEncode, signValue, verifyValue } from "./crypto";
import { ConfigError, env, resetEnvCache } from "./env";
import { DriveClient, takenAtFor, type DriveFile } from "./google/drive";
import { buildAuthUrl, DRIVE_FILE_SCOPE, createPkce, identityFromIdToken } from "./google/oauth";
import { clearServiceAccountCache, serviceAccountToken } from "./google/serviceAccount";
import { rowToValues, SheetsClient, valuesToRow } from "./google/sheets";
import { assertSameOrigin } from "./http";
import { safeNext } from "./pageAuth";
import { mergeLibrary, titleFromFilename } from "./photos/library";
import { photoUpdateSchema } from "./photos/service";

const jsonResponse = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const SECRET = base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)));

describe("signed values (sessions)", () => {
  it("round-trips and rejects tampering or a different secret", async () => {
    const token = await signValue({ email: "a@b.co", exp: 1 }, SECRET);
    expect(await verifyValue(token, SECRET)).toEqual({ email: "a@b.co", exp: 1 });
    const [body, sig] = token.split(".");
    const forged = base64UrlEncode(JSON.stringify({ email: "evil@b.co", exp: 1 }));
    expect(await verifyValue(`${forged}.${sig}`, SECRET)).toBeNull();
    expect(await verifyValue(`${body}.${sig}x`, SECRET)).toBeNull();
    expect(await verifyValue(token, base64UrlEncode(crypto.getRandomValues(new Uint8Array(32))))).toBeNull();
    expect(await verifyValue("garbage", SECRET)).toBeNull();
  });

  it("only accepts unexpired sessions for allowed emails", async () => {
    const allowed = ["me@gmail.com", "partner@gmail.com"];
    const make = (email: string, exp: number) => signValue({ email, name: null, picture: null, exp }, SECRET);
    const now = 1_000_000;
    expect(await readSession(await make("me@gmail.com", now + 1000), SECRET, allowed, now)).toMatchObject({ email: "me@gmail.com" });
    expect(await readSession(await make("me@gmail.com", now - 1), SECRET, allowed, now)).toBeNull();
    // Removing someone from ALLOWED_EMAILS revokes their existing session.
    expect(await readSession(await make("ex@gmail.com", now + 1000), SECRET, allowed, now)).toBeNull();
    expect(await readSession(undefined, SECRET, allowed, now)).toBeNull();
    expect(isAllowed(" Me@Gmail.com ", allowed)).toBe(true);
  });

  it("encodes base64url both ways", () => {
    const bytes = new Uint8Array([0, 255, 62, 63, 128]);
    expect([...base64UrlDecode(base64UrlEncode(bytes))]).toEqual([...bytes]);
    expect(base64UrlDecodeText(base64UrlEncode("héllo ✓"))).toBe("héllo ✓");
  });
});

describe("configuration", () => {
  const saved = { ...process.env };
  beforeEach(() => resetEnvCache());
  afterEach(() => {
    process.env = { ...saved };
    resetEnvCache();
  });

  it("reports every missing variable clearly", () => {
    for (const k of ["SESSION_SECRET", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "ALLOWED_EMAILS", "GOOGLE_SERVICE_ACCOUNT_EMAIL", "GOOGLE_SERVICE_ACCOUNT_KEY", "DRIVE_FOLDER_ID", "SHEET_ID"]) {
      delete process.env[k];
    }
    expect(() => env()).toThrow(ConfigError);
    try {
      env();
    } catch (e) {
      expect((e as Error).message).toContain("GOOGLE_CLIENT_ID is missing");
      expect((e as Error).message).toContain("DRIVE_FOLDER_ID is missing");
    }
  });

  it("parses a complete configuration", () => {
    Object.assign(process.env, {
      SESSION_SECRET: SECRET,
      GOOGLE_CLIENT_ID: "123-abc.apps.googleusercontent.com",
      GOOGLE_CLIENT_SECRET: "s",
      ALLOWED_EMAILS: "Me@gmail.com, partner@gmail.com",
      GOOGLE_SERVICE_ACCOUNT_EMAIL: "memora@proj.iam.gserviceaccount.com",
      GOOGLE_SERVICE_ACCOUNT_KEY: "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n",
      DRIVE_FOLDER_ID: "1FolderIdForTests_abcdefghij",
      SHEET_ID: "1SheetIdForTests_abcdefghijklmnopqrs",
    });
    const e = env();
    expect(e.ALLOWED_EMAILS).toEqual(["me@gmail.com", "partner@gmail.com"]);
    expect(e.GOOGLE_SERVICE_ACCOUNT_KEY).toContain("\nabc\n");
  });
});

describe("Sign in with Google", () => {
  const cfg = { clientId: "cid.apps.googleusercontent.com", clientSecret: "s", redirectUri: "http://localhost:3000/api/auth/callback" };
  const idToken = (claims: Record<string, unknown>) => `h.${base64UrlEncode(JSON.stringify(claims))}.sig`;
  const good = { iss: "https://accounts.google.com", aud: cfg.clientId, exp: 2e9, nonce: "n1", email: "Me@Gmail.com", email_verified: true, name: "Me" };

  it("builds a PKCE request for identity scopes only", async () => {
    const p = await createPkce();
    const url = new URL(buildAuthUrl(cfg, p));
    expect(url.searchParams.get("scope")).toBe("openid email profile");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("nonce")).toBe(p.nonce);
    expect(url.searchParams.get("redirect_uri")).toBe(cfg.redirectUri);
  });

  it("asks for drive.file only (never the whole Drive) when making an invitation folder", async () => {
    const p = await createPkce();
    const url = new URL(buildAuthUrl(cfg, p, { extraScopes: [DRIVE_FILE_SCOPE], loginHint: "me@gmail.com" }));
    expect(url.searchParams.get("scope")).toBe("openid email profile https://www.googleapis.com/auth/drive.file");
    expect(url.searchParams.get("login_hint")).toBe("me@gmail.com");
    expect(url.searchParams.get("include_granted_scopes")).toBe("true");
    expect(url.searchParams.get("prompt")).toBeNull();
  });

  it("validates issuer, audience, expiry, nonce and verified email", () => {
    expect(identityFromIdToken(idToken(good), cfg.clientId, "n1", 0)).toEqual({ email: "me@gmail.com", name: "Me", picture: null });
    expect(() => identityFromIdToken(idToken({ ...good, aud: "other" }), cfg.clientId, "n1", 0)).toThrow();
    expect(() => identityFromIdToken(idToken({ ...good, nonce: "x" }), cfg.clientId, "n1", 0)).toThrow();
    expect(() => identityFromIdToken(idToken({ ...good, exp: 1 }), cfg.clientId, "n1", 5000)).toThrow();
    expect(() => identityFromIdToken(idToken({ ...good, iss: "evil" }), cfg.clientId, "n1", 0)).toThrow();
    expect(() => identityFromIdToken(idToken({ ...good, email_verified: false }), cfg.clientId, "n1", 0)).toThrow();
  });
});

describe("service account", () => {
  beforeEach(() => clearServiceAccountCache());

  it("signs a valid RS256 JWT assertion and caches the token", async () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    let calls = 0;
    let assertion = "";
    const f = (async (_u: unknown, init?: RequestInit) => {
      calls++;
      assertion = new URLSearchParams(String(init?.body)).get("assertion") ?? "";
      return jsonResponse(200, { access_token: "sa-token", expires_in: 3600 });
    }) as typeof fetch;
    const cfg = { email: "memora@p.iam.gserviceaccount.com", privateKeyPem: pem };
    expect(await serviceAccountToken(cfg, f, 1_000_000)).toBe("sa-token");
    expect(await serviceAccountToken(cfg, f, 1_000_000 + 60_000)).toBe("sa-token");
    expect(calls).toBe(1);

    const [h, b, s] = assertion.split(".");
    const claims = JSON.parse(base64UrlDecodeText(b!)) as Record<string, unknown>;
    expect(claims).toMatchObject({ iss: cfg.email, aud: "https://oauth2.googleapis.com/token" });
    expect(String(claims.scope)).toContain("auth/drive");
    const key = await crypto.subtle.importKey("spki", publicKey.export({ type: "spki", format: "der" }), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, base64UrlDecode(s!), new TextEncoder().encode(`${h}.${b}`));
    expect(ok).toBe(true);
  });

  it("explains an invalid private key", async () => {
    await expect(serviceAccountToken({ email: "x@p.iam.gserviceaccount.com", privateKeyPem: "nope" })).rejects.toMatchObject({ code: "not_configured" });
  });
});

describe("Google Drive", () => {
  it("lists only images in the folder, following pages", async () => {
    const urls: string[] = [];
    const pages = [
      { files: [{ id: "a", name: "a.jpg", mimeType: "image/jpeg" }], nextPageToken: "p2" },
      { files: [{ id: "b", name: "b.jpg", mimeType: "image/jpeg" }] },
    ];
    const f = (async (u: string | URL | Request) => {
      urls.push(String(u));
      return jsonResponse(200, pages[urls.length - 1]);
    }) as typeof fetch;
    const files = await new DriveClient("t", f).listFolderImages("FOLDER_ID_123");
    expect(files.map((x) => x.id)).toEqual(["a", "b"]);
    const q = new URL(urls[0]!).searchParams.get("q");
    expect(q).toBe("'FOLDER_ID_123' in parents and mimeType contains 'image/' and trashed = false");
    expect(new URL(urls[1]!).searchParams.get("pageToken")).toBe("p2");
  });

  it("serves resized images via the thumbnail service, with a fallback to the original", async () => {
    const seen: string[] = [];
    const f = (async (u: string | URL | Request) => {
      seen.push(String(u));
      return String(u).includes("lh3") ? new Response("thumb", { headers: { "content-type": "image/jpeg" } }) : new Response("orig", { headers: { "content-type": "image/png" } });
    }) as typeof fetch;
    const drive = new DriveClient("t", f);
    const withThumb: DriveFile = { id: "abc", name: "x.jpg", mimeType: "image/jpeg", thumbnailLink: "https://lh3.googleusercontent.com/xyz=s220" };
    await drive.imageBytes(withThumb, 2048);
    expect(seen[0]).toBe("https://lh3.googleusercontent.com/xyz=s2048");
    const r = await drive.imageBytes({ id: "abc", name: "x.png", mimeType: "image/png" }, 512);
    expect(seen[1]).toContain("/files/abc?alt=media");
    expect(r.contentType).toBe("image/png");
  });

  it("explains that the folder must be shared with the service account", async () => {
    const f = (async () => jsonResponse(404, {})) as typeof fetch;
    await expect(new DriveClient("t", f).getFile("x")).rejects.toMatchObject({ code: "drive_not_found" });
  });

  it("works out when a photo was taken", () => {
    expect(takenAtFor({ name: "x.jpg", imageMediaMetadata: { time: "2019:07:14 10:30:00" } })?.toISOString()).toBe("2019-07-14T10:30:00.000Z");
    expect(takenAtFor({ name: "IMG_20260905_131358.jpg" })?.getUTCFullYear()).toBe(2026);
    expect(takenAtFor({ name: "holiday.jpg" })).toBeNull();
    expect(takenAtFor({ name: "IMG_20231399_999999.jpg" })).toBeNull();
  });
});

describe("Google Sheets storage", () => {
  it("maps rows both ways, tolerating hand edits", () => {
    const values = rowToValues({ fileId: "f1", title: "Lake", year: 2019, story: "", takenAt: "", hidden: false, addedAt: "t" });
    expect(values).toEqual(["f1", "Lake", 2019, "", "", "FALSE", "t"]);
    expect(valuesToRow(["f1", "Lake", "2019", "Nice", "", "ya"], 5)).toMatchObject({ row: 5, year: 2019, story: "Nice", hidden: true });
    expect(valuesToRow(["", "orphan"], 3)).toBeNull();
    expect(valuesToRow(["f2", "x", "abc"], 4)?.year).toBeNull();
  });

  it("creates the tab with a header on first use", async () => {
    const calls: { url: string; method: string; body?: string }[] = [];
    const f = (async (u: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(u), method: init?.method ?? "GET", body: init?.body ? String(init.body) : undefined });
      return jsonResponse(200, calls.length === 1 ? { sheets: [{ properties: { title: "Sheet1" } }] } : {});
    }) as typeof fetch;
    await new SheetsClient("t", "SHEET", f).ensureTab();
    expect(calls[1]!.body).toContain("addSheet");
    expect(calls[2]!.body).toContain("Drive file id");
  });

  it("explains sharing problems", async () => {
    const f = (async () => jsonResponse(403, {})) as typeof fetch;
    await expect(new SheetsClient("t", "SHEET", f).readRows()).rejects.toMatchObject({ code: "sheet_forbidden" });
  });
});

describe("photo library", () => {
  const file = (id: string, over: Partial<DriveFile> = {}): DriveFile => ({ id, name: `${id}.jpg`, mimeType: "image/jpeg", ...over });
  const t = (f: DriveFile) => (f.name.startsWith("IMG_") ? takenAtFor(f) : null);

  it("adds new Drive photos to the Sheet and keeps existing stories", () => {
    const { photos, newRows } = mergeLibrary(
      [file("IMG_20260905_131358", { name: "IMG_20260905_131358.jpg" }), file("old")],
      [{ row: 2, fileId: "old", title: "Our first trip", year: 2019, story: "We got lost", takenAt: "2019-07-14T00:00:00.000Z", hidden: false, addedAt: "" }],
      t,
      new Date("2026-11-26T00:00:00Z"),
    );
    expect(newRows).toHaveLength(1);
    expect(newRows[0]).toMatchObject({ fileId: "IMG_20260905_131358", title: "Untitled memory", year: 2026, hidden: false });
    // Sorted oldest first.
    expect(photos.map((p) => p.title)).toEqual(["Our first trip", "Untitled memory"]);
    expect(photos[0]!.story).toBe("We got lost");
  });

  it("leaves out hidden photos and files no longer in the folder", () => {
    const { photos, newRows } = mergeLibrary(
      [file("a"), file("b")],
      [
        { row: 2, fileId: "a", title: "A", year: null, story: "", takenAt: "", hidden: true, addedAt: "" },
        { row: 3, fileId: "b", title: "B", year: null, story: "", takenAt: "", hidden: false, addedAt: "" },
        { row: 4, fileId: "gone", title: "Deleted", year: null, story: "", takenAt: "", hidden: false, addedAt: "" },
      ],
      t,
    );
    expect(newRows).toHaveLength(0);
    expect(photos.map((p) => p.id)).toEqual(["b"]);
  });

  it("swaps dimensions for rotated photos", () => {
    const { photos } = mergeLibrary([file("r", { imageMediaMetadata: { width: 4000, height: 3000, rotation: 1 } })], [], () => null);
    expect(photos[0]).toMatchObject({ width: 3000, height: 4000 });
  });

  it("derives friendly titles from filenames", () => {
    expect(titleFromFilename("Bali sunset.jpg")).toBe("Bali sunset");
    expect(titleFromFilename("IMG_20260905_131358.jpg")).toBe("Untitled memory");
    expect(titleFromFilename("IMG-20240101-WA0003.jpg")).toBe("Untitled memory");
    expect(titleFromFilename("family_dinner.jpeg")).toBe("family dinner");
  });

  it("validates edits", () => {
    expect(photoUpdateSchema.parse({ title: "  Lake ", story: "", year: 2019 })).toEqual({ title: "Lake", story: "", year: 2019 });
    expect(photoUpdateSchema.parse({ hidden: true })).toEqual({ hidden: true });
    expect(photoUpdateSchema.safeParse({ title: "" }).success).toBe(false);
    expect(photoUpdateSchema.safeParse({}).success).toBe(false);
  });
});

describe("request safety", () => {
  const post = (headers: Record<string, string>) => new Request("http://localhost:3000/api/photos/x", { method: "PATCH", headers });
  it("rejects cross-site requests", () => {
    expect(() => assertSameOrigin(post({ origin: "https://evil.example" }))).toThrow(expect.objectContaining({ status: 403 }));
    expect(() => assertSameOrigin(post({}))).toThrow(expect.objectContaining({ status: 403 }));
    expect(() => assertSameOrigin(post({ origin: "http://localhost:3000" }))).not.toThrow();
  });
  it("only redirects to same-site paths after login", () => {
    expect(safeNext("/photos")).toBe("/photos");
    expect(safeNext("https://evil.example")).toBe("/photos");
    expect(safeNext("//evil.example")).toBe("/photos");
  });
});
