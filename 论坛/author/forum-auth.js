(() => {
 'use strict';const config=globalThis.ForumAuthConfig,KEY='forum-author-session-v2',encode=new TextEncoder(),hex=bytes=>[...new Uint8Array(bytes)].map(n=>n.toString(16).padStart(2,'0')).join('');
 async function derive(text,salt){const key=await crypto.subtle.importKey('raw',encode.encode(text),'PBKDF2',false,['deriveBits']);return hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:encode.encode(salt),iterations:config.iterations},key,256));}
 const equal=(a,b)=>{let difference=a.length^b.length;for(let i=0;i<a.length;i++)difference|=a.charCodeAt(i)^b.charCodeAt(i);return difference===0;};
 const proof=async record=>hex(await crypto.subtle.digest('SHA-256',encode.encode(config.password.hash+'|'+record.nonce+'|'+record.until)));
 async function valid(){try{const record=JSON.parse(localStorage.getItem(KEY)||'null');return !!record&&record.until>Date.now()&&equal(record.proof,await proof(record));}catch{return false;}}
 async function login(username,password){if(!crypto?.subtle)throw Error('当前环境不支持浏览器加密，请使用本机静态预览或 HTTPS 页面。');if(typeof username!=='string'||typeof password!=='string'||username.length>128||password.length>256)return false;const hashes=await Promise.all([derive(username.trim(),config.username.salt),derive(password,config.password.salt)]);if(!equal(hashes[0],config.username.hash)||!equal(hashes[1],config.password.hash))return false;const record={nonce:crypto.randomUUID(),until:Date.now()+8*3600000};record.proof=await proof(record);localStorage.setItem(KEY,JSON.stringify(record));return true;}
 function logout(){localStorage.removeItem(KEY);window.dispatchEvent(new Event('forum:logout'));}
 globalThis.ForumAuth={valid,login,logout,async requireLogin(url){if(await valid())return true;location.replace(url);return false;}};
})();
