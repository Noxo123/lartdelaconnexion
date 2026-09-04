(()=>{
'use strict';
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
let mounted=false,refreshTimer=null;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=c=>new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(Number(c||0)/100);
const toast=t=>window.toast?window.toast(t):console.warn(t);
function panelByTitle(title){return $$('.panel').find(p=>p.querySelector('.panel-head h2')?.textContent?.trim()===title)}
function makeShell(){
 const app=$('#app');if(!app||location.pathname!=='/admin'||mounted)return false;
 const dashboard=app.querySelector('.dashboard');if(!dashboard)return false;
 mounted=true;
 const stats=dashboard.querySelector('.stats');
 const profile=dashboard.querySelector('.profile-card');
 const consultationPanel=[...dashboard.querySelectorAll('.panel')].find(p=>p!==profile&&p.querySelector('.panel-head h2'));
 const calendar=app.querySelector('.ladc-calendar-owner');
 const services=app.querySelector('#commerceServices');
 const oldAvailability=panelByTitle('Disponibilités');
 oldAvailability?.remove();
 const clientSource=consultationPanel;
 const shell=document.createElement('div');shell.className='admin-shell';
 shell.innerHTML=`<aside class="admin-sidebar"><div class="admin-sidebar-brand"><b>L'Art de la Connexion</b><span>Centre de contrôle</span></div><nav class="admin-nav" aria-label="Administration"><button class="is-active" data-admin-view="overview"><i class="admin-nav-icon">⌂</i><span>Vue d'ensemble</span></button><button data-admin-view="agenda"><i class="admin-nav-icon">◷</i><span>Agenda</span></button><button data-admin-view="consultations"><i class="admin-nav-icon">✓</i><span>Consultations</span></button><button data-admin-view="clients"><i class="admin-nav-icon">♙</i><span>Clients</span></button><button data-admin-view="services"><i class="admin-nav-icon">✦</i><span>Formules</span></button></nav></aside><main class="admin-main"><div class="admin-topbar"><div class="admin-title"><span class="section-kicker">ESPACE PROPRIÉTAIRE</span><h1>Centre de contrôle</h1><p>Tout piloter depuis un seul espace, sans perdre de temps.</p></div><div class="admin-top-actions"><span class="admin-status"><i></i> Système opérationnel</span><button class="button button-small button-secondary" id="adminRefresh">Actualiser</button></div></div><div class="admin-kpis" id="adminKpis"></div><section class="admin-view is-active" data-admin-section="overview"><div class="admin-overview-grid"><div class="admin-card"><div class="admin-card-head"><div><h2>Activité récente</h2><p>Les prochains rendez-vous à surveiller.</p></div><button class="button button-small button-secondary" data-admin-go="consultations">Voir tout</button></div><div class="admin-preview" id="adminUpcoming"></div></div><div class="admin-card"><div class="admin-card-head"><div><h2>Accès rapide</h2><p>Les actions les plus utilisées.</p></div></div><div class="admin-preview"><div class="admin-preview-row"><div class="admin-preview-main"><b>Gérer les horaires</b><span>Disponibilités et périodes bloquées</span></div><button class="button button-small" data-admin-go="agenda">Ouvrir</button></div><div class="admin-preview-row"><div class="admin-preview-main"><b>Formules</b><span>Prix et durées de consultation</span></div><button class="button button-small" data-admin-go="services">Gérer</button></div><div class="admin-preview-row"><div class="admin-preview-main"><b>Clients</b><span>Suivi et chiffre d'affaires</span></div><button class="button button-small" data-admin-go="clients">Ouvrir</button></div></div></div></div></section><section class="admin-view" data-admin-section="agenda"></section><section class="admin-view" data-admin-section="consultations"></section><section class="admin-view" data-admin-section="clients"><div class="admin-client-toolbar"><div><h2 style="margin:0">Clients</h2><p class="form-note">Vue synthétique des clients et de leurs paiements.</p></div><input class="admin-client-search" id="adminClientSearch" type="search" placeholder="Rechercher un client…" autocomplete="off"></div><div class="admin-client-list" id="adminClientList"></div></section><section class="admin-view" data-admin-section="services"></section></main></div>`;
 const kpi=()=>{const raw=[...(stats?.querySelectorAll('.stat')||[])].map(x=>({value:x.querySelector('strong')?.textContent||'0',label:x.querySelector('span')?.textContent||''}));return raw};
 dashboard.replaceWith(shell);
 const k=kpi();$('#adminKpis').innerHTML=(k.length?k:[{value:'—',label:'Clients'},{value:'—',label:'À venir'},{value:'—',label:'Chiffre terminé'}]).slice(0,4).map(x=>`<div class="admin-kpi"><small>${esc(x.label)}</small><strong>${esc(x.value)}</strong><span>Mis à jour automatiquement</span></div>`).join('');
 if(calendar){$('[data-admin-section="agenda"]').appendChild(calendar)}
 if(consultationPanel){$('[data-admin-section="consultations"]').appendChild(consultationPanel)}
 if(services){$('[data-admin-section="services"]').appendChild(services)}
 if(profile){profile.style.display='none'}
 bindNav();renderUpcoming(consultationPanel);renderClients(consultationPanel);setTimeout(()=>{window.LADCCommerce?.renderServiceList?.()},0);
 return true;
}
function bindNav(){
 $$('.admin-nav button').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.adminView)));
 $$('[data-admin-go]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.adminGo)));
 $('#adminRefresh')?.addEventListener('click',async()=>{const b=$('#adminRefresh');b.disabled=true;b.classList.add('is-loading');try{location.reload()}finally{setTimeout(()=>{b.disabled=false;b.classList.remove('is-loading')},1000)}});
 $('#adminClientSearch')?.addEventListener('input',e=>filterClients(e.target.value));
}
function showView(name){$$('[data-admin-section]').forEach(s=>s.classList.toggle('is-active',s.dataset.adminSection===name));$$('[data-admin-view]').forEach(b=>b.classList.toggle('is-active',b.dataset.adminView===name));if(name==='clients')filterClients($('#adminClientSearch')?.value||'');if(name==='services')window.LADCCommerce?.renderServiceList?.()}
function renderUpcoming(panel){const box=$('#adminUpcoming');if(!box)return;const rows=$$('.consultation',panel||document);if(!rows.length){box.innerHTML='<div class="admin-empty">Aucun rendez-vous pour le moment.</div>';return}box.innerHTML=rows.slice(0,5).map(row=>{const h=row.querySelector('h3')?.textContent||'Consultation';const p=row.querySelector('p')?.textContent||'';const badge=row.querySelector('.consultation-meta .badge')?.outerHTML||'';return `<div class="admin-preview-row"><div class="admin-preview-main"><b>${esc(h)}</b><span>${esc(p.split('\n')[0]).slice(0,120)}</span></div>${badge}</div>`}).join('')}
function clientData(panel){const map=new Map();$$('.consultation',panel||document).forEach(row=>{const text=row.querySelector('p')?.textContent||'';const email=(text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)||[''])[0].toLowerCase();if(!email)return;const strong=row.querySelector('p b')?.textContent||email;const name=strong.replace(/\s+·\s*$/,'');const paid=row.querySelector('[data-client-paid]')?.textContent||'0 € payé';const key=email;const existing=map.get(key)||{email,name,paid,appointments:0};existing.appointments++;if(paid!=='0 € payé')existing.paid=paid;map.set(key,existing)});return [...map.values()]}
function renderClients(panel){const list=$('#adminClientList');if(!list)return;const clients=clientData(panel);list.innerHTML=clients.length?clients.map(c=>`<article class="admin-client" data-client-search="${esc((c.name+' '+c.email).toLowerCase())}"><div class="admin-client-id"><div class="admin-client-avatar">${esc((c.name.match(/[A-ZÀ-ÖØ-Þ]/gi)||['?']).slice(0,2).join(''))}</div><b>${esc(c.name)}</b><span>${esc(c.email)} · ${c.appointments} rendez-vous</span></div><div class="admin-client-meta"><strong>${esc(c.paid)}</strong><span>paiements</span></div></article>`).join(''):'<div class="admin-empty">Aucun client à afficher.</div>'}
function filterClients(q){const term=String(q||'').trim().toLowerCase();$$('.admin-client').forEach(x=>x.style.display=!term||x.dataset.clientSearch.includes(term)?'flex':'none')}
function boot(){if(location.pathname!=='/admin'){mounted=false;return}if(makeShell())return;setTimeout(boot,180)}
new MutationObserver(()=>{if(location.pathname==='/admin'&&!mounted)boot()}).observe(document.body,{childList:true,subtree:true});
window.addEventListener('ladc:calendar-booked',()=>setTimeout(boot,100));
setTimeout(boot,300);
})();