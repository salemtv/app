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
   [SECCIÓN 5] - IMÁGENES (loader y visor nativo)
   ============================================================ */

function createSectionWrapper(){
  const wrap = document.createElement('div');
  wrap.className = 'section-loader';
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = '<div class="spinner"></div>';
  wrap.appendChild(overlay);
  return { wrap, overlay };
}

function renderImages(){
  const p = PAGES.images || { title: 'Imágenes - STV', items: [] };
  const container = document.createElement('div');
  container.innerHTML = `<h3 style="margin-bottom:8px">${p.title}</h3>`;

  const { wrap, overlay } = createSectionWrapper();
  const grid = document.createElement('div');
  grid.className = 'grid';
  wrap.appendChild(grid);
  container.appendChild(wrap);
  main.appendChild(container);

  const items = p.items || [];
  const total = items.length;
  let loaded = 0;
  let timedOut = false;

  // Espera hasta 7 segundos antes de mostrar "sin imágenes"
  const LOADING_TIMEOUT = 7000;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    overlay.remove();
    if (total === 0) {
      const no = document.createElement('p');
      no.style.color = 'var(--color-muted)';
      no.textContent = 'No hay imágenes disponibles.';
      container.appendChild(no);
    }
  }, LOADING_TIMEOUT);

  if (total === 0) return; // mantiene loader mientras se espera

  items.forEach(item => {
    const card = document.createElement('div');
    card.className = 'card';

    const img = document.createElement('img');
    img.loading = 'lazy';
    img.src = item.url;
    img.alt = item.name || '';

    const name = document.createElement('div');
    name.className = 'iname';
    name.textContent = item.name || '';

    card.appendChild(img);
    card.appendChild(name);
    grid.appendChild(card);

    // Cuando todas las imágenes cargan, ocultar loader
    function tryFinish() {
      loaded++;
      if (loaded >= total && !timedOut) {
        clearTimeout(timeoutId);
        overlay.remove();
      }
    }
    img.addEventListener('load', tryFinish);
    img.addEventListener('error', tryFinish);

    // Abrir imagen o video nativo según dispositivo
    card.addEventListener('click', () => {
      const target = item.video || item.url;
      if (/Mobi|Android|iPhone|iPad|iPod/.test(navigator.userAgent)) {
        location.href = target; // nativo
      } else {
        window.open(target, '_blank'); // escritorio
      }
    });
  });
}

/* ============================================================
   [SECCIÓN 6] - ENVI (lee desde envi.json)
   ============================================================ */

function renderEnVi(){
  const p = PAGES.envi || {
    title: 'EnVi',
    base_url: 'https://streamtp22.com/global1.php?stream=',
    default: 'liga1max',
    canales: []
  };

  const container = document.createElement('div');
  container.innerHTML = `<h3 style="margin-bottom:8px">${p.title}</h3>`;

  const wrap = document.createElement('div');
  wrap.className = 'section-loader';
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = '<div class="spinner"></div>';
  wrap.appendChild(overlay);

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
          <button class="btn-icon" id="reloadBtn" title="Recargar canal"><span class="material-symbols-outlined">refresh</span></button>
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

  // Poblar canales desde envi.json
  sel.innerHTML = '';
  (p.canales || []).forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.label || c.id;
    sel.appendChild(opt);
  });

  const saved = localStorage.getItem('canalSeleccionado') || p.default || (p.canales[0]?.id || '');
  sel.value = saved;
  iframe.src = `${p.base_url}${sel.value}`;

  iframe.onload = () => {
    if (loader) loader.style.display = 'none';
    if (badge) badge.classList.add('visible');
  };
  iframe.onerror = () => {
    if (loader) loader.style.display = 'none';
    if (badge) badge.classList.remove('visible');
  };

  sel.addEventListener('change', e => {
    const canal = e.target.value;
    localStorage.setItem('canalSeleccionado', canal);
    if (loader) loader.style.display = 'flex';
    if (badge) badge.classList.remove('visible');
    iframe.src = `${p.base_url}${canal}`;
  });

  const reloadBtn = document.getElementById('reloadBtn');
  reloadBtn.addEventListener('click', () => {
    if (loader) loader.style.display = 'flex';
    if (badge) badge.classList.remove('visible');
    iframe.src = iframe.src;
  });

  setTimeout(() => overlay.remove(), 1800);
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
   [SECCIÓN 8] - TABS & NAVEGACIÓN (sin swipe)
   ============================================================ */

tabs.forEach(t => t.addEventListener('click', () => setActiveTab(t.dataset.tab)));

const last = localStorage.getItem(LS_TAB) || 'envi';
setActiveTab(last, false);
history.replaceState({ tab: last }, '', `#${last}`);

window.addEventListener('popstate', ev => {
  const tab = (ev.state && ev.state.tab) || window.location.hash.replace('#', '') || localStorage.getItem(LS_TAB) || 'envi';
  setActiveTab(tab, false);
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
   [SECCIÓN 10] - INIT + PROTECCIONES APP-LIKE
   ============================================================ */

(async function init(){
  await loadAllData();
  updateNotifBadge();
  renderNotifPanel();
  startNotifSequence();
  watchNotificationsRealtime();

  // Bloqueos tipo App
  document.addEventListener('contextmenu', e => e.preventDefault());
  document.documentElement.style.userSelect = 'none';

  window.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && ['=', '+', '-', '0'].includes(e.key)) e.preventDefault();
  }, { passive: false });

  window.addEventListener('wheel', e => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
  window.addEventListener('gesturestart', e => e.preventDefault(), { passive: false });
  window.addEventListener('gesturechange', e => e.preventDefault(), { passive: false });
  window.addEventListener('gestureend', e => e.preventDefault(), { passive: false });

  // Evitar doble-tap zoom
  let lastTouch = 0;
  document.addEventListener('touchend', e => {
    const now = Date.now();
    if (now - lastTouch <= 300) e.preventDefault();
    lastTouch = now;
  }, { passive: false });

  // Bloquear arrastre de imágenes
  document.querySelectorAll('img').forEach(i => i.setAttribute('draggable', 'false'));

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();

document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopNotifSequence();
  else startNotifSequence();
});