/**
 * Stream TV - Multi-Stream Player
 * iOS-optimized PWA with elegant native-like UX
 * Tema oscuro único | SlateBlue + Accent
 */

/* ================= STATE ================= */
const state = {
  rawChannels: [],
  banners: [],
  templates: {},
  groups: {},
  currentGroupKey: null,
  currentChannel: null,
  isPlaying: false,
  searchQuery: ''
};

/* ================= DOM REFS ================= */
const homeView = document.getElementById('homeView');
const playerView = document.getElementById('playerView');
const searchInput = document.getElementById('searchInput');
const searchClear = document.getElementById('searchClear');
const resultsCount = document.getElementById('resultsCount');
const channelsGrid = document.getElementById('channelsGrid');
const emptyState = document.getElementById('emptyState');
const playerBack = document.getElementById('playerBack');
const playerTitle = document.getElementById('playerTitle');
const playerVideo = document.getElementById('playerVideo');
const playerFrame = document.getElementById('playerFrame');
const playerLoader = document.getElementById('playerLoader');
const iframeErrorOverlay = document.getElementById('iframeErrorOverlay');
const iframeRetryBtn = document.getElementById('iframeRetryBtn');
const optionsBtn = document.getElementById('optionsBtn');
const refreshBtn = document.getElementById('refreshBtn');
const sheetOverlay = document.getElementById('sheetOverlay');
const optionsSheet = document.getElementById('optionsSheet');
const sheetTitle = document.getElementById('sheetTitle');
const sheetSubtitle = document.getElementById('sheetSubtitle');
const sheetBody = document.getElementById('sheetBody');
const sheetCancel = document.getElementById('sheetCancel');
const infoBtn = document.getElementById('infoBtn');
const infoOverlay = document.getElementById('infoOverlay');
const infoSheet = document.getElementById('infoSheet');
const infoCloseBtn = document.getElementById('infoCloseBtn');

/* ================= ENVIRONMENT ================= */
const env = {
  isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent),
  isSafari: /^((?!chrome|android).)*safari/i.test(navigator.userAgent),
  isStandalone: window.navigator.standalone === true || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches),
  isTV: /CrKey|Chromecast|SmartTV|Tizen|WebOS|NetCast|Roku|AppleTV|HbbTV|PlayStation|Xbox|TV|NETTV|Vidaa/i.test(navigator.userAgent)
};

/* ================= UTILITIES ================= */
function isVideoUrl(url) {
  if (!url) return false;
  const videoExts = ['.m3u8', '.mp4', '.webm', '.ts', '.m3u', '.mpd', '.mkv'];
  const lower = url.toLowerCase();
  return videoExts.some(ext => lower.includes(ext)) || lower.startsWith('http');
}

function isDirectStream(url) {
  if (!url) return false;
  const streamExts = ['.m3u8', '.mp4', '.webm', '.ts', '.m3u'];
  return streamExts.some(ext => url.toLowerCase().includes(ext));
}

function resolveChannelUrl(channel) {
  if (channel.id && state.templates[channel.id]) {
    return state.templates[channel.id].replace(/\{DATAVALUE\}/gi, channel.dataValue);
  }
  if (channel.url) return channel.url;
  return channel.dataValue;
}

