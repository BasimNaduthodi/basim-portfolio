// Netlify function: POST /api/chat
import { reply } from '../../lib/core.mjs';

export default async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'POST only' }, { status: 405 });
  const body = await req.json().catch(() => ({}));
  const r = await reply(body);
  return Response.json(r.json, { status: r.status });
};

export const config = { path: '/api/chat' };
