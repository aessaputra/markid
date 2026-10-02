# MarkID: spesifikasi desain

Tanggal: 2026-10-02
Status: desain percakapan disetujui; menunggu review dokumen. Bukan klaim siap rilis.

## Tujuan
Web app mobile-first untuk menambahkan watermark teks pada foto identitas secara lokal, dengan UI sederhana dan geometri preview/export yang konsisten. Referensi: references/watermark-identity. Jangan mengubah repository referensi. Jika kode referensi digunakan, pertahankan pemberitahuan lisensi MIT.

## Stack dan panduan
Svelte 5, TypeScript, Vite, Tailwind CSS v4, Canvas 2D. Tidak ada backend, database, akun, atau API upload. Ikuti design-taste-frontend untuk arah visual yang sesuai alat kerja; tailwindcss-mobile-first untuk responsive; tailwind-design-system untuk token CSS-first; svelte-code-writer untuk dokumentasi dan autofixer komponen. Jangan menggunakan default React dari skill desain.

## Scope
Satu file sumber: JPG/JPEG, PNG, HEIC/HEIF, WebP, AVIF, atau PDF. Satu watermark teks multiline. Kontrol teks, preset tujuan verifikasi dan tanggal lokal, font, ukuran, warna, opacity, posisi, rotasi, drag dan reset pengaturan. Foto menghasilkan JPEG; PDF menghasilkan PDF dengan watermark di semua halaman. Tidak ada batch file, layer tambahan, PWA offline atau penyimpanan file lintas sesi. Dukungan varian codec gambar dan decoder HEIC/HEIF harus diverifikasi sebelum implementasi; daftar format ini adalah scope yang diminta, bukan klaim dukungan yang sudah diuji.

Preset berbahasa Inggris: For [purpose] only · [date]. Teks yang dimasukkan pengguna tidak diterjemahkan. Reset mengembalikan pengaturan watermark tanpa menghapus gambar. Ganti gambar mempertahankan teks/style, mengembalikan posisi ke tengah. Teks kosong/whitespace menonaktifkan persiapan hasil.

## Arsitektur
UI Svelte -> state editor dan aturan geometri bersama -> adapter gambar (Canvas -> JPEG) atau adapter PDF (PDF.js preview, pdf-lib export -> PDF) -> preview hasil -> unduh.

Keputusan konsistensi disetujui: pengalaman editor dan aturan visual sama untuk gambar dan PDF, hanya pemrosesan internal/output berbeda. Posisi disimpan relatif terhadap area gambar atau halaman terlihat, ukuran watermark relatif terhadap area tersebut. Font, warna, opacity, pemenggalan multiline dan arah rotasi mengikuti aturan bersama. Adapter PDF menerjemahkan koordinat termasuk CropBox/rotasi; halaman berbeda ukuran memakai proporsi yang sama. Uji kesesuaian posisi, proporsi dan layout dengan toleransi terdefinisi, bukan menuntut piksel identik antara Canvas dan pembaca PDF.

Pisahkan modul input/header, decode, geometri, renderer, export, resource lifecycle dan komponen UI. State tidak mengambil posisi watermark dari ukuran panel DOM. Posisi dan font memakai koordinat gambar yang dipetakan melalui skala seragam dan offset area gambar. Rotasi dan multiline menggunakan aturan renderer yang sama. DPR hanya memengaruhi backing preview, bukan state gambar.

Cache gambar preview berukuran sesuai layar; jangan menggambar gambar kerja penuh pada setiap pointer event. Renderer export memakai snapshot state. Setiap kandidat dimensi dirender langsung dari gambar kerja, bukan kandidat yang telah diperkecil sebelumnya.

## Input dan dimensi
Pertahankan validasi ukuran file, signature, dimensi sisi dan total piksel sebelum decode penuh. PNG membaca IHDR. JPEG memakai parser marker frame dengan batas pembacaan, validasi panjang segmen, offset dan akhir file; verifikasi detail format dari sumber otoritatif sebelum implementasi.

