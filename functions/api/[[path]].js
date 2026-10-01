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
const publicUser = (u, extra) => ({ user: u.email, name: u.name || '', verified: !!u.verified,
  role: u.role === 'pro' ? 'pro' : 'patient', kind: u.kind || '', ...(extra || {}) });
const failWhy = (msg, status, reason) => json({ error: msg, reason }, status);
const cleanText = (v, max) => String(v == null ? '' : v).replace(/\r/g, '').trim().slice(0, max);
// the patient stops sharing: link, code and assigned questions go away; the therapist's private notes are removed too
async function unlinkPatient(env, pu){
  const pro = pu.therapist;
  if (!pro) return;
  const st = await getJSON(env, 'tp:' + pro, { plan: '', codes: [] });
  const keep = [];
  for (const c of st.codes){
    const k = await getJSON(env, 'k:' + c);
    if (k && k.email === pu.email && k.used){ await env.BAO.delete('k:' + c); continue; }
    keep.push(c);
  }
  st.codes = keep;
  await putJSON(env, 'tp:' + pro, st);
  await env.BAO.delete('aq:' + pu.email);
  await env.BAO.delete('tn:' + pro + '|' + pu.email);
  const dn = (await getJSON(env, 'dn:' + pu.email, [])).filter(n => n.author !== 'pro' || n.public);
  await putJSON(env, 'dn:' + pu.email, dn);
  delete pu.therapist;
  await putJSON(env, 'u:' + pu.email, pu);
}
// the therapist removes the patient: the patient's whole BAO account is deleted
async function deletePatientAccount(env, pu){
  await endAllSessions(env, pu);
  await Promise.all(['u:', 'c:', 'p:', 'aq:', 'sn:', 'dn:'].map(k => env.BAO.delete(k + pu.email)));
}
// day notes: dn:<patient> = [{ id, day, text, public, author:'pro'|'patient', owner, byName, date }]
function notesFor(list, u){
  if (u.role === 'pro') return list.filter(n => n.public || (n.author === 'pro' && n.owner === u.email));
  return list.filter(n => n.author === 'patient' || n.public);
}
async function migrateTN(env, pro, patientEmail){
  const key = 'tn:' + pro.email + '|' + patientEmail;
  const old = await getJSON(env, key);
  if (!old || !old.days) return;
  const list = await getJSON(env, 'dn:' + patientEmail, []);
  for (const [day, v] of Object.entries(old.days)){
    if (v && v.text) list.push({ id: 'd' + Date.now().toString(36) + token().slice(0, 5), day, text: v.text, public: false, author: 'pro', owner: pro.email, by: pro.email, byName: pro.name || '', date: v.updated || new Date().toISOString() });
  }
  await putJSON(env, 'dn:' + patientEmail, list);
  await env.BAO.delete(key);
}
// which diary do these notes belong to? the patient's own, or (for a therapist) a linked patient
async function notesTarget(env, u, email){
  if (u.role === 'pro'){ const pu = await proPatient(env, u, email); if (pu) await migrateTN(env, u, pu.email); return pu; }
  return u;
}
async function proPatient(env, u, email){
  if (!u || u.role !== 'pro') return null;
  const pu = await getJSON(env, 'u:' + cleanEmail(email));
  return pu && pu.therapist === u.email ? pu : null;
}

