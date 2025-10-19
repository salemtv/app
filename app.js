/* app.js v1.2
   Version: v1.2 - Corrección de bugs y ajustes solicitados
   - Basado íntegramente en v1.1 (se conserva TODO el código no modificado)
   - Cambios funcionales puntuales:
     * Eliminado botón "Descartar" del panel (solo 'Abrir' y 'Eliminar')
     * Eliminación permanente: al borrar una notificación desde el panel, se registra en LS_REMOVED para que
       NUNCA vuelva a importarse o mostrarse (incluso si aparece en data/notifications.json)
     * Toast: al mostrarse se marca automáticamente como "visto" (dismissed) y se oculta tras 3s (no queda fija)
     * Watch realtime filtrando IDs eliminados para evitar reaparición
*/

/* ============================
   Datos / JSON paths
   ============================ */

const PAGES = {}; // se llenará con fetch desde data/*.json
const LS_TAB = "stv_selected_tab";
const LS_NOTIFS = "stv_notifications"; // copia local de data/notifications.json
const LS_DISMISSED = "stv_notif_dismissed"; // notifs vistas (toast mostrado o marcado)
const LS_REMOVED = "stv_notif_removed"; // notifs eliminadas permanentemente (desde panel)

const main = document.getElementById('main');
const tabs = document.querySelectorAll('.tab');
const notifToggle = document.getElementById('notifToggle');
const notifPanel = document.getElementById('notifPanel');
const notifList = document.getElementById('notifList');
const notifCountEl = document.getElementById('notifCount');
const toastEl = document.getElementById('toast');
const modalFull = document.getElementById('modalFull');
const modalInner = document.getElementById('modalInner');
const modalClose = document.getElementById('modalClose');
const clearAllBtn = document.getElementById('clearAll');

let notifSequenceTimer = null;
let notifIndex = 0;
let activeToastTimeout = null;
let highlightTimeout = null;

/* ---------------------------
   Utils
   --------------------------- */
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])) }
function formatDDMM(iso) {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2,'0');
  const mm = String(d.getMonth()+1).padStart(2,'0');
  return `${dd}-${mm}`;
}
function daysBetween(dateIso) {
  const now = new Date(); now.setHours(0,0,0,0);
  const target = new Date(dateIso); target.setHours(0,0,0,0);
  const diff = Math.round((target - now) / (1000*60*60*24));
  return diff; // 0 => today, >0 future, <0 past
}
function getDismissed() { return JSON.parse(localStorage.getItem(LS_DISMISSED) || '[]'); }
function setDismissed(arr){ localStorage.setItem(LS_DISMISSED, JSON.stringify(arr)); }
function getRemoved() { return JSON.parse(localStorage.getItem(LS_REMOVED) || '[]'); }
function setRemoved(arr) { localStorage.setItem(LS_REMOVED, JSON.stringify(arr)); }

/* ---------------------------
   Load JSON data (images, videos, envi, notifications)
   --------------------------- */
async function fetchJSON(path, fallback=null) {
  try {
    const r = await fetch(path, {cache: "no-cache"});
    if (!r.ok) throw new Error('fetch failed');
    return await r.json();
  } catch(e) {
    console.warn('fetch failed', path, e);
    return fallback;
  }
}

/* Cuando guardamos la copia local de notifs, siempre filtramos por removals
   para garantizar que una notificación eliminada permanentemente no
   reaparezca aunque exista en el JSON original. */
function saveNotifsToLS(notifs) {
  const removed = getRemoved();
  const filtered = (notifs || []).filter(n => !removed.includes(n.id));
  localStorage.setItem(LS_NOTIFS, JSON.stringify(filtered));
}

