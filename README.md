# MarkID

Local, single-file text watermark editor built with Svelte 5, TypeScript, Vite and Canvas. Choose a file, edit the watermark, **Preview** the final encoded result, then **Download**. Images become JPEG; PDFs remain PDFs with a watermark on every page. Changing settings invalidates the previous result; export starts from the original source, not a previous export.

**Experimental local build, not approved for release or distribution.** Physical-device, cross-engine/minimum-browser and embedded-decoder LGPL gates remain blocked. No deployment host has been selected. See [release matrix](docs/testing/release-matrix.md), [codec evidence](docs/testing/codec-report.md) and [PDF evidence](docs/testing/pdf-report.md).

## Tested inputs (not universal codec support)

Chromium 153 on Linux has exercised genuine synthetic fixtures:
- JPEG and PNG, including EXIF/eXIf orientations 1–8, mirrored forms, PNG transparency (JPEG background becomes white).
- Static WebP lossy/lossless/alpha, plus EXIF rotation/mirror; static AVIF and container rotation/mirror.
- HEVC HEIC/HEIF via lazy local `heic-to/csp` fallback, including rotation/mirror. These are locally encoded bitstreams, **not iPhone/Android camera or native HEVC proof**.
- PDFs with text, scan images, multiple pages, CropBox/rotation, normalized unusual boxes, CMaps and standard fonts. Existing PDF page content is not rasterized on export; the text watermark is a shared raster PNG asset.

Animated images/collections are outside scope. HDR, color/profile fidelity, arbitrary codec variants, extreme sources, Safari/Firefox and in-app browsers are not verified. Failed inputs retain the previous valid editor. Locked PDFs are rejected: `PDF is locked. Unlock it and try again.` Recognized signature fields/dictionaries are conservatively rejected pending a signed-document decision; this is not a forensic signature detector or a signature-preservation guarantee.

## Limits and safety

No fixed input byte, photo megapixel/side, or JPEG output byte limit. Photos retain their full orientation-normalized decoded dimensions. JPEG export composes once from that source and encodes once at quality .92, without staged resizing or compression. Available browser/device capacity determines what can be processed; large files can fail or exhaust memory. Empty/corrupt files and invalid dimensions still fail explicitly. PDF output has no compression promise.

PDF raster previews adapt to the actual displayed page fit at twice its CSS dimensions, without the former 2MP/1600px/scale-2 caps. This preview sampling does not rasterize original PDF page content on export; the separate watermark asset layout remains unchanged. Full-resolution processing is not an unlimited-capacity, mobile-memory or readability guarantee. Inspect the final result before using it; synthetic small-text evidence does not establish a universal readable minimum.

Files, names and watermark text are processed locally; no uploads, analytics, accounts, backend or automatic file persistence. Theme follows the system dynamically; no theme preference is saved. Lazy decoder/PDF assets are fetched from the application's own origin. Downloads happen only when requested. This is not an offline/PWA guarantee: initial and lazy assets need a server. Browsers/OS may retain memory, caches or downloaded files; instant physical erasure is not promised. Hosting can log ordinary access metadata. Watermarks are not redaction, encryption or tamper-proof protection.

**PDF warning:** Canvas preview does not execute document JavaScript/URI actions or provide interactive forms, but export is **not a sanitizer**. Original active content, links/actions, attachments and other structures may survive and may execute in another reader. Do not treat a watermarked untrusted PDF as safe.

## Local development and verification

Use Node **24** (verified 24.21.0; package also permits 26 but this report does not verify it).

```sh
npm install --include=dev
npm run dev
npm run check
npm run lint
npm run test:unit
npx playwright install chromium
npm run test:browser -- --workers=2
npm run build
```

Production-header verification uses `dist`, not Vite preview:

```sh
# Requires Poppler's pdftoppm for the independent PDF zoom artifact (dev-only).
npx playwright test -c playwright.csp.config.ts --project=chromium --workers=2
# Manual loopback HTTP server (not a deployment):
node scripts/serve-production.mjs
```

The CSP suite builds automatically and serves on `http://127.0.0.1:5174`. It tests actual response CSP/nosniff, hashed-asset caching, HTML ETag revalidation, JPEG worker/main fallback, HEIC/PDF lazy assets, download privacy and axe accessibility in both themes. `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` optionally selects an existing Chromium installation when the download is unavailable. No machine-specific path is required in project config. Firefox/WebKit projects exist in the CSP config; do not claim they pass until their real executables and tests run. Targets Chrome 111+, Safari 16.4+, Firefox 128+ are intended minima, **not tested support claims**.

## Hosting and licenses

No host was selected, deployed or published. `scripts/serve-production.mjs` is a loopback verification artifact, not an HTTPS production service. Before any release, choose a host with the user, implement its actual header/cache configuration, verify HTTPS and lazy worker MIME, archive the previous immutable build, rehearse that host's exact rollback command and rerun the privacy/CSP suite against it. Those host-specific commands cannot truthfully be supplied yet.

See [third-party notices](THIRD_PARTY_NOTICES.md). UI and watermark use the platform system font; PDF libraries are MIT/Apache-2.0. The embedded HEIC decoder is LGPL-3.0: notices/npm audit are **not** corresponding-source, build/relink or legal-compliance evidence. Distribution remains blocked. BentoPDF (alam00000/bentopdf, AGPL-3.0) was a research reference; no source was copied/adapted. Reference repositories and throwaway spikes are not release artifacts.
