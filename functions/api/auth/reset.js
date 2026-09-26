// POST /api/auth/reset  { token, password }
// Salva la nuova password se il codice del link e' valido, non scaduto e mai usato.
// Dopo il cambio chiude tutte le sessioni aperte con la password vecchia.
import { sha256hex, newPasswordRecord } from '../../../lib/auth.js';

export async function onRequestPost({ request, env }) {
  const { token, password } = await request.json().catch(() => ({}));
  if (!token || String(password || '').length < 8)
    return Response.json({ error: 'The password needs at least 8 characters.' }, { status: 400 });

  const row = await env.DB.prepare(
    "SELECT email FROM password_resets WHERE token_hash = ? AND used = 0 AND expires > datetime('now')"
  ).bind(await sha256hex(String(token))).first();
  if (!row)
    return Response.json({ error: 'This link has expired or was already used. Ask for a new one.' }, { status: 410 });

  const { salt, hash } = await newPasswordRecord(String(password));
  await env.DB.batch([
    env.DB.prepare('UPDATE users SET salt = ?, hash = ? WHERE email = ?').bind(salt, hash, row.email),
    env.DB.prepare('UPDATE password_resets SET used = 1 WHERE email = ?').bind(row.email),
    env.DB.prepare('DELETE FROM sessions WHERE email = ?').bind(row.email)
  ]);
  return Response.json({ ok: true });
}
