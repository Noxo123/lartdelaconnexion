(()=>{
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=c=>new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format((Number(c)||0)/100);
  let csrf=null,lastChatId=null,adminServicesLoading=false;
  async function api(url,opt={}){
    const r=await fetch(url,{credentials:'same-origin',...opt,headers:{...(opt.headers||{}),...(opt.body?{'Content-Type':'application/json'}:{})}});
    const text=await r.text();let d;try{d=JSON.parse(text)}catch{throw new Error(text||`HTTP ${r.status}`)}
    if(!r.ok)throw new Error(d.error||`HTTP ${r.status}`);return d;
  }
  async function token(){if(csrf)return csrf;const d=await api('/api/csrf');return csrf=d.csrfToken}
  async function post(url,body){return api(url,{method:'POST',headers:{'x-csrf-token':await token()},body:JSON.stringify(body)})}
  function serviceRow(s){return `<article class="commerce-service-row"><div class="commerce-service-icon">✦</div><div class="commerce-service-main"><div class="commerce-service-title"><strong>${esc(s.name)}</strong><span class="badge ${s.active?'badge-success':'badge-muted'}">${s.active?'Active':'Inactive'}</span></div><p>${esc(s.description||'Aucune description.')}</p><div class="commerce-service-meta"><span>${Number(s.duration)||0} min</span><strong>${money(s.price_cents)}</strong></div></div><div class="commerce-service-actions"><button class="button button-small button-secondary" data-edit-service="${s.id}">Modifier</button></div></article>`}
  async function renderServiceList(){const box=document.getElementById('commerceServices');if(!box)return;try{const d=await api('/api/admin/services');box._services=d.services;const list=box.querySelector('.commerce-services-list');if(list)list.innerHTML=d.services.map(serviceRow).join('')||'<div class="form-note">Aucune formule.</div>';bindServiceButtons(box)}catch(e){const list=box.querySelector('.commerce-services-list');if(list)list.innerHTML=`<div class="form-note">${esc(e.message)}</div>`}}
  function openServiceModal(service=null){
    document.getElementById('commerceServiceModal')?.remove();
    const s=service||{id:'',name:'',description:'',duration:60,price_cents:6000,active:1};
    const modal=document.createElement('div');modal.className='modal commerce-service-modal';modal.id='commerceServiceModal';
    modal.innerHTML=`<div class="modal-card"><div class="modal-head"><div><h3>${service?'Modifier la formule':'Nouvelle formule'}</h3><span class="form-note">Cette formule sera proposée directement lors de la réservation.</span></div><button class="modal-close" type="button" aria-label="Fermer">×</button></div><form class="commerce-service-form"><label class="field"><span>Nom</span><input name="name" required maxlength="120" value="${esc(s.name)}"></label><label class="field"><span>Description</span><textarea name="description" maxlength="500" rows="3">${esc(s.description)}</textarea></label><div class="form-grid"><label class="field"><span>Durée (minutes)</span><input name="duration" type="number" min="15" max="480" step="15" required value="${Number(s.duration)||60}"></label><label class="field"><span>Prix (€)</span><input name="price" type="number" min="0" max="5000" step="0.01" required value="${((Number(s.price_cents)||0)/100).toFixed(2)}"></label></div><label class="field"><span>Statut</span><select name="active"><option value="1" ${s.active?'selected':''}>Active</option><option value="0" ${!s.active?'selected':''}>Inactive</option></select></label><div class="commerce-service-form-actions"><button class="button button-secondary" type="button" data-close-service>Annuler</button><button class="button" type="submit">${service?'Enregistrer':'Créer la formule'}</button></div></form></div>`;
    document.body.appendChild(modal);
    const close=()=>modal.remove();modal.querySelector('.modal-close').onclick=close;modal.querySelector('[data-close-service]').onclick=close;
    modal.addEventListener('click',e=>{if(e.target===modal)close()});
    modal.querySelector('form').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.currentTarget);const payload={name:f.get('name'),description:f.get('description'),duration:Number(f.get('duration')),price_cents:Math.round(Number(f.get('price'))*100),active:Number(f.get('active'))};try{await api(service?`/api/admin/services/${service.id}`:'/api/admin/services',{method:service?'PATCH':'POST',headers:{'x-csrf-token':await token(),'Content-Type':'application/json'},body:JSON.stringify(payload)});close();await renderServiceList()}catch(err){alert(err.message)}};
  }
  function bindServiceButtons(box){box.querySelector('#newService')?.addEventListener('click',()=>openServiceModal());box.querySelectorAll('[data-edit-service]').forEach(b=>b.addEventListener('click',()=>openServiceModal((box._services||[]).find(s=>String(s.id)===String(b.dataset.editService)))))}
  function placeServicesBesideAvailability(app,box){const availability=[...app.querySelectorAll('.panel')].find(panel=>panel.querySelector('.panel-head h2')?.textContent?.trim()==='Disponibilités');if(!availability){app.appendChild(box);return}availability.parentNode.insertBefore(box,availability.nextSibling)}
  async function adminServices(){
    if(location.pathname!=='/admin')return;
    const app=document.getElementById('app');if(!app)return;
    const existing=[...app.querySelectorAll('#commerceServices')];
    if(existing.length){existing.slice(1).forEach(x=>x.remove());return}
    if(adminServicesLoading)return;
    adminServicesLoading=true;
    try{
      const d=await api('/api/admin/services');
      if(app.querySelector('#commerceServices'))return;
      const box=document.createElement('section');box.className='panel commerce-services';box.id='commerceServices';
      box.innerHTML=`<div class="panel-head commerce-services-head"><div><h2>Formules de consultation</h2><span class="form-note">Les modifications sont utilisées immédiatement dans les réservations clients.</span></div><button class="button button-small" id="newService">+ Nouvelle formule</button></div><div class="commerce-services-list">${d.services.map(serviceRow).join('')||'<div class="form-note">Aucune formule.</div>'}</div>`;
      placeServicesBesideAvailability(app,box);box._services=d.services;bindServiceButtons(box)
    }catch(e){console.error('Formules de consultation:',e)}finally{adminServicesLoading=false}
  }
  async function clientRevenue(){if(location.pathname!=='/admin')return;try{const d=await api('/api/admin/clients/revenue');document.querySelectorAll('[data-client-email]').forEach(card=>{const email=card.dataset.clientEmail?.toLowerCase();const c=d.clients?.find(x=>String(x.email).toLowerCase()===email);let el=card.querySelector('.client-paid-total');if(!el){el=document.createElement('div');el.className='client-paid-total';card.appendChild(el)}el.textContent=`${money(c?.totalCents||0)} payé`})}catch(e){}}
  function addMoneyButton(){if(!window.__ladcUserRole||window.__ladcUserRole==='owner'||window.__ladcUserRole==='admin')return;const modal=document.querySelector('.chat-modal,.chat-dialog,[role="dialog"]');if(!modal||modal.querySelector('[data-send-money]'))return;const id=lastChatId;if(!id)return;const actions=modal.querySelector('.chat-actions,.modal-actions,.chat-head');if(!actions)return;const b=document.createElement('button');b.className='button button-small button-secondary';b.dataset.sendMoney='1';b.innerHTML='€ Envoyer de l’argent';b.onclick=async()=>{const amount=prompt('Montant à envoyer (€)','10');const n=Number(amount);if(!Number.isFinite(n)||n<1||n>500)return;try{const d=await post(`/api/chat/${encodeURIComponent(id)}/transfers`,{amount:n});if(d.approvalUrl)window.location.href=d.approvalUrl;else if(d.orderId)window.location.href=`/espace?transferOrder=transfer-${d.transferId||''}`}catch(e){alert(e.message)}};actions.appendChild(b)}
  async function autoCapture(){const key=new URLSearchParams(location.search).get('transferOrder');if(!key)return;try{await post(`/api/chat/transfers/${encodeURIComponent(key)}/capture`,{});history.replaceState({},'',location.pathname+location.hash)}catch(e){console.error(e)}}
  const obs=new MutationObserver(()=>{addMoneyButton();if(location.pathname==='/admin'&&!document.getElementById('commerceServices'))adminServices()});obs.observe(document.body,{childList:true,subtree:true});
  setInterval(clientRevenue,5000);setTimeout(()=>{autoCapture();adminServices();clientRevenue();addMoneyButton()},700);
  window.LADCCommerce={addMoneyButton,openServiceModal,renderServiceList};
})();