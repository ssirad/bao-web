// Il server di Bao per Cloudflare Pages (prima era server.py con Flask).
// Risponde a tutti gli indirizzi /api/... ; la pagina index.html resta identica.
//
// Dove finiscono i dati: nello spazio "KV" di Cloudflare collegato con il nome BAO
// (vedi wrangler.toml e le istruzioni). Chiavi usate:
//   user:<email>      account (nome, sale, hash della password)
//   sess:<token>      sessione aperta -> email (scade da sola dopo 30 giorni)
//   pet:<email>       il compagno
//   checkins:<email>  la lista dei check-in
//   fail:<email>      tentativi di accesso sbagliati (scade dopo 15 minuti)

import { PATTERNS, ZONES, PATTERNS_DE, ZONES_DE } from '../_lib/patterns.js';

const SESSION_COOKIE = 'bao_session';
const SESSION_DAYS   = 30;
const PBKDF2_ITER    = 100000;          // il massimo che Cloudflare Workers permette
const MAX_FAILS      = 10;              // poi l'accesso a quell'email si blocca per 15 minuti
const EMAIL_RE       = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// ---------------------------------------------------------------- utilita'
const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers }
  });
const fail = (message, status) => json({ error: message }, status);

const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const randomHex = n => hex(crypto.getRandomValues(new Uint8Array(n)));

function cleanEmail(raw){
  const v = String(raw || '').trim().toLowerCase().slice(0, 120);
  return EMAIL_RE.test(v) ? v : '';
}

async function hashPassword(password, salt, iterations = PBKDF2_ITER){
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations }, key, 256);
  return hex(bits);
}

