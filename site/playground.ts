import { renderPdf, PdfAlarmError } from "../src/index.js";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
GlobalWorkerOptions.workerSrc = "/pdf.worker.mjs";
function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing UI element ${id}`);
  return node as T;
}
const dataInput = el<HTMLTextAreaElement>("data-input"),
  templateInput = el<HTMLTextAreaElement>("template-input");
const generate = el<HTMLButtonElement>("generate"),
  reset = el<HTMLButtonElement>("reset"),
  download = el<HTMLAnchorElement>("download");
const status = el("status"),
  error = el("error"),
  canvas = el<HTMLCanvasElement>("pdf-canvas"),
  placeholder = el("preview-placeholder");
const prev = el<HTMLButtonElement>("prev-page"),
  next = el<HTMLButtonElement>("next-page"),
  tabs = [...document.querySelectorAll<HTMLButtonElement>("[data-example]")];
let chosen = "invoice",
  blobUrl: string | undefined,
  pageNumber = 1,
  busy = false;
let loading: ReturnType<typeof getDocument> | undefined;
let pdf: Awaited<ReturnType<typeof getDocument>["promise"]> | undefined;
let renderTask: ReturnType<NonNullable<typeof pdf>["getPage"]> extends Promise<
  infer P
>
  ? P extends { render: (...a: never[]) => infer R }
    ? R
    : never
  : never;
async function bytes(url: string): Promise<Uint8Array> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Could not load ${url}`);
  return new Uint8Array(await r.arrayBuffer());
}
const fontsPromise = Promise.all([
  bytes("/fonts/NotoSans-Regular.ttf"),
  bytes("/fonts/NotoSans-Bold.ttf"),
]).then(([regular, bold]) => ({ NotoSans: regular!, "NotoSans-Bold": bold! }));
function setBusy(value: boolean) {
  busy = value;
  dataInput.readOnly = value;
  templateInput.readOnly = value;
  generate.disabled = value;
  reset.disabled = value;
  for (const tab of tabs) tab.disabled = value;
  generate.textContent = value ? "Generating…" : "Generate PDF";
}
function clearDownload() {
  download.removeAttribute("href");
  download.setAttribute("aria-disabled", "true");
  if (blobUrl) {
    URL.revokeObjectURL(blobUrl);
    blobUrl = undefined;
  }
}
function dirty() {
  clearDownload();
  status.textContent = "Data changed. Generate a PDF to update the preview.";
}
async function showPage(): Promise<void> {
  if (!pdf) return;
  prev.disabled = true;
  next.disabled = true;
  if (renderTask) renderTask.cancel();
  const page = await pdf.getPage(pageNumber);
  const width = Math.max(200, el("canvas-wrap").clientWidth - 48);
  const natural = page.getViewport({ scale: 1 });
  const scale =
    Math.min(width / natural.width, 1.2) *
    Math.min(window.devicePixelRatio || 1, 2);
  const viewport = page.getViewport({ scale });
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  canvas.style.width = `${viewport.width / Math.min(window.devicePixelRatio || 1, 2)}px`;
  const context = canvas.getContext("2d");
  if (!context)
    throw new Error("Canvas preview is not supported by this browser");
  canvas.hidden = false;
  placeholder.hidden = true;
  renderTask = page.render({ canvasContext: context, viewport, canvas });
  await renderTask.promise;
  el("page-number").textContent = `${pageNumber} / ${pdf.numPages}`;
  prev.disabled = pageNumber <= 1;
  next.disabled = pageNumber >= pdf.numPages;
}
async function makePdf(): Promise<void> {
  if (busy) return;
  setBusy(true);
  error.hidden = true;
  clearDownload();
  status.textContent = "Generating your document locally…";
  try {
    if (
      dataInput.value.length > 1024 * 1024 ||
      templateInput.value.length > 1024 * 1024
    )
      throw new Error("Demo inputs must each be under 1 MB.");
    let data: unknown, template: unknown;
    try {
      data = JSON.parse(dataInput.value);
    } catch {
      throw new Error(
        "Document data is not valid JSON. Check commas and quotation marks.",
      );
    }
    try {
      template = JSON.parse(templateInput.value);
    } catch {
      throw new Error(
        "Template is not valid JSON. Check commas and quotation marks.",
      );
    }
    const result = await renderPdf({
      template,
      data,
      fonts: await fontsPromise,
      limits: { maxPages: 20, maxRows: 1000 },
    });
    if (loading) await loading.destroy();
    loading = getDocument({
      data: result.bytes.slice(),
      useWasm: false,
      standardFontDataUrl: "/standard_fonts/",
    });
    pdf = await loading.promise;
    pageNumber = 1;
    await showPage();
    blobUrl = URL.createObjectURL(
      new Blob([Uint8Array.from(result.bytes).buffer], {
        type: "application/pdf",
      }),
    );
    download.href = blobUrl;
    download.download = `pdfalarm-${chosen}.pdf`;
    download.setAttribute("aria-disabled", "false");
    el("pdf-metrics").textContent =
      `${result.metrics.pageCount} page${result.metrics.pageCount === 1 ? "" : "s"} · ${(result.metrics.fileSize / 1024).toFixed(1)} KB`;
    status.textContent = "Your PDF is ready. Preview it or download the file.";
  } catch (cause) {
    const message =
      cause instanceof PdfAlarmError
        ? `${cause.code}: ${cause.message}`
        : cause instanceof Error
          ? cause.message
          : "Unable to generate this document.";
    error.textContent = message;
    error.hidden = false;
    status.textContent = "Please correct the input and try again.";
  } finally {
    setBusy(false);
  }
}
async function choose(name: string): Promise<void> {
  if (busy) return;
  setBusy(true);
  clearDownload();
  status.textContent = "Loading the example…";
  error.hidden = true;
  try {
    const responses = await Promise.all([
      fetch(`/examples/${name}.template.json`),
      fetch(`/examples/${name}.data.json`),
    ]);
    if (responses.some((r) => !r.ok))
      throw new Error("Could not load the example. Please refresh the page.");
    const [template, data] = await Promise.all(responses.map((r) => r.json()));
    chosen = name;
    templateInput.value = JSON.stringify(template, null, 2);
    dataInput.value = JSON.stringify(data, null, 2);
    for (const tab of tabs)
      tab.setAttribute("aria-pressed", String(tab.dataset.example === name));
    setBusy(false);
    await makePdf();
  } catch (cause) {
    error.textContent =
      cause instanceof Error ? cause.message : "Could not load the example.";
    error.hidden = false;
    status.textContent = "Example loading failed.";
    setBusy(false);
  }
}
generate.addEventListener("click", () => void makePdf());
reset.addEventListener("click", () => void choose(chosen));
for (const tab of tabs)
  tab.addEventListener("click", () => void choose(tab.dataset.example!));
dataInput.addEventListener("input", dirty);
templateInput.addEventListener("input", dirty);
prev.addEventListener("click", () => {
  if (pageNumber > 1) {
    pageNumber--;
    void showPage().catch(showPreviewError);
  }
});
next.addEventListener("click", () => {
  if (pdf && pageNumber < pdf.numPages) {
    pageNumber++;
    void showPage().catch(showPreviewError);
  }
});
function showPreviewError(cause: unknown) {
  error.textContent = cause instanceof Error ? cause.message : "Preview failed";
  error.hidden = false;
}
void choose("invoice");
