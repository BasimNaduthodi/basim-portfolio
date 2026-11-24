// Vercel serverless function: POST /api/chat
import { reply } from '../lib/core.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const r = await reply(body || {});
  res.status(r.status).json(r.json);
}
