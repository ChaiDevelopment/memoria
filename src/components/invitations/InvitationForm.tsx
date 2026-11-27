"use client";

import { useState, type FormEvent, type ReactNode } from "react";

export interface EventInput {
  label: string;
  date: string;
  time: string;
  endTime: string;
  place: string;
  address: string;
  mapsUrl: string;
}
export interface BankInput {
  bank: string;
  number: string;
  holder: string;
}
export interface DetailsInput {
  brideName: string;
  groomName: string;
  setting: "outdoor" | "indoor";
  welcome: string;
  events: EventInput[];
  banks: BankInput[];
}

export const emptyEvent = (label: string): EventInput => ({ label, date: "", time: "", endTime: "", place: "", address: "", mapsUrl: "" });
export const DEFAULT_DETAILS: DetailsInput = {
  brideName: "",
  groomName: "",
  setting: "outdoor",
  welcome: "Dengan memohon rahmat dan ridho Tuhan Yang Maha Esa, kami bermaksud mengundang Bapak/Ibu/Saudara/i untuk hadir di hari bahagia kami.",
  events: [emptyEvent("Akad Nikah"), emptyEvent("Resepsi")],
  banks: [],
};

export type FormSubmit = { details: DetailsInput; keyword?: string; role?: "bride" | "groom"; agree?: boolean };

