export type ErrorCode =
  | "INVALID_TEMPLATE"
  | "INVALID_DATA"
  | "LIMIT_EXCEEDED"
  | "FONT_NOT_FOUND"
  | "UNSUPPORTED_GLYPH"
  | "TEXT_OVERFLOW"
  | "ASSET_ERROR"
  | "INVALID_PDF"
  | "INVALID_BARCODE";
export class PdfAlarmError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PdfAlarmError";
  }
}
