type TripItem = { id: string; text: string; done: boolean };
type Trip = { id: string; name: string; date: string; items: TripItem[] };

const ok = (data: any, init?: ResponseInit) =>
  new Response(JSON.stringify(data), {
    headers: { "content-type": "application/json; charset=utf-8" },
    ...init,
  });

export async function onRequestGet(ctx: any): Promise<Response> {
  const email = getEmail(ctx.request);
  if (!email) return new Response("Unauthorized", { status: 401 });

  const key = kvKey(email);
  const raw = await ctx.env.TRIPS.get(key);
  const trips: Trip[] = raw ? JSON.parse(raw) : [];
  return ok({ trips });
}

export async function onRequestPut(ctx: any): Promise<Response> {
  const email = getEmail(ctx.request);
  if (!email) return new Response("Unauthorized", { status: 401 });

  let body: any = {};
  try { body = await ctx.request.json(); } catch {}
  const trips: Trip[] = Array.isArray(body?.trips) ? body.trips : [];

  // 간단한 유효성 검사
  trips.forEach((t) => {
    if (!t.id || !t.name || !t.date || !Array.isArray(t.items))
      throw new Error("invalid trip object");
  });

  await ctx.env.TRIPS.put(kvKey(email), JSON.stringify(trips));
  return ok({ ok: true });
}

function kvKey(email: string) { return `user:${email.toLowerCase()}`; }
function getEmail(req: Request) {
  return req.headers.get("CF-Access-Authenticated-User-Email") ||
         req.headers.get("X-Auth-Email");
}
