(() => {
 'use strict';
 const FORMAT='zhengzhou-forum-draft',VERSION=1;
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const norm=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu,'');
 const uid=()=>globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
 const stamp=s=>String(s||'').trim().replace('T',' ').replace(/(\d{2}:\d{2}):00$/,'$1');
 const excerpt=text=>String(text||'').replace(/\[img(?:=[^\]]*)?\][\s\S]*?\[\/img\]/gi,'[图像]').replace(/<img\b[^>]*>/gi,'[图像]').replace(/\[(?:\/?(?:b|i|u|s|quote|code|list|url|color|size|font|align))(?:=[^\]]*)?\]/gi,'').replace(/\s+/g,' ').trim();
 function validDate(s,partial=false){const m=/^(\d{4})-(\d{2})(?:-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?)?$/.exec(s||'');if(typeof s!=='string'||!m||(!partial&&!m[3]))return false;const [y,mo,d,h,mi,se]=m.slice(1).map(Number);if(y<2001||y>2032||mo<1||mo>12||h>23||mi>59||se>59)return false;if(!m[3])return true;return new Date(Date.UTC(y,mo-1,d)).getUTCDate()===d;}
 const timeValue=s=>{s=String(s||'').replace('T',' ');return (s.length===7?s+'-01 00:00':s.length===10?s+' 00:00':s).padEnd(19,':00');};
 const photos=['street','umbrella','radio','meal','plant','tickets','books','bridge','skyline','avenue','police-gate'].map(n=>'assets/photos/'+n+'.png').concat(['assets/photos/box.jpg','assets/photos/tea.jpg','assets/route-sketch.svg','assets/fan-sketch.svg']);
 const faces={'微笑':'smile','偷笑':'grin','汗':'sweat','挠头':'confused','无奈':'sigh','抱拳':'thanks','挥手':'wave','大哭':'cry','生气':'angry','喝茶':'tea','眨眼':'wink','惊讶':'wow'};
 function renderMarkup(text,assetPrefix='',depth=0){
  const plain=s=>escape(s).replace(/\n/g,'<br>').replace(/\[([^\[\]]+)\]/g,(all,label)=>faces[label]?'<img class="emoticon" src="'+escape(assetPrefix+'assets/faces/'+faces[label]+'.svg')+'" width="24" height="26" alt="['+escape(label)+']">':all);
  if(depth>12)return plain(text);let html='',start=0,m;const pattern=/\[(b|i|u|s|quote|code|list|url|img|color|size|font|align)(?:=([^\]\n]*))?\]([\s\S]*?)\[\/\1\]/gi;
  while((m=pattern.exec(String(text||'')))){html+=plain(String(text).slice(start,m.index));start=pattern.lastIndex;const tag=m[1].toLowerCase(),arg=(m[2]||'').trim(),body=m[3],child=()=>renderMarkup(body,assetPrefix,depth+1);
   if(['b','i','u','s'].includes(tag)){const el={b:'strong',i:'em',u:'u',s:'s'}[tag];html+='<'+el+'>'+child()+'</'+el+'>';}
   else if(tag==='quote')html+='<blockquote>'+child()+'</blockquote>';
   else if(tag==='code')html+='<pre><code>'+escape(body)+'</code></pre>';
   else if(tag==='list')html+='<ul>'+body.split('[*]').filter(s=>s.trim()).slice(0,100).map(s=>'<li>'+renderMarkup(s.trim(),assetPrefix,depth+1)+'</li>').join('')+'</ul>';
   else if(tag==='url'){const address=arg||body;html+=/^(?:https?:\/\/[^\s<>"']+|[a-z][a-z0-9-]*\.html(?:[?#][^\s<>"']*)?|#[a-z0-9_-]+)$/i.test(address)?'<a href="'+escape(address.startsWith('http')||address.startsWith('#')?address:assetPrefix+address)+'" rel="noopener noreferrer">'+(arg?child():escape(body))+'</a>':plain(m[0]);}
   else if(tag==='img')html+=(photos.includes(body.trim())||/^assets\/authored\/[a-z0-9-]{8,96}\.(?:png|jpg|webp)$/.test(body.trim()))?'<img class="authored-image" src="'+escape(assetPrefix+body.trim())+'" alt="随帖附件">':plain(m[0]);
   else if(tag==='color')html+=/^#[0-9a-f]{6}$/i.test(arg)?'<span style="color:'+arg+'">'+child()+'</span>':plain(m[0]);
   else if(tag==='size')html+=['12','14','16','18','22'].includes(arg)?'<span style="font-size:'+arg+'px">'+child()+'</span>':plain(m[0]);
   else if(tag==='font')html+=['宋体','黑体','楷体'].includes(arg)?'<span style="font-family:'+arg+'">'+child()+'</span>':plain(m[0]);
   else if(tag==='align')html+=['left','center','right'].includes(arg)?'<div style="text-align:'+arg+'">'+child()+'</div>':plain(m[0]);
  }return html+plain(String(text||'').slice(start));
 }
 function validate(doc,catalog){
  const errors=[],warnings=[],push=(level,path,message)=>({errors,warnings}[level].push({path,message}));
  if(!doc||doc.format!==FORMAT||doc.version!==VERSION)return {errors:[{path:'文件',message:'这不是支持的论坛稿件文件，请从作者编辑器导出 JSON 稿件。'}],warnings};
  if(!Array.isArray(doc.authors)||!Array.isArray(doc.topics)||doc.authors.length>500||doc.topics.length>1000)return {errors:[{path:'文件',message:'作者或主题列表格式不正确，或超过单次导入上限。'}],warnings};
  if(doc.authors.some(a=>!a||typeof a!=='object'||!a.profile||typeof a.profile!=='object')||doc.topics.some(t=>!t||typeof t!=='object'||!Array.isArray(t.replies)||t.replies.some(r=>!r||typeof r!=='object')))return {errors:[{path:'文件',message:'稿件中的作者、主题或回复结构不完整。'}],warnings};
  if(!/^[a-z0-9_-]{8,96}$/i.test(doc.id||''))push('errors','文件','稿件编号无效，请重新导出。');
  if(!doc.authors.length&&!doc.topics.length)push('errors','文件','稿件中没有可导入的作者或主题。');
  const media=doc.media||[];if(!Array.isArray(media)||media.length>100)return {errors:[{path:'配图',message:'配图列表无效或超过 100 张。'}],warnings};
  const mediaPaths=new Set((catalog.media||[]).map(m=>m.path));let mediaBytes=0;for(const m of media){if(!m||!/^assets\/authored\/[a-z0-9-]{8,96}\.(png|jpg|webp)$/.test(m.path||'')||!['image/png','image/jpeg','image/webp'].includes(m.mime)||typeof m.data!=='string'||!/^[A-Za-z0-9+/]*={0,2}$/.test(m.data)||m.data.length>5592410||m.data.length<32||m.nonHuman!==true||typeof m.alt!=='string'||m.alt.length>300){push('errors','配图','图片格式、大小或无人类照片声明不正确。单张图片最多 4 MB。');continue;}mediaBytes+=m.data.length;mediaPaths.add(m.path);}
  if(mediaBytes>28*1024*1024)push('errors','配图','稿件内配图总量超过约 20 MB，请分成多个稿件包。');
  const users=new Map(catalog.users.map(u=>['uid:'+u.uid,u])),profiles=new Map(users),topics=new Map(catalog.topics.map(t=>[t.id,t])),boards=new Set(catalog.boards.map(b=>b.id)),seenRefs=new Set(),seenIds=new Set(),seenKeys=new Set(),existingUids=new Set(catalog.users.map(u=>u.uid));
  if(doc.baseRevision&&doc.baseRevision!==catalog.revision)push('warnings','资料库','资料库已有更新；将逐项核对目标记录，未被改动的稿件仍可导入。');
  for(const a of doc.authors){
   const p=a?.profile||{},key=a?.ref||'',path='作者 '+(p.name||key);if(seenRefs.has(key))push('errors',path,'同一作者在文件中出现了两次。');seenRefs.add(key);
   if(a?.operation==='update'){const current=users.get(key);if(!current)push('errors',path,'要修改的作者不存在。');else if(a.baseHash!==current.revision)push('errors',path,'作者资料已被其他稿件修改，请载入最新资料后合并。');}
   else if(a?.operation==='create'){if(!/^new:[a-z0-9_-]{8,96}$/i.test(key))push('errors',path,'新作者的临时编号无效。');if(a.uid&&(!/^\d{8}$/.test(a.uid)||existingUids.has(a.uid)))push('errors',path,'指定 UID 必须是未使用的八位数字；留空可由主站分配。');if(a.uid)existingUids.add(a.uid);}
   else push('errors',path,'作者操作必须是新建或修改。');
   if(typeof p.name!=='string'||!p.name.trim()||p.name.length>32||/[<>\x00-\x1f]/.test(p.name))push('errors',path,'昵称须为 1–32 个字符，且不能包含标签或控制字符。');
   if(!validDate(p.joined)||p.joined.length!==10)push('errors',path,'注册日期须为 2001–2032 年范围内的有效日期。');
   if(!['full','partial','default'].includes(p.profile))push('errors',path,'请选择完整、部分或默认资料样式。');
   if(p.phone&&!/^\d{10}$/.test(String(p.phone).replace(/[\s-]/g,'')))push('errors',path,'联系电话应为十位虚构号码。');
   if(p.email&&!/^[^\s@<>]+@[^\s@<>]+\.invalid$/i.test(p.email))push('errors',path,'邮箱须使用不可投递的 .invalid 域名。');
   if(p.aliases&&(!Array.isArray(p.aliases)||p.aliases.length>20||p.aliases.some(s=>typeof s!=='string'||s.length>64)))push('errors',path,'别名须为不超过 20 项的文字列表。');
   for(const field of ['signature','bio','interest','district','level'])if(p[field]!==undefined&&(typeof p[field]!=='string'||p[field].length>5000))push('errors',path,'资料字段过长或格式不正确：'+field);
   if(p.level&&!new Set(['普通会员',...catalog.users.map(u=>u.level)]).has(p.level))push('errors',path,'用户等级不在可选列表中，请从下拉菜单选择。');
   if(p.avatarChoice&&!/^(?:keep|default|pattern:(?:[0-9]|1[0-9]|2[0-3]))$/.test(p.avatarChoice))push('errors',path,'头像选项无效。');
   if(p.deactivated!==undefined&&typeof p.deactivated!=='boolean')push('errors',path,'注销状态格式不正确。');
   if(p.points!==undefined&&(!Number.isSafeInteger(p.points)||p.points<0||p.points>99999999))push('errors',path,'积分须为 0–99999999 的整数。');
   profiles.set(key,{...users.get(key),...p,uid:a.uid||users.get(key)?.uid||'',ref:key});
   const duplicate=catalog.users.find(u=>norm(u.name)===norm(p.name)&&'uid:'+u.uid!==key);if(duplicate)push('warnings',path,'昵称与 UID '+duplicate.uid+' 相同，请确认是不同账号。');
  }
  const draftTitles=new Map(),titleIndex=new Map(),bodyIndex=new Map();for(const existing of catalog.topics){const title=norm(existing.title),body=norm(existing.body);if(!titleIndex.has(title))titleIndex.set(title,[]);titleIndex.get(title).push(existing);if(!bodyIndex.has(body))bodyIndex.set(body,[]);bodyIndex.get(body).push(existing);}
  const authorDate=(ref,when,path)=>{const u=profiles.get(ref);if(typeof ref!=='string'||!u){push('errors',path,'请选择资料库中或当前稿件中已建立的作者。');return;}if(validDate(when,true)&&u.joined&&(when.length===7?u.joined.slice(0,7)>when:u.joined>when.slice(0,10)))push('errors',path,'发布时间早于该作者的注册日期 '+u.joined+'。');};
  for(const t of doc.topics){
   const path='主题 '+(t?.title||t?.key||''),current=topics.get(t?.threadId);if(!t||!/^topic-[a-z0-9_-]{6,96}$/i.test(t.key||'')){push('errors',path,'主题草稿编号无效。');continue;}
   if(seenKeys.has(t.key))push('errors',path,'主题草稿编号重复。');seenKeys.add(t.key);
   if(t.operation==='update'){if(!current)push('errors',path,'要修改的主题不存在。');else if(t.baseHash!==current.revision)push('errors',path,'主题已被其他稿件修改，请载入最新正文后合并。');if(seenIds.has(t.threadId))push('errors',path,'同一主题有两项修改，无法确定应保留哪一项。');seenIds.add(t.threadId);if(current?.protected)push('warnings',path,'此主题属于既有剧情或历史档案，请核对原文和时间后再导入。');}
   else if(t.operation!=='create')push('errors',path,'主题操作必须是新建或修改。');
   if(draftTitles.has(norm(t.title)))push('warnings',path,'当前稿件包内还有相同标题的主题，请确认没有重复。');draftTitles.set(norm(t.title),true);
   if(typeof t.title!=='string'||!t.title.trim()||t.title.length>160)push('errors',path,'标题须为 1–160 个字符。');
   if(typeof t.body!=='string'||t.body.length>50000||(!t.flags?.deleted&&!t.body.trim()))push('errors',path,'请填写正文，单篇正文不能超过 50,000 个字符。');
   for(const text of [t.body,...(t.replies||[]).map(r=>r.body)])for(const match of String(text||'').matchAll(/\[img\](.*?)\[\/img\]/gi))if(!photos.includes(match[1])&&!mediaPaths.has(match[1]))push('errors',path,'正文引用的配图未随稿件保存：'+match[1]);
   if(!boards.has(t.board))push('errors',path,'所属版块不存在。');
   if(t.views!==undefined&&(!Number.isSafeInteger(t.views)||t.views<0||t.views>999999999))push('errors',path,'浏览量须为 0–999999999 的整数。');
   if(!validDate(t.publishedAt,t.operation==='update'))push('errors',path,'请填写 2001–2032 年范围内的有效发布时间。');authorDate(t.author,t.publishedAt,path);
   if(String(t.publishedAt).slice(0,10)>catalog.snapshotDate)push('warnings',path,'发布时间晚于站点当前日期 '+catalog.snapshotDate+'，请确认时间安排。');
   if(profiles.get(t.author)?.deactivated)push('warnings',path,'作者目前为已注销账号，请确认这是需要补录的历史内容。');
   if(!t.flags||typeof t.flags!=='object')push('errors',path,'主题状态无效。');else {for(const flag of ['essence','pinned','locked','deleted','commentsClosed'])if(typeof t.flags[flag]!=='boolean')push('errors',path,'状态字段必须为勾选值：'+flag);if(t.flags.commentsClosed&&!t.flags.locked)push('errors',path,'关闭评论的主题同时需要设为锁定。');}
   if(!Array.isArray(t.replies)||t.replies.length>1000){push('errors',path,'回复列表格式不正确或超过上限。');continue;}
   if(t.flags?.commentsClosed&&t.replies.length)push('errors',path,'关闭评论的主题不能包含回复。若需要历史回复，请取消关闭评论，仅保留锁定。');
   if(t.flags?.deleted&&t.replies.length)push('warnings',path,'主题设为删除状态，正文及回复不会公开显示。');
   const prior=new Set(['op']),replyKeys=new Set();let previous=t.publishedAt;
   for(const [i,r] of t.replies.entries()){const rp=path+'／回复 '+(i+1);if(!r||typeof r.key!=='string'||replyKeys.has(r.key))push('errors',rp,'回复编号无效或重复。');replyKeys.add(r?.key);if(!validDate(r?.publishedAt,t.operation==='update'))push('errors',rp,'回复时间无效。');authorDate(r?.author,r?.publishedAt,rp);if(timeValue(r?.publishedAt)<timeValue(previous))push('errors',rp,'回复时间不能早于主题或前一条回复。');previous=r?.publishedAt;if(typeof r?.body!=='string'||!r.body.trim()||r.body.length>50000)push('errors',rp,'回复须包含正文，且不能超过 50,000 个字符。');if(r?.quoteRef&&!prior.has(r.quoteRef))push('errors',rp,'引用对象不存在或位于当前回复之后。');prior.add(r?.key);}
   const duplicates=(titleIndex.get(norm(t.title))||[]).filter(x=>x.id!==t.threadId);if(duplicates.length)push('warnings',path,'标题与现有主题 #'+duplicates[0].id+' 相同，请确认不是重复导入。');
   const bodyKey=norm(t.body);if(bodyKey.length>24){const duplicate=(bodyIndex.get(bodyKey)||[]).find(x=>x.id!==t.threadId);if(duplicate)push('warnings',path,'正文与现有主题 #'+duplicate.id+' 完全相同。');}
  }
  // A profile edit must not invalidate dates of already-published material.
  for(const a of doc.authors.filter(a=>a.operation==='update')){const p=profiles.get(a.ref);for(const t of catalog.topics){const replacement=doc.topics.find(x=>x.operation==='update'&&x.threadId===t.id);const rows=replacement?[{author:replacement.author,when:replacement.publishedAt},...replacement.replies.map(r=>({author:r.author,when:r.publishedAt}))]:[{author:'uid:'+t.authorUid,when:t.publishedAt},...t.replies.map(r=>({author:'uid:'+r.authorUid,when:r.publishedAt}))];if(rows.some(r=>r.author===a.ref&&(String(r.when).length===7?p.joined.slice(0,7)>String(r.when):p.joined>String(r.when).slice(0,10)))){push('errors','作者 '+p.name,'新的注册日期晚于现有主题 #'+t.id+' 的发言时间。');break;}}}
  return {errors,warnings};
 }
 globalThis.ForumAuthoring=Object.freeze({FORMAT,VERSION,escape,norm,uid,stamp,validDate,timeValue,photos,excerpt,renderMarkup,validate});
})();
