const message = document.querySelector('#message');
const site = new URL(location.href).searchParams.get('site');
if (!site) { message.textContent = '登录入口缺少站点 ID。'; document.querySelector('button').disabled = true; }
document.querySelector('#player-form').addEventListener('submit', async e => {
  e.preventDefault(); const form = e.currentTarget; const button = form.querySelector('button'); button.disabled = true; message.textContent = '正在验证……';
  try {
    const response = await fetch('/api/player/login', {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({site,username:form.username.value,password:form.password.value})});
    const data = await response.json(); if (!response.ok) throw new Error(data.error || '验证失败');
    if (!data.redirect) throw new Error('该账号需要二级验证，请从目标网站的登录页面进入。');
    location.assign(data.redirect);
  } catch(err) { message.textContent = err.message || '网络错误，请重试'; button.disabled = false; }
});
