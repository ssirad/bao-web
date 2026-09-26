// POST /api/auth/delete  { password }
// Cancella l'account di chi ha fatto il login: utente, sessioni, check-in, compagno, reset.
// Apple richiede che un'app con registrazione permetta di cancellare l'account dall'app stessa.
//
// PRIMA DI PUBBLICARE controlla due cose contro il tuo login.js:
//   1. SESSION_COOKIE deve avere lo stesso nome del cookie che imposta il login;
//   2. i nomi di tabelle e colonne devono essere quelli del tuo schema.sql.
import { sha256hex, hashPassword } from '../../../lib/auth.js';

const SESSION_COOKIE = 'session';

function readCookie(request, name) {
  const all = request.headers.get('Cookie') || '';
  for (const part of all.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

// confronto in tempo costante, per non rivelare quante lettere erano giuste
function sameText(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function onRequestPost({ request, env }) {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return Response.json({ error: 'Please sign in first.' }, { status: 401 });

  const session = await env.DB.prepare(
    "SELECT email FROM sessions WHERE token_hash = ? AND expires > datetime('now')"
  ).bind(await sha256hex(token)).first();
  if (!session) return Response.json({ error: 'Please sign in first.' }, { status: 401 });

  const { password } = await request.json().catch(() => ({}));
  const user = await env.DB.prepare('SELECT salt, hash FROM users WHERE email = ?')
    .bind(session.email).first();
  if (!user || !sameText(await hashPassword(String(password || ''), user.salt), user.hash))
    return Response.json({ error: 'That password does not match.' }, { status: 401 });

  const email = session.email;
  await env.DB.batch([
    env.DB.prepare('DELETE FROM checkins        WHERE email = ?').bind(email),
    env.DB.prepare('DELETE FROM pets            WHERE email = ?').bind(email),
    env.DB.prepare('DELETE FROM password_resets WHERE email = ?').bind(email),
    env.DB.prepare('DELETE FROM sessions        WHERE email = ?').bind(email),
    env.DB.prepare('DELETE FROM users           WHERE email = ?').bind(email)
  ]);

  return Response.json({ ok: true }, {
    headers: { 'Set-Cookie': SESSION_COOKIE + '=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax' }
  });
}
