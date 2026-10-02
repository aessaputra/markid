# Release verification matrix — 2026-10-02

**Overall release: BLOCKED.** Local implementation verification is not permission to deploy/distribute. Source base: `724a987`, branch `feat/markid`. No hosting selection, push or deployment.

## Executed evidence

Environment: Linux x86_64; Node 24.21.0 / npm 11.19.0; Google Chrome for Testing **153.0.8010.12**, cached executable selected via environment. Playwright 1.58.2, Svelte 5.57.1, svelte-check 4.3.6, TypeScript 5.9.3, Vitest 4.1.11, Vite 7.3.6, Tailwind 4.1.18, @axe-core/playwright 4.11.1 (wrapper), axe-core 4.11.4 (engine), Poppler 24.02.0. Dependency versions and licenses: [inventory](artifacts/package-license-inventory.json).

| Gate | Status | Actual evidence / scope |
|---|---|---|
| Type/Svelte check | PASS | 0 errors, 0 warnings; tsc succeeds |
| Unit | PASS | 9 files / 53 tests |
| Desktop Chromium browser suite | PASS | 182 passed; 18 deliberately skipped production-only tests (not PASS) |
| Build | PASS | 332 modules; mixed static/dynamic PDF import and >500KB chunk warnings remain |
| Production HTTP/CSP | PASS | 33 tests (fix1) on loopback built dist, actual CSP/nosniff; HEVC blob worker, local PDF mjs worker, positively observed hashed JPEG worker with matching successful reply/download bytes and zero main Canvas encodes; forced main Canvas fallback tested separately |
| HTML/cache | PASS | no-cache HTML with SHA256 ETag, matching If-None-Match → 304 empty; hashed JS immutable + conditional 304 |
| Image/HEIC/PDF privacy | PASS (observed paths) | actual downloads; context-wide all-method requests, exact origin including scheme/port, production asset-path allowlist/no query, secret/name/raw base64+hex URL checks, no body, console secret/name checks; no cookies, Storage writes, IDB databases, Cache writes/keys or SW registrations; production no websocket |
| Accessibility | PASS (automated scope) | 20 WCAG2/2.1 A/AA axe scans per server (empty/editor/results × 2 widths × 2 themes), zero violations; keyboard file chooser/text/tab/disclosure/position/Preview; 320px no horizontal overflow. Not a complete accessibility certification/screen-reader assessment |
| Synthetic final quality | PASS (fixture only) | actual downloaded 1600×1000 JPEG, 77,750 bytes; 12/16/20/24/32px text visually readable at original size. Watermark overlaps 24px line; deliberate composition is not guaranteed document readability. Downloaded PDF rendered independently at 216dpi: glyphs readable, no missing glyphs/clipping at inspected crop |
| Firefox engine | BLOCKED | launch fails: firefox-1509 executable absent; bounded previous installation timed out; no new download retry |
| WebKit engine | BLOCKED | launch fails: webkit-2248/pw_run.sh absent; no new download retry |
| Minimum Chrome111/Safari16.4/Firefox128 | BLOCKED | only Chromium153 executed; engine automation is not those actual versions |
| Physical Android low-/mid-range | BLOCKED | no device; memory/crash/timing/drag/virtual keyboard/background-return evidence absent |
| Physical Safari iOS | BLOCKED | no device; camera HEIC/native decode and lifecycle evidence absent |
| Real camera 12MP/48MP and huge sources/HDR/color | BLOCKED | synthetic 12MP/48MP desktop tests PASS loading only; never mobile/camera-memory evidence |
| Final working/JPEG/PDF quality policy | BLOCKED | physical/readability matrix needed; retain experimental 4096px/8MP, 16 candidates, 1600 normalized PDF layout; no universal minimum approved |
| LGPL source/build/relink/distribution | BLOCKED | inventory/notices and upstream recipe available, exact corresponding decoder sources/toolchain/build/replacement demonstration not completed; no legal compliance claim |
| Host HTTPS/rollback | BLOCKED | user has not selected host; local HTTP only; no invented provider/config/rollback command |

Privacy claims cover the executed app paths, not a mathematical proof against arbitrary encoded/covert leakage, browser extensions or compromised hosting. Development Vite HMR websocket is permitted only at the dev server host and is not present in production. Lazy static assets are legitimate network requests; a GET-only or hostname-only assertion is insufficient. Only theme persistence is permitted; separate theme regression tests cover it. Sensitive test files are not used.

## Reproduction

On this host (standard Node24 setup can omit the npx wrapper):

```sh
npx -y -p node@24 -c 'npm install --include=dev'
export PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/home/aessaputra/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome
npx -y -p node@24 -c 'npm run check && npm run test:unit && npm run test:browser -- --workers=2 && npm run build'
npx -y -p node@24 -c './node_modules/.bin/playwright test -c playwright.csp.config.ts --project=chromium --workers=2'
npx -y -p node@24 -c './node_modules/.bin/playwright test -c playwright.csp.config.ts --project=firefox --project=webkit privacy.spec.ts --max-failures=1 --workers=1'
# Run WebKit separately: first failure stops the combined invocation.
npx -y -p node@24 -c './node_modules/.bin/playwright test -c playwright.csp.config.ts --project=webkit privacy.spec.ts --max-failures=1 --workers=1'
npx -y @sveltejs/mcp svelte-autofixer ./src/App.svelte --svelte-version 5
npx -y -p node@24 -c 'npm audit --include=dev'
```

