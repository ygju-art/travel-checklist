export async function onRequestGet({ params, env }) {
  const id = params.id;
  if (!id) return new Response('Bad Request', { status: 400 });
  const val = await env.TRIPS.get(id);
  if (!val) return new Response('Not Found', { status: 404 });
  return new Response(val, { headers: { 'Content-Type': 'application/json' } });
}

export async function onRequestPut({ request, params, env }) {
  const id = params.id;
  if (!id) return new Response('Bad Request', { status: 400 });
  let text;
  try {
    text = await request.text();
    JSON.parse(text); // 형식 검증
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }
  await env.TRIPS.put(id, text, { metadata: { updated: Date.now() } });
  return new Response('OK', { status: 200 });
}