function normalizeText(str) {
  return (str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/* ================= ANTI-INSPECCIÓN AVANZADO ================= */
(function initAntiInspect() {
  // Bloquear clic derecho
  document.addEventListener('contextmenu', function(e) {
    e.preventDefault();
    return false;
  }, true);

  // Bloquear selección de texto
  document.addEventListener('selectstart', function(e) {
    e.preventDefault();
    return false;
  }, true);

  // Bloquear arrastre de imágenes
  document.addEventListener('dragstart', function(e) {
    e.preventDefault();
    return false;
  }, true);

  // Bloquear copy/cut/paste
  document.addEventListener('copy', function(e) {
    e.preventDefault();
    return false;
  }, true);
  document.addEventListener('cut', function(e) {
    e.preventDefault();
    return false;
  }, true);
  document.addEventListener('paste', function(e) {
    e.preventDefault();
    return false;
  }, true);

  // Bloquear teclas de desarrollador
  document.addEventListener('keydown', function(e) {
    // F12
    if (e.key === 'F12' || e.keyCode === 123) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
    // Ctrl+Shift+I / Ctrl+Shift+J / Ctrl+Shift+C
    if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C' || e.keyCode === 73 || e.keyCode === 74 || e.keyCode === 67)) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
    // Ctrl+U (ver fuente)
    if (e.ctrlKey && (e.key === 'U' || e.keyCode === 85)) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
    // F11 (pantalla completa del navegador - no relacionado con devtools pero útil bloquear)
    if (e.key === 'F11' || e.keyCode === 122) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
    // Ctrl+S (guardar página)
    if (e.ctrlKey && (e.key === 'S' || e.keyCode === 83)) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
    // Ctrl+P (imprimir)
    if (e.ctrlKey && (e.key === 'P' || e.keyCode === 80)) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  }, true);

  // Detección de DevTools por tamaño de ventana
  let devtoolsOpen = false;
  const threshold = 160;

  function detectDevTools() {
    const widthThreshold = window.outerWidth - window.innerWidth > threshold;
    const heightThreshold = window.outerHeight - window.innerHeight > threshold;
    if ((widthThreshold || heightThreshold) && !devtoolsOpen) {
      devtoolsOpen = true;
      // Redirigir o limpiar
      document.body.innerHTML = '';
      window.location.href = 'about:blank';
    }
  }

  window.addEventListener('resize', detectDevTools);
  setInterval(detectDevTools, 1000);

  // Bloquear console.log básico (no es seguro pero disuade)
  if (!env.isTV) {
    const noop = function() {};
    try {
      console.log = noop;
      console.warn = noop;
      console.info = noop;
      console.debug = noop;
    } catch(e) {}
  }

  // Deshabilitar zoom con gestos táctiles
  document.addEventListener('touchmove', function(e) {
    if (e.scale !== 1) {
      e.preventDefault();
    }
  }, { passive: false });

  // Doble tap zoom
  let lastTouchEnd = 0;
  document.addEventListener('touchend', function(e) {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
      e.preventDefault();
    }
    lastTouchEnd = now;
  }, false);

  // Prevenir zoom con Ctrl+rueda
  document.addEventListener('wheel', function(e) {
    if (e.ctrlKey) {
      e.preventDefault();
    }
  }, { passive: false });
})();

/* ================= DATA LOADING ================= */
async function loadChannels() {
  try {
    const res = await fetch('channels.json', { cache: 'no-store' });
    const data = await res.json();
    state.templates = data.templates || {};
    state.banners = data.banners || [];
    state.rawChannels = (data.channels || []).map(ch => ({
      ...ch,
      resolvedUrl: resolveChannelUrl(ch)
    }));
    buildGroups();
    renderAll();
  } catch (e) {
    console.error('Error cargando canales:', e);
    channelsGrid.innerHTML = '';
    emptyState.querySelector('.empty-text').textContent = 'Error al cargar canales';
    emptyState.classList.add('visible');
  }
}

function buildGroups() {
  const groups = {};
  state.rawChannels.forEach(ch => {
    const key = ch.group || ch.dataValue;
    if (!groups[key]) groups[key] = [];
    groups[key].push(ch);
  });
  state.groups = groups;
}

/* ================= RENDERING ================= */
function getPrimaryChannel(group) {
  return group.find(ch => ch.description) || group[0];
}

function renderAll() {
  renderTiles();
}

function renderTiles() {
  const query = normalizeText(state.searchQuery);
  const groupEntries = Object.entries(state.groups);

  const filteredGroups = groupEntries.filter(([key, group]) => {
    if (!query) return true;
    return group.some(ch => {
      const name = normalizeText(ch.name);
      const desc = normalizeText(ch.description);
      const val = normalizeText(ch.dataValue);
      return name.includes(query) || desc.includes(query) || val.includes(query);
    });
  });

  const filteredBanners = query
    ? state.banners.filter(b =>
        normalizeText(b.title).includes(query) ||
        normalizeText(b.description).includes(query)
      )
    : state.banners;

  const totalItems = filteredBanners.length + filteredGroups.length;

  if (query) {
    const totalOptions = filteredGroups.reduce((sum, [, g]) => sum + g.length, 0);
    resultsCount.textContent = `${totalItems} resultado${totalItems !== 1 ? 's' : ''} (${filteredBanners.length} noticia${filteredBanners.length !== 1 ? 's' : ''}, ${filteredGroups.length} canal${filteredGroups.length !== 1 ? 'es' : ''}, ${totalOptions} señal${totalOptions !== 1 ? 'es' : ''})`;
    resultsCount.classList.add('visible');
  } else {
    resultsCount.classList.remove('visible');
  }

  channelsGrid.innerHTML = '';
  channelsGrid.className = 'tiles-grid';

  if (totalItems === 0) {
    emptyState.classList.add('visible');
    return;
  }
  emptyState.classList.remove('visible');

  let index = 0;

  // Render banners como tiles
  filteredBanners.forEach(banner => {
    const tile = createBannerTile(banner, index++);
    channelsGrid.appendChild(tile);
  });

  // Render channel groups como tiles
  filteredGroups.forEach(([key, group]) => {
    const tile = createChannelTile(key, group, index++);
    channelsGrid.appendChild(tile);
  });
}

function createBannerTile(banner, idx) {
  const tile = document.createElement('div');
  tile.className = 'tile tile-banner';
  tile.style.animationDelay = `${idx * 0.04}s`;

  tile.innerHTML = `
    <div class="tile-image-wrap">
      <img class="tile-image" src="${banner.image || ''}" alt="${banner.title}" loading="lazy" onerror="this.style.display='none'">
      <div class="tile-image-overlay"></div>
      <div class="tile-banner-badge">NOTI</div>
    </div>
    <div class="tile-content">
      <div class="tile-name">${banner.title}</div>
      ${banner.description ? `<div class="tile-options-count">${banner.description}</div>` : ''}
    </div>
  `;

  tile.addEventListener('click', () => openBannerSheet(banner));
  return tile;
}

function createChannelTile(key, group, idx) {
  const primary = getPrimaryChannel(group);
  const tile = document.createElement('div');
  tile.className = 'tile';
  tile.style.animationDelay = `${idx * 0.04}s`;

  const optionCount = group.length;
  // Si solo hay 1 opción: icono Play + "Canal"
  // Si hay más de 1: icono playlist + conteo de opciones
  const optionsText = optionCount > 1
    ? `<div class="tile-options-count"><span class="material-symbols-outlined">playlist_play</span> ${optionCount} opciones</div>`
    : `<div class="tile-options-count"><span class="material-symbols-outlined">play_arrow</span> Canal</div>`;

  const groupName = primary.groupName || primary.name || key;

  tile.innerHTML = `
    <div class="tile-image-wrap">
      <img class="tile-image" src="${primary.groupImage || primary.image || ''}" alt="${groupName}" loading="lazy" onerror="this.style.display='none'">
      <div class="tile-image-overlay"></div>
    </div>
    <div class="tile-content">
      <div class="tile-name">${groupName}</div>
      ${optionsText}
    </div>
  `;

  tile.addEventListener('click', () => {
    showOptionsSheet(group, null, (selected) => {
      openPlayer(selected, group);
    });
  });

  return tile;
}

/* ================= INTERACTION ================= */
function openPlayer(channel, group) {
  state.currentChannel = channel;
  state.currentGroupKey = channel.group || channel.dataValue;
  state.isPlaying = true;

  // Ocultar error overlay al abrir nuevo canal
  iframeErrorOverlay.style.display = 'none';

  playerTitle.textContent = channel.name;
  homeView.classList.remove('active');
  playerView.classList.add('active');

  if (group && group.length > 1) {
    optionsBtn.classList.add('has-options');
    optionsBtn.style.display = 'flex';
  } else {
    optionsBtn.classList.remove('has-options');
    optionsBtn.style.display = 'none';
  }

  loadMedia(channel.resolvedUrl);
}

function loadMedia(url) {
  playerLoader.style.display = 'flex';
  iframeErrorOverlay.style.display = 'none';

  const isStream = isDirectStream(url);

  if (isStream) {
    playerFrame.style.display = 'none';
    playerFrame.src = '';
    playerVideo.style.display = 'block';
    playerVideo.src = url;
    playerVideo.load();
    const playPromise = playerVideo.play();
    if (playPromise) {
      playPromise.then(() => {
        playerLoader.style.display = 'none';
      }).catch(() => {
        setTimeout(() => { playerLoader.style.display = 'none'; }, 800);
      });
    } else {
      playerLoader.style.display = 'none';
    }
  } else {
    playerVideo.style.display = 'none';
    playerVideo.pause();
    playerVideo.src = '';
    playerVideo.load();
    playerFrame.style.display = 'block';
    playerFrame.src = url;

    // Manejo de carga del iframe
    let loadTimeout;
    let hasLoaded = false;

    playerFrame.onload = function() {
      hasLoaded = true;
      clearTimeout(loadTimeout);
      playerLoader.style.display = 'none';
      // Verificar si el iframe cargó un error de Chrome
      checkIframeError();
    };

    playerFrame.onerror = function() {
      hasLoaded = true;
      clearTimeout(loadTimeout);
      showIframeError();
    };

    // Timeout de seguridad
    loadTimeout = setTimeout(() => {
      if (!hasLoaded) {
        playerLoader.style.display = 'none';
        showIframeError();
      }
    }, 8000);

    // Timeout adicional para detectar errores de Chrome
    setTimeout(() => {
      if (playerFrame.style.display !== 'none') {
        checkIframeError();
      }
    }, 3500);
  }
}

/* ================= IFRAME ERROR HANDLING ================= */
function checkIframeError() {
  try {
    // Intentar acceder al contenido del iframe para detectar errores de Chrome
    const frameDoc = playerFrame.contentDocument || playerFrame.contentWindow?.document;
    if (frameDoc) {
      const bodyText = frameDoc.body?.innerText || '';
      const titleText = frameDoc.title || '';
      const url = frameDoc.location?.href || '';

      // Detectar páginas de error de Chrome
      if (
        url.includes('chrome-error') ||
        url.includes('chromewebdata') ||
        bodyText.includes('No se puede acceder a este sitio') ||
        bodyText.includes('This site can\'t be reached') ||
        bodyText.includes('No se puede llegar a este sitio') ||
        bodyText.includes('ERR_') ||
        bodyText.includes('error') && bodyText.includes('chrome') ||
        titleText.includes('Error') ||
        titleText.includes('No se puede') ||
        frameDoc.body?.innerHTML?.includes('icon-generic') ||
        frameDoc.body?.innerHTML?.includes('sub-frame-error')
      ) {
        showIframeError();
        return;
      }
    }
  } catch (e) {
    // Cross-origin, no podemos acceder - verificar por URL visible
    const frameSrc = playerFrame.src || '';
    if (frameSrc.includes('chrome-error') || frameSrc.includes('chromewebdata')) {
      showIframeError();
      return;
    }
  }

  // Si el iframe está vacío o no cargó nada visible
  try {
    const rect = playerFrame.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      // Verificar si el iframe tiene contenido visible
      const computedStyle = window.getComputedStyle(playerFrame);
      if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden') {
        showIframeError();
      }
    }
  } catch (e) {}
}

