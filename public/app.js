const app = document.getElementById('app');
const toastEl = document.getElementById('toast');
const nav = document.getElementById('mainNav');
const menuButton = document.getElementById('menuButton');
document.getElementById('year').textContent = new Date().getFullYear();

let currentUser = null;
let csrfToken = null;
let videoCleanup = null;

menuButton?.addEventListener('click', () => nav.classList.toggle('open'));

function toast(message) {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toastEl.classList.remove('show'), 3200);
}

async function api(url, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const headers = { ...(options.headers || {}) };
  if (options.body && typeof options.body !== 'string') {
    headers['content-type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }
  if (!['GET', 'HEAD'].includes(method)) {
    if (!csrfToken) await ensureCsrf();
    headers['x-csrf-token'] = csrfToken;
  }
  const res = await fetch(url, { ...options, method, headers, credentials: 'same-origin' });
  let data = {};
  try { data = await res.json(); } catch {}
  if (!res.ok) throw new Error(data.error || 'Une erreur est survenue.');
  return data;
}

async function ensureCsrf() {
  const res = await fetch('/api/csrf', { credentials: 'same-origin' });
  const data = await res.json();
  csrfToken = data.csrfToken;
}

async function refreshMe() {
  const data = await api('/api/me');
  currentUser = data.user;
  updateNav();
}

function updateNav() {
  if (!nav) return;
  if (currentUser) {
    nav.innerHTML = `
      <a href="/#approche">Approche</a>
      <a href="/#consultation">Consultations</a>
      <a href="/espace" data-link>Mon espace</a>
      <button class="button button-small" id="logoutBtn">Déconnexion</button>
    `;
    document.getElementById('logoutBtn')?.addEventListener('click', logout);
  } else {
    nav.innerHTML = `
      <a href="/#approche">Approche</a>
      <a href="/#consultation">Consultations</a>
      <a href="/#securite">Confidentialité</a>
      <a href="/connexion" class="nav-login" data-link>Connexion</a>
      <a href="/inscription" class="button button-small" data-link>Créer un compte</a>
    `;
  }
}

async function logout() {
  try {
    await api('/api/auth/logout', { method: 'POST' });
  } catch {}
  currentUser = null;
  csrfToken = null;
  navigate('/');
}

function navigate(path) {
  if (videoCleanup) { videoCleanup(); videoCleanup = null; }
  history.pushState({}, '', path);
  nav.classList.remove('open');
  render();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

document.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-link]');
  if (!a) return;
  const url = new URL(a.href, location.origin);
  if (url.origin !== location.origin) return;
  e.preventDefault();
  navigate(url.pathname + url.search + url.hash);
});
window.addEventListener('popstate', render);

