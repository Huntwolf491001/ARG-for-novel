const enc = new TextEncoder();
const b64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = text => Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - text.length % 4) % 4)), c => c.charCodeAt(0));
export const random = (n = 32) => b64(crypto.getRandomValues(new Uint8Array(n)));
export async function hashPassword(password, salt) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return b64(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: unb64(salt), iterations: 100000, hash: 'SHA-256' }, key, 256));
}
export async function sign(payload, secret) {
  const data = b64(enc.encode(JSON.stringify(payload)));
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), {name:'HMAC', hash:'SHA-256'}, false, ['sign']);
  return data + '.' + b64(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
}
export async function verify(token, secret, type, site) {
  try {
    const parts = token.split('.'); if (parts.length !== 2) return null;
    const key = await crypto.subtle.importKey('raw', enc.encode(secret), {name:'HMAC', hash:'SHA-256'}, false, ['verify']);
    if (!await crypto.subtle.verify('HMAC', key, unb64(parts[1]), enc.encode(parts[0]))) return null;
    const data = JSON.parse(new TextDecoder().decode(unb64(parts[0])));
    if (data.type !== type || data.exp <= Math.floor(Date.now()/1000) || (site && data.site !== site)) return null;
    return data;
  } catch { return null; }
}
export async function equal(a, b) {
  const key = await crypto.subtle.importKey('raw', enc.encode('comparison'), {name:'HMAC', hash:'SHA-256'}, false, ['sign','verify']);
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(a));
  return crypto.subtle.verify('HMAC', key, mac, enc.encode(b));
}
export async function accountLookup(username, secret) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), {name:'HMAC', hash:'SHA-256'}, false, ['sign']);
  return b64(await crypto.subtle.sign('HMAC', key, enc.encode(username)));
}
async function encryptionKey(secret) {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode('arg-account-encryption:' + secret));
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt','decrypt']);
}
export async function encryptAccount(username, secret) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({name:'AES-GCM',iv}, await encryptionKey(secret), enc.encode(username));
  return b64(iv) + '.' + b64(data);
}
export async function decryptAccount(ciphertext, secret) {
  const [iv, data] = ciphertext.split('.');
  return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(iv)}, await encryptionKey(secret), unb64(data)));
}
