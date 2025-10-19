/* ============================================================
   SALEMTV - APP.JS v1.3
   Basado íntegramente en v1.2 (se conserva TODO no modificado)
   Cambios principales:
     - Fix swipe duplication bug (debounce + lock)
     - Notifications: LS_SHOWN (prevent re-show), badge counts non-removed notifs
     - Open action hides panel
     - Videos: dynamic playlist (videos.json -> title + sources[])
     - EnVi: moved to envi.json structure (base_url, default, canales[])
     - Section loaders + localStorage caching (TTL)
   ============================================================
*/

/* ============================================================
   [SECCIÓN 1] - VARIABLES GLOBALES Y CONSTANTES
   ============================================================ */

const PAGES = {};
const LS_TAB = "stv_selected_tab";
const LS_NOTIFS = "stv_notifications";
const LS_DISMISSED = "stv_notif_dismissed"; // backwards compat (treated as shown)
const LS_REMOVED = "stv_notif_removed";
const LS_SHOWN = "stv_notif_shown"; // notifs that have been shown as toast (prevents re-show)
const CACHE_PREFIX = "stv_cache_";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes default cache for JSON

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
let activeToastTimeout = null;
let highlightTimeout = null;

/* Swipe safety */
let touchStartX = 0;
let touchEndX = 0;
let swipeLock = false; // prevents duplicate/rapid firings
const SWIPE_LOCK_MS = 500; // min gap between swipe triggers

/* ============================================================
   [SECCIÓN 2] - UTILIDADES (helpers)
   ============================================================ */

function nowIso() { return new Date().toISOString(); }
function setCache(key, value) {
  const payload = { ts: Date.now(), data: value };
  localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(payload));
}
function getCache(key) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (Date.now() - (p.ts || 0) > CACHE_TTL_MS) {
      localStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }
    return p.data;
  } catch { return null; }
}
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
  return diff;
}
function getDismissed(){ return JSON.parse(localStorage.getItem(LS_DISMISSED) || '[]'); } // legacy
function setDismissed(arr){ localStorage.setItem(LS_DISMISSED, JSON.stringify(arr)); }
function getRemoved(){ return JSON.parse(localStorage.getItem(LS_REMOVED) || '[]'); }
function setRemoved(arr){ localStorage.setItem(LS_REMOVED, JSON.stringify(arr)); }
function getShown(){ // shown toasts (prevent re-show)
  // merge legacy dismissed to preserve prior behavior
  const legacy = JSON.parse(localStorage.getItem(LS_DISMISSED) || '[]');
  const shown = JSON.parse(localStorage.getItem(LS_SHOWN) || '[]');
  const merged = Array.from(new Set([ ...legacy, ...shown ]));
  return merged;
}
function setShown(arr){ localStorage.setItem(LS_SHOWN, JSON.stringify(arr)); }

/* ============================================================
   [SECCIÓN 3] - CARGA DE DATOS, CACHE Y LOCALSTORAGE
   ============================================================ */

async function fetchJSON(path, fallback=null, useCacheKey=null) {
  // try cache first (if key provided)
  if (useCacheKey) {
    const cached = getCache(useCacheKey);
    if (cached) return cached;
  }
  try {
    const r = await fetch(path, { cache: "no-cache" });
    if (!r.ok) throw new Error('fetch failed ' + r.status);
    const json = await r.json();
    if (useCacheKey) setCache(useCacheKey, json);
    return json;
  } catch (e) {
    console.warn('fetchJSON failed', path, e);
    // fallback to localStorage copy if present
    if (useCacheKey) {
      const cached = getCache(useCacheKey);
      if (cached) return cached;
    }
    return fallback;
  }
}

function saveNotifsToLS(notifs) {
  const removed = getRemoved();
  const filtered = (notifs || []).filter(n => !removed.includes(n.id));
  localStorage.setItem(LS_NOTIFS, JSON.stringify(filtered));
}

async function loadAllData() {
  // Use caching where beneficial
  const [ images, videos, envi, notifs ] = await Promise.all([
    fetchJSON('data/images.json', null, 'images'),
    fetchJSON('data/videos.json', null, 'videos'),
    fetchJSON('data/envi.json', null, 'envi'),
    fetchJSON('data/notifications.json', null, 'notifications')
  ]);

  if (notifs) saveNotifsToLS(notifs);
  PAGES.images = images || { title: 'Imágenes - STV', items: [] };
  PAGES.videos = videos || { title: 'Videos - STV', items: [] };
  PAGES.envi = envi || { title: 'EnVi', base_url: 'https://streamtp22.com/global1.php?stream=', default: 'liga1max', canales: [{id:'liga1max', label:'L1 Max'}] };

  return JSON.parse(localStorage.getItem(LS_NOTIFS) || '[]');
}

