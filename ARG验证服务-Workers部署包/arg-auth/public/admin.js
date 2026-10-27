const $ = s => document.querySelector(s), message = $('#message');
let sites = [];
function show(text, error = false) { message.textContent = text; message.style.color = error ? '#a32626' : '#176034'; }
async function api(path, method = 'GET', data) {
  const r = await fetch(path,{method,headers:data ? {'content-type':'application/json'} : {},body:data ? JSON.stringify(data) : undefined});
  const result = await r.json(); if (!r.ok) throw new Error(result.error || '请求失败'); return result;
}
function formData(form) { return Object.fromEntries(new FormData(form)); }
function updateIntegration() {
  const site = sites.find(s => s.id === $('#site-select').value);
  if (!site) { $('#integration').textContent = '尚无站点。'; return; }
  const apiUrl = location.origin + '/api/player/login?site=' + encodeURIComponent(site.id);
  const snippet = `<form id="arg-login">\n  <label>账号 <input name="username" autocomplete="username" required></label>\n  <label>密码 <input name="password" type="password" autocomplete="current-password" required></label>\n  <button type="submit">登录</button> <span id="arg-error" role="status"></span>\n</form>\n<script>\ndocument.querySelector('#arg-login').addEventListener('submit', async (event) => {\n  event.preventDefault();\n  const form = event.currentTarget;\n  try {\n    const response = await fetch(${JSON.stringify(apiUrl)}, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({site:${JSON.stringify(site.id)}, username:form.elements.username.value, password:form.elements.password.value})});\n    const data = await response.json();\n    if (!response.ok) throw new Error(data.error || '验证失败');\n    location.assign(data.redirect);\n  } catch (error) { document.querySelector('#arg-error').textContent = error.message || '网络错误'; }\n});\n<\/script>`;
  $('#integration').textContent = `目标 Worker 的 wrangler.jsonc 配置：\nAUTH_ORIGIN = ${location.origin}\nSITE_ORIGIN = ${site.origin}\nSITE_ID = ${site.id}\nPROTECTED_PREFIX = ${site.prefix}\n\n目标 Worker 的 Secret：SITE_KEY\n${site.signing_key}\n\n可粘贴到目标站点的登录表单：\n${snippet}\n\n部署和保护目录的完整步骤见项目 README。`;
}
async function load() {
  const [s,e] = await Promise.all([api('/api/admin/sites'),api('/api/admin/events')]); sites=s.sites;
  for (const selector of ['#site-select','#account-site']) {
    const select=$(selector), previous=select.value; select.replaceChildren();
    for (const site of sites) { const option=document.createElement('option');option.value=site.id;option.textContent=site.name+' ('+site.id+')';select.append(option); }
    if (sites.some(site=>site.id===previous)) select.value=previous;
  }
  updateIntegration();
  const tbody=$('#events'); tbody.replaceChildren();
  for (const event of e.events) { const row=document.createElement('tr'); for (const value of [new Date(event.created_at*1000).toLocaleString(),event.site_id,event.username,event.success?'通过':'失败',event.success ? event.origin+event.destination : '—']) {const cell=document.createElement('td');cell.textContent=value;row.append(cell)} tbody.append(row); }
  $('#login').hidden=true; $('#dashboard').hidden=false;
}
$('#login-form').addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget;try {await api('/api/admin/login','POST',formData(form));form.reset();await load();show('登录成功');}catch(err){show(err.message,true)}});
$('#site-form').addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget;try{await api('/api/admin/sites','POST',formData(form));form.reset();await load();show('站点已登记');}catch(err){show(err.message,true)}});
$('#account-form').addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget;try{await api('/api/admin/accounts','POST',formData(form));form.elements.password.value='';show('账号已保存');}catch(err){show(err.message,true)}});
$('#site-select').addEventListener('change',updateIntegration);
$('#refresh').addEventListener('click',async()=>{try{await load();show('记录已刷新')}catch(err){show(err.message,true)}});
$('#logout').addEventListener('click',async()=>{try{await api('/api/admin/logout','POST',{});$('#dashboard').hidden=true;$('#login').hidden=false;show('已退出登录')}catch(err){show(err.message,true)}});
load().catch(()=>{});
