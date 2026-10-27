import { random, hashPassword, sign, verify, equal, accountLookup, encryptAccount, decryptAccount } from './crypto.js';

const now = () => Math.floor(Date.now() / 1000);
const json = (value, status = 200, headers = {}) => new Response(JSON.stringify(value), {status, headers: {'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',...headers}});
const cookie = (request, name) => (request.headers.get('cookie') || '').split(';').map(v => v.trim()).find(v => v.startsWith(name + '='))?.slice(name.length + 1) || '';
const sessionCookie = (token, age) => `arg_admin=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`;
const validId = id => /^[a-z0-9][a-z0-9-]{0,39}$/.test(id);
const validUser = u => typeof u === 'string' && u.trim() === u && u.length > 0 && u.length <= 80;
const validPass = p => typeof p === 'string' && p.length > 0 && p.length <= 256;
const validProof = p => typeof p === 'string' && p.length > 0 && p.length <= 4096;
const validPrefix = p => typeof p === 'string' && /^\/(?:[A-Za-z0-9_-]+\/)*$/.test(p);
function safeDestination(value, prefix) {
  if (typeof value !== 'string' || !value.startsWith(prefix) || value.includes('\\') || value.includes('%')) return false;
  const u = new URL(value, 'https://example.invalid');
  return u.origin === 'https://example.invalid' && u.pathname === value && u.pathname.startsWith(prefix);
}
function validOrigin(value) {
  try {const u=new URL(value);return u.protocol==='https:' && u.origin===value && !u.username && !u.password;} catch{return false;}
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
async function issueTicket(site) {
  const token = await sign({type:'ticket',site:site.id,dest:site.destination,exp:now()+60}, site.key);
  return {redirect:site.origin + '/_arg/callback?ticket=' + encodeURIComponent(token)};
}
async function logAttempt(request, env, siteId, usernameEnc, success) {
  const value=request.headers.get('cf-connecting-ip')||'';
  const ip=/^[0-9a-fA-F:.]{2,45}$/.test(value)?value:null;
  const ipEnc=ip?await encryptAccount(ip,env.ACCOUNT_KEY):null;
  await env.DB.batch([
    env.DB.prepare('INSERT INTO events (site_id, username_enc, success, created_at, ip_enc) VALUES (?, ?, ?, ?, ?)').bind(siteId,usernameEnc,success?1:0,now(),ipEnc),
    env.DB.prepare('DELETE FROM events WHERE id NOT IN (SELECT id FROM events ORDER BY id DESC LIMIT 256)')
  ]);
}
async function playerSite(request, env, data, url) {
  if (!validId(data.site || '')) return null;
  const site=await env.DB.prepare('SELECT * FROM sites WHERE id = ?').bind(data.site).first();
  if (!site) return null;
  const source=request.headers.get('origin');
  if (source!==url.origin && (source!==site.origin || url.searchParams.get('site')!==site.id)) return null;
  return site;
}
async function handler(request, env) {
  const url = new URL(request.url), path = url.pathname;
  if (!configured(env)) return json({error:'管理员 Secret 尚未配置'}, 503);
  if (path.startsWith('/api/')) {
    if (request.method === 'POST' && !path.startsWith('/api/player/') && request.headers.get('origin') !== url.origin) return json({error:'来源不允许'}, 403);
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
      const usernameEnc=await encryptAccount(data.username,env.ACCOUNT_KEY);
      if (!valid) {await logAttempt(request,env,site.id,usernameEnc,false);return json({error:'账号或密码错误'}, 401);}
      const puzzle=await env.DB.prepare('SELECT username_key FROM puzzle_credentials WHERE site_id = ? AND username_key = ?').bind(site.id,usernameKey).first();
      if(puzzle) return json({stage:'appeal',proof:await sign({type:'appeal',site:site.id,account:usernameKey,username_enc:usernameEnc,exp:now()+600},env.ADMIN_SESSION_KEY)});
      await logAttempt(request,env,site.id,usernameEnc,true);
      return json(await issueTicket({...site,key:await decryptAccount(site.signing_key,env.ACCOUNT_KEY)}));
    }
    if (path === '/api/player/recover/start' && request.method === 'POST') {
      const d=await readJson(request);
      if(!validUser(d.username)||!await rate(request,env,'player:'+String(d.site)))return json({error:'验证信息有误或请求过于频繁'},400);
      const site=await playerSite(request,env,d,url);if(!site)return json({error:'入口不存在或来源不允许'},403);
      const key=await accountLookup(site.id+'\u0000'+d.username,env.ACCOUNT_KEY);
      const puzzle=await env.DB.prepare('SELECT username_key FROM puzzle_credentials WHERE site_id = ? AND username_key = ?').bind(site.id,key).first();
      if(!puzzle){await logAttempt(request,env,site.id,await encryptAccount(d.username,env.ACCOUNT_KEY),false);return json({error:'未查询到该账号'},401);}
      return json({proof:await sign({type:'recovery',site:site.id,account:key,username_enc:await encryptAccount(d.username,env.ACCOUNT_KEY),exp:now()+600},env.ADMIN_SESSION_KEY)});
    }
    if (path === '/api/player/recover/answer' && request.method === 'POST') {
      const d=await readJson(request);if(!validProof(d.proof)||!validPass(d.answer)||!await rate(request,env,'player:'+String(d.site)))return json({error:'验证信息有误或请求过于频繁'},400);
      const site=await playerSite(request,env,d,url);if(!site)return json({error:'入口不存在或来源不允许'},403);
      const proof=await verify(d.proof,env.ADMIN_SESSION_KEY,'recovery',site.id);
      if(!proof||typeof proof.account!=='string'||typeof proof.username_enc!=='string')return json({error:'验证已过期，请重新开始'},401);
      const puzzle=await env.DB.prepare('SELECT answer_salt, answer_hash FROM puzzle_credentials WHERE site_id = ? AND username_key = ?').bind(site.id,proof.account).first();
      if(!puzzle||!await equal(await hashPassword(d.answer.replace(/\s/g,''),puzzle.answer_salt),puzzle.answer_hash)){await logAttempt(request,env,site.id,proof.username_enc,false);return json({error:'验证信息有误，请重新输入'},401);}
      return json({stage:'appeal',proof:await sign({type:'appeal',site:site.id,account:proof.account,username_enc:proof.username_enc,exp:now()+600},env.ADMIN_SESSION_KEY)});
    }
    if (path === '/api/player/appeal' && request.method === 'POST') {
      const d=await readJson(request);if(!validProof(d.proof)||!validPass(d.password)||!await rate(request,env,'player:'+String(d.site)))return json({error:'验证信息有误或请求过于频繁'},400);
      const site=await playerSite(request,env,d,url);if(!site)return json({error:'入口不存在或来源不允许'},403);
      const proof=await verify(d.proof,env.ADMIN_SESSION_KEY,'appeal',site.id);
      if(!proof||typeof proof.account!=='string'||typeof proof.username_enc!=='string')return json({error:'验证已过期，请重新开始'},401);
      const puzzle=await env.DB.prepare('SELECT secondary_salt, secondary_hash FROM puzzle_credentials WHERE site_id = ? AND username_key = ?').bind(site.id,proof.account).first();
      if(!puzzle||!await equal(await hashPassword(d.password,puzzle.secondary_salt),puzzle.secondary_hash)){await logAttempt(request,env,site.id,proof.username_enc,false);return json({error:'二级密码错误，请重新输入'},401);}
      await logAttempt(request,env,site.id,proof.username_enc,true);
      return json(await issueTicket({...site,key:await decryptAccount(site.signing_key,env.ACCOUNT_KEY)}));
    }
    if (!await verify(cookie(request, 'arg_admin'), env.ADMIN_SESSION_KEY, 'admin')) return json({error:'请先以管理员身份登录'}, 401);
    if (path === '/api/admin/logout' && request.method === 'POST') return json({ok:true}, 200, {'set-cookie':sessionCookie('',0)});
    if (path === '/api/admin/sites' && request.method === 'GET') {
      const sites = await env.DB.prepare('SELECT id, name, origin, prefix, destination, signing_key FROM sites ORDER BY created_at DESC').all();
      return json({sites:await Promise.all(sites.results.map(async site => ({...site,signing_key:await decryptAccount(site.signing_key,env.ACCOUNT_KEY)})))});
    }
    if (path === '/api/admin/events' && request.method === 'GET') {
      const count=await env.DB.prepare('SELECT COUNT(*) AS total FROM events e JOIN sites s ON s.id = e.site_id').first();
      const total=Number(count.total), pages=Math.max(1,Math.ceil(total/20));
      const requested=Number(url.searchParams.get('page')||1);
      const page=Number.isInteger(requested)?Math.min(pages,Math.max(1,requested)):1;
      const events=await env.DB.prepare('SELECT e.site_id, e.username_enc, e.ip_enc, e.success, e.created_at, s.origin, s.destination FROM events e JOIN sites s ON s.id = e.site_id ORDER BY e.id DESC LIMIT 20 OFFSET ?').bind((page-1)*20).all();
      return json({page,pages,total,events:await Promise.all(events.results.map(async ({username_enc,ip_enc,...event}) => ({...event,username:await decryptAccount(username_enc,env.ACCOUNT_KEY),ip:ip_enc?await decryptAccount(ip_enc,env.ACCOUNT_KEY):null})))});
    }
    if (path === '/api/admin/accounts' && request.method === 'GET') {
      const site=url.searchParams.get('site')||'';
      if(!validId(site))return json({error:'站点 ID 无效'},400);
      if(!await env.DB.prepare('SELECT id FROM sites WHERE id = ?').bind(site).first())return json({error:'站点不存在'},404);
      const rows=(await env.DB.prepare('SELECT a.username_key, a.username_enc, CASE WHEN p.username_key IS NULL THEN 0 ELSE 1 END AS has_secondary FROM accounts a LEFT JOIN puzzle_credentials p ON p.site_id = a.site_id AND p.username_key = a.username_key WHERE a.site_id = ? ORDER BY a.rowid').bind(site).all()).results;
      const names=new Map();
      for(const row of rows) if(row.username_enc) names.set(row.username_key,await decryptAccount(row.username_enc,env.ACCOUNT_KEY));
      if(names.size<rows.length){
        const events=(await env.DB.prepare('SELECT username_enc FROM events WHERE site_id = ? ORDER BY id DESC LIMIT 256').bind(site).all()).results;
        const missing=new Set(rows.filter(row=>!names.has(row.username_key)).map(row=>row.username_key));
        const updates=[];
        for(const event of events){
          if(!missing.size)break;
          try {const name=await decryptAccount(event.username_enc,env.ACCOUNT_KEY);const key=await accountLookup(site+'\u0000'+name,env.ACCOUNT_KEY);if(missing.has(key)){names.set(key,name);missing.delete(key);updates.push(env.DB.prepare('UPDATE accounts SET username_enc = ? WHERE site_id = ? AND username_key = ? AND username_enc IS NULL').bind(event.username_enc,site,key))}}catch{}
        }
        if(updates.length)await env.DB.batch(updates);
      }
      return json({accounts:rows.map(row=>({username:names.get(row.username_key)||null,has_secondary:!!row.has_secondary}))});
    }
    if (path === '/api/admin/sites/delete' && request.method === 'POST') {
      const d=await readJson(request);
      if(!validId(d.id||''))return json({error:'站点 ID 无效'},400);
      if(!await env.DB.prepare('SELECT id FROM sites WHERE id = ?').bind(d.id).first())return json({error:'站点不存在'},404);
      await env.DB.batch([
        env.DB.prepare('DELETE FROM puzzle_credentials WHERE site_id = ?').bind(d.id),
        env.DB.prepare('DELETE FROM accounts WHERE site_id = ?').bind(d.id),
        env.DB.prepare('DELETE FROM events WHERE site_id = ?').bind(d.id),
        env.DB.prepare('DELETE FROM sites WHERE id = ?').bind(d.id)
      ]);
      return json({ok:true});
    }
    if (path === '/api/admin/sites/update' && request.method === 'POST') {
      const d=await readJson(request);
      if(!validId(d.original_id||'')||!validId(d.id||'')||!validUser(d.name)||!validOrigin(d.origin)||!validPrefix(d.prefix)||!safeDestination(d.destination,d.prefix)) return json({error:'请检查站点 ID、名称、网站地址、保护目录和跳转路径'},400);
      const previous=await env.DB.prepare('SELECT * FROM sites WHERE id = ?').bind(d.original_id).first();
      if(!previous)return json({error:'原站点不存在，请刷新后重试'},404);
      if(d.original_id===d.id){
        await env.DB.prepare('UPDATE sites SET name = ?, origin = ?, prefix = ?, destination = ? WHERE id = ?').bind(d.name,d.origin,d.prefix,d.destination,d.id).run();
        return json({ok:true,id:d.id});
      }
      if(await env.DB.prepare('SELECT id FROM sites WHERE id = ?').bind(d.id).first())return json({error:'新的站点 ID 已被使用'},409);
      const accounts=(await env.DB.prepare('SELECT username_key, username_enc FROM accounts WHERE site_id = ?').bind(d.original_id).all()).results;
      if(accounts.length>85)return json({error:'账号数量过多，暂不能直接修改站点 ID'},409);
      const names=new Map();
      for(const account of accounts)if(account.username_enc)names.set(account.username_key,await decryptAccount(account.username_enc,env.ACCOUNT_KEY));
      const missing=new Set(accounts.filter(account=>!names.has(account.username_key)).map(account=>account.username_key));
      if(missing.size){
        const events=(await env.DB.prepare('SELECT username_enc FROM events WHERE site_id = ? ORDER BY id DESC LIMIT 256').bind(d.original_id).all()).results;
        for(const event of events){if(!missing.size)break;try{const name=await decryptAccount(event.username_enc,env.ACCOUNT_KEY);const key=await accountLookup(d.original_id+'\u0000'+name,env.ACCOUNT_KEY);if(missing.has(key)){names.set(key,name);missing.delete(key)}}catch{}}
      }
      if(missing.size)return json({error:'部分旧账号的名称不可用，无法安全迁移站点 ID；请先重新保存这些账号'},409);
      const guard=accounts.length ? ' AND (SELECT COUNT(*) FROM accounts WHERE site_id = ? AND username_key IN ('+accounts.map(()=>'?').join(',')+')) = ?' : '';
      const initial=env.DB.prepare('INSERT INTO sites (id,name,origin,prefix,destination,signing_key,created_at) VALUES (?,CASE WHEN (SELECT COUNT(*) FROM accounts WHERE site_id = ?) = ?'+guard+' THEN ? ELSE NULL END,?,?,?,?,?)');
      const checkArgs=accounts.length?[d.original_id,...accounts.map(account=>account.username_key),accounts.length]:[];
      const statements=[initial.bind(d.id,d.original_id,accounts.length,...checkArgs,d.name,d.origin,d.prefix,d.destination,previous.signing_key,previous.created_at)];
      for(const account of accounts){
        const name=names.get(account.username_key),newKey=await accountLookup(d.id+'\u0000'+name,env.ACCOUNT_KEY);
        const nameEnc=account.username_enc || await encryptAccount(name,env.ACCOUNT_KEY);
        statements.push(env.DB.prepare('INSERT INTO accounts (site_id,username_key,salt,password_hash,username_enc) SELECT ?, ?, salt, password_hash, ? FROM accounts WHERE site_id = ? AND username_key = ?').bind(d.id,newKey,nameEnc,d.original_id,account.username_key));
        statements.push(env.DB.prepare('INSERT INTO puzzle_credentials (site_id,username_key,secondary_salt,secondary_hash,answer_salt,answer_hash) SELECT ?, ?, secondary_salt, secondary_hash, answer_salt, answer_hash FROM puzzle_credentials WHERE site_id = ? AND username_key = ?').bind(d.id,newKey,d.original_id,account.username_key));
      }
      statements.push(env.DB.prepare('UPDATE events SET site_id = ? WHERE site_id = ?').bind(d.id,d.original_id));
      statements.push(env.DB.prepare('DELETE FROM puzzle_credentials WHERE site_id = ?').bind(d.original_id));
      statements.push(env.DB.prepare('DELETE FROM accounts WHERE site_id = ?').bind(d.original_id));
      statements.push(env.DB.prepare('DELETE FROM sites WHERE id = ?').bind(d.original_id));
      try {await env.DB.batch(statements);} catch {return json({error:'站点或账号在修改期间发生变化，请刷新后重试'},409);}
      return json({ok:true,id:d.id});
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
      await env.DB.prepare('INSERT INTO accounts (site_id,username_key,salt,password_hash,username_enc) VALUES (?,?,?,?,?) ON CONFLICT(site_id,username_key) DO UPDATE SET salt=excluded.salt,password_hash=excluded.password_hash,username_enc=excluded.username_enc').bind(d.site,usernameKey,salt,hash,await encryptAccount(d.username,env.ACCOUNT_KEY)).run();
      return json({ok:true});
    }
    if (path === '/api/admin/puzzle' && request.method === 'POST') {
      const d=await readJson(request);
      if(!validId(d.site||'')||!validUser(d.username)||!validPass(d.secondary)||!validPass(d.answer))return json({error:'请检查站点、账号、二级密码和验证答案'},400);
      const key=await accountLookup(d.site+'\u0000'+d.username,env.ACCOUNT_KEY);
      if(!await env.DB.prepare('SELECT username_key FROM accounts WHERE site_id = ? AND username_key = ?').bind(d.site,key).first())return json({error:'请先添加玩家账号'},404);
      const secondarySalt=random(16),answerSalt=random(16);
      await env.DB.prepare('INSERT INTO puzzle_credentials (site_id,username_key,secondary_salt,secondary_hash,answer_salt,answer_hash) VALUES (?,?,?,?,?,?) ON CONFLICT(site_id,username_key) DO UPDATE SET secondary_salt=excluded.secondary_salt,secondary_hash=excluded.secondary_hash,answer_salt=excluded.answer_salt,answer_hash=excluded.answer_hash').bind(d.site,key,secondarySalt,await hashPassword(d.secondary,secondarySalt),answerSalt,await hashPassword(d.answer.replace(/\s/g,''),answerSalt)).run();
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
    if (url.pathname.startsWith('/api/player/') && source && source !== url.origin) {
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
