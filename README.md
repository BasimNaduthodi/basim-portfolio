# Basim N — portfolio

Static site (`index.html` + `img/`) plus one small server function (`/api/chat`)
that powers the "Ask my AI" chat with Google Gemini (free tier).

## 1. Get a free Gemini API key
https://aistudio.google.com/apikey → Create API key → copy it.
Never put the key in index.html; it lives only in your host's settings.

## 2a. Deploy on Vercel
1. Push this folder to a GitHub repo (or run `npx vercel` inside it).
2. vercel.com/new → import the repo → Framework preset: **Other** → Deploy.
3. Project → Settings → Environment Variables → add `GEMINI_API_KEY` = your key.
4. Deployments → Redeploy.

## 2b. Deploy on Netlify
Netlify Drop (drag-and-drop) uploads files only and does NOT run functions,
so use Git or the CLI:
1. Push this folder to a GitHub repo → app.netlify.com → Add new site → Import.
   (or: `npx netlify-cli deploy --prod` inside the folder)
2. Site configuration → Environment variables → add `GEMINI_API_KEY`.
3. Deploys → Trigger deploy.

## How the chat behaves
- Inside claude.ai it uses Claude.
- On your own site it calls `/api/chat` (Gemini).
- If the key is missing or the call fails, it falls back to built-in answers.
- To change what the AI knows, edit `lib/kb.mjs`.
