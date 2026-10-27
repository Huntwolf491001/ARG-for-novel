import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import auth from '../src/index.js';
import gate from '../adapter/index.js';
import { random, hashPassword } from '../src/crypto.js';

function database() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../migrations/0001_initial.sql', import.meta.url),'utf8'));
  return {raw:db,prepare(sql) { const statement=db.prepare(sql); return {async all(){return {results:statement.all()}},bind(...args) {return {async first(){return statement.get(...args)||null},async all(){return {results:statement.all(...args)}},async run(){return statement.run(...args)}}}}}};
}
const origin = 'https://auth.example';
function request(path, {method='GET',body,session,source=origin} = {}) {
  const headers = {};
  if (method === 'POST' || method === 'OPTIONS') headers.origin=source;
  if (body) headers['content-type']='application/json';
  if (session) headers.cookie=session;
  return new Request(origin+path,{method,headers,body:body ? JSON.stringify(body):undefined});
}
test('administrator setup, cross-origin player login and protected content', async () => {
  const adminPassword='a strong administrator password', adminSalt=random(16);
  const env={DB:database(), ADMIN_PASSWORD_SALT:adminSalt, ADMIN_USERNAME_HASH:await hashPassword('admin',adminSalt), ADMIN_PASSWORD_HASH:await hashPassword(adminPassword,adminSalt), ACCOUNT_KEY:'a-separate-very-long-account-secret-123456', ADMIN_SESSION_KEY:'a-very-long-random-session-secret-123456', LOGIN_LIMIT:{async limit(){return {success:true}}}, ASSETS:{async fetch(){return new Response('public')}}};
  let response = await auth.fetch(request('/api/admin/sites'),env);
  assert.equal(response.status,401);
  response = await auth.fetch(request('/api/admin/login',{method:'POST',body:{username:'admin',password:'incorrect'},source:origin}),env);
  assert.equal(response.status,401);
  response = await auth.fetch(request('/api/admin/login',{method:'POST',body:{username:'admin',password:adminPassword},source:'https://evil.example'}),env);
  assert.equal(response.status,403);
  response = await auth.fetch(request('/api/admin/login',{method:'POST',body:{username:'admin',password:adminPassword}}),env);
  assert.equal(response.status,200); const session=response.headers.get('set-cookie').split(';')[0];
  const site={id:'police',name:'市局',origin:'https://site.example',prefix:'/archive/',destination:'/archive/index.html'};
  response=await auth.fetch(request('/api/admin/sites',{method:'POST',body:site,session}),env); assert.equal(response.status,200);
  response=await auth.fetch(request('/api/admin/accounts',{method:'POST',body:{site:'police',username:'00417',password:'example-password'},session}),env);assert.equal(response.status,200);
  response=await auth.fetch(request('/api/admin/sites',{session}),env); const registered=(await response.json()).sites[0];
  const gateEnv={SITE_ID:site.id,SITE_KEY:registered.signing_key,SITE_ORIGIN:site.origin,AUTH_ORIGIN:origin,PROTECTED_PREFIX:site.prefix,ASSETS:{async fetch(){return new Response('private content')}}};
  response=await gate.fetch(new Request(site.origin+'/archive/index.html'),gateEnv); assert.equal(response.status,302); assert.match(response.headers.get('location'),/login\.html/);
  response=await gate.fetch(new Request(site.origin+'/%61rchive/index.html'),gateEnv); assert.equal(response.status,302);
  response=await gate.fetch(new Request(site.origin+'/%2561rchive/index.html'),gateEnv); assert.equal(response.status,400);
  response=await auth.fetch(request('/api/player/login?site=police',{method:'OPTIONS',source:site.origin}),env);assert.equal(response.status,204);assert.equal(response.headers.get('access-control-allow-origin'),site.origin);
  response=await auth.fetch(request('/api/player/login?site=police',{method:'POST',source:'https://evil.example',body:{site:'police',username:'00417',password:'example-password'}}),env);assert.equal(response.status,403);
  response=await auth.fetch(request('/api/player/login?site=police',{method:'POST',source:site.origin,body:{site:'police',username:'00417',password:'wrong'}}),env);assert.equal(response.status,401);
  response=await auth.fetch(request('/api/player/login?site=police',{method:'POST',source:site.origin,body:{site:'police',username:'00417',password:'example-password'}}),env);assert.equal(response.status,200);assert.equal(response.headers.get('access-control-allow-origin'),site.origin);
  const callback=(await response.json()).redirect;
  response=await gate.fetch(new Request(callback),gateEnv);assert.equal(response.status,302);assert.equal(response.headers.get('location'),site.origin+site.destination);
  const siteCookie=response.headers.get('set-cookie').split(';')[0];
  response=await gate.fetch(new Request(site.origin+site.destination,{headers:{cookie:siteCookie}}),gateEnv);assert.equal(await response.text(),'private content');assert.match(response.headers.get('cache-control'),/no-store/);
  response=await auth.fetch(request('/api/admin/events',{session}),env);assert.deepEqual((await response.json()).events.map(x=>x.success),[1,0]);
  const storedAccount=env.DB.raw.prepare('SELECT * FROM accounts').get();
  const storedEvent=env.DB.raw.prepare('SELECT * FROM events LIMIT 1').get();
  const storedSite=env.DB.raw.prepare('SELECT * FROM sites').get();
  assert.notEqual(storedAccount.username_key,'00417');
  assert.notEqual(storedAccount.password_hash,'example-password');
  assert.ok(!storedEvent.username_enc.includes('00417'));
  assert.notEqual(storedSite.signing_key, registered.signing_key);
});