// ---- therapists / doctors ("pro") ----
//   tp:<email>   { plan, codes:[CODE...] }        the pro's plan and the codes they created
//   k:<CODE>     { pro, email, created, used, usedAt }  one patient code, bound to one patient email
const PLANS = {
  starter:  { patients: 3,  price: 0 },
  practice: { patients: 15, price: 19 },
  clinic:   { patients: 60, price: 49 }
};
const CODE_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function newCode(){
  const b = crypto.getRandomValues(new Uint8Array(8));
  const c = [...b].map(x => CODE_ABC[x % CODE_ABC.length]).join('');
  return 'BAO-' + c.slice(0, 4) + '-' + c.slice(4);
}
const cleanCode = v => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^BAO/, '').replace(/^(.{4})(.{4})$/, 'BAO-$1-$2');
async function proState(env, pro){
  const st = await getJSON(env, 'tp:' + pro.email, { plan: '', codes: [] });
  const codes = [];
  let pruned = false;
  for (const c of st.codes){
    const k = await getJSON(env, 'k:' + c);
    if (!k) continue;
    let patient = null;
    if (k.used){
      const pu = await getJSON(env, 'u:' + k.email);
      if (!pu || pu.therapist !== pro.email){ await env.BAO.delete('k:' + c); pruned = true; continue; }   // patient gone: free the place
      patient = { email: pu.email, name: pu.name || '' };
    }
    codes.push({ code: c, email: k.email, created: k.created, used: !!k.used, usedAt: k.usedAt || null, patient });
  }
  if (pruned){ st.codes = codes.map(x => x.code); await putJSON(env, 'tp:' + pro.email, st); }
  return { st, codes };
}

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
      return json({ version: 'bao-server 2026-10-01 daynotes' });

    case 'GET /api/auth/me': {
      const u = await currentUser(env, request);
      if (!u) return fail('Not signed in.', 401);
      let shared = '', questions = [];
      if (u.therapist){
        const p = await getJSON(env, 'u:' + u.therapist); shared = p ? (p.name || '') : '';
        const aq = await getJSON(env, 'aq:' + u.email);
        if (aq && aq.pro === u.therapist) questions = aq.questions || [];
      }
      return json(publicUser(u, { shared, questions }));
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
      const role = b.role === 'pro' ? 'pro' : 'patient';
      let codeRec = null, code = '';
      if (role === 'patient'){
        code = cleanCode(b.code);
        codeRec = code ? await getJSON(env, 'k:' + code) : null;
        if (!codeRec) return failWhy('This patient code does not exist.', 400, 'code_bad');
        if (codeRec.used) return failWhy('This patient code was already used.', 400, 'code_used');
        if (codeRec.email !== email) return failWhy('This patient code belongs to a different email address.', 400, 'code_email');
        if (b.share !== true) return failWhy('Please agree to share your check-ins with your therapist or doctor.', 400, 'share_consent');
      }
      const user = { email, name, lang, verified: false, created: new Date().toISOString(), ...(await newPassword(pw)), sessions: [] };
      if (role === 'pro'){ user.role = 'pro'; user.kind = b.kind === 'doctor' ? 'doctor' : 'therapist'; }
      else { user.therapist = codeRec.pro; codeRec.used = true; codeRec.usedAt = user.created; await putJSON(env, 'k:' + code, codeRec); }
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
      if (u.role === 'pro'){
        const st = await getJSON(env, 'tp:' + u.email, { codes: [] });
        for (const c of st.codes){
          const k = await getJSON(env, 'k:' + c);
          if (k && k.used){ const pu = await getJSON(env, 'u:' + k.email); if (pu && pu.therapist === u.email){ delete pu.therapist; await putJSON(env, 'u:' + pu.email, pu); } }
          await env.BAO.delete('k:' + c);
        }
        await env.BAO.delete('tp:' + u.email);
      }
      if (u.therapist) await unlinkPatient(env, u);
      await Promise.all(['u:', 'c:', 'p:', 'aq:', 'sn:', 'dn:'].map(k => env.BAO.delete(k + u.email)));
      return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie('', 0) });
    }

    case 'POST /api/auth/forgot': {
      const b = await readBody(request);
      const email = cleanEmail(b.email);
      const lang = cleanLang(b.lang);
      // Same answer whether or not the account exists.
      // Too many requests for the same address: say so (it does not reveal whether the account exists).
      if (email && !await limit(env, 'forgot:' + email, 5, 3600)) return fail('Too many emails requested. Please wait an hour.', 429);
      if (email){
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

    case 'POST /api/code/check': {
      const b = await readBody(request);
      if (!await limit(env, 'code:' + (request.headers.get('CF-Connecting-IP') || 'x'), 30, 3600)) return fail('Please wait a little before trying again.', 429);
      const code = cleanCode(b.code), email = cleanEmail(b.email);
      const k = code ? await getJSON(env, 'k:' + code) : null;
      if (!k) return failWhy('This patient code does not exist.', 404, 'code_bad');
      if (k.used) return failWhy('This patient code was already used.', 400, 'code_used');
      if (email && k.email !== email) return failWhy('This patient code belongs to a different email address.', 400, 'code_email');
      const pro = await getJSON(env, 'u:' + k.pro);
      return json({ ok: true, pro: pro ? { name: pro.name || '', kind: pro.kind || 'therapist' } : null });
    }

    case 'GET /api/pro': {
      const u = await currentUser(env, request);
      if (!u) return fail('Not signed in.', 401);
      if (u.role !== 'pro') return fail('Only for therapists and doctors.', 403);
      const { st, codes } = await proState(env, u);
      return json({ plan: st.plan || '', plans: PLANS, codes });
    }

    case 'POST /api/pro/code': {
      const u = await currentUser(env, request);
      if (!u) return fail('Not signed in.', 401);
      if (u.role !== 'pro') return fail('Only for therapists and doctors.', 403);
      const b = await readBody(request);
      const email = cleanEmail(b.email);
      if (!email) return failWhy('Please write the patient’s email address.', 400, 'email_bad');
      if (email === u.email) return failWhy('Please write the patient’s email address.', 400, 'email_bad');
      const st = await getJSON(env, 'tp:' + u.email, { plan: '', codes: [] });
      if (b.plan && PLANS[b.plan]) st.plan = b.plan;
      if (!PLANS[st.plan]) return failWhy('Choose a plan first.', 400, 'plan_none');
      if (await env.BAO.get('u:' + email)) return failWhy('This email already has a BAO account.', 409, 'email_taken');
      const live = [];
      for (const c of st.codes){ const k = await getJSON(env, 'k:' + c); if (k){ live.push(c); if (!k.used && k.email === email) return json({ ok: true, code: c, plan: st.plan, again: true }); } }
      st.codes = live;
      if (live.length >= PLANS[st.plan].patients) return failWhy('This plan is full.', 400, 'plan_full');
      let code = newCode();
      while (await env.BAO.get('k:' + code)) code = newCode();
      await putJSON(env, 'k:' + code, { pro: u.email, email, created: new Date().toISOString(), used: false });
      st.codes.push(code);
      await putJSON(env, 'tp:' + u.email, st);
      return json({ ok: true, code, plan: st.plan });
    }

    case 'POST /api/pro/plan': {
      const u = await currentUser(env, request);
      if (!u) return fail('Not signed in.', 401);
      if (u.role !== 'pro') return fail('Only for therapists and doctors.', 403);
      const plan = String((await readBody(request)).plan || '');
      if (!PLANS[plan]) return fail('Unknown plan.');
      const st = await getJSON(env, 'tp:' + u.email, { plan: '', codes: [] });
      let n = 0; for (const c of st.codes) if (await env.BAO.get('k:' + c)) n++;
      if (n > PLANS[plan].patients) return failWhy('You have more patients than this plan allows.', 400, 'plan_small');
      st.plan = plan;
      await putJSON(env, 'tp:' + u.email, st);
      return json({ ok: true, plan });
    }

    case 'POST /api/pro/code/delete': {
      const u = await currentUser(env, request);
      if (!u) return fail('Not signed in.', 401);
      if (u.role !== 'pro') return fail('Only for therapists and doctors.', 403);
      const code = cleanCode((await readBody(request)).code);
      const k = await getJSON(env, 'k:' + code);
      if (!k || k.pro !== u.email) return fail('Not found.', 404);
      if (k.used){
        const pu = await getJSON(env, 'u:' + k.email);
        if (pu && pu.therapist === u.email){ delete pu.therapist; await putJSON(env, 'u:' + pu.email, pu); }
      }
      await env.BAO.delete('k:' + code);
      const st = await getJSON(env, 'tp:' + u.email, { plan: '', codes: [] });
      st.codes = st.codes.filter(c => c !== code);
      await putJSON(env, 'tp:' + u.email, st);
      return json({ ok: true });
    }

    case 'POST /api/pro/unlink': {
      const u = await currentUser(env, request);
      if (!u) return fail('Not signed in.', 401);
      if (u.role !== 'pro') return fail('Only for therapists and doctors.', 403);
      const email = cleanEmail((await readBody(request)).email);
      const st = await getJSON(env, 'tp:' + u.email, { plan: '', codes: [] });
      let found = false;
      for (const c of st.codes.slice()){
        const k = await getJSON(env, 'k:' + c);
        if (!k || k.email !== email || !k.used) continue;
        const pu = await getJSON(env, 'u:' + email);
        if (pu && pu.therapist === u.email) await deletePatientAccount(env, pu);
        await env.BAO.delete('k:' + c);
        await env.BAO.delete('tn:' + u.email + '|' + email);
        st.codes = st.codes.filter(x => x !== c);
        found = true;
      }
      if (!found) return fail('Not found.', 404);
      await putJSON(env, 'tp:' + u.email, st);
      return json({ ok: true });
    }

    // ---- patient: sharing, notes for the next session ----
    case 'POST /api/me/unlink': {
      const u = await currentUser(env, request);
      if (!u) return fail('Not signed in.', 401);
      if (u.therapist) await unlinkPatient(env, u);
      return json({ ok: true });
    }
    case 'GET /api/me/notes': {
      const u = await currentUser(env, request);
      if (!u) return fail('Not signed in.', 401);
      return json({ notes: await getJSON(env, 'sn:' + u.email, []) });
    }
    case 'POST /api/me/note': {
      const u = await currentUser(env, request);
      if (!u) return fail('Not signed in.', 401);
      const text = cleanText((await readBody(request)).text, 1500);
      if (!text) return fail('Write something first.');
      const list = await getJSON(env, 'sn:' + u.email, []);
      if (list.length >= 200) return fail('Too many notes.', 413);
      list.push({ id: 'n' + Date.now().toString(36) + token().slice(0, 4), text, date: new Date().toISOString(), done: false });
      await putJSON(env, 'sn:' + u.email, list);
      return json({ ok: true, notes: list });
    }
    case 'POST /api/me/note/delete': {
      const u = await currentUser(env, request);
      if (!u) return fail('Not signed in.', 401);
      const id = String((await readBody(request)).id || '');
      const list = (await getJSON(env, 'sn:' + u.email, [])).filter(n => n.id !== id);
      await putJSON(env, 'sn:' + u.email, list);
      return json({ ok: true, notes: list });
    }

    // ---- therapist: one patient's notes, private notes, assigned questions ----
    case 'GET /api/pro/patient': {
      const u = await currentUser(env, request);
      if (!u) return fail('Not signed in.', 401);
      const pu = await proPatient(env, u, url.searchParams.get('email'));
      if (!pu) return fail('Not found.', 404);
      const aq = await getJSON(env, 'aq:' + pu.email);
      return json({
        notes: await getJSON(env, 'sn:' + pu.email, []),
        questions: aq && aq.pro === u.email ? aq.questions || [] : [],
        private: (await getJSON(env, 'tn:' + u.email + '|' + pu.email, { days: {} })).days || {}
      });
    }
    case 'POST /api/pro/private': {
      const u = await currentUser(env, request);
      if (!u) return fail('Not signed in.', 401);
      const b = await readBody(request);
      const pu = await proPatient(env, u, b.email);
      if (!pu) return fail('Not found.', 404);
      const day = String(b.day || '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return fail('Bad day.');
      const key = 'tn:' + u.email + '|' + pu.email;
      const st = await getJSON(env, key, { days: {} });
      const text = cleanText(b.text, 4000);
      if (text) st.days[day] = { text, updated: new Date().toISOString() }; else delete st.days[day];
      await putJSON(env, key, st);
      return json({ ok: true, private: st.days });
    }
    case 'POST /api/pro/questions': {
      const u = await currentUser(env, request);
      if (!u) return fail('Not signed in.', 401);
      const b = await readBody(request);
      const pu = await proPatient(env, u, b.email);
      if (!pu) return fail('Not found.', 404);
      const qs = (Array.isArray(b.questions) ? b.questions : []).map(q => cleanText(q, 300)).filter(Boolean).slice(0, 10);
      if (qs.length) await putJSON(env, 'aq:' + pu.email, { pro: u.email, questions: qs, updated: new Date().toISOString() });
      else await env.BAO.delete('aq:' + pu.email);
      return json({ ok: true, questions: qs });
    }
    case 'POST /api/pro/note/done': {
      const u = await currentUser(env, request);
      if (!u) return fail('Not signed in.', 401);
      const b = await readBody(request);
      const pu = await proPatient(env, u, b.email);
      if (!pu) return fail('Not found.', 404);
      const list = await getJSON(env, 'sn:' + pu.email, []);
      list.forEach(n => { if (n.id === b.id) n.done = b.done !== false; });
      await putJSON(env, 'sn:' + pu.email, list);
      return json({ ok: true, notes: list });
    }

    // ---- day notes (patient and therapist, private or shared) ----
    case 'GET /api/notes': {
      const u = await currentUser(env, request);
      if (!u) return fail('Not signed in.', 401);
      const pt = await notesTarget(env, u, url.searchParams.get('email'));
      if (!pt) return fail('Not found.', 404);
      return json({ notes: notesFor(await getJSON(env, 'dn:' + pt.email, []), u) });
    }
    case 'POST /api/notes/add': {
      const u = await currentUser(env, request);
      if (!u) return fail('Not signed in.', 401);
      const b = await readBody(request);
      const pt = await notesTarget(env, u, b.email);
      if (!pt) return fail('Not found.', 404);
      const day = String(b.day || '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return fail('Bad day.');
      const text = cleanText(b.text, 4000);
      if (!text) return fail('Write something first.');
      const list = await getJSON(env, 'dn:' + pt.email, []);
      if (list.length >= 2000) return fail('Too many notes.', 413);
      const canShare = u.role === 'pro' || !!u.therapist;
      list.push({ id: 'd' + Date.now().toString(36) + token().slice(0, 5), day, text, public: canShare && b.public === true,
        author: u.role === 'pro' ? 'pro' : 'patient', owner: u.email, by: u.email, byName: u.name || '', date: new Date().toISOString() });
      await putJSON(env, 'dn:' + pt.email, list);
      return json({ ok: true, notes: notesFor(list, u) });
    }
    case 'POST /api/notes/update':
    case 'POST /api/notes/delete': {
      const u = await currentUser(env, request);
      if (!u) return fail('Not signed in.', 401);
      const b = await readBody(request);
      const pt = await notesTarget(env, u, b.email);
      if (!pt) return fail('Not found.', 404);
      let list = await getJSON(env, 'dn:' + pt.email, []);
      const n = list.find(x => x.id === b.id);
      if (!n || n.owner !== u.email) return fail('Not found.', 404);
      if (route === 'POST /api/notes/delete') list = list.filter(x => x !== n);
      else { if (typeof b.public === 'boolean') n.public = (u.role === 'pro' || !!u.therapist) && b.public; if (b.text != null){ const tx = cleanText(b.text, 4000); if (tx) n.text = tx; } }
      await putJSON(env, 'dn:' + pt.email, list);
      return json({ ok: true, notes: notesFor(list, u) });
    }

    // ---- hand all patients over to another therapist ----
    case 'POST /api/pro/transfer/create': {
      const u = await currentUser(env, request);
      if (!u) return fail('Not signed in.', 401);
      if (u.role !== 'pro') return fail('Only for therapists and doctors.', 403);
      const b = await readBody(request);
      const t = token();
      await putJSON(env, 'tr:' + await sha256(t), { from: u.email, notes: b.notes === true, created: new Date().toISOString() }, { expirationTtl: 7 * 86400 });
      return json({ ok: true, link: appUrl(env, request) + '/?transfer=' + encodeURIComponent(t), days: 7 });
    }
    case 'GET /api/pro/transfer/info': {
      const u = await currentUser(env, request);
      if (!u) return fail('Not signed in.', 401);
      const tr = await getJSON(env, 'tr:' + await sha256(url.searchParams.get('token') || ''));
      if (!tr) return failWhy('This transfer link has expired or was already used.', 404, 'tr_bad');
      if (u.role !== 'pro') return failWhy('Only therapists and doctors can accept a transfer.', 403, 'tr_role');
      if (tr.from === u.email) return failWhy('This is your own transfer link. Send it to the other therapist or doctor.', 400, 'tr_self');
      const from = await getJSON(env, 'u:' + tr.from);
      const { codes } = await proState(env, { email: tr.from });
      return json({ from: { name: from ? from.name || '' : '' }, patients: codes.filter(c => c.patient).length, waiting: codes.filter(c => !c.used).length, notes: tr.notes });
    }
    case 'POST /api/pro/transfer/accept': {
      const u = await currentUser(env, request);
      if (!u) return fail('Not signed in.', 401);
      if (u.role !== 'pro') return failWhy('Only therapists and doctors can accept a transfer.', 403, 'tr_role');
      const key = 'tr:' + await sha256(String((await readBody(request)).token || ''));
      const tr = await getJSON(env, key);
      if (!tr) return failWhy('This transfer link has expired or was already used.', 404, 'tr_bad');
      if (tr.from === u.email) return failWhy('This is your own transfer link. Send it to the other therapist or doctor.', 400, 'tr_self');
      const oldSt = await getJSON(env, 'tp:' + tr.from, { plan: '', codes: [] });
      const newSt = await getJSON(env, 'tp:' + u.email, { plan: '', codes: [] });
      const live = [];
      for (const c of oldSt.codes){ const k = await getJSON(env, 'k:' + c); if (k) live.push([c, k]); }
      let mine = 0; for (const c of newSt.codes) if (await env.BAO.get('k:' + c)) mine++;
      if (!PLANS[newSt.plan]) newSt.plan = PLANS[oldSt.plan] ? oldSt.plan : 'clinic';
      if (mine + live.length > PLANS[newSt.plan].patients){
        const fit = Object.keys(PLANS).find(p => PLANS[p].patients >= mine + live.length);
        if (!fit) return failWhy('Your plan does not have room for these patients.', 400, 'plan_full');
        newSt.plan = fit;
      }
      const fromUser = { email: tr.from };
      let moved = 0;
      for (const [c, k] of live){
        if (k.used){
          const pu = await getJSON(env, 'u:' + k.email);
          if (!pu || pu.therapist !== tr.from){ await env.BAO.delete('k:' + c); continue; }
          await migrateTN(env, fromUser, pu.email);
          pu.therapist = u.email; await putJSON(env, 'u:' + pu.email, pu);
          const aq = await getJSON(env, 'aq:' + pu.email);
          if (aq && aq.pro === tr.from){ aq.pro = u.email; await putJSON(env, 'aq:' + pu.email, aq); }
          let dn = await getJSON(env, 'dn:' + pu.email, []);
          dn = dn.filter(n => !(n.author === 'pro' && n.owner === tr.from && !n.public && !tr.notes));
          dn.forEach(n => { if (n.author === 'pro' && n.owner === tr.from) n.owner = u.email; });
          await putJSON(env, 'dn:' + pu.email, dn);
          moved++;
        }
        k.pro = u.email; await putJSON(env, 'k:' + c, k);
        newSt.codes.push(c);
      }
      oldSt.codes = [];
      await putJSON(env, 'tp:' + tr.from, oldSt);
      await putJSON(env, 'tp:' + u.email, newSt);
      await env.BAO.delete(key);
      return json({ ok: true, moved, plan: newSt.plan });
    }

    case 'GET /api/pro/checkins': {
      const u = await currentUser(env, request);
      if (!u) return fail('Not signed in.', 401);
      if (u.role !== 'pro') return fail('Only for therapists and doctors.', 403);
      const { codes } = await proState(env, u);
      const patients = [], checkins = [];
      for (const c of codes){
        if (!c.patient || c.patient.gone) continue;
        patients.push(c.patient);
        for (const e of await getJSON(env, 'c:' + c.patient.email, [])){ const x = { ...e, patient: c.patient }; delete x.personal; checkins.push(x); }
      }
      return json({ patients, checkins });
    }

    default:
      return fail('Not found.', 404);
    }
  }catch(err){
    console.error('BAO server error', route, err && err.stack || err);
    return fail('BAO server error: ' + (err && err.message || String(err)), 500);
  }
}