Full real outputs: [check/unit/browser/build](artifacts/task-8-check-unit-browser-build.log), [production](artifacts/task-8-production.log), [all component autofixer](artifacts/task-8-autofixer.log), [WebKit blocker](artifacts/task-8-webkit-blocked.log). Autofixer found no issues; generic effect/attachment suggestions retained after reviewing async resource ownership/stale cleanup (not a claim of zero suggestions). npm audit returned zero reported vulnerabilities. Initial full browser invocation without executable override failed at launch; corrected full command above passes. Initial release header test failed because ETag was missing; server now supports conditional responses. A production namespace probing attempt for zoom failed; independent Poppler replaced that test-only probe.

## Fix1 worker evidence and sensitivity — 2026-10-02

Fresh actual commands use the cached Chromium environment and Node24 wrapper above: check/unit/browser/build exit0 (0 errors/warnings, 53 unit, 182 browser PASS/18 production-only skipped), production suite exit0 (33 PASS), final check exit0. Logs: [full suite/build](artifacts/task-8-fix1-check-unit-browser-build.log), [production](artifacts/task-8-fix1-production.log), [final check/versions](artifacts/task-8-fix1-final-check.log), [targeted GREEN](artifacts/task-8-fix1-worker-green.log). Accessibility runs as part of the required suites, not because metadata correction requires a rerun. Wrapper4.11.1 and engine4.11.4 are distinct; tslib1.14.1 is 0BSD.

The new `release.spec.ts` test transparently delegates native Worker construction/postMessage and Canvas encode methods, observes real messages without replacing results, checks same-origin hashed worker URL and Playwright worker event, matching id1/revision4, successful JPEG Blob, exact downloaded-byte equality, independently decoded80×120 size, and zero HTML Canvas toBlob/toDataURL calls/CSP violations/page errors. [Observed summary](artifacts/jpeg-worker-evidence.json); [actual downloaded worker JPEG](artifacts/worker-final.jpg):1,367 bytes, SHA256 `04616be179d6b1a4280407588aaa01073b67c48d35fa66fd55a63fe99c3f41dd`. This is worker-use evidence, not small-text readability evidence.

Sensitivity RED: temporarily inserted `return false` in `workerAvailable()` and ran `./node_modules/.bin/playwright test -c playwright.csp.config.ts --project=chromium release.spec.ts -g "production hashed JPEG" --workers=1` under the same env/Node wrapper. [RED log](artifacts/task-8-fix1-worker-red.log) exit1: actual fallback download passed JPEG size/signature assertions, then expected1 worker/received0 failed. Mutation restored byte-for-byte, targeted command exit0; final production rebuild verified original dist manifest unchanged (210 files, zero missing/extra/hash differences). No security headers or application code changed. Existing synthetic quality files remain the original visually reviewed artifacts below; regeneration during suite execution is not substituted silently. Full-release BLOCKED rows are unchanged.

## Artifact identity and quality review

[dist-sha256.json](artifacts/dist-sha256.json) records every built file. Hash of sorted `sha256 + two spaces + relative path + newline` manifest: **921472c95880690c8c688579d5aa0415ccb9a19246aa5bed7e56034130e95aca**. Dist remains local/ignored, not distributed.

Committed non-sensitive test artifacts (original generated fixture dedicated CC0; not camera evidence):
- [source PNG](artifacts/small-text-source.png), 95,948 bytes, SHA256 `82828bbe2b27614f25b4f4ac735117b1143897abc8a39f4a63559f4c6b7d5ffc`.
- [actual downloaded JPEG](artifacts/small-text-final.jpg), 77,750 bytes, SHA256 `b349413feaaf7f7c244a68bd1e81d002a92a308ed3875e81461bca1213cd6f77`.
- [actual downloaded PDF](artifacts/watermark-final.pdf), 22,526 bytes, SHA256 `eef858b233376722d2425f504009304168bdb37411a13e79a1d0f9d2b262f5b6` (timestamps may change on regeneration).
- [independent 3× PDF render](artifacts/pdf-watermark-3x.png), 33,095 bytes, SHA256 `64fc3ad89eb93f6495e69dd21f5dea698c5d1aed3d5808ac0f431b665100f17f`.

Visual inspection used actual saved JPEG at 1600×1000 and PDF crop [250,650,1500,1300] from the 3× render. No physical/OCR/readability success is inferred beyond this high-contrast synthetic card. Candidate compression of a noisy photograph, real identity-document tiny text and camera profiles need evidence before accepting final quality floors.

## Required physical run (all currently BLOCKED)

Record device model/RAM/OS/browser version, source provenance/hash, wall timings, crashes and visible correctness on Android low/mid-range and Safari iOS. Exercise real source12/48MP within 10MB, HEIC fallback/native, multipage PDF, exact 10MB boundary/rejection, 20 replacements/exports, touch drag response, virtual keyboard, landscape, background/foreground return, both themes and final original-size text. Do not substitute desktop viewport emulation or synthetic compressed color canvases for these rows.

## Operational release/rollback gate

No host-specific deployment configuration or commands exist because no host was selected. After selection and authorization: configure HTTPS, actual CSP/cache/nosniff and .mjs MIME on that host; retain previous dist + full hashes; verify cold/warm lazy assets and HTML update/revalidation; run this suite against the real HTTPS origin; rehearse the provider's exact rollback to previous build, including HTML/asset consistency. Record those commands/results before PASS. Local server only listens on loopback and has no TLS/deployment/rollback capability.

## Deferred final-review findings preserved

Task1 origin assertion fixed here; registered-font check already strengthened. Task2 JPEG fill-byte read amplification and skinny custom-policy maxPixels remain minor review items. Task3 temporary cache rejection cleanup was fixed earlier. Task4 live DPR reactivity remains deferred; file helper linkage is already tested. Task5 lifecycle/drag evidence strength and temporary watermark Canvas reset remain deferred. Task6 low-priority double-close remains deferred. No unrelated refactor was used to hide these. Signed PDF enabling still requires an explicit policy; exported PDFs are not sanitized, redacted or signature-preserving.
