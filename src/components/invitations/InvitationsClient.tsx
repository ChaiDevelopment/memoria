"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiClientError } from "@/lib/apiClient";
import { DEFAULT_DETAILS, InvitationForm, type DetailsInput, type FormSubmit } from "./InvitationForm";
import { DEFAULT_MUSEUM, MuseumForm, type MuseumInput, type MuseumSubmit } from "./MuseumForm";

interface Seat {
  taken: boolean;
  you: boolean;
}
interface OwnerBase {
  keyword: string;
  title: string;
  published: boolean;
  created: string;
  /** Null until the folder has been made in the creator's Drive. */
  folderUrl: string | null;
  myRole: "bride" | "groom" | null;
  seats: { bride: Seat; groom: Seat };
  openSeat: "bride" | "groom" | null;
  pairLinkActive: boolean;
}
export type OwnerWedding = OwnerBase & { theme: "wedding"; details: DetailsInput };
export type OwnerMuseum = OwnerBase & { theme: "museum"; details: MuseumInput };
/** A world on the dashboard: a wedding invitation or a memory museum. */
export type OwnerInvitation = OwnerWedding | OwnerMuseum;

type Theme = OwnerInvitation["theme"];
type View = { kind: "list" } | { kind: "pick" } | { kind: "create"; theme: Theme } | { kind: "edit"; keyword: string } | { kind: "created"; keyword: string } | { kind: "folder-error"; keyword: string; reason: string };

const driveUrl = (keyword: string) => `/api/invitations/${encodeURIComponent(keyword)}/drive`;
const FOLDER_ERRORS: Record<string, string> = {
  cancelled: "Izin Google Drive dibatalkan, jadi folder fotonya belum dibuat.",
  denied: "Akses Google Drive belum diizinkan. Centang izin Google Drive di halaman Google, lalu coba lagi.",
  wrong_account: "Akun Google yang dipilih berbeda dengan akun MEMORA-mu. Coba lagi dengan akun yang sama.",
  expired: "Waktunya habis. Coba lagi.",
  failed: "Folder belum berhasil dibuat di Google Drive. Coba lagi sebentar.",
};

const message = (err: unknown, fallback: string) => (err instanceof ApiClientError && err.status > 0 && err.status < 500 ? err.message : fallback);

