# Membuat aset MEMORA dengan Meshy / Tripo (AI 3D)

Meshy (meshy.ai) dan Tripo (tripo3d.ai) mengubah **teks** atau **gambar** menjadi model 3D
bertekstur (.glb). Keduanya punya paket gratis dengan kredit terbatas.

> **Lisensi — cek dulu sebelum dipakai di MEMORA.** Biasanya hasil dari paket gratis
> memakai lisensi terbuka yang mewajibkan atribusi atau bahkan tidak boleh dipakai
> komersial; paket berbayar memberi hak penuh. Baca halaman *Pricing / License* platform
> saat kamu mendaftar, dan simpan bukti lisensinya.

---

## Langkah 1 — Siapkan gambar referensi yang bersih

AI 3D paling bagus dari **gambar satu benda saja, latar polos, sudut 3/4**. Potongan dari
ilustrasi venue terlalu ramai (ada bunga, orang, cahaya di belakangnya), jadi lebih baik:

1. Buat gambar referensi per benda dengan AI gambar (ChatGPT, Gemini, dsb.) memakai
   **prompt gambar** di bagian bawah file ini, sambil melampirkan ilustrasi venue sebagai
   acuan gaya.
2. Pastikan: satu benda, latar putih/abu polos, terlihat utuh, tidak terpotong, 1024 px.
3. Kalau masih ada latar, hapus dulu (remove.bg, atau fitur hapus latar di Meshy/Tripo).

## Langkah 2 — Buat modelnya

**Di Meshy:**
1. Masuk → **Image to 3D** (atau **Text to 3D** kalau tanpa gambar).
2. Unggah gambar referensi / tempel prompt teks dari daftar di bawah.
3. Pengaturan: *Art style* **Cartoon/Stylized** (bukan Realistic), **Texture: ON**, **PBR: ON**,
   *Symmetry*: ON untuk benda simetris (kursi, lampu, pilar), *Target polycount* sesuai tabel.
4. Generate → pilih hasil terbaik → **Refine / Texture** bila ditawarkan.
5. **Download → GLB**.

**Di Tripo:**
1. Masuk → **Image to Model** (atau **Text to Model**).
2. Unggah gambar / tempel prompt.
3. Pilih gaya **Cartoon / Stylized** jika ada, aktifkan **HD texture / PBR**.
4. Generate → kalau perlu pakai **Retopology / Low-poly** untuk menurunkan poligon.
5. **Export → GLB**.

## Langkah 3 — Karakter (rig + animasi)

1. Buat karakter **berpose T atau A** (lengan terbuka ke samping) — wajib untuk rig.
   Pakai prompt karakter di bawah.
2. Rig otomatis: fitur **Rigging / Animate** di Meshy atau Tripo (pilih *Humanoid*).
   Alternatif: unggah ke **Mixamo** (mixamo.com, gratis) → Auto-Rigger.
3. Animasi yang dibutuhkan: `idle`, `walk`, `run`, `jump`, `sit`, `wave`, `clap`, `inspect`
   (di Mixamo cari: *Idle, Walking, Running, Jump, Sitting Idle, Waving, Clapping, Thinking*).
   Pilih **In Place**, 30 fps.
4. Satu karakter dasar dulu (`character-base.glb`). Pakaian lain menyusul — untuk tahap awal
   boleh dibuat sebagai **karakter utuh terpisah** (mis. `groom.glb`, `bride.glb`, `guest-hijab.glb`)
   masing-masing dengan rig sendiri; itu lebih mudah daripada pakaian yang bisa ditukar.

## Langkah 4 — Rapikan sebelum dimasukkan ke folder

Untuk setiap .glb (bisa dibantu Claude web menulis langkah Blender-nya):
1. **Skala** sesuai ukuran di README folder (meter). Contoh: kursi tingginya ±1 m.
2. **Origin** di lantai, tengah alas. **Depan** menghadap +Z.
3. **Kompres**: `npx @gltf-transform/cli optimize input.glb output.glb --compress meshopt --texture-compress webp`
4. **Ukuran**: benda kecil < 500 KB, sedang < 2 MB, karakter < 5 MB.
5. **Nama file** persis seperti tabel README, lalu taruh di folder yang sesuai.