/* Carga inicial: lee data/*.json y guarda copia local de notifs (filtrando removals) */
async function loadAllData() {
  const [images, videos, envi, notifs] = await Promise.all([
    fetchJSON('data/images.json', null),
    fetchJSON('data/videos.json', null),
    fetchJSON('data/envi.json', null),
    fetchJSON('data/notifications.json', null)
  ]);

  if (notifs) {
    saveNotifsToLS(notifs);
  } else {
    // si no hay fetch, dejamos la copia local existente
  }

  PAGES.images = images || { title: 'Imágenes - STV', items: [] };
  PAGES.videos = videos || { title: 'Videos - STV', items: [] };
  PAGES.envi = envi || { title: 'EnVi', defaultStream: 'liga1max' };
  return JSON.parse(localStorage.getItem(LS_NOTIFS) || '[]');
}

/* ---------------------------
   Notificaciones: carga, filtrado, render y secuencia rotativa
   --------------------------- */

/* loadNotificationsFromLS: filtra expiradas y removidas */
function loadNotificationsFromLS() {
  let arr = JSON.parse(localStorage.getItem(LS_NOTIFS) || '[]');
  const now = new Date();
  const removed = getRemoved();
  arr = arr.filter(n => {
    if (removed.includes(n.id)) return false;
    if (!n.created || n.expire_days == null) return true;
    const created = new Date(n.created);
    const expireAt = new Date(created.getTime() + (n.expire_days * 24*60*60*1000));
    return expireAt >= now;
  });
  localStorage.setItem(LS_NOTIFS, JSON.stringify(arr));
  return arr;
}

/* updateNotifBadge: muestra número pendiente NO descartado y no removido */
function updateNotifBadge() {
  const notifs = loadNotificationsFromLS();
  const dismissed = getDismissed();
  const pending = notifs.filter(n => !dismissed.includes(n.id));
  if (pending.length > 0) {
    notifCountEl.style.display = 'inline-block';
    notifCountEl.textContent = pending.length;
  } else {
    notifCountEl.style.display = 'none';
  }
}

/* renderNotifPanel: panel histórico (muestra todo excepto removals) */
function renderNotifPanel() {
  const notifs = loadNotificationsFromLS();
  notifList.innerHTML = '';
  if (notifs.length === 0) {
    notifList.innerHTML = `<div style="color:var(--color-muted);font-size:14px">No hay notificaciones</div>`;
    updateNotifBadge();
    return;
  }
  notifs.forEach(n => {
    const d = new Date(n.created || Date.now());
    const metaDate = formatDDMM(d.toISOString());
    const expireDays = n.expire_days != null ? n.expire_days : '∞';
    const expireLabel = (daysBetween(new Date(d.getTime() + (expireDays*24*60*60*1000))) === 0) ? 'Hoy*' : `Expira: ${expireDays}d`;
    const el = document.createElement('div');
    el.className = 'notif-item';
    el.innerHTML = `
      <div style="font-weight:600">${escapeHtml(n.title || '')}</div>
      <div style="font-size:14px;color:var(--color-text)">${escapeHtml(n.body || n.content || '')}</div>
      <div class="meta"><div>${metaDate}</div><div>${expireLabel}</div></div>
      <div class="notif-actions">
        <button class="btn-small" data-action="open" data-id="${n.id}">Abrir</button>
        <button class="btn-small" data-action="delete" data-id="${n.id}">Eliminar</button>
      </div>
    `;
    notifList.appendChild(el);
  });

  notifList.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.id;
      const action = e.currentTarget.dataset.action;
      if (action === 'open') {
        const all = loadNotificationsFromLS();
        const n = all.find(x => x.id === id);
        if (n) executeNotificationOpen(n);
      } else if (action === 'delete') {
        // eliminar permanentemente:
        let notifs = loadNotificationsFromLS();
        notifs = notifs.filter(x => x.id !== id);
        // actualizar LS_NOTIFS (sin la notificación)
        localStorage.setItem(LS_NOTIFS, JSON.stringify(notifs));
        // añadir a LS_REMOVED para que nunca vuelva a importarse
        const removed = getRemoved();
        if (!removed.includes(id)) {
          removed.push(id);
          setRemoved(removed);
        }
        // también quitarla de dismissed por limpieza
        const dismissed = getDismissed().filter(x => x !== id);
        setDismissed(dismissed);
        updateNotifBadge();
        renderNotifPanel();
      }
    });
  });

  updateNotifBadge();
}

