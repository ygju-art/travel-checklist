export async function onRequest(ctx: any): Promise<Response> {
    const email =
      ctx.request.headers.get("CF-Access-Authenticated-User-Email") ||
      ctx.request.headers.get("X-Auth-Email"); // 백업 헤더
    if (!email) return new Response("Unauthorized", { status: 401 });
    return Response.json({ email });
  }
  