function showIframeError() {
  iframeErrorOverlay.style.display = 'flex';
  playerLoader.style.display = 'none';
}

function hideIframeError() {
  iframeErrorOverlay.style.display = 'none';
}

function refreshPlayer() {
  if (!state.currentChannel) return;
  hideIframeError();
  const url = state.currentChannel.resolvedUrl;
  const isStream = isDirectStream(url);

  playerLoader.style.display = 'flex';

  if (isStream) {
    playerVideo.pause();
    playerVideo.currentTime = 0;
    playerVideo.src = '';
    playerVideo.load();
    setTimeout(() => {
      loadMedia(url);
    }, 100);
  } else {
    const oldSrc = playerFrame.src;
    playerFrame.src = '';
    setTimeout(() => {
      playerFrame.src = oldSrc;
      setTimeout(() => { playerLoader.style.display = 'none'; }, 1500);
    }, 100);
  }
}

function goBack() {
  hideIframeError();
  playerVideo.pause();
  playerVideo.src = '';
  playerVideo.load();
  playerFrame.src = '';
  playerLoader.style.display = 'none';

  closeSheet();
  closeInfo();

  state.currentChannel = null;
  state.currentGroupKey = null;
  state.isPlaying = false;

  playerView.classList.remove('active');
  homeView.classList.add('active');
}

