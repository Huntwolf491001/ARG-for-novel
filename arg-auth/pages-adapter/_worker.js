// Cloudflare Pages advanced mode. Configure all values as Pages bindings.
const encoder = new TextEncoder();
const b64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = text => Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - text.length % 4) % 4)), c => c.charCodeAt(0));
const now = () => Math.floor(Date.now() / 1000);
async function sign(payload, secret) {
  const data = b64(encoder.encode(JSON.stringify(payload)));
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), {name:'HMAC',hash:'SHA-256'},false,['sign']);
  return data + '.' + b64(await crypto.subtle.sign('HMAC', key, encoder.encode(data)));
}
async function verify(token, secret, type, site) {
  try {
    const parts=token.split('.'); if(parts.length!==2)return null;
    const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
    if(!await crypto.subtle.verify('HMAC',key,unb64(parts[1]),encoder.encode(parts[0])))return null;
    const data=JSON.parse(new TextDecoder().decode(unb64(parts[0])));
    if(data.type!==type || data.site!==site || !Number.isFinite(data.exp) || data.exp<=now())return null;
    return data;
  } catch {return null;}
}
function validOrigin(value) {
  try {const u=new URL(value);return u.origin===value && (u.protocol==='https:' || (u.protocol==='http:' && ['localhost','127.0.0.1'].includes(u.hostname)));} catch {return false;}
}
function protectedPath(path,prefix){return prefix==='/' || path===prefix.slice(0,-1) || path.startsWith(prefix);}
function cookie(request){return (request.headers.get('cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('arg_site='))?.slice(9)||'';}
function redirect(location, setCookie) {
  const headers={'location':location,'cache-control':'no-store','referrer-policy':'no-referrer'};
  if(setCookie)headers['set-cookie']=setCookie;
  return new Response(null,{status:302,headers});
}
export default {
  async fetch(request,env){
    const url=new URL(request.url), prefix=env.PROTECTED_PREFIX;
    if(!/^[a-z0-9][a-z0-9-]{0,39}$/.test(env.SITE_ID||'') || !env.SITE_KEY || env.SITE_KEY.length<32 || !validOrigin(env.AUTH_ORIGIN) || !validOrigin(env.SITE_ORIGIN) || !/^\/(?:[A-Za-z0-9_-]+\/)*$/.test(prefix||'')) return new Response('Site authentication is not configured.',{status:503,headers:{'cache-control':'no-store'}});
    if(url.origin!==env.SITE_ORIGIN)return new Response('Unknown site origin.',{status:403,headers:{'cache-control':'no-store'}});
    if(url.pathname==='/_arg/callback'){
      const ticket=await verify(url.searchParams.get('ticket')||'',env.SITE_KEY,'ticket',env.SITE_ID);
      if(!ticket || typeof ticket.dest!=='string' || !protectedPath(ticket.dest,prefix) || ticket.dest.includes('%') || ticket.dest.includes('\\'))return new Response('Invalid or expired login ticket.',{status:403,headers:{'cache-control':'no-store'}});
      const dest=new URL(ticket.dest,env.SITE_ORIGIN);
      if(dest.origin!==env.SITE_ORIGIN || dest.pathname!==ticket.dest)return new Response('Invalid destination.',{status:403});
      const session=await sign({type:'site',site:env.SITE_ID,exp:now()+28800},env.SITE_KEY);
      return redirect(dest.href,`arg_site=${session}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=28800`);
    }
    let path;
    try {
      if(/%(?:2f|5c|25)/i.test(url.pathname))throw 0;
      path=decodeURIComponent(url.pathname);
      if(path.includes('\\') || path.split('/').some(s=>s==='.'||s==='..'))throw 0;
    } catch {return new Response('Invalid path.',{status:400});}
    const restricted=protectedPath(path,prefix);
    if(restricted && !await verify(cookie(request),env.SITE_KEY,'site',env.SITE_ID)){
      if(env.LOGIN_PATH){
        const login=new URL(env.LOGIN_PATH,env.SITE_ORIGIN);
        if(login.origin!==env.SITE_ORIGIN || !env.LOGIN_PATH.startsWith('/') || env.LOGIN_PATH.startsWith('//') || protectedPath(login.pathname,prefix))return new Response('Invalid login path.',{status:503});
        return redirect(login.href);
      }
      return redirect(env.AUTH_ORIGIN+'/login.html?site='+encodeURIComponent(env.SITE_ID));
    }
    const response=await env.ASSETS.fetch(request);
    if(!restricted)return response;
    const headers=new Headers(response.headers);headers.set('cache-control','private, no-store');headers.set('x-robots-tag','noindex, nofollow');
    return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
  }
};
