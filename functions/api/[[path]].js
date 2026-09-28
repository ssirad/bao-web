// BAO server on Cloudflare Pages Functions.
// Everything lives in one KV namespace bound as `BAO`:
//   u:<email>    account      c:<email>  check-ins      p:<email>  avatar
//   s:<hash>     session      r:<hash>   reset link     v:<hash>   email confirmation link
//   rl:<...>     rate limits
// Settings (Pages > Settings > Variables and Secrets): RESEND_API_KEY (secret), MAIL_FROM, APP_URL.
import { sendMail, mailConfirm, mailReset } from '../../lib/mail.js';

const COOKIE = 'bao_session';
const SESSION_DAYS = 30;
const ITER = 100000;                 // PBKDF2 rounds (the Workers maximum)
const RESET_MIN = 30;
const VERIFY_DAYS = 7;
const MAX_CHECKINS = 5000;
const MAX_ENTRY_BYTES = 200 * 1024;

const enc = new TextEncoder();
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const fromHex = h => new Uint8Array((h.match(/../g) || []).map(x => parseInt(x, 16)));
const b64u = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const token = () => b64u(crypto.getRandomValues(new Uint8Array(32)));
const sha256 = async s => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));

function json(data, status = 200, headers = {}){
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers } });
}
const fail = (msg, status = 400) => json({ error: msg }, status);

function cleanEmail(v){
  const e = String(v || '').trim().toLowerCase();
  return e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) ? e : null;
}
const cleanLang = l => ['en', 'de', 'it', 'fr', 'es', 'pt', 'nl'].includes(l) ? l : 'en';

