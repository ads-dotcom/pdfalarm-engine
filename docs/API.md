# Engine API

`renderPdf(options): Promise<{ bytes, metrics }>`

Options: `template`, `data`, optional `fonts`, `assets`, `resolveAsset`, `basePdf`
and `limits`. Font maps use the exact `font` names from the template. Asset maps
use the exact named `asset` keys. Returned bytes are a Uint8Array. Metrics contain
page count, byte length, rendering milliseconds and total table row count.

`TemplateSchema` is exported for validation, with `TemplateInput`, `Template` and
`Element` TypeScript types. `TemplateInput` accepts defaults omitted in JSON;
`Template` is the parsed/defaulted form. Unknown fields are rejected.

## Browser

```js
import { renderPdf } from 'pdfalarm-engine';
const fontBytes = new Uint8Array(await (await fetch('/fonts/NotoSans-Regular.ttf')).arrayBuffer());
const { bytes } = await renderPdf({ template, data, fonts: { NotoSans: fontBytes } });
const url = URL.createObjectURL(new Blob([Uint8Array.from(bytes).buffer], { type: 'application/pdf' }));
const a = document.createElement('a');
a.href = url; a.download = 'document.pdf'; a.click();
// Revoke the URL when the download/preview is no longer needed.
```

## Self-hosted Cloudflare Worker

A service can wrap the same engine. This example receives only JSON, uses a fixed
application template and no external assets. Choose a template using standard
fonts, or load trusted font bytes from a binding/your build. Use generated Env
binding types for your deployment.

```js
import { renderPdf, PdfAlarmError } from 'pdfalarm-engine';
import template from './your-template.json';
export default {
  async fetch(request) {
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
    // Authenticate and enforce request limits before parsing in a real public API.
    const reader = request.body?.getReader();
    if (!reader) return new Response('Missing body', { status: 400 });
    const chunks = []; let size = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 65536) { await reader.cancel(); return new Response('Too large', { status: 413 }); }
        chunks.push(value);
      }
      const body = new Uint8Array(size); let offset = 0;
      for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length; }
      const data = JSON.parse(new TextDecoder().decode(body));
      const { bytes } = await renderPdf({ template, data, limits: { maxPages: 10, maxRows: 100 } });
      return new Response(Uint8Array.from(bytes).buffer, {
        headers: { 'Content-Type': 'application/pdf', 'Cache-Control': 'no-store' }
      });
    } catch (error) {
      if (error instanceof PdfAlarmError) return Response.json({ code: error.code, error: error.message }, { status: 400 });
      return new Response('Invalid request', { status: 400 });
    } finally { reader.releaseLock(); }
  }
};
```

This illustrative API wrapper is not deployed by the launch site. The production
website serves static assets plus `/health`; the PDF playground runs client-side.

## Migration from the original application

The original private app stored element styles under `properties` and passed D1/R2
bindings to its renderer. This independent v1 schema is deliberately explicit:
move supported properties onto each element, use `font` for the selected font,
convert column field names to `path`, and pass font/image/base-PDF bytes directly.
Do not pass a legacy definition unchanged or assume every old UI option is supported.
