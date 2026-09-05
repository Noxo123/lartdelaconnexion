(()=>{'use strict';
const app=document.getElementById('app');
let busy=false;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const qs=(s,r=document)=>r.querySelector(s);
const qsa=(s,r=document)=>[...r.querySelectorAll(s)];
function initials(name){return String(name||'').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'LC'}
function enhance(){
 if(busy||location.pathname!=='/espace')return;
 const dash=qs('.dashboard');
 if(!dash||dash.dataset.workspace==='1')return;
 busy=true;dash.dataset.workspace='1';
 const head=qs('.dashboard-head',dash), profile=qs('.profile-card',dash), grid=qs('.dashboard-grid',dash);
 if(!head||!grid){busy=false;return}
 const title=qs('h1',head)?.textContent||'Bonjour';
 const subtitle=qs('p',head)?.textContent||'';
 const owner=title.toLowerCase().includes('bonjour')&&!!qs('.stats',dash);
 const stats=qsa('.stat',dash);
 const list=qs('.panel:not(.profile-card)',grid);
 const listTitle=qs('.panel-head h2',list)?.textContent||'Mes consultations';
 const count=qs('.panel-head .form-note',list)?.textContent||'';
 const profileName=qs('.profile-card h3',dash)?.textContent||title.replace(/^Bonjour\s*/i,'');
 const email=qs('.profile-card p',dash)?.textContent||'';
 const role=qs('.profile-card .badge',dash)?.textContent||'';
 const originalList=list?.querySelector('.consultation-list');
 const listHTML=originalList?originalList.outerHTML:'<div class="consultation-list"><div class="empty">Aucune consultation.</div></div>';
 const profileActions=qsa('.profile-card button',dash).map(b=>b.outerHTML).join('');
 const avatar=qs('.avatar',dash)?.textContent||initials(profileName);
 dash.innerHTML=`<div class="space-shell ${owner?'is-owner':'is-client'}">
   <aside class="space-sidebar">
    <div class="space-brand"><div class="space-brand-icon">✦</div><div><strong>L'Art de la Connexion</strong><span>${owner?'Espace professionnel':'Espace personnel'}</span></div></div>
    <div class="space-user"><div class="space-avatar">${esc(avatar)}</div><div><strong>${esc(profileName)}</strong><span>${esc(role||'Client')}</span></div></div>
    <nav class="space-nav" aria-label="Navigation de l'espace">
      <button class="space-nav-item active" data-space-tab="home"><span>⌂</span> Vue d'ensemble</button>
      <button class="space-nav-item" data-space-tab="consultations"><span>◷</span> ${owner?'Consultations':'Mes rendez-vous'}</button>
      <button class="space-nav-item" data-space-tab="profile"><span>◉</span> Mon profil</button>
      ${owner?'<a class="space-nav-item" href="/admin" data-link><span>⌘</span> Administration</a>':''}
    </nav>
    <div class="space-sidebar-bottom">${profileActions}</div>
   </aside>
   <main class="space-main">
    <header class="space-topbar"><div><span class="space-kicker">${owner?'TABLEAU DE BORD PROFESSIONNEL':'VOTRE ESPACE PRIVÉ'}</span><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div><div class="space-top-actions">${owner?'<a class="button button-small" href="/admin" data-link>Centre de contrôle →</a>':'<button class="button button-small" id="spaceBook">+ Nouvelle réservation</button>'}</div></header>
    ${owner?`<section class="space-kpis">${stats.map((s,i)=>`<article class="space-kpi"><span>${esc(qs('span',s)?.textContent||'Indicateur')}</span><strong>${esc(qs('strong',s)?.textContent||'—')}</strong><small>${['Votre activité','Prochaines séances','Revenus terminés'][i]||'En temps réel'}</small><i>${['↗','◷','€'][i]||'✦'}</i></article>`).join('')}</section>`:`<section class="space-welcome"><div><span class="space-kicker">Bienvenue dans votre espace</span><h2>Tout votre parcours, au même endroit.</h2><p>Réservez une séance, retrouvez vos rendez-vous et rejoignez votre consultation depuis un espace simple et confidentiel.</p><div class="space-quick"><button class="button button-small" id="spaceBook">Réserver une consultation</button><button class="button button-small button-secondary" data-space-tab="consultations">Voir mes rendez-vous</button></div></div><div class="space-orbit"><span>✦</span><b>Confidentiel</b><small>Votre espace privé</small></div></section>`}
    <section class="space-content" data-space-panel="home"><div class="space-section-head"><div><span class="space-kicker">${owner?'ACTIVITÉ RÉCENTE':'VOS RENDEZ-VOUS'}</span><h2>${esc(listTitle)}</h2></div><span class="space-count">${esc(count)}</span></div><div class="space-list-wrap">${listHTML}</div></section>
    <section class="space-content is-hidden" data-space-panel="consultations"><div class="space-section-head"><div><span class="space-kicker">AGENDA</span><h2>${owner?'Toutes les consultations':'Mes rendez-vous'}</h2></div></div><div class="space-list-wrap">${listHTML}</div></section>
    <section class="space-content is-hidden" data-space-panel="profile"><div class="space-section-head"><div><span class="space-kicker">VOS INFORMATIONS</span><h2>Mon profil</h2></div></div><div class="space-profile-card"><div class="space-avatar large">${esc(avatar)}</div><div><h3>${esc(profileName)}</h3><p>${esc(email)}</p><span class="space-role">${esc(role||'Client')}</span></div><div class="space-profile-action">${qs('.profile-card button',dash)?.outerHTML||''}</div></div></section>
   </main>
 </div>`;
 // Reuse the original dashboard's event-driven controls before replacing it was impossible, so reconnect the useful buttons to their existing global functions.
 const book=qs('#spaceBook',dash);if(book)book.onclick=()=>{const fn=window.__LADC_BOOKING; if(fn)fn(); else qsa('.dashboard button').find(b=>/réserver/i.test(b.textContent))?.click()};
 qsa('[data-space-tab]',dash).forEach(b=>b.addEventListener('click',e=>{const tab=e.currentTarget.dataset.spaceTab;if(tab==='consultations'||tab==='profile'||tab==='home'){qsa('[data-space-panel]',dash).forEach(p=>p.classList.toggle('is-hidden',p.dataset.spacePanel!==tab));qsa('.space-nav-item[data-space-tab]',dash).forEach(x=>x.classList.toggle('active',x.dataset.spaceTab===tab));qsa('.space-content:not(.is-hidden) .consultation [data-join],.space-content:not(.is-hidden) .consultation [data-pay],.space-content:not(.is-hidden) [data-status]').forEach(x=>{if(x.dataset.join)x.onclick=()=>location.href='/consultation/'+x.dataset.join});}}));
 busy=false;
}
new MutationObserver(()=>requestAnimationFrame(enhance)).observe(app,{childList:true,subtree:true});
setTimeout(enhance,250);
})();