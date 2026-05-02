/**
 * Stream TV - Multi-Stream Player
 * iOS-optimized PWA with elegant native-like UX
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
const optionsBtn = document.getElementById('optionsBtn');
const refreshBtn = document.getElementById('refreshBtn');
const sheetOverlay = document.getElementById('sheetOverlay');
const optionsSheet = document.getElementById('optionsSheet');
const sheetTitle = document.getElementById('sheetTitle');
const sheetSubtitle = document.getElementById('sheetSubtitle');
const sheetBody = document.getElementById('sheetBody');
const sheetCancel = document.getElementById('sheetCancel');
const themeBtn = document.getElementById('themeBtn');
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

/* ================= THEME ================= */
function initTheme() {
  const saved = localStorage.getItem('streamtv-theme');
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = saved || (prefersDark ? 'dark' : 'light');
  applyTheme(theme);
}

function applyTheme(theme) {
  const html = document.documentElement;
  if (theme === 'dark') {
    html.classList.add('force-dark');
    html.classList.remove('force-light');
  } else {
    html.classList.add('force-light');
    html.classList.remove('force-dark');
  }
  localStorage.setItem('streamtv-theme', theme);
  updateThemeIcon(theme);
}

function toggleTheme() {
  const isDark = document.documentElement.classList.contains('force-dark');
  applyTheme(isDark ? 'light' : 'dark');
}

function updateThemeIcon(theme) {
  if (!themeBtn) return;
  themeBtn.textContent = theme === 'dark' ? 'light_mode' : 'dark_mode';
}

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
      <div class="tile-banner-badge">Info</div>
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
  const optionsText = optionCount > 1
    ? `<div class="tile-options-count"><span class="material-symbols-outlined">playlist_play</span> ${optionCount} opciones</div>`
    : '';

  // ← AQUÍ: antes del HTML, en JavaScript puro
  const groupName = primary.groupName || key;

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
    playerFrame.onload = () => { playerLoader.style.display = 'none'; };
    playerFrame.onerror = () => { playerLoader.style.display = 'none'; };
    setTimeout(() => { playerLoader.style.display = 'none'; }, 3000);
  }
}

function refreshPlayer() {
  if (!state.currentChannel) return;
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
  sheetTitle.textContent = primary.name;
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

themeBtn.addEventListener('click', toggleTheme);
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
  initTheme();
  loadChannels();
  history.pushState({ view: 'home' }, '');
}

init();