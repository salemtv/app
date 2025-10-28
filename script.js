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
/* ---------------- Modal + Reproductor personalizado (v2.2) ---------------- */
/* Reemplaza por completo openImagePlayer / closeModal anteriores */
(function(){
  // referencias al DOM (asegúrate que existan en tu HTML)
  const modalFull = document.getElementById('modalFull');
  const modalMedia = document.getElementById('modalMedia');
  const modalTitle = document.getElementById('modalTitle');
  const modalClose = document.getElementById('modalClose');

  function isIOS() {
    return /iPhone|iPad|iPod/.test(navigator.userAgent);
  }
  function isStandaloneIOS() {
    // iOS PWA detection: navigator.standalone (old) OR display-mode standalone (modern)
    return (('standalone' in navigator && navigator.standalone) || window.matchMedia('(display-mode: standalone)').matches) && isIOS();
  }

  function formatTime(sec) {
    if (!isFinite(sec) || isNaN(sec)) return '0:00';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${m}:${String(s).padStart(2,'0')}`;
  }

  // Utility: detect PiP support for the current environment + video instance
  function supportsPiP(videoEl) {
    try {
      // Modern: document.pictureInPictureEnabled + element.requestPictureInPicture
      if ('pictureInPictureEnabled' in document && typeof videoEl.requestPictureInPicture === 'function') return true;
      // WebKit variant (Safari): webkitSupportsPresentationMode + webkitSetPresentationMode
      if (typeof videoEl.webkitSupportsPresentationMode === 'function' && videoEl.webkitSupportsPresentationMode('picture-in-picture') !== undefined) {
        return !!videoEl.webkitSupportsPresentationMode; // presence check
      }
    } catch(e){}
    return false;
  }

  // Cleanup helper used by closeModal
  function cleanupPlayer(wrapper) {
    if (!wrapper) return;
    const vid = wrapper.querySelector('video');
    if (vid) {
      try { vid.pause(); } catch(e){}
      // destroy hls if attached
      if (vid._hls && typeof vid._hls.destroy === 'function') {
        try { vid._hls.destroy(); } catch(e){}
      }
      try { vid.src = ''; } catch(e){}
    }
    wrapper.remove();
  }

  // === MAIN: openImagePlayer ===
  window.openImagePlayer = function(item) {
    const src = item.video || item.srcVideo || item.iframe || item.player || '';
    if (!src) return;
    const title = item.title || item.name || item.id || 'Video';
    const vidKey = 'stv_resume_' + (item.id || title || src);

    // set title in top header (you already have modalTitle in HTML)
    modalTitle.textContent = title;
    // clear previous
    modalMedia.innerHTML = '';

    // build wrapper for custom player inside your modal-media area
    const wrap = document.createElement('div');
    wrap.className = 'custom-player';

    // create video element (no native controls)
    const video = document.createElement('video');
    video.className = 'custom-video';
    video.playsInline = true;
    video.setAttribute('webkit-playsinline', ''); // iOS
    video.preload = 'metadata';
    video.controls = false;
    wrap.appendChild(video);

    // HLS support: if .m3u8 and hls.js present, use it; otherwise set src
    const isHls = /\.m3u8(\?.*)?$/i.test(src);
    if (isHls && window.Hls && Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(src);
      hls.attachMedia(video);
      video._hls = hls; // keep reference for cleanup
    } else {
      video.src = src;
    }

    // watermark (logo) — cámbiala si quieres
    const watermark = document.createElement('div');
    watermark.className = 'cp-watermark';
    watermark.innerHTML = `<img src="https://via.placeholder.com/48x48.png?text=Logo" alt="Logo" class="cp-watermark-img">`;
    wrap.appendChild(watermark);

    // controls markup (title is shown below in cp-info)
    const controls = document.createElement('div');
    controls.className = 'cp-controls visible';
    // decide whether PiP button should show: require PiP support AND NOT iOS standalone (PWA)
    const pipVisible = !isStandaloneIOS() && supportsPiP(video);
    controls.innerHTML = `
      <div class="cp-center">
        <button class="cp-btn cp-rev" title="-10s"><span class="material-symbols-outlined">replay_10</span></button>
        <button class="cp-btn cp-play" title="Play/Pause"><span class="material-symbols-outlined">play_arrow</span></button>
        <button class="cp-btn cp-fwd" title="+10s"><span class="material-symbols-outlined">forward_10</span></button>
      </div>

      <div class="cp-progress-row">
        <span class="cp-time cp-cur">0:00</span>
        <div class="cp-bar" aria-hidden="true">
          <div class="cp-bar-bg"></div>
          <div class="cp-bar-fill"></div>
          <div class="cp-bar-handle"></div>
          <input class="cp-progress" type="range" min="0" max="100" step="0.1" value="0" aria-label="Progreso">
        </div>
        <span class="cp-time cp-dur">0:00</span>
      </div>

      <div class="cp-bottom-row">
        <div class="cp-info">${title}</div>
        <div class="cp-right">
          <button class="cp-btn cp-mute" title="Mute"><span class="material-symbols-outlined">volume_up</span></button>
          ${pipVisible ? `<button class="cp-btn cp-pip" title="Picture in Picture"><span class="material-symbols-outlined">picture_in_picture_alt</span></button>` : ''}
          <button class="cp-btn cp-full" title="Pantalla completa"><span class="material-symbols-outlined">fullscreen</span></button>
        </div>
      </div>
    `;
    wrap.appendChild(controls);

    // append player into modalMedia
    modalMedia.appendChild(wrap);

    // reference elements inside controls
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

    // UI update helper
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

    // Play / Pause
    playBtn.addEventListener('click', async () => {
      try {
        if (video.paused || video.ended) await video.play();
        else video.pause();
      } catch (e) { console.warn('Play error', e); }
    });

    // update play icon on events
    video.addEventListener('play', () => playBtn.firstElementChild.textContent = 'pause');
    video.addEventListener('pause', () => playBtn.firstElementChild.textContent = 'play_arrow');

    // rev / fwd
    revBtn.addEventListener('click', () => { video.currentTime = Math.max(0, video.currentTime - 10); updateUI(); });
    fwdBtn.addEventListener('click', () => { video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 10); updateUI(); });

    // mute
    muteBtn.addEventListener('click', () => {
      video.muted = !video.muted;
      muteBtn.firstElementChild.textContent = video.muted ? 'volume_off' : 'volume_up';
    });

    // PiP handler with WebKit fallback
    if (pipBtn) {
      pipBtn.addEventListener('click', async () => {
        try {
          // Standard API if available
          if (typeof video.requestPictureInPicture === 'function') {
            if (document.pictureInPictureElement) await document.exitPictureInPicture();
            else await video.requestPictureInPicture();
          } else if (typeof video.webkitSetPresentationMode === 'function' && typeof video.webkitSupportsPresentationMode === 'function' && video.webkitSupportsPresentationMode('picture-in-picture')) {
            // Safari WebKit fallback
            try {
              const mode = video.webkitPresentationMode || 'inline';
              // toggle
              if (video.webkitPresentationMode === 'picture-in-picture') video.webkitSetPresentationMode('inline');
              else video.webkitSetPresentationMode('picture-in-picture');
            } catch(e){ console.warn('webkit PiP toggle error', e); }
          } else {
            console.warn('PiP not supported on this element');
          }
        } catch (e) { console.warn('PiP error', e); }
      });
    }

    // Fullscreen: prefer modalFull (the modal container) to ensure header/close still visible
    fullBtn.addEventListener('click', async () => {
      try {
        if (!document.fullscreenElement) {
          if (typeof modalFull.requestFullscreen === 'function') await modalFull.requestFullscreen();
          else if (typeof video.requestFullscreen === 'function') await video.requestFullscreen();
          else if (typeof wrap.requestFullscreen === 'function') await wrap.requestFullscreen();
        } else {
          await document.exitFullscreen();
        }
      } catch (e) { console.warn('Fullscreen error', e); }
    });

    // update fullscreen icon on change
    document.addEventListener('fullscreenchange', () => {
      try {
        fullBtn.firstElementChild.textContent = document.fullscreenElement ? 'fullscreen_exit' : 'fullscreen';
      } catch(e){}
    });

    // Progress interactions
    let duringSeek = false;
    progressEl.addEventListener('input', (ev) => {
      duringSeek = true;
      const pct = Number(ev.target.value || 0);
      const dur = video.duration || 0;
      fillEl.style.width = pct + '%';
      handleEl.style.left = pct + '%';
      if (dur) curEl.textContent = formatTime((pct / 100) * dur);
      // show handle while interacting
      handleEl.style.opacity = '1';
    });
    progressEl.addEventListener('change', (ev) => {
      const pct = Number(ev.target.value || 0);
      const dur = video.duration || 0;
      if (dur) video.currentTime = (pct / 100) * dur;
      duringSeek = false;
      // fade the handle after small delay
      setTimeout(()=> handleEl.style.opacity = '', 400);
    });

    // update while playing
    video.addEventListener('timeupdate', () => {
      if (!duringSeek) updateUI();
      // save resume point every ~3s
      try {
        const raw = JSON.parse(localStorage.getItem(vidKey) || '{}');
        if (!raw.t || Math.abs((raw.t||0) - video.currentTime) > 3) {
          localStorage.setItem(vidKey, JSON.stringify({ t: video.currentTime, s: Date.now() }));
        }
      } catch(e){}
    });

    video.addEventListener('loadedmetadata', updateUI);

    // Resume prompt: if saved > 3s, offer to resume
    try {
      const raw = JSON.parse(localStorage.getItem(vidKey) || '{}');
      if (raw && raw.t && raw.t > 3) {
        // minimal inline resume UI (reuse cp-resume if you have style, else play immediately)
        const resumeBox = document.createElement('div');
        resumeBox.className = 'cp-resume';
        resumeBox.innerHTML = `
          <div class="cp-resume-box">
            <div>¿Retomar desde <strong class="cp-time">${formatTime(raw.t)}</strong>?</div>
            <div style="margin-top:8px">
              <button class="cp-btn cp-yes">Sí</button>
              <button class="cp-btn cp-no">No</button>
            </div>
          </div>
        `;
        wrap.appendChild(resumeBox);
        resumeBox.querySelector('.cp-yes').onclick = () => { video.currentTime = raw.t; resumeBox.remove(); video.play().catch(()=>{}); };
        resumeBox.querySelector('.cp-no').onclick = () => { localStorage.removeItem(vidKey); resumeBox.remove(); video.play().catch(()=>{}); };
      }
    } catch(e){}

    // Touch gestures: single tap toggle, double-tap skip (left/right half)
    if ('ontouchstart' in window) {
      let lastTap = 0;
      wrap.addEventListener('touchend', (ev) => {
        // don't toggle if tapped a control
        if (ev.target.closest('.cp-controls') && !ev.target.closest('.cp-center')) return;
        const now = Date.now();
        const touch = ev.changedTouches[0];
        const rect = wrap.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const half = rect.width / 2;
        const dt = now - lastTap;
        if (dt < 300 && dt > 0) {
          // double-tap
          if (x < half) video.currentTime = Math.max(0, video.currentTime - 10);
          else video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 10);
        } else {
          // single tap toggle
          if (video.paused) video.play().catch(()=>{}); else video.pause();
        }
        lastTap = now;
      }, { passive:true });
    }

    // Auto-hide controls after 3s inactivity (show on mousemove/touch)
    let hideTimer = null;
    function showControlsTemporary() {
      controls.classList.add('visible');
      // show handle briefly
      handleEl.style.opacity = '1';
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => {
        // only hide if playing
        if (!video.paused) {
          controls.classList.remove('visible');
          // fade handle
          handleEl.style.opacity = '';
        }
      }, 3000);
    }
    // bind events
    wrap.addEventListener('mousemove', showControlsTemporary);
    wrap.addEventListener('touchstart', showControlsTemporary, { passive:true });
    // initial show
    showControlsTemporary();

    // open modal + block background scroll
    modalFull.classList.add('active');
    modalFull.setAttribute('aria-hidden', 'false');
    document.body.classList.add('no-scroll');

    // store reference for debugging if needed
    video._wrap = wrap;
    video._src = src;
  }; // end openImagePlayer

  // === closeModal: cleans up the player and DOM ===
  window.closeModal = function() {
    // find any custom-player inside modalMedia and clean it
    const wrapper = modalMedia.querySelector('.custom-player');
    if (wrapper) cleanupPlayer(wrapper);
    modalMedia.innerHTML = ''; // just in case
    modalTitle.textContent = '';
    modalFull.classList.remove('active');
    modalFull.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('no-scroll');
  };

  // attach listeners to modal close controls (if present)
  try {
    if (modalClose && !modalClose._bound) {
      modalClose.addEventListener('click', closeModal);
      modalClose._bound = true;
    }
    if (modalFull && !modalFull._boundClick) {
      modalFull.addEventListener('click', (e) => { if (e.target === modalFull) closeModal(); });
      modalFull._boundClick = true;
    }
  } catch(e) { console.warn(e); }

})();

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
