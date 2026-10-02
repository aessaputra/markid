# Third-party notices

## Geist font

MarkID bundles unmodified local Geist assets from `@fontsource/geist` 5.2.8 (locked in package-lock.json). Imported Latin 400/500/600 CSS is processed by Vite into same-origin WOFF/WOFF2 assets; no font CDN is used. Renderer currently requests regular weight 400.

Copyright 2024 The Geist Project Authors (https://github.com/vercel/geist-font.git).
Licensed under SIL Open Font License 1.1. Complete copyright and license are shipped at `public/licenses/geist-OFL.txt` (available in built output at `/licenses/geist-OFL.txt`).

No code was copied from the reference repositories in Task 3.

## heic-to 1.6.5

Pinned unmodified npm package; only lazy `heic-to/csp` entry is bundled. Copyright Hopper Gee; LGPL-3.0, complete package license at `public/licenses/heic-to-LGPL-3.0.txt`. Upstream source/build instructions: https://github.com/hoppergee/heic-to/tree/v1.6.5 (tag API returned HTTP 200 during Task 8; reproducible decoder build remains unverified); npm exact source distribution: https://registry.npmjs.org/heic-to/-/heic-to-1.6.5.tgz. The CSP entry contains a Blob worker and embedded compiled libheif decoder. Not a MIT dependency.

Release compliance gate: archive corresponding source/build inputs for embedded libheif/libde265 and other compiled components, verify all upstream notices and LGPL relinking/replacement obligations before distribution. Package tarball contains wrapper/build files but not its referenced `src/lib` decoder build sources; this notice alone does NOT establish complete LGPL compliance. No deployment is authorized by this task.

Task 8 audit: upstream README maps heic-to 1.6.5 to libheif 1.23.5 and describes libde265 1.0.16, Emscripten, `USE_UNSAFE_EVAL=0 USE_WASM=0` build flags. This is a starting recipe, not a recovered exact toolchain/source archive or successful rebuild. LGPL-3.0 section 4 requires notices, GPL plus LGPL copies, and a suitable replacement mechanism or Minimal Corresponding Source plus Corresponding Application Code permitting recombination/relinking; installation information may also apply. The minified embedded decoder cannot be assumed to satisfy the shared-library alternative. Recover every compiled dependency/version/patch, toolchain and build scripts; demonstrate rebuilding and substituting a modified decoder and delivering required source/application materials before distribution. GPL companion delivery and all component notices also need completion. See the bundled LGPL text, https://www.gnu.org/licenses/lgpl-3.0.html and https://github.com/hoppergee/heic-to#development-guide. No legal-compliance determination is made.

## PDF dependencies and assets

`pdf-lib` 1.17.1: MIT, copyright Andrew Dillon and contributors; full license shipped at `/licenses/pdf-lib-MIT.txt`. Dependencies @pdf-lib/standard-fonts and @pdf-lib/upng are MIT, pako is MIT/Zlib, tslib Apache-2.0; exact versions recorded in package-lock.json. No AGPL reference code copied.

`pdfjs-dist` 4.10.38: Apache-2.0, Mozilla Foundation contributors, full license at `/licenses/pdfjs-Apache-2.0.txt`. Legacy browser build and matching worker are lazy local Vite assets. Pin selected instead of current 6.3.289: legacy build retains older-browser polyfills and documented isEvalSupported=false; Node engine >=20, tested Node24. Newest package is not evidence of target-engine compatibility. Preview uses Canvas only, no viewer, scripting manager, link handlers, forms or annotation DOM. CMaps and standard fonts copied unmodified to `/pdf-assets/` from the pinned package; bundled Foxit PDFium fonts carry BSD-style LICENSE_FOXIT and Liberation fonts OFL LICENSE_LIBERATION in that directory. These license files are served with the font assets. Runtime fetches stay same-origin. Host optional native canvas is not shipped.

## Development-only tools

Exact installed package license metadata is recorded in `docs/testing/artifacts/package-license-inventory.json` (includes runtime and development packages). @axe-core/playwright/axe-core 4.11.1 are MPL-2.0 and used only for tests; Playwright and TypeScript are Apache-2.0; Svelte/Vite/Vitest/Tailwind tooling is MIT. Poppler pdftoppm 24.02.0 is an installed independent test renderer, not bundled into MarkID. Metadata inventory is not a transitive compiled-code license audit. `npm audit --include=dev` returned zero reported vulnerabilities, not a license/security guarantee.

## Codec fixtures

`tests/fixtures/codecs`: original geometric artwork dedicated to CC0-1.0 (https://creativecommons.org/publicdomain/zero/1.0/), generated locally with Pillow/pillow-heif. These are genuine codec bitstreams, not camera/device proof. Encoder, dimensions and SHA-256 are recorded in `manifest.json`. Encoder software is development-only, not shipped by the app.
