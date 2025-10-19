/* ============================================================
   SALEMTV - APP.JS v1.4
   Basado en v1.3; conserva todo no modificado y aplica
   las correcciones solicitadas en v1.4.
   - Se elimina la sección Videos (solo queda la pestaña vacía)
   - EnVi consume `envi.json`
   - Swipe gestures removidos (no hay cambio de pestaña por slide)
   - Loader visible SOLO para Imágenes
   - Imágenes abren recurso nativo (window.open / location.href)
   - Bloqueo de contextmenu, selección, zoom (lo más robusto posible)
   ============================================================ */

/* ============================================================
   [SECCIÓN 1] - VARIABLES GLOBALES Y CONSTANTES
   ============================================================ */

const PAGES = {};
const LS_TAB = "stv_selected_tab";
const LS_NOTIFS = "stv_notifications";
const LS_DISMISSED = "stv_notif_dismissed";
const LS_REMOVED = "stv_notif_removed";
const LS_SHOWN = "stv_notif_shown";
const CACHE_PREFIX = "stv_cache_";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5m cache

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

let activeToastTimeout = null;
let highlightTimeout = null;

/* ============================================================
   [SECCIÓN 2] - UTILIDADES
   ============================================================ */

function nowIso(){ return new Date().toISOString(); }
function setCache(key, value){ const payload={ts:Date.now(), data:value}; localStorage.setItem(CACHE_PREFIX+key, JSON.stringify(payload)); }
function getCache(key){ try { const raw = localStorage.getItem(CACHE_PREFIX+key); if(!raw) return null; const p = JSON.parse(raw); if(Date.now() - (p.ts||0) > CACHE_TTL_MS){ localStorage.removeItem(CACHE_PREFIX+key); return null; } return p.data; } catch { return null; } }
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function formatDDMM(iso){ const d=new Date(iso); return `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}`; }
function daysBetween(dateIso){ const now=new Date(); now.setHours(0,0,0,0); const target=new Date(dateIso); target.setHours(0,0,0,0); return Math.round((target-now)/(1000*60*60*24)); }
function getDismissed(){ return JSON.parse(localStorage.getItem(LS_DISMISSED) || '[]'); }
function setDismissed(arr){ localStorage.setItem(LS_DISMISSED, JSON.stringify(arr)); }
function getRemoved(){ return JSON.parse(localStorage.getItem(LS_REMOVED) || '[]'); }
function setRemoved(arr){ localStorage.setItem(LS_REMOVED, JSON.stringify(arr)); }
function getShown(){ const legacy = JSON.parse(localStorage.getItem(LS_DISMISSED) || '[]'); const shown = JSON.parse(localStorage.getItem(LS_SHOWN) || '[]'); return Array.from(new Set([...legacy, ...shown])); }
function setShown(arr){ localStorage.setItem(LS_SHOWN, JSON.stringify(arr)); }

/* ============================================================
   [SECCIÓN 3] - FETCH/CACHE Y CARGA INICIAL
   ============================================================ */

async function fetchJSON(path, fallback=null, useCacheKey=null) {
  if (useCacheKey) {
    const c = getCache(useCacheKey);
    if (c) return c;
  }
  try {
    const r = await fetch(path, { cache: "no-cache" });
    if (!r.ok) throw new Error('fetch fail '+r.status);
    const j = await r.json();
    if (useCacheKey) setCache(useCacheKey, j);
    return j;
  } catch (e) {
    console.warn('fetchJSON failed', path, e);
    const c = useCacheKey ? getCache(useCacheKey) : null;
    if (c) return c;
    return fallback;
  }
}

function saveNotifsToLS(notifs) {
  const removed = getRemoved();
  const filtered = (notifs||[]).filter(n => !removed.includes(n.id));
  localStorage.setItem(LS_NOTIFS, JSON.stringify(filtered));
}