/* ============================================================
   [SECCIÓN 4] - SISTEMA DE NOTIFICACIONES (mejorado)
   ============================================================ */

/* Notes: 
   - Badge counts all non-removed notifications (so user sees total)
   - LS_SHOWN keeps track of which notifications already showed as toast (so they don't reappear)
   - LS_REMOVED stores permanently deleted ones
*/

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

function updateNotifBadge() {
  const notifs = loadNotificationsFromLS();
  // badge should count all not removed (historic), even if already shown
  notifCountEl.style.display = notifs.length ? 'inline-block' : 'none';
  notifCountEl.textContent = notifs.length;
}

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
        if (n) {
          // hide panel to visualize content
          notifPanel.classList.remove('open');
          notifPanel.setAttribute('aria-hidden','true');
          executeNotificationOpen(n);
        }
      } else if (action === 'delete') {
        // remove permanently
        let notifs = loadNotificationsFromLS();
        notifs = notifs.filter(x => x.id !== id);
        localStorage.setItem(LS_NOTIFS, JSON.stringify(notifs));
        // register as removed to avoid re-import
        const removed = getRemoved();
        if (!removed.includes(id)) removed.push(id);
        setRemoved(removed);
        // also clear from shown list
        const shown = getShown().filter(x => x !== id);
        setShown(shown);
        updateNotifBadge();
        renderNotifPanel();
      }
    });
  });

  updateNotifBadge();
}

/* Toast handling: use LS_SHOWN to prevent re-show; do NOT decrement badge on show.
   The user asked the badge to remain until deletion. */
function showToastOnly(notif) {
  if (!notif || !notif.id) return;
  const removed = getRemoved();
  if (removed.includes(notif.id)) return;

  const shown = getShown();
  if (shown.includes(notif.id)) return; // already shown once

  // mark as shown (so it won't appear again)
  shown.push(notif.id);
  setShown(shown);

  // render toast
  if (activeToastTimeout) clearTimeout(activeToastTimeout);
  toastEl.innerHTML = `
    <div class="toast-header">
      <div>${escapeHtml(notif.title || 'Notificación')}</div>
      <button class="toast-close" aria-label="Cerrar">×</button>
    </div>
    <div class="toast-body">${escapeHtml(notif.body || notif.content || '')}</div>
  `;
  toastEl.classList.add('show');

  toastEl.querySelector('.toast-close').addEventListener('click', hideToast);
  // auto-hide after 3s
  activeToastTimeout = setTimeout(hideToast, 3000);
}

function hideToast() {
  toastEl.classList.remove('show');
  setTimeout(() => { toastEl.innerHTML = ''; }, 300);
}

/* Sequence: 5s initial then 3s between notifications, but only for not shown & not removed */
let notifSequenceRunning = false;
async function startNotifSequence() {
  if (notifSequenceRunning) return;
  notifSequenceRunning = true;
  const notifs = loadNotificationsFromLS();
  if (!notifs.length) { notifSequenceRunning = false; return; }

  // initial delay
  await new Promise(r => setTimeout(r, 5000));

  for (const n of notifs) {
    const shown = getShown();
    const removed = getRemoved();
    if (removed.includes(n.id) || shown.includes(n.id)) continue;
    showToastOnly(n);
    await new Promise(r => setTimeout(r, 3500));
  }
  notifSequenceRunning = false;
}

function stopNotifSequence() {
  if (activeToastTimeout) clearTimeout(activeToastTimeout);
  hideToast();
  notifSequenceRunning = false;
}

/* ============================================================
   [SECCIÓN 5] - RENDERIZADO PESTAÑAS / IMÁGENES / VIDEOS / ENVI
   ============================================================ */

/* Helper: create section loader DOM wrapper */
function createSectionWrapper() {
  const wrap = document.createElement('div');
  wrap.className = 'section-loader';
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = `<div class="spinner"></div>`;
  wrap.appendChild(overlay);
  return { wrap, overlay };
}