/* show single toast (con botón de cerrar propio)
   v1.2 behavior:
   - Marca como dismissed automáticamente al mostrarse (para que no vuelva a aparecer)
   - Se oculta automáticamente a los 3s
*/
function showToastOnly(notif) {
  if (!notif || !notif.id) return;
  // si ya fue descartada (vista) o removida => NO mostrar
  const dismissed = getDismissed();
  const removed = getRemoved();
  if (dismissed.includes(notif.id) || removed.includes(notif.id)) return;

  // marcar como vista automáticamente al mostrarse
  dismissed.push(notif.id);
  setDismissed(dismissed);
  updateNotifBadge();

  // limpiar timer previo si existe
  if (activeToastTimeout) {
    clearTimeout(activeToastTimeout);
    activeToastTimeout = null;
  }

  toastEl.innerHTML = `
    <div class="toast-header">
      <div>${escapeHtml(notif.title || 'Notificación')}</div>
      <button class="toast-close" aria-label="Cerrar">×</button>
    </div>
    <div class="toast-body">${escapeHtml(notif.body || notif.content || '')}</div>
  `;
  toastEl.classList.add('show');

  const closeBtn = toastEl.querySelector('.toast-close');
  closeBtn.addEventListener('click', () => {
    // cerrar toast (la notificación ya está marcada como vista)
    hideToast();
  });

  // se oculta automáticamente a los 3s
  activeToastTimeout = setTimeout(() => {
    hideToast();
    activeToastTimeout = null;
  }, 3000);
}

/* hide toast */
function hideToast() {
  toastEl.classList.remove('show');
  // limpiar contenido después de la transición para evitar re-binding
  setTimeout(() => {
    toastEl.innerHTML = '';
  }, 300);
}

/* run rotation over pending notifs:
   v1.2 new logic:
   - Espera inicial de 5 segundos tras entrar a la web.
   - Muestra notificación por notificación con intervalo de 3s entre ellas.
   - No re-muestra notificaciones que ya estén en dismissed o removed.
*/
let notifSequenceRunning = false;
async function startNotifSequence() {
  if (notifSequenceRunning) return;
  notifSequenceRunning = true;

  const notifs = loadNotificationsFromLS().filter(n => !getDismissed().includes(n.id));
  if (notifs.length === 0) {
    notifSequenceRunning = false;
    return;
  }

  // Delay inicial de 5 segundos
  await new Promise(r => setTimeout(r, 5000));

  for (let i = 0; i < notifs.length; i++) {
    // comprobar si ya fue descartada/eliminada en meantime (ej. por panel)
    const dismissed = getDismissed();
    const removed = getRemoved();
    if (dismissed.includes(notifs[i].id) || removed.includes(notifs[i].id)) continue;

    showToastOnly(notifs[i]);
    // esperar 3s (mostrando); ya el showToastOnly oculta a los 3s, pero guardamos un gap
    await new Promise(r => setTimeout(r, 3500));
  }

  notifSequenceRunning = false;
}

/* stopNotifSequence: limpia timers y oculta toast */
function stopNotifSequence(){
  if (activeToastTimeout) { clearTimeout(activeToastTimeout); activeToastTimeout = null; }
  hideToast();
  notifSequenceRunning = false;
}

