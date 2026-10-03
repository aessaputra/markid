# Device-capacity policy verification — 2026-10-03

Local verification only; no commit, push or deployment. Browser executable selected by PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/home/aessaputra/.hermes/tools/chromium-1208/chrome-linux64/chrome.

- `npm run check`: 0 errors / 0 warnings; TypeScript succeeds.
- `npm run build`: 328 modules; successful. Existing mixed PDF static/dynamic imports, large HEIC/PDF chunks and Node module.register deprecation warnings remain.
- `npm run test:unit`: 10 files, 53 passed.
- `npm run test:browser -- --workers=2`: final run 172 passed, 18 production-only skipped (190 total).
- `npx playwright test -c playwright.csp.config.ts --project=chromium --workers=2`: 33 passed; real built CSP, worker/main export, privacy and accessibility.
- Svelte autofixer: App, EditorPreview, PdfPreview, ResultView have no issues; generic async effect/action suggestions retained for resource ownership.

TDD: real 12MP input first failed (3265×2449 instead of 4000×3000), then original 12MP/48MP decode passed; noisy 2400×3200 JPEG first failed (>1MiB expected, 961149 bytes received), then real worker and main exports passed unchanged dimensions. PDF sampling unit failed before helper implementation, then passed; responsive browser test verifies actual raster fitting ×2, >2MP/>1600px display sampling, navigation and replacement. Orientation/alpha, corrupt replacement, locks, rotated selection/four-corner and native Chromium touch regressions ran in the full suite.

Higher-resolution PDF raster comparison exposed nondeterministic ±1 channel-value differences in 58–59 samples across repeated renders. Independent exported PDF image-stream bytes are now asserted identical, while rendered repeated output has a strict maximum difference of 1; zero-opacity equality, page text, placement counts, bounds, covariance and intensity assertions remain. Earlier full/repeated runs failed this exact-equality assertion; only the final stated run is green. This is not a relaxation of source/content preservation.

Physical Android/iOS, Firefox/WebKit, minimum-browser versions, camera/HDR/color fidelity, unlimited capacity and distribution/hosting gates are not verified. Memory exhaustion is possible. Historical specs/reports/artifact counts describe the former policy and are not current release evidence.