/* ================= OPTIONS SHEET ================= */
let sheetCallback = null;

function showOptionsSheet(group, currentChannel, callback) {
  sheetCallback = callback;
  const primary = getPrimaryChannel(group);
  sheetTitle.textContent = primary.groupName;
  sheetSubtitle.textContent = `${group.length} señal${group.length !== 1 ? 'es' : ''} disponible${group.length !== 1 ? 's' : ''}`;

  sheetBody.innerHTML = '';
  group.forEach((ch, i) => {
    const item = document.createElement('div');
    item.className = 'sheet-item' + (currentChannel && currentChannel === ch ? ' active' : '');
    const label = ch.description || `Opción ${i + 1}`;
    item.innerHTML = `
      <img class="sheet-item-img" src="${ch.image || primary.image || ''}" alt="" loading="lazy">
      <div class="sheet-item-info">
        <div class="sheet-item-name">${ch.name}</div>
        <div class="sheet-item-desc">${label}</div>
      </div>
      <div class="sheet-item-check">
        ${currentChannel && currentChannel === ch ? '<span class="material-symbols-outlined" style="font-size:14px;">check</span>' : ''}
      </div>
    `;
    item.addEventListener('click', () => {
      if (sheetCallback) sheetCallback(ch);
      closeSheet();
    });
    sheetBody.appendChild(item);
  });

  sheetOverlay.classList.add('open');
  optionsSheet.classList.add('open');
}

