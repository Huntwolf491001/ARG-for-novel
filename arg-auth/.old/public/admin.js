const $ = s => document.querySelector(s), message = $('#message');
let sites = [];
let accountsRequest = 0;
let eventPage=1, eventPages=1, eventsRequest=0;
function show(text, error = false) { message.textContent = text; message.style.color = error ? '#a32626' : '#176034'; }
async function api(path, method = 'GET', data) {
  const r = await fetch(path,{method,headers:data ? {'content-type':'application/json'} : {},body:data ? JSON.stringify(data) : undefined});
  const result = await r.json(); if (!r.ok) throw new Error(result.error || '请求失败'); return result;
}
function formData(form) { return Object.fromEntries(new FormData(form)); }
function updateIntegration() {
  const site = sites.find(s => s.id === $('#site-select').value);
  $('#integration-empty').hidden = !!site;
  $('#integration-details').hidden = !site;
  $('#delete-site').disabled = !site;
  if (!site) { $('#accounts-list').replaceChildren(); return; }
  const apiUrl = location.origin + '/api/player/login?site=' + encodeURIComponent(site.id);
  const snippet = `<form id="arg-login">\n  <label>账号 <input name="username" autocomplete="username" required></label>\n  <label>密码 <input name="password" type="password" autocomplete="current-password" required></label>\n  <button type="submit">登录</button> <span id="arg-error" role="status"></span>\n</form>\n<script>\ndocument.querySelector('#arg-login').addEventListener('submit', async (event) => {\n  event.preventDefault();\n  const form = event.currentTarget;\n  try {\n    const response = await fetch(${JSON.stringify(apiUrl)}, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({site:${JSON.stringify(site.id)}, username:form.elements.username.value, password:form.elements.password.value})});\n    const data = await response.json();\n    if (!response.ok) throw new Error(data.error || '验证失败');\n    location.assign(data.redirect);\n  } catch (error) { document.querySelector('#arg-error').textContent = error.message || '网络错误'; }\n});\n<\/script>`;
  $('#detail-name').textContent=site.name;
  $('#detail-id').textContent=site.id;
  $('#detail-prefix').textContent=site.prefix;
  $('#detail-api').textContent=apiUrl;
  $('#detail-origin').textContent=site.origin;$('#detail-origin').href=site.origin;
  $('#detail-destination').textContent=site.origin+site.destination;$('#detail-destination').href=site.origin+site.destination;
  const edit=$('#site-edit-form');for(const field of ['id','name','origin','prefix','destination'])edit.elements[field].value=site[field];
  $('#site-key').value=site.signing_key;$('#site-key').type='password';$('#toggle-key').textContent='显示';$('#toggle-key').setAttribute('aria-pressed','false');
  $('#integration-code').textContent=snippet;
  loadAccounts(site.id);
}
async function loadAccounts(siteId) {
  const serial=++accountsRequest, container=$('#accounts-list');
  container.textContent='正在加载账号……';
  try {
    const data=await api('/api/admin/accounts?site='+encodeURIComponent(siteId));
    if(serial!==accountsRequest || $('#site-select').value!==siteId)return;
    container.replaceChildren();
    if(!data.accounts.length){container.textContent='该站点还没有玩家账号。';return;}
    const table=document.createElement('table');
    const head=document.createElement('thead'), headRow=document.createElement('tr');
    for(const title of ['账号','密码','二级验证','操作']){const cell=document.createElement('th');cell.textContent=title;headRow.append(cell)}
    head.append(headRow);table.append(head);const body=document.createElement('tbody');
    for(const account of data.accounts){
      const row=document.createElement('tr');
      for(const value of [account.username || '账号名称不可用', '已设置', account.has_secondary?'已设置':'未设置']){const cell=document.createElement('td');cell.textContent=value;row.append(cell)}
      const action=document.createElement('td');
      if(account.username){const button=document.createElement('button');button.type='button';button.className='secondary compact';button.textContent='重设密码';button.addEventListener('click',()=>{const form=$('#account-form');form.elements.site.value=siteId;form.elements.username.value=account.username;form.elements.password.value='';form.scrollIntoView({behavior:'smooth',block:'center'});form.elements.password.focus({preventScroll:true});});action.append(button)}
      row.append(action);body.append(row);
    }
    table.append(body);container.append(table);
    if(data.accounts.some(account=>!account.username)){const note=document.createElement('p');note.textContent='部分旧账号未保存可显示的名称；重新保存该账号后即可显示。';container.append(note)}
  } catch(error) {if(serial===accountsRequest)container.textContent='无法加载账号：'+error.message;}
}
async function copy(value) {try{await navigator.clipboard.writeText(value);show('已复制到剪贴板');}catch{show('无法自动复制，请选中文本后复制。',true)}}
async function load() {
  const s=await api('/api/admin/sites'); sites=s.sites;
  for (const selector of ['#site-select','#account-site','#puzzle-site']) {
    const select=$(selector), previous=select.value; select.replaceChildren();
    for (const site of sites) { const option=document.createElement('option');option.value=site.id;option.textContent=site.name+' ('+site.id+')';select.append(option); }
    if (sites.some(site=>site.id===previous)) select.value=previous;
  }
  updateIntegration();
  $('#delete-site').disabled = sites.length === 0;
  await loadEvents();
  $('#login').hidden=true; $('#dashboard').hidden=false;
}
async function loadEvents() {
  const serial=++eventsRequest,e=await api('/api/admin/events?page='+eventPage);if(serial!==eventsRequest)return;
  eventPage=e.page;eventPages=e.pages;const tbody=$('#events');tbody.replaceChildren();
  for(const event of e.events){const row=document.createElement('tr');for(const value of [new Date(event.created_at*1000).toLocaleString(),event.site_id,event.username,event.ip||'—',event.success?'成功':'失败',event.success?event.origin+event.destination:'—']){const cell=document.createElement('td');cell.textContent=value;row.append(cell)}row.children[4].className=event.success?'status-success':'status-failure';tbody.append(row)}
  if(!e.events.length){const row=document.createElement('tr'),cell=document.createElement('td');cell.colSpan=6;cell.textContent='暂无验证记录。';row.append(cell);tbody.append(row)}
  $('#page-info').textContent=`第 ${e.page} / ${e.pages} 页 · 共 ${e.total} 条`;
  $('#previous-page').disabled=e.page<=1;$('#next-page').disabled=e.page>=e.pages;
}
$('#login-form').addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget;try {await api('/api/admin/login','POST',formData(form));form.reset();await load();show('登录成功');}catch(err){show(err.message,true)}});
$('#site-form').addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget;try{await api('/api/admin/sites','POST',formData(form));form.reset();await load();show('站点已登记');}catch(err){show(err.message,true)}});
$('#account-form').addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget;try{await api('/api/admin/accounts','POST',formData(form));form.elements.password.value='';if($('#site-select').value===form.elements.site.value)await loadAccounts(form.elements.site.value);show('账号已保存');}catch(err){show(err.message,true)}});
$('#puzzle-form').addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget;try{await api('/api/admin/puzzle','POST',formData(form));form.elements.secondary.value='';form.elements.answer.value='';if($('#site-select').value===form.elements.site.value)await loadAccounts(form.elements.site.value);show('二级验证已保存');}catch(err){show(err.message,true)}});
$('#site-select').addEventListener('change',updateIntegration);
$('#site-edit-form').addEventListener('submit',async e=>{
  e.preventDefault();const form=e.currentTarget,site=sites.find(s=>s.id===$('#site-select').value);if(!site)return;
  const changes=formData(form);
  if((changes.id!==site.id||changes.origin!==site.origin||changes.prefix!==site.prefix)&&!confirm('修改站点 ID、网站地址或受保护目录后，必须同步更新目标网站的代码和 Cloudflare 配置，否则登录可能中断。确定保存吗？'))return;
  const button=form.querySelector('button[type=submit]');button.disabled=true;
  try{
    const result=await api('/api/admin/sites/update','POST',{original_id:site.id,...changes});
    await load();$('#site-select').value=result.id;$('#account-site').value=result.id;$('#puzzle-site').value=result.id;updateIntegration();
    show('站点配置已保存。请按需同步目标网站的接入配置。');
  }catch(err){show(err.message,true)}finally{button.disabled=false}
});
document.querySelectorAll('[data-copy]').forEach(button=>button.addEventListener('click',()=>copy($('#'+button.dataset.copy).textContent)));
$('#toggle-key').addEventListener('click',()=>{const field=$('#site-key'),visible=field.type==='password';field.type=visible?'text':'password';$('#toggle-key').textContent=visible?'隐藏':'显示';$('#toggle-key').setAttribute('aria-pressed',visible?'true':'false');});
$('#copy-key').addEventListener('click',()=>copy($('#site-key').value));
$('#copy-code').addEventListener('click',()=>copy($('#integration-code').textContent));
$('#delete-site').addEventListener('click',async()=>{
  const site=sites.find(s=>s.id===$('#site-select').value);if(!site)return;
  if(!confirm('确定删除“'+site.name+'”的站点配置、玩家账号、二级验证和验证记录吗？此操作无法撤销。'))return;
  try{await api('/api/admin/sites/delete','POST',{id:site.id});await load();show('站点配置及相关数据已删除。已有目标站点会话可能继续有效，最长 8 小时。');}catch(err){show(err.message,true)}
});
$('#refresh').addEventListener('click',async()=>{try{await load();show('记录已刷新')}catch(err){show(err.message,true)}});
$('#previous-page').addEventListener('click',async()=>{if(eventPage<=1)return;eventPage--;try{await loadEvents()}catch(err){eventPage++;show(err.message,true)}});
$('#next-page').addEventListener('click',async()=>{if(eventPage>=eventPages)return;eventPage++;try{await loadEvents()}catch(err){eventPage--;show(err.message,true)}});
$('#logout').addEventListener('click',async()=>{try{await api('/api/admin/logout','POST',{});$('#dashboard').hidden=true;$('#login').hidden=false;show('已退出登录')}catch(err){show(err.message,true)}});
load().catch(()=>{});