async function hashPassword(pw, saltHex){
  const key = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: fromHex(saltHex), iterations: ITER }, key, 256);
  return hex(bits);
}
function sameString(a, b){
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
async function newPassword(pw){
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
  return { salt, hash: await hashPassword(pw, salt) };
}

const getJSON = async (env, key, fallback = null) => (await env.BAO.get(key, 'json')) ?? fallback;
const putJSON = (env, key, value, opts) => env.BAO.put(key, JSON.stringify(value), opts);

function cookieValue(request){
  const m = (request.headers.get('Cookie') || '').match(new RegExp('(?:^|;\\s*)' + COOKIE + '=([^;]+)'));
  return m ? m[1] : null;
}
function sessionCookie(value, maxAge){
  return COOKIE + '=' + value + '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=' + maxAge;
}

async function startSession(env, user){
  const t = token();
  const h = await sha256(t);
  await putJSON(env, 's:' + h, { email: user.email }, { expirationTtl: SESSION_DAYS * 86400 });
  user.sessions = [...(user.sessions || []), h].slice(-20);
  await putJSON(env, 'u:' + user.email, user);
  return sessionCookie(t, SESSION_DAYS * 86400);
}
async function currentUser(env, request){
  const t = cookieValue(request);
  if (!t) return null;
  const s = await getJSON(env, 's:' + await sha256(t));
  if (!s) return null;
  return getJSON(env, 'u:' + s.email);
}
async function endAllSessions(env, user){
  await Promise.all((user.sessions || []).map(h => env.BAO.delete('s:' + h)));
  user.sessions = [];
}

// true = allowed. Counts per key inside a time window.
async function limit(env, key, max, seconds){
  const k = 'rl:' + key;
  const n = Number(await env.BAO.get(k)) || 0;
  if (n >= max) return false;
  await env.BAO.put(k, String(n + 1), { expirationTtl: Math.max(60, seconds) });
  return true;
}

function appUrl(env, request){
  return (env.APP_URL || new URL(request.url).origin).replace(/\/+$/, '');
}
const publicUser = u => ({ user: u.email, name: u.name || '', verified: !!u.verified });

async function sendConfirmation(env, request, user, lang){
  const t = token();
  await putJSON(env, 'v:' + await sha256(t), { email: user.email }, { expirationTtl: VERIFY_DAYS * 86400 });
  const link = appUrl(env, request) + '/api/auth/verify?token=' + encodeURIComponent(t);
  return sendMail(env, user.email, mailConfirm(env, request, lang, user.name, link));
}

async function readBody(request){
  try{ return await request.json(); }catch(e){ return {}; }
}

export async function onRequest(context){
  try{
    return await handle(context);
  }catch(err){
    console.error('BAO server error (outer)', err && err.stack || err);
    return fail('BAO server error: ' + (err && err.message || String(err)), 500);
  }
}

// Background work (emails) must never break the answer to the page.
function later(context, promise){
  const p = Promise.resolve(promise).catch(err => console.error('BAO background error', err && err.stack || err));
  try{ context.waitUntil(p); }catch(e){}
}

async function handle(context){
  const { request, env } = context;
  if (!env.BAO) return fail('The KV namespace "BAO" is not connected to this project.', 500);

  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '');
  const method = request.method;
  const route = method + ' ' + path;

  try{
    switch (route){

    case 'GET /api/version':
      return json({ version: 'bao-server 2026-09-28 18:20' });

    case 'GET /api/auth/me': {
      const u = await currentUser(env, request);
      return u ? json(publicUser(u)) : fail('Not signed in.', 401);
    }

    case 'POST /api/auth/register': {
      const b = await readBody(request);
      const email = cleanEmail(b.username);
      const pw = String(b.password || '');
      const name = String(b.name || '').trim().slice(0, 40);
      const lang = cleanLang(b.lang);
      if (!email) return fail('Please write a valid email address.');
      if (pw.length < 8) return fail('The password needs at least 8 characters.');
      if (!name) return fail('Please write a name.');
      if (!await limit(env, 'reg:' + (request.headers.get('CF-Connecting-IP') || 'x'), 10, 3600)) return fail('Too many new accounts from here. Try again later.', 429);
      if (await env.BAO.get('u:' + email)) return fail('That email is already registered. Sign in instead.', 409);
      const user = { email, name, lang, verified: false, created: new Date().toISOString(), ...(await newPassword(pw)), sessions: [] };
      const cookie = await startSession(env, user);
      later(context, sendConfirmation(env, request, user, lang));
      return json(publicUser(user), 200, { 'Set-Cookie': cookie });
    }

    case 'POST /api/auth/login': {
      const b = await readBody(request);
      const email = cleanEmail(b.username);
      const pw = String(b.password || '');
      if (!email || !pw) return fail('Email or password is wrong.', 401);
      if (!await limit(env, 'login:' + email, 10, 900)) return fail('Too many wrong attempts. Please wait 15 minutes.', 429);
      const user = await getJSON(env, 'u:' + email);
      if (!user) return fail('Email or password is wrong.', 401);
      if (!sameString(await hashPassword(pw, user.salt), user.hash)) return fail('Email or password is wrong.', 401);
      await env.BAO.delete('rl:login:' + email);
      const cookie = await startSession(env, user);
      return json(publicUser(user), 200, { 'Set-Cookie': cookie });
    }

    case 'POST /api/auth/logout': {
      const t = cookieValue(request);
      if (t){
        const h = await sha256(t);
        const s = await getJSON(env, 's:' + h);
        await env.BAO.delete('s:' + h);
        if (s){
          const u = await getJSON(env, 'u:' + s.email);
          if (u){ u.sessions = (u.sessions || []).filter(x => x !== h); await putJSON(env, 'u:' + u.email, u); }
        }
      }
      return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie('', 0) });
    }

    case 'POST /api/auth/name': {
      const u = await currentUser(env, request);
      if (!u) return fail('Not signed in.', 401);
      const name = String((await readBody(request)).name || '').trim().slice(0, 40);
      if (!name) return fail('Please write a name.');
      u.name = name;
      await putJSON(env, 'u:' + u.email, u);
      return json(publicUser(u));
    }

    case 'POST /api/auth/delete': {
      const u = await currentUser(env, request);
      if (!u) return fail('Not signed in.', 401);
      const pw = String((await readBody(request)).password || '');
      if (!sameString(await hashPassword(pw, u.salt), u.hash)) return fail('The password is not right.', 403);
      await endAllSessions(env, u);
      await Promise.all(['u:', 'c:', 'p:'].map(k => env.BAO.delete(k + u.email)));
      return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie('', 0) });
    }

    case 'POST /api/auth/forgot': {
      const b = await readBody(request);
      const email = cleanEmail(b.email);
      const lang = cleanLang(b.lang);
      // Same answer whether or not the account exists.
      if (email && await limit(env, 'forgot:' + email, 3, 3600)){
        const user = await getJSON(env, 'u:' + email);
        if (user){
          const t = token();
          await putJSON(env, 'r:' + await sha256(t), { email }, { expirationTtl: RESET_MIN * 60 });
          const link = appUrl(env, request) + '/?reset=' + encodeURIComponent(t);
          later(context, sendMail(env, email, mailReset(env, request, lang, user.name, link)));
        }
      }
      return json({ ok: true });
    }

    case 'POST /api/auth/reset': {
      const b = await readBody(request);
      const t = String(b.token || '');
      const pw = String(b.password || '');
      if (pw.length < 8) return fail('The password needs at least 8 characters.');
      const key = 'r:' + await sha256(t);
      const r = t ? await getJSON(env, key) : null;
      if (!r) return fail('This link has expired or was already used.', 400);
      await env.BAO.delete(key);
      const user = await getJSON(env, 'u:' + r.email);
      if (!user) return fail('This link has expired or was already used.', 400);
      Object.assign(user, await newPassword(pw));
      user.verified = true;                       // the link proved the email works
      await endAllSessions(env, user);
      await putJSON(env, 'u:' + user.email, user);
      return json({ ok: true });
    }

    case 'GET /api/auth/verify': {
      const t = url.searchParams.get('token') || '';
      const key = 'v:' + await sha256(t);
      const v = t ? await getJSON(env, key) : null;
      let ok = false;
      if (v){
        const user = await getJSON(env, 'u:' + v.email);
        if (user){ user.verified = true; await putJSON(env, 'u:' + user.email, user); ok = true; }
        await env.BAO.delete(key);
      }
      return Response.redirect(appUrl(env, request) + '/?verified=' + (ok ? '1' : '0'), 302);
    }

    case 'POST /api/auth/verify/resend': {
      const u = await currentUser(env, request);
      if (!u) return fail('Not signed in.', 401);
      if (u.verified) return json({ ok: true, verified: true });
      if (!await limit(env, 'verify:' + u.email, 3, 3600)) return fail('Please wait a little before asking again.', 429);
      const sent = await sendConfirmation(env, request, u, cleanLang((await readBody(request)).lang || u.lang));
      return sent ? json({ ok: true }) : fail('The email could not be sent right now.', 502);
    }

    case 'GET /api/checkins': {
      const u = await currentUser(env, request);
      if (!u) return fail('Not signed in.', 401);
      return json(await getJSON(env, 'c:' + u.email, []));
    }

    case 'POST /api/checkin': {
      const u = await currentUser(env, request);
      if (!u) return fail('Not signed in.', 401);
      const raw = await request.text();
      if (raw.length > MAX_ENTRY_BYTES) return fail('This check-in is too long.', 413);
      let entry;
      try{ entry = JSON.parse(raw); }catch(e){ return fail('Not a check-in.'); }
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return fail('Not a check-in.');
      delete entry.user;
      if (typeof entry.id !== 'string' || !entry.id) entry.id = 'c' + Date.now().toString(36) + token().slice(0, 6);
      if (typeof entry.date !== 'string' || isNaN(Date.parse(entry.date))) entry.date = new Date().toISOString();
      const list = await getJSON(env, 'c:' + u.email, []);
      if (!list.some(e => e.id === entry.id)) list.push(entry);
      if (list.length > MAX_CHECKINS) return fail('Too many check-ins.', 413);
      await putJSON(env, 'c:' + u.email, list);
      return json({ ok: true, total: list.length, checkins: list });
    }

    case 'POST /api/checkin/delete': {
      const u = await currentUser(env, request);
      if (!u) return fail('Not signed in.', 401);
      const id = String((await readBody(request)).id || '');
      const list = (await getJSON(env, 'c:' + u.email, [])).filter(e => e.id !== id);
      await putJSON(env, 'c:' + u.email, list);
      return json({ ok: true, checkins: list });
    }

    case 'POST /api/checkins/clear': {
      const u = await currentUser(env, request);
      if (!u) return fail('Not signed in.', 401);
      await env.BAO.delete('c:' + u.email);
      return json({ ok: true, checkins: [] });
    }

    case 'GET /api/pet': {
      const u = await currentUser(env, request);
      if (!u) return fail('Not signed in.', 401);
      return json({ pet: await getJSON(env, 'p:' + u.email) });
    }

    case 'POST /api/pet': {
      const u = await currentUser(env, request);
      if (!u) return fail('Not signed in.', 401);
      const pet = (await readBody(request)).pet;
      if (pet && typeof pet === 'object' && JSON.stringify(pet).length < 4000) await putJSON(env, 'p:' + u.email, pet);
      else await env.BAO.delete('p:' + u.email);
      return json({ ok: true });
    }

    default:
      return fail('Not found.', 404);
    }
  }catch(err){
    console.error('BAO server error', route, err && err.stack || err);
    return fail('BAO server error: ' + (err && err.message || String(err)), 500);
  }
}
