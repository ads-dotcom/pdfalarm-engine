const base =
  process.env.BASE_URL ?? "https://pdfalarm-engine.hakan-olcer.workers.dev";
const paths = [
  "/",
  "/docs.html",
  "/privacy.html",
  "/licenses.html",
  "/health",
  "/playground.js",
  "/pdf.worker.mjs",
  "/fonts/NotoSans-Regular.ttf",
  "/examples/invoice.template.json",
  "/samples/invoice.pdf",
  "/samples/label.pdf",
  "/samples/certificate.pdf",
  "/samples/overlay.pdf",
  "/samples/base.pdf",
];
for (const path of paths) {
  const response = await fetch(new URL(path, base), {
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  if (path.endsWith(".pdf")) {
    const reader = response.body.getReader();
    const first = await reader.read();
    await reader.cancel();
    if (
      !first.value ||
      new TextDecoder().decode(first.value.slice(0, 5)) !== "%PDF-"
    )
      throw new Error(`Invalid PDF: ${path}`);
  } else await response.body?.cancel();
}
const missing = await fetch(new URL("/missing-live-check", base));
if (missing.status !== 404) throw new Error("Missing page did not return 404");
await missing.body?.cancel();
console.log(`Live HTTPS checks passed: ${paths.length} routes and a real 404.`);
