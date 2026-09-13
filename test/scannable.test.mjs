import test from "node:test";
import assert from "node:assert/strict";
import { createCanvas } from "@napi-rs/canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import jsQR from "jsqr";
import zxing from "@zxing/library";
import { renderPdf } from "../dist/index.js";
const {
  BinaryBitmap,
  HybridBinarizer,
  RGBLuminanceSource,
  Code128Reader,
  EAN13Reader,
} = zxing;
async function raster(element) {
  const r = await renderPdf({
    template: {
      version: 1,
      pages: [{ width: 450, height: 170, elements: [element] }],
    },
  });
  const task = getDocument({ data: r.bytes.slice(), useWasm: false });
  try {
    const pdf = await task.promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 3 });
    const canvas = createCanvas(viewport.width, viewport.height);
    await page.render({
      canvas,
      canvasContext: canvas.getContext("2d"),
      viewport,
    }).promise;
    return canvas
      .getContext("2d")
      .getImageData(0, 0, canvas.width, canvas.height);
  } finally {
    await task.destroy();
  }
}
test("generated PDF QR is decodable after rasterization", async () => {
  const image = await raster({
    type: "QR_CODE",
    x: 20,
    y: 20,
    width: 130,
    height: 130,
    text: "https://github.com/ads-dotcom/pdfalarm-engine",
  });
  const decoded = jsQR(image.data, image.width, image.height);
  assert.equal(decoded?.data, "https://github.com/ads-dotcom/pdfalarm-engine");
});
for (const [type, value, Reader] of [
  ["code128", "PDFALARM-2026-041", Code128Reader],
  ["ean13", "5901234123457", EAN13Reader],
])
  test(`generated PDF ${type} is decodable after rasterization`, async () => {
    const image = await raster({
      type: "BARCODE",
      x: 20,
      y: 30,
      width: 410,
      height: 100,
      text: value,
      barcodeType: type,
      showText: false,
    });
    const gray = new Uint8ClampedArray(image.width * image.height);
    for (let i = 0; i < gray.length; i++)
      gray[i] =
        (image.data[i * 4] * 306 +
          image.data[i * 4 + 1] * 601 +
          image.data[i * 4 + 2] * 117) >>
        10;
    const bitmap = new BinaryBitmap(
      new HybridBinarizer(
        new RGBLuminanceSource(gray, image.width, image.height),
      ),
    );
    assert.equal(new Reader().decode(bitmap).getText(), value);
  });
