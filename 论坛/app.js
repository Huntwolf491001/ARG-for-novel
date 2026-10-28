(() => {
 'use strict';
 const show=(form,message)=>{let box=form.querySelector('.feedback');if(!box){box=document.createElement('div');box.className='feedback';box.setAttribute('role','status');form.append(box)}box.textContent=message};
 document.querySelectorAll('[data-auth]').forEach(form=>form.addEventListener('submit',event=>{event.preventDefault();if(window.ForumAdmin?.tryLogin(form))return;show(form,'账号或密码错误，请检查后重试。');form.querySelectorAll('[type=password]').forEach(input=>input.value='')}));
 document.querySelectorAll('[data-reply]').forEach(form=>form.addEventListener('submit',event=>{event.preventDefault();show(form,'您尚未登录，请先登录后再发表回复。')}));
 document.querySelectorAll('[data-quote]').forEach(button=>button.addEventListener('click',()=>{const input=document.querySelector('#reply-text');if(!input)return;const floor=document.getElementById('floor-'+button.dataset.quote),name=floor.querySelector('.username').textContent,body=[...floor.querySelectorAll('.post-body > p')].map(p=>p.textContent).join('\n')||'原楼层内容暂不可见。';input.setRangeText('[quote]'+name+'（'+button.dataset.quote+' 楼）：\n'+body+'\n[/quote]\n',input.selectionStart,input.selectionEnd,'end');input.focus();input.scrollIntoView({block:'center'})}));
 document.querySelectorAll('[data-local-message]').forEach(button=>button.addEventListener('click',()=>{const status=document.getElementById('page-status');if(status){status.textContent=button.dataset.localMessage;status.hidden=false;status.scrollIntoView({block:'nearest'})}}));
 const picker=document.querySelector('#face-picker'),reply=document.querySelector('#reply-text'),faceToggle=document.querySelector('[data-toggle-faces]');
 faceToggle?.addEventListener('click',()=>{picker.hidden=!picker.hidden;faceToggle.setAttribute('aria-expanded',String(!picker.hidden))});
 document.querySelectorAll('[data-insert-face]').forEach(button=>button.addEventListener('click',()=>{if(!reply)return;const label='['+button.dataset.insertFace+']',start=reply.selectionStart,end=reply.selectionEnd;reply.setRangeText(label,start,end,'end');reply.focus();picker.hidden=true;faceToggle.setAttribute('aria-expanded','false')}));
 const viewer=document.querySelector('#picture-viewer'),viewerImage=document.querySelector('#viewer-image'),viewerCaption=document.querySelector('#viewer-caption');
 document.querySelectorAll('[data-lightbox]').forEach(link=>link.addEventListener('click',event=>{if(!viewer?.showModal)return;event.preventDefault();viewerImage.src=link.getAttribute('href');viewerImage.alt=link.dataset.caption;viewerCaption.textContent=link.dataset.caption;viewer.showModal()}));
 const closeViewer=()=>window.ForumMotion?window.ForumMotion.closeDialog(viewer):viewer.close();
 document.querySelector('[data-close-picture]')?.addEventListener('click',closeViewer);
 viewer?.addEventListener('click',event=>{if(event.target===viewer){const rect=viewer.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)closeViewer()}});
 document.querySelectorAll('[data-collapse-board]').forEach(button=>button.addEventListener('click',()=>{const table=button.closest('.panel').querySelector('table'),collapse=!table.hidden;table.hidden=collapse;button.setAttribute('aria-expanded',String(!collapse));button.textContent=collapse?'展开 ＋':'收起 －'}));
 const statusFilter=document.querySelector('[data-status-filter]'),yearFilter=document.querySelector('[data-year-filter]');
 const filterRows=()=>{let visible=0;document.querySelectorAll('[data-thread-row]').forEach(row=>{const s=!statusFilter?.value||row.dataset[statusFilter.value]==='true';const y=!yearFilter?.value||row.dataset.year===yearFilter.value;row.hidden=!(s&&y);if(!row.hidden)visible++});const empty=document.querySelector('[data-filter-empty]');if(empty)empty.hidden=visible>0};
 statusFilter?.addEventListener('change',filterRows);yearFilter?.addEventListener('change',filterRows);
 const results=document.querySelector('#search-results');
 if(results&&window.FORUM_SEARCH){
  const renderSearch=()=>{
  const params=new URLSearchParams(location.search),q=(params.get('q')||'').trim(),year=params.get('year'),view=params.get('view'),mode=params.get('type')==='users'?'users':'posts';
  const skin=window.ForumUI?.mode||'modern',classic=skin==='classic';
  document.title=(mode==='users'?'查找用户':'搜索帖子')+' - 狰州民间消息论坛';
  const input=document.querySelector('#full-search');input.value=q;input.placeholder=mode==='users'?(classic?'昵称、UID、手机号或邮箱':'昵称、UID 或邮箱'):'输入标题、用户名或版块关键词';input.setAttribute('aria-label',mode==='users'?'查找用户':'搜索关键词');document.querySelector('#search-kind').value=mode;
  document.querySelector('#search-help').textContent=mode==='users'?(classic?'找用户支持昵称、UID、联系电话和邮箱；手机号可带空格或横线。':'按昵称、UID 或邮箱查找街坊。'):'输入你记得的标题、作者或版块关键词，也可以按年份翻看。';
  document.querySelectorAll('[data-search-type]').forEach(link=>{const active=link.dataset.searchType===mode;link.classList.toggle('active',active);if(active)link.setAttribute('aria-current','page');});
  document.querySelectorAll('.searchbar [name=type],.modern-search [name=type]').forEach(select=>select.value=mode);
  const info=document.querySelector('#search-summary'),pageSize=20;
  let list;
  if(mode==='users'){
   list=window.ForumSearchPolicy.users(window.FORUM_USERS||[],q,skin);
   info.textContent=q?'查找用户 “'+q+'”，共找到 '+list.length+' 位用户。':'街坊名册，共 '+list.length+' 位用户。';
  }else{
   list=window.ForumSearchPolicy.posts(window.FORUM_SEARCH,{query:q,year:year||'',view:view||'',skin});
   info.textContent=(q?'搜索 “'+q+'”':year?year+' 年旧帖':view==='essence'?'精华帖子':'全部帖子')+'，共找到 '+list.length+' 条记录。';
  }
  const max=Math.max(1,Math.ceil(list.length/pageSize)),page=Math.min(max,Math.max(1,Number(params.get('page'))||1)),frag=document.createDocumentFragment();
  list.slice((page-1)*pageSize,page*pageSize).forEach(item=>{
   const row=document.createElement('article');row.className=mode==='users'?'search-result user-search-result':'search-result';const h=document.createElement('h3'),link=document.createElement('a');link.href=item.url;link.textContent=mode==='users'?item.name+'　UID '+item.uid:item.title;h.append(link);const p=document.createElement('p');
   if(mode==='users'){p.textContent=item.level+'　｜　注册 '+item.joined;row.append(h,p);const contact=document.createElement('p');contact.className='search-contact';contact.textContent=[classic&&item.phone?'电话：'+item.phone:'',item.email?'邮箱：'+item.email:''].filter(Boolean).join('　｜　')||(classic?'未公开联系方式':'未填写邮箱');row.append(contact);if(item.deactivated){const state=document.createElement('span');state.className='deactivated-label';state.textContent='账号已注销 · 可查看旧帖';row.append(state);}}
   else{p.textContent=item.board+'　｜　'+item.author+'　｜　'+item.date+'　｜　'+(item.deleted?'已删除 / 审核中':item.locked?'已锁定':'可阅读')+'　｜　回复 '+item.replies;row.append(h,p);if(item.id===38){const cache=document.createElement('a');cache.href='snapshot.html';cache.textContent='查看已保存的网页快照 »';cache.style.color='#6486a2';row.append(cache);}}
   frag.append(row);
  });
  results.replaceChildren(frag);if(!list.length){const empty=document.createElement('p');empty.className='empty';empty.textContent=mode==='users'?(classic?'没有找到这位用户，试试昵称、UID 或不带空格的手机号。':'没有找到相关用户。'):'没有找到相关帖子，试试更短的关键词。';results.append(empty);}
  const pager=document.querySelector('#search-pages');pager.replaceChildren();for(let n=1;n<=max;n++){const link=document.createElement(n===page?'span':'a');link.textContent=String(n);if(n===page){link.className='current';link.setAttribute('aria-current','page');}else{const next=new URLSearchParams(params);next.set('page',String(n));link.href='search.html?'+next.toString();}pager.append(link);}
  window.ForumUI?.sync();
  };
  renderSearch();document.addEventListener('forum:ui-change',renderSearch);
 }
})();
