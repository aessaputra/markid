# PDF adapter evidence — Task 7

Local Chromium desktop evidence only; release remains **BLOCKED** on Firefox/WebKit, physical Android/iOS, readability/memory and existing LGPL decoder compliance gates. No deployment.

## Contract
- `LoadedPdf` owns fresh original bytes and lazy PDF.js document; `loadPdf(File)`, `previewPdf(pdf, zeroBasedPage)`, `exportPdf(pdf, Watermark)`.
- Input decimal 10MB applies before reads; PDF output is not limited to JPEG 1MiB. Output preview renders saved PDF bytes, no iframe/viewer scripting.
- Encrypted documents rejected before PDF.js with exact locked message; no ignoreEncryption. Recognized Sig/FT Sig/ByteRange dictionaries rejected conservatively. This is not foolproof signature detection, signature validity is not promised; signed-policy approval outstanding.
- Visible CropBox intersected with MediaBox; rotations 0/90/180/270. Display clockwise angle converted only at PDF image-placement boundary. Shared multiline renderer produces one normalized 1600-short-side PNG, embedded once and scaled proportionally on every page. Opacity applied only to drawImage, including zero.
- Fresh pdf-lib load from original bytes per export preserves text/vector/scan content; not flattening/redaction/anti-removal. Original active content may be preserved in downloaded PDF; Canvas preview does not execute scripts/links/forms/annotations. Not a sanitizer.
- Preview experiment capped 1600-side / 2M pixels, one active page; revisions cancel obsolete render/page fetch and teardown destroys loading task. These caps are not device-safety guarantees. Assets use origin-root `/pdf-assets/` (subpath deployment requires base-path work).

## Fixtures
Generated locally with pdf-lib 1.17.1 by `scripts/generate-pdf-fixtures.mjs`: genuine synthetic PDFs, text/vector mixed page sizes; scan from original alpha PNG; four rotated/nonzero CropBox pages; sentinel signature dictionary (not cryptographically signed); deterministic random uncompressed RGB scan >1MiB, <10MB; malformed PDF. CC0 original art, no personal data. Hashes and sizes in `tests/fixtures/pdf/manifest.json`.
`locked.pdf`: pypdf 6.19.0 PdfWriter append(two-pages), encrypt(test-password), default RC4; synthetic encrypted bitstream. Recreate with `uv run --with pypdf python -c` and PdfReader/PdfWriter; password test-only, never requested by UI.

## Actual verification
Node 24.21.0 via `npx -y -p node@24 -c`; npm `--include=dev`. Chromium executable opt-in `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/home/aessaputra/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome`.
- `npm run check`: 0 errors/warnings.
- `npm run test:unit`: 9 files, 52 tests pass.
- `npm run test:browser -- --workers=2`: 164 pass, 14 production-only skips, 53.9s.
- `npm run test:browser -- --config=playwright.csp.config.ts --project=chromium`: 22 pass (14.3s). Production PDF initially failed because server sent .mjs as octet-stream under nosniff; corrected JavaScript MIME, no CSP relaxation.
- Build succeeds (large decoder chunk warning retained). npm audit 0 vulnerabilities at install.
- PDF adapter real output: page counts/text equal, repeated rendered pixels equal (no stacking), opacity0 pixels equal source, rotated/mixed/scanned centroid difference <1.5 backing pixels vs independent Canvas overlay. Large PDF output >1MiB loads with pdf-lib. Active JavaScript sentinel causes no dialog/network.
- Autofixer all four changed Svelte components: no issues; async resource/URL effect and action suggestions reviewed/retained for explicit cleanup (not synchronous derivations).

## Scope limitations
Newest PDF.js 6.3.289 evaluated then pinned 4.10.38 legacy build for older-browser polyfills/isEvalSupported API; matching local worker/font/CMap assets. Engine minimums remain unverified, not claimed supported. Asset fixed raster scale needs physical readability validation. Signature check recognizes dictionaries, not all adversarial variants. No AGPL code copied; LGPL image decoder release obligations unchanged.
