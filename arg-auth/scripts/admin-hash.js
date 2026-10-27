import { random, hashPassword } from '../src/crypto.js';
if (!process.stdin.isTTY) { console.error('请在交互式终端运行此工具。'); process.exit(1); }
function readHidden(prompt) {
  return new Promise(resolve => {
    let value=''; process.stdout.write(prompt); process.stdin.setRawMode(true); process.stdin.resume(); process.stdin.setEncoding('utf8');
    function input(chunk) {
      for (const c of chunk) {
        if (c === '\u0003') { process.stdin.setRawMode(false); process.exit(1); }
        if (c === '\r' || c === '\n') { process.stdin.removeListener('data',input); process.stdin.setRawMode(false); process.stdin.pause(); process.stdout.write('\n'); resolve(value); return; }
        if (c === '\u007f' || c === '\b') value=value.slice(0,-1);
        else if (c >= ' ') value+=c;
      }
    }
    process.stdin.on('data',input);
  });
}
const username=await readHidden('请输入管理员账号（不会显示）：');
const password=await readHidden('请输入管理员密码（不会显示）：');
if (!username || username.length > 80 || password.length < 16 || password.length > 256) { console.error('账号或密码长度不符合要求，密码须为 16 至 256 个字符。'); process.exit(1); }
const salt=random(16);
console.log('ADMIN_PASSWORD_SALT=' + salt + '\nADMIN_USERNAME_HASH=' + await hashPassword(username,salt) + '\nADMIN_PASSWORD_HASH=' + await hashPassword(password,salt));
