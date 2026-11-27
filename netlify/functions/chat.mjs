// Netlify function: POST /api/chat streams the answer as plain text.
import { streamReply } from '../../lib/core.mjs';

export default async (req) => {
  if (req.method === 'GET') return Response.json({ ok: true });
  if (req.method !== 'POST') return Response.json({ error: 'POST only' }, { status: 405 });
  const body = await req.json().catch(() => ({}));
  const it = streamReply(body);
  let first;
  try { first = await it.next(); } catch (e) { return Response.json({ error: String(e.message || e) }, { status: 502 }); }
  if (first.done) return Response.json({ error: 'empty reply' }, { status: 502 });
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(c) {
      c.enqueue(enc.encode(first.value));
      try { for await (const t of it) c.enqueue(enc.encode(t)); } catch {}
      c.close();
    }
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
};

export const config = { path: '/api/chat' };
