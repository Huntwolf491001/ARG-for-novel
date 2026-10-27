import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { stdin, stdout } from 'node:process';
import { random, hashPassword } from '../src/crypto.js';

if (!stdin.isTTY) { console.error('请通过继续部署.cmd 在交互式终端运行。');process.exit(1); }
process.chdir(fileURLToPath(new URL('../',import.meta.url)));
process.env.WRANGLER_SEND_METRICS='false';
const cli=fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js',import.meta.url));
const config='wrangler.generated.683dc0f14848.json';
const origin='https://arg-auth-683dc0f14848.yangyi42905341.workers.dev';
function run(args,input) {
  const options={encoding:'utf8',env:process.env,stdio:[input===undefined?'ignore':'pipe','pipe','pipe']};
  if(input!==undefined)options.input=input;
  const p=spawnSync(process.execPath,[cli,...args,'--config',config],options);
  if(p.error || p.status!==0) throw new Error('Cloudflare 命令失败：'+(p.stderr || p.error?.message || '请检查登录状态'));
  return p.stdout;
}
function hidden(prompt) {return new Promise(resolve=>{
  let value='';stdout.write(prompt);stdin.setRawMode(true);stdin.resume();stdin.setEncoding('utf8');
  function onData(chunk){for(const c of chunk){
    if(c==='\u0003'){stdin.setRawMode(false);process.exit(1)}
    if(c==='\r'||c==='\n'){stdin.removeListener('data',onData);stdin.setRawMode(false);stdin.pause();stdout.write('\n');resolve(value);return}
    if(c==='\u007f'||c==='\b')value=value.slice(0,-1);else if(c>=' ')value+=c;
  }} stdin.on('data',onData);
});}
try {
  const existing=JSON.parse(run(['secret','list']));
  if(!Array.isArray(existing))throw new Error('无法确认现有 Secret 的状态，脚本已停止。');
  const required=['ADMIN_PASSWORD_SALT','ADMIN_USERNAME_HASH','ADMIN_PASSWORD_HASH','ACCOUNT_KEY','ADMIN_SESSION_KEY'];
  const alreadyConfigured=required.every(name=>existing.some(item=>item.name===name));
  if(existing.length && !alreadyConfigured)throw new Error('Secret 配置不完整，为避免覆盖密钥，脚本已停止，请联系协助排查。');
  console.log(alreadyConfigured ? '服务已经配置，接下来只测试管理员登录，不会修改密钥。' : '继续设置已部署的 Cloudflare 验证服务。');
  const username=await hidden('请输入管理员账号（不显示）：');
  const password=await hidden('请输入管理员密码（不显示）：');
  if(!username||username.trim()!==username||username.length>80||!password||password.length>256)throw new Error('账号或密码无效。');
  if(!alreadyConfigured){
    const confirmation=await hidden('请再次输入管理员密码（不显示）：');
    if(password.length<16||password!==confirmation)throw new Error('两次密码不一致，或密码少于 16 个字符。');
    const salt=random(16);
    const secrets={ADMIN_PASSWORD_SALT:salt,ADMIN_USERNAME_HASH:await hashPassword(username,salt),ADMIN_PASSWORD_HASH:await hashPassword(password,salt),ACCOUNT_KEY:random(),ADMIN_SESSION_KEY:random()};
    run(['secret','bulk'],JSON.stringify(secrets));
    console.log('安全配置已写入。');
  }
  console.log('正在测试管理员登录……');
  // Windows PowerShell uses the system proxy, unlike Node's default fetch.
  const ps = "$inputJson=[Console]::In.ReadToEnd(); try { $r=Invoke-WebRequest -Uri '"+origin+"/api/admin/login' -Method Post -ContentType 'application/json' -Headers @{Origin='"+origin+"'} -Body ([System.Text.Encoding]::UTF8.GetBytes($inputJson)) -UseBasicParsing -TimeoutSec 30; Write-Output ([int]$r.StatusCode) } catch { if ($_.Exception.Response) { Write-Output ([int]$_.Exception.Response.StatusCode) } else { Write-Error '无法连接登录服务'; exit 1 } }";
  const test=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',ps],{encoding:'utf8',input:JSON.stringify({username,password}),timeout:40000});
  const status=Number((test.stdout||'').trim());
  if(test.error||test.status!==0||status!==200)throw new Error('Secret 已设置，但管理员登录测试未通过（'+(status?'HTTP '+status:'网络连接失败')+'）。请不要覆盖已有密钥。');
  console.log('管理员登录测试通过。访问地址：'+origin);
}catch(error){console.error('\n配置未完成：'+error.message);process.exitCode=1;}
