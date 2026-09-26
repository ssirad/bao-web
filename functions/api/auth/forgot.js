// POST /api/auth/forgot  { email, lang }
// Se l'email ha un account, manda un link per scegliere una nuova password (valido 30 minuti, una volta).
// Risponde sempre allo stesso modo, cosi' nessuno puo' scoprire quali email sono registrate.
//
// Servono tre segreti nel progetto Cloudflare (Settings -> Variables and Secrets):
//   RESEND_API_KEY   la chiave di Resend
//   MAIL_FROM        per esempio  BAO <onboarding@resend.dev>  (senza dominio)  o  BAO <bao@tuodominio.it>
//   APP_URL          per esempio  https://bao-web.pages.dev
import { sha256hex, randomToken } from '../../../lib/auth.js';

const TEXT = {
  en: {
    subject: 'Choose a new password for BAO',
    hi: 'Hi,',
    body: 'someone asked to reset the password of your BAO account.',
    button: 'Choose a new password',
    expires: 'The link works for 30 minutes, and only once.',
    ignore: 'If it was not you, ignore this email: your password stays the same.'
  },
  de: {
    subject: 'Neues Passwort für BAO',
    hi: 'Hallo,',
    body: 'jemand möchte das Passwort deines BAO-Kontos zurücksetzen.',
    button: 'Neues Passwort wählen',
    expires: 'Der Link gilt 30 Minuten und nur ein einziges Mal.',
    ignore: 'Warst du das nicht, ignoriere diese E-Mail: Dein Passwort bleibt gleich.'
  }
};

function mailHtml(x, link) {
  return '<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;color:#24333b">' +
    '<p style="font-size:22px;font-weight:bold;color:#0d5e5b;margin:0 0 18px">BAO</p>' +
    '<p>' + x.hi + '</p><p>' + x.body + '</p>' +
    '<p style="margin:26px 0"><a href="' + link + '" style="background:#187d78;color:#ffffff;' +
    'text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:bold;display:inline-block">' +
    x.button + '</a></p>' +
    '<p style="color:#687880;font-size:13px">' + x.expires + '</p>' +
    '<p style="color:#687880;font-size:13px">' + x.ignore + '</p></div>';
}

export async function onRequestPost({ request, env }) {
  const { email, lang } = await request.json().catch(() => ({}));
  const addr = String(email || '').trim().toLowerCase();
  const same = Response.json({ ok: true });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(addr)) return same;

  const user = await env.DB.prepare('SELECT email FROM users WHERE email = ?').bind(addr).first();
  if (!user) return same;

  // al massimo 3 richieste all'ora per indirizzo, contro chi vuole intasare la casella
  const recent = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM password_resets WHERE email = ? AND created > datetime('now','-1 hour')"
  ).bind(addr).first();
  if (recent && recent.n >= 3) return same;

  const token = randomToken();
  await env.DB.prepare(
    "INSERT INTO password_resets (token_hash, email, created, expires) " +
    "VALUES (?, ?, datetime('now'), datetime('now','+30 minutes'))"
  ).bind(await sha256hex(token), addr).run();

  const x = TEXT[lang === 'de' ? 'de' : 'en'];
  const link = String(env.APP_URL || '').replace(/\/$/, '') + '/?reset=' + token;
  // Se Resend rifiuta o non risponde, lo si legge nei log (Deployments -> Functions -> Real-time logs).
  // Alla pagina si risponde comunque come sempre: un errore diverso rivelerebbe che l'account esiste.
  try {
    const sent = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env.MAIL_FROM, to: addr, subject: x.subject, html: mailHtml(x, link) })
    });
    if (!sent.ok) console.log('Resend refused the email:', sent.status, await sent.text());
  } catch (e) {
    console.log('Resend could not be reached:', e && e.message);
  }
  return same;
}
