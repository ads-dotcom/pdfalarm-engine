# Release validation

Initial v0.1.0 validation, September 2026. Test fixtures use fictional data only.

## Engine

29 regression tests cover extractable Turkish/Greek/Cyrillic text, real font
selection, text wrapping and overflow, conditions, multi-page tables with repeated
headers and no lost rows, page/resource limits, PDF overlay preservation, invalid
PDFs, QR/Code 128/EAN-13 rendering and decoding, PNG/JPEG assets and text alignment, asset deadlines,
unknown/unsafe JSON input, zero currency values and ISO date formatting.

QR and barcode checks render the actual generated PDF into a canvas and decode
its pixels using independent decoders. This verifies more than PDF creation alone;
it does not certify every printer, scanner or barcode size a user may choose.

## Runtime and distribution

- Local Node.js engine tests and TypeScript checks.
- Real local Cloudflare workerd execution of the same engine with embedded fonts.
- Release tarball installed into a fresh project and the README quickstart run.
- Browser tests for desktop and mobile Chromium viewports.
- Public CI tests Node.js 22 and 24 and the browser/runtime suites on Linux.

## Website and examples

Ten browser checks cover actual previews/downloads, invalid inputs, table page
navigation, docs/assets/health/404 responses and automated WCAG checks on home,
docs and privacy pages. Browser requests are checked for unexpected POST uploads
and application cookies. Screenshots and four example PDFs were visually inspected.

Automated accessibility checks are not a full manual accessibility certification.
Generated PDFs are not claimed to be accessibility tagged. Mobile testing uses
Chromium emulation, not every physical device or browser.

## Security and dependencies

The source signature scan found no common API/private-key signatures. npm audit
reported zero known advisories for both runtime and development dependencies at
launch. Neither is a complete security review or a guarantee about future advisories.

The engine has no built-in URL fetching, customer database, login or billing.
Image dimensions are checked before decompression. JSON complexity, element count,
vector operations, font/asset sizes and output limits are enforced. Caller-provided
asset resolvers and source PDFs still need an appropriate trust boundary.

## Reproduce

```sh
npm ci --ignore-scripts
npm run check
npx playwright install chromium
npm run test:browser
```

After deployment:

```sh
BASE_URL=https://pdfalarm-engine.hakan-olcer.workers.dev node scripts/check-live.mjs
BASE_URL=https://pdfalarm-engine.hakan-olcer.workers.dev npm run test:browser
```

See the actual [CI runs](https://github.com/ads-dotcom/pdfalarm-engine/actions),
[release](https://github.com/ads-dotcom/pdfalarm-engine/releases/tag/v0.1.0) and
[launch report](LAUNCH_REPORT.md) for public evidence. The repository does not
claim established external usage or a guaranteed OpenAI program acceptance.
