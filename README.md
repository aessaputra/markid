<img src="public/favicon.svg" width="40" height="40" alt="MarkID icon" />

# MarkID

Add a text watermark to an image or PDF before sharing. Files, filenames, and watermark text are processed in your browser, without uploads or automatic file storage.

Built with Svelte 5, TypeScript, Vite, and Canvas. PDF preview uses PDF.js; PDF export uses pdf-lib.

> [!IMPORTANT]
> MarkID is experimental and has not been deployed. Physical-device, cross-browser, and embedded HEIC decoder LGPL distribution checks remain incomplete. See the [third-party summary](#third-party).

## Features

- Single or tiled multiline watermarks, with size, color, opacity, and angle controls.
- Nine position presets, plus drag and corner resizing in Single mode.
- Adjustable horizontal and vertical spacing in Tiled mode.
- Final output preview before download; every export starts from the original source.
- Failed file replacements keep the previous editor. Reset restores watermark settings without removing the file.
- Responsive controls, keyboard alternatives to dragging, and a theme that follows the system without storing a preference.

## Getting started

### Prerequisites

- Node.js **24** and npm. Node.js 26 is also permitted by `package.json`.

### Run locally

```sh
npm ci --include=dev
npm run dev
```

### Checks and build

```sh
npm run lint
npm run check
npm run test:unit
npx playwright install chromium
npm run test:browser -- --workers=2
npm run build
```

Vite writes the static site to `dist/`. When the Playwright browser download is unavailable, `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` can select an existing Chromium executable.

Production-header tests build and serve `dist/` on loopback with the test server's CSP, MIME, and cache settings:

```sh
# Requires Poppler's pdftoppm for the independent PDF zoom artifact.
npx playwright test -c playwright.csp.config.ts --project=chromium --workers=2
```

These tests cover headers, caching, worker/fallback exports, privacy, and accessibility. They do not verify a deployed site. Firefox/WebKit projects are configured, but successful execution is still required before claiming support.

## Usage

1. Choose a file or drag it into the picker.
2. Edit the watermark and choose **Single** or **Tiled**.
3. Select **Preview** to generate and inspect the final output.
4. Select **Download**, or **Back to edit** to make changes.

| Input | Output | Notes |
|---|---|---|
| JPEG, PNG | JPEG | Orientation is normalized; transparent pixels become white. |
| Static WebP, AVIF | JPEG | Format and transform coverage depends on the browser. |
| HEIC, HEIF | JPEG | Native decoding is attempted first, with a pinned CDN-loaded HEIC decoder fallback. |
| PDF | PDF | Watermark added to every page; original page content is not rasterized on export. |

Synthetic fixtures have been exercised in desktop Chromium, including image orientation and PDF CropBox/rotation. This is not universal format or real-camera compatibility. Animated images and collections are outside scope. Locked PDFs and recognized signature fields/dictionaries are rejected.

## Privacy and limitations

- No accounts, backend, analytics, uploads, or automatic file persistence. App and PDF assets remain local to the app origin. If native HEIC decoding fails, the browser fetches the pinned decoder library from jsDelivr; this sends ordinary request metadata to the CDN, not your file or watermark. HEIC fallback requires network/CDN availability unless the browser has cached the library; offline operation is not guaranteed.
- Photos retain their full decoded dimensions. JPEG output is encoded once at quality `0.92`, without a fixed input-byte, megapixel, or output-byte cap. Large files can exceed browser/device capacity and fail.
- Hosting can log ordinary access metadata. Browsers and operating systems may retain caches, memory, or downloaded files; instant physical erasure is not promised.
- Firefox, Safari, minimum browser versions, physical Android/iOS devices, HDR, and color/profile fidelity are not yet verified.

> [!WARNING]
> A watermark is not redaction, encryption, or tamper-proof protection. PDF export is not a sanitizer: original links, actions, attachments, and other active content may survive and execute in another reader. Inspect the final file before sharing it.

## Third-party

### LGPL Components (Pre-configured via CDN)

| Component | License | Features Enabled |
|---|---|---|
| [heic-to 1.6.5](https://github.com/hoppergee/heic-to/tree/v1.6.5) | [LGPL-3.0](https://github.com/hoppergee/heic-to/blob/v1.6.5/LICENSE) | HEIC/HEIF fallback decoding to bitmap, including upstream libheif/libde265. |

Loaded only after native HEIC decoding fails, from the pre-configured [pinned CSP module](https://cdn.jsdelivr.net/npm/heic-to@1.6.5/dist/csp/heic-to.js); no URL setting is required. The decoder is not bundled in MarkID's build. Decoding and JPEG export remain on-device; fetching the library requires CDN/network availability. CDN delivery does not by itself resolve license obligations.

### Bundled components

| Component | License | Features Enabled |
|---|---|---|
| [pdf-lib 1.17.1](https://github.com/Hopding/pdf-lib) | MIT | PDF export; includes standard-fonts (MIT), upng (MIT), pako (MIT/Zlib), and tslib (0BSD). |
| [PDF.js 4.10.38](https://github.com/mozilla/pdf.js/tree/v4.10.38) | Apache-2.0 | PDF preview and worker. |
| Svelte and bundled helpers | MIT | Application UI; exact dependencies are recorded in `package-lock.json`. |
| PDF CMaps and standard fonts | BSD-style / OFL, as supplied by PDF.js | Local rendering assets; upstream license files remain alongside these assets. |

UI and watermarks use system fonts; no webfont is bundled. This table is a summary, not a complete distribution license package. HEIC decoder distribution verification remains incomplete.
