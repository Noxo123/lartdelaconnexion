(()=>{
  const $=(s,r=document)=>r.querySelector(s);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const progress=document.createElement('div');progress.className='ux-progress';document.body.appendChild(progress);
  const top=document.createElement('button');top.className='scroll-top';top.type='button';top.title='Retour en haut';top.setAttribute('aria-label','Retour en haut');top.textContent='↑';document.body.appendChild(top);
  const updateScroll=()=>top.classList.toggle('show',scrollY>500);addEventListener('scroll',updateScroll,{passive:true});updateScroll();top.onclick=()=>scrollTo({top:0,behavior:'smooth'});

  // Friendly offline/online feedback without interfering with application requests.
  const setNet=online=>{document.documentElement.classList.toggle('is-offline',!online);if(!online&&window.toast)window.toast('Connexion Internet interrompue. Vos données locales restent inchangées.');};
  addEventListener('online',()=>setNet(true));addEventListener('offline',()=>setNet(false));

  // Global navigation progress indicator.
  const start=()=>{progress.classList.add('active');progress.style.transform='scaleX(.35)';requestAnimationFrame(()=>progress.style.transform='scaleX(.78)')};
  const end=()=>{progress.style.transform='scaleX(1)';setTimeout(()=>{progress.classList.remove('active');progress.style.transform='scaleX(0)'},220)};
  const originalFetch=window.fetch;window.fetch=async(...args)=>{const url=String(args[0]?.url||args[0]||'');const api=url.startsWith('/api')||url.includes(location.origin+'/api');if(api)start();try{return await originalFetch(...args)}finally{if(api)end()}};

  // Command palette: Ctrl/Cmd+K. It works with the existing SPA routes and
  // deliberately uses only actions already available to the current user.
  const openPalette=()=>{if($('.command-palette'))return;const logged=!!document.querySelector('#logout')||!!document.querySelector('#logout2');const items=[
    ['⌕','Rechercher / naviguer','/'],['◷','Mes consultations','/espace'],['＋','Nouvelle réservation','/espace'],['⚙','Mon espace','/espace']
  ];if(logged&&document.querySelector('a[href="/admin"]'))items.push(['◆','Administration','/admin']);
  const wrap=document.createElement('div');wrap.className='command-palette';wrap.innerHTML=`<div class="command-box" role="dialog" aria-modal="true" aria-label="Navigation rapide"><input class="command-input" autofocus placeholder="Rechercher une action…" aria-label="Rechercher une action"><div class="command-list">${items.map((x,i)=>`<button class="command-item" data-go="${esc(x[2])}"><span>${x[0]}</span><strong>${esc(x[1])}</strong>${i<4?'<kbd>Entrée</kbd>':''}</button>`).join('')}</div></div>`;document.body.appendChild(wrap);const input=$('.command-input',wrap),buttons=[...wrap.querySelectorAll('[data-go]')];const close=()=>wrap.remove();wrap.addEventListener('click',e=>{if(e.target===wrap)close()});document.addEventListener('keydown',function handler(e){if(e.key==='Escape'){close();document.removeEventListener('keydown',handler)}if(e.key==='Enter'&&document.activeElement===input){buttons[0]?.click();document.removeEventListener('keydown',handler)}});buttons.forEach(b=>b.onclick=()=>{const path=b.dataset.go;close();if(path==='/espace'&&window.go)window.go(path);else location.href=path});};
  addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openPalette()}});

  // Add loading state to forms/buttons while a submit is in progress.
  document.addEventListener('submit',e=>{const b=e.target.querySelector('button[type="submit"],button:not([type])');if(!b)return;b.classList.add('is-loading');b.disabled=true;setTimeout(()=>{if(document.contains(b)){b.classList.remove('is-loading');b.disabled=false}},12000)},true);

  // Subtle pointer glow for premium cards; disabled for touch/reduced motion.
  if(matchMedia('(pointer:fine)').matches&&!matchMedia('(prefers-reduced-motion:reduce)').matches){document.addEventListener('pointermove',e=>{const c=e.target.closest('.card,.panel,.auth-card,.quote-card,.stat,.consultation');if(!c)return;const r=c.getBoundingClientRect();c.style.setProperty('--mx',`${e.clientX-r.left}px`);c.style.setProperty('--my',`${e.clientY-r.top}px`)},{passive:true})}
})();
