import { z } from "zod";

const path = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*$/)
  .refine(
    (v) =>
      !v
        .split(".")
        .some((p) => ["__proto__", "prototype", "constructor"].includes(p)),
    "Unsafe data path",
  );
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const scalar = z.union([
  z.string().max(20000),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);
const formatter = z.strictObject({
  type: z.enum([
    "text",
    "number",
    "currency",
    "date",
    "uppercase",
    "lowercase",
  ]),
  locale: z.string().max(35).default("en-US"),
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .default("USD"),
  decimals: z.number().int().min(0).max(10).default(2),
});
const condition = z.strictObject({
  path,
  operator: z.enum([
    "equals",
    "notEquals",
    "greaterThan",
    "lessThan",
    "contains",
    "exists",
  ]),
  value: scalar.optional(),
});
const common = {
  x: z.number().finite().min(0).max(14400),
  y: z.number().finite().min(0).max(14400),
  width: z.number().finite().positive().max(14400),
  height: z.number().finite().positive().max(14400),
  conditions: z.array(condition).max(20).optional(),
  conditionLogic: z.enum(["AND", "OR"]).default("AND"),
};
const textStyle = {
  font: z.string().max(100).default("Helvetica"),
  fontSize: z.number().min(4).max(200).default(12),
  color: color.default("#17232C"),
  align: z.enum(["left", "center", "right"]).default("left"),
  lineHeight: z.number().min(1).max(3).default(1.4),
};
const text = z.strictObject({
  ...common,
  type: z.literal("TEXT"),
  ...textStyle,
  text: z.string().max(20000).optional(),
  dataField: path.optional(),
  formatter: formatter.optional(),
});
const rectangle = z.strictObject({
  ...common,
  type: z.literal("RECTANGLE"),
  fill: color.optional(),
  stroke: color.optional(),
  strokeWidth: z.number().min(0).max(20).default(1),
});
const line = z.strictObject({
  ...common,
  type: z.literal("LINE"),
  width: z.number().min(0).max(14400),
  height: z.number().min(0).max(14400),
  color: color.default("#17232C"),
  strokeWidth: z.number().min(0.1).max(20).default(1),
});
const qr = z.strictObject({
  ...common,
  type: z.literal("QR_CODE"),
  text: z.string().max(2000).optional(),
  dataField: path.optional(),
  errorCorrection: z.enum(["L", "M", "Q", "H"]).default("M"),
  quietZone: z.number().int().min(4).max(12).default(4),
  color: color.default("#17232C"),
});
const barcode = z.strictObject({
  ...common,
  type: z.literal("BARCODE"),
  text: z.string().max(120).optional(),
  dataField: path.optional(),
  barcodeType: z.enum(["code128", "ean13"]).default("code128"),
  showText: z.boolean().default(true),
  font: z.string().max(100).default("Helvetica"),
  color: color.default("#17232C"),
});
const image = z.strictObject({
  ...common,
  type: z.literal("IMAGE"),
  asset: z.string().min(1).max(200),
  fit: z.literal("contain").default("contain"),
});
const column = z.strictObject({
  header: z.string().max(200),
  path,
  width: z.number().positive().max(14400),
  align: z.enum(["left", "center", "right"]).default("left"),
  formatter: formatter.optional(),
});
const table = z.strictObject({
  ...common,
  type: z.literal("TABLE"),
  ...textStyle,
  dataPath: path,
  columns: z.array(column).min(1).max(20),
  padding: z.number().min(2).max(30).default(8),
  minRowHeight: z.number().min(10).max(200).default(28),
  headerFill: color.default("#EDF2F1"),
  headerFont: z.string().max(100).optional(),
  gridColor: color.default("#DCE4E2"),
  topMargin: z.number().min(0).max(14400).default(40),
  bottomMargin: z.number().min(0).max(14400).default(40),
});
export const ElementSchema = z.discriminatedUnion("type", [
  text,
  rectangle,
  line,
  qr,
  barcode,
  image,
  table,
]);
export const TemplateSchema = z
  .strictObject({
    version: z.literal(1),
    title: z.string().max(200).default("PDFAlarm document"),
    pages: z
      .array(
        z.strictObject({
          width: z.number().min(72).max(14400),
          height: z.number().min(72).max(14400),
          elements: z.array(ElementSchema).max(2000),
          continuationElements: z.array(ElementSchema).max(50).optional(),
        }),
      )
      .min(1)
      .max(50),
  })
  .superRefine((t, ctx) => {
    t.pages.forEach((p, i) => {
      p.elements.forEach((e, j) => {
        if (e.x + e.width > p.width + 0.01 || e.y + e.height > p.height + 0.01)
          ctx.addIssue({
            code: "custom",
            path: ["pages", i, "elements", j],
            message: "Element must fit inside its page",
          });
        if (e.type === "TABLE" && j !== p.elements.length - 1)
          ctx.addIssue({
            code: "custom",
            path: ["pages", i, "elements", j],
            message:
              "A flowing table must be the last element of its template page",
          });
        if (
          e.type === "TABLE" &&
          Math.abs(e.columns.reduce((s, c) => s + c.width, 0) - e.width) > 0.01
        )
          ctx.addIssue({
            code: "custom",
            path: ["pages", i, "elements", j],
            message: "Table column widths must equal the table width",
          });
      });
      p.continuationElements?.forEach((e, j) => {
        if (
          e.type === "TABLE" ||
          e.x + e.width > p.width + 0.01 ||
          e.y + e.height > p.height + 0.01
        )
          ctx.addIssue({
            code: "custom",
            path: ["pages", i, "continuationElements", j],
            message: "Continuation elements must fit and cannot be tables",
          });
      });
    });
  });
export type Template = z.infer<typeof TemplateSchema>;
export type TemplateInput = z.input<typeof TemplateSchema>;
export type Element = z.infer<typeof ElementSchema>;
export type Formatter = z.infer<typeof formatter>;
export type Condition = z.infer<typeof condition>;