/* Execute "Abrir" action (mantengo exactamente la lógica original) */
function executeNotificationOpen(n) {
  const actionVal = n.action || n.accion || n.open || '';
  if (typeof actionVal === 'string' && actionVal.startsWith('canal:')) {
    const canal = actionVal.split(':')[1];
    localStorage.setItem('canalSeleccionado', canal);
    setActiveTab('envi');
    setTimeout(() => {
      const sel = document.getElementById('canalSelector');
      const iframe = document.getElementById('videoIframe');
      if (sel && iframe) {
        sel.value = canal;
        const loader = document.getElementById('loader');
        const badge = document.getElementById('liveBadge');
        if (loader) loader.style.display = 'flex';
        if (badge) badge.classList.remove('visible');
        iframe.src = `https://streamtp22.com/global1.php?stream=${canal}`;
      }
    }, 300);
    return;
  }

  if (typeof actionVal === 'string' && actionVal.startsWith('image:')) {
    const name = actionVal.split(':').slice(1).join(':').toLowerCase();
    setActiveTab('images');
    setTimeout(() => {
      const grid = document.querySelector('.grid');
      if (!grid) return;
      document.querySelectorAll('.highlight').forEach(el=>el.classList.remove('highlight'));
      let found = null;
      grid.querySelectorAll('.card').forEach(card => {
        const nm = (card.querySelector('.iname')?.textContent || '').toLowerCase();
        if (nm === name) found = card;
      });
      if (found) {
        found.classList.add('highlight');
        found.scrollIntoView({behavior:'smooth', block:'center'});
        if (highlightTimeout) clearTimeout(highlightTimeout);
        highlightTimeout = setTimeout(()=> found.classList.remove('highlight'), 4000);
      } else {
        grid.querySelectorAll('.card').forEach(card => {
          const nm = (card.querySelector('.iname')?.textContent || '').toLowerCase();
          if (nm.includes(name)) {
            if (!found) found = card;
          }
        });
        if (found) {
          found.classList.add('highlight');
          found.scrollIntoView({behavior:'smooth', block:'center'});
          if (highlightTimeout) clearTimeout(highlightTimeout);
          highlightTimeout = setTimeout(()=> found.classList.remove('highlight'), 4000);
        }
      }
    }, 300);
    return;
  }

  showToastOnly(n.body || n.content || '');
}

/* ---------------------------
   SPA rendering: Images, Videos, EnVi
   (Mantengo todo exactamente como v1.1/v1.0)
   --------------------------- */
function setActiveTab(tabName, pushHistory=true) {
  tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
  localStorage.setItem(LS_TAB, tabName);
  renderPage(tabName);
  if (pushHistory) history.pushState({tab:tabName}, '', `#${tabName}`);
}

function renderPage(tabName) {
  main.innerHTML = '';
  if (tabName === 'images') renderImages();
  else if (tabName === 'videos') renderVideos();
  else renderEnVi();
}

/* IMÁGENES */
function renderImages() {
  const p = PAGES.images || { title: 'Imágenes', items: [] };
  const container = document.createElement('div');
  container.innerHTML = `<h3 style="margin-bottom:8px">${p.title}</h3>`;
  const searchWrap = document.createElement('div');
  searchWrap.style.marginBottom = '12px';
  searchWrap.innerHTML = `<input id="imgSearch" placeholder="Buscar imagen..." style="width:100%;padding:10px;border-radius:8px;border:none;background:var(--color-secondary);color:var(--color-text)">`;
  container.appendChild(searchWrap);

  const grid = document.createElement('div'); grid.className = 'grid';
  p.items.forEach(item => {
    const c = document.createElement('div'); c.className = 'card';
    c.innerHTML = `<img loading="lazy" src="${item.url}" alt="${escapeHtml(item.name)}" />
                   <div class="iname">${escapeHtml(item.name)}</div>`;
    c.querySelector('img').addEventListener('click', () => openImagePlayer(item));
    grid.appendChild(c);
  });
  container.appendChild(grid);
  main.appendChild(container);

  const input = document.getElementById('imgSearch');
  let noResultsMsg = null;
  input.addEventListener('input', (e) => {
    const v = e.target.value.trim().toLowerCase();
    let visible = 0;
    grid.querySelectorAll('.card').forEach(card => {
      const name = (card.querySelector('.iname')?.textContent || '').toLowerCase();
      if (name.includes(v)) {
        card.style.display = '';
        visible++;
      } else card.style.display = 'none';
    });
    if (visible === 0) {
      if (!noResultsMsg) {
        noResultsMsg = document.createElement('p');
        noResultsMsg.className = 'no-results';
        noResultsMsg.style.marginTop = '8px';
        noResultsMsg.style.color = 'var(--color-muted)';
        noResultsMsg.textContent = 'No se encontró nada.';
        container.appendChild(noResultsMsg);
      }
    } else if (noResultsMsg) {
      noResultsMsg.remove();
      noResultsMsg = null;
    }
  });
}

