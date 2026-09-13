export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      if (request.method !== "GET" && request.method !== "HEAD")
        return new Response("Method not allowed", {
          status: 405,
          headers: { Allow: "GET, HEAD" },
        });
      return Response.json(
        { status: "ok", project: "pdfalarm-engine", version: "0.1.0" },
        {
          headers: {
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
          },
        },
      );
    }
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
