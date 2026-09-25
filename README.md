# Bao – sito web su Cloudflare Pages

Cartelle:
- `public/index.html` – il sito (quello che vedi nel browser)
- `functions/api/[[path]].js` – il server (prima era server.py)
- `functions/_lib/patterns.js` – le frasi di Bao (prima era patterns_bao_salute.py)
- `wrangler.toml` – impostazioni di Cloudflare (qui va l'id del KV)

Primo deploy (una volta sola):
1. Installa Node.js LTS da nodejs.org
2. Apri il terminale in questa cartella e scrivi: npm install
3. npx wrangler login
4. npx wrangler kv namespace create BAO   -> copia l'id in wrangler.toml
5. npx wrangler pages project create bao  (production branch: main)
6. npm run deploy

Prova sul tuo computer prima di pubblicare: npm run dev  -> http://localhost:8788
Aggiornare il sito dopo una modifica: npm run deploy
