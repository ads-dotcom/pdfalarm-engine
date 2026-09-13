import { renderPdf } from "../src/index.js";
import template from "../examples/invoice.template.json";
import data from "../examples/invoice.data.json";
import regular from "../assets/fonts/NotoSans-Regular.ttf";
import bold from "../assets/fonts/NotoSans-Bold.ttf";
export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== "GET")
      return new Response("Method not allowed", { status: 405 });
    const result = await renderPdf({
      template,
      data,
      fonts: {
        NotoSans: new Uint8Array(regular),
        "NotoSans-Bold": new Uint8Array(bold),
      },
    });
    return new Response(Uint8Array.from(result.bytes).buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "no-store",
        "X-PDFAlarm-Pages": String(result.metrics.pageCount),
      },
    });
  },
} satisfies ExportedHandler;
