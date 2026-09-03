const CACHE='ladc-shell-v1';
const SHELL=['/','/styles.css','/chat.css','/commerce.css','/motion.css','/ux-enhancements.css','/notes.css','/app-polish.css','/app2.js','/chat.js','/commerce.js','/notes.js','/motion.js','/ux-enhancements.js','/app-polish.js','/manifest.webmanifest'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET'||new URL(r.url).origin!==location.origin)return;e.respondWith(fetch(r).then(res=>{const copy=res.clone();caches.open(CACHE).then(c=>c.put(r,copy)).catch(()=>{});return res}).catch(()=>caches.match(r).then(x=>x||caches.match('/'))))});
