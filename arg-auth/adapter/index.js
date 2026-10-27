import { sign, verify } from '../src/crypto.js';

const now = () => Math.floor(Date.now()/1000);
function isProtected(path, prefix) { return prefix === '/' || path === prefix.slice(0,-1) || path.startsWith(prefix); }
function getCookie(request) { return (request.headers.get('cookie') || '').split(';').map(x => x.trim()).find(x => x.startsWith('arg_site='))?.slice(9) || ''; }
function redirect(url, cookie) {
  const headers = {'location':url,'cache-control':'no-store','referrer-policy':'no-referrer'};
  if (cookie) headers['set-cookie'] = cookie;
  return new Response(null,{status:302,headers});
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url), prefix = env.PROTECTED_PREFIX;
    if (!env.SITE_ID || !env.SITE_KEY || env.SITE_KEY.length < 32 || !env.AUTH_ORIGIN || !env.SITE_ORIGIN || !prefix || !/^\/(?:[A-Za-z0-9_-]+\/)*$/.test(prefix)) return new Response('Site authentication is not configured.', {status:503});
    if (url.origin !== env.SITE_ORIGIN) return new Response('Unknown site origin.', {status:403});
    if (url.pathname === '/_arg/callback') {
      const ticket = await verify(url.searchParams.get('ticket') || '', env.SITE_KEY, 'ticket', env.SITE_ID);
      if (!ticket || typeof ticket.dest !== 'string' || !isProtected(ticket.dest,prefix) || ticket.dest.includes('%') || ticket.dest.includes('\\')) return new Response('Invalid or expired login ticket.',{status:403,headers:{'cache-control':'no-store'}});
      const dest = new URL(ticket.dest, env.SITE_ORIGIN);
      if (dest.origin !== env.SITE_ORIGIN || dest.pathname !== ticket.dest) return new Response('Invalid destination.',{status:403});
      const session = await sign({type:'site',site:env.SITE_ID,exp:now()+28800},env.SITE_KEY);
      return redirect(dest.href, `arg_site=${session}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=28800`);
    }
    let path;
    try {
      if (/%(?:2f|5c|25)/i.test(url.pathname)) throw 0;
      path = decodeURIComponent(url.pathname);
      if (path.includes('\\') || path.split('/').some(s => s === '.' || s === '..')) throw 0;
    } catch { return new Response('Invalid path.',{status:400}); }
    if (isProtected(path,prefix) && !await verify(getCookie(request),env.SITE_KEY,'site',env.SITE_ID)) {
      return redirect(env.AUTH_ORIGIN + '/login.html?site=' + encodeURIComponent(env.SITE_ID));
    }
    const response = await env.ASSETS.fetch(request);
    if (!isProtected(path,prefix)) return response;
    const headers = new Headers(response.headers);
    headers.set('cache-control','private, no-store');
    headers.set('x-robots-tag','noindex, nofollow');
    return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
  }
};
