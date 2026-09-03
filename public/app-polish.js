(()=>{
'use strict';
const $=(s,r=document)=>r.querySelector(s);
const toast=m=>{const t=$('#toast');if(t){t.textContent=m;t.classList.add('show');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('show'),3000)}};
// Accessibility: keyboard skip link + useful page landmarks.
if(!$('.skip-link'))document.body.insertAdjacentHTML('afterbegin','<a class="skip-link" href="#app">Aller au contenu</a>');
// PWA/service worker: only enable on secure contexts or localhost.
if('serviceWorker' in navigator && (location.protocol==='https:'||location.hostname==='localhost')) navigator.serviceWorker.register('/sw.js').catch(()=>{});
// Installable Android/PWA prompt.
let deferredPrompt=null;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;showInstall()});
function showInstall(){if($('#appInstall'))return;document.body.insertAdjacentHTML('beforeend','<aside id="appInstall" class="app-install" aria-label="Installer l’application"><div><strong>Installer L’Art de la Connexion</strong><p>Ajoutez l’espace à votre écran d’accueil pour un accès plus rapide.</p></div><div class="app-install-actions"><button class="button button-small" id="installApp">Installer</button><button class="button button-small button-secondary" id="dismissInstall">Plus tard</button></div></aside>');$('#installApp').onclick=async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$('#appInstall')?.remove()};$('#dismissInstall').onclick=()=>$('#appInstall')?.remove()}
// Global keyboard navigation.
document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelectorAll('.modal-backdrop').forEach(x=>x.remove());if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();const a=[...document.querySelectorAll('a[href]')].filter(x=>x.offsetParent);const q=prompt('Rechercher une page');if(!q)return;const hit=a.find(x=>x.textContent.toLowerCase().includes(q.toLowerCase()));if(hit)hit.click();else toast('Aucune page trouvée.')}});
// Network feedback.
window.addEventListener('offline',()=>toast('Connexion perdue — certaines actions peuvent être indisponibles.'));
window.addEventListener('online',()=>toast('Connexion rétablie.'));
// Prevent accidental duplicate form submissions.
document.addEventListener('submit',e=>{const f=e.target;if(f.dataset.busy==='1'){e.preventDefault();return}f.dataset.busy='1';setTimeout(()=>f.dataset.busy='0',12000)});
// Add small status hint for installed standalone mode.
if(window.matchMedia('(display-mode: standalone)').matches)document.documentElement.classList.add('is-installed');
})();
