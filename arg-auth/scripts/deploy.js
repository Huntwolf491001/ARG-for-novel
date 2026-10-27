import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { fileURLToPath } from 'node:url';
import { random, hashPassword } from '../src/crypto.js';

const wrangler = new URL('../node_modules/wrangler/bin/wrangler.js',import.meta.url);
const root = new URL('../',import.meta.url);
if (!stdin.isTTY || !existsSync(wrangler)) { console.error('请在终端中运行，并先执行 npm install。'); process.exit(1); }
process.chdir(fileURLToPath(root));
process.env.WRANGLER_SEND_METRICS = 'false';
function run(args, {capture=false,input}={}) {
  const options={encoding:'utf8',env:process.env,stdio:[input === undefined ? (capture?'ignore':'inherit'):'pipe',capture?'pipe':'inherit',capture?'pipe':'inherit']};
  if (input !== undefined) options.input=input;
  const result=spawnSync(process.execPath,[fileURLToPath(wrangler),...args],options);
  if (result.error) throw result.error;
  if (result.status !== 0) {
    if (capture && result.stderr) console.error(result.stderr);
    throw new Error('Wrangler 执行失败：' + args.join(' '));
  }
  return result.stdout || '';
}
function jsonOutput(args) {
  const raw=run(args,{capture:true});
  try { return JSON.parse(raw); } catch { throw new Error('无法读取 Wrangler 的结果，请检查 Cloudflare 账号权限。'); }
}
function hidden(prompt) { return new Promise(resolve => {
  let value=''; stdout.write(prompt); stdin.setRawMode(true);stdin.resume();stdin.setEncoding('utf8');
  function onData(chunk) { for (const c of chunk) {
    if (c === '\u0003') { stdin.setRawMode(false);process.exit(1); }
    if (c === '\r' || c === '\n') { stdin.removeListener('data',onData);stdin.setRawMode(false);stdin.pause();stdout.write('\n');resolve(value);return; }
    if (c === '\u007f' || c === '\b') value=value.slice(0,-1); else if (c >= ' ') value+=c;
  }} stdin.on('data',onData);
}); }
async function selectAccount(accounts) {
  if (!Array.isArray(accounts) || accounts.length===0) throw new Error('当前登录没有可用的 Cloudflare 账户。');
  if (accounts.length===1) return accounts[0].id;
  console.log('\n请选择要部署到哪个 Cloudflare 账户：');
  accounts.forEach((account,i)=>console.log(`${i+1}. ${account.name} (${account.id})`));
  const rl=createInterface({input:stdin,output:stdout});
  const choice=await rl.question('输入序号：');rl.close();
  const index=Number(choice)-1;
  if (!Number.isInteger(index) || index<0 || index>=accounts.length) throw new Error('账户序号无效。');
  return accounts[index].id;
}
try {
  console.log('这是首次部署向导，会创建一个新的 Worker 和 D1 数据库。');
  console.log('免费计划有 CPU 运行时间限制，部署完成后请测试管理员和玩家登录。');
  console.log('如果尚未登录 Cloudflare，接下来会打开浏览器进行授权。');
  let profile;
  try { profile=jsonOutput(['whoami','--json']); } catch { run(['login']); profile=jsonOutput(['whoami','--json']); }
  process.env.CLOUDFLARE_ACCOUNT_ID=await selectAccount(profile.accounts);
  const username=await hidden('\n请输入管理员账号（不显示）：');
  const password=await hidden('请输入管理员密码（不显示）：');
  const confirm=await hidden('请再次输入管理员密码（不显示）：');
  if (!username || username.trim()!==username || username.length>80 || password.length<16 || password.length>256 || password!==confirm) throw new Error('账号无效，或密码不一致；密码长度须为 16 至 256 个字符。');
  const suffix=randomBytes(6).toString('hex'), name='arg-auth-'+suffix;
  const config=JSON.parse(readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8'));
  config.name=name;config.d1_databases[0].database_name=name;
  console.log(`\n正在创建数据库 ${name}……`);
  run(['d1','create',name,'--update-config=false']);
  const databases=jsonOutput(['d1','list','--json']);
  const db=databases.find(d=>d.name===name);
  if (!db?.uuid) throw new Error('已创建数据库，但未能读取数据库 ID。请在 Cloudflare 控制台检查该数据库。');
  config.d1_databases[0].database_id=db.uuid;
  const configFile=`wrangler.generated.${suffix}.json`;
  writeFileSync(configFile,JSON.stringify(config,null,2)+'\n',{flag:'wx'});
  console.log('\n正在初始化数据库……');
  run(['d1','migrations','apply',name,'--remote','--config',configFile]);
  console.log('\n正在部署验证服务（Secrets 配置完成前服务会暂时返回 503）……');
  run(['deploy','--config',configFile]);
  console.log('\n正在设置管理员摘要及安全密钥……');
  const salt=random(16);
  const secrets={ADMIN_PASSWORD_SALT:salt,ADMIN_USERNAME_HASH:await hashPassword(username,salt),ADMIN_PASSWORD_HASH:await hashPassword(password,salt),ACCOUNT_KEY:random(),ADMIN_SESSION_KEY:random()};
  run(['secret','bulk','--config',configFile],{input:JSON.stringify(secrets)});
  console.log(`\n部署完成。Worker 名称：${name}`);
  console.log(`配置文件：${configFile}。请记录上方 deploy 输出的网址，并保留该配置文件用于后续维护。`);
  console.log('每次运行向导都会创建新的独立服务；更新既有服务请使用原配置文件，不要重新运行向导。');
} catch (error) { console.error('\n部署失败：'+error.message);process.exitCode=1; }
