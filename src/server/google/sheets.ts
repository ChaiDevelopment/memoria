import { ApiError } from "../http";

/**
 * Google Sheets as MEMORA's tiny database (like the Jadwal Piket app).
 * One tab, one row per photo, readable and editable by hand:
 *
 *   A Drive file id | B Title | C Year | D Story | E Taken at | F Hidden | G Added at
 */

export const TAB = "Memories";
export const HEADER = ["Drive file id", "Title", "Year", "Story", "Taken at", "Hidden", "Added at"] as const;
const BASE = "https://sheets.googleapis.com/v4/spreadsheets";

export interface MemoryRow {
  /** 1-based sheet row number (2 = first data row). */
  row: number;
  fileId: string;
  title: string;
  year: number | null;
  story: string;
  takenAt: string;
  hidden: boolean;
  addedAt: string;
}

export type NewMemoryRow = Omit<MemoryRow, "row">;

export function rowToValues(r: NewMemoryRow): (string | number)[] {
  return [r.fileId, r.title, r.year ?? "", r.story, r.takenAt, r.hidden ? "TRUE" : "FALSE", r.addedAt];
}

export function valuesToRow(values: unknown[], row: number): MemoryRow | null {
  const cell = (i: number) => (values[i] === undefined || values[i] === null ? "" : String(values[i]).trim());
  const fileId = cell(0);
  if (!fileId) return null;
  const year = parseInt(cell(2), 10);
  return {
    row,
    fileId,
    title: cell(1),
    year: Number.isFinite(year) ? year : null,
    story: cell(3),
    takenAt: cell(4),
    hidden: /^(true|yes|ya|1|x)$/i.test(cell(5)),
    addedAt: cell(6),
  };
}

export class SheetsClient {
  constructor(
    private readonly token: string,
    private readonly sheetId: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private async call(path: string, init: RequestInit = {}): Promise<unknown> {
    const res = await this.fetchImpl(`${BASE}/${encodeURIComponent(this.sheetId)}${path}`, {
      ...init,
      headers: { authorization: `Bearer ${this.token}`, ...(init.body ? { "content-type": "application/json" } : {}) },
    });
    const data: unknown = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = (data as { error?: { message?: string } }).error?.message;
      if (res.status === 404) throw new ApiError(404, "sheet_not_found", "MEMORA can't find the Google Sheet. Check SHEET_ID.");
      if (res.status === 403) {
        throw new ApiError(503, "sheet_forbidden", "MEMORA can't edit the Google Sheet. Share it with the service account email as Editor, and enable the Google Sheets API.");
      }
      throw new ApiError(502, "sheet_error", `Google Sheets returned an error (HTTP ${res.status})${message ? `: ${message}` : ""}.`);
    }
    return data;
  }

  /** Creates the tab and header row the first time. */
  async ensureTab(): Promise<void> {
    const meta = (await this.call("?fields=sheets.properties.title")) as { sheets?: { properties?: { title?: string } }[] };
    if (meta.sheets?.some((s) => s.properties?.title === TAB)) return;
    await this.call(":batchUpdate", {
      method: "POST",
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: TAB, gridProperties: { frozenRowCount: 1 } } } }] }),
    });
    await this.call(`/values/${encodeURIComponent(`${TAB}!A1:G1`)}?valueInputOption=RAW`, {
      method: "PUT",
      body: JSON.stringify({ values: [HEADER] }),
    });
  }

  async readRows(): Promise<MemoryRow[]> {
    const data = (await this.call(`/values/${encodeURIComponent(`${TAB}!A2:G`)}?valueRenderOption=UNFORMATTED_VALUE`)) as { values?: unknown[][] };
    return (data.values ?? []).map((v, i) => valuesToRow(v, i + 2)).filter((r): r is MemoryRow => r !== null);
  }

  /** Raw rows of another tab (A2:<lastCol>), or [] when the tab doesn't exist. */
  async readTab(tab: string, lastCol = "D"): Promise<unknown[][]> {
    const meta = (await this.call("?fields=sheets.properties.title")) as { sheets?: { properties?: { title?: string } }[] };
    if (!meta.sheets?.some((s) => s.properties?.title === tab)) return [];
    const data = (await this.call(`/values/${encodeURIComponent(`${tab}!A2:${lastCol}`)}?valueRenderOption=FORMATTED_VALUE`)) as { values?: unknown[][] };
    return data.values ?? [];
  }

  /** Creates `tab` with a header row if it doesn't exist yet. */
  async ensureNamedTab(tab: string, header: readonly string[]): Promise<void> {
    const meta = (await this.call("?fields=sheets.properties.title")) as { sheets?: { properties?: { title?: string } }[] };
    if (meta.sheets?.some((s) => s.properties?.title === tab)) return;
    await this.call(":batchUpdate", {
      method: "POST",
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: tab, gridProperties: { frozenRowCount: 1 } } } }] }),
    });
    await this.call(`/values/${encodeURIComponent(`${tab}!A1`)}?valueInputOption=RAW`, { method: "PUT", body: JSON.stringify({ values: [header] }) });
  }

  /** Appends plain-text rows (RAW: never interpreted as formulas). */
  async appendToTab(tab: string, rows: (string | number)[][], lastCol = "D"): Promise<void> {
    await this.call(`/values/${encodeURIComponent(`${tab}!A:${lastCol}`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
      method: "POST",
      body: JSON.stringify({ values: rows }),
    });
  }

  /** Overwrites one row of a tab (plain text, never formulas). `row` is 1-based. */
  async updateTabRow(tab: string, row: number, values: (string | number)[], lastCol: string): Promise<void> {
    await this.call(`/values/${encodeURIComponent(`${tab}!A${row}:${lastCol}${row}`)}?valueInputOption=RAW`, {
      method: "PUT",
      body: JSON.stringify({ values: [values] }),
    });
  }

  async appendRows(rows: NewMemoryRow[]): Promise<void> {
    if (rows.length === 0) return;
    await this.call(`/values/${encodeURIComponent(`${TAB}!A:G`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
      method: "POST",
      body: JSON.stringify({ values: rows.map(rowToValues) }),
    });
  }

  async updateRow(row: MemoryRow): Promise<void> {
    await this.call(`/values/${encodeURIComponent(`${TAB}!A${row.row}:G${row.row}`)}?valueInputOption=RAW`, {
      method: "PUT",
      body: JSON.stringify({ values: [rowToValues(row)] }),
    });
  }
}
