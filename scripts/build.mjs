import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
execFileSync(process.execPath, ["node_modules/typescript/bin/tsc"], {
  stdio: "inherit",
});
fs.rmSync("site-dist", { recursive: true, force: true });
fs.cpSync("site", "site-dist", { recursive: true });
fs.cpSync("assets/fonts", "site-dist/fonts", { recursive: true });
if (fs.existsSync("examples"))
  fs.cpSync("examples", "site-dist/examples", { recursive: true });
if (fs.existsSync("site/playground.ts"))
  await build({
    entryPoints: ["site/playground.ts"],
    outfile: "site-dist/playground.js",
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2022",
    minify: true,
  });
fs.rmSync("site-dist/playground.ts", { force: true });
fs.copyFileSync(
  "node_modules/pdfjs-dist/build/pdf.worker.min.mjs",
  "site-dist/pdf.worker.mjs",
);
fs.cpSync(
  "node_modules/pdfjs-dist/standard_fonts",
  "site-dist/standard_fonts",
  { recursive: true },
);
if (fs.existsSync("output/pdf"))
  fs.cpSync("output/pdf", "site-dist/samples", { recursive: true });

if (fs.existsSync("output/fixtures/base.pdf"))
  fs.copyFileSync("output/fixtures/base.pdf", "site-dist/samples/base.pdf");
