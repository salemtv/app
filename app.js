/* ============================
   Datos / JSON paths
   ============================ */

const PAGES = {}; // se llenará con fetch desde data/*.json
const LS_TAB = "stv_selected_tab";
const LS_NOTIFS = "stv_notifications"; // fallback local if fetch fails
const LS_DISMISSED = "stv_notif_dismissed";

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

async function loadAllData() {
  const [images, videos, envi, notifs] = await Promise.all([
    fetchJSON('data/images.json', null),
    fetchJSON('data/videos.json', null),
    fetchJSON('data/envi.json', null),
    fetchJSON('data/notifications.json', null)
  ]);

  let notifications = notifs;
  if (!notifications) {
    const ls = localStorage.getItem(LS_NOTIFS);
    notifications = ls ? JSON.parse(ls) : [];
  } else {
    localStorage.setItem(LS_NOTIFS, JSON.stringify(notifications));
  }

  PAGES.images = images || { title: 'Imágenes - STV', items: [] };
  PAGES.videos = videos || { title: 'Videos - STV', items: [] };
  PAGES.envi = envi || { title: 'EnVi', defaultStream: 'liga1max' };
  return notifications;
}

/* ---------------------------
   Notificaciones: carga, filtrado, render y secuencia rotativa
   --------------------------- */
function loadNotificationsFromLS() {
  let arr = JSON.parse(localStorage.getItem(LS_NOTIFS) || '[]');
  const now = new Date();
  arr = arr.filter(n => {
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
  const dismissed = getDismissed();
  const pending = notifs.filter(n => !dismissed.includes(n.id));
  if (pending.length > 0) {
    notifCountEl.style.display = 'inline-block';
    notifCountEl.textContent = pending.length;
  } else {
    notifCountEl.style.display = 'none';
  }
}

function renderNotifPanel() {
  const notifs = loadNotificationsFromLS();
  const dismissed = getDismissed();
  notifList.innerHTML = '';
  if (notifs.length === 0) {
    notifList.innerHTML = `<div style="color:var(--color-muted);font-size:14px">No hay notificaciones</div>`;
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
        <button class="btn-small" data-action="dismiss" data-id="${n.id}">${getDismissed().includes(n.id) ? 'Revelar' : 'Descartar'}</button>
        <button class="btn-small" data-action="open" data-id="${n.id}">Abrir</button>
      </div>
    `;
    notifList.appendChild(el);
  });

  notifList.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.id;
      const action = e.currentTarget.dataset.action;
      if (action === 'dismiss') {
        const dismissed = getDismissed();
        if (!dismissed.includes(id)) dismissed.push(id);
        setDismissed(dismissed);
        updateNotifBadge();
        renderNotifPanel();
      } else if (action === 'open') {
        const all = loadNotificationsFromLS();
        const n = all.find(x => x.id === id);
        if (n) executeNotificationOpen(n);
      }
    });
  });
}

/* show single toast (only content) */
function showToastOnly(text, meta = '') {
  if (activeToastTimeout) { clearTimeout(activeToastTimeout); activeToastTimeout = null; }
  toastEl.innerHTML = `<div>${escapeHtml(text)}</div>${meta ? `<div style="font-size:12px;margin-top:6px;color:var(--color-muted)">${escapeHtml(meta)}</div>` : ''}`;
  toastEl.classList.add('show');
}

/* hide toast */
function hideToast() {
  toastEl.classList.remove('show');
}

/* run rotation over pending notifs: 3s show, 2s gap -> next */
function startNotifSequence() {
  stopNotifSequence();
  const notifs = loadNotificationsFromLS().filter(n => !getDismissed().includes(n.id));
  if (notifs.length === 0) return;
  notifIndex = 0;
  (function next() {
    if (notifIndex >= notifs.length) {
      notifIndex = 0;
    }
    const n = notifs[notifIndex++];
    const body = n.body || n.content || '';
    const dlabel = formatDDMM(n.created || new Date().toISOString());
    const created = new Date(n.created || Date.now());
    const expireAt = new Date(created.getTime() + ((n.expire_days || 0) * 24*60*60*1000));
    const expLabel = (expireAt.toDateString() === (new Date()).toDateString()) ? 'Hoy*' : formatDDMM(expireAt.toISOString());

    showToastOnly(body, expLabel);

    notifSequenceTimer = setTimeout(() => {
      hideToast();
      notifSequenceTimer = setTimeout(() => next(), 2000);
    }, 3000);
  })();
}
function stopNotifSequence(){
  if (notifSequenceTimer) { clearTimeout(notifSequenceTimer); notifSequenceTimer = null; }
  hideToast();
}

/* Execute "Abrir" action */
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
  setDismissed(notifs);
  updateNotifBadge();
  renderNotifPanel();
});

/* ---------------------------
   Initial load: fetch data and start notifs
   --------------------------- */
(async function init() {
  const notifs = await loadAllData();
  updateNotifBadge();
  renderNotifPanel();
  startNotifSequence();
})();

document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopNotifSequence();
  else startNotifSequence();
});

/* Expose functions for debugging */
window.stv = {
  loadAllData, PAGES, renderNotifPanel, startNotifSequence, stopNotifSequence, executeNotificationOpen
};

/* Service Worker register preserves your sw.js */
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(()=>{/* ignore */});
}
