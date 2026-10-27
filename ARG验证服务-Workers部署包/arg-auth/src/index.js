import { random, hashPassword, sign, verify, equal, accountLookup, encryptAccount, decryptAccount } from './crypto.js';

const now = () => Math.floor(Date.now() / 1000);
const json = (value, status = 200, headers = {}) => new Response(JSON.stringify(value), {status, headers: {'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',...headers}});
const cookie = (request, name) => (request.headers.get('cookie') || '').split(';').map(v => v.trim()).find(v => v.startsWith(name + '='))?.slice(name.length + 1) || '';
const sessionCookie = (token, age) => `arg_admin=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`;
const validId = id => /^[a-z0-9][a-z0-9-]{0,39}$/.test(id);
const validUser = u => typeof u === 'string' && u.trim() === u && u.length > 0 && u.length <= 80;
const validPass = p => typeof p === 'string' && p.length > 0 && p.length <= 256;
const validPrefix = p => typeof p === 'string' && /^\/(?:[A-Za-z0-9_-]+\/)*$/.test(p);
function safeDestination(value, prefix) {
  if (typeof value !== 'string' || !value.startsWith(prefix) || value.includes('\\') || value.includes('%')) return false;
  const u = new URL(value, 'https://example.invalid');
  return u.origin === 'https://example.invalid' && u.pathname === value && u.pathname.startsWith(prefix);
}
function configured(env) { return env.ADMIN_USERNAME_HASH && env.ADMIN_PASSWORD_HASH && env.ADMIN_PASSWORD_SALT && env.ACCOUNT_KEY && env.ACCOUNT_KEY.length >= 32 && env.ADMIN_SESSION_KEY && env.ADMIN_SESSION_KEY.length >= 32; }
async function rate(request, env, key) {
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  return (await env.LOGIN_LIMIT.limit({key: `${key}:${ip}`})).success;
}
async function readJson(request) {
  const text = await request.text();
  if (text.length > 8192) throw new Error('请求过大');
  return JSON.parse(text);
}
async function handler(request, env) {
  const url = new URL(request.url), path = url.pathname;
  if (!configured(env)) return json({error:'管理员 Secret 尚未配置'}, 503);
  if (path.startsWith('/api/')) {
    if (request.method === 'POST' && path !== '/api/player/login' && request.headers.get('origin') !== url.origin) return json({error:'来源不允许'}, 403);
    if (path === '/api/admin/login' && request.method === 'POST') {
      if (!await rate(request, env, 'admin')) return json({error:'尝试次数过多，请稍后再试'}, 429);
      const data = await readJson(request);
      if (!validUser(data.username) || !validPass(data.password) || !await equal(await hashPassword(data.username,env.ADMIN_PASSWORD_SALT), env.ADMIN_USERNAME_HASH) || !await equal(await hashPassword(data.password,env.ADMIN_PASSWORD_SALT), env.ADMIN_PASSWORD_HASH)) return json({error:'账号或密码错误'}, 401);
      const token = await sign({type:'admin', exp:now()+3600}, env.ADMIN_SESSION_KEY);
      return json({ok:true}, 200, {'set-cookie':sessionCookie(token, 3600)});
    }
    if (path === '/api/player/login' && request.method === 'POST') {
      const data = await readJson(request);
      if (!validId(data.site || '') || !validUser(data.username) || !validPass(data.password)) return json({error:'请输入有效的账号和密码'}, 400);
      if (!await rate(request, env, 'player:' + data.site)) return json({error:'尝试次数过多，请稍后再试'}, 429);
      const site = await env.DB.prepare('SELECT * FROM sites WHERE id = ?').bind(data.site).first();
      if (!site) return json({error:'登录入口不存在'}, 404);
      const source = request.headers.get('origin');
      if (source !== url.origin && (source !== site.origin || url.searchParams.get('site') !== site.id)) return json({error:'来源不允许'}, 403);
      const usernameKey = await accountLookup(site.id + '\u0000' + data.username,env.ACCOUNT_KEY);
      const account = await env.DB.prepare('SELECT salt, password_hash FROM accounts WHERE site_id = ? AND username_key = ?').bind(site.id, usernameKey).first();
      const valid = account && await equal(await hashPassword(data.password, account.salt), account.password_hash);
      await env.DB.prepare('INSERT INTO events (site_id, username_enc, success, created_at) VALUES (?, ?, ?, ?)').bind(site.id, await encryptAccount(data.username,env.ACCOUNT_KEY), valid ? 1 : 0, now()).run();
      if (!valid) return json({error:'账号或密码错误'}, 401);
      const token = await sign({type:'ticket',site:site.id,dest:site.destination,exp:now()+60}, await decryptAccount(site.signing_key,env.ACCOUNT_KEY));
      return json({redirect:site.origin + '/_arg/callback?ticket=' + encodeURIComponent(token)});
    }
    if (!await verify(cookie(request, 'arg_admin'), env.ADMIN_SESSION_KEY, 'admin')) return json({error:'请先以管理员身份登录'}, 401);
    if (path === '/api/admin/logout' && request.method === 'POST') return json({ok:true}, 200, {'set-cookie':sessionCookie('',0)});
    if (path === '/api/admin/sites' && request.method === 'GET') {
      const sites = await env.DB.prepare('SELECT id, name, origin, prefix, destination, signing_key FROM sites ORDER BY created_at DESC').all();
      return json({sites:await Promise.all(sites.results.map(async site => ({...site,signing_key:await decryptAccount(site.signing_key,env.ACCOUNT_KEY)})))});
    }
    if (path === '/api/admin/events' && request.method === 'GET') {
      const events = await env.DB.prepare('SELECT e.site_id, e.username_enc, e.success, e.created_at, s.origin, s.destination FROM events e JOIN sites s ON s.id = e.site_id ORDER BY e.id DESC LIMIT 100').all();
      return json({events:await Promise.all(events.results.map(async ({username_enc, ...event}) => ({...event, username:await decryptAccount(username_enc,env.ACCOUNT_KEY)})))});
    }
    if (path === '/api/admin/sites' && request.method === 'POST') {
      const d = await readJson(request);
      let origin; try { const u = new URL(d.origin); if (u.protocol !== 'https:' || u.origin !== d.origin || u.username || u.password) throw 0; origin=u.origin; } catch { return json({error:'目标站点必须填写 HTTPS 域名，不含路径或结尾斜杠'}, 400); }
      if (!validId(d.id || '') || !validUser(d.name) || !validPrefix(d.prefix) || !safeDestination(d.destination, d.prefix)) return json({error:'请检查站点 ID、名称、保护目录和跳转路径'}, 400);
      try { await env.DB.prepare('INSERT INTO sites (id,name,origin,prefix,destination,signing_key,created_at) VALUES (?,?,?,?,?,?,?)').bind(d.id,d.name,origin,d.prefix,d.destination,await encryptAccount(random(),env.ACCOUNT_KEY),now()).run(); }
      catch { return json({error:'站点创建失败：ID 可能已存在'}, 409); }
      return json({ok:true});
    }
    if (path === '/api/admin/accounts' && request.method === 'POST') {
      const d = await readJson(request);
      if (!validId(d.site || '') || !validUser(d.username) || !validPass(d.password)) return json({error:'请检查站点、账号和密码'}, 400);
      if (!await env.DB.prepare('SELECT id FROM sites WHERE id = ?').bind(d.site).first()) return json({error:'站点不存在'}, 404);
      const salt = random(16), hash = await hashPassword(d.password, salt);
      const usernameKey=await accountLookup(d.site + '\u0000' + d.username,env.ACCOUNT_KEY);
      await env.DB.prepare('INSERT INTO accounts (site_id,username_key,salt,password_hash) VALUES (?,?,?,?) ON CONFLICT(site_id,username_key) DO UPDATE SET salt=excluded.salt,password_hash=excluded.password_hash').bind(d.site,usernameKey,salt,hash).run();
      return json({ok:true});
    }
    return json({error:'接口不存在'}, 404);
  }
  return env.ASSETS.fetch(request);
}
export default { async fetch(request, env) {
  try {
    const url = new URL(request.url), source = request.headers.get('origin');
    let allow = false;
    if (url.pathname === '/api/player/login' && source && source !== url.origin) {
      const id = url.searchParams.get('site') || '';
      const site = validId(id) && await env.DB.prepare('SELECT origin FROM sites WHERE id = ?').bind(id).first();
      if (!site || site.origin !== source) return json({error:'来源不允许'},403);
      allow = true;
      if (request.method === 'OPTIONS') return new Response(null,{status:204,headers:{'access-control-allow-origin':source,'access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'content-type','vary':'Origin'}});
    }
    const response = await handler(request,env);
    if (!allow) return response;
    const headers = new Headers(response.headers); headers.set('access-control-allow-origin',source); headers.set('vary','Origin');
    return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
  } catch (e) { console.error('request failed', e.message); return json({error:'服务暂时不可用'}, 500); }
} };