/* Images: show loader until thumbnails loaded or timeout */
function renderImages() {
  const p = PAGES.images || { title: 'Imágenes - STV', items: [] };
  const container = document.createElement('div');
  container.innerHTML = `<h3 style="margin-bottom:8px">${p.title}</h3>`;

  const { wrap, overlay } = createSectionWrapper();
  const grid = document.createElement('div');
  grid.className = 'grid';
  wrap.appendChild(grid);
  container.appendChild(wrap);
  main.appendChild(container);

  // Insert placeholders then load images
  const items = p.items || [];
  let loadedCount = 0;
  const total = items.length;
  const LOADING_TIMEOUT = 5000;
  let timeoutId = setTimeout(() => {
    // remove overlay after timeout even if some fail
    overlay.remove();
  }, LOADING_TIMEOUT);

  if (total === 0) {
    overlay.remove();
    const no = document.createElement('p');
    no.style.color = 'var(--color-muted)';
    no.textContent = 'No hay imágenes';
    container.appendChild(no);
    return;
  }

  items.forEach(item => {
    const c = document.createElement('div'); c.className = 'card';
    const img = document.createElement('img');
    img.loading = 'lazy';
    img.src = item.url;
    img.alt = item.name || '';
    const nameDiv = document.createElement('div'); nameDiv.className='iname'; nameDiv.textContent = item.name || '';
    c.appendChild(img);
    c.appendChild(nameDiv);
    grid.appendChild(c);

    img.addEventListener('load', () => {
      loadedCount++;
      if (loadedCount === total) {
        clearTimeout(timeoutId);
        overlay.remove();
      }
    });
    img.addEventListener('error', () => {
      loadedCount++;
      if (loadedCount === total) {
        clearTimeout(timeoutId);
        overlay.remove();
      }
    });

    img.addEventListener('click', () => openImagePlayer(item));
  });
}

/* Videos: completely reworked
   - videos.json expected format:
     {
       "title": "Videos - STV",
       "items": [
         { "id": "v1", "title":"Resumen", "sources": [{ "label":"YouTube", "src":"https://www.youtube.com/embed/ID" }, { "label":"MP4", "src":"https://..." }] },
         ...
       ]
     }
   - Player supports switching sources without page reload.
*/
function renderVideos() {
  const p = PAGES.videos || { title: 'Videos - STV', items: [] };
  const container = document.createElement('div');
  container.innerHTML = `<h3 style="margin-bottom:8px">${p.title}</h3>`;

  const { wrap, overlay } = createSectionWrapper();
  wrap.style.minHeight = '260px';
  const playerBox = document.createElement('div');
  playerBox.className = 'video-player';
  wrap.appendChild(playerBox);

  const playlist = document.createElement('div');
  playlist.className = 'video-playlist';
  wrap.appendChild(playlist);

  container.appendChild(wrap);
  main.appendChild(container);

  const items = p.items || [];
  if (!items.length) {
    overlay.remove();
    const no = document.createElement('p'); no.style.color = 'var(--color-muted)'; no.textContent = 'No hay videos';
    container.appendChild(no);
    return;
  }

  // default to first item and first source
  let currentItem = items[0];
  let currentSource = currentItem.sources && currentItem.sources[0];

  function renderPlayer() {
    playerBox.innerHTML = ''; // clear
    if (!currentSource) {
      playerBox.innerHTML = `<div style="padding:20px;color:var(--color-muted)">Fuente inválida</div>`;
      return;
    }
    // Handle video types (mp4/webm) vs iframe (youtube)
    const src = currentSource.src;
    if (/\.(mp4|webm|ogg)(\?|$)/i.test(src)) {
      const video = document.createElement('video');
      video.src = src;
      video.controls = true;
      video.autoplay = false;
      video.playsInline = true;
      video.style.width = '100%';
      video.style.height = '100%';
      playerBox.appendChild(video);
      // when metadata loaded, remove overlay
      video.addEventListener('loadeddata', () => { overlay.remove(); });
      video.addEventListener('error', () => { overlay.remove(); });
    } else {
      const iframe = document.createElement('iframe');
      iframe.src = src.includes('youtube.com') && !src.includes('enablejsapi') ? src + (src.includes('?') ? '&enablejsapi=1' : '?enablejsapi=1') : src;
      iframe.allow = 'autoplay; encrypted-media; picture-in-picture';
      iframe.setAttribute('allowfullscreen','');
      iframe.style.width = '100%';
      iframe.style.height = '100%';
      playerBox.appendChild(iframe);
      iframe.addEventListener('load', () => { overlay.remove(); });
      // fallback removal after 3s if load not triggered
      setTimeout(() => { overlay.remove(); }, 3000);
    }
  }

  // Build playlist UI
  items.forEach(item => {
    const playEl = document.createElement('div');
    playEl.className = 'video-item-playlist';
    playEl.textContent = item.title || 'Sin título';
    playEl.dataset.itemId = item.id;
    playEl.addEventListener('click', () => {
      // switch to selected item, keep first source by default
      currentItem = item;
      currentSource = (item.sources && item.sources[0]) || null;
      // mark active
      playlist.querySelectorAll('.video-item-playlist').forEach(n => n.classList.remove('active'));
      playEl.classList.add('active');
      // show loader and render player
      const overlayEl = wrap.querySelector('.overlay');
      if (overlayEl && !overlayEl.parentNode) wrap.appendChild(overlayEl);
      renderPlayer();
      // also if item has multiple sources, show sub-list
      renderSources();
    });
    playlist.appendChild(playEl);
  });

  function renderSources() {
    // remove existing sources list if any
    const existing = wrap.querySelector('.video-sources');
    if (existing) existing.remove();
    const sourcesWrap = document.createElement('div');
    sourcesWrap.className = 'video-sources';
    sourcesWrap.style.display = 'flex';
    sourcesWrap.style.gap = '8px';
    sourcesWrap.style.marginTop = '8px';
    const srcs = currentItem.sources || [];
    srcs.forEach(s => {
      const btn = document.createElement('button');
      btn.className = 'btn-small';
      btn.textContent = s.label || 'Fuente';
      btn.addEventListener('click', () => {
        // switch source without reload of whole page
        currentSource = s;
        // show loader
        const overlayEl = wrap.querySelector('.overlay');
        if (overlayEl && !overlayEl.parentNode) wrap.appendChild(overlayEl);
        renderPlayer();
      });
      sourcesWrap.appendChild(btn);
    });
    wrap.appendChild(sourcesWrap);
  }

  // boot: mark first playlist item active
  const firstPlaylistItem = playlist.querySelector('.video-item-playlist');
  if (firstPlaylistItem) firstPlaylistItem.classList.add('active');
  renderPlayer();
  renderSources();
}

