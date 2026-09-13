import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
const listener = createServer();
await new Promise((resolve) => listener.listen(0, "127.0.0.1", resolve));
const port = listener.address().port;
await new Promise((resolve) => listener.close(resolve));
const child = spawn(
  process.execPath,
  [
    "node_modules/wrangler/bin/wrangler.js",
    "dev",
    "--local",
    "--config",
    "wrangler.render-example.jsonc",
    "--ip",
    "127.0.0.1",
    "--port",
    String(port),
    "--inspector-port",
    "0",
  ],
  { stdio: ["ignore", "pipe", "pipe"] },
);
let logs = "";
for (const stream of [child.stdout, child.stderr])
  stream.on("data", (chunk) => {
    logs = (logs + chunk).slice(-4000);
  });
try {
  let response;
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Worker exited: ${logs}`);
    try {
      response = await fetch(`http://127.0.0.1:${port}/`, {
        signal: AbortSignal.timeout(3000),
      });
      if (response.ok) break;
    } catch {}
    await delay(200);
  }
  if (!response?.ok) throw new Error(`Worker did not start: ${logs}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-")
    throw new Error("Worker did not return a PDF");
  const task = getDocument({ data: bytes, useWasm: false });
  try {
    const pdf = await task.promise;
    const text = (await (await pdf.getPage(1)).getTextContent()).items
      .filter((i) => "str" in i)
      .map((i) => i.str)
      .join(" ");
    if (!text.includes("İpek Yılmaz") || !text.includes("€500.00"))
      throw new Error("Worker PDF data/font validation failed");
  } finally {
    await task.destroy();
  }
  console.log(
    "Real local Cloudflare Worker rendered an extractable Turkish PDF with correct sample data.",
  );
} finally {
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.on("exit", resolve)),
    delay(3000),
  ]);
  if (child.exitCode === null) child.kill("SIGKILL");
}