/* open modal player for image */
function openImagePlayer(item) {
  const videoSrc = item.video;
  if (!videoSrc) return;
  const isiOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
  if (isiOS) {
    window.location.href = videoSrc;
    return;
  }

  modalInner.innerHTML = '';
  if (videoSrc.match(/\.(mp4|webm|ogg)(\?|$)/i)) {
    const v = document.createElement('video');
    v.src = videoSrc;
    v.controls = true;
    v.autoplay = true;
    v.playsInline = true;
    v.style.maxHeight = '90vh';
    modalInner.appendChild(v);
  } else {
    const iframe = document.createElement('iframe');
    iframe.src = videoSrc.includes('youtube.com') && !videoSrc.includes('enablejsapi') ? videoSrc + (videoSrc.includes('?') ? '&enablejsapi=1' : '?enablejsapi=1') : videoSrc;
    iframe.allow = 'autoplay; encrypted-media; picture-in-picture';
    iframe.setAttribute('allowfullscreen','');
    modalInner.appendChild(iframe);
  }
  modalFull.classList.add('active');
  modalFull.setAttribute('aria-hidden','false');
}

modalClose.addEventListener('click', closeModal);
modalFull.addEventListener('click', (e) => {
  if (e.target === modalFull) closeModal();
});
function closeModal(){
  const el = modalInner.querySelector('video, iframe');
  if (el && el.tagName === 'VIDEO') {
    el.pause();
    el.src = '';
  }
  if (el && el.tagName === 'IFRAME') {
    try { el.contentWindow.postMessage('{"event":"command","func":"stopVideo","args":""}', '*'); } catch(e){}
    el.src = 'about:blank';
  }
  modalInner.innerHTML = '';
  modalFull.classList.remove('active');
  modalFull.setAttribute('aria-hidden','true');
}

/* VIDEOS */
function renderVideos() {
  const p = PAGES.videos || { title: 'Videos - STV', items: [] };
  const container = document.createElement('div');
  container.innerHTML = `<h3 style="margin-bottom:8px">${p.title}</h3>`;
  p.items.forEach(v => {
    const vEl = document.createElement('div');
    vEl.className = 'video-item';
    vEl.innerHTML = `
      <div class="meta">
        <div style="font-weight:600;margin-bottom:6px">${escapeHtml(v.title)}</div>
        <div style="font-size:13px;color:var(--color-muted)">Fuente: YouTube</div>
      </div>
      <div class="frame-wrap"><iframe loading="lazy" src="${v.src}${v.src.includes('enablejsapi=1') ? '' : (v.src.includes('?') ? '&enablejsapi=1' : '?enablejsapi=1')}" title="${escapeHtml(v.title)}" frameborder="0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>
    `;
    container.appendChild(vEl);
  });
  main.appendChild(container);

  initYouTubePlayers();
}