/** Shared create / edit form for a wedding invitation. */
export function InvitationForm({
  mode,
  initial,
  busy,
  error,
  onSubmit,
  onCancel,
}: {
  mode: "create" | "edit";
  initial: DetailsInput;
  busy: boolean;
  error: string | null;
  onSubmit: (v: FormSubmit) => void;
  onCancel?: () => void;
}) {
  const [d, setD] = useState<DetailsInput>(initial);
  const [keyword, setKeyword] = useState("");
  const [role, setRole] = useState<"bride" | "groom">("bride");
  const [agree, setAgree] = useState(false);
  const set = <K extends keyof DetailsInput>(k: K, v: DetailsInput[K]) => setD((x) => ({ ...x, [k]: v }));
  const setEvent = (i: number, patch: Partial<EventInput>) => set("events", d.events.map((e, j) => (j === i ? { ...e, ...patch } : e)));
  const setBank = (i: number, patch: Partial<BankInput>) => set("banks", d.banks.map((b, j) => (j === i ? { ...b, ...patch } : b)));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const clean: DetailsInput = { ...d, events: d.events.filter((ev) => ev.label.trim() || ev.date), banks: d.banks.filter((b) => b.bank.trim() || b.number.trim()) };
    onSubmit(mode === "create" ? { details: clean, keyword, role, agree } : { details: clean });
  };

  const suggestion = `${d.groomName}-${d.brideName}`.toLowerCase().normalize("NFKD").replace(/[^a-z0-9-]+/g, "").replace(/^-+|-+$/g, "");

  return (
    <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
      <Section title="Kedua mempelai">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nama mempelai pria" id="groom-name">
            <input id="groom-name" className="account-input" value={d.groomName} maxLength={40} onChange={(e) => set("groomName", e.target.value)} placeholder="misalnya Dimas" />
          </Field>
          <Field label="Nama mempelai wanita" id="bride-name">
            <input id="bride-name" className="account-input" value={d.brideName} maxLength={40} onChange={(e) => set("brideName", e.target.value)} placeholder="misalnya Rina" />
          </Field>
        </div>
        {mode === "create" && (
          <fieldset className="mt-4">
            <legend className="text-xs font-semibold uppercase tracking-[0.16em] text-ivory/60">Kamu adalah…</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {(["bride", "groom"] as const).map((r) => (
                <label key={r} className={`cursor-pointer rounded-full border px-4 py-2 text-sm ${role === r ? "border-gold bg-gold/15 text-ivory" : "border-ivory/15 text-ivory/70"}`}>
                  <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} className="sr-only" />
                  {r === "bride" ? "👰 Pengantin wanita" : "🤵 Pengantin pria"}
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-ivory/50">Akun Google-mu akan terkunci sebagai {role === "bride" ? "pengantin wanita" : "pengantin pria"}. Pasanganmu bergabung lewat Link Pasangan setelah undangan dibuat.</p>
          </fieldset>
        )}
      </Section>

      {mode === "create" && (
        <Section title="Kata kunci untuk tamu">
          <Field label="Kata kunci" id="inv-keyword" hint="Tamu memasukkan kata ini untuk masuk. Huruf, angka dan tanda -.">
            <input
              id="inv-keyword"
              className="account-input"
              value={keyword}
              maxLength={64}
              autoCapitalize="none"
              spellCheck={false}
              onChange={(e) => setKeyword(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
              placeholder={suggestion || "dimas-rina"}
            />
          </Field>
          {!keyword && suggestion.length >= 3 && (
            <button type="button" onClick={() => setKeyword(suggestion)} className="mt-2 text-xs text-gold underline-offset-4 hover:underline">
              Pakai “{suggestion}”
            </button>
          )}
        </Section>
      )}

      <Section title="Tempat acara (tampilan 3D)">
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ["outdoor", "🌿 Taman outdoor", "Gapura bunga, lampu gantung dan langit senja."],
              ["indoor", "🕯️ Ballroom indoor", "Aula hangat dengan lampu kristal."],
            ] as const
          ).map(([value, label, desc]) => (
            <label key={value} className={`cursor-pointer rounded-2xl border p-4 ${d.setting === value ? "border-gold bg-gold/10" : "border-ivory/15"}`}>
              <input type="radio" name="setting" value={value} checked={d.setting === value} onChange={() => set("setting", value)} className="sr-only" />
              <span className="block text-sm font-semibold text-ivory">{label}</span>
              <span className="mt-1 block text-xs text-ivory/55">{desc}</span>
            </label>
          ))}
        </div>
      </Section>

      <Section title="Kata sambutan">
        <textarea className="account-input min-h-24" value={d.welcome} maxLength={400} onChange={(e) => set("welcome", e.target.value)} aria-label="Kata sambutan" />
        <p className="mt-1 text-right text-xs text-ivory/40">{d.welcome.length}/400</p>
      </Section>

      <Section title="Acara">
        <div className="flex flex-col gap-4">
          {d.events.map((ev, i) => (
            <div key={i} className="rounded-2xl border border-ivory/10 p-4">
              <div className="flex items-center gap-3">
                <input className="account-input" aria-label="Nama acara" value={ev.label} maxLength={40} onChange={(e) => setEvent(i, { label: e.target.value })} placeholder="Nama acara" />
                <button type="button" onClick={() => set("events", d.events.filter((_, j) => j !== i))} className="shrink-0 text-xs text-ivory/50 hover:text-ember">
                  Hapus
                </button>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <Field label="Tanggal" id={`ev-date-${i}`}>
                  <input id={`ev-date-${i}`} type="date" className="account-input" value={ev.date} onChange={(e) => setEvent(i, { date: e.target.value })} />
                </Field>
                <Field label="Mulai" id={`ev-time-${i}`}>
                  <input id={`ev-time-${i}`} type="time" className="account-input" value={ev.time} onChange={(e) => setEvent(i, { time: e.target.value })} />
                </Field>
                <Field label="Selesai" id={`ev-end-${i}`}>
                  <input id={`ev-end-${i}`} type="time" className="account-input" value={ev.endTime} onChange={(e) => setEvent(i, { endTime: e.target.value })} />
                </Field>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field label="Tempat" id={`ev-place-${i}`}>
                  <input id={`ev-place-${i}`} className="account-input" value={ev.place} maxLength={80} onChange={(e) => setEvent(i, { place: e.target.value })} placeholder="misalnya Gedung Serbaguna" />
                </Field>
                <Field label="Link Google Maps" id={`ev-maps-${i}`}>
                  <input id={`ev-maps-${i}`} className="account-input" value={ev.mapsUrl} maxLength={300} onChange={(e) => setEvent(i, { mapsUrl: e.target.value.trim() })} placeholder="https://maps.app.goo.gl/…" />
                </Field>
              </div>
              <Field label="Alamat" id={`ev-addr-${i}`}>
                <input id={`ev-addr-${i}`} className="account-input" value={ev.address} maxLength={200} onChange={(e) => setEvent(i, { address: e.target.value })} />
              </Field>
            </div>
          ))}
          {d.events.length < 3 && (
            <button type="button" onClick={() => set("events", [...d.events, emptyEvent("")])} className="self-start text-sm text-gold underline-offset-4 hover:underline">
              + Tambah acara
            </button>
          )}
        </div>
      </Section>

      <Section title="Amplop digital">
        <p className="-mt-1 mb-3 text-xs text-ivory/55">Nomor rekening atau e-wallet ini hanya terlihat oleh tamu yang masuk dengan kata kunci. Boleh dikosongkan.</p>
        <div className="flex flex-col gap-3">
          {d.banks.map((b, i) => (
            <div key={i} className="grid gap-3 rounded-2xl border border-ivory/10 p-4 sm:grid-cols-[1fr_1.2fr_1.4fr_auto] sm:items-end">
              <Field label="Bank / e-wallet" id={`bank-${i}`}>
                <input id={`bank-${i}`} className="account-input" value={b.bank} maxLength={30} onChange={(e) => setBank(i, { bank: e.target.value })} placeholder="BCA" />
              </Field>
              <Field label="Nomor" id={`bank-no-${i}`}>
                <input id={`bank-no-${i}`} className="account-input" inputMode="numeric" value={b.number} maxLength={30} onChange={(e) => setBank(i, { number: e.target.value })} placeholder="1234567890" />
              </Field>
              <Field label="Atas nama" id={`bank-holder-${i}`}>
                <input id={`bank-holder-${i}`} className="account-input" value={b.holder} maxLength={60} onChange={(e) => setBank(i, { holder: e.target.value })} />
              </Field>
              <button type="button" onClick={() => set("banks", d.banks.filter((_, j) => j !== i))} className="pb-3 text-xs text-ivory/50 hover:text-ember">
                Hapus
              </button>
            </div>
          ))}
          {d.banks.length < 3 && (
            <button type="button" onClick={() => set("banks", [...d.banks, { bank: "", number: "", holder: "" }])} className="self-start text-sm text-gold underline-offset-4 hover:underline">
              + Tambah rekening
            </button>
          )}
        </div>
      </Section>

      {mode === "create" && (
        <label className="flex items-start gap-3 rounded-2xl border border-ivory/10 bg-ivory/5 p-4 text-sm text-ivory/75">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1 accent-[#d9b77e]" />
          <span>
            Saya mengerti bahwa isi undangan dicatat di Google Sheet pengelola MEMORA, dan pengelola dapat melihatnya untuk moderasi dan bantuan teknis. Saya tidak akan mengunggah dokumen pribadi atau rahasia.{" "}
            <a href="/privacy" target="_blank" className="text-gold underline-offset-4 hover:underline">
              Kebijakan privasi
            </a>
          </span>
        </label>
      )}

      {error && (
        <p role="alert" className="rounded-xl border border-ember/40 bg-ember/10 px-3 py-2 text-sm text-ivory">
          {error}
        </p>
      )}
      <div className="flex items-center gap-3">
        {onCancel && (
          <button type="button" onClick={onCancel} className="rounded-full px-4 py-2.5 text-sm text-ivory/70 hover:text-ivory">
            Batal
          </button>
        )}
        <button type="submit" disabled={busy} className="primary-button ml-auto min-w-[200px] disabled:opacity-60" data-testid="invitation-submit">
          {busy ? "Menyimpan…" : mode === "create" ? "Buat undangan" : "Simpan perubahan"}
        </button>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="account-card rounded-3xl p-5 sm:p-6">
      <h2 className="mb-4 font-display text-xl text-ivory">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, id, hint, children }: { label: string; id: string; hint?: string; children: ReactNode }) {
  return (
    <div className="mt-1 flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-semibold uppercase tracking-[0.14em] text-ivory/55">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-ivory/45">{hint}</p>}
    </div>
  );
}
