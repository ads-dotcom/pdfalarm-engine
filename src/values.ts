import type { Condition, Formatter } from "./schema.js";
import { PdfAlarmError } from "./errors.js";
export function getValue(data: unknown, path: string): unknown {
  let value = data;
  for (const part of path.split(".")) {
    if (["__proto__", "prototype", "constructor"].includes(part))
      throw new PdfAlarmError("INVALID_DATA", "Unsafe data path");
    if (
      value === null ||
      typeof value !== "object" ||
      !Object.hasOwn(value, part)
    )
      return undefined;
    value = (value as Record<string, unknown>)[part];
  }
  return value;
}
export function asText(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (["string", "number", "boolean"].includes(typeof value))
    return String(value);
  throw new PdfAlarmError(
    "INVALID_DATA",
    "Text bindings must resolve to a string, number or boolean",
  );
}
export function interpolate(text: string, data: unknown): string {
  return text.replace(/\{\{?\s*([A-Za-z0-9_.-]+)\s*\}?\}/g, (_, path: string) =>
    asText(getValue(data, path)),
  );
}
export function formatValue(value: unknown, formatter?: Formatter): string {
  if (value === undefined || value === null) return "";
  if (!formatter || formatter.type === "text") return asText(value);
  try {
    switch (formatter.type) {
      case "uppercase":
        return asText(value).toLocaleUpperCase(formatter.locale);
      case "lowercase":
        return asText(value).toLocaleLowerCase(formatter.locale);
      case "number":
      case "currency": {
        if (
          typeof value !== "number" &&
          (typeof value !== "string" || !value.trim())
        )
          throw new Error("Expected numeric value");
        const n = Number(value);
        if (!Number.isFinite(n)) throw new Error("Expected finite number");
        return new Intl.NumberFormat(formatter.locale, {
          style: formatter.type === "currency" ? "currency" : "decimal",
          currency: formatter.currency,
          minimumFractionDigits: formatter.decimals,
          maximumFractionDigits: formatter.decimals,
        }).format(n);
      }
      case "date": {
        const raw = asText(value);
        if (!/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(raw))
          throw new Error("Expected ISO date");
        const d = new Date(raw);
        if (!Number.isFinite(d.getTime())) throw new Error("Invalid date");
        if (raw.length === 10 && d.toISOString().slice(0, 10) !== raw)
          throw new Error("Invalid calendar date");
        return new Intl.DateTimeFormat(formatter.locale, {
          year: "numeric",
          month: "short",
          day: "numeric",
          timeZone: "UTC",
        }).format(d);
      }
    }
  } catch (e) {
    throw new PdfAlarmError(
      "INVALID_DATA",
      `Formatting failed: ${e instanceof Error ? e.message : "Invalid format"}`,
    );
  }
}
export function conditionPasses(c: Condition, data: unknown): boolean {
  const v = getValue(data, c.path);
  switch (c.operator) {
    case "exists":
      return v !== undefined && v !== null && v !== "";
    case "equals":
      return v === c.value;
    case "notEquals":
      return v !== c.value;
    case "greaterThan":
      return (
        typeof v === "number" && typeof c.value === "number" && v > c.value
      );
    case "lessThan":
      return (
        typeof v === "number" && typeof c.value === "number" && v < c.value
      );
    case "contains":
      return (
        typeof v === "string" &&
        typeof c.value === "string" &&
        v.includes(c.value)
      );
  }
}
