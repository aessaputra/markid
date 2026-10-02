# Third-party notices

## Geist font

MarkID bundles unmodified local Geist assets from `@fontsource/geist` 5.2.8 (locked in package-lock.json). Imported Latin 400/500/600 CSS is processed by Vite into same-origin WOFF/WOFF2 assets; no font CDN is used. Renderer currently requests regular weight 400.

Copyright 2024 The Geist Project Authors (https://github.com/vercel/geist-font.git).
Licensed under SIL Open Font License 1.1. Complete copyright and license are shipped at `public/licenses/geist-OFL.txt` (available in built output at `/licenses/geist-OFL.txt`).

No code was copied from the reference repositories in Task 3.

## heic-to 1.6.5

Pinned unmodified npm package; only lazy `heic-to/csp` entry is bundled. Copyright Hopper Gee; LGPL-3.0, complete package license at `public/licenses/heic-to-LGPL-3.0.txt`. Upstream source/build instructions: https://github.com/hoppergee/heic-to/tree/v1.6.5 (verify tag availability before release); npm exact source distribution: https://registry.npmjs.org/heic-to/-/heic-to-1.6.5.tgz. The CSP entry contains a Blob worker and embedded compiled libheif decoder. Not a MIT dependency.

Release compliance gate: archive corresponding source/build inputs for embedded libheif/libde265 and other compiled components, verify all upstream notices and LGPL relinking/replacement obligations before distribution. Package tarball contains wrapper/build files but not its referenced `src/lib` decoder build sources; this notice alone does NOT establish complete LGPL compliance. No deployment is authorized by this task.

## PDF dependencies and assets

`pdf-lib` 1.17.1: MIT, copyright Andrew Dillon and contributors; full license shipped at `/licenses/pdf-lib-MIT.txt`. Dependencies @pdf-lib/standard-fonts and @pdf-lib/upng are MIT, pako is MIT/Zlib, tslib Apache-2.0; exact versions recorded in package-lock.json. No AGPL reference code copied.

`pdfjs-dist` 4.10.38: Apache-2.0, Mozilla Foundation contributors, full license at `/licenses/pdfjs-Apache-2.0.txt`. Legacy browser build and matching worker are lazy local Vite assets. Pin selected instead of current 6.3.289: legacy build retains older-browser polyfills and documented isEvalSupported=false; Node engine >=20, tested Node24. Newest package is not evidence of target-engine compatibility. Preview uses Canvas only, no viewer, scripting manager, link handlers, forms or annotation DOM. CMaps and standard fonts copied unmodified to `/pdf-assets/` from the pinned package; bundled Foxit PDFium fonts carry BSD-style LICENSE_FOXIT and Liberation fonts OFL LICENSE_LIBERATION in that directory. These license files are served with the font assets. Runtime fetches stay same-origin. Host optional native canvas is not shipped.

## Codec fixtures

`tests/fixtures/codecs`: original geometric artwork dedicated to CC0-1.0 (https://creativecommons.org/publicdomain/zero/1.0/), generated locally with Pillow/pillow-heif. These are genuine codec bitstreams, not camera/device proof. Encoder, dimensions and SHA-256 are recorded in `manifest.json`. Encoder software is development-only, not shipped by the app.
