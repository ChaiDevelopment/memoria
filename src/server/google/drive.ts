import { z } from "zod";
import { ApiError } from "../http";

/**
 * Reads the museum's Google Drive folder with the service account.
 * Images are served through Drive's own thumbnail service, which resizes
 * and applies phone rotation (and converts HEIC to JPEG) — so the server
 * needs no image library.
 */

const BASE = "https://www.googleapis.com/drive/v3/files";

const fileSchema = z.object({
  id: z.string(),
  name: z.string().default(""),
  mimeType: z.string(),
  createdTime: z.string().optional(),
  parents: z.array(z.string()).optional(),
  thumbnailLink: z.string().optional(),
  imageMediaMetadata: z
    .object({ width: z.number().optional(), height: z.number().optional(), time: z.string().optional(), rotation: z.number().optional() })
    .partial()
    .optional(),
});
export type DriveFile = z.infer<typeof fileSchema>;

const listSchema = z.object({ files: z.array(fileSchema).default([]), nextPageToken: z.string().optional() });
const FIELDS = "id,name,mimeType,createdTime,parents,thumbnailLink,imageMediaMetadata(width,height,time,rotation)";

export class DriveClient {
  constructor(
    private readonly token: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private async get(url: string): Promise<Response> {
    const res = await this.fetchImpl(url, { headers: { authorization: `Bearer ${this.token}` } });
    if (res.ok) return res;
    const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw driveError(res.status, data.error?.message);
  }

  /** All images directly inside the folder (paginated, newest first). */
  async listFolderImages(folderId: string, max = 2000): Promise<DriveFile[]> {
    const files: DriveFile[] = [];
    let pageToken: string | undefined;
    do {
      const params = new URLSearchParams({
        q: `'${folderId.replace(/'/g, "")}' in parents and mimeType contains 'image/' and trashed = false`,
        fields: `nextPageToken,files(${FIELDS})`,
        pageSize: "1000",
        orderBy: "createdTime desc",
        supportsAllDrives: "true",
        includeItemsFromAllDrives: "true",
      });
      if (pageToken) params.set("pageToken", pageToken);
      const page = listSchema.parse(await (await this.get(`${BASE}?${params}`)).json());
      files.push(...page.files);
      pageToken = page.nextPageToken;
    } while (pageToken && files.length < max);
    return files;
  }

  async getFile(fileId: string): Promise<DriveFile> {
    const params = new URLSearchParams({ fields: FIELDS, supportsAllDrives: "true" });
    return fileSchema.parse(await (await this.get(`${BASE}/${encodeURIComponent(fileId)}?${params}`)).json());
  }

  /**
   * Image bytes at roughly `size` px on the long edge, via Drive's thumbnail
   * service; falls back to the original file if no thumbnail exists yet
   * (Drive generates them shortly after upload).
   */
  async imageBytes(file: DriveFile, size: number): Promise<{ body: ReadableStream<Uint8Array> | null; contentType: string }> {
    if (file.thumbnailLink) {
      const sized = file.thumbnailLink.replace(/=s\d+(-[a-z]+)?$/, "") + `=s${size}`;
      const res = await this.fetchImpl(sized, { headers: { authorization: `Bearer ${this.token}` } });
      if (res.ok) return { body: res.body, contentType: res.headers.get("content-type") ?? "image/jpeg" };
    }
    const res = await this.get(`${BASE}/${encodeURIComponent(file.id)}?alt=media&supportsAllDrives=true`);
    return { body: res.body, contentType: res.headers.get("content-type") ?? file.mimeType };
  }
}

function driveError(status: number, message?: string): ApiError {
  if (status === 404) {
    return new ApiError(
      404,
      "drive_not_found",
      "MEMORA can't see the Drive folder or file. Share the folder with the service account email (Viewer is enough).",
    );
  }
  if (status === 403) {
    return new ApiError(503, "drive_forbidden", `Google Drive refused access${message ? `: ${message}` : ""}. Is the Google Drive API enabled for the project?`);
  }
  if (status === 429) return new ApiError(503, "google_rate_limited", "Google is rate-limiting requests. Please wait a minute.");
  return new ApiError(502, "drive_error", `Google Drive returned an error (HTTP ${status})${message ? `: ${message}` : ""}.`);
}

/**
 * Best-effort "when was this photo taken": EXIF time, then a camera-style
 * filename (IMG_20260905_131358.jpg). Drive's upload date is ignored — it
 * says when the file reached Drive, not when the memory happened.
 */
export function takenAtFor(file: Pick<DriveFile, "name" | "imageMediaMetadata">): Date | null {
  const exif = file.imageMediaMetadata?.time?.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  const fromName = file.name.match(/(?:^|[^\d])(20\d{2}|19\d{2})(\d{2})(\d{2})[_-]?(\d{2})(\d{2})(\d{2})/);
  const m = exif ?? fromName;
  if (!m) return null;
  const [y, mo, d, h, mi, s] = m.slice(1, 7).map(Number) as [number, number, number, number, number, number];
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 59) return null;
  const date = new Date(Date.UTC(y, mo - 1, d, h, mi, s));
  return Number.isNaN(date.getTime()) || y < 1900 || date.getTime() > Date.now() + 86_400_000 ? null : date;
}