Terima foto sumber beresolusi besar dan perkecil secara lokal bila diperlukan ke ukuran kerja proporsional. Jangan menolak sumber hanya karena melebihi 8MP. Dimensi digunakan untuk menentukan ukuran kerja dan mendeteksi header tidak valid atau ekstrem yang tidak dapat didukung, bukan sebagai batas ketat bagi foto normal. Jangan percaya ekstensi/MIME saja. Header lolos tidak menjamin keseluruhan file valid; decoder tetap dapat gagal. Gambar lama diganti hanya setelah decode baru berhasil. Hasil pemuatan lama yang kedaluwarsa tidak boleh menimpa gambar baru.

Batas file sumber disetujui: 10 MB = 10.000.000 byte. Output gambar JPEG tetap maksimum 1 MiB = 1.048.576 byte; batas ini tidak berlaku pada PDF. Jangan menyamakan MB desimal dan MiB biner.

Target dimensi kerja adalah kebijakan aplikasi, bukan batas resolusi sumber atau konstanta universal browser. Rilis diblokir sampai target kerja dan kebijakan sumber ekstrem dipilih dan lulus matriks perangkat. Nilai eksperimen 8MP/4096px tidak boleh diberi label aman mobile. Konfigurasi kebijakan terpusat; test boundary dan pemuatan sumber 12MP/48MP dalam batas file. Hindari alokasi penuh bila API mendukung resize decode; jangan menganggap resize decode atau worker menjamin memori aman.

Utamakan createImageBitmap dengan EXIF orientation sesuai gambar; fallback HTMLImageElement jika diperlukan. Uji orientasi 1-8, termasuk mirrored. Jangan menerapkan EXIF dua kali. Verifikasi dimensi hasil decode dan cleanup sumber. Resize option tidak menjamin bebas alokasi penuh.

## Decoder gambar lintas format
Pendekatan disetujui: JPG/PNG/WebP/AVIF menggunakan decoder browser, tanpa JPEG perantara. HEIC/HEIF mencoba decode native; jika gagal gunakan heic-to lokal yang dimuat secara lazy. Hasil dinormalisasi menjadi gambar kerja untuk editor/renderer yang sama. Output JPEG hanya di tahap export. Tidak ada fallback server atau decoder tambahan WebP/AVIF tanpa bukti kebutuhan.

heic-to mendokumentasikan output bitmap, build heic-to/csp untuk menghindari unsafe-eval, serta heic-to/next untuk worker. Jangan menganggap kedua build dapat digabung atau sama-sama memenuhi CSP tanpa pengujian. Pilih versi/build berdasarkan fixture dan CSP produksi; audit lisensi dependency. Source yang diperiksa menunjukkan data piksel penuh sebelum resize bitmap, sehingga resize bukan jaminan decode hemat memori.

Scope satu gambar statis, bukan animasi/koleksi. Jangan menjanjikan semua varian codec atau HDR/metadata tetap identik. Uji orientasi HEIC iPhone portrait/landscape dan sumber besar, HEIF dari perangkat target, WebP lossy/lossless/alpha, AVIF statis, malformed dan pergantian file saat loading pada Android/iOS. Pesan kegagalan pembukaan: Could not open this file. Try a JPG or PNG. Pertahankan sumber/editor lama saat gagal.

Sumber: https://github.com/hoppergee/heic-to#usage dan https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Image_types. Riset dokumentasi/source saja, bukan bukti runtime.

## PDF: referensi BentoPDF
Referensi dikoreksi pengguna: gunakan https://github.com/alam00000/bentopdf, bukan goodtab/bentopdf. Source main pada commit c10511203e7f5d3f2841c5073edf0c7a1b896e88 diperiksa melalui GitHub API/raw setelah clone timeout. Entry UI src/js/logic/add-watermark-page.ts; pemrosesan src/js/utils/pdf-operations.ts (addTextWatermark/addImageWatermark). Fitur belum dieksekusi. Lisensi repository AGPL-3.0, bukan Apache-2.0. Jangan menyalin/adaptasi kode sebelum memilih jalur kepatuhan lisensi; alternatif adalah implementasi sendiri berdasarkan kebutuhan dan dokumentasi library. Jangan menganggap lisensi dependency otomatis sama.

Gunakan PDF.js untuk preview satu halaman aktif dan pdf-lib untuk menambahkan watermark langsung ke setiap halaman serta menyimpan PDF. Tidak merasterisasi isi halaman saat export. Muat dependency dan worker lokal hanya saat dibutuhkan. Sumber PDF mengikuti batas input 10 MB. Target JPEG 1 MiB tidak berlaku pada hasil PDF; tampilkan ukuran hasil aktual tanpa janji kompresi PDF.

