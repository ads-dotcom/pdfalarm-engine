# PDFAlarm Engine

[![CI](https://github.com/ads-dotcom/pdfalarm-engine/actions/workflows/ci.yml/badge.svg)](https://github.com/ads-dotcom/pdfalarm-engine/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-237b65.svg)](LICENSE)

**JSON templates → PDF bytes. In your browser, Node.js or Cloudflare Worker.**

[Live playground](https://pdfalarm-engine.hakan-olcer.workers.dev/) · [Documentation](https://pdfalarm-engine.hakan-olcer.workers.dev/docs.html) · [Release](https://github.com/ads-dotcom/pdfalarm-engine/releases/tag/v0.1.0) · [Roadmap](docs/ROADMAP.md)

PDFAlarm Engine turns typed JSON templates and your data into PDFs. It supports
embedded fonts, data bindings, conditional elements, wrapping text, flowing tables
with repeated headers, QR codes, Code 128/EAN-13 barcodes, PNG/JPEG assets and
existing PDF overlays. The core needs no database, billing system, API key or
hosted rendering service. The playground runs locally in your browser.

This is the first independent open-source release of the PDFAlarm rendering core.
It uses pdf-lib, fontkit, qrcode and bwip-js; its contribution is the template,
validation and layout layer, not a new implementation of the PDF file format.

## Install

Node.js 22 or newer. The initial package is distributed as a GitHub release tarball:

```sh
npm install https://github.com/ads-dotcom/pdfalarm-engine/releases/download/v0.1.0/pdfalarm-engine-0.1.0.tgz
```

The package name is `pdfalarm-engine`. It is not currently published to the npm
registry; `npm install pdfalarm-engine` alone is not the installation command.

## Quickstart

Save this as `example.mjs` and run `node example.mjs`:

```js
import { readFile, writeFile } from 'node:fs/promises';
import { renderPdf } from 'pdfalarm-engine';

const font = await readFile(new URL(
  './node_modules/pdfalarm-engine/assets/fonts/NotoSans-Regular.ttf',
  import.meta.url
));

const { bytes, metrics } = await renderPdf({
  template: {
    version: 1,
    title: 'A first document',
    pages: [{
      width: 595.28, height: 841.89,
      elements: [{
        type: 'TEXT', x: 40, y: 60, width: 515, height: 70,
        font: 'NotoSans', fontSize: 24,
        text: 'Hello, {{person.name}}'
      }]
    }]
  },
  data: { person: { name: 'İpek Yılmaz' } },
  fonts: { NotoSans: new Uint8Array(font) }
});

await writeFile('hello.pdf', bytes);
console.log(metrics);
```

Font bytes are explicit inputs. Standard PDF fonts such as Helvetica and Courier
are available without extra assets, but do not contain all Turkish characters.
The included Noto Sans regular/bold fonts are tested with Turkish, Latin, Greek
and Cyrillic text. Missing glyphs fail with `UNSUPPORTED_GLYPH` rather than being
silently replaced. Fonts are distributed under the SIL Open Font License.

## Templates

Coordinates are PDF points (72 points = one inch), measured from the **top left**.
Every element has `type`, `x`, `y`, `width` and `height`. The runtime schema rejects
unknown keys, unsupported element types and geometry outside the template page.

- `TEXT`: `text` with `{path}`/`{{path}}`, or `dataField`; font, size, alignment,
  line height and locale-aware formatting. Text wraps; overflow is an error.
- `RECTANGLE` / `LINE`: colors, fill/stroke and stroke width.
- `QR_CODE`: text/data field, error correction and a minimum four-module quiet zone.
- `BARCODE`: Code 128 or EAN-13, optional human-readable text, white quiet zones.
- `IMAGE`: a named PNG/JPEG asset with aspect-preserving `contain` fitting.
- `TABLE`: data path, explicit column widths, cell wrapping and repeated headers.

A flowing table must be the last element on its template page. Its `height` is the
available first-page region. Further rows continue on inserted pages, respecting
`topMargin`/`bottomMargin`. `continuationElements` can add headers or footers to
those pages; place decorations outside the table's continuation region.

Conditions use `conditions: [{ path, operator, value }]` with strict comparisons
and `conditionLogic: 'AND' | 'OR'`. Supported operators: equals, notEquals,
greaterThan, lessThan, contains, exists. Dotted bindings read own JSON properties
only. See [the examples](examples) and [API guide](docs/API.md).

## Assets and overlays

```js
const result = await renderPdf({
  template, data, fonts,
  assets: { logo: { bytes: pngBytes, format: 'png' } },
  basePdf: existingPdfBytes
});
```

The engine never downloads arbitrary image URLs. Provide asset bytes, or a
`resolveAsset(key, signal)` callback. Callbacks have a deadline; implement bounded
reads and honor cancellation. Server applications must allowlist destinations
if their resolver makes network requests. A key is not permission to fetch a URL.

Overlay template dimensions must match the original PDF pages. Encrypted and
rotated input pages are unsupported in v0.1. Input PDFs are **not sanitized**:
only overlay trusted PDFs. Keep source PDFs unchanged if they contain signatures.

## Run this repository

```sh
npm ci
npm run check
npm run dev
```

The site is served by a local Cloudflare Worker. `npm run examples` creates real
PDFs in `output/pdf/`. `npm run build` builds the library and website. The Node.js
and self-hosted Worker examples are in [docs/API.md](docs/API.md).

`npm run test:browser` checks desktop/mobile playground flows. Install its browser
with `npx playwright install chromium` first. On macOS you can use existing Chrome:
`PLAYWRIGHT_CHROME=1 npm run test:browser`.

To deploy to your **own** Cloudflare account, set `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID`, then run `npm run deploy`. No database or bucket is needed
for the public browser demo. Use a different Worker name in `wrangler.jsonc` for
your own deployment. Account IDs and tokens are never committed.

## Errors and limits

Catch `PdfAlarmError` and inspect its `code`. Invalid input, missing images, font
coverage failures and layout overflow are explicit errors. Defaults: 50 output
pages, 2,000 table rows, 1 MB each for template/data, 5 MB per asset, 20 MB output,
200,000 text characters, 2,000 template elements, 100,000 vector operations,
four million pixels per image and a five-second resolver deadline. Limits can be
configured. The public demo uses lower page/row limits.

A byte limit is not a complete resource isolation mechanism. For a public server
rendering API, add authentication, request limits, bounded asset loading and
appropriate execution isolation. The launch site exposes no server render API.

## Verified scope / limitations

- JSON drawing templates, not HTML/CSS rendering.
- No Arabic/RTL layout, emoji, CJK font bundle or accessibility-tagged PDF claim.
- No automatic legal/tax invoice compliance or PDF signing.
- No SaaS accounts, billing, durable jobs or customer portal in this repository.
- Very large individual table rows fail instead of splitting a row across pages.
- PNG/JPEG only; no SVG or image cropping in the first release.

See [validation](docs/VALIDATION.md), [security policy](SECURITY.md),
[contribution guide](CONTRIBUTING.md) and [roadmap](docs/ROADMAP.md).

## License

MIT, © 2026 PDFAlarm contributors. Bundled Noto fonts: SIL OFL 1.1.
Dependency notices: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