function homePage() {
  return `
  <div class="page">
    <section class="hero">
      <div>
        <span class="eyebrow">✦ Consultation privée à distance</span>
        <h1>Écouter l'invisible,<br><span class="gradient-text">éclairer votre chemin.</span></h1>
        <p class="hero-copy">Un espace doux et confidentiel pour prendre le temps d'écouter ce qui vous traverse, poser vos questions et vivre une consultation en visioconférence, où que vous soyez.</p>
        <div class="hero-actions">
          <a href="${currentUser ? '/espace' : '/inscription'}" class="button" data-link>${currentUser ? 'Accéder à mon espace' : 'Réserver une consultation'} <span>→</span></a>
          <a href="#approche" class="button button-secondary">Découvrir mon approche</a>
        </div>
        <div class="trust-row"><span><b>✓</b> Visio privée</span><span><b>✓</b> Espace personnel</span><span><b>✓</b> Données protégées</span></div>
      </div>
      <div class="hero-visual">
        <div class="hero-frame"><img src="https://miro.medium.com/v2/format:webp/4*SdjkdS98aKH76I8eD0_qjw.png" alt="Illustration spirituelle de L'Art de la Connexion" /></div>
        <div class="floating-card one">🔒 Espace confidentiel<small>Votre consultation reste privée</small></div>
        <div class="floating-card two">✦ À distance<small>Depuis votre téléphone ou ordinateur</small></div>
      </div>
    </section>

    <section class="section center" id="approche">
      <span class="section-kicker">Une approche humaine</span>
      <h2 class="section-title">Un temps pour vous, sans jugement et sans précipitation.</h2>
      <p class="section-lead">La médiumnité peut être vécue comme un espace d'introspection et de ressenti. Chaque échange reste centré sur votre demande et votre liberté de décision.</p>
      <div class="cards">
        <article class="card"><div class="card-icon">♡</div><h3>Écoute bienveillante</h3><p>Une consultation où vous pouvez déposer vos questions dans un cadre calme, respectueux et confidentiel.</p></article>
        <article class="card"><div class="card-icon">✦</div><h3>Connexion intuitive</h3><p>Un échange axé sur les ressentis, symboles et messages perçus pendant le temps de consultation.</p></article>
        <article class="card"><div class="card-icon">⌁</div><h3>À votre rythme</h3><p>Vous gardez toujours votre libre arbitre. Rien n'est présenté comme une certitude ou une décision à prendre à votre place.</p></article>
      </div>
    </section>

    <section class="section split" id="consultation">
      <div class="quote-card"><blockquote>« Une consultation n'est pas là pour décider à votre place, mais pour vous aider à entendre ce qui résonne en vous. »</blockquote><p>— L'Art de la Connexion</p></div>
      <div>
        <span class="section-kicker">Simple & fluide</span>
        <h2 class="section-title" style="margin-left:0">Votre consultation en 3 étapes.</h2>
        <div class="steps">
          <div class="step"><span class="step-number">1</span><div><h3>Créez votre espace</h3><p>Inscrivez-vous avec votre adresse e-mail et un mot de passe sécurisé.</p></div></div>
          <div class="step"><span class="step-number">2</span><div><h3>Demandez un rendez-vous</h3><p>Choisissez un créneau souhaité et précisez le sujet que vous souhaitez aborder.</p></div></div>
          <div class="step"><span class="step-number">3</span><div><h3>Rejoignez la visio</h3><p>Une fois le rendez-vous confirmé, rejoignez directement l'espace vidéo privé depuis votre compte.</p></div></div>
        </div>
      </div>
    </section>

    <section class="section center" id="securite">
      <span class="section-kicker">Confidentialité</span>
      <h2 class="section-title">Votre espace a été pensé pour rester privé.</h2>
      <p class="section-lead">Sessions protégées, mots de passe hachés, limitation des tentatives, validation côté serveur et accès aux salons vidéo réservé aux participants autorisés.</p>
      <div class="cards">
        <article class="card"><div class="card-icon">🔐</div><h3>Compte protégé</h3><p>Les mots de passe ne sont jamais stockés en clair et les sessions utilisent des cookies HttpOnly.</p></article>
        <article class="card"><div class="card-icon">◉</div><h3>Visio WebRTC</h3><p>Les flux audio/vidéo transitent directement entre les participants quand le réseau le permet.</p></article>
        <article class="card"><div class="card-icon">🛡</div><h3>Accès contrôlé</h3><p>Un client ne peut consulter que ses propres rendez-vous et le propriétaire dispose d'un rôle séparé.</p></article>
      </div>
    </section>
  </div>`;
}

function authPage(mode) {
  const register = mode === 'register';
  return `
  <section class="auth-layout page">
    <div class="auth-copy">
      <span class="eyebrow">✦ L'Art de la Connexion</span>
      <h1>${register ? 'Créez votre espace personnel.' : 'Heureuse de vous retrouver.'}</h1>
      <p>${register ? 'Votre espace vous permet de demander un rendez-vous, suivre sa confirmation et rejoindre votre consultation en visio.' : 'Connectez-vous pour retrouver vos rendez-vous et accéder à vos consultations privées.'}</p>
      <div class="trust-row" style="margin-top:25px"><span><b>✓</b> Connexion sécurisée</span><span><b>✓</b> Données privées</span></div>
    </div>
    <div class="auth-card">
      <h2>${register ? 'Créer un compte' : 'Connexion'}</h2>
      <p>${register ? 'Quelques informations suffisent.' : 'Entrez vos identifiants.'}</p>
      <div class="form-error" id="formError"></div>
      <form id="authForm">
        ${register ? `<div class="form-grid"><div class="field"><label>Prénom</label><input name="firstName" autocomplete="given-name" maxlength="60" required /></div><div class="field"><label>Nom</label><input name="lastName" autocomplete="family-name" maxlength="60" required /></div></div>` : ''}
        <div class="field"><label>Adresse e-mail</label><input type="email" name="email" autocomplete="email" maxlength="180" required /></div>
        <div class="field"><label>Mot de passe</label><input type="password" name="password" autocomplete="${register ? 'new-password' : 'current-password'}" maxlength="128" required /></div>
        ${register ? '<p class="form-note">12 caractères minimum, avec au moins une majuscule, une minuscule et un chiffre.</p>' : ''}
        <button class="button" style="width:100%;margin-top:8px" type="submit">${register ? 'Créer mon espace' : 'Me connecter'}</button>
      </form>
      <p class="auth-switch">${register ? 'Déjà un compte ? <a href="/connexion" data-link>Se connecter</a>' : 'Pas encore de compte ? <a href="/inscription" data-link>Créer mon espace</a>'}</p>
    </div>
  </section>`;
}