/** "World Saya": create worlds (a memory museum or a wedding invitation), fill them in and share them with guests. */
export function InvitationsClient({ userName }: { userName: string }) {
  const [list, setList] = useState<OwnerInvitation[] | null>(null);
  const [view, setView] = useState<View>({ kind: "list" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api<{ invitations: OwnerInvitation[] }>("/api/invitations");
      setList(r.invitations);
      setLoadError(null);
    } catch (err) {
      setLoadError(message(err, "World-mu belum bisa dimuat. Coba muat ulang halaman."));
    }
  }, []);
  useEffect(() => {
    void load();
    // Back from Google: the folder was made (or not) in the creator's Drive.
    const q = new URLSearchParams(window.location.search);
    const folder = q.get("folder");
    const error = q.get("folder_error");
    if (folder) setView(error ? { kind: "folder-error", keyword: folder, reason: error } : { kind: "created", keyword: folder });
    if (folder || error) window.history.replaceState(null, "", "/invitations");
  }, [load]);

  const replace = (inv: OwnerInvitation) => setList((l) => (l ? [inv, ...l.filter((x) => x.keyword !== inv.keyword)] : [inv]));

  const create = async (v: (FormSubmit | MuseumSubmit) & { theme: Theme }) => {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ invitation: OwnerInvitation }>("/api/invitations", { body: v });
      replace(r.invitation);
      // Next: Google asks the creator to let MEMORA make the photo folder in their own Drive.
      window.location.href = driveUrl(r.invitation.keyword);
      return;
    } catch (err) {
      setError(message(err, "World belum berhasil dibuat. Coba lagi sebentar."));
    } finally {
      setBusy(false);
    }
  };

  const save = async (keyword: string, v: { details: unknown }) => {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ invitation: OwnerInvitation }>(`/api/invitations/${encodeURIComponent(keyword)}`, { method: "PATCH", body: { details: v.details } });
      replace(r.invitation);
      setView({ kind: "list" });
    } catch (err) {
      setError(message(err, "Perubahan belum tersimpan. Coba lagi."));
    } finally {
      setBusy(false);
    }
  };

  const cancel = () => (setView({ kind: "list" }), setError(null));
  if (view.kind === "pick") {
    return (
      <div>
        <Heading title="Buat world baru" sub="Pilih tema dunia 3D-mu. Keduanya bisa dikunjungi tamu dengan satu kata kunci." />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <ThemeCard emoji="🏛️" title="Museum Kenangan" desc="Grand Museum 3D berisi foto-fotomu, lengkap dengan aula yang bertambah sendiri, Buku Tamu, dan jalan-jalan bersama." onClick={() => setView({ kind: "create", theme: "museum" })} testId="pick-museum" />
          <ThemeCard emoji="💍" title="Undangan Pernikahan" desc="Venue taman atau ballroom, galeri prewedding, info acara, RSVP, amplop digital, Ucapan & Doa, dan baju pengantin." onClick={() => setView({ kind: "create", theme: "wedding" })} testId="pick-wedding" />
        </div>
        <button type="button" onClick={cancel} className="mt-6 text-sm text-ivory/60 hover:text-ivory">
          ← Kembali
        </button>
      </div>
    );
  }
  if (view.kind === "create") {
    return view.theme === "museum" ? (
      <div>
        <Heading title="Buat Museum Kenangan" sub="Beri nama dan kata kunci — foto-fotonya kamu upload ke Google Drive-mu sesudahnya." />
        <MuseumForm mode="create" initial={DEFAULT_MUSEUM} busy={busy} error={error} onSubmit={(v) => create({ ...v, theme: "museum" })} onCancel={() => setView({ kind: "pick" })} />
      </div>
    ) : (
      <div>
        <Heading title="Buat undangan pernikahan" sub="Isi seperlunya dulu — semua bisa diubah nanti." />
        <InvitationForm mode="create" initial={DEFAULT_DETAILS} busy={busy} error={error} onSubmit={(v) => create({ ...v, theme: "wedding" })} onCancel={() => setView({ kind: "pick" })} />
      </div>
    );
  }
  if (view.kind === "edit") {
    const inv = list?.find((i) => i.keyword === view.keyword);
    if (inv) {
      return (
        <div>
          <Heading title={inv.theme === "museum" ? "Ubah museum" : "Ubah undangan"} sub={inv.title} />
          {inv.theme === "museum" ? (
            <MuseumForm mode="edit" initial={inv.details} busy={busy} error={error} onSubmit={(v) => save(inv.keyword, v)} onCancel={cancel} />
          ) : (
            <InvitationForm mode="edit" initial={inv.details} busy={busy} error={error} onSubmit={(v) => save(inv.keyword, v)} onCancel={cancel} />
          )}
        </div>
      );
    }
  }

  const created = view.kind === "created" ? list?.find((i) => i.keyword === view.keyword) : undefined;
  return (
    <div className="flex flex-col gap-6">
      {created && <CreatedNotice inv={created} onClose={() => setView({ kind: "list" })} />}
      {view.kind === "folder-error" && (
        <div className="step-in rounded-3xl border border-ember/40 bg-ember/10 p-5" role="alert" data-testid="folder-error">
          <p className="font-display text-xl">Folder foto belum dibuat</p>
          <p className="mt-1 text-sm text-ivory/75">{FOLDER_ERRORS[view.reason] ?? FOLDER_ERRORS.failed} World-mu sudah tersimpan.</p>
          <a href={driveUrl(view.keyword)} className="primary-button mt-4 inline-flex">
            Coba lagi: buat folder di Google Drive
          </a>
        </div>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Heading title="World Saya" sub={`Halo, ${userName}! Buat museum kenangan atau undangan pernikahan 3D, lalu bagikan ke tamu dengan satu kata kunci.`} />
        <button type="button" onClick={() => (setView({ kind: "pick" }), setError(null))} className="primary-button" data-testid="new-invitation">
          + Buat world
        </button>
      </div>
      {loadError && <p className="rounded-xl border border-ember/40 bg-ember/10 px-3 py-2 text-sm">{loadError}</p>}
      {list === null && !loadError && <p className="text-sm text-ivory/50">Memuat…</p>}
      {list?.length === 0 && (
        <div className="account-card rounded-3xl p-8 text-center">
          <p className="font-display text-2xl">Belum ada world</p>
          <p className="mt-2 text-sm text-ivory/60">Klik “Buat world” untuk mulai: museum kenangan atau undangan pernikahan. Atau buka Link Pasangan dari pasanganmu untuk bergabung ke undangannya.</p>
        </div>
      )}
      {list?.map((inv) =>
        inv.theme === "museum" ? (
          <MuseumCard key={inv.keyword} inv={inv} userName={userName} onChange={replace} onEdit={() => (setView({ kind: "edit", keyword: inv.keyword }), setError(null))} />
        ) : (
          <InvitationCard key={inv.keyword} inv={inv} userName={userName} onChange={replace} onEdit={() => (setView({ kind: "edit", keyword: inv.keyword }), setError(null))} />
        ),
      )}
    </div>
  );
}

function Heading({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-2">
      <h1 className="font-display text-3xl sm:text-4xl">{title}</h1>
      <p className="mt-1 text-sm text-ivory/60">{sub}</p>
    </div>
  );
}

/** Shown when Google brings the creator back: the folder is in their own My Drive. */
function CreatedNotice({ inv, onClose }: { inv: OwnerInvitation; onClose: () => void }) {
  return (
    <div className="step-in rounded-3xl border border-gold/40 bg-gold/10 p-5 sm:p-6" role="status" data-testid="created-notice">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">{inv.theme === "museum" ? "Museum dibuat" : "Undangan dibuat"} ✨</p>
      <h2 className="mt-1 font-display text-2xl">Folder {inv.theme === "museum" ? "museum" : "undangan"}mu sudah siap</h2>
      <ol className="mt-4 flex list-decimal flex-col gap-2 pl-5 text-sm text-ivory/80">
        <li>
          {inv.folderUrl ? (
            <a href={inv.folderUrl} target="_blank" rel="noreferrer" className="text-gold underline-offset-4 hover:underline">
              Buka folder Google Drive
            </a>
          ) : (
            "Buka folder Google Drive"
          )}{" "}
          {inv.theme === "museum" ? " lalu upload foto-fotomu (JPG/PNG). Foto langsung terpajang di museum, dari yang terlama." : " lalu upload foto-foto prewedding (JPG/PNG). Foto langsung muncul di bingkai venue 3D."}
        </li>
        {inv.theme === "wedding" && <li>Buat Link Pasangan di bawah dan kirim ke pasanganmu, supaya kalian berdua tampil sebagai pengantin.</li>}
        <li>
          Bagikan link <span className="font-mono text-ivory">/w/{inv.keyword}</span> ke para tamu.
        </li>
      </ol>
      <p className="mt-3 text-xs text-ivory/55">Folder “MEMORA · {inv.title}” ada di My Drive milikmu sendiri. MEMORA hanya bisa membuka folder yang dibuatnya ini — tidak bisa melihat isi Drive-mu yang lain.</p>
      <button type="button" onClick={onClose} className="mt-4 text-xs text-ivory/60 hover:text-ivory">
        Tutup
      </button>
    </div>
  );
}

function CopyField({ label, value, testId }: { label: string; value: string; testId?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-ivory/55">{label}</span>
      <div className="flex gap-2">
        <input readOnly value={value} className="account-input font-mono text-sm" onFocus={(e) => e.target.select()} data-testid={testId} />
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard?.writeText(value).catch(() => undefined);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          }}
          className="shrink-0 rounded-full border border-ivory/15 px-4 text-sm text-ivory/80 hover:border-gold/60 hover:text-gold"
        >
          {copied ? "Tersalin" : "Salin"}
        </button>
      </div>
    </div>
  );
}