Export selalu memuat dokumen dari bytes sumber asli dan snapshot pengaturan, bukan mengedit ulang hasil export sebelumnya. Embed aset watermark sekali per dokumen. Nilai opacity nol valid, tidak diganti default melalui operator ||. Transformasi posisi/rotasi memakai geometri halaman terlihat termasuk CropBox, rotasi dan ukuran halaman berbeda; preview dan hasil harus cocok. Referensi baru merender teks watermark ke PNG transparan menggunakan Canvas, lalu embed PNG sekali dengan pdf-lib; halaman asli tidak dirasterisasi. Arah adapter MarkID mengikuti pola aset watermark raster bersama agar layout/font konsisten dengan gambar, dengan resolusi aset diuji terhadap kualitas dan memori. Font lokal harus siap sebelum render. Ini menggantikan arah embed font PDF sebelumnya. Fitur flatten seluruh halaman pada BentoPDF tidak termasuk scope MarkID.

Uji PDF scan, teks/font, beberapa halaman, rotasi/CropBox, teks multiline, opacity nol, export berulang tanpa watermark bertumpuk, file rusak dan encrypted. PDF encrypted/berpassword ditolak pada versi awal, tanpa input password atau upaya membuka proteksi. Pesan disetujui: PDF is locked. Unlock it and try again. Kebijakan dokumen bertanda tangan digital perlu persetujuan terpisah; jangan menjanjikan signature tetap valid. Penambahan watermark bukan redaksi dan bukan perlindungan anti-penghapusan.

## Export gambar
Target JPEG <= 1048576 byte. Satu job aktif, snapshot state, status pemrosesan dan pencegahan hasil stale. Worker dan OffscreenCanvas dengan runtime capability check; fallback Canvas main-thread dengan percobaan terbatas dan kesempatan UI memperbarui status. Worker tidak menjamin memori kecil.

Font lokal dipastikan siap di halaman dan worker masing-masing. Jika gagal, tampilkan error, bukan font berbeda diam-diam. PNG transparan dikomposit ke putih. Periksa blob tidak null/kosong, MIME image/jpeg dan ukuran aktual. Pembatasan percobaan, kualitas dan dimensi minimum dipilih berdasarkan fixture keterbacaan sebelum rilis; q=.7 dan 1280px dari spike bukan standar kualitas.

Jika batas tidak tercapai, tampilkan error tanpa unduh parsial. Setelah berhasil tampilkan JPEG final, ukuran file, dimensi dan pemberitahuan jika dimensi turun. Perubahan pengaturan membuat hasil lama tidak berlaku.

## UX dan visual
Minimal utility. Netral zinc, aksen emerald; merah untuk error. Geist lokal. Radius kontrol 8px, panel 12px. Token semantik surface, text, muted, border, accent, danger dan focus; tema terang/gelap mengikuti sistem, pilihan manual. Hanya preferensi tema boleh disimpan.

Mobile: header ringkas, preview/pemilihan gambar, kontrol utama teks/preset/ukuran/opacity, disclosure font/warna/posisi/rotasi, satu tombol utama. Scroll normal; tidak fixed bottom action bar atau preview sticky pada mobile. Desktop dua kolom, preview lebih luas di kiri dan kontrol di kanan; sticky hanya jika tinggi cukup. Tanpa hero pemasaran besar.

Semua UI copy memakai bahasa Inggris sederhana: label, tombol, helper, status, error, tooltip dan accessible name. Gunakan sentence case. Percakapan/dokumentasi boleh bahasa Indonesia. Label utama: Choose file, Watermark text, Preview, Download, Back to edit, Reset. Kontrol: Purpose, Date, Size, Opacity, Font, Color, Position, Rotation, More options, Page, Theme; tema System, Light, Dark. Navigasi PDF: Previous page, Next page. Status: Loading…, Processing…, Ready. Helper input: JPG, PNG, HEIC, HEIF, WebP, AVIF or PDF. Max 10 MB. Error: File exceeds 10 MB.; Unsupported format.; Gambar: Could not open this file. Try a JPG or PNG. PDF rusak: Could not open this PDF. Try another.; Could not process this file. Try a smaller one.; Export failed. Try again. Jika ukuran kerja dikurangi: Image resized for processing. Copy privasi: Files stay on your device. Pesan PDF terkunci: PDF is locked. Unlock it and try again.