function closeSheet() {
  sheetOverlay.classList.remove('open');
  optionsSheet.classList.remove('open');
  sheetCallback = null;
}

/* ================= BANNER SHEET ================= */
function openBannerSheet(banner) {
  sheetTitle.textContent = banner.title;
  sheetSubtitle.textContent = banner.description || 'Información';

  sheetBody.innerHTML = `
    <div class="info-content" style="padding: 8px 4px;">
      ${banner.content || '<p>Sin contenido</p>'}
    </div>
  `;

  sheetOverlay.classList.add('open');
  optionsSheet.classList.add('open');
  sheetCallback = null;
}

/* ================= INFO SHEET ================= */
function openInfo() {
  infoOverlay.classList.add('open');
  infoSheet.classList.add('open');
}

function closeInfo() {
  infoOverlay.classList.remove('open');
  infoSheet.classList.remove('open');
}

/* ================= SEARCH ================= */
let searchTimeout = null;

function onSearchInput() {
  const val = searchInput.value.trim();
  state.searchQuery = val;

  if (val.length > 0) {
    searchClear.classList.add('visible');
  } else {
    searchClear.classList.remove('visible');
  }

  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    renderTiles();
  }, val.length === 0 ? 0 : 150);
}

function clearSearch() {
  searchInput.value = '';
  state.searchQuery = '';
  searchClear.classList.remove('visible');
  resultsCount.classList.remove('visible');
  renderTiles();
  searchInput.focus();
}

/* ================= EVENT LISTENERS ================= */
searchInput.addEventListener('input', onSearchInput);
searchInput.addEventListener('keyup', onSearchInput);
searchClear.addEventListener('click', clearSearch);

playerBack.addEventListener('click', goBack);
refreshBtn.addEventListener('click', refreshPlayer);

// Botón retry del error overlay
if (iframeRetryBtn) {
  iframeRetryBtn.addEventListener('click', refreshPlayer);
}

infoBtn.addEventListener('click', openInfo);
infoCloseBtn.addEventListener('click', closeInfo);
infoOverlay.addEventListener('click', closeInfo);

optionsBtn.addEventListener('click', () => {
  if (!state.currentGroupKey) return;
  const group = state.groups[state.currentGroupKey];
  if (!group || group.length <= 1) return;
  showOptionsSheet(group, state.currentChannel, (selected) => {
    state.currentChannel = selected;
    playerTitle.textContent = selected.name;
    hideIframeError();
    loadMedia(selected.resolvedUrl);
  });
});

sheetOverlay.addEventListener('click', closeSheet);
sheetCancel.addEventListener('click', closeSheet);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' || e.key === 'Backspace') {
    if (infoSheet.classList.contains('open')) {
      closeInfo();
    } else if (optionsSheet.classList.contains('open')) {
      closeSheet();
    } else if (playerView.classList.contains('active')) {
      goBack();
    }
  }
});

window.addEventListener('popstate', () => {
  if (playerView.classList.contains('active')) {
    goBack();
    history.pushState({ view: 'home' }, '');
  }
});

// iOS standalone tap fix
document.addEventListener('touchstart', () => {}, { passive: true });

/* ================= PWA / SERVICE WORKER ================= */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

/* ================= INIT ================= */
function init() {
  loadChannels();
  history.pushState({ view: 'home' }, '');
}

init();
