(() => {
 'use strict';
 const normalize=s=>String(s||'').normalize('NFKC').trim().toLowerCase();
 function users(list,query,skin='modern'){
  const q=normalize(query),flat=q.replace(/\s/g,''),uid=/^(?:uid\s*[:：#]?\s*)?(\d{8})$/i.exec(q),numeric=/^[\d\s()+.\-‐‑–—]+$/.test(q),digits=q.replace(/\D/g,''),phoneDigits=digits.length===12&&digits.startsWith('86')?digits.slice(2):digits;
  return list.filter(u=>{
   if(skin==='modern'&&u.deactivated)return false;
   if(!q)return true;
   if(uid&&(/^uid/i.test(q)||u.uid===uid[1]))return u.uid===uid[1];
   if(skin==='modern'&&numeric)return false;
   if([u.name,...(u.aliases||[]),u.email||''].some(s=>normalize(s).replace(/\s/g,'').includes(flat)))return true;
   return skin==='classic'&&numeric&&phoneDigits.length>=4&&String(u.phone||'').replace(/\D/g,'').includes(phoneDigits);
  });
 }
 function posts(list,{query='',year='',view='',skin='modern'}={}){const q=normalize(query);return list.filter(t=>(skin==='classic'||!t.authorDeactivated)&&(!q||normalize(t.title+' '+t.author+' '+t.board).includes(q))&&(!year||t.date.startsWith(year))&&(view!=='essence'||t.essence)).sort((a,b)=>b.last.localeCompare(a.last));}
 globalThis.ForumSearchPolicy=Object.freeze({users,posts});
})();