function bindAuth(mode) {
  const form = document.getElementById('authForm');
  const err = document.getElementById('formError');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.classList.remove('show');
    const fd = new FormData(form);
    const body = Object.fromEntries(fd.entries());
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      const data = await api(`/api/auth/${mode === 'register' ? 'register' : 'login'}`, { method: 'POST', body });
      currentUser = data.user;
      csrfToken = data.csrfToken;
      updateNav();
      navigate('/espace');
      toast(mode === 'register' ? 'Votre espace est créé.' : 'Connexion réussie.');
    } catch (e) {
      err.textContent = e.message;
      err.classList.add('show');
    } finally { btn.disabled = false; }
  });
}

async function dashboardPage() {
  if (!currentUser) return navigate('/connexion');
  app.innerHTML = `<section class="dashboard page"><div class="empty">Chargement de votre espace…</div></section>`;
  let consultations = [];
  try { consultations = (await api('/api/consultations')).consultations || []; }
  catch (e) { toast(e.message); }

  const confirmed = consultations.filter(c => c.status === 'confirmed').length;
  const pending = consultations.filter(c => c.status === 'pending').length;
  const done = consultations.filter(c => c.status === 'completed').length;
  const initials = `${currentUser.firstName?.[0] || ''}${currentUser.lastName?.[0] || ''}`.toUpperCase();
  const isOwner = currentUser.role === 'owner';

  app.innerHTML = `
  <section class="dashboard page">
    <div class="dashboard-head"><div><span class="section-kicker">${isOwner ? 'Espace propriétaire' : 'Espace personnel'}</span><h1>Bonjour ${escapeHtml(currentUser.firstName)}.</h1><p>${isOwner ? 'Gérez les demandes et rejoignez vos consultations.' : 'Retrouvez vos demandes et vos rendez-vous confirmés.'}</p></div>${!isOwner ? '<button class="button" id="newConsultation">+ Demander un rendez-vous</button>' : ''}</div>
    <div class="stats"><div class="stat"><strong>${pending}</strong><span>En attente</span></div><div class="stat"><strong>${confirmed}</strong><span>Confirmé${confirmed > 1 ? 's' : ''}</span></div><div class="stat"><strong>${done}</strong><span>Terminé${done > 1 ? 's' : ''}</span></div></div>
    <div class="dashboard-grid">
      <aside class="panel profile-card"><div class="avatar">${escapeHtml(initials)}</div><h3>${escapeHtml(currentUser.firstName)} ${escapeHtml(currentUser.lastName)}</h3><p>${escapeHtml(currentUser.email)}</p><span class="badge ${isOwner ? 'confirmed' : 'completed'}">${isOwner ? 'Propriétaire' : 'Client'}</span><hr style="border:0;border-top:1px solid var(--line);margin:22px 0"><button class="button button-ghost" id="logoutSide" style="width:100%">Se déconnecter</button></aside>
      <div class="panel"><div class="panel-head"><h2>${isOwner ? 'Toutes les demandes' : 'Mes consultations'}</h2><span class="form-note">${consultations.length} rendez-vous</span></div><div class="consultation-list">${consultations.length ? consultations.map(c => consultationCard(c, isOwner)).join('') : '<div class="empty">Aucune consultation pour le moment.</div>'}</div></div>
    </div>
  </section>`;

  document.getElementById('logoutSide')?.addEventListener('click', logout);
  document.getElementById('newConsultation')?.addEventListener('click', openBookingModal);
  document.querySelectorAll('[data-join]').forEach(btn => btn.addEventListener('click', () => navigate(`/consultation/${btn.dataset.join}`)));
  document.querySelectorAll('[data-status]').forEach(sel => sel.addEventListener('change', async () => {
    try {
      await api(`/api/consultations/${sel.dataset.status}/status`, { method: 'PATCH', body: { status: sel.value } });
      toast('Statut mis à jour.');
      dashboardPage();
    } catch (e) { toast(e.message); }
  }));
}

