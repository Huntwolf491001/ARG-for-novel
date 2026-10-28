import test from 'node:test';
import assert from 'node:assert/strict';
import gate from '../pages-adapter/_worker.js';
import {sign} from '../src/crypto.js';

test('Pages gate protects files, validates tickets and rejects other origins',async(t)=>{
  const env={SITE_ID:'police',SITE_KEY:'0123456789abcdefghijklmnopqrstuvwxyzABCDEFG',AUTH_ORIGIN:'https://auth.example',SITE_ORIGIN:'https://project.pages.dev',PROTECTED_PREFIX:'/archive/',ASSETS:{async fetch(){return new Response('asset content')}}};
  const used=new Set(), revoked=new Set();
  t.mock.method(globalThis,'fetch',async(url,options)=>{
    const {token}=JSON.parse(options.body), action=String(url).split('/').pop();
    if(action==='redeem'){
      if(used.has(token))return new Response('',{status:403});
      used.add(token);
      return Response.json({session:await sign({type:'site',site:env.SITE_ID,nonce:'test',exp:Math.floor(Date.now()/1000)+28800},env.SITE_KEY)});
    }
    if(action==='logout')revoked.add(token);
    return revoked.has(token)&&action==='check'?new Response('',{status:403}):Response.json({ok:true});
  });
  const get=(path,headers)=>gate.fetch(new Request(env.SITE_ORIGIN+path,{headers}),env);
  let r=await get('/');assert.equal(r.status,200);
  for(const path of ['/archive','/archive/index.html','/archive/document.png','/%61rchive/index.html']) {r=await get(path);assert.equal(r.status,302);assert.match(r.headers.get('location'),/auth\.example\/login/);}
  r=await get('/%2561rchive/index.html');assert.equal(r.status,400);
  r=await gate.fetch(new Request('https://preview.project.pages.dev/archive/'),env);assert.equal(r.status,403);
  r=await get('/_arg/callback?ticket=forged');assert.equal(r.status,403);
  const exp=Math.floor(Date.now()/1000)+60;
  const ticket=await sign({type:'ticket',site:'police',dest:'/archive/index.html',exp},env.SITE_KEY);
  r=await get('/_arg/callback?ticket='+ticket);assert.equal(r.status,302);assert.equal(r.headers.get('location'),env.SITE_ORIGIN+'/archive/index.html');
  const session=r.headers.get('set-cookie').split(';')[0];assert.match(r.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Lax/);
  r=await get('/_arg/callback?ticket='+ticket);assert.equal(r.status,403);
  r=await get('/archive/document.png',{cookie:session});assert.equal(r.status,200);assert.equal(await r.text(),'asset content');assert.equal(r.headers.get('cache-control'),'private, no-store');
  r=await gate.fetch(new Request(env.SITE_ORIGIN+'/_arg/logout',{method:'POST',headers:{cookie:session,origin:env.SITE_ORIGIN}}),env);assert.equal(r.status,302);assert.match(r.headers.get('set-cookie'),/Max-Age=0/);
  r=await get('/archive/document.png',{cookie:session});assert.equal(r.status,302);
  const wrong=await sign({type:'ticket',site:'other',dest:'/archive/index.html',exp},env.SITE_KEY);
  r=await get('/_arg/callback?ticket='+wrong);assert.equal(r.status,403);
  const escape=await sign({type:'ticket',site:'police',dest:'/public.html',exp},env.SITE_KEY);
  r=await get('/_arg/callback?ticket='+escape);assert.equal(r.status,403);
  r=await gate.fetch(new Request(env.SITE_ORIGIN+'/'),{...env,SITE_KEY:''});assert.equal(r.status,503);
  r=await gate.fetch(new Request(env.SITE_ORIGIN+'/archive/'),{...env,LOGIN_PATH:'/login.html'});assert.equal(r.headers.get('location'),env.SITE_ORIGIN+'/login.html');
  r=await gate.fetch(new Request(env.SITE_ORIGIN+'/archive/'),{...env,LOGIN_PATH:'https://evil.example/'});assert.equal(r.status,503);
});
