/* === Base con selector personalizado y bloqueo modal scroll === */

const LS_TAB = 'stv_selected_tab';
const main = document.getElementById('main');
const tabs = document.querySelectorAll('.tab');

const modalFull = document.getElementById('modalFull');
const modalTitle = document.getElementById('modalTitle');
const modalMedia = document.getElementById('modalMedia');
const modalClose = document.getElementById('modalClose');

let PAGES = {}; // images and envi

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

/* ---------------- fetch JSON helper ---------------- */
async function fetchJSON(path, fallback=null){
  try {
    const r = await fetch(path, {cache:'no-cache'});
    if(!r.ok) throw new Error('fetch failed');
    return await r.json();
  } catch(e) {
    console.warn('fetch failed', path, e);
    return fallback;
  }
}

/* ---------------- load data ---------------- */
async function loadAllData(){
  const [images, envi] = await Promise.all([
    fetchJSON('data/images.json', null),
    fetchJSON('data/envi.json', null)
  ]);

  PAGES.images = images || {title:'Imagenes', items:[]};
  PAGES.envi = envi || {title:'Mundo Fútbol', defaultStream:'foxsports'};

  renderPage(localStorage.getItem(LS_TAB) || 'envi');
}

/* ---------------- SPA rendering ---------------- */
function setActiveTab(tabName, pushHistory=true){
  tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
  localStorage.setItem(LS_TAB, tabName);
  renderPage(tabName);
  if (pushHistory) history.pushState({tab:tabName}, '', `#${tabName}`);
}

function renderPage(tabName){
  main.innerHTML = '';
  if (tabName === 'images') renderImages();
  else if (tabName === 'envi2') renderEnVi2(); // 👈 NUEVA FUNCIÓN
  else renderEnVi(); // envi original
}

