import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createCanvas } from "@napi-rs/canvas";
import { PDFDocument, PDFName, PDFDict, PDFRawStream } from "pdf-lib";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { renderPdf, PdfAlarmError } from "../dist/index.js";
const fonts = {
  NotoSans: new Uint8Array(
    fs.readFileSync("assets/fonts/NotoSans-Regular.ttf"),
  ),
  "NotoSans-Bold": new Uint8Array(
    fs.readFileSync("assets/fonts/NotoSans-Bold.ttf"),
  ),
};
const text = (value, extra = {}) => ({
  type: "TEXT",
  x: 30,
  y: 30,
  width: 440,
  height: 80,
  text: value,
  font: "NotoSans",
  ...extra,
});
const template = (elements, extra = {}) => ({
  version: 1,
  pages: [{ width: 500, height: 600, elements, ...extra }],
});
async function extract(bytes) {
  const loading = getDocument({
    data: bytes.slice(),
    isEvalSupported: false,
    useSystemFonts: false,
    useWasm: false,
    standardFontDataUrl: new URL(
      "../node_modules/pdfjs-dist/standard_fonts/",
      import.meta.url,
    ).pathname,
  });
  const pdf = await loading.promise;
  const pages = [];
  try {
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      pages.push(content.items.filter((x) => "str" in x));
    }
    return pages;
  } finally {
    await loading.destroy();
  }
}
const rejectsCode = (fn, code) =>
  assert.rejects(fn, (e) => e instanceof PdfAlarmError && e.code === code);

test("Turkish text is embedded and extractable", async () => {
  const r = await renderPdf({
    template: template([
      text("İstanbul, ışık, şube, öğrenci · {{person.name}}"),
    ]),
    data: { person: { name: "İpek Yılmaz" } },
    fonts,
  });
  const pages = await extract(r.bytes);
  assert.equal(
    pages
      .flat()
      .map((i) => i.str)
      .join(" "),
    "İstanbul, ışık, şube, öğrenci · İpek Yılmaz",
  );
});
test("Greek and Cyrillic glyphs use the provided font", async () => {
  const r = await renderPdf({
    template: template([text("Ελλάδα · Україна")]),
    fonts,
  });
  assert.match(
    (await extract(r.bytes))[0].map((i) => i.str).join(" "),
    /Ελλάδα · Україна/,
  );
});
test("selected font is embedded rather than silently replaced", async () => {
  const r = await renderPdf({
    template: template([text("Courier chosen", { font: "Courier" })]),
  });
  const pdf = await PDFDocument.load(r.bytes);
  const dictionary = pdf
    .getPage(0)
    .node.Resources()
    .lookup(PDFName.of("Font"), PDFDict);
  const font = pdf.context.lookup(dictionary.values()[0], PDFDict);
  assert.equal(font.get(PDFName.of("BaseFont")).toString(), "/Courier");
});
test("text wraps long words without clipping", async () => {
  const r = await renderPdf({
    template: template([
      text("Supercalifragilisticexpialidocious", { width: 90, height: 170 }),
    ]),
    fonts,
  });
  const items = (await extract(r.bytes))[0];
  assert.ok(items.length > 1);
  for (const i of items) assert.ok(i.transform[4] + i.width <= 120.1);
  assert.equal(
    items.map((i) => i.str).join(""),
    "Supercalifragilisticexpialidocious",
  );
});
test("vertical text overflow fails explicitly", () =>
  rejectsCode(
    () =>
      renderPdf({
        template: template([
          text("A long paragraph that does not fit", { width: 50, height: 12 }),
        ]),
        fonts,
      }),
    "TEXT_OVERFLOW",
  ));
test("conditions use strict comparisons and hide elements", async () => {
  const r = await renderPdf({
    template: template([
      text("Hidden", {
        conditions: [{ path: "show", operator: "equals", value: true }],
      }),
      text("Visible", { y: 150 }),
    ]),
    data: { show: false },
    fonts,
  });
  assert.equal(
    (await extract(r.bytes))[0].map((i) => i.str).join(" "),
    "Visible",
  );
});
test("tables wrap, paginate and repeat headers without losing rows", async () => {
  const rows = Array.from({ length: 90 }, (_, i) => ({
    name: `ROW-${String(i).padStart(3, "0")} detailed description`,
    qty: i,
  }));
  const table = {
    type: "TABLE",
    x: 30,
    y: 70,
    width: 440,
    height: 460,
    font: "NotoSans",
    fontSize: 10,
    dataPath: "rows",
    columns: [
      { header: "Description", path: "name", width: 340 },
      { header: "Qty", path: "qty", width: 100 },
    ],
  };
  const r = await renderPdf({
    template: template([table]),
    data: { rows },
    fonts,
  });
  const pages = await extract(r.bytes);
  assert.ok(pages.length > 1);
  assert.equal(r.metrics.tableRowCount, 90);
  for (const page of pages) {
    assert.ok(page.some((i) => i.str === "Description"));
    for (const item of page) {
      assert.ok(item.transform[5] > 35);
      assert.ok(item.transform[4] + item.width <= 471);
    }
  }
  for (let i = 0; i < 90; i++)
    assert.equal(
      pages
        .flat()
        .filter((x) => x.str.includes(`ROW-${String(i).padStart(3, "0")}`))
        .length,
      1,
    );
});
test("oversized rows fail rather than spilling outside pages", () =>
  rejectsCode(
    () =>
      renderPdf({
        template: template([
          {
            type: "TABLE",
            x: 30,
            y: 70,
            width: 440,
            height: 460,
            font: "NotoSans",
            dataPath: "rows",
            columns: [{ header: "Text", path: "name", width: 440 }],
          },
        ]),
        data: { rows: [{ name: "word ".repeat(3000) }] },
        fonts,
      }),
    "TEXT_OVERFLOW",
  ));
