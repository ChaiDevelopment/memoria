import type { Metadata } from "next";
import { AccountShell } from "@/components/account/AccountShell";

export const metadata: Metadata = { title: "Privasi — MEMORA" };

/** Plain-language privacy notice (also the link Google asks for when the app is published). */
export default function PrivacyPage() {
  return (
    <AccountShell>
      <article className="prose-memora flex flex-col gap-5 text-sm leading-relaxed text-ivory/80">
        <h1 className="font-display text-3xl text-ivory">Kebijakan Privasi MEMORA</h1>
        <p>MEMORA adalah dunia 3D untuk museum kenangan dan undangan pernikahan. Halaman ini menjelaskan data apa yang kami simpan dan siapa yang bisa melihatnya.</p>
        <h2 className="font-display text-xl text-ivory">Yang kami terima dari Google</h2>
        <p>Saat kamu masuk dengan Google, MEMORA hanya menerima nama, alamat email dan foto profilmu. Saat kamu membuat world, MEMORA meminta izin tambahan "drive.file" untuk membuat satu folder di Google Drive-mu — izin itu hanya berlaku untuk file yang dibuat MEMORA, tidak untuk isi Drive, Google Photos atau data lain milikmu.</p>
        <h2 className="font-display text-xl text-ivory">World yang kamu buat (museum atau undangan)</h2>
        <ul className="list-disc pl-5">
          <li>Detail world (nama museum, atau nama mempelai, acara, lokasi dan rekening amplop digital) serta konfirmasi kehadiran tamu disimpan di Google Sheet milik pengelola MEMORA.</li>
          <li>Foto disimpan di folder yang dibuat MEMORA di My Drive milikmu sendiri (dengan izin "drive.file": MEMORA hanya bisa membuka file yang dibuatnya, bukan isi Drive-mu yang lain). Folder itu dibagikan ke sistem MEMORA supaya fotonya bisa tampil di world 3D, dan ke pasanganmu bila undangan pernikahan.</li>
          <li>Pengelola MEMORA dapat melihat semua world, kata kunci dan foto untuk keperluan moderasi dan bantuan teknis, dan dapat menutup world yang melanggar aturan.</li>
          <li>Jangan mengunggah dokumen pribadi atau rahasia (KTP, dokumen kerja, dan sebagainya).</li>
        </ul>
        <h2 className="font-display text-xl text-ivory">Tamu</h2>
        <p>Tamu tidak perlu akun. Siapa pun yang mengetahui kata kunci bisa masuk dan melihat foto, info acara dan amplop digital undangan tersebut, jadi bagikan kata kunci hanya kepada orang yang kamu undang. Nama dan ucapan yang ditulis tamu disimpan di Google Sheet pengelola dan terlihat oleh semua tamu undangan itu.</p>
        <h2 className="font-display text-xl text-ivory">Menghapus data</h2>
        <p>Kamu bisa menutup world-mu kapan saja dari halaman World Saya, dan menghapus foto langsung dari folder Drive-mu. Untuk menghapus world sepenuhnya, hubungi pengelola MEMORA.</p>
      </article>
    </AccountShell>
  );
}
