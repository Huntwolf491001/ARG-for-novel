(() => {
 'use strict';
 const read=()=>new URLSearchParams(location.search).get('ui')==='classic'?'classic':'modern';
 let mode=read(),classicToggleHome;
 document.documentElement.dataset.ui=mode;
 const transitionStyle=document.createElement('style');transitionStyle.id='forum-page-transition';document.head.append(transitionStyle);
 // Keep full-document snapshots disabled: overlapping fades caused a white flash.
 const transitionOptIn=()=>{const css='@view-transition{navigation:none}';if(transitionStyle.textContent!==css)transitionStyle.textContent=css;};transitionOptIn();
 function link(a){const raw=a.getAttribute('href');if(!raw||raw.startsWith('#'))return;let url;try{url=new URL(raw,location.href)}catch{return}if(url.origin!==location.origin||!/^https?:$|^file:$/.test(url.protocol)||!(/\.html$/.test(url.pathname)||url.pathname.endsWith('/')))return;url.searchParams.set('ui',mode);a.setAttribute('href',raw.split(/[?#]/)[0]+url.search+url.hash);}
 function sync(){
  transitionOptIn();
  classicToggleHome??=document.querySelector('.topbar .wrap>div:last-child');
  const button=document.querySelector('[data-ui-toggle]'),slot=document.querySelector('.modern-mode-slot'),target=mode==='modern'?slot:classicToggleHome;
  if(button&&target&&button.parentElement!==target)target.append(button);
  document.querySelectorAll('a[href]').forEach(link);
  document.querySelectorAll('form[action*="search.html"]').forEach(form=>{let field=form.querySelector('input[name="ui"]');if(!field){field=document.createElement('input');field.type='hidden';field.name='ui';form.append(field)}field.value=mode;});
  document.querySelectorAll('[data-ui-toggle]').forEach(button=>{const label=mode==='modern'?'旧版界面':'新版界面';if(button.textContent!==label)button.textContent=label;button.setAttribute('aria-label','切换至'+(mode==='modern'?'旧版':'新版')+'界面');button.setAttribute('aria-pressed',String(mode==='classic'));});
  document.querySelectorAll('[data-member-row]').forEach(row=>row.hidden=false);
  const count=document.querySelector('[data-member-count]');if(count){const text='本页展示 '+document.querySelectorAll('[data-member-row]:not([hidden])').length+' 位街坊';if(count.textContent!==text)count.textContent=text;}
  const member=document.getElementById('member-query');if(member)member.placeholder=mode==='modern'?'昵称 / UID / 邮箱':'昵称 / UID / 电话 / 邮箱';
  const icon=document.querySelector('link[rel="icon"]');if(icon)icon.href='assets/forum-mark'+(mode==='modern'?'-modern':'')+'.svg';
  const params=new URLSearchParams(location.search),file=location.pathname.split('/').pop()||'index.html',section=file==='members.html'?'members':file.startsWith('board-archive')?'archive':file==='search.html'?(params.get('view')==='essence'?'essence':'latest'):'home';
  document.querySelectorAll('[data-modern-nav]').forEach(a=>{const active=a.dataset.modernNav===section;a.classList.toggle('active',active);if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
 }
 function apply(value,{historyUpdate=false}={}){mode=value==='classic'?'classic':'modern';document.documentElement.dataset.ui=mode;if(historyUpdate){const url=new URL(location.href);url.searchParams.set('ui',mode);history.replaceState(null,'',url.pathname+url.search+url.hash);}sync();document.dispatchEvent(new CustomEvent('forum:ui-change',{detail:{mode}}));}
 window.ForumUI={get mode(){return mode},setMode:value=>apply(value,{historyUpdate:true}),sync};
 function ready(){sync();document.addEventListener('click',event=>{const toggle=event.target.closest('[data-ui-toggle]');if(toggle){apply(mode==='modern'?'classic':'modern',{historyUpdate:true});return;}const anchor=event.target.closest('a[href]');if(anchor)link(anchor);},true);document.addEventListener('auxclick',event=>{const a=event.target.closest('a[href]');if(a)link(a);},true);document.addEventListener('submit',sync,true);let queued=false;new MutationObserver(()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;sync()});}).observe(document.body,{childList:true,subtree:true});}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
 window.addEventListener('popstate',()=>apply(read()));
})();
