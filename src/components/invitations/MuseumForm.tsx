"use client";

import { useState, type FormEvent } from "react";

export interface MuseumInput {
  name: string;
  welcome: string;
}

export const DEFAULT_MUSEUM: MuseumInput = {
  name: "",
  welcome: "Selamat datang di museum kenangan kami. Silakan berkeliling dan tinggalkan pesan di Buku Tamu.",
};

export type MuseumSubmit = { details: MuseumInput; keyword?: string; agree?: boolean };

/** Create / edit form for a memory museum world. */
export function MuseumForm({
  mode,
  initial,
  busy,
  error,
  onSubmit,
  onCancel,
}: {
  mode: "create" | "edit";
  initial: MuseumInput;
  busy: boolean;
  error: string | null;
  onSubmit: (v: MuseumSubmit) => void;
  onCancel?: () => void;
}) {
  const [d, setD] = useState<MuseumInput>(initial);
  const [keyword, setKeyword] = useState("");
  const [agree, setAgree] = useState(false);
  const suggestion = d.name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit(mode === "create" ? { details: d, keyword, agree } : { details: d });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
      <section className="account-card rounded-3xl p-5 sm:p-6">
        <h2 className="mb-4 font-display text-xl">Museummu</h2>
        <label htmlFor="museum-name" className="text-xs font-semibold uppercase tracking-[0.14em] text-ivory/55">
          Nama museum
        </label>
        <input id="museum-name" className="account-input mt-1.5" value={d.name} maxLength={60} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder="misalnya Museum Kita Berdua" />
        <label htmlFor="museum-welcome" className="mt-4 block text-xs font-semibold uppercase tracking-[0.14em] text-ivory/55">
          Kata sambutan
        </label>
        <textarea id="museum-welcome" className="account-input mt-1.5 min-h-20" value={d.welcome} maxLength={400} onChange={(e) => setD({ ...d, welcome: e.target.value })} />
        <p className="mt-3 text-xs text-ivory/50">Foto-fotomu dipajang di Grand Museum, diurutkan dari yang terlama. Lantai dan aula baru terbuka sendiri saat fotonya bertambah, dan tiap foto diberi judul tanggalnya.</p>
      </section>

      {mode === "create" && (
        <section className="account-card rounded-3xl p-5 sm:p-6">
          <h2 className="mb-4 font-display text-xl">Kata kunci untuk tamu</h2>
          <label htmlFor="museum-keyword" className="text-xs font-semibold uppercase tracking-[0.14em] text-ivory/55">
            Kata kunci
          </label>
          <input
            id="museum-keyword"
            className="account-input mt-1.5"
            value={keyword}
            maxLength={64}
            autoCapitalize="none"
            spellCheck={false}
            onChange={(e) => setKeyword(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
            placeholder={suggestion || "museum-kita"}
          />
          <p className="mt-1.5 text-xs text-ivory/45">Tamu memasukkan kata ini untuk masuk. Huruf, angka dan tanda -.</p>
          {!keyword && suggestion.length >= 3 && (
            <button type="button" onClick={() => setKeyword(suggestion)} className="mt-2 text-xs text-gold underline-offset-4 hover:underline">
              Pakai “{suggestion}”
            </button>
          )}
        </section>
      )}

      {mode === "create" && (
        <label className="flex items-start gap-3 rounded-2xl border border-ivory/10 bg-ivory/5 p-4 text-sm text-ivory/75">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1 accent-[#d9b77e]" />
          <span>
            Saya mengerti bahwa isi world ini dicatat di Google Sheet pengelola MEMORA, dan pengelola dapat melihatnya untuk moderasi dan bantuan teknis. Saya tidak akan mengunggah dokumen pribadi atau rahasia.{" "}
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
        <button type="submit" disabled={busy} className="primary-button ml-auto min-w-[200px] disabled:opacity-60" data-testid="museum-submit">
          {busy ? "Menyimpan…" : mode === "create" ? "Buat museum" : "Simpan perubahan"}
        </button>
      </div>
    </form>
  );
}
