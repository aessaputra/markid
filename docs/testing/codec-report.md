# Task 6 codec verification — local, not release-ready

2026-10-02. Linux desktop, Node 26.7.0, Vite 7.3.6, Playwright 1.58.2; Chromium cached executable `chromium-1243/chrome-linux64/chrome`. No deployment/push. References and spikes unchanged.

## Actual results

- RED: initial genuine fixture header suite failed 7/7 with Unsupported format. After bounded RIFF/BMFF metadata support: 7/7 GREEN.
- RED: genuine HEIC/HEIF UI tests failed 2/7 because Preview remained disabled (native codec absent). Lazy CSP bitmap fallback: 7/7 GREEN; native WebP/AVIF already passed after signature/header integration.
- RED: serialized-load test observed two native decodes rather than one. Decode allocation queue: 5/5 load unit tests GREEN, existing controller stale-disposal tests unchanged and passing.
- Full check: 0 errors/0 warnings. Full unit final rerun: 39 passing. Full browser regression final rerun: 143 passing, 1 production-only CSP test intentionally skipped on dev server. Later pixel suite: 4 passing; check rerun clean. Build successful.
- Production CSP Chromium final: 9/9 passing, rerun clean. All six still fixtures load/export genuine JPEG <=1 MiB. HEVC lazy chunk fetched locally, no unsafe-eval, no page CSP violations, no page errors, no external or non-GET requests in tested path; private test mark absent from request URLs.
- Production matrix attempted: Chromium 8 PASS; Firefox 8 BLOCKED (missing firefox-1509 executable), WebKit 8 BLOCKED (missing webkit-2248 executable). Tool reports 16 launch failures, not codec failures. No browser download loop.
- npm audit (including dev): 0 vulnerabilities. git diff --check clean.
- Build warning retained: lazy decoder chunk ~3.19 MB, gzip ~774 KB; entry JS ~64.5 KB. Node26 module.register deprecation warnings from test tooling; not hidden.

## Fixtures and supported subset

`tests/fixtures/codecs/manifest.json` records SHA-256, dimensions, encoder and CC0 artwork provenance. Script generates genuine HEVC HEIF via Pillow-heif 1.8.0/libheif 1.23.4/x265 4.2+1, WebP/AVIF via Pillow 12.3.0. None is a renamed JPEG. None is iPhone/device/camera evidence.

Measured: HEVC landscape 320x240 and physically rotated pixel portrait 240x320; WebP lossy/lossless/alpha; SDR 8-bit still AVIF. Quadrant pixels and proportional resize to maxSide160 pass; WebP alpha remains128 before JPEG compositing. Portrait fixture is baked pixel rotation, NOT metadata orientation evidence. Metadata rotate/mirror fixtures added in fix1 below; camera HDR, iPhone/Android HEIF and large HEVC source fixtures remain release gates. No HDR color-change measurement exists; export is SDR Canvas/JPEG and HDR/ICC preservation is not promised.

Static policy: reject animated WebP (VP8X animation flag/ANIM/ANMF), sequence BMFF brands avis/msf1/hevc/hevx, and BMFF with not exactly one non-hidden item. Generated two-image HEIF and animated WebP both reject while retaining old editor. heic-to source selects data[0]; reject collections before reaching it, do not silently select an arbitrary photo. Hidden auxiliary/tile items do not count as independent visible pictures. Advanced layouts may reject: extended/zero-sized BMFF boxes, old infe versions, ambiguous/multiple visible item layouts. This small metadata probe is not a full ISO-BMFF decoder/property association implementation. It chooses the largest ispe as allocation metadata; actual normalized bitmap dimensions determine modern-image working ratio.

Reads bounded <=65,536 bytes, ftyp <=4,096 bytes, depth<=5, metadata/chunk walk<=4,096 entries, declared container ends validated. AVIF brands take precedence over HEVC; generic mif1 alone is not enough to route to HEVC. Malformed/truncated containers fail closed. Source >8MP is not rejected: existing 12/48MP JPEG/PNG tests still pass; modern-source mobile memory remains unverified.

## Architecture / CSP / licensing

`decodeHeif(File, ImagePolicy): Promise<LoadedImage>` uses lazy `heic-to/csp` 1.6.5 bitmap output, no intermediate JPEG. Native success bypasses HEVC; AVIF/WebP errors never use it. Bitmap normalization fits from actual orientation-normalized decoded size and closes full bitmap after resize; resource dispose is idempotent. `loadImage` serializes active decode allocations; controller revisions dispose stale results. Queue does not cancel already executing or queued decode work.

Actual 1.6.5 CSP package uses a local Blob worker (source index.js/esbuild.mjs checked), despite earlier source assumptions that only next would use workers. Worker builds full ImageData before bitmap resize. Internal singleton worker/Blob URL remains owned by package for page lifetime; this task does not promise instantaneous memory reclamation. next entry not used or tested. Responsiveness/memory on target mobile hardware BLOCKED.

Local production server `scripts/serve-production.mjs` serves dist with actual CSP headers, script-src self (no unsafe-eval), worker-src self/blob, same-origin fonts/connect and blob previews, base/frame/form/object blocked. style-src unsafe-inline retained for Svelte dynamic style attributes, NOT script eval. This is a verification server, not a selected host deployment artifact or HTTPS proof.

heic-to is LGPL-3.0, not MIT. License copied into public/licenses; THIRD_PARTY_NOTICES includes exact npm distribution/source links and unresolved corresponding-source/build/relinking compliance gate for compiled embedded decoder. npm package lacks referenced src/lib build inputs. Do not distribute until compliance resolved. No AGPL/reference code copied.

## Outstanding release blockers

Physical Android/iOS, Firefox/WebKit, genuine device orientation/HDR, HEVC huge-source memory, mobile responsiveness, final JPEG readability, working-resolution safety selection, and full compiled dependency license/source audit. No production-ready claim.

## Fix1 — display geometry and local BMFF bounds (2026-10-02)

Base `0ae2e94`, local `feat/markid`, Node24 via `npx -y -p node@24 -c`. No push/deploy/distribution.

### Evidence and behavior
- Genuine new encoder fixtures: rotate/mirror WebP TIFF EXIF6/2, AVIF and HEVC HEIF associated `irot=03` / `imir=01`. Coded `ispe` remains320x240; rotate display240x320; mirror display320x240. Manifest contains hashes/encoded/display size/transform/provenance; artwork CC0, no camera claim. `scripts/verify-codec-transforms.py` validates associations/payloads and all14 hashes; fixture-only inspection, not app parser.
- Pillow-heif needs EXIF **bytes**, not an Image.Exif object: initial object fixture lacked irot and was discarded/regenerated before conclusions. WebP bare TIFF plus standard Exif preamble both did not auto-orient in this Chromium; app now strips EXIF before native decode and applies its IFD0 transform exactly once. Thus engines that do support EXIF cannot double-apply it. Working fit uses real decoded dimensions; mirror/rotate retain ratio. No encoded-size bitmap retry in modern HTML fallback.
- Direct pinned `heic-to/csp` raw bitmap measured rotate240x320 B/R/Y/G and mirror320x240 G/R/Y/B **before adapter normalization**. No HEIF manual correction added: libheif already handles these container transforms. Chromium HEIF primary attempts native but actually reaches libheif (native HEVC unsupported); forced fallback separately passes. This is not native HEVC engine proof, nor arbitrary HEIF EXIF-only orientation proof.
- AVIF native bitmap and forced HTML naturalWidth/Height both yield display orientation. Native modern bitmap fitting uses its actual display size; HTML fitting uses actual natural dimensions. Final JPEG quadrant/dimension parity checked both through direct API (maxSide160) and real dist UI download (full320x240/240x320) under production CSP.
- BMFF reads checked against parent and owning payload end. Minimum meta4/iinf6-or8/infe13-or15 bytes, infe name terminator, iinf exact child entry count/types, bounded count/depth retained. Largest ispe remains a metadata probe only, never modern display geometry. No full container parser introduced.

### Honest RED/GREEN
- Corrected genuine transform test before code: 5 failures/7 passes (WebP rotation/mirror ignored, AVIF HTML rotated source rejected). Initial invalid Watermark test setup and missing HEIF irot were setup errors, not product RED. After fallback fix AVIF green; after strip/one-transform WebP all12 green. Direct raw libheif regression added later:13 green.
- BMFF new tests:4 RED (empty/short meta, short hidden infe, mismatched iinf count accepted),3 already rejected; GREEN7, codecs+BMFF16. Added modern HTML mock no-second-bitmap test is regression-only, not a separate RED claim.

### Exact final commands/results
Run from `/home/aessaputra/Projects/MarkID`:
```sh
python3 scripts/generate-codec-fixtures.py
python3 scripts/verify-codec-transforms.py
npx -y -p node@24 -c "npm run check && npm run test:unit && npm run build"
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/home/aessaputra/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome npx -y -p node@24 -c "node node_modules/@playwright/test/cli.js test --workers=4"
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/home/aessaputra/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome npx -y -p node@24 -c "node node_modules/@playwright/test/cli.js test -c playwright.csp.config.ts --project=chromium --workers=2"
git diff --check
```
Results: hashes14 PASS; check0 errors/warnings; unit47 PASS; build PASS (3.19MB decoder chunk warning retained); full browser156 PASS/13 production-only SKIP; production Chromium21 PASS including12 transform primary/forced-fallback download tests. No unsafe-eval added, pinned1.6.5 unchanged. Nested `npx` inside Node24 wrapper EUSAGE; direct `node .../cli.js` resolves it.

Bounded alternative once: `npx -y -p node@24 -c 'node node_modules/playwright/cli.js install firefox webkit'` timed out120s at Firefox20%. No retries/download loop. Subsequent `npx -y -p node@24 -c "node node_modules/@playwright/test/cli.js test -c playwright.csp.config.ts --project=firefox --project=webkit --grep 'production rotate.avif primary' --workers=1"` gave2 missing-executable launch failures. Both engines **BLOCKED**, not PASS. Physical Android/iOS, HDR/color-change, huge HEVC memory/mobile responsiveness, full HEIF EXIF-only/device variant coverage, LGPL corresponding source/build/relinking distribution remain **BLOCKED**. Task6 full spec gate not complete; local development permitted only.

### Files / self-review
Modified load/native/headers/containers, generator+manifest, unit codec-load, CSP config, reports; added webp adapter, fixture structural verifier, BMFF tests, direct and production transform tests, six genuine fixtures. Existing binaries regenerate byte-identically. Input10MB/source>8MP policy, references/spikes, package pin/licenses unchanged. No manual HEIF transform or stretched fallback. Conservative unsupported BMFF layouts fail closed. Full-decoder allocation still precedes working fit; physical memory not certified. WebP strip bounded by accepted input10MB. Tests cover rotate/mirror subset, not all advanced metadata combinations. Existing idempotent bitmap.close double-close error-path low finding not changed.

Commit: `fix: preserve modern display geometry and bound BMFF payloads` (this report included in that local commit; hash returned by git after commit).
