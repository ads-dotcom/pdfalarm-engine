import fs from "node:fs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { renderPdf } from "../dist/index.js";
import { examples } from "./example-data.mjs";
const fonts = {
  NotoSans: new Uint8Array(
    fs.readFileSync("assets/fonts/NotoSans-Regular.ttf"),
  ),
  "NotoSans-Bold": new Uint8Array(
    fs.readFileSync("assets/fonts/NotoSans-Bold.ttf"),
  ),
};
fs.mkdirSync("output/pdf", { recursive: true });
fs.mkdirSync("site-dist/samples", { recursive: true });
for (const [name, example] of Object.entries(examples)) {
  fs.writeFileSync(
    `examples/${name}.template.json`,
    JSON.stringify(example.template, null, 2) + "\n",
  );
  fs.writeFileSync(
    `examples/${name}.data.json`,
    JSON.stringify(example.data, null, 2) + "\n",
  );
  const r = await renderPdf({ ...example, fonts });
  fs.writeFileSync(`output/pdf/${name}.pdf`, r.bytes);
  fs.writeFileSync(`site-dist/samples/${name}.pdf`, r.bytes);
  console.log(
    `${name}: ${r.metrics.pageCount} page(s), ${r.metrics.fileSize} bytes`,
  );
}
const base = await PDFDocument.create();
const p = base.addPage([595.28, 841.89]);
const f = await base.embedFont(StandardFonts.Helvetica);
p.drawRectangle({
  x: 0,
  y: 771.89,
  width: 595.28,
  height: 70,
  color: rgb(0.14, 0.48, 0.4),
});
p.drawText("BASE PDF / SAMPLE FORM", {
  x: 40,
  y: 800,
  size: 18,
  font: f,
  color: rgb(1, 1, 1),
});
const baseBytes = await base.save();
fs.mkdirSync("output/fixtures", { recursive: true });
fs.writeFileSync("output/fixtures/base.pdf", baseBytes);
const overlay = {
  version: 1,
  title: "PDF overlay example",
  pages: [
    {
      width: 595.28,
      height: 841.89,
      elements: [
        {
          type: "TEXT",
          x: 40,
          y: 120,
          width: 515,
          height: 55,
          font: "NotoSans",
          fontSize: 22,
          text: "Prepared for {{name}}",
        },
      ],
    },
  ],
};
const r = await renderPdf({
  template: overlay,
  data: { name: "İpek Yılmaz" },
  basePdf: baseBytes,
  fonts,
});
fs.writeFileSync("output/pdf/overlay.pdf", r.bytes);
fs.writeFileSync("site-dist/samples/overlay.pdf", r.bytes);
fs.writeFileSync(
  "examples/overlay.template.json",
  JSON.stringify(overlay, null, 2) + "\n",
);
fs.writeFileSync(
  "examples/overlay.data.json",
  JSON.stringify({ name: "İpek Yılmaz" }, null, 2) + "\n",
);
fs.writeFileSync("site-dist/samples/base.pdf", baseBytes);
fs.cpSync("examples", "site-dist/examples", { recursive: true });
