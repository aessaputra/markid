# MarkID

Add a text watermark to an image or PDF before sharing. Files, filenames, and watermark text are processed in your browser, without uploads or automatic file storage.

Built with Svelte 5, TypeScript, Vite, and Canvas. PDF preview uses PDF.js; PDF export uses pdf-lib.

> [!IMPORTANT]
> MarkID is live at [markid.aes.my.id](https://markid.aes.my.id). Tested with sample files in desktop Chromium. Real phones, other browsers, and the HEIC decoder license check are still open. See the [third-party summary](#third-party).

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

Vite writes the static site to `dist/`. Header and caching checks use a local server plus Chromium:

```sh
npx playwright test -c playwright.csp.config.ts --project=chromium --workers=2
```

These tests do not verify the deployed site. Firefox and WebKit have configs, but no passing runs yet.

## Deployment

MarkID runs as an asset-only [Cloudflare Worker with Static Assets](https://developers.cloudflare.com/workers/static-assets/) at [markid.aes.my.id](https://markid.aes.my.id). `wrangler.jsonc` serves `./dist` with `single-page-application` fallback. No Worker script, bindings, or framework adapter.

### Deploy with Cloudflare dashboard (current setup)

Use [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/) so pushes deploy without local steps:

1. Open Workers and connect the Git repository.
2. Set the build configuration:

| Setting | Value |
|---|---|
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Output directory | `dist` |
| `NODE_VERSION` | `24` |

3. Push to `main` for production. Pushes to other branches get preview URLs.
4. `public/_headers` ships with the build: CSP, `nosniff`, HTML `no-cache`, and immutable caching for `/assets/*`.

### Deploy manually with Wrangler

Use this for a one-off deploy or a local build check:

```sh
npm ci --include=dev
npm run build
npx wrangler login
npx wrangler deploy
```

Keep dashboard Builds as the production path. Manual deploys do not replace it.

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

Tested in desktop Chromium with sample files. This is not proof of real-camera or cross-browser support. Animated images are outside scope. Locked PDFs and signed PDFs are rejected.

## Privacy and limitations

- No accounts, backend, analytics, uploads, or automatic file persistence. App and PDF assets stay in your browser. If native HEIC decoding fails, the browser loads the pinned decoder library from jsDelivr; only standard request data goes to the CDN, and HEIC fallback needs network unless cached.
- Photos keep full decoded size. JPEG output uses quality `0.92` with no fixed size cap, so very large files can fail on your device.
- Hosting can log access data. Your browser or OS may keep caches or downloaded files.
- Firefox, Safari, minimum browser versions, real Android/iOS devices, HDR, and color fidelity are not verified yet.

> [!WARNING]
> A watermark is not redaction, encryption, or tamper-proof protection. PDF export is not a sanitizer: original links, actions, attachments, and other active content may survive and execute in another reader. Inspect the final file before sharing it.

## Third-party

### LGPL Components (Pre-configured via CDN)

| Component | License | Features Enabled |
|---|---|---|
| [heic-to 1.6.5](https://github.com/hoppergee/heic-to/tree/v1.6.5) | [LGPL-3.0](https://github.com/hoppergee/heic-to/blob/v1.6.5/LICENSE) | HEIC/HEIF fallback decoding to bitmap, including upstream libheif/libde265. |

The decoder loads only after native HEIC decoding fails, from the pinned [CSP module](https://cdn.jsdelivr.net/npm/heic-to@1.6.5/dist/csp/heic-to.js). It is not bundled in MarkID's build. Decoding and export stay on your device, but loading the library needs network unless cached.

### Bundled components

| Component | License | Features Enabled |
|---|---|---|
| [pdf-lib 1.17.1](https://github.com/Hopding/pdf-lib) | MIT | PDF export; includes standard-fonts (MIT), upng (MIT), pako (MIT/Zlib), and tslib (0BSD). |
| [PDF.js 4.10.38](https://github.com/mozilla/pdf.js/tree/v4.10.38) | Apache-2.0 | PDF preview and worker. |
| Svelte and bundled helpers | MIT | Application UI; exact dependencies are recorded in `package-lock.json`. |
| PDF CMaps and standard fonts | BSD-style / OFL, as supplied by PDF.js | Local rendering assets; upstream license files remain alongside these assets. |

Tables are summaries; full terms are in the linked upstream licenses. UI and watermarks use system fonts, so no webfont is bundled.