---

## Prompt 3D (tempel di Text to 3D, atau sebagai deskripsi tambahan Image to 3D)

Akhiri setiap prompt dengan **gaya umum** berikut (sudah disertakan di tiap prompt):

> *stylized 3D game asset, soft rounded shapes, hand-painted warm pastel textures, cozy wedding aesthetic, clean topology, single object, centered, no background, no ground plane*

Hindari (negative prompt, bila tersedia):

> *realistic photo, noisy, broken mesh, floating parts, text, logo, watermark, extra objects, ground, background scene, low quality*

### Karakter (`characters/`)
| File | Prompt | Poligon |
|---|---|---|
| `groom.glb` | Chibi stylized young Indonesian man, short neat black hair, kind friendly face with big eyes, wearing a black tuxedo with white shirt and black bow tie, small white flower on the lapel, black shoes, full body, standing in **T-pose** arms straight out to the sides, stylized 3D game character, soft rounded shapes, hand-painted textures, clean topology, single character, no background | 15k–25k |
| `bride.glb` | Chibi stylized young Indonesian woman, gentle face with big eyes, long dark hair under a sheer white veil and small gold tiara, flowing white wedding gown with lace bodice and full floor-length skirt, holding nothing, full body, **A-pose** arms slightly away from the body, stylized 3D game character, soft rounded shapes, hand-painted textures, clean topology, no background | 15k–25k |
| `guest-hijab.glb` | Chibi stylized young Indonesian woman wearing a soft pastel hijab and long elegant gamis dress, friendly face, full body, **A-pose**, stylized 3D game character, soft rounded shapes, hand-painted textures, no background | 15k–20k |
| `guest-casual.glb` | Chibi stylized young man in a warm mustard sweater, navy trousers and brown shoes, short brown hair, friendly face, full body, **T-pose**, stylized 3D game character, soft rounded shapes, hand-painted textures, no background | 15k–20k |

### Garden Sunset (`themes/wedding/garden-sunset/`)
| File | Prompt | Poligon |
|---|---|---|
| `pergola.glb` | Romantic wooden wedding pergola with four square wooden posts and a slatted roof, white sheer fabric curtains draped from the top and tied at the posts, lush garlands of pink, cream and white roses with green leaves across the top beam, stylized 3D game asset, soft rounded shapes, hand-painted warm pastel textures, single object, no background | 20k–30k |
| `flower-arch.glb` | Round-top wedding entrance arch made of white wood fully covered with pink, peach and white roses and green foliage, stylized 3D game asset, hand-painted textures, single object, no background | 15k–25k |
| `throne-wood.glb` | Elegant wooden wedding chair with carved curved backrest and cream cushioned seat, warm honey wood, stylized 3D game asset, soft rounded shapes, hand-painted textures, single object, no background | 3k–6k |
| `chair-wood.glb` | Rustic cross-back wooden wedding guest chair, warm brown wood, stylized 3D game asset, soft rounded shapes, hand-painted textures, single object, no background | 1k–3k |
| `fountain.glb` | Three-tier classic white stone garden fountain with round basins and water, stylized 3D game asset, soft rounded shapes, hand-painted textures, single object, no background | 6k–12k |
| `lantern-ground.glb` | Small black metal garden lantern with glass panes and a glowing candle inside, stylized 3D game asset, hand-painted textures, single object, no background | 1k–3k |
| `lamp-post.glb` | Classic black Victorian garden lamp post with a warm glowing lantern on top, stylized 3D game asset, hand-painted textures, single object, no background | 2k–4k |
| `bench-garden.glb` | Wooden garden bench with curved black iron armrests, stylized 3D game asset, hand-painted textures, single object, no background | 2k–4k |
| `flower-stand.glb` | Tall slim white pedestal stand topped with a round bouquet of pink and white roses, wedding aisle decoration, stylized 3D game asset, hand-painted textures, single object, no background | 4k–8k |
| `tree-large-1.glb` | Lush round deciduous tree with thick brown trunk and fluffy layered green canopy, stylized 3D game asset, soft rounded shapes, hand-painted textures, single object, no background | 6k–12k |
| `hedge-flower.glb` | Rectangular green garden hedge section dotted with small pink and white flowers, stylized 3D game asset, hand-painted textures, single object, no background | 3k–6k |
| `welcome-sign.glb` | Wooden easel sign with a blank light wooden board (no text) decorated with pink roses and greenery at the top corner, stylized 3D game asset, hand-painted textures, single object, no background | 2k–5k |

