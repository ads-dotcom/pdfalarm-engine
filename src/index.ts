import {
  PDFDocument,
  StandardFonts,
  degrees,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import QRCode from "qrcode";
import bwipjs from "bwip-js/generic";
import { z } from "zod";
import { TemplateSchema, type Element, type TemplateInput } from "./schema.js";
import { PdfAlarmError } from "./errors.js";
import {
  asText,
  conditionPasses,
  formatValue,
  getValue,
  interpolate,
} from "./values.js";
export { PdfAlarmError } from "./errors.js";
export { TemplateSchema } from "./schema.js";
export type { Template, TemplateInput, Element } from "./schema.js";

export interface Asset {
  bytes: Uint8Array;
  format: "png" | "jpg";
}
export interface RenderLimits {
  maxPages: number;
  maxRows: number;
  maxElements: number;
  maxVectorOperations: number;
  maxImagePixels: number;
  maxInputBytes: number;
  maxAssetBytes: number;
  maxOutputBytes: number;
  maxTextCharacters: number;
  assetTimeoutMs: number;
}
export interface RenderOptions {
  template: TemplateInput | unknown;
  data?: unknown;
  fonts?: Readonly<Record<string, Uint8Array>>;
  assets?: Readonly<Record<string, Asset>>;
  resolveAsset?: (key: string, signal: AbortSignal) => Promise<Asset>;
  basePdf?: Uint8Array;
  limits?: Partial<RenderLimits>;
}
export const DEFAULT_LIMITS: Readonly<RenderLimits> = Object.freeze({
  maxPages: 50,
  maxRows: 2000,
  maxElements: 2000,
  maxVectorOperations: 100000,
  maxImagePixels: 4000000,
  maxInputBytes: 1024 * 1024,
  maxAssetBytes: 5 * 1024 * 1024,
  maxOutputBytes: 20 * 1024 * 1024,
  maxTextCharacters: 200000,
  assetTimeoutMs: 5000,
});
export interface RenderResult {
  bytes: Uint8Array;
  metrics: {
    pageCount: number;
    fileSize: number;
    renderTimeMs: number;
    tableRowCount: number;
  };
}

function checkedLimits(input: Partial<RenderLimits> = {}): RenderLimits {
  const limits = { ...DEFAULT_LIMITS, ...input };
  for (const [name, n] of Object.entries(limits))
    if (!Number.isSafeInteger(n) || n < 1 || n > 100000000)
      throw new PdfAlarmError("INVALID_DATA", `Invalid limit: ${name}`);
  return limits;
}
function validateJson(data: unknown, maxBytes: number): void {
  let nodes = 0;
  const seen = new Set<object>();
  function walk(v: unknown, depth: number): void {
    if (++nodes > 50000 || depth > 30)
      throw new PdfAlarmError("LIMIT_EXCEEDED", "JSON is too complex");
    if (v === null || typeof v === "string" || typeof v === "boolean") return;
    if (typeof v === "number" && Number.isFinite(v)) return;
    if (typeof v !== "object")
      throw new PdfAlarmError(
        "INVALID_DATA",
        "Data must contain only JSON values",
      );
    if (seen.has(v))
      throw new PdfAlarmError("INVALID_DATA", "Circular data is not supported");
    seen.add(v);
    if (
      !Array.isArray(v) &&
      Object.getPrototypeOf(v) !== Object.prototype &&
      Object.getPrototypeOf(v) !== null
    )
      throw new PdfAlarmError(
        "INVALID_DATA",
        "Data must use plain JSON objects",
      );
    for (const [k, val] of Object.entries(v)) {
      if (["__proto__", "constructor", "prototype"].includes(k))
        throw new PdfAlarmError("INVALID_DATA", "Unsafe object key");
      walk(val, depth + 1);
    }
    seen.delete(v);
  }
  walk(data, 0);
  if (new TextEncoder().encode(JSON.stringify(data)).length > maxBytes)
    throw new PdfAlarmError("LIMIT_EXCEEDED", "Input exceeds the byte limit");
}
function imageDimensions(
  bytes: Uint8Array,
  format: "png" | "jpg",
): { width: number; height: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (format === "png") {
    if (
      bytes.length < 24 ||
      bytes
        .slice(0, 8)
        .some((n, i) => n !== [137, 80, 78, 71, 13, 10, 26, 10][i])
    )
      throw new PdfAlarmError("ASSET_ERROR", "Invalid PNG header");
    const width = view.getUint32(16),
      height = view.getUint32(20);
    if (!width || !height)
      throw new PdfAlarmError("ASSET_ERROR", "Invalid image dimensions");
    return { width, height };
  }
  if (bytes.length < 4 || bytes[0] !== 255 || bytes[1] !== 216)
    throw new PdfAlarmError("ASSET_ERROR", "Invalid JPEG header");
  let offset = 2;
  while (offset + 3 < bytes.length) {
    if (bytes[offset] !== 255) break;
    while (bytes[offset] === 255) offset++;
    const marker = bytes[offset++]!;
    if (marker === 216 || marker === 1 || (marker >= 208 && marker <= 215))
      continue;
    if (marker === 217 || marker === 218 || offset + 2 > bytes.length) break;
    const length = view.getUint16(offset);
    if (length < 2 || offset + length > bytes.length) break;
    if (
      [
        192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207,
      ].includes(marker)
    ) {
      if (length < 7) break;
      const height = view.getUint16(offset + 3),
        width = view.getUint16(offset + 5);
      if (!width || !height) break;
      return { width, height };
    }
    offset += length;
  }
  throw new PdfAlarmError("ASSET_ERROR", "JPEG dimensions were not found");
}
function col(hex: string) {
  return rgb(
    parseInt(hex.slice(1, 3), 16) / 255,
    parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255,
  );
}
function wrap(
  text: string,
  font: PDFFont,
  size: number,
  width: number,
): string[] {
  const lines: string[] = [];
  for (const paragraph of text.replace(/\r\n?/g, "\n").split("\n")) {
    let line = "";
    for (const word of paragraph.split(/ +/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= width) {
        line = candidate;
        continue;
      }
      if (line) {
        lines.push(line);
        line = "";
      }
      let fragment = "";
      for (const ch of word) {
        if (font.widthOfTextAtSize(ch, size) > width)
          throw new PdfAlarmError(
            "TEXT_OVERFLOW",
            "A character is wider than its text box",
          );
        if (fragment && font.widthOfTextAtSize(fragment + ch, size) > width) {
          lines.push(fragment);
          fragment = "";
        }
        fragment += ch;
      }
      line = fragment;
    }
    lines.push(line);
  }
  return lines;
}
function drawLines(
  page: PDFPage,
  lines: string[],
  font: PDFFont,
  size: number,
  x: number,
  y: number,
  width: number,
  lineHeight: number,
  align: "left" | "center" | "right",
  color: string,
) {
  lines.forEach((line, i) => {
    if (!line) return;
    const tw = font.widthOfTextAtSize(line, size);
    const offset =
      align === "center"
        ? (width - tw) / 2
        : align === "right"
          ? width - tw
          : 0;
    page.drawText(line, {
      x: x + offset,
      y: page.getHeight() - y - size - i * lineHeight,
      size,
      font,
      color: col(color),
    });
  });
}

export async function renderPdf(options: RenderOptions): Promise<RenderResult> {
  const started = performance.now();
  const limits = checkedLimits(options.limits);
  const data = options.data ?? {};
  validateJson(data, limits.maxInputBytes);
  validateJson(options.template, limits.maxInputBytes);
  const parsed = TemplateSchema.safeParse(options.template);
  if (!parsed.success)
    throw new PdfAlarmError(
      "INVALID_TEMPLATE",
      parsed.error.issues
        .slice(0, 5)
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; "),
    );
  const template = parsed.data;
  if (
    template.pages.reduce(
      (n, p) => n + p.elements.length + (p.continuationElements?.length ?? 0),
      0,
    ) > limits.maxElements
  )
    throw new PdfAlarmError("LIMIT_EXCEEDED", "Too many template elements");
  if (template.pages.length > limits.maxPages)
    throw new PdfAlarmError("LIMIT_EXCEEDED", "Too many template pages");
  if (options.basePdf && options.basePdf.byteLength > limits.maxAssetBytes)
    throw new PdfAlarmError(
      "LIMIT_EXCEEDED",
      "Base PDF exceeds the byte limit",
    );
  let doc: PDFDocument;
  try {
    doc = options.basePdf
      ? await PDFDocument.load(options.basePdf, { ignoreEncryption: false })
      : await PDFDocument.create();
  } catch {
    throw new PdfAlarmError("INVALID_PDF", "Base PDF is invalid or encrypted");
  }
  if (doc.getPageCount() > limits.maxPages)
    throw new PdfAlarmError("LIMIT_EXCEEDED", "Base PDF has too many pages");
  doc.registerFontkit(fontkit);
  doc.setTitle(template.title);
  doc.setCreator("PDFAlarm Engine");
  doc.setProducer("PDFAlarm Engine / pdf-lib");
  const basePages = doc.getPages();
  const fonts = new Map<string, PDFFont>();
  const charsets = new Map<string, Set<number>>();
  const assets = new Map<
    string,
    Awaited<ReturnType<PDFDocument["embedPng"]>>
  >();
  let characters = 0,
    tableRowCount = 0,
    totalAssetBytes = 0,
    vectorOperations = 0;
  function reserveVectors(n: number) {
    vectorOperations += n;
    if (vectorOperations > limits.maxVectorOperations)
      throw new PdfAlarmError(
        "LIMIT_EXCEEDED",
        "Vector drawing budget exceeded",
      );
  }
  const customFonts = Object.entries(options.fonts ?? {});
  if (customFonts.length > 10)
    throw new PdfAlarmError("LIMIT_EXCEEDED", "Too many fonts");
  for (const [, bytes] of customFonts) {
    if (
      !(bytes instanceof Uint8Array) ||
      bytes.byteLength > limits.maxAssetBytes
    )
      throw new PdfAlarmError("LIMIT_EXCEEDED", "Font exceeds the byte limit");
    totalAssetBytes += bytes.byteLength;
  }
  if (totalAssetBytes > limits.maxAssetBytes * 2)
    throw new PdfAlarmError(
      "LIMIT_EXCEEDED",
      "Combined font assets exceed the limit",
    );
  async function fontFor(name: string): Promise<PDFFont> {
    const cached = fonts.get(name);
    if (cached) return cached;
    let font: PDFFont;
    const bytes = options.fonts?.[name];
    if (bytes) {
      try {
        font = await doc.embedFont(bytes, { subset: true });
      } catch {
        throw new PdfAlarmError("ASSET_ERROR", `Cannot embed font: ${name}`);
      }
    } else if (Object.values(StandardFonts).includes(name as StandardFonts))
      font = await doc.embedFont(name as StandardFonts);
    else
      throw new PdfAlarmError(
        "FONT_NOT_FOUND",
        `Provide font bytes for ${name}`,
      );
    fonts.set(name, font);
    charsets.set(name, new Set(font.getCharacterSet()));
    return font;
  }
  function checkText(text: string, name: string): void {
    characters += text.length;
    if (characters > limits.maxTextCharacters)
      throw new PdfAlarmError(
        "LIMIT_EXCEEDED",
        "Rendered text exceeds the character limit",
      );
    if (
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text) ||
      text.includes("\t")
    )
      throw new PdfAlarmError(
        "INVALID_DATA",
        "Text contains unsupported control characters",
      );
    for (const ch of text) {
      if (ch === "\n" || ch === "\r") continue;
      if (!charsets.get(name)?.has(ch.codePointAt(0)!))
        throw new PdfAlarmError(
          "UNSUPPORTED_GLYPH",
          `Font ${name} does not contain ${ch} (U+${ch.codePointAt(0)!.toString(16).toUpperCase()})`,
        );
    }
  }
  function assertPageBudget() {
    if (doc.getPageCount() > limits.maxPages)
      throw new PdfAlarmError(
        "LIMIT_EXCEEDED",
        "Output exceeds the page limit",
      );
  }
  async function imageFor(key: string) {
    const cached = assets.get(key);
    if (cached) return cached;
    let asset = options.assets?.[key];
    if (!asset && options.resolveAsset) {
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        asset = await Promise.race([
          options.resolveAsset(key, controller.signal),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => {
              controller.abort();
              reject(
                new PdfAlarmError("ASSET_ERROR", `Asset timed out: ${key}`),
              );
            }, limits.assetTimeoutMs);
          }),
        ]);
      } catch (e) {
        if (e instanceof PdfAlarmError) throw e;
        throw new PdfAlarmError(
          "ASSET_ERROR",
          `Asset resolution failed: ${key}`,
        );
      } finally {
        if (timer !== undefined) clearTimeout(timer);
      }
    }
    if (!asset)
      throw new PdfAlarmError("ASSET_ERROR", `Asset not found: ${key}`);
    if (
      !(asset.bytes instanceof Uint8Array) ||
      asset.bytes.byteLength > limits.maxAssetBytes
    )
      throw new PdfAlarmError(
        "LIMIT_EXCEEDED",
        `Asset exceeds the byte limit: ${key}`,
      );
    if (!["png", "jpg"].includes(asset.format))
      throw new PdfAlarmError("ASSET_ERROR", "Images must be PNG or JPEG");
    totalAssetBytes += asset.bytes.byteLength;
    if (totalAssetBytes > limits.maxAssetBytes * 4)
      throw new PdfAlarmError(
        "LIMIT_EXCEEDED",
        "Combined assets exceed the limit",
      );
    const dimensions = imageDimensions(asset.bytes, asset.format);
    if (dimensions.width * dimensions.height > limits.maxImagePixels)
      throw new PdfAlarmError(
        "LIMIT_EXCEEDED",
        "Image pixel dimensions exceed the limit",
      );
    try {
      const image =
        asset.format === "png"
          ? await doc.embedPng(asset.bytes)
          : await doc.embedJpg(asset.bytes);
      assets.set(key, image);
      return image;
    } catch (e) {
      if (e instanceof PdfAlarmError) throw e;
      throw new PdfAlarmError("ASSET_ERROR", `Invalid image: ${key}`);
    }
  }
  async function renderElement(page: PDFPage, e: Element): Promise<void> {
    if (e.conditions?.length) {
      const checks = e.conditions.map((c) => conditionPasses(c, data));
      if (
        !(e.conditionLogic === "OR"
          ? checks.some(Boolean)
          : checks.every(Boolean))
      )
        return;
    }
    switch (e.type) {
      case "TEXT": {
        const font = await fontFor(e.font);
        const text = e.dataField
          ? formatValue(getValue(data, e.dataField), e.formatter)
          : formatValue(interpolate(e.text ?? "", data), e.formatter);
        checkText(text, e.font);
        const lines = wrap(text, font, e.fontSize, e.width);
        const lh = e.fontSize * e.lineHeight;
        if (
          Math.max(
            e.fontSize,
            font.heightAtSize(e.fontSize, { descender: true }),
          ) +
            (lines.length - 1) * lh >
          e.height + 0.01
        )
          throw new PdfAlarmError(
            "TEXT_OVERFLOW",
            "Text exceeds its height; enlarge the box or reduce the font size",
          );
        drawLines(
          page,
          lines,
          font,
          e.fontSize,
          e.x,
          e.y,
          e.width,
          lh,
          e.align,
          e.color,
        );
        break;
      }
      case "RECTANGLE":
        page.drawRectangle({
          x: e.x,
          y: page.getHeight() - e.y - e.height,
          width: e.width,
          height: e.height,
          color: e.fill ? col(e.fill) : undefined,
          borderColor: e.stroke ? col(e.stroke) : undefined,
          borderWidth: e.stroke ? e.strokeWidth : 0,
        });
        break;
      case "LINE":
        page.drawLine({
          start: { x: e.x, y: page.getHeight() - e.y },
          end: { x: e.x + e.width, y: page.getHeight() - e.y - e.height },
          thickness: e.strokeWidth,
          color: col(e.color),
        });
        break;
      case "QR_CODE": {
        if (Math.abs(e.width - e.height) > 0.01)
          throw new PdfAlarmError(
            "INVALID_TEMPLATE",
            "QR codes must be square",
          );
        const text = e.dataField
          ? asText(getValue(data, e.dataField))
          : interpolate(e.text ?? "", data);
        if (!text || text.length > 2000)
          throw new PdfAlarmError(
            "INVALID_DATA",
            "QR content must be non-empty and at most 2000 characters",
          );
        let qr: ReturnType<typeof QRCode.create>;
        try {
          qr = QRCode.create(text, { errorCorrectionLevel: e.errorCorrection });
        } catch {
          throw new PdfAlarmError(
            "INVALID_DATA",
            "QR content exceeds its capacity",
          );
        }
        const size = qr.modules.size,
          unit = e.width / (size + 2 * e.quietZone);
        reserveVectors(size * size + 1);
        page.drawRectangle({
          x: e.x,
          y: page.getHeight() - e.y - e.height,
          width: e.width,
          height: e.height,
          color: rgb(1, 1, 1),
        });
        for (let r = 0; r < size; r++)
          for (let c = 0; c < size; c++)
            if (qr.modules.data[r * size + c])
              page.drawRectangle({
                x: e.x + (c + e.quietZone) * unit,
                y: page.getHeight() - e.y - (r + e.quietZone + 1) * unit,
                width: unit,
                height: unit,
                color: col(e.color),
              });
        break;
      }
      case "BARCODE": {
        const text = e.dataField
          ? asText(getValue(data, e.dataField))
          : interpolate(e.text ?? "", data);
        if (!text || text.length > 120 || !/^[\x20-\x7e]+$/.test(text))
          throw new PdfAlarmError(
            "INVALID_BARCODE",
            "Barcode content must be 1–120 printable ASCII characters",
          );
        let raw: unknown;
        try {
          raw = bwipjs.raw({ bcid: e.barcodeType, text, includetext: false });
        } catch {
          throw new PdfAlarmError(
            "INVALID_BARCODE",
            "Barcode content is invalid for the selected type",
          );
        }
        const parsedRow = z
          .object({ sbs: z.array(z.number().finite().nonnegative()).min(1) })
          .safeParse(Array.isArray(raw) ? raw[0] : null);
        if (!parsedRow.success)
          throw new PdfAlarmError(
            "INVALID_BARCODE",
            "Unsupported barcode output",
          );
        const row = parsedRow.data;
        reserveVectors(row.sbs.length + 1);
        const units = row.sbs.reduce((sum, n) => sum + n, 0),
          quiet = 11,
          unit = e.width / (units + quiet * 2);
        const textSize = e.showText ? Math.min(10, e.height * 0.2) : 0,
          barHeight = e.height - textSize - (e.showText ? 4 : 0);
        if (barHeight < 8)
          throw new PdfAlarmError(
            "INVALID_TEMPLATE",
            "Barcode box is too short",
          );
        page.drawRectangle({
          x: e.x,
          y: page.getHeight() - e.y - e.height,
          width: e.width,
          height: e.height,
          color: rgb(1, 1, 1),
        });
        let x = e.x + quiet * unit;
        row.sbs.forEach((segment, i) => {
          if (i % 2 === 0)
            page.drawRectangle({
              x,
              y: page.getHeight() - e.y - barHeight,
              width: segment * unit,
              height: barHeight,
              color: col(e.color),
            });
          x += segment * unit;
        });
        if (e.showText) {
          const font = await fontFor(e.font);
          checkText(text, e.font);
          if (font.widthOfTextAtSize(text, textSize) > e.width)
            throw new PdfAlarmError(
              "TEXT_OVERFLOW",
              "Barcode label is wider than its box",
            );
          drawLines(
            page,
            [text],
            font,
            textSize,
            e.x,
            e.y + barHeight + 4,
            e.width,
            textSize,
            "center",
            e.color,
          );
        }
        break;
      }
      case "IMAGE": {
        const image = await imageFor(e.asset);
        const ratio = Math.min(e.width / image.width, e.height / image.height),
          w = image.width * ratio,
          h = image.height * ratio;
        page.drawImage(image, {
          x: e.x + (e.width - w) / 2,
          y: page.getHeight() - e.y - (e.height + h) / 2,
          width: w,
          height: h,
        });
        break;
      }
      case "TABLE":
        throw new PdfAlarmError(
          "INVALID_TEMPLATE",
          "Nested tables are not supported",
        );
    }
  }
  for (const [index, p] of template.pages.entries()) {
    let page = basePages[index] ?? doc.addPage([p.width, p.height]);
    assertPageBudget();
    if (page.getRotation().angle !== 0)
      throw new PdfAlarmError(
        "INVALID_PDF",
        "Rotated base PDF pages are not supported",
      );
    if (
      Math.abs(page.getWidth() - p.width) > 0.01 ||
      Math.abs(page.getHeight() - p.height) > 0.01
    )
      throw new PdfAlarmError(
        "INVALID_TEMPLATE",
        "Template dimensions must match the base PDF page",
      );
    for (const e of p.elements) {
      if (e.type !== "TABLE") {
        await renderElement(page, e);
        continue;
      }
      if (e.conditions?.length) {
        const checks = e.conditions.map((c) => conditionPasses(c, data));
        if (
          !(e.conditionLogic === "OR"
            ? checks.some(Boolean)
            : checks.every(Boolean))
        )
          continue;
      }
      const rows = getValue(data, e.dataPath);
      if (!Array.isArray(rows))
        throw new PdfAlarmError(
          "INVALID_DATA",
          "Table binding must resolve to an array",
        );
      tableRowCount += rows.length;
      if (tableRowCount > limits.maxRows)
        throw new PdfAlarmError("LIMIT_EXCEEDED", "Too many table rows");
      const font = await fontFor(e.font),
        headerName = e.headerFont ?? e.font,
        headerFont = await fontFor(headerName),
        lh = e.fontSize * e.lineHeight;
      const makeCells = (values: string[], f: PDFFont, name: string) =>
        values.map((v, i) => {
          checkText(v, name);
          return wrap(v, f, e.fontSize, e.columns[i]!.width - 2 * e.padding);
        });
      const headers = makeCells(
        e.columns.map((c) => c.header),
        headerFont,
        headerName,
      );
      const rowHeight = (cells: string[][]) =>
        Math.max(
          e.minRowHeight,
          2 * e.padding +
            e.fontSize +
            (Math.max(...cells.map((c) => c.length)) - 1) * lh,
        );
      const headerHeight = rowHeight(headers);
      let y = e.y;
      const firstBottom = Math.min(e.y + e.height, p.height - e.bottomMargin);
      let bottom = firstBottom;
      const drawRow = (cells: string[][], height: number, header: boolean) => {
        let x = e.x;
        reserveVectors(cells.length);
        cells.forEach((lines, i) => {
          const column = e.columns[i]!;
          page.drawRectangle({
            x,
            y: page.getHeight() - y - height,
            width: column.width,
            height,
            color: header ? col(e.headerFill) : undefined,
            borderColor: col(e.gridColor),
            borderWidth: 0.5,
          });
          drawLines(
            page,
            lines,
            header ? headerFont : font,
            e.fontSize,
            x + e.padding,
            y + e.padding,
            column.width - 2 * e.padding,
            lh,
            column.align,
            e.color,
          );
          x += column.width;
        });
        y += height;
      };
      if (y + headerHeight > bottom)
        throw new PdfAlarmError(
          "TEXT_OVERFLOW",
          "Table header does not fit in its first-page box",
        );
      drawRow(headers, headerHeight, true);
      for (const row of rows) {
        if (row === null || typeof row !== "object" || Array.isArray(row))
          throw new PdfAlarmError(
            "INVALID_DATA",
            "Table rows must be JSON objects",
          );
        const cells = makeCells(
          e.columns.map((c) => formatValue(getValue(row, c.path), c.formatter)),
          font,
          e.font,
        );
        const height = rowHeight(cells);
        if (height + headerHeight > p.height - e.topMargin - e.bottomMargin)
          throw new PdfAlarmError(
            "TEXT_OVERFLOW",
            "A table row is taller than a continuation page",
          );
        if (y + height > bottom + 0.01) {
          page = doc.insertPage(doc.getPages().indexOf(page) + 1, [
            p.width,
            p.height,
          ]);
          assertPageBudget();
          for (const decor of p.continuationElements ?? [])
            await renderElement(page, decor);
          y = e.topMargin;
          bottom = p.height - e.bottomMargin;
          drawRow(headers, headerHeight, true);
        }
        drawRow(cells, height, false);
      }
    }
  }
  const bytes = await doc.save();
  if (bytes.byteLength > limits.maxOutputBytes)
    throw new PdfAlarmError("LIMIT_EXCEEDED", "Output exceeds the byte limit");
  return {
    bytes,
    metrics: {
      pageCount: doc.getPageCount(),
      fileSize: bytes.byteLength,
      renderTimeMs: Math.round(performance.now() - started),
      tableRowCount,
    },
  };
}