test("page budget stops long tables", () =>
  rejectsCode(
    () =>
      renderPdf({
        template: template([
          {
            type: "TABLE",
            x: 30,
            y: 70,
            width: 440,
            height: 460,
            font: "NotoSans",
            dataPath: "rows",
            columns: [{ header: "Text", path: "name", width: 440 }],
          },
        ]),
        data: { rows: Array.from({ length: 100 }, () => ({ name: "Row" })) },
        fonts,
        limits: { maxPages: 1 },
      }),
    "LIMIT_EXCEEDED",
  ));
test("base PDF survives overlay rendering", async () => {
  const base = await PDFDocument.create();
  base.addPage([500, 600]).drawText("Original");
  const r = await renderPdf({
    template: template([text("Overlay: {{name}}")]),
    data: { name: "İpek" },
    fonts,
    basePdf: await base.save(),
  });
  const all = (await extract(r.bytes))[0].map((i) => i.str).join(" ");
  assert.match(all, /Original/);
  assert.match(all, /Overlay: İpek/);
});
test("invalid base PDF fails explicitly", () =>
  rejectsCode(
    () =>
      renderPdf({
        template: template([]),
        basePdf: new TextEncoder().encode("not a PDF"),
      }),
    "INVALID_PDF",
  ));
test("QR and both supported barcode formats generate PDFs", async () => {
  const r = await renderPdf({
    template: template([
      {
        type: "QR_CODE",
        x: 30,
        y: 30,
        width: 120,
        height: 120,
        text: "https://example.test",
      },
      {
        type: "BARCODE",
        x: 30,
        y: 220,
        width: 400,
        height: 65,
        text: "HELLO-001",
      },
      {
        type: "BARCODE",
        x: 30,
        y: 340,
        width: 400,
        height: 65,
        text: "5901234123457",
        barcodeType: "ean13",
      },
    ]),
  });
  assert.equal(r.metrics.pageCount, 1);
  assert.ok(r.bytes.length > 1000);
});
test("invalid EAN-13 fails explicitly", () =>
  rejectsCode(
    () =>
      renderPdf({
        template: template([
          {
            type: "BARCODE",
            x: 30,
            y: 30,
            width: 400,
            height: 65,
            text: "BAD",
            barcodeType: "ean13",
          },
        ]),
      }),
    "INVALID_BARCODE",
  ));
test("missing assets are fatal instead of silent missing images", () =>
  rejectsCode(
    () =>
      renderPdf({
        template: template([
          {
            type: "IMAGE",
            x: 30,
            y: 30,
            width: 100,
            height: 100,
            asset: "missing",
          },
        ]),
      }),
    "ASSET_ERROR",
  ));
test("explicit image bytes render without network access", async () => {
  const png = Uint8Array.from(
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
      "base64",
    ),
  );
  const r = await renderPdf({
    template: template([
      { type: "IMAGE", x: 30, y: 30, width: 100, height: 100, asset: "pixel" },
    ]),
    assets: { pixel: { bytes: png, format: "png" } },
  });
  assert.ok(r.bytes.length > 0);
});
test("asset resolver has a deadline", () =>
  rejectsCode(
    () =>
      renderPdf({
        template: template([
          {
            type: "IMAGE",
            x: 30,
            y: 30,
            width: 100,
            height: 100,
            asset: "slow",
          },
        ]),
        resolveAsset: () => new Promise(() => {}),
        limits: { assetTimeoutMs: 10 },
      }),
    "ASSET_ERROR",
  ));