function InvitationCard({ inv, userName, onChange, onEdit }: { inv: OwnerWedding; userName: string; onChange: (i: OwnerInvitation) => void; onEdit: () => void }) {
  const [pairLink, setPairLink] = useState<string | null>(null);
  const [guest, setGuest] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const share = `${origin}/w/${inv.keyword}`;
  const d = inv.details;
  const firstEvent = d.events[0];

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(message(err, "Belum berhasil. Coba lagi."));
    } finally {
      setBusy(null);
    }
  };

  const makePairLink = () =>
    run("pair", async () => {
      const r = await api<{ link: string }>(`/api/invitations/${encodeURIComponent(inv.keyword)}/partner`, { body: {} });
      setPairLink(r.link);
      onChange({ ...inv, pairLinkActive: true });
    });
  const resetPartner = () =>
    run("reset", async () => {
      if (!window.confirm("Kosongkan kursi pasangan? Link pasangan lama juga tidak berlaku lagi.")) return;
      const r = await api<{ invitation: OwnerInvitation }>(`/api/invitations/${encodeURIComponent(inv.keyword)}/partner`, { method: "DELETE", body: {} });
      setPairLink(null);
      onChange(r.invitation);
    });
  const togglePublished = () =>
    run("publish", async () => {
      const r = await api<{ invitation: OwnerInvitation }>(`/api/invitations/${encodeURIComponent(inv.keyword)}`, { method: "PATCH", body: { published: !inv.published } });
      onChange(r.invitation);
    });
  const enter = () =>
    run("enter", async () => {
      const mine = inv.myRole === "bride" ? d.brideName : inv.myRole === "groom" ? d.groomName : userName;
      await api("/api/world/join", { body: { keyword: inv.keyword, name: mine || userName } });
      window.location.href = "/";
    });

  const partnerRole = inv.myRole === "bride" ? "groom" : "bride";
  const partnerSeat = inv.seats[partnerRole];

  return (
    <article className="account-card rounded-3xl p-5 sm:p-6" data-testid={`invitation-${inv.keyword}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">{d.setting === "indoor" ? "Ballroom indoor" : "Taman outdoor"}</p>
          <h2 className="mt-1 font-display text-2xl">{inv.title}</h2>
          {firstEvent?.date && (
            <p className="mt-1 text-sm text-ivory/60">
              {firstEvent.label} · {new Date(`${firstEvent.date}T00:00:00`).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
          )}
        </div>
        <span className={`rounded-full px-3 py-1 text-xs ${inv.published ? "bg-gold/15 text-gold" : "bg-ivory/10 text-ivory/60"}`}>{inv.published ? "Terbuka untuk tamu" : "Ditutup"}</span>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <CopyField label="Link undangan" value={share} testId="share-link" />
        <CopyField label="Kata kunci" value={inv.keyword} />
      </div>
      <div className="mt-4 flex flex-col gap-1.5">
        <label htmlFor={`to-${inv.keyword}`} className="text-xs font-semibold uppercase tracking-[0.14em] text-ivory/55">
          Link pribadi per tamu
        </label>
        <input id={`to-${inv.keyword}`} className="account-input" value={guest} maxLength={24} onChange={(e) => setGuest(e.target.value)} placeholder="Tulis nama tamu, misalnya Pak Budi" />
        {guest.trim() && <CopyField label="Tamu langsung disambut dengan namanya" value={`${share}?to=${encodeURIComponent(guest.trim())}`} />}
      </div>

      <div className="mt-6 rounded-2xl border border-ivory/10 p-4">
        <p className="text-sm font-semibold">Pengantin</p>
        <ul className="mt-2 flex flex-col gap-1 text-sm text-ivory/75">
          <li>
            🤵 {d.groomName || "Mempelai pria"} — {inv.seats.groom.taken ? (inv.seats.groom.you ? "akunmu (terkunci)" : "terkunci ✓") : "belum bergabung"}
          </li>
          <li>
            👰 {d.brideName || "Mempelai wanita"} — {inv.seats.bride.taken ? (inv.seats.bride.you ? "akunmu (terkunci)" : "terkunci ✓") : "belum bergabung"}
          </li>
        </ul>
        {inv.openSeat ? (
          <div className="mt-3 flex flex-col gap-3">
            {pairLink ? (
              <>
                <CopyField label="Link Pasangan (sekali pakai)" value={pairLink} testId="pair-link" />
                <p className="text-xs text-ivory/55">Kirim link ini lewat WhatsApp ke pasanganmu. Setelah dia membukanya dan masuk dengan Google, kursinya terkunci dan link ini tidak berlaku lagi.</p>
              </>
            ) : (
              <button type="button" onClick={makePairLink} disabled={busy === "pair"} className="self-start rounded-full border border-gold/50 px-4 py-2 text-sm text-gold hover:bg-gold/10 disabled:opacity-60" data-testid="make-pair-link">
                {busy === "pair" ? "Membuat…" : inv.pairLinkActive ? "Buat Link Pasangan baru" : "Buat Link Pasangan"}
              </button>
            )}
          </div>
        ) : null}
        {partnerSeat.taken && inv.myRole && (
          <button type="button" onClick={resetPartner} disabled={busy === "reset"} className="mt-3 text-xs text-ivory/50 underline-offset-4 hover:text-ember hover:underline">
            Salah akun? Kosongkan kursi pasangan
          </button>
        )}
      </div>

      <RsvpSummary keyword={inv.keyword} />

      {error && (
        <p role="alert" className="mt-4 rounded-xl border border-ember/40 bg-ember/10 px-3 py-2 text-sm">
          {error}
        </p>
      )}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button type="button" onClick={enter} disabled={busy === "enter" || !inv.published} className="primary-button disabled:opacity-60" data-testid="enter-invitation">
          {busy === "enter" ? "Membuka…" : "Masuk ke venue 3D"}
        </button>
        {inv.folderUrl ? (
          <a href={inv.folderUrl} target="_blank" rel="noreferrer" className="rounded-full border border-ivory/15 px-4 py-2.5 text-sm text-ivory/80 hover:border-gold/60 hover:text-gold">
            Folder foto
          </a>
        ) : (
          <a href={driveUrl(inv.keyword)} className="rounded-full border border-gold/50 px-4 py-2.5 text-sm text-gold hover:bg-gold/10" data-testid="make-folder">
            📁 Buat folder di Google Drive-mu
          </a>
        )}
        <button type="button" onClick={onEdit} className="rounded-full border border-ivory/15 px-4 py-2.5 text-sm text-ivory/80 hover:border-gold/60 hover:text-gold" data-testid="edit-invitation">
          Ubah detail
        </button>
        <button type="button" onClick={togglePublished} disabled={busy === "publish"} className="ml-auto text-xs text-ivory/50 underline-offset-4 hover:text-ivory hover:underline">
          {inv.published ? "Tutup sementara untuk tamu" : "Buka lagi untuk tamu"}
        </button>
      </div>
    </article>
  );
}

interface RsvpGuest {
  name: string;
  attending: boolean;
  count: number;
  time: string;
}

/** Who is coming: totals, and the list of guests who answered. */
function RsvpSummary({ keyword }: { keyword: string }) {
  const [data, setData] = useState<{ summary: { attendingGuests: number; attendingPeople: number; notAttending: number }; guests: RsvpGuest[] } | null>(null);
  const [open, setOpen] = useState(false);
  const load = useCallback(() => {
    api<NonNullable<typeof data>>(`/api/invitations/${encodeURIComponent(keyword)}/rsvp`)
      .then(setData)
      .catch(() => undefined);
  }, [keyword]);
  useEffect(load, [load]);
  if (!data) return null;
  const { summary, guests } = data;
  return (
    <div className="mt-4 rounded-2xl border border-ivory/10 p-4" data-testid="rsvp-summary">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
        <p className="text-sm font-semibold">Konfirmasi kehadiran</p>
        <p className="text-sm text-gold">
          Hadir: {summary.attendingPeople} orang <span className="text-ivory/50">({summary.attendingGuests} tamu)</span>
        </p>
        <p className="text-sm text-ivory/65">Tidak hadir: {summary.notAttending}</p>
        <button type="button" onClick={load} className="ml-auto text-xs text-ivory/50 hover:text-ivory">
          Muat ulang
        </button>
      </div>
      {guests.length > 0 && (
        <button type="button" onClick={() => setOpen((v) => !v)} className="mt-2 text-xs text-gold underline-offset-4 hover:underline">
          {open ? "Sembunyikan daftar" : `Lihat daftar (${guests.length})`}
        </button>
      )}
      {open && (
        <ul className="mt-2 flex max-h-64 flex-col gap-1 overflow-y-auto text-sm">
          {guests.map((g, i) => (
            <li key={i} className="flex items-center justify-between rounded-lg bg-ivory/5 px-3 py-1.5">
              <span>{g.name}</span>
              <span className={g.attending ? "text-gold" : "text-ivory/50"}>{g.attending ? `Hadir · ${g.count} orang` : "Tidak hadir"}</span>
            </li>
          ))}
        </ul>
      )}
      {guests.length === 0 && <p className="mt-1 text-xs text-ivory/50">Belum ada tamu yang mengonfirmasi.</p>}
    </div>
  );
}

function ThemeCard({ emoji, title, desc, onClick, testId }: { emoji: string; title: string; desc: string; onClick: () => void; testId: string }) {
  return (
    <button type="button" onClick={onClick} className="account-card group rounded-3xl p-6 text-left transition-transform hover:-translate-y-0.5" data-testid={testId}>
      <span className="text-4xl">{emoji}</span>
      <span className="mt-3 block font-display text-2xl text-ivory group-hover:text-gold">{title}</span>
      <span className="mt-2 block text-sm leading-relaxed text-ivory/60">{desc}</span>
      <span className="mt-4 inline-block text-sm text-gold">Pilih →</span>
    </button>
  );
}

/** A memory museum world: share it, fill its folder, enter it as its host. */
function MuseumCard({ inv, userName, onChange, onEdit }: { inv: OwnerMuseum; userName: string; onChange: (i: OwnerInvitation) => void; onEdit: () => void }) {
  const [guest, setGuest] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const share = `${origin}/w/${inv.keyword}`;
  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(message(err, "Belum berhasil. Coba lagi."));
    } finally {
      setBusy(null);
    }
  };
  const enter = () =>
    run("enter", async () => {
      await api("/api/world/join", { body: { keyword: inv.keyword, name: userName } });
      window.location.href = "/";
    });
  const togglePublished = () =>
    run("publish", async () => {
      const r = await api<{ invitation: OwnerInvitation }>(`/api/invitations/${encodeURIComponent(inv.keyword)}`, { method: "PATCH", body: { published: !inv.published } });
      onChange(r.invitation);
    });
  return (
    <article className="account-card rounded-3xl p-5 sm:p-6" data-testid={`invitation-${inv.keyword}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">🏛️ Museum Kenangan</p>
          <h2 className="mt-1 font-display text-2xl">{inv.title}</h2>
          {inv.details.welcome && <p className="mt-1 max-w-xl text-sm text-ivory/60">{inv.details.welcome}</p>}
        </div>
        <span className={`rounded-full px-3 py-1 text-xs ${inv.published ? "bg-gold/15 text-gold" : "bg-ivory/10 text-ivory/60"}`}>{inv.published ? "Terbuka untuk tamu" : "Ditutup"}</span>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <CopyField label="Link museum" value={share} testId="share-link" />
        <CopyField label="Kata kunci" value={inv.keyword} />
      </div>
      <div className="mt-4 flex flex-col gap-1.5">
        <label htmlFor={`to-${inv.keyword}`} className="text-xs font-semibold uppercase tracking-[0.14em] text-ivory/55">
          Link pribadi per tamu
        </label>
        <input id={`to-${inv.keyword}`} className="account-input" value={guest} maxLength={24} onChange={(e) => setGuest(e.target.value)} placeholder="Tulis nama tamu" />
        {guest.trim() && <CopyField label="Tamu langsung disambut dengan namanya" value={`${share}?to=${encodeURIComponent(guest.trim())}`} />}
      </div>
      {error && (
        <p role="alert" className="mt-4 rounded-xl border border-ember/40 bg-ember/10 px-3 py-2 text-sm">
          {error}
        </p>
      )}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button type="button" onClick={enter} disabled={busy === "enter" || !inv.published} className="primary-button disabled:opacity-60" data-testid="enter-invitation">
          {busy === "enter" ? "Membuka…" : "Masuk ke museum 3D"}
        </button>
        {inv.folderUrl ? (
          <a href={inv.folderUrl} target="_blank" rel="noreferrer" className="rounded-full border border-ivory/15 px-4 py-2.5 text-sm text-ivory/80 hover:border-gold/60 hover:text-gold">
            Folder foto
          </a>
        ) : (
          <a href={driveUrl(inv.keyword)} className="rounded-full border border-gold/50 px-4 py-2.5 text-sm text-gold hover:bg-gold/10" data-testid="make-folder">
            📁 Buat folder di Google Drive-mu
          </a>
        )}
        <button type="button" onClick={onEdit} className="rounded-full border border-ivory/15 px-4 py-2.5 text-sm text-ivory/80 hover:border-gold/60 hover:text-gold" data-testid="edit-invitation">
          Ubah detail
        </button>
        <button type="button" onClick={togglePublished} disabled={busy === "publish"} className="ml-auto text-xs text-ivory/50 underline-offset-4 hover:text-ivory hover:underline">
          {inv.published ? "Tutup sementara untuk tamu" : "Buka lagi untuk tamu"}
        </button>
      </div>
    </article>
  );
}
