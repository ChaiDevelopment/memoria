# MEMORA — Backend: Google sign-in, Drive photos, Sheets data

MEMORA is built for a small, invited group (e.g. a couple). It needs **no
database and no file storage service**:

| Concern | Where it lives |
| --- | --- |
| Who can enter | `ALLOWED_EMAILS` (a list of Google accounts) |
| Sign-in | "Sign in with Google" (OpenID Connect + PKCE, identity scopes only) |
| Session | Signed cookie (HMAC-SHA256, `SESSION_SECRET`), 30 days, nothing stored server-side |
| Photos | A shared **Google Drive folder**: drop photos in and they appear |
| Titles, years, stories | A **Google Sheet** (tab `Memories`), editable by hand |
| Server access to Drive/Sheets | A Google **service account** (a robot account of your Cloud project) |

Everything uses standard web APIs (`fetch`, Web Crypto), so the same code runs
on Node and on Cloudflare Workers.

## How it works

* `GET /api/photos` lists the images in the Drive folder, joins them with the
  Sheet rows, and appends a row for any new photo. The title comes from the
  filename; the year comes from EXIF or a camera filename like
  `IMG_20260905_131358.jpg`.
* `GET /api/photos/:id/image?size=thumb|display` streams the image via Drive's
  thumbnail service, which handles resizing, phone rotation and HEIC. Only
  files inside the museum folder are served, even though the service account
  might be able to see other files.
* `PATCH /api/photos/:id` `{ title?, year?, story?, hidden? }` updates the
  Sheet row. "Hide" keeps the file in Drive; set `Hidden` back to FALSE in the
  Sheet to restore it.
* The Sheet tab and its header row are created automatically on first use.

## Security notes
* Removing an email from `ALLOWED_EMAILS` revokes access on the next request
  (the allow-list is checked on every request, not only at sign-in).
* The Google ID token is checked for issuer, audience, expiry, nonce and a
  verified email. State and PKCE protect the sign-in redirect.
* State-changing requests require a same-origin `Origin` and a JSON body.
  Cookies are `HttpOnly`, `SameSite=Lax`, and `Secure` on https.
* Users never grant MEMORA access to their own Drive. Only the service
  account reads the shared folder.

## Google Cloud setup (the Jadwal Piket project can be reused)

1. **APIs & Services → Library:** enable **Google Drive API** and **Google Sheets API**.
2. **OAuth consent screen:** add the scopes `openid`, `email` and `profile`.
   These are non-sensitive, so you can set *Publishing status* to **In
   production** without a review, and sign-ins won't expire weekly.
3. **Credentials → OAuth client ID → Web application.** Add an authorized
   redirect URI for every URL you use:
   * `http://localhost:3000/api/auth/callback`
   * `https://<worker>.<subdomain>.workers.dev/api/auth/callback`
4. **IAM & Admin → Service accounts → Create.** No roles are needed. Then go to
   **Keys → Add key → JSON** and keep the file safe.
5. In Google Drive, **share the photo folder** with the service account email
   as **Viewer**.
6. Create an empty **Google Sheet** and share it with the service account
   email as **Editor**.

## Configuration

| Variable | Example / where to find it |
| --- | --- |
| `APP_URL` | `https://memora.<subdomain>.workers.dev` |
| `SESSION_SECRET` | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `ALLOWED_EMAILS` | `you@gmail.com,partner@gmail.com` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth Web client |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | `client_email` in the JSON key |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | `private_key` in the JSON key (the whole PEM, `\n` included) |
| `DRIVE_FOLDER_ID` | from `drive.google.com/drive/folders/<ID>` |
| `SHEET_ID` | from `docs.google.com/spreadsheets/d/<ID>/edit` |

For local development, put these in `.env.local`. On Cloudflare, add them as
**secrets**, as described below.

## Deploying to Cloudflare Workers (Workers Builds, from GitHub)

The build uses `@opennextjs/cloudflare`, which must run on Linux. Cloudflare's
own build machines do, so you don't need to build on Windows.

1. Cloudflare dashboard → **Workers & Pages → Create → Import a repository**,
   and choose this GitHub repo.
2. Settings:
   * **Project/Worker name:** `memora`. It must match `name` in `wrangler.jsonc`.
   * **Build command:** `npx opennextjs-cloudflare build`
   * **Deploy command:** `npx opennextjs-cloudflare deploy`
   * Node version comes from `.node-version` (22).
3. After the first deploy, open the Worker → **Settings → Variables and
   Secrets** and add every variable from the table above as a **Secret**. Then
   redeploy, or push any commit.
4. Add `https://<your worker URL>/api/auth/callback` to the OAuth client's
   redirect URIs, and set `APP_URL` to the worker URL.

Every push to the main branch redeploys automatically.