async function loadAllData() {
  const [images, videos, envi, notifs] = await Promise.all([
    fetchJSON('data/images.json', null, 'images'),
    // videos.json intentionally still fetched for backward compatibility but we won't render it; we can cache
    fetchJSON('data/videos.json', null, 'videos'),
    fetchJSON('data/envi.json', null, 'envi'),
    fetchJSON('data/notifications.json', null, 'notifications')
  ]);

  if (notifs) saveNotifsToLS(notifs);
  PAGES.images = images || { title: 'Imágenes - STV', items: [] };
  // videos removed: keep data stored but do NOT render it
  PAGES.videos = videos || { title: 'Videos - STV', items: [] };
  // Important: use envi.json (must exist) for EnVi behavior
  PAGES.envi = envi || { title:'EnVi', base_url:'https://streamtp22.com/global1.php?stream=', default:'liga1max', canales:[] };

  return JSON.parse(localStorage.getItem(LS_NOTIFS) || '[]');
}

/* ============================================================
   [SECCIÓN 4] - SISTEMA DE NOTIFICACIONES (sin cambios funcionales)
   ============================================================ */

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
  notifCountEl.style.display = notifs.length ? 'inline-block' : 'none';
  notifCountEl.textContent = notifs.length;
}

function renderNotifPanel() {
  const notifs = loadNotificationsFromLS();
  notifList.innerHTML = '';
  if (!notifs.length) {
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
          // hide panel immediately
          notifPanel.classList.remove('open');
          notifPanel.setAttribute('aria-hidden','true');
          executeNotificationOpen(n);
        }
      } else if (action === 'delete') {
        let notifs = loadNotificationsFromLS();
        notifs = notifs.filter(x => x.id !== id);
        localStorage.setItem(LS_NOTIFS, JSON.stringify(notifs));
        const removed = getRemoved();
        if (!removed.includes(id)) removed.push(id);
        setRemoved(removed);
        const shown = getShown().filter(x => x !== id);
        setShown(shown);
        updateNotifBadge();
        renderNotifPanel();
      }
    });
  });

  updateNotifBadge();
}

/* Toast handling (same as v1.3) */
function showToastOnly(notif) {
  if (!notif || !notif.id) return;
  const removed = getRemoved();
  if (removed.includes(notif.id)) return;
  const shown = getShown();
  if (shown.includes(notif.id)) return;
  shown.push(notif.id);
  setShown(shown);

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
  activeToastTimeout = setTimeout(hideToast, 3000);
}
function hideToast(){ toastEl.classList.remove('show'); setTimeout(()=> toastEl.innerHTML='', 300); }

