(() => {
 'use strict';
 const input=document.querySelector('#reply-text');if(!input)return;
 const preview=document.querySelector('#reply-preview'),previewToggle=document.querySelector('[data-editor-preview]'),count=document.querySelector('#editor-count');
 const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const faces={'微笑':'smile','偷笑':'grin','汗':'sweat','挠头':'confused','无奈':'sigh','抱拳':'thanks','挥手':'wave','大哭':'cry','生气':'angry','喝茶':'tea','眨眼':'wink','惊讶':'wow'};
 const photoNames=['street','umbrella','radio','meal','plant','tickets','books','bridge','skyline','avenue'];
 const safePhoto=url=>photoNames.some(name=>url==='assets/photos/'+name+'.png')||['assets/photos/box.jpg','assets/photos/tea.jpg','assets/route-sketch.svg','assets/fan-sketch.svg'].includes(url);
 function safeUrl(url){url=String(url||'').trim();return /^(?:https?:\/\/[^\s<>"']+|[a-z][a-z0-9-]*\.html(?:[?#][^\s<>"']*)?|#[a-z0-9_-]+)$/i.test(url)?url:null;}
 const plain=s=>escape(s).replace(/\n/g,'<br>').replace(/\[([^\[\]]+)\]/g,(token,label)=>faces[label]?'<img class="emoticon" src="assets/faces/'+faces[label]+'.svg" alt="['+label+']" width="24" height="26">':token);
 function render(text,depth=0){
  if(depth>12)return plain(text);
  const pattern=/\[(b|i|u|s|quote|code|list|url|img|color|size|font|align)(?:=([^\]\n]*))?\]([\s\S]*?)\[\/\1\]/gi;
  let html='',start=0,match;
  while((match=pattern.exec(text))){
   html+=plain(text.slice(start,match.index));start=pattern.lastIndex;
   const tag=match[1].toLowerCase(),arg=(match[2]||'').trim(),body=match[3];
   const children=()=>render(body,depth+1);
   if(['b','i','u','s'].includes(tag)){const el={b:'strong',i:'em',u:'u',s:'s'}[tag];html+='<'+el+'>'+children()+'</'+el+'>';}
   else if(tag==='quote')html+='<blockquote>'+children()+'</blockquote>';
   else if(tag==='code')html+='<pre><code>'+escape(body)+'</code></pre>';
   else if(tag==='list')html+='<ul>'+body.split('[*]').filter(x=>x.trim()).slice(0,50).map(x=>'<li>'+render(x.trim(),depth+1)+'</li>').join('')+'</ul>';
   else if(tag==='url'){const url=safeUrl(arg||body);html+=url?'<a href="'+escape(url)+'" target="_blank" rel="noopener noreferrer">'+(arg?children():escape(body))+'</a>':plain(match[0]);}
   else if(tag==='img')html+=safePhoto(body.trim())?'<img class="preview-attachment" src="'+escape(body.trim())+'" alt="本地附件预览">':plain(match[0]);
   else if(tag==='color')html+=/^#[0-9a-f]{6}$/i.test(arg)?'<span style="color:'+arg+'">'+children()+'</span>':plain(match[0]);
   else if(tag==='size')html+=['12','14','16','18','22'].includes(arg)?'<span style="font-size:'+arg+'px">'+children()+'</span>':plain(match[0]);
   else if(tag==='font')html+=['宋体','黑体','楷体'].includes(arg)?'<span style="font-family:'+arg+'">'+children()+'</span>':plain(match[0]);
   else if(tag==='align')html+=['left','center','right'].includes(arg)?'<div style="text-align:'+arg+'">'+children()+'</div>':plain(match[0]);
  }
  return html+plain(text.slice(start));
 }
 const states=[{value:input.value,start:0,end:0}];let position=0;
 const update=()=>{count.textContent=input.value.length+' 字';if(!preview.hidden)preview.innerHTML=input.value?render(input.value):'<span class="preview-empty">还没有输入内容。</span>';document.querySelector('[data-editor-undo]').disabled=position===0;document.querySelector('[data-editor-redo]').disabled=position===states.length-1;};
 function remember(){if(states[position].value===input.value){update();return}states.splice(position+1);states.push({value:input.value,start:input.selectionStart,end:input.selectionEnd});if(states.length>80)states.shift();position=states.length-1;update();}
 function wrap(open,close,placeholder,replacement){const start=input.selectionStart,end=input.selectionEnd,selected=replacement??(input.value.slice(start,end)||placeholder);input.setRangeText(open+selected+close,start,end,'end');input.focus();input.setSelectionRange(start+open.length,start+open.length+selected.length);remember();}
 const formats={b:['[b]','[/b]','粗体文字'],i:['[i]','[/i]','斜体文字'],u:['[u]','[/u]','下划线文字'],s:['[s]','[/s]','删除线文字'],quote:['[quote]','[/quote]','引用内容'],code:['[code]','[/code]','代码内容'],list:['[list]\n[*]','\n[/list]','列表内容'],center:['[align=center]','[/align]','居中文字']};
 document.querySelectorAll('[data-editor-format]').forEach(button=>button.addEventListener('click',()=>wrap(...formats[button.dataset.editorFormat])));
 document.querySelectorAll('[data-editor-select]').forEach(select=>select.addEventListener('change',()=>{if(!select.value)return;const tag=select.dataset.editorSelect;wrap('['+tag+'='+select.value+']','[/'+tag+']','文字');select.value='';}));
 previewToggle.addEventListener('click',()=>{preview.hidden=!preview.hidden;previewToggle.setAttribute('aria-expanded',String(!preview.hidden));previewToggle.textContent=preview.hidden?'预览排版':'收起预览';update();});
 const restore=next=>{position=next;const state=states[position];input.value=state.value;input.focus();input.setSelectionRange(state.start,state.end);update();};
 document.querySelector('[data-editor-undo]').addEventListener('click',()=>{if(position>0)restore(position-1)});
 document.querySelector('[data-editor-redo]').addEventListener('click',()=>{if(position<states.length-1)restore(position+1)});
 document.querySelector('[data-editor-clear]').addEventListener('click',()=>{input.value='';remember();input.focus();});
 input.addEventListener('input',remember);
 input.addEventListener('keydown',event=>{if(!(event.ctrlKey||event.metaKey))return;const key=event.key.toLowerCase();if(['b','i','u'].includes(key)){event.preventDefault();wrap(...formats[key]);}else if(key==='z'){event.preventDefault();if(event.shiftKey&&position<states.length-1)restore(position+1);else if(!event.shiftKey&&position>0)restore(position-1);}else if(key==='y'){event.preventDefault();if(position<states.length-1)restore(position+1);}});
 // These local mutations also participate in undo and preview updates.
 document.querySelectorAll('[data-insert-face],[data-quote]').forEach(button=>button.addEventListener('click',remember));
 const linkDialog=document.querySelector('#editor-link-dialog');
 const closeLink=()=>window.ForumMotion?window.ForumMotion.closeDialog(linkDialog):linkDialog.close();
 document.querySelector('[data-editor-link]').addEventListener('click',()=>{document.querySelector('#editor-link-text').value=input.value.slice(input.selectionStart,input.selectionEnd);document.querySelector('#editor-link-error').textContent='';linkDialog.showModal();});
 document.querySelector('[data-close-link]').addEventListener('click',closeLink);
 document.querySelector('#editor-link-form').addEventListener('submit',event=>{event.preventDefault();const url=safeUrl(document.querySelector('#editor-link-url').value);if(!url){document.querySelector('#editor-link-error').textContent='请填写 http、https 地址或本站页面地址。';return}const label=document.querySelector('#editor-link-text').value||url;wrap('[url='+url+']','[/url]',label,label);closeLink();});
 document.querySelector('#editor-attachment').addEventListener('change',event=>{const value=event.target.value;if(!value||!safePhoto(value))return;wrap('[img]','[/img]',value,value);event.target.value='';});
 update();
})();