test("unknown elements and overflowing geometry are rejected", async () => {
  await rejectsCode(
    () =>
      renderPdf({
        template: template([
          { type: "MYSTERY", x: 30, y: 30, width: 100, height: 100 },
        ]),
      }),
    "INVALID_TEMPLATE",
  );
  await rejectsCode(
    () => renderPdf({ template: template([text("Outside", { x: 499 })]) }),
    "INVALID_TEMPLATE",
  );
});
test("unsafe object keys and paths are rejected", async () => {
  await rejectsCode(
    () =>
      renderPdf({
        template: template([text("test")]),
        data: JSON.parse('{"__proto__":{"name":"bad"}}'),
      }),
    "INVALID_DATA",
  );
  await rejectsCode(
    () =>
      renderPdf({
        template: template([text("", { dataField: "constructor.name" })]),
      }),
    "INVALID_TEMPLATE",
  );
});
test("undefined, non-JSON and circular data are rejected", async () => {
  await rejectsCode(
    () => renderPdf({ template: template([]), data: { x: undefined } }),
    "INVALID_DATA",
  );
  const data = {};
  data.self = data;
  await rejectsCode(
    () => renderPdf({ template: template([]), data }),
    "INVALID_DATA",
  );
});
test("limits and font coverage are enforced", async () => {
  await rejectsCode(
    () =>
      renderPdf({
        template: template([text("İstanbul", { font: "Helvetica" })]),
      }),
    "UNSUPPORTED_GLYPH",
  );
  await rejectsCode(
    () =>
      renderPdf({
        template: template([text("A")]),
        fonts,
        limits: { maxOutputBytes: 1 },
      }),
    "LIMIT_EXCEEDED",
  );
  await rejectsCode(
    () =>
      renderPdf({
        template: template([]),
        data: { value: "x".repeat(200) },
        limits: { maxInputBytes: 100 },
      }),
    "LIMIT_EXCEEDED",
  );
});
test("currency/date formatters preserve zero and use explicit locale", async () => {
  const r = await renderPdf({
    template: template([
      text("", {
        dataField: "amount",
        formatter: { type: "currency", currency: "EUR", locale: "en-GB" },
      }),
      text("", {
        y: 150,
        dataField: "date",
        formatter: { type: "date", locale: "en-GB" },
      }),
    ]),
    data: { amount: 0, date: "2026-09-13" },
    fonts,
  });
  const all = (await extract(r.bytes))[0].map((i) => i.str).join(" ");
  assert.match(all, /€0.00/);
  assert.match(all, /13 Sept 2026/);
});

test("image dimensions are limited before decompression", () => {
  const bytes = Uint8Array.from(
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
      "base64",
    ),
  );
  const view = new DataView(bytes.buffer);
  view.setUint32(16, 100000);
  view.setUint32(20, 100000);
  return rejectsCode(
    () =>
      renderPdf({
        template: template([
          {
            type: "IMAGE",
            x: 30,
            y: 30,
            width: 100,
            height: 100,
            asset: "huge",
          },
        ]),
        assets: { huge: { bytes, format: "png" } },
      }),
    "LIMIT_EXCEEDED",
  );
});
test("vector and element budgets stop excessive templates", async () => {
  await rejectsCode(
    () =>
      renderPdf({
        template: template([
          {
            type: "QR_CODE",
            x: 30,
            y: 30,
            width: 100,
            height: 100,
            text: "Hello",
          },
        ]),
        limits: { maxVectorOperations: 1 },
      }),
    "LIMIT_EXCEEDED",
  );
  await rejectsCode(
    () =>
      renderPdf({
        template: template([text("A"), text("B")]),
        limits: { maxElements: 1 },
        fonts,
      }),
    "LIMIT_EXCEEDED",
  );
});
test("horizontal lines are valid template elements", async () => {
  const r = await renderPdf({
    template: template([{ type: "LINE", x: 30, y: 30, width: 100, height: 0 }]),
  });
  assert.ok(r.bytes.length > 0);
});

test("JPEG assets embed with their original dimensions", async () => {
  const canvas = createCanvas(16, 32);
  canvas.getContext("2d").fillRect(0, 0, 16, 32);
  const bytes = new Uint8Array(canvas.toBuffer("image/jpeg"));
  const result = await renderPdf({
    template: template([
      { type: "IMAGE", x: 30, y: 30, width: 100, height: 100, asset: "jpeg" },
    ]),
    assets: { jpeg: { bytes, format: "jpg" } },
  });
  const pdf = await PDFDocument.load(result.bytes);
  const objects = pdf
    .getPage(0)
    .node.Resources()
    .lookup(PDFName.of("XObject"), PDFDict);
  const image = pdf.context.lookup(objects.values()[0], PDFRawStream).dict;
  assert.equal(image.get(PDFName.of("Width")).asNumber(), 16);
  assert.equal(image.get(PDFName.of("Height")).asNumber(), 32);
});
test("right alignment reaches the requested text-box edge", async () => {
  const result = await renderPdf({
    template: template([text("Aligned", { align: "right" })]),
    fonts,
  });
  const item = (await extract(result.bytes))[0][0];
  assert.ok(Math.abs(item.transform[4] + item.width - 470) < 1);
});
