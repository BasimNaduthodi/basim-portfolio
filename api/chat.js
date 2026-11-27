// Vercel serverless function: POST /api/chat streams the answer as plain text.
import { streamReply } from '../lib/core.mjs';

export default async function handler(req, res) {
  if (req.method === 'GET') return res.status(200).json({ ok: true }); // warm-up ping
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }

  const it = streamReply(body || {});
  let first;
  try { first = await it.next(); } catch (e) { return res.status(502).json({ error: String(e.message || e) }); }
  if (first.done) return res.status(502).json({ error: 'empty reply' });

  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.write(first.value);
  try { for await (const t of it) res.write(t); } catch {}
  res.end();
}
