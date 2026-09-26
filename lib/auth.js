// Funzioni condivise da login, registrazione, reset e cancellazione.
// SE HAI GIA' UN lib/auth.js NON SOSTITUIRLO: controlla solo che esporti queste quattro
// funzioni con lo stesso comportamento (in particolare le 100.000 iterazioni di PBKDF2,
// che devono essere le stesse usate dal tuo login, altrimenti le password nuove non funzionano).
const enc = new TextEncoder();
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');

export async function sha256hex(s) {
  return hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
}

export function randomToken() {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...raw)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function hashPassword(password, salt) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' }, key, 256);
  return hex(bits);
}

export async function newPasswordRecord(password) {
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
  return { salt, hash: await hashPassword(password, salt) };
}
