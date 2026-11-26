/** Browser-side helper for MEMORA's JSON API. */

export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields: Record<string, string> = {},
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export async function api<T>(path: string, init: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: init.method ?? (init.body === undefined ? "GET" : "POST"),
      headers: init.body === undefined ? undefined : { "content-type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      credentials: "same-origin",
      signal: init.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiClientError(0, "network", "Can't reach the server. Check your connection and try again.");
  }
  const data = (await res.json().catch(() => null)) as (T & { error?: { code: string; message: string; fields?: Record<string, string> } }) | null;
  if (!res.ok) {
    const e = data?.error;
    throw new ApiClientError(res.status, e?.code ?? "http_error", e?.message ?? `Request failed (HTTP ${res.status}).`, e?.fields);
  }
  return data as T;
}