function sameString(a, b){          // confronto a tempo costante
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

async function readBody(request){
  try { return await request.json(); } catch { return {}; }
}
async function kvGet(env, key, fallback){
  const v = await env.BAO.get(key, 'json');
  return v === null ? fallback : v;
}
const kvPut = (env, key, value, opts) => env.BAO.put(key, JSON.stringify(value), opts);

// ---------------------------------------------------------------- sessioni
function readCookie(request, name){
  const raw = request.headers.get('Cookie') || '';
  for (const part of raw.split(';')){
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return '';
}
function cookieHeader(value, maxAge, secure){
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}` + (secure ? '; Secure' : '');
}
async function currentUser(request, env){
  const token = readCookie(request, SESSION_COOKIE);
  if (!/^[0-9a-f]{64}$/.test(token)) return null;
  return await env.BAO.get('sess:' + token);
}
async function openSession(env, email, secure){
  const token = randomHex(32);
  await env.BAO.put('sess:' + token, email, { expirationTtl: SESSION_DAYS * 86400 });
  return cookieHeader(token, SESSION_DAYS * 86400, secure);
}

// ---------------------------------------------------------------- Bao risponde
function toRegex(src){
  let s = String(src);
  if (s.startsWith('(?i)')) s = s.slice(4);
  try { return new RegExp(s, 'i'); } catch { return null; }
}
const compiled = new Map();
function table(list){
  if (!compiled.has(list)) compiled.set(list, list.map(([re, v]) => [toRegex(re), v]).filter(([re]) => re));
  return compiled.get(list);
}
function respond(text, lang){
  const low = String(text || '').toLowerCase();
  let response = null, zone = null;
  for (const [re, answers] of table(lang === 'de' ? PATTERNS_DE : PATTERNS)){
    if (re.test(low)){ response = answers[Math.floor(Math.random() * answers.length)]; break; }
  }
  for (const [re, z] of table(lang === 'de' ? ZONES_DE : ZONES)){
    if (re.test(low)){ zone = z; break; }
  }
  return { response, zone };
}

// ---------------------------------------------------------------- le rotte
const routes = {
  'GET auth/me': async ({ env, me }) => {
    if (!me) return json({ user: null, name: '' });
    const rec = await kvGet(env, 'user:' + me, {});
    return json({ user: me, name: rec.name || '' });
  },

  'POST auth/register': async ({ env, body, secure }) => {
    const email = cleanEmail(body.username);
    const pw = String(body.password || '');
    if (!email) return fail('Please write a valid email address.', 400);
    if (pw.length < 6) return fail('The password needs at least 6 characters.', 400);
    if (await env.BAO.get('user:' + email)) return fail('That email is already registered. Sign in instead.', 409);

    const name = String(body.name || '').trim().slice(0, 24) || email.split('@')[0];
    const salt = randomHex(16);
    await kvPut(env, 'user:' + email, {
      salt, iter: PBKDF2_ITER, hash: await hashPassword(pw, salt), name,
      created: new Date().toISOString()
    });
    return json({ user: email, name }, 200, { 'Set-Cookie': await openSession(env, email, secure) });
  },

  'POST auth/login': async ({ env, body, secure }) => {
    const email = cleanEmail(body.username);
    const pw = String(body.password || '');
    const fails = Number(await env.BAO.get('fail:' + email) || 0);
    if (fails >= MAX_FAILS) return fail('Too many attempts. Please wait 15 minutes and try again.', 429);

    const rec = email ? await kvGet(env, 'user:' + email, null) : null;
    if (!rec){
      await hashPassword(pw, 'x'.repeat(32));          // stessa attesa, cosi' non si capisce se l'email esiste
      return fail('There is no account with that email.', 404);
    }
    if (!sameString(await hashPassword(pw, rec.salt, rec.iter || PBKDF2_ITER), rec.hash)){
      await env.BAO.put('fail:' + email, String(fails + 1), { expirationTtl: 900 });
      return fail('That password does not match.', 401);
    }
    if (fails) await env.BAO.delete('fail:' + email);
    return json({ user: email, name: rec.name || '' }, 200, { 'Set-Cookie': await openSession(env, email, secure) });
  },

  'POST auth/logout': async ({ request, env, secure }) => {
    const token = readCookie(request, SESSION_COOKIE);
    if (/^[0-9a-f]{64}$/.test(token)) await env.BAO.delete('sess:' + token);
    return json({ ok: true }, 200, { 'Set-Cookie': cookieHeader('', 0, secure) });
  },

  'POST auth/name': async ({ env, me, body }) => {
    if (!me) return fail('Please sign in first.', 401);
    const name = String(body.name || '').trim().slice(0, 24);
    if (!name) return fail('Please write a name.', 400);
    const rec = await kvGet(env, 'user:' + me, {});
    rec.name = name;
    await kvPut(env, 'user:' + me, rec);
    return json({ ok: true, name });
  },

  'GET pet': async ({ env, me }) => {
    if (!me) return fail('Please sign in first.', 401);
    return json({ pet: await kvGet(env, 'pet:' + me, null) });
  },

  'POST pet': async ({ env, me, body }) => {
    if (!me) return fail('Please sign in first.', 401);
    const pet = body.pet || null;
    if (pet) await kvPut(env, 'pet:' + me, pet);
    else await env.BAO.delete('pet:' + me);
    return json({ ok: true, pet });
  },

  'GET patterns': async () => json({
    patterns:    PATTERNS,
    zones:       ZONES,
    patterns_de: PATTERNS_DE,
    zones_de:    ZONES_DE,
    source: 'patterns.js',
    bao_imported: true,
    bao_error: null
  }),

  'POST bao': async ({ body }) => {
    const lang = String(body.lang || 'en').startsWith('de') ? 'de' : 'en';
    return json(respond(body.text, lang));
  },

  'GET checkins': async ({ env, me }) => {
    if (!me) return fail('Please sign in first.', 401);
    return json(await kvGet(env, 'checkins:' + me, []));
  },

  'POST checkin': async ({ env, me, body }) => {
    if (!me) return fail('Please sign in first.', 401);
    const entry = body && typeof body === 'object' ? body : {};
    entry.date = new Date().toISOString();
    if (!entry.id) entry.id = 'c' + Date.now().toString(36) + randomHex(3);
    entry.user = me;
    const items = await kvGet(env, 'checkins:' + me, []);
    items.push(entry);
    await kvPut(env, 'checkins:' + me, items);
    return json({ ok: true, total: items.length, checkins: items });
  },

  'POST checkin/delete': async ({ env, me, body }) => {
    if (!me) return fail('Please sign in first.', 401);
    const items = (await kvGet(env, 'checkins:' + me, [])).filter(e => e.id !== body.id);
    await kvPut(env, 'checkins:' + me, items);
    return json({ ok: true, checkins: items });
  },

  'POST checkins/clear': async ({ env, me }) => {
    if (!me) return fail('Please sign in first.', 401);
    await kvPut(env, 'checkins:' + me, []);
    return json({ ok: true, checkins: [] });
  }
};

export async function onRequest(context){
  const { request, env } = context;
  if (!env.BAO) return fail('The KV namespace "BAO" is not connected to this project.', 500);

  const url  = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/?/, '').replace(/\/+$/, '');
  const handler = routes[request.method + ' ' + path];
  if (!handler) return fail('Not found.', 404);

  // Le richieste che cambiano qualcosa devono arrivare dal sito stesso.
  if (request.method === 'POST'){
    const origin = request.headers.get('Origin');
    if (origin && origin !== url.origin) return fail('Forbidden.', 403);
  }

  try {
    return await handler({
      request, env,
      body:   request.method === 'POST' ? await readBody(request) : {},
      me:     await currentUser(request, env),
      secure: url.protocol === 'https:'
    });
  } catch (err) {
    return fail('Something went wrong on the server.', 500);
  }
}