/* ---------------- Images ---------------- */
function renderImages(){
  const p = PAGES.images || {title:'Imágenes', items:[]};
  const container = document.createElement('div');
  container.innerHTML = `<h3 style="margin-bottom:8px">${p.title}</h3>`;
  const searchWrap = document.createElement('div');
  searchWrap.style.marginBottom = '12px';
  searchWrap.innerHTML = `<input id="imgSearch" placeholder="Buscar pelicula..." style="width:100%;padding:10px;border-radius:8px;border:none;background:var(--color-secondary);color: var(--color-text);font-size:var(--font)">`;
  container.appendChild(searchWrap);

  const grid = document.createElement('div');
  grid.className = 'grid';
  (p.items || []).forEach(item => {
    const imgUrl = item.src || item.url || item.image || item.srcUrl || '';
    const name = item.id || item.name || item.title || ('img-'+Math.random().toString(36).slice(2,8));
    const c = document.createElement('div');
    c.className = 'card';
    c.dataset.img = name;
    c.innerHTML = `<img loading="lazy" src="${imgUrl}" alt="${escapeHtml(name)}" />
                   <div class="iname">${escapeHtml(name)}</div>`;
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
      if (name.includes(v)) { card.style.display = ''; visible++; }
      else card.style.display = 'none';
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
      noResultsMsg.remove(); noResultsMsg = null;
    }
  });
}
/* ---------------- Custom player robust v1.0 (iOS/Android focused) ---------------- */
/* REPLACE previous openImagePlayer/closeModal code with this block */
(function(){
  // Ensure these IDs exist in your HTML
  const modalFullEl = document.getElementById('modalFull');
  const modalMediaEl = document.getElementById('modalMedia');
  const modalTitleEl = document.getElementById('modalTitle');
  const modalCloseEl = document.getElementById('modalClose');

  function isIOS() {
    return /iPhone|iPad|iPod/.test(navigator.userAgent);
  }
  function isStandaloneIOS() {
    return (('standalone' in navigator && navigator.standalone) || window.matchMedia('(display-mode: standalone)').matches) && isIOS();
  }
  function formatTime(sec) {
    if (!isFinite(sec) || isNaN(sec)) return '0:00';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${m}:${String(s).padStart(2,'0')}`;
  }

  function supportsPiP(video) {
    try {
      if ('pictureInPictureEnabled' in document && typeof video.requestPictureInPicture === 'function') return true;
      if (typeof video.webkitSupportsPresentationMode === 'function' && typeof video.webkitSetPresentationMode === 'function') {
        return !!video.webkitSupportsPresentationMode && video.webkitSupportsPresentationMode('picture-in-picture');
      }
    } catch(e){}
    return false;
  }

  function cleanup(wrapper) {
    if (!wrapper) return;
    const v = wrapper.querySelector('video');
    if (v) {
      try { v.pause(); } catch(e){}
      if (v._hls && typeof v._hls.destroy === 'function') {
        try { v._hls.destroy(); } catch(e){}
      }
      try { v.src = ''; } catch(e){}
    }
    wrapper.remove();
  }

  window.openImagePlayer = function(item){
    const src = item.video || item.srcVideo || item.iframe || item.player || '';
    if (!src) return;
    const title = item.title || item.name || item.id || 'Video';
    const vidKey = 'stv_resume_' + (item.id || title || src);

    // set title in header
    if (modalTitleEl) modalTitleEl.textContent = title;
    // clear area
    if (modalMediaEl) modalMediaEl.innerHTML = '';

    // build wrapper
    const wrap = document.createElement('div');
    wrap.className = 'custom-player';

    // create video element
    const video = document.createElement('video');
    video.className = 'custom-video';
    video.playsInline = true;
    video.setAttribute('webkit-playsinline','');
    video.preload = 'metadata';
    video.controls = false;
    wrap.appendChild(video);

    // HLS handling
    const isHls = /\.m3u8(\?.*)?$/i.test(src);
    if (isHls && window.Hls && Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(src);
      hls.attachMedia(video);
      video._hls = hls;
    } else {
      video.src = src;
    }

    // watermark (optional)
    const watermark = document.createElement('div');
    watermark.className = 'cp-watermark';
    watermark.innerHTML = `<img class="cp-watermark-img" src="https://via.placeholder.com/48x48.png?text=Logo" alt="logo">`;
    wrap.appendChild(watermark);

    // controls markup
    const controls = document.createElement('div');
    controls.className = 'cp-controls visible';
    const showPip = !isStandaloneIOS() && supportsPiP(video);
    controls.innerHTML = `
      <div class="cp-center">
        <button class="cp-btn cp-rev" title="-10s"><span class="material-symbols-outlined">replay_10</span></button>
        <button class="cp-btn cp-play" title="Play/Pause"><span class="material-symbols-outlined">play_arrow</span></button>
        <button class="cp-btn cp-fwd" title="+10s"><span class="material-symbols-outlined">forward_10</span></button>
      </div>
      <div class="cp-progress-row">
        <span class="cp-time cp-cur">0:00</span>
        <div class="cp-bar">
          <div class="cp-bar-bg"></div>
          <div class="cp-bar-fill"></div>
          <div class="cp-bar-handle"></div>
          <input class="cp-progress" type="range" min="0" max="100" step="0.1" value="0">
        </div>
        <span class="cp-time cp-dur">0:00</span>
      </div>
      <div class="cp-bottom-row">
        <div class="cp-info">${title}</div>
        <div class="cp-right">
          <button class="cp-btn cp-mute" title="Mute"><span class="material-symbols-outlined">volume_up</span></button>
          ${showPip ? `<button class="cp-btn cp-pip" title="Picture in Picture"><span class="material-symbols-outlined">picture_in_picture_alt</span></button>` : ''}
          <button class="cp-btn cp-full" title="Fullscreen"><span class="material-symbols-outlined">fullscreen</span></button>
        </div>
      </div>
    `;
    wrap.appendChild(controls);
    modalMediaEl.appendChild(wrap);

    // refs
    const playBtn = controls.querySelector('.cp-play');
    const revBtn = controls.querySelector('.cp-rev');
    const fwdBtn = controls.querySelector('.cp-fwd');
    const muteBtn = controls.querySelector('.cp-mute');
    const pipBtn = controls.querySelector('.cp-pip');
    const fullBtn = controls.querySelector('.cp-full');
    const progressEl = controls.querySelector('.cp-progress');
    const fillEl = controls.querySelector('.cp-bar-fill');
    const handleEl = controls.querySelector('.cp-bar-handle');
    const curEl = controls.querySelector('.cp-cur');
    const durEl = controls.querySelector('.cp-dur');

    // UI update
    function updateUI() {
      const dur = video.duration || 0;
      const cur = video.currentTime || 0;
      const pct = dur ? (cur / dur) * 100 : 0;
      if (!isNaN(pct)) {
        progressEl.value = pct;
        fillEl.style.width = pct + '%';
        handleEl.style.left = pct + '%';
      }
      curEl.textContent = formatTime(cur);
      durEl.textContent = formatTime(dur);
    }

    // Play/pause (anti-rebound + safe play)
let playLock = false;
playBtn.addEventListener('click', async () => {
  if (playLock) return; // evita múltiples clics rápidos
  playLock = true;
  try {
    if (video.paused || video.ended) {
      await video.play().catch(() => {}); // ignora errores de autoplay bloqueado
    } else {
      video.pause();
    }
  } catch (e) {
    console.warn('play err', e);
  }
  setTimeout(() => playLock = false, 400); // libera bloqueo tras 0.4s
});

video.addEventListener('play', () => {
  playBtn.firstElementChild.textContent = 'pause';
});
video.addEventListener('pause', () => {
  playBtn.firstElementChild.textContent = 'play_arrow';
});
    // skip
    revBtn.addEventListener('click', () => { video.currentTime = Math.max(0, (video.currentTime || 0) - 10); updateUI(); });
    fwdBtn.addEventListener('click', () => { video.currentTime = Math.min((video.duration || Infinity), (video.currentTime || 0) + 10); updateUI(); });

    // mute
    muteBtn.addEventListener('click', () => {
      video.muted = !video.muted;
      muteBtn.firstElementChild.textContent = video.muted ? 'volume_off' : 'volume_up';
    });

    // PiP (standard + webkit fallback)
    if (pipBtn) pipBtn.addEventListener('click', async () => {
      try {
        if (typeof video.requestPictureInPicture === 'function') {
          if (document.pictureInPictureElement) await document.exitPictureInPicture();
          else await video.requestPictureInPicture();
        } else if (typeof video.webkitSupportsPresentationMode === 'function' && video.webkitSupportsPresentationMode('picture-in-picture')) {
          // Safari-like webkit fallback
          const current = video.webkitPresentationMode || 'inline';
          try {
            if (current === 'picture-in-picture') video.webkitSetPresentationMode('inline');
            else video.webkitSetPresentationMode('picture-in-picture');
          } catch(e){ console.warn('webkit pip toggle', e); }
        } else {
          console.warn('PiP not supported');
        }
      } catch(e){ console.warn('pip err', e); }
    });

    // Fullscreen robust handling with fallbacks
    fullBtn.addEventListener('click', async () => {
      try {
        if (!document.fullscreenElement) {
          // prefer modalFullEl for a better UX (keeps header/close visible)
          if (modalFullEl && typeof modalFullEl.requestFullscreen === 'function') await modalFullEl.requestFullscreen();
          else if (typeof video.requestFullscreen === 'function') await video.requestFullscreen();
          else if (typeof video.webkitEnterFullscreen === 'function') video.webkitEnterFullscreen();
          else if (typeof video.webkitEnterFullScreen === 'function') video.webkitEnterFullScreen();
          else if (wrap && typeof wrap.requestFullscreen === 'function') await wrap.requestFullscreen();
        } else {
          if (typeof document.exitFullscreen === 'function') await document.exitFullscreen();
          else if (typeof document.webkitExitFullscreen === 'function') document.webkitExitFullscreen();
        }
      } catch(e){ console.warn('fullscreen err', e); }
    });
    document.addEventListener('fullscreenchange', () => {
      try {
        fullBtn.firstElementChild.textContent = document.fullscreenElement ? 'fullscreen_exit' : 'fullscreen';
      } catch(e){}
    });

    // progress bar interactions
    let duringSeek = false;
    progressEl.addEventListener('input', (ev) => {
      duringSeek = true;
      const pct = Number(ev.target.value || 0);
      const dur = video.duration || 0;
      fillEl.style.width = pct + '%';
      handleEl.style.left = pct + '%';
      if (dur) curEl.textContent = formatTime((pct / 100) * dur);
      handleEl.classList.add('active');
    });
    progressEl.addEventListener('change', (ev) => {
      const pct = Number(ev.target.value || 0);
      const dur = video.duration || 0;
      if (dur) video.currentTime = (pct / 100) * dur;
      duringSeek = false;
      setTimeout(()=> handleEl.classList.remove('active'), 250);
    });

    // update loop
    video.addEventListener('timeupdate', () => {
      if (!duringSeek) updateUI();
      // save progress occasionally
      try {
        const raw = JSON.parse(localStorage.getItem(vidKey) || '{}');
        if (!raw.t || Math.abs((raw.t||0) - video.currentTime) > 3) {
          localStorage.setItem(vidKey, JSON.stringify({ t: video.currentTime, s: Date.now() }));
        }
      } catch(e){}
    });
    video.addEventListener('loadedmetadata', updateUI);

    // resume prompt if available
    try {
      const saved = JSON.parse(localStorage.getItem(vidKey) || '{}');
      if (saved && saved.t && saved.t > 3) {
        const resumeBox = document.createElement('div');
        resumeBox.className = 'cp-resume';
        resumeBox.innerHTML = `
          <div class="cp-resume-box">
            <div>¿Retomar desde <strong class="cp-time">${formatTime(saved.t)}</strong>?</div>
            <div style="margin-top:8px">
              <button class="cp-btn cp-yes">Sí</button>
              <button class="cp-btn cp-no">No</button>
            </div>
          </div>`;
        wrap.appendChild(resumeBox);
        resumeBox.querySelector('.cp-yes').onclick = () => { video.currentTime = saved.t; resumeBox.remove(); video.play().catch(()=>{}); };
        resumeBox.querySelector('.cp-no').onclick = () => { localStorage.removeItem(vidKey); resumeBox.remove(); video.play().catch(()=>{}); };
      }
    } catch(e){}

    // Touch gestures: single tap toggle, double tap skip (optimized to avoid interference)
if ('ontouchstart' in window) {
  let lastTap = 0;
  let tapTimeout = null;

  wrap.addEventListener('touchend', (ev) => {
    const target = ev.target;

    // Evita interferencia: si se tocó un botón o control visible, no ejecutar gesto
    if (target.closest('.cp-btn') || target.closest('.cp-progress') || target.closest('.cp-bar')) return;

    const now = Date.now();
    const dt = now - lastTap;
    const touch = ev.changedTouches[0];
    const rect = wrap.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const half = rect.width / 2;

    // Doble tap = saltar ±10s
    if (dt < 300 && dt > 0) {
      clearTimeout(tapTimeout);
      if (x < half) {
        video.currentTime = Math.max(0, video.currentTime - 10);
      } else {
        video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 10);
      }
      lastTap = 0; // reinicia para no detectar triple tap
      return;
    }

    // Tap simple = play/pause toggle
    tapTimeout = setTimeout(() => {
      if (video.paused) video.play().catch(()=>{}); 
      else video.pause();
    }, 250);

    lastTap = now;
  }, { passive: true });
}

    // auto-hide controls (3s)
    let hideTimer = null;
    function showControlsTemporary() {
      controls.classList.add('visible');
      clearTimeout(hideTimer);
      // show handle during visible
      handleEl.style.opacity = '1';
      hideTimer = setTimeout(()=> {
        if (!video.paused) {
          controls.classList.remove('visible');
          handleEl.style.opacity = '';
        }
      }, 3000);
    }
    wrap.addEventListener('mousemove', showControlsTemporary);
    wrap.addEventListener('touchstart', showControlsTemporary, { passive:true });
    showControlsTemporary();

    // open modal
    modalFullEl.classList.add('active');
    modalFullEl.setAttribute('aria-hidden','false');
    document.body.classList.add('no-scroll');

    // store debug
    video._wrap = wrap;
    video._src = src;
  }; // openImagePlayer end

  window.closeModal = function() {
    const wrapper = modalMediaEl.querySelector('.custom-player');
    cleanup(wrapper);
    modalMediaEl.innerHTML = '';
    if (modalTitleEl) modalTitleEl.textContent = '';
    if (modalFullEl) {
      modalFullEl.classList.remove('active');
      modalFullEl.setAttribute('aria-hidden','true');
    }
    document.body.classList.remove('no-scroll');
  };

  // attach close listeners if not attached
  try {
    if (modalCloseEl && !modalCloseEl._bound) {
      modalCloseEl.addEventListener('click', closeModal);
      modalCloseEl._bound = true;
    }
    if (modalFullEl && !modalFullEl._boundClick) {
      modalFullEl.addEventListener('click', (e) => { if (e.target === modalFullEl) closeModal(); });
      modalFullEl._boundClick = true;
    }
  } catch(e){ console.warn(e); }

})(); // IIFE end

/* ---------------- EnVi ---------------- */
function renderEnVi(){
  const p = PAGES.envi || {title:'Mundo Fútbol', defaultStream:'foxsports'};
  const container = document.createElement('div');
  container.innerHTML = `
    <h3 style="margin-bottom:8px">${p.title}</h3>
    <div class="iframe-container">
      <div class="loader" id="loader"><span></span></div>
      <iframe id="videoIframe" allow="picture-in-picture" playsinline webkit-playsinline allowfullscreen></iframe>
    </div>
    <div class="controls" style="margin-top:8px">
      <div class="custom-selector" id="canalSelectorCustom">
        <div class="selector-display">
          <span style="font-size: 20px" class="material-symbols-outlined">tv</span>
          <span class="selected-text">L1 Max</span>
          <span class="material-symbols-outlined arrow">expand_more</span>
        </div>
        <div class="selector-options hidden">
<div data-value="beinsportes">BeiN Sports</div>
<div data-value="beinsport_xtra_espanol">BeiN Sports Xtra</div>
<div data-value="disney4">Disney 1</div>
<div data-value="disney8">Disney 2</div>
<div data-value="disney9">Disney 3</div>
<div data-value="disney10">Disney 4</div>
<div data-value="disney11">Disney 5</div>
<div data-value="disney13">Disney 6</div>
<div data-value="dsports">DSports</div>
<div data-value="dsports2">DSports 2</div>
<div data-value="dsportsplus">DSports Plus</div>
<div data-value="espndeportes">ESPN Deportes</div>
<div data-value="espnpremium">ESPN Premium</div>
<div data-value="espn">ESPN</div>
<div data-value="espn2">ESPN 2</div>
<div data-value="espn3">ESPN 3</div>
<div data-value="espn4">ESPN 4</div>
<div data-value="espn5">ESPN 5</div>
<div data-value="espn6">ESPN 6</div>
<div data-value="espn7">ESPN 7</div>
<div data-value="foxsports">Fox Sports</div>
<div data-value="foxsports2">Fox Sports 2</div>
<div data-value="foxsports3">Fox Sports 3</div>
<div data-value="goltv">Gol TV</div>
<div data-value="golperu">GOLPERU</div>
<div data-value="liga1max">L1 MAX</div>
<div data-value="movistar">Movistar Deportes</div>
<div data-value="premiere1">Premiere 1</div>
<div data-value="premiere2">Premiere 2</div>
<div data-value="premiere3">Premiere 3</div>
<div data-value="premiere4">Premiere 4</div>
<div data-value="premiere5">Premiere 5</div>
<div data-value="premiere6">Premiere 6</div>
<div data-value="premiere7">Premiere 7</div>
<div data-value="premiere8">Premiere 8</div>
<div data-value="telefe">Telefe</div>
<div data-value="tycsports">TyC Sports</div>
        </div>
      </div>
      <div class="botonxtra">
        <span id="liveBadge" class="live-badge"><span class="dot">●</span> LIVE</span>
        <button class="btn-icon" id="reloadBtn" title="Recargar canal">
          <span class="material-symbols-outlined">autoplay</span>
        </button>
      </div>
    </div>
  `;
  main.appendChild(container);

  const iframe = document.getElementById('videoIframe');
  const loader = document.getElementById('loader');
  const badge = document.getElementById('liveBadge');
  const canalSaved = localStorage.getItem('canalSeleccionado') || p.defaultStream || 'foxsports';
  iframe.src = `https://la14hd.com/vivo/canales.php?stream=${canalSaved}`;
  iframe.onload = () => { if (loader) loader.style.display='none'; if (badge) badge.classList.add('visible'); }

  document.getElementById('reloadBtn').addEventListener('click', () => {
    if (loader) loader.style.display = 'flex';
    if (badge) badge.classList.remove('visible');
    iframe.src = iframe.src.split('?')[0] + '?_=' + Date.now();
  });

  initCustomSelector();
}

/* ---------------- Custom Selector ---------------- */
function initCustomSelector() {
  const custom = document.getElementById('canalSelectorCustom');
  if (!custom) return;
  const display = custom.querySelector('.selector-display');
  const options = custom.querySelector('.selector-options');
  const text = custom.querySelector('.selected-text');
  const iframe = document.getElementById('videoIframe');
  const loader = document.getElementById('loader');
  const badge = document.getElementById('liveBadge');

  const canalSaved = localStorage.getItem('canalSeleccionado') || 'foxsports';
  const currentOption = options.querySelector(`[data-value="${canalSaved}"]`);
  if (currentOption) text.textContent = currentOption.textContent;

  display.addEventListener('click', () => {
    options.classList.toggle('hidden');
  });

  options.querySelectorAll('div').forEach(opt => {
    opt.addEventListener('click', e => {
      const value = e.target.dataset.value;
      const label = e.target.textContent;
      text.textContent = label;
      options.classList.add('hidden');
      localStorage.setItem('canalSeleccionado', value);
      if (loader) loader.style.display = 'flex';
      if (badge) badge.classList.remove('visible');
      iframe.src = `https://la14hd.com/vivo/canales.php?stream=${value}`;
    });
  });

  document.addEventListener('click', e => {
    if (!custom.contains(e.target)) options.classList.add('hidden');
  });
}
/* ---------------- EnVi 2 ---------------- */
function renderEnVi2(){
  const p = {title:'Resto del Mundo', defaultStream:'history'};
  const container = document.createElement('div');
  container.innerHTML = `
    <h3 style="margin-bottom:8px">${p.title}</h3>
    <div class="iframe-container">
      <div class="loader" id="loader2"><span></span></div>
      <iframe id="videoIframe2" allow="picture-in-picture" playsinline webkit-playsinline allowfullscreen></iframe>
    </div>
    <div class="controls" style="margin-top:8px">
      <div class="custom-selector" id="canalSelectorCustom2">
        <div class="selector-display">
          <span style="font-size: 20px" class="material-symbols-outlined">tv</span>
          <span class="selected-text">History</span>
          <span class="material-symbols-outlined arrow">expand_more</span>
        </div>
        <div class="selector-options hidden">
<div data-value="americatv">America TV</div>
<div data-value="animalplanet">Animal Planet</div>
<div data-value="atv">ATV</div>
<div data-value="axn">AXN</div>
<div data-value="cartoonnetwork">Cartoon Network</div>
<div data-value="cinecanal">CINECANAL</div>
<div data-value="cinemax">CINEMAX</div>
<div data-value="discoverykids">Discovery Kids</div>
<div data-value="discoverychannel">Discovery Channel</div>
<div data-value="discoveryhyh">Discovery H&H</div>
<div data-value="distritocomedia">Distrito Comedia</div>
<div data-value="disneychannel">Disney Channel</div>
<div data-value="disneyjr">Disney Junior</div>
<div data-value="fx">FX</div>

<div data-value="goldenedge">GOLDEN EDGE</div>
<div data-value="goldenplus">GOLDEN PLUS</div>
<div data-value="goldenpremier">GOLDEN PREMIER</div>
<div data-value="history">History</div>
<div data-value="history2">History 2</div>
<div data-value="idinvestigation">ID Investigation</div>
<div data-value="latina">Latina</div>
<div data-value="paramountchannel">PARAMOUNT TV</div>
<div data-value="natgeo">NAT GEO</div>
<div data-value="nick">Nickelodeon</div>
<div data-value="nickjr">Nickelodeon JR</div>
<div data-value="space">Space</div>
<div data-value="starchannel">Star Channel</div>
<div data-value="studiouniversal">Studio Universal</div>
<div data-value="telemundo51">Telemundo Miami</div>
<div data-value="telemundopuertorico">Telemundo PR</div>
<div data-value="tnt">TNT</div>
<div data-value="tnt">TNT Series</div>
<div data-value="tooncast">TOONCAST</div>
<div data-value="universalchannel">UNIVERSAL TV</div>
<div data-value="willax">Willax TV</div>
        </div>
      </div>
      <div class="botonxtra">
        <span id="liveBadge2" class="live-badge"><span class="dot">●</span> LIVE</span>
        <button class="btn-icon" id="reloadBtn2" title="Recargar canal">
          <span class="material-symbols-outlined">autoplay</span>
        </button>
      </div>
    </div>
  `;
  main.appendChild(container);

  const iframe = document.getElementById('videoIframe2');
  const loader = document.getElementById('loader2');
  const badge = document.getElementById('liveBadge2');
  const canalSaved = localStorage.getItem('canalSeleccionado2') || p.defaultStream || 'history';
  iframe.src = `https://embed.saohgdasregions.fun/embed/${canalSaved}.html`;
  iframe.onload = () => { if (loader) loader.style.display='none'; if (badge) badge.classList.add('visible'); }

  document.getElementById('reloadBtn2').addEventListener('click', () => {
    if (loader) loader.style.display = 'flex';
    if (badge) badge.classList.remove('visible');
    iframe.src = iframe.src.split('?')[0] + '?_=' + Date.now();
  });

  initCustomSelector2();
}

/* ---------------- Custom Selector 2 ---------------- */
function initCustomSelector2() {
  const custom = document.getElementById('canalSelectorCustom2');
  if (!custom) return;
  const display = custom.querySelector('.selector-display');
  const options = custom.querySelector('.selector-options');
  const text = custom.querySelector('.selected-text');
  const iframe = document.getElementById('videoIframe2');
  const loader = document.getElementById('loader2');
  const badge = document.getElementById('liveBadge2');

  const canalSaved = localStorage.getItem('canalSeleccionado2') || 'history';
  const currentOption = options.querySelector(`[data-value="${canalSaved}"]`);
  if (currentOption) text.textContent = currentOption.textContent;

  display.addEventListener('click', () => {
    options.classList.toggle('hidden');
  });

  options.querySelectorAll('div').forEach(opt => {
    opt.addEventListener('click', e => {
      const value = e.target.dataset.value;
      const label = e.target.textContent;
      text.textContent = label;
      options.classList.add('hidden');
      localStorage.setItem('canalSeleccionado2', value);
      if (loader) loader.style.display = 'flex';
      if (badge) badge.classList.remove('visible');
      iframe.src = `https://embed.saohgdasregions.fun/embed/${value}.html`;
    });
  });

  document.addEventListener('click', e => {
    if (!custom.contains(e.target)) options.classList.add('hidden');
  });
}
/* ---------------- Tabs, history, swipe ---------------- */
tabs.forEach(t => t.addEventListener('click', ()=> setActiveTab(t.dataset.tab)));

const last = 'envi';
setActiveTab(last, false);
history.replaceState({tab:last}, '', `#${last}`);

window.addEventListener('popstate', (ev) => {
  const tab = (ev.state && ev.state.tab) || window.location.hash.replace('#','') || localStorage.getItem(LS_TAB) || 'envi';
  setActiveTab(tab, false);
});

let touchStartX = 0;
let touchStartY = 0;

main.addEventListener('touchstart', (e)=> {
  touchStartX = e.changedTouches[0].screenX;
  touchStartY = e.changedTouches[0].screenY;
}, {passive:true});

main.addEventListener('touchend', (e)=> {
  const touchEndX = e.changedTouches[0].screenX;
  const touchEndY = e.changedTouches[0].screenY;
  const diffX = touchEndX - touchStartX;
  const diffY = touchEndY - touchStartY;

  // 👉 Solo consideramos swipe si el movimiento horizontal es mayor al vertical
  if (Math.abs(diffX) < 50 || Math.abs(diffX) < Math.abs(diffY)) return;

  const order = Array.from(tabs).map(t=>t.dataset.tab);
  const current = localStorage.getItem(LS_TAB) || 'envi';
  let idx = order.indexOf(current);

  if (diffX < 0 && idx < order.length-1) idx++; // derecha → izquierda
  if (diffX > 0 && idx > 0) idx--;             // izquierda → derecha

  setActiveTab(order[idx]);
}, {passive:true});

/* 🔒 Bloqueos */
document.addEventListener('contextmenu', event => event.preventDefault());
document.onkeydown = function(e) {
  if (e.keyCode == 123) return false;
  if (e.ctrlKey && e.shiftKey && e.keyCode == 'I'.charCodeAt(0)) return false;
  if (e.ctrlKey && e.shiftKey && e.keyCode == 'J'.charCodeAt(0)) return false;
  if (e.ctrlKey && e.keyCode == 'U'.charCodeAt(0)) return false;
};

/* ---------------- Initial load ---------------- */
(async function init(){ await loadAllData(); })();

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(()=>{});
