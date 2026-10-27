// Run in a trusted interactive terminal; never pass credentials on the command line.
const [authOrigin, site] = process.argv.slice(2);
if (!authOrigin || !/^https:\/\//.test(authOrigin) || !/^[a-z0-9][a-z0-9-]{0,39}$/.test(site || '') || !process.stdin.isTTY) {
  console.error('用法：node scripts/register-account.js https://认证服务域名 站点ID'); process.exit(1);
}
if (new URL(authOrigin).origin !== authOrigin) { console.error('认证服务地址只能包含 HTTPS 域名。'); process.exit(1); }
function ask(prompt) { return new Promise(resolve => {
  let value=''; process.stdout.write(prompt); process.stdin.setRawMode(true); process.stdin.resume(); process.stdin.setEncoding('utf8');
  function onData(chunk) { for (const c of chunk) {
    if (c === '\u0003') { process.stdin.setRawMode(false); process.exit(1); }
    if (c === '\r' || c === '\n') { process.stdin.removeListener('data',onData);process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n');resolve(value);return; }
    if (c === '\u007f' || c === '\b') value=value.slice(0,-1); else if (c >= ' ') value+=c;
  }} process.stdin.on('data',onData);
}); }
async function post(path, payload, cookie) {
  const headers={'content-type':'application/json','origin':authOrigin}; if (cookie) headers.cookie=cookie;
  const response=await fetch(authOrigin+path,{method:'POST',headers,body:JSON.stringify(payload),redirect:'error'});
  const result=await response.json(); if (!response.ok) throw new Error(result.error || '请求失败');
  return response;
}
try {
  const username=await ask('管理员账号（不显示）：'), password=await ask('管理员密码（不显示）：');
  const login=await post('/api/admin/login',{username,password});
  const session=login.headers.get('set-cookie')?.split(';')[0]; if (!session) throw new Error('未收到管理员会话');
  const player=await ask('玩家账号（不显示）：'), playerPassword=await ask('玩家密码（不显示）：');
  await post('/api/admin/accounts',{site,username:player,password:playerPassword},session);
  await post('/api/admin/logout',{},session);
  console.log('账号已登记。请在已登录的管理后台复制该站点的表单和 Worker 接入配置。');
} catch (error) { console.error('登记失败：' + error.message); process.exitCode=1; }
