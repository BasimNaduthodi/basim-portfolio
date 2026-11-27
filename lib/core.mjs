import { RULES } from './kb.mjs';

// Tried in order. If one is busy or slow to start, the next one answers.
const MODELS = [process.env.GEMINI_MODEL, 'gemini-3.5-flash-lite', 'gemini-flash-lite-latest', 'gemini-3.6-flash', 'gemini-flash-latest']
  .filter((m, i, a) => m && a.indexOf(m) === i);
const BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';

function toContents(body) {
  const raw = Array.isArray(body && body.messages) ? body.messages.slice(-8) : [];
  const contents = raw
    .filter(m => m && typeof m.content === 'string' && m.content.trim())
    .map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content.slice(0, 600) }] }));
  while (contents.length && contents[0].role !== 'user') contents.shift();
  return contents;
}

async function open(model, key, contents, quick) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 7000); // must start answering within 7 s
  const generationConfig = { maxOutputTokens: 350 };
  if (quick) generationConfig.thinkingConfig = { thinkingLevel: 'minimal' }; // answer fast, skip long thinking
  try {
    const r = await fetch(`${BASE}${model}:streamGenerateContent?alt=sse`, {
      method: 'POST',
      signal: ctl.signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: RULES }] }, contents, generationConfig })
    });
    if (!r.ok) {
      clearTimeout(timer);
      const j = await r.json().catch(() => ({}));
      return { ok: false, status: r.status, error: (j.error && j.error.message) || 'model error' };
    }
    return { ok: true, r, timer };
  } catch (e) {
    clearTimeout(timer);
    return { ok: false, status: 0, error: e && e.name === 'AbortError' ? 'timed out' : 'network error' };
  }
}

async function* sse(r, timer) {
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let first = true;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line.startsWith('data:')) continue;
      try {
        const j = JSON.parse(line.slice(5));
        const parts = (j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || [];
        const t = parts.filter(p => !p.thought).map(p => p.text || '').join('');
        if (t) {
          if (first) { clearTimeout(timer); first = false; }
          yield t;
        }
      } catch {}
    }
  }
  clearTimeout(timer);
}

// Yields the answer in small pieces as soon as the model writes them.
export async function* streamReply(body) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is not set');
  const contents = toContents(body);
  if (!contents.length) throw new Error('no message');

  for (const model of MODELS) {
    for (const quick of [true, false]) {
      const o = await open(model, key, contents, quick);
      if (!o.ok) {
        if (quick && o.status === 400 && /thinking/i.test(o.error)) continue; // model doesn't take that setting: retry without
        break; // busy, slow, missing: next model
      }
      let got = false;
      try {
        for await (const t of sse(o.r, o.timer)) { got = true; yield t; }
      } catch { if (got) return; }
      if (got) return;
      break;
    }
  }
  throw new Error('all models busy');
}
