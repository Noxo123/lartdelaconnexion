(()=>{
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let csrf=null,active=null,timer=null,lastId=0,loading=false;
  async function token(){
    if(!csrf){
      const r=await fetch('/api/csrf',{credentials:'same-origin'});
      if(!r.ok)throw Error('Impossible de sécuriser la messagerie.');
      csrf=(await r.json()).csrfToken;
    }
    return csrf;
  }
  async function request(url,opt={}){
    const o={...opt,credentials:'same-origin',headers:{...(opt.headers||{})}};
    if(o.body&&!(o.body instanceof FormData)){o.headers['content-type']='application/json';o.body=JSON.stringify(o.body)}
    if((o.method||'GET').toUpperCase()!=='GET')o.headers['x-csrf-token']=await token();
    const r=await fetch(url,o);let d={};try{d=await r.json()}catch{}
    if(!r.ok)throw Error(d.error||'Impossible de contacter la messagerie.');
    return d;
  }
  async function ensureIdentity(){
    if(window.__ladcUserId!=null)return;
    const d=await request('/api/me');
    window.__ladcUserId=d.user?.id??null;
  }
  function injectButtons(){
    document.querySelectorAll('.consultation').forEach(card=>{
      if(card.querySelector('[data-chat]'))return;
      const join=card.querySelector('[data-join]');
      const id=join?.dataset.join||card.querySelector('[data-status]')?.dataset.status||card.querySelector('[data-pay]')?.dataset.pay;
      if(!/^\d+$/.test(String(id||'')))return;
      const actions=card.querySelector('.owner-actions');
      if(actions)actions.insertAdjacentHTML('afterbegin',`<button class="button button-small button-chat" data-chat="${esc(id)}">💬 Chat</button>`);
    });
  }
  async function openChat(id){
    if(!/^\d+$/.test(String(id||'')))return;
    active=String(id);lastId=0;clearInterval(timer);
    document.getElementById('chatModal')?.remove();
    document.body.insertAdjacentHTML('beforeend',`<div class="chat-modal" id="chatModal"><div class="chat-window"><header class="chat-head"><div><span class="section-kicker">Conversation privée</span><h2>Conversation avec L'Art de la Connexion</h2><p>Échangez par message et envoyez des images en toute confidentialité.</p></div><button class="icon-button" id="chatClose" aria-label="Fermer">×</button></header><div class="chat-body" id="chatBody"><div class="chat-empty">Chargement de la conversation…</div></div><div class="chat-drop" id="chatDrop"><img src="/illustration-chat.svg" alt="" aria-hidden="true"><div><strong>Glissez une image ici</strong><span>JPG, PNG, WEBP ou GIF · 8 Mo max</span></div><button type="button" class="button button-small" id="chatPick">Choisir une image</button><input id="chatFile" type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden></div><form class="chat-compose" id="chatForm"><textarea id="chatInput" maxlength="3000" rows="1" placeholder="Écrivez votre message…" required></textarea><button class="button" type="submit">Envoyer</button></form></div></div>`);
    const modal=document.getElementById('chatModal'),body=document.getElementById('chatBody'),input=document.getElementById('chatInput'),drop=document.getElementById('chatDrop'),file=document.getElementById('chatFile');
    const close=()=>{clearInterval(timer);modal.remove();active=null};
    document.getElementById('chatClose').onclick=close;
    modal.addEventListener('click',e=>{if(e.target===modal)close()});
    function render(messages){
      if(!messages.length&&lastId===0){body.innerHTML='<div class="chat-empty">Aucun message pour le moment.<br><span>Vous pouvez commencer la conversation.</span></div>';return}
      messages.forEach(m=>{
        const mine=Number(m.senderId)===Number(window.__ladcUserId);
        const node=document.createElement('article');node.className='chat-message '+(mine?'mine':'theirs');
        const image=m.attachment?`<a class="chat-image" href="${esc(m.attachment.url)}" target="_blank" rel="noopener"><img src="${esc(m.attachment.url)}" alt="${esc(m.attachment.name||'Image envoyée')}" loading="lazy"><span>Ouvrir l'image</span></a>`:'';
        node.innerHTML=`<div class="chat-bubble">${m.body?`<p>${esc(m.body).replace(/\n/g,'<br>')}</p>`:''}${image}<time>${new Intl.DateTimeFormat('fr-FR',{dateStyle:'short',timeStyle:'short'}).format(new Date(m.createdAt))}</time></div>`;
        const img=node.querySelector('img');
        if(img)img.addEventListener('error',()=>{img.closest('.chat-image').classList.add('chat-image-error');img.replaceWith(Object.assign(document.createElement('span'),{textContent:'Image indisponible'}))},{once:true});
        body.appendChild(node);lastId=Math.max(lastId,Number(m.id));
      });
      body.scrollTop=body.scrollHeight;
    }
    async function load(){
      if(loading||!active)return;
      loading=true;
      try{
        const d=await request(`/api/chat/${encodeURIComponent(active)}/messages?after=${lastId}`);
        if(!window.__ladcUserId)await ensureIdentity();
        if(d.messages?.length)render(d.messages);
        else if(lastId===0)render([]);
      }catch(e){
        if(!body.querySelector('.chat-error'))body.innerHTML=`<div class="chat-error">${esc(e.message)}</div>`;
      }finally{loading=false}
    }
    try{await ensureIdentity();await load()}catch(e){body.innerHTML=`<div class="chat-error">${esc(e.message)}</div>`}
    timer=setInterval(load,2500);
    document.getElementById('chatForm').onsubmit=async e=>{
      e.preventDefault();const text=input.value.trim();if(!text)return;const b=e.submitter;b.disabled=true;
      try{const d=await request(`/api/chat/${active}/messages`,{method:'POST',body:{body:text}});input.value='';render([d.message])}
      catch(e){window.alert(e.message)}finally{b.disabled=false;input.focus()}
    };
    document.getElementById('chatPick').onclick=()=>file.click();
    file.onchange=()=>file.files[0]&&upload(file.files[0]);
    ['dragenter','dragover'].forEach(x=>drop.addEventListener(x,e=>{e.preventDefault();drop.classList.add('dragging')}));
    ['dragleave','drop'].forEach(x=>drop.addEventListener(x,e=>{e.preventDefault();drop.classList.remove('dragging')}));
    drop.addEventListener('drop',e=>{const f=[...e.dataTransfer.files].find(x=>x.type.startsWith('image/'));if(f)upload(f)});
    async function upload(f){
      if(f.size>8*1024*1024)return window.alert('Image trop volumineuse (8 Mo maximum).');
      if(!['image/jpeg','image/png','image/webp','image/gif'].includes(f.type))return window.alert('Format non accepté.');
      const fd=new FormData();fd.append('image',f);const btn=document.getElementById('chatPick');btn.disabled=true;btn.textContent='Envoi…';
      try{const d=await request(`/api/chat/${active}/upload`,{method:'POST',body:fd});render([d.message])}
      catch(e){window.alert(e.message)}finally{btn.disabled=false;btn.textContent='Choisir une image';file.value=''}
    }
    input.focus();
  }
  document.addEventListener('click',e=>{const b=e.target.closest('[data-chat]');if(b){e.preventDefault();openChat(b.dataset.chat)}});
  const observer=new MutationObserver(injectButtons);observer.observe(document.getElementById('app')||document.body,{childList:true,subtree:true});setTimeout(injectButtons,500);
  window.LADCChat={open:openChat};
})();