function consultationCard(c, isOwner) {
  const date = new Date(c.requested_at);
  const dateText = date.toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
  const statusLabels = { pending: 'En attente', confirmed: 'Confirmé', completed: 'Terminé', cancelled: 'Annulé' };
  const who = isOwner && c.first_name ? `<p>${escapeHtml(c.first_name)} ${escapeHtml(c.last_name)} · ${escapeHtml(c.email)}</p>` : '';
  return `<article class="consultation"><div><h3>${escapeHtml(c.subject)}</h3>${who}<p>${dateText}${c.message ? ' · ' + escapeHtml(c.message.slice(0, 130)) : ''}</p><div class="consultation-meta"><span class="badge ${c.status}">${statusLabels[c.status] || c.status}</span></div></div><div class="owner-actions">${c.status === 'confirmed' ? `<button class="button button-small" data-join="${c.id}">Rejoindre la visio</button>` : ''}${isOwner ? `<select data-status="${c.id}" aria-label="Modifier le statut"><option value="pending" ${c.status === 'pending' ? 'selected' : ''}>En attente</option><option value="confirmed" ${c.status === 'confirmed' ? 'selected' : ''}>Confirmer</option><option value="completed" ${c.status === 'completed' ? 'selected' : ''}>Terminer</option><option value="cancelled" ${c.status === 'cancelled' ? 'selected' : ''}>Annuler</option></select>` : ''}</div></article>`;
}

function openBookingModal() {
  const min = new Date(Date.now() + 10 * 60_000);
  min.setMinutes(min.getMinutes() - min.getTimezoneOffset());
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.innerHTML = `<div class="modal"><div class="modal-head"><h2>Demander un rendez-vous</h2><button class="icon-button" id="closeModal">✕</button></div><div class="form-error" id="bookingError"></div><form id="bookingForm"><div class="field"><label>Sujet de la consultation</label><input name="subject" maxlength="120" placeholder="Ex. Question personnelle, orientation…" required /></div><div class="field"><label>Créneau souhaité</label><input type="datetime-local" name="requestedAt" min="${min.toISOString().slice(0,16)}" required /></div><div class="field"><label>Message (facultatif)</label><textarea name="message" maxlength="1500" placeholder="Quelques mots pour préparer votre demande…"></textarea></div><button class="button" type="submit">Envoyer ma demande</button></form></div>`;
  document.body.appendChild(modal);
  const close = () => modal.remove();
  document.getElementById('closeModal').onclick = close;
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
  document.getElementById('bookingForm').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const local = new Date(fd.get('requestedAt'));
    const body = { subject: fd.get('subject'), message: fd.get('message'), requestedAt: local.toISOString() };
    const btn = e.currentTarget.querySelector('button[type=submit]');
    btn.disabled = true;
    try { await api('/api/consultations', { method: 'POST', body }); close(); toast('Votre demande a été envoyée.'); dashboardPage(); }
    catch (er) { const box = document.getElementById('bookingError'); box.textContent = er.message; box.classList.add('show'); }
    finally { btn.disabled = false; }
  });
}

