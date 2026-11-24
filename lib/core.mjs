import { RULES } from './kb.mjs';

const MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';

export async function reply(body) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { status: 503, json: { error: 'GEMINI_API_KEY is not set' } };

  const raw = Array.isArray(body && body.messages) ? body.messages.slice(-8) : [];
  let contents = raw
    .filter(m => m && typeof m.content === 'string' && m.content.trim())
    .map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content.slice(0, 600) }] }));
  while (contents.length && contents[0].role !== 'user') contents.shift();
  if (!contents.length) return { status: 400, json: { error: 'no message' } };

  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: RULES }] },
        contents,
        generationConfig: { maxOutputTokens: 400 }
      })
    });
    const j = await r.json();
    if (!r.ok) return { status: 502, json: { error: (j && j.error && j.error.message) || 'model error' } };
    const text = ((j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || [])
      .map(p => p.text || '').join('').trim();
    return text ? { status: 200, json: { text } } : { status: 502, json: { error: 'empty reply' } };
  } catch (e) {
    return { status: 502, json: { error: 'could not reach the model' } };
  }
}