/* EnVi */
function renderEnVi() {
  const p = PAGES.envi || { title: 'EnVi', defaultStream: 'liga1max' };
  const container = document.createElement('div');
  container.innerHTML = `<h3 style="margin-bottom:8px">${p.title}</h3>`;
  container.innerHTML += `
    <div class="iframe-container">
      <div class="loader" id="loader"><span></span></div>
      <iframe id="videoIframe" allow="picture-in-picture" playsinline webkit-playsinline allowfullscreen></iframe>
    </div>
    <div class="controls" style="margin-top:8px">
      <div class="selector-line">
        <div class="selector">
          <span class="material-symbols-outlined">tv</span>
          <select id="canalSelector">
            <option value="espn">ESPN</option>
            <option value="espn2">ESPN2</option>
            <option value="espn3">ESPN3</option>
            <option value="disney2">Disney+</option>
            <option value="beinsport_xtra_espanol">BeiNsport</option>
            <option value="dsports">DSports</option>
            <option value="dsports2">DSports2</option>
            <option value="dsportsplus">DSports+</option>
            <option value="golperu">Gol Perú</option>
            <option value="liga1max">L1 Max</option>
            <option value="movistar">Movistar</option>
            <option value="premiere1">Premiere 1</option>
            <option value="premiere2">Premiere 2</option>
            <option value="premiere3">Premiere 3</option>
          </select>
        </div>
        <div class="botonxtra">
          <span id="liveBadge" class="live-badge"><span class="dot">●</span> LIVE</span>
          <button class="btn-icon" id="reloadBtn" title="Recargar canal">
            <span class="material-symbols-outlined">refresh</span>
          </button>
        </div>
      </div>
    </div>
  `;
  main.appendChild(container);

  const iframe = document.getElementById('videoIframe');
  const loader = document.getElementById('loader');
  const badge = document.getElementById('liveBadge');
  const canalSaved = localStorage.getItem('canalSeleccionado') || p.defaultStream || 'liga1max';
  const sel = document.getElementById('canalSelector');
  sel.value = canalSaved;
  iframe.src = `https://streamtp22.com/global1.php?stream=${canalSaved}`;

  iframe.onload = () => { if (loader) loader.style.display='none'; if (badge) badge.classList.add('visible'); }
  iframe.onerror = () => { if (loader) loader.style.display='none'; if (badge) badge.classList.remove('visible'); }

  sel.addEventListener('change', (e) => {
    const canal = e.target.value;
    localStorage.setItem('canalSeleccionado', canal);
    if (loader) loader.style.display = 'flex';
    if (badge) badge.classList.remove('visible');
    iframe.src = `https://streamtp22.com/global1.php?stream=${canal}`;
  });

  document.getElementById('reloadBtn').addEventListener('click', () => {
    if (loader) loader.style.display = 'flex';
    if (badge) badge.classList.remove('visible');
    iframe.src = iframe.src;
  });
}

/* ---------------------------
   YouTube Player handling to pause others
   --------------------------- */
let YT_ready = false;
let YT_players = [];

function onYouTubeIframeAPIReady() {
  YT_ready = true;
  YT_players = [];
  document.querySelectorAll('iframe[src*="youtube.com"]').forEach((iframe, idx) => {
    try {
      const id = 'ytplayer_' + idx;
      iframe.id = id;
      const player = new YT.Player(id, {
        events: {
          'onStateChange': (e) => {
            if (e.data === YT.PlayerState.PLAYING) {
              YT_players.forEach(p => { if (p !== player) try { p.pauseVideo(); } catch(e){} });
            }
          }
        }
      });
      YT_players.push(player);
    } catch(e){ /* ignore if fails */ }
  });
}
function initYouTubePlayers() {
  if (window.YT && window.YT.Player) {
    onYouTubeIframeAPIReady();
    return;
  }
  if (document.querySelector('iframe[src*="youtube.com"]')) {
    const script = document.createElement('script');
    script.src = "https://www.youtube.com/iframe_api";
    document.body.appendChild(script);
    window.onYouTubeIframeAPIReady = onYouTubeIframeAPIReady;
  }
}

/* ---------------------------
   Tab events, history, swipe gestures
   --------------------------- */
tabs.forEach(t => t.addEventListener('click', () => setActiveTab(t.dataset.tab)));
const last = localStorage.getItem(LS_TAB) || 'envi';
setActiveTab(last, false);
history.replaceState({tab:last}, '', `#${last}`);

window.addEventListener('popstate', (ev) => {
  const tab = (ev.state && ev.state.tab) || window.location.hash.replace('#','') || localStorage.getItem(LS_TAB) || 'envi';
  setActiveTab(tab, false);
});