Alur: Choose file -> edit -> Preview -> proses -> preview hasil final (JPEG atau PDF sesuai input) -> Download. Selama proses pengaturan dikunci. Kegagalan mempertahankan editor. Tidak ada CTA duplikat.

Komponen dasar Button, Field, RangeField, Disclosure, StatusMessage. Target sentuh >=44px, focus terlihat, label HTML, keyboard dan kontrol posisi/rotasi tersedia tanpa drag. Pointer capture, pointercancel dan lostpointercapture ditangani. touch-action none hanya pada area drag yang diperlukan. Hormati reduced motion. Tema diuji keduanya, layout 320px dan keyboard virtual.

## Privasi dan deployment
Foto/teks tidak dikirim ke jaringan dan tidak disimpan otomatis. Semua resource berasal dari origin sendiri. Tidak analytics, script pihak ketiga atau remote image. Lepaskan ImageBitmap dan object URL saat aman serta Canvas sementara. Jangan menjanjikan penghapusan fisik instan RAM/cache browser atau watermark mustahil dihapus.

Hosting HTTPS menyajikan dist hasil vite build, bukan vite preview. CSP diuji terhadap build produksi untuk script/font/worker/Blob URL dan koneksi yang benar-benar diperlukan, blok embedding dan form submission yang tidak diperlukan. Teks watermark bukan HTML. Cache panjang untuk asset ber-hash; HTML dapat diperbarui; rollback deployment tersedia. Hosting tetap dapat mencatat metadata akses biasa.

Target browser: Chrome 111+, Safari 16.4+, Firefox 128+ sesuai Tailwind v4; dukungan browser in-app tidak dijanjikan. Feature detection tetap diperlukan. Test browser engine otomatis tidak menggantikan perangkat fisik.

## Bukti spike dan release gate
Spike throwaway: spikes/001-image-pipeline/README.md. Dua run Chromium desktop menunjukkan enam export <=1MiB, EXIF 6, background putih dan decode rusak ditolak. Noise memerlukan 15 encoding; file 48MP kecil membuktikan byte limit tidak membatasi decode. Tidak membuktikan memori mobile, OCR/keterbacaan atau pixel parity renderer.

Sebelum rilis wajib:
- Unit test parser header, geometri, policy dan resource/job lifecycle; input malformed/truncated, zero/overflow dimensi dan boundary.
- Test portrait/landscape/square, multiline, rotasi, resize/DPR dan preview/export geometry parity dengan toleransi terdefinisi.
- Decode EXIF 1-8, PNG alpha dan format tidak didukung.
- Test font/decode/encoding gagal, fallback, ganti gambar cepat, hasil stale dan cleanup.
- Browser test Chromium/Firefox/WebKit, tema, keyboard, 320px/landscape dan network assertion tanpa gambar/teks keluar.
- Perangkat fisik Android dan Safari iOS: batas input, respons drag/export, kegagalan memori dan keyboard virtual.
- Review JPEG final teks kecil pada resolusi asli; tentukan kualitas/dimensi minimum dari hasilnya, bukan skor JPEG saja.
- Build/typecheck/Svelte autofixer, accessibility dan performa produksi, security headers/cache/rollback diverifikasi.

## Review pengguna sebelum rencana implementasi
Dokumen ini tidak mengotorisasi implementasi atau mengklaim production-ready. Batas file 10 MB dan resize lokal otomatis telah disetujui. Review spesifikasi tertulis diperlukan sebelum rencana implementasi. Batas numerik memori/kualitas ditetapkan lewat validasi release di atas, tanpa klaim benchmark yang belum dijalankan.

## Sumber
- https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/canvas
- https://developer.mozilla.org/en-US/docs/Web/API/Window/createImageBitmap
- https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob
- https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas/convertToBlob
- https://developer.mozilla.org/en-US/docs/Web/API/FontFaceSet/load
- https://developer.mozilla.org/en-US/docs/Web/API/Blob/slice
- https://www.w3.org/TR/png-3/#11IHDR
- https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/naturalWidth
- https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events
- https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy
- https://tailwindcss.com/docs/compatibility
- https://vite.dev/guide/static-deploy