let notifSequenceRunning = false;
async function startNotifSequence() {
  if (notifSequenceRunning) return;
  notifSequenceRunning = true;
  const notifs = loadNotificationsFromLS();
  if (!notifs.length) { notifSequenceRunning = false; return; }
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

function stopNotifSequence(){ if (activeToastTimeout) clearTimeout(activeToastTimeout); hideToast(); notifSequenceRunning = false; }

/* ============================================================
   [SECCIÓN 5] - RENDER IMÁGENES (loader + native open)
   ============================================================ */

function createSectionWrapper() {
  const wrap = document.createElement('div');
  wrap.className = 'section-loader';
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = `<div class="spinner"></div>`;
  wrap.appendChild(overlay);
  return { wrap, overlay };
}

function renderImages() {
  const p = PAGES.images || { title: 'Imágenes - STV', items: [] };
  const container = document.createElement('div');
  container.innerHTML = `<h3 style="margin-bottom:8px">${p.title}</h3>`;
  const { wrap, overlay } = createSectionWrapper();
  const grid = document.createElement('div'); grid.className = 'grid';
  wrap.appendChild(grid);
  container.appendChild(wrap);
  main.appendChild(container);

  const items = p.items || [];
  let loaded = 0;
  const total = items.length;

  // show loader until fetch+assets finish OR timeout
  const LOADING_TIMEOUT = 7000;
  let timedOut = false;
  const timeoutId = setTimeout(()=> { timedOut=true; overlay.remove(); }, LOADING_TIMEOUT);

  if (total === 0) {
    // still wait a short moment for possible async fetch (avoid immediate "no images")
    // We'll remove overlay after timeout and show no images message then.
    // Keep overlay until timeout.
    clearTimeout(timeoutId);
    setTimeout(()=> {
      overlay.remove();
      const no = document.createElement('p'); no.style.color='var(--color-muted)'; no.textContent='No hay imágenes';
      container.appendChild(no);
    }, 800);
    return;
  }

  items.forEach(item => {
    const c = document.createElement('div'); c.className='card';
    const img = document.createElement('img');
    img.loading = 'lazy';
    img.alt = item.name || '';
    img.src = item.url;
    const nameDiv = document.createElement('div'); nameDiv.className='iname'; nameDiv.textContent = item.name || '';
    c.appendChild(img); c.appendChild(nameDiv);
    grid.appendChild(c);

    function tryFinish(){
      loaded++;
      if (loaded >= total && !timedOut) {
        clearTimeout(timeoutId);
        overlay.remove();
      }
    }

    img.addEventListener('load', tryFinish);
    img.addEventListener('error', tryFinish);

    // open resource natively on click/touch:
    // if item.video exists -> open video url (native player on mobile)
    // else open image url (new tab / native viewer)
    c.addEventListener('click', (e) => {
      e.preventDefault();
      const target = item.video || item.url;
      // prefer same-tab navigation on mobile to use native viewer; on desktop open new tab
      try {
        if (/Mobi|Android|iPhone|iPad|iPod/.test(navigator.userAgent)) {
          location.href = target;
        } else {
          window.open(target, '_blank');
        }
      } catch (err) {
        window.open(target, '_blank');
      }
    });
  });
}

/* ============================================================
   [SECCIÓN 6] - ENVI (ahora usa envi.json)
   ============================================================ */

function renderEnVi() {
  const p = PAGES.envi || { title:'EnVi', base_url:'https://streamtp22.com/global1.php?stream=', default:'liga1max', canales:[] };
  const container = document.createElement('div');
  container.innerHTML = `<h3 style="margin-bottom:8px">${p.title}</h3>`;

  // Use the iframe layout from previous versions, but source is built from envi.json
  const wrap = document.createElement('div');
  wrap.className = 'section-loader';
  const overlay = document.createElement('div'); overlay.className='overlay';
  overlay.innerHTML = `<div class="spinner"></div>`;
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

  // populate from PAGES.envi
  sel.innerHTML = '';
  (p.canales || []).forEach(ch => {
    const opt = document.createElement('option'); opt.value = ch.id; opt.textContent = ch.label || ch.id; sel.appendChild(opt);
  });

  const saved = localStorage.getItem('canalSeleccionado') || p.default || (p.canales && p.canales[0] && p.canales[0].id) || '';
  sel.value = saved;
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

  const reloadBtn = document.getElementById('reloadBtn');
  reloadBtn.addEventListener('click', () => {
    if (loader) loader.style.display = 'flex';
    if (badge) badge.classList.remove('visible');
    iframe.src = iframe.src;
  });

  // remove overlay ASAP after initial load or fallback
  setTimeout(()=> { const ov = wrap.querySelector('.overlay'); if (ov) ov.remove(); }, 2000);
}

/* ============================================================
   [SECCIÓN 7] - YT API (preserved)
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
    } catch(e){}
  });
}
function initYouTubePlayers() {
  if (window.YT && window.YT.Player) { onYouTubeIframeAPIReady(); return;}
  if (document.querySelector('iframe[src*="youtube.com"]')) {
    const script = document.createElement('script'); script.src = "https://www.youtube.com/iframe_api"; document.body.appendChild(script);
    window.onYouTubeIframeAPIReady = onYouTubeIframeAPIReady;
  }
}

/* ============================================================
   [SECCIÓN 8] - TABS, HISTORY (NO SWIPE)
   ============================================================ */

tabs.forEach(t => t.addEventListener('click', () => setActiveTab(t.dataset.tab)));
const last = localStorage.getItem(LS_TAB) || 'envi';
setActiveTab(last, false);
history.replaceState({tab:last}, '', `#${last}`);

window.addEventListener('popstate', (ev) => {
  const tab = (ev.state && ev.state.tab) || window.location.hash.replace('#','') || localStorage.getItem(LS_TAB) || 'envi';
  setActiveTab(tab, false);
});

/* Note: swipe gestures REMOVED to prevent duplication bugs */

/* ============================================================
   [SECCIÓN 9] - NOTIF PANEL TOGGLE & CLEAR ALL
   ============================================================ */

notifToggle.addEventListener('click', () => {
  const open = notifPanel.classList.toggle('open');
  notifPanel.setAttribute('aria-hidden', open ? 'false' : 'true');
  if (open) renderNotifPanel();
});

clearAllBtn.addEventListener('click', () => {
  const notifs = loadNotificationsFromLS().map(n => n.id);
  const removed = getRemoved();
  notifs.forEach(id => { if (!removed.includes(id)) removed.push(id); });
  setRemoved(removed);
  setShown([]);
  updateNotifBadge();
  renderNotifPanel();
});

/* ============================================================
   [SECCIÓN 10] - WATCH NOTIFICATIONS (preserved)
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
      const merged = [ ...stored ];
      newItems.forEach(n => merged.push(n));
      localStorage.setItem(LS_NOTIFS, JSON.stringify(merged));
      updateNotifBadge();
      renderNotifPanel();
      newItems.forEach(n => setTimeout(()=> showToastOnly(n), 300));
    }
  }, 15000);
}

/* ============================================================
   [SECCIÓN 11] - RENDER PAGE (videos removed)
   ============================================================ */

function setActiveTab(tabName, pushHistory=true) {
  tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
  localStorage.setItem(LS_TAB, tabName);
  renderPage(tabName);
  if (pushHistory) history.pushState({tab:tabName}, '', `#${tabName}`);
}

function renderPage(tabName) {
  main.innerHTML = '';
  if (tabName === 'images') renderImages();
  else if (tabName === 'videos') {
    // Videos removed: show placeholder so the tab exists but no content is rendered.
    const el = document.createElement('div');
    el.className = 'video-section-empty';
    el.textContent = 'Sección Videos habilitada como pestaña, contenido eliminado en v1.4.';
    main.appendChild(el);
  } else renderEnVi();
}

/* ============================================================
   [SECCIÓN 12] - INIT
   ============================================================ */

(async function init() {
  await loadAllData();
  updateNotifBadge();
  renderNotifPanel();
  startNotifSequence();
  watchNotificationsRealtime();

  // Accessibility/protection: prevent context menu and selection, disable zoom hotkeys/wheel/pinch/dbltap
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.documentElement.style.userSelect = 'none';

  // Prevent Ctrl/Cmd + +/- and Ctrl+wheel zoom
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+' || e.key === '-' || e.key === '0')) {
      e.preventDefault();
    }
  }, { passive:false });

  window.addEventListener('wheel', (e) => {
    if (e.ctrlKey) e.preventDefault();
  }, { passive:false });

  // Prevent pinch-to-zoom / gesture events (iOS Safari)
  window.addEventListener('gesturestart', (e) => e.preventDefault(), { passive:false });
  window.addEventListener('gesturechange', (e) => e.preventDefault(), { passive:false });
  window.addEventListener('gestureend', (e) => e.preventDefault(), { passive:false });

  // Double-tap detection to prevent zoom (block quick successive taps)
  let lastTouch = 0;
  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouch <= 300) {
      e.preventDefault();
    }
    lastTouch = now;
  }, { passive:false });

  // Prevent dragging of images (so no easy "open in new tab" by drag)
  document.querySelectorAll('img').forEach(i => i.setAttribute('draggable','false'));

  // register sw if any
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(()=>{/* ignore */});
  }
})();

document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopNotifSequence();
  else startNotifSequence();
});

/* expose debug helpers */
window.stv = {
  loadAllData, PAGES, renderNotifPanel, startNotifSequence, stopNotifSequence, getRemoved, getShown
};