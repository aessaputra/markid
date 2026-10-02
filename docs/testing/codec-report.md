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

Measured: HEVC landscape 320x240 and physically rotated pixel portrait 240x320; WebP lossy/lossless/alpha; SDR 8-bit still AVIF. Quadrant pixels and proportional resize to maxSide160 pass; WebP alpha remains128 before JPEG compositing. Portrait fixture is baked pixel rotation, NOT metadata orientation evidence. Missing irot/imir AVIF transforms, HEIF EXIF orientations/mirrors, camera HDR, iPhone/Android HEIF and large HEVC source fixtures remain release gates. No HDR color-change measurement exists; export is SDR Canvas/JPEG and HDR/ICC preservation is not promised.

Static policy: reject animated WebP (VP8X animation flag/ANIM/ANMF), sequence BMFF brands avis/msf1/hevc/hevx, and BMFF with not exactly one non-hidden item. Generated two-image HEIF and animated WebP both reject while retaining old editor. heic-to source selects data[0]; reject collections before reaching it, do not silently select an arbitrary photo. Hidden auxiliary/tile items do not count as independent visible pictures. Advanced layouts may reject: extended/zero-sized BMFF boxes, old infe versions, ambiguous/multiple visible item layouts. This small metadata probe is not a full ISO-BMFF decoder/property association implementation. It chooses the largest ispe as allocation metadata; actual normalized bitmap dimensions determine modern-image working ratio.

Reads bounded <=65,536 bytes, ftyp <=4,096 bytes, depth<=5, metadata/chunk walk<=4,096 entries, declared container ends validated. AVIF brands take precedence over HEVC; generic mif1 alone is not enough to route to HEVC. Malformed/truncated containers fail closed. Source >8MP is not rejected: existing 12/48MP JPEG/PNG tests still pass; modern-source mobile memory remains unverified.

## Architecture / CSP / licensing

`decodeHeif(File, ImagePolicy): Promise<LoadedImage>` uses lazy `heic-to/csp` 1.6.5 bitmap output, no intermediate JPEG. Native success bypasses HEVC; AVIF/WebP errors never use it. Bitmap normalization fits from actual orientation-normalized decoded size and closes full bitmap after resize; resource dispose is idempotent. `loadImage` serializes active decode allocations; controller revisions dispose stale results. Queue does not cancel already executing or queued decode work.

Actual 1.6.5 CSP package uses a local Blob worker (source index.js/esbuild.mjs checked), despite earlier source assumptions that only next would use workers. Worker builds full ImageData before bitmap resize. Internal singleton worker/Blob URL remains owned by package for page lifetime; this task does not promise instantaneous memory reclamation. next entry not used or tested. Responsiveness/memory on target mobile hardware BLOCKED.

Local production server `scripts/serve-production.mjs` serves dist with actual CSP headers, script-src self (no unsafe-eval), worker-src self/blob, same-origin fonts/connect and blob previews, base/frame/form/object blocked. style-src unsafe-inline retained for Svelte dynamic style attributes, NOT script eval. This is a verification server, not a selected host deployment artifact or HTTPS proof.

heic-to is LGPL-3.0, not MIT. License copied into public/licenses; THIRD_PARTY_NOTICES includes exact npm distribution/source links and unresolved corresponding-source/build/relinking compliance gate for compiled embedded decoder. npm package lacks referenced src/lib build inputs. Do not distribute until compliance resolved. No AGPL/reference code copied.

## Outstanding release blockers

Physical Android/iOS, Firefox/WebKit, genuine device orientation/transforms/HDR, HEVC huge-source memory, mobile responsiveness, final JPEG readability, working-resolution safety selection, and full compiled dependency license/source audit. No production-ready claim.