async function videoPage(id) {
  if (!currentUser) return navigate('/connexion');
  app.innerHTML = `<section class="video-page page"><div class="empty">Préparation de la consultation…</div></section>`;
  let access;
  try { access = await api(`/api/consultations/${id}/access`); }
  catch (e) { app.innerHTML = `<section class="section center page"><h2 class="section-title">Accès impossible</h2><p class="section-lead">${escapeHtml(e.message)}</p><p style="margin-top:24px"><a class="button" href="/espace" data-link>Retour à mon espace</a></p></section>`; return; }

  app.innerHTML = `
  <section class="video-page page">
    <div class="video-head"><div><h1>${escapeHtml(access.consultation.subject)}</h1><span class="video-status" id="videoStatus">Autorisez votre caméra et votre micro.</span></div><a class="button button-secondary button-small" href="/espace" data-link>← Mon espace</a></div>
    <div class="video-grid">
      <div class="stage"><video id="remoteVideo" class="remote-video" autoplay playsinline></video><div class="video-placeholder" id="videoPlaceholder"><div><span>✦</span>En attente de l'autre participant…</div></div><div class="local-wrap"><video id="localVideo" class="local-video" autoplay muted playsinline></video></div><div class="video-controls"><button class="control" id="micBtn" title="Micro">🎙</button><button class="control" id="camBtn" title="Caméra">◉</button><button class="control hang" id="hangBtn" title="Quitter">☎</button></div></div>
      <aside class="video-sidebar"><div class="panel security-box"><strong>🔒 Salon privé</strong>Seuls le client concerné et le propriétaire du site peuvent rejoindre cette consultation.</div><div class="panel security-box"><strong>🛡 Conseils</strong>Utilisez un réseau privé et des écouteurs si vous souhaitez renforcer la confidentialité autour de vous.</div></aside>
    </div>
  </section>`;

  const localVideo = document.getElementById('localVideo');
  const remoteVideo = document.getElementById('remoteVideo');
  const status = document.getElementById('videoStatus');
  const placeholder = document.getElementById('videoPlaceholder');
  let localStream = null;
  let pc = null;
  let socket = null;
  let initiator = false;
  let disposed = false;

  async function makePeer() {
    if (pc) return pc;
    pc = new RTCPeerConnection({ iceServers: access.iceServers });
    localStream?.getTracks().forEach(track => pc.addTrack(track, localStream));
    pc.ontrack = e => { remoteVideo.srcObject = e.streams[0]; placeholder.style.display = 'none'; status.textContent = 'Consultation connectée.'; };
    pc.onicecandidate = e => { if (e.candidate) socket?.emit('signal', { type: 'candidate', candidate: e.candidate }); };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') status.textContent = 'Connexion privée établie.';
      if (['failed','disconnected'].includes(pc.connectionState)) status.textContent = 'Connexion interrompue.';
    };
    return pc;
  }

  async function createOffer() {
    const peer = await makePeer();
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    socket.emit('signal', { type: 'offer', sdp: peer.localDescription });
  }

  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: { echoCancellation: true, noiseSuppression: true } });
    localVideo.srcObject = localStream;
    status.textContent = 'Caméra prête. Connexion au salon…';
    socket = io({ transports: ['websocket', 'polling'] });
    socket.on('connect', () => socket.emit('join-consultation', { consultationId: Number(id) }));
    socket.on('room-joined', async data => { initiator = !!data.initiator; status.textContent = initiator ? 'En attente de l’autre participant…' : 'Participant détecté…'; if (!initiator) await makePeer(); });
    socket.on('peer-ready', async () => { if (initiator) await createOffer(); });
    socket.on('room-full', () => toast('Ce salon contient déjà deux participants.'));
    socket.on('peer-left', () => { placeholder.style.display = 'grid'; status.textContent = 'L’autre participant a quitté la consultation.'; remoteVideo.srcObject = null; pc?.close(); pc = null; });
    socket.on('signal', async payload => {
      const peer = await makePeer();
      if (payload.type === 'offer') {
        await peer.setRemoteDescription(payload.sdp);
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        socket.emit('signal', { type: 'answer', sdp: peer.localDescription });
      } else if (payload.type === 'answer') {
        await peer.setRemoteDescription(payload.sdp);
      } else if (payload.type === 'candidate' && payload.candidate) {
        try { await peer.addIceCandidate(payload.candidate); } catch {}
      }
    });
  } catch (e) {
    status.textContent = 'Caméra ou micro indisponible.';
    toast('Autorisez la caméra et le micro dans votre navigateur.');
  }

  document.getElementById('micBtn').onclick = () => {
    const track = localStream?.getAudioTracks()[0]; if (!track) return; track.enabled = !track.enabled; document.getElementById('micBtn').classList.toggle('off', !track.enabled);
  };
  document.getElementById('camBtn').onclick = () => {
    const track = localStream?.getVideoTracks()[0]; if (!track) return; track.enabled = !track.enabled; document.getElementById('camBtn').classList.toggle('off', !track.enabled);
  };
  document.getElementById('hangBtn').onclick = () => navigate('/espace');

  videoCleanup = () => {
    if (disposed) return; disposed = true;
    socket?.emit('leave-consultation'); socket?.disconnect();
    pc?.close(); localStream?.getTracks().forEach(t => t.stop());
  };
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#039;', '"':'&quot;' }[c]));
}

async function render() {
  const path = location.pathname;
  if (videoCleanup && !path.startsWith('/consultation/')) { videoCleanup(); videoCleanup = null; }
  if (path === '/') { app.innerHTML = homePage(); return; }
  if (path === '/connexion') { if (currentUser) return navigate('/espace'); app.innerHTML = authPage('login'); bindAuth('login'); return; }
  if (path === '/inscription') { if (currentUser) return navigate('/espace'); app.innerHTML = authPage('register'); bindAuth('register'); return; }
  if (path === '/espace') return dashboardPage();
  const match = path.match(/^\/consultation\/(\d+)$/);
  if (match) return videoPage(match[1]);
  app.innerHTML = `<section class="section center page"><h1 class="section-title">Page introuvable</h1><p><a href="/" data-link class="button">Retour à l'accueil</a></p></section>`;
}

(async function init(){
  await ensureCsrf();
  await refreshMe();
  render();
})();
