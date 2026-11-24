import { RULES } from './kb.mjs';

// Tried in order. If one is busy or unavailable, the next one answers.
const MODELS = [process.env.GEMINI_MODEL, 'gemini-3.5-flash-lite', 'gemini-flash-lite-latest', 'gemini-3.6-flash', 'gemini-flash-latest']
  .filter((m, i, a) => m && a.indexOf(m) === i);

async function callModel(model, key, contents) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000); // give each model at most 8 seconds
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    signal: ctl.signal,
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: RULES }] },
      contents,
      generationConfig: { maxOutputTokens: 400 }
    })
  });
  const j = await r.json().catch(() => ({}));
  clearTimeout(timer);
  if (!r.ok) return { ok: false, status: r.status, error: (j.error && j.error.message) || 'model error' };
  const text = ((j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || [])
    .map(p => p.text || '').join('').trim();
  return text ? { ok: true, text } : { ok: false, status: 502, error: 'empty reply' };
}

export async function reply(body) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { status: 503, json: { error: 'GEMINI_API_KEY is not set' } };

  const raw = Array.isArray(body && body.messages) ? body.messages.slice(-8) : [];
  const contents = raw
    .filter(m => m && typeof m.content === 'string' && m.content.trim())
    .map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content.slice(0, 600) }] }));
  while (contents.length && contents[0].role !== 'user') contents.shift();
  if (!contents.length) return { status: 400, json: { error: 'no message' } };

  const tried = [];
  const started = Date.now();
  for (const model of MODELS) {
    if (Date.now() - started > 20000) break; // stay well inside the host's time limit
    try {
      const r = await callModel(model, key, contents);
      if (r.ok) return { status: 200, json: { text: r.text, model } };
      tried.push(`${model}: ${r.status} ${r.error}`);
      if (r.status === 400 && !/not found|not supported/i.test(r.error)) break; // a real request problem, stop
    } catch (e) {
      tried.push(`${model}: ${e && e.name === 'AbortError' ? 'timed out' : 'network error'}`);
    }
  }
  return { status: 502, json: { error: 'all models busy', tried } };
}