### Grand Ballroom (`themes/wedding/grand-ballroom/`)
| File | Prompt | Poligon |
|---|---|---|
| `chandelier-grand.glb` | Grand multi-tier crystal chandelier with gold frame, many candle lights and hanging crystal drops, warm glowing, stylized 3D game asset, hand-painted textures, single object, no background | 10k–20k |
| `chandelier-small.glb` | Small gold crystal chandelier with candle lights and crystal drops, stylized 3D game asset, hand-painted textures, single object, no background | 4k–8k |
| `pillar-classic.glb` | Tall classical white marble column with ornate gold Corinthian capital and square base, stylized 3D game asset, hand-painted textures, single object, no background | 4k–8k |
| `stage-ballroom.glb` | Luxurious wedding stage backdrop, white and gold carved panels with a central arch, rose arrangements on top, two-step platform with red carpet, stylized 3D game asset, hand-painted textures, single object, no background | 20k–30k |
| `sofa-wedding.glb` | Elegant white and gold wedding loveseat sofa with carved gold frame and plush cream cushions, stylized 3D game asset, hand-painted textures, single object, no background | 4k–8k |
| `table-round.glb` | Round banquet table with a long white tablecloth to the floor, small centerpiece of roses and candles, stylized 3D game asset, hand-painted textures, single object, no background | 3k–6k |
| `chair-banquet.glb` | Banquet chair with white fabric cover and a large burgundy satin bow on the back, stylized 3D game asset, hand-painted textures, single object, no background | 2k–4k |
| `flower-pedestal.glb` | Tall white classical pedestal with a large lush arrangement of pink, white and red roses, stylized 3D game asset, hand-painted textures, single object, no background | 6k–12k |
| `curtain-velvet.glb` | Tall burgundy velvet curtain panel gathered with a gold tie-back and tassel, soft folds, stylized 3D game asset, hand-painted textures, single object, no background | 2k–5k |

### Dipakai kedua venue (`themes/wedding/shared/`)
| File | Prompt | Poligon |
|---|---|---|
| `info-board.glb` | Freestanding wooden easel board with a blank cream panel (no text) and a small rose decoration on top, stylized 3D game asset, hand-painted textures, single object, no background | 1k–3k |
| `envelope-box.glb` | White wedding gift card box with gold trim and a slot on top, on a small round table with white cloth, stylized 3D game asset, hand-painted textures, single object, no background | 2k–4k |
| `photo-easel.glb` | Wooden display easel holding an empty gold picture frame (blank picture area), stylized 3D game asset, hand-painted textures, single object, no background | 1k–3k |

---

## Prompt gambar referensi (untuk ChatGPT / Gemini, lampirkan ilustrasi venue)

> Create a clean product-style concept image of **[nama benda, mis. "the wooden wedding pergola with white curtains and rose garlands"]** from the attached illustration, in the same soft stylized illustrated 3D style and warm sunset color palette. Show **only this single object**, complete and uncropped, in a **3/4 front view**, centered on a **plain light grey background**, soft even lighting, no people, no text, no other objects.

Untuk karakter:

> Create a full-body character concept of **[groom / bride / guest]** in the same soft stylized chibi 3D style as the attached illustration, standing in a **T-pose** (arms straight out to the sides), front view, plain light grey background, even lighting, no shadows on the ground, no text.