let touchStartX = 0;
let touchEndX = 0;
const tabOrder = Array.from(tabs).map(t=>t.dataset.tab);
main.addEventListener('touchstart', (e) => touchStartX = e.changedTouches[0].screenX, {passive:true});
main.addEventListener('touchend', (e) => {
  touchEndX = e.changedTouches[0].screenX;
  const diff = touchEndX - touchStartX;
  if (Math.abs(diff) < 50) return;
  const current = localStorage.getItem(LS_TAB) || 'envi';
  let idx = tabOrder.indexOf(current);
  if (diff < 0 && idx < tabOrder.length-1) idx++;
  if (diff > 0 && idx > 0) idx--;
  setActiveTab(tabOrder[idx]);
}, {passive:true});

/* ---------------------------
   Notification panel toggle & clear
   --------------------------- */
notifToggle.addEventListener('click', () => {
  const open = notifPanel.classList.toggle('open');
  notifPanel.setAttribute('aria-hidden', open ? 'false' : 'true');
  if (open) renderNotifPanel();
});

clearAllBtn.addEventListener('click', () => {
  const notifs = loadNotificationsFromLS().map(n=>n.id);
  // marcar todos como removed/permanente
  const removed = getRemoved();
  notifs.forEach(id => {
    if (!removed.includes(id)) removed.push(id);
  });
  setRemoved(removed);
  // limpiar dismissed
  setDismissed([]);
  updateNotifBadge();
  renderNotifPanel();
});

/* ---------------------------
   Real-time watch for new notifications (v1.2)
   - Cada 15s consulta data/notifications.json y compara ids.
   - Si hay nuevas notificaciones -> las guarda en localStorage (sin incluir removed) y dispara showToastOnly para cada nueva.
   --------------------------- */
let watchInterval = null;
async function watchNotificationsRealtime() {
  // limpiar si ya existe
  if (watchInterval) clearInterval(watchInterval);

  watchInterval = setInterval(async () => {
    const latest = await fetchJSON('data/notifications.json', null);
    if (!latest) return;
    // filtrar out removals
    const removed = getRemoved();
    const latestFiltered = latest.filter(n => !removed.includes(n.id));
    const stored = loadNotificationsFromLS();
    const storedIds = stored.map(s => s.id);
    // detectar nuevos (ids en latestFiltered que no estén en stored)
    const newItems = latestFiltered.filter(l => !storedIds.includes(l.id));
    if (newItems.length > 0) {
      // actualizar copia local (mantener expirations, etc.), evitando duplicados
      const merged = [...stored];
      newItems.forEach(n => merged.push(n));
      localStorage.setItem(LS_NOTIFS, JSON.stringify(merged));
      updateNotifBadge();
      renderNotifPanel();
      // mostrar inmediatamente en pantalla (solo los no descartados)
      newItems.forEach(n => {
        if (!getDismissed().includes(n.id)) {
          // mostrar con pequeño delay para no sobreponer múltiples toasts instantáneos
          setTimeout(() => showToastOnly(n), 300);
        }
      });
    }
  }, 15000);
}

/* ---------------------------
   Initial load: fetch data and start notifs
   --------------------------- */
(async function init() {
  const notifs = await loadAllData();
  updateNotifBadge();
  renderNotifPanel();
  // Inicia la secuencia de notificaciones (delay 5s + 3s entre cada)
  startNotifSequence();
  // Inicia vigilancia en background para nuevas notificaciones en data/notifications.json
  watchNotificationsRealtime();
})();

document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopNotifSequence();
  else startNotifSequence();
});

/* Expose functions for debugging */
window.stv = {
  loadAllData, PAGES, renderNotifPanel, startNotifSequence, stopNotifSequence, executeNotificationOpen,
  getRemoved, getDismissed // helpers para debug
};

/* Service Worker register preserves your sw.js */
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(()=>{/* ignore */});
}
