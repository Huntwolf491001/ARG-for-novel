(() => {
 'use strict';
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),modern=()=>document.documentElement.dataset.ui==='modern';
 const originals=new WeakMap(),enhanced=new Set(),animations=new Set(),running=new WeakMap();
 const controls=[
  ['.modern-login','login','登录'],['.feed-actions button[data-local-message]','bookmark','收藏帖子'],
  ['[data-ui-toggle]','layout','切换至旧版界面'],['.post-actions [data-quote]','quote','引用该楼层'],
  ['.post-actions [data-local-message]','flag','举报该楼层'],['[data-close-picture]','close','关闭图片'],
  ['[data-close-link]','close','关闭链接窗口'],['.back-top','up','返回顶部'],
  ['.search-form button[type="submit"]','search','搜索'],
  ['[data-editor-format="quote"]','quote','插入引用'],['[data-editor-format="code"]','code','插入代码'],
  ['[data-editor-format="list"]','list','插入列表'],['[data-editor-format="center"]','center','居中对齐'],
  ['[data-editor-link]','link','插入链接'],['[data-editor-undo]','undo','撤销'],['[data-editor-redo]','redo','重做']
 ];
 function restore(){for(const el of enhanced){const before=originals.get(el);for(const key of ['title','aria-label']){if(key==='aria-label'&&el.hasAttribute('data-ui-toggle'))continue;const value=before[key];if(value===null)el.removeAttribute(key);else el.setAttribute(key,value);}el.removeAttribute('data-icon');el.removeAttribute('data-icon-only');}enhanced.clear();}
 function icons(){if(!modern()){restore();return;}for(const [selector,icon,label] of controls)document.querySelectorAll(selector).forEach(el=>{if(!originals.has(el))originals.set(el,{title:el.getAttribute('title'),'aria-label':el.getAttribute('aria-label')});el.dataset.icon=icon;el.dataset.iconOnly='';el.setAttribute('aria-label',label);el.title=label;enhanced.add(el);});}
 function animate(el,frames,duration=150){if(!modern()||reduced.matches||!el?.animate||!el.getClientRects().length)return null;running.get(el)?.cancel();const animation=el.animate(frames,{duration,easing:'cubic-bezier(.2,.7,.3,1)'});running.set(el,animation);animations.add(animation);animation.finished.catch(()=>{}).finally(()=>{animations.delete(animation);if(running.get(el)===animation)running.delete(el);});return animation;}
 function reveal(el){animate(el,[{opacity:.55,transform:'translateY(3px)'},{opacity:1,transform:'none'}]);}
 function closeDialog(dialog){if(!dialog?.open||dialog.hasAttribute('data-closing'))return;if(!modern()||reduced.matches||!dialog.animate){dialog.close();return;}dialog.dataset.closing='';const animation=animate(dialog,[{opacity:1,transform:'none'},{opacity:0,transform:'translateY(3px) scale(.99)'}],130);const finish=()=>{dialog.removeAttribute('data-closing');if(dialog.open)dialog.close();};if(animation)animation.finished.then(finish,finish);else finish();}
 window.ForumMotion={closeDialog};
 function ready(){
  icons();let queued=false;const pending=new Set();
  new MutationObserver(records=>{for(const record of records){const el=record.target instanceof Element?record.target:record.target.parentElement;const box=el?.closest('#search-results,#reply-preview,#page-status,.feedback,.face-picker');if(box&&!box.hidden)pending.add(box);}if(queued)return;queued=true;queueMicrotask(()=>{queued=false;icons();if(modern())for(const el of pending)if(el.textContent.trim()||el.children.length)reveal(el);pending.clear();});}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
  document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('cancel',event=>{if(modern()&&!reduced.matches){event.preventDefault();closeDialog(dialog);}}));
  document.addEventListener('forum:ui-change',()=>{if(!modern())for(const animation of animations)animation.cancel();icons();});
  reduced.addEventListener?.('change',()=>{if(reduced.matches)for(const animation of animations)animation.cancel();window.ForumUI?.sync();});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
})();