/* EnVi: now reads from PAGES.envi (envi.json) with structure:
   { "title":"EnVi", "base_url":"...", "default":"liga1max", "canales":[ { "id":"espn","label":"ESPN" }, ... ] }
*/
function renderEnVi() {
  const p = PAGES.envi || { title: 'EnVi', base_url: 'https://streamtp22.com/global1.php?stream=', default: 'liga1max', canales: [] };
  const container = document.createElement('div');
  container.innerHTML = `<h3 style="margin-bottom:8px">${p.title}</h3>`;
  const { wrap, overlay } = createSectionWrapper();

  wrap.innerHTML += `
    <div class="iframe-container">
      <div class="loader" id="loader"><span></span></div>
      <iframe id="videoIframe" allow="picture-in-picture" playsinline webkit-playsinline allowfullscreen></iframe>
    </div>
    <div class="controls" style="margin-top:8px">
      <div class="selector-line">
        <div class="selector">
          <span class="material-symbols-outlined">tv</span>
          <select id="canalSelector"></select>
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
  container.appendChild(wrap);
  main.appendChild(container);

  const iframe = document.getElementById('videoIframe');
  const loader = document.getElementById('loader');
  const badge = document.getElementById('liveBadge');
  const sel = document.getElementById('canalSelector');

  // populate select from p.canales
  sel.innerHTML = '';
  (p.canales || []).forEach(ch => {
    const opt = document.createElement('option');
    opt.value = ch.id;
    opt.textContent = ch.label || ch.id;
    sel.appendChild(opt);
  });

  const saved = localStorage.getItem('canalSeleccionado') || p.default || (p.canales && p.canales[0] && p.canales[0].id) || '';
  sel.value = saved;
  // build iframe src using base_url
  iframe.src = `${p.base_url}${sel.value}`;

  iframe.onload = () => { if (loader) loader.style.display='none'; if (badge) badge.classList.add('visible'); }
  iframe.onerror = () => { if (loader) loader.style.display='none'; if (badge) badge.classList.remove('visible'); }

  sel.addEventListener('change', (e) => {
    const canal = e.target.value;
    localStorage.setItem('canalSeleccionado', canal);
    if (loader) loader.style.display = 'flex';
    if (badge) badge.classList.remove('visible');
    iframe.src = `${p.base_url}${canal}`;
  });

  document.getElementById('reloadBtn').addEventListener('click', () => {
    if (loader) loader.style.display = 'flex';
    if (badge) badge.classList.remove('visible');
    iframe.src = iframe.src;
  });
}

/* Public renderPage */
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

/* ============================================================
   [SECCIÓN 6] - YOUTUBE PLAYER HANDLING (preserved)
   ============================================================ */

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

/* ============================================================
   [SECCIÓN 7] - TABS, HISTORY, SWIPE GESTURES (fixes)
   ============================================================ */

tabs.forEach(t => t.addEventListener('click', () => setActiveTab(t.dataset.tab)));
const last = localStorage.getItem(LS_TAB) || 'envi';
setActiveTab(last, false);
history.replaceState({tab:last}, '', `#${last}`);

window.addEventListener('popstate', (ev) => {
  const tab = (ev.state && ev.state.tab) || window.location.hash.replace('#','') || localStorage.getItem(LS_TAB) || 'envi';
  setActiveTab(tab, false);
});

/* Swipe gestures with lock/debounce to avoid duplicate rendering which produced white-screen */
main.addEventListener('touchstart', (e) => {
  if (!e.changedTouches || !e.changedTouches[0]) return;
  touchStartX = e.changedTouches[0].screenX;
}, {passive:true});

main.addEventListener('touchend', (e) => {
  if (!e.changedTouches || !e.changedTouches[0]) return;
  touchEndX = e.changedTouches[0].screenX;
  const diff = touchEndX - touchStartX;
  if (Math.abs(diff) < 50) return;
  // guard against rapid successive swipes
  if (swipeLock) return;
  swipeLock = true;
  setTimeout(()=> swipeLock = false, SWIPE_LOCK_MS);

  const current = localStorage.getItem(LS_TAB) || 'envi';
  const tabOrder = Array.from(tabs).map(t=>t.dataset.tab);
  let idx = tabOrder.indexOf(current);
  if (diff < 0 && idx < tabOrder.length-1) idx++;
  if (diff > 0 && idx > 0) idx--;
  setActiveTab(tabOrder[idx]);
}, {passive:true});

/* ============================================================
   [SECCIÓN 8] - NOTIFICATION PANEL TOGGLE, CLEAR ALL
   ============================================================ */

notifToggle.addEventListener('click', () => {
  const open = notifPanel.classList.toggle('open');
  notifPanel.setAttribute('aria-hidden', open ? 'false' : 'true');
  if (open) renderNotifPanel();
});

clearAllBtn.addEventListener('click', () => {
  const notifs = loadNotificationsFromLS().map(n=>n.id);
  // mark all as removed permanently
  const removed = getRemoved();
  notifs.forEach(id => { if (!removed.includes(id)) removed.push(id); });
  setRemoved(removed);
  // clear shown list
  setShown([]);
  updateNotifBadge();
  renderNotifPanel();
});

/* ============================================================
   [SECCIÓN 9] - WATCH REAL-TIME FOR NEW NOTIFICATIONS
   ============================================================ */

let watchInterval = null;
async function watchNotificationsRealtime() {
  if (watchInterval) clearInterval(watchInterval);
  watchInterval = setInterval(async () => {
    const latest = await fetchJSON('data/notifications.json', null, 'notifications');
    if (!latest) return;
    const removed = getRemoved();
    const latestFiltered = latest.filter(n => !removed.includes(n.id));
    const stored = loadNotificationsFromLS();
    const storedIds = stored.map(s => s.id);
    const newItems = latestFiltered.filter(l => !storedIds.includes(l.id));
    if (newItems.length > 0) {
      // merge without duplicates
      const merged = [ ...stored ];
      newItems.forEach(n => merged.push(n));
      localStorage.setItem(LS_NOTIFS, JSON.stringify(merged));
      updateNotifBadge();
      renderNotifPanel();
      // show immediately but respecting shown list
      newItems.forEach(n => {
        setTimeout(() => showToastOnly(n), 300);
      });
    }
  }, 15000);
}

/* ============================================================
   [SECCIÓN 10] - INIT
   ============================================================ */

(async function init() {
  await loadAllData();
  updateNotifBadge();
  renderNotifPanel();
  startNotifSequence();
  watchNotificationsRealtime();
})();

document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopNotifSequence();
  else startNotifSequence();
});

window.stv = {
  loadAllData, PAGES, renderNotifPanel, startNotifSequence, stopNotifSequence,
  getRemoved, getShown // helpers for debugging
};

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(()=>{/* ignore */});
}
