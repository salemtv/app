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

/* ---------------- Modal ---------------- */
function openImagePlayer(item){
  const src = item.video || item.iframe || item.player || item.srcVideo || '';
  if (!src) return;
  const title = item.title || item.name || item.id || '';

  const isiOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
  if (isiOS && src.match(/\.(mp4|mov|m4v)(\?|$)/i)) { window.location.href = src; return; }

  modalTitle.textContent = title;
  modalMedia.innerHTML = '';

  if (src.match(/\.(mp4|webm|ogg)(\?|$)/i)) {
    const v = document.createElement('video');
    v.src = src; v.controls = true; v.autoplay = true; v.playsInline = true;
    v.style.maxHeight='100%';
    v.setAttribute('controlsList','nodownload');
    modalMedia.appendChild(v);
    try { v.play().catch(()=>{}); } catch(e) {}
  } else {
    const iframe = document.createElement('iframe');
    iframe.src = src.includes('youtube.com') && !src.includes('enablejsapi')
      ? src + (src.includes('?') ? '&enablejsapi=1' : '?enablejsapi=1')
      : src;
    iframe.allow = 'autoplay; encrypted-media; picture-in-picture';
    iframe.setAttribute('allowfullscreen','');
    iframe.style.border='none';
    modalMedia.appendChild(iframe);
  }

  modalFull.classList.add('active');
  modalFull.setAttribute('aria-hidden','false');
  document.body.classList.add('no-scroll');
}

function closeModal(){
  const media = modalMedia.querySelector('video, iframe');
  if (media && media.tagName === 'VIDEO') { try { media.pause(); } catch(e){} media.src = ''; }
  if (media && media.tagName === 'IFRAME') {
    try { media.contentWindow.postMessage('{"event":"command","func":"stopVideo","args":""}', '*'); } catch(e){}
    media.src = 'about:blank';
  }
  modalMedia.innerHTML = '';
  modalTitle.textContent = '';
  modalFull.classList.remove('active');
  modalFull.setAttribute('aria-hidden','true');
  document.body.classList.remove('no-scroll');
}

modalClose.addEventListener('click', closeModal);
modalFull.addEventListener('click', (e)=> { if (e.target === modalFull) closeModal(); });

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