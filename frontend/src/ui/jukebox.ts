import { sendMessage } from '../net/socket.js';
import { showToast } from './toast.js';
import { isMuted, onMuteChange, stopMusic, toggleMusic, isMusicOn } from './sound.js';
import { ICON_NOTE } from './icons.js';

// Müzik kutusu: jeton atıp YouTube şarkısı çaldırma. Kuyruk sunucuda, çalma
// istemcide (gizli YouTube IFrame player). Salondaki herkes aynı şarkıyı duyar;
// geç katılan elapsedMs kadar ileriden başlar.

interface JukeboxCurrent {
  videoId: string;
  title: string;
  addedBy: string;
  elapsedMs: number;
}
interface JukeboxQueueItem {
  videoId: string;
  title: string;
  addedBy: string;
}
export interface JukeboxStatePayload {
  current: JukeboxCurrent | null;
  queue: JukeboxQueueItem[];
}

const VOLUME_KEY = 'pikselbar.musicVolume';
function loadVolume(): number {
  const v = Number(localStorage.getItem(VOLUME_KEY));
  return Number.isFinite(v) && v >= 0 && v <= 100 ? v : 35;
}
let musicVolume = loadVolume();

let panelEl: HTMLDivElement;
let volumeEl: HTMLInputElement;
let nowTitleEl: HTMLDivElement;
let nowByEl: HTMLDivElement;
let queueEl: HTMLOListElement;
let inputEl: HTMLInputElement;
let addBtn: HTMLButtonElement;
let skipBtn: HTMLButtonElement;
let playHintBtn: HTMLButtonElement;
let radioBtn: HTMLButtonElement;

let currentVideoId: string | null = null;
let lastLoadedId: string | null = null;
let pendingSeekMs = 0;
let hasSong = false;

// YouTube IFrame API tipleri projeye eklenmedi; player 'any' olarak tutulur.
let player: any = null;
let playerReady = false;
let apiRequested = false;

export function jukeboxHasSong(): boolean {
  return hasSong;
}

function loadYouTubeApi(): void {
  if (apiRequested) return;
  apiRequested = true;
  (window as unknown as Record<string, unknown>).onYouTubeIframeAPIReady = createPlayer;
  const s = document.createElement('script');
  s.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(s);
}

function createPlayer(): void {
  const host = document.createElement('div');
  host.id = 'jukebox-yt-host';
  // ekran dışında ama render edilir durumda (display:none oynatmayı bozabilir)
  host.style.cssText = 'position:fixed;left:-9999px;bottom:0;width:200px;height:112px;pointer-events:none;';
  document.body.appendChild(host);

  const YT = (window as unknown as Record<string, any>).YT;
  player = new YT.Player('jukebox-yt-host', {
    width: 200,
    height: 112,
    playerVars: { autoplay: 1, controls: 0, disablekb: 1, rel: 0, origin: window.location.origin },
    events: {
      onReady: () => {
        playerReady = true;
        applyMute(isMuted());
        syncPlayer();
      },
      onStateChange: (e: { data: number }) => {
        // 0 = ENDED: sunucuya bildir, sıradakine geçilsin
        if (e.data === 0 && currentVideoId) {
          sendMessage({ type: 'jukebox_ended', payload: { videoId: currentVideoId } });
        }
        updatePlayHint();
      },
      onError: () => {
        // gömme kapalı / bulunamadı: otomatik atla
        if (currentVideoId) {
          showToast('Bu video oynatılamıyor (gömme kapalı olabilir), atlanıyor.', 'error');
          sendMessage({ type: 'jukebox_ended', payload: { videoId: currentVideoId } });
        }
      },
    },
  });
}

function applyMute(muted: boolean): void {
  if (!playerReady || !player) return;
  if (muted) player.mute?.();
  else {
    player.unMute?.();
    player.setVolume?.(musicVolume);
  }
}

// Kaydırıcıdan gelen müzik sesini uygular ve saklar.
function setMusicVolume(vol: number): void {
  musicVolume = Math.max(0, Math.min(100, Math.round(vol)));
  localStorage.setItem(VOLUME_KEY, String(musicVolume));
  if (playerReady && player && !isMuted()) player.setVolume?.(musicVolume);
}

function syncPlayer(): void {
  if (!playerReady || !player) return;
  if (!currentVideoId) {
    lastLoadedId = null;
    player.stopVideo?.();
    updatePlayHint();
    return;
  }
  if (lastLoadedId === currentVideoId) return; // kuyruk güncellemesinde şarkıyı baştan başlatma
  lastLoadedId = currentVideoId;
  player.loadVideoById?.({ videoId: currentVideoId, startSeconds: Math.max(0, pendingSeekMs / 1000) });
  setTimeout(updatePlayHint, 1500);
}

// Tarayıcı otomatik oynatmayı engellediyse "Sesi Başlat" düğmesi gösterilir;
// tıklama kullanıcı etkileşimi sayıldığı için oynatma bu kez izinlidir.
function updatePlayHint(): void {
  if (!playHintBtn) return;
  let blocked = false;
  if (hasSong && playerReady && player?.getPlayerState) {
    const s = player.getPlayerState();
    blocked = s === -1 || s === 5 || s === 2; // UNSTARTED / CUED / PAUSED
  }
  playHintBtn.classList.toggle('hidden', !blocked);
}

function parseVideoId(input: string): string | null {
  const s = input.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  try {
    const u = new URL(s);
    if (u.hostname.includes('youtu.be')) {
      const id = u.pathname.slice(1).split('/')[0];
      return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
    }
    const v = u.searchParams.get('v');
    if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return v;
    const m = u.pathname.match(/\/(shorts|embed|live)\/([A-Za-z0-9_-]{11})/);
    if (m) return m[2];
  } catch {
    // URL değilse aşağıda null döner
  }
  return null;
}

async function fetchTitle(videoId: string): Promise<string> {
  try {
    const url = `https://noembed.com/embed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`;
    const res = await fetch(url);
    const data = (await res.json()) as { title?: unknown };
    if (typeof data.title === 'string' && data.title.trim()) return data.title.trim();
  } catch {
    // başlık alınamazsa genel ad kullanılır
  }
  return 'YouTube parçası';
}

export function initJukebox(root: HTMLElement): void {
  panelEl = document.createElement('div');
  panelEl.className = 'jukebox-panel hidden';

  const header = document.createElement('div');
  header.className = 'jukebox-panel__header';
  header.innerHTML = `<span class="jukebox-panel__title">${ICON_NOTE}<span>Müzik Kutusu</span></span>`;
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'jukebox-panel__close';
  closeBtn.textContent = '×';
  closeBtn.setAttribute('aria-label', 'Kapat');
  closeBtn.addEventListener('click', () => setJukeboxPanelOpen(false));
  header.appendChild(closeBtn);
  panelEl.appendChild(header);

  const now = document.createElement('div');
  now.className = 'jukebox-panel__now';
  nowTitleEl = document.createElement('div');
  nowTitleEl.className = 'jukebox-panel__now-title';
  nowByEl = document.createElement('div');
  nowByEl.className = 'jukebox-panel__now-by';
  now.appendChild(nowTitleEl);
  now.appendChild(nowByEl);
  panelEl.appendChild(now);

  const actions = document.createElement('div');
  actions.className = 'jukebox-panel__actions';

  playHintBtn = document.createElement('button');
  playHintBtn.type = 'button';
  playHintBtn.className = 'jukebox-panel__play hidden';
  playHintBtn.textContent = 'Sesi Başlat';
  playHintBtn.addEventListener('click', () => {
    player?.playVideo?.();
    setTimeout(updatePlayHint, 800);
  });
  actions.appendChild(playHintBtn);

  skipBtn = document.createElement('button');
  skipBtn.type = 'button';
  skipBtn.className = 'jukebox-panel__skip hidden';
  skipBtn.textContent = 'Atla';
  skipBtn.addEventListener('click', () => sendMessage({ type: 'jukebox_skip', payload: {} }));
  actions.appendChild(skipBtn);

  radioBtn = document.createElement('button');
  radioBtn.type = 'button';
  radioBtn.className = 'jukebox-panel__radio';
  radioBtn.textContent = 'Radyo modu';
  radioBtn.title = 'Şarkı yokken çalan hafif bip müziği';
  radioBtn.addEventListener('click', () => {
    const on = toggleMusic();
    radioBtn.classList.toggle('jukebox-panel__radio--on', on);
  });
  actions.appendChild(radioBtn);

  panelEl.appendChild(actions);

  // müzik ses seviyesi kaydırıcısı
  const volRow = document.createElement('div');
  volRow.className = 'jukebox-panel__volume';
  volRow.innerHTML = `<span class="jukebox-panel__volume-label">${ICON_NOTE}</span>`;
  volumeEl = document.createElement('input');
  volumeEl.type = 'range';
  volumeEl.min = '0';
  volumeEl.max = '100';
  volumeEl.step = '1';
  volumeEl.value = String(musicVolume);
  volumeEl.setAttribute('aria-label', 'Müzik sesi');
  const volVal = document.createElement('span');
  volVal.className = 'jukebox-panel__volume-val';
  volVal.textContent = String(musicVolume);
  volumeEl.addEventListener('input', () => {
    setMusicVolume(Number(volumeEl.value));
    volVal.textContent = String(musicVolume);
  });
  volRow.appendChild(volumeEl);
  volRow.appendChild(volVal);
  panelEl.appendChild(volRow);

  queueEl = document.createElement('ol');
  queueEl.className = 'jukebox-panel__queue';
  panelEl.appendChild(queueEl);

  const form = document.createElement('form');
  form.className = 'jukebox-panel__form';
  inputEl = document.createElement('input');
  inputEl.type = 'text';
  inputEl.placeholder = 'YouTube linki yapıştır...';
  inputEl.autocomplete = 'off';
  form.appendChild(inputEl);
  addBtn = document.createElement('button');
  addBtn.type = 'submit';
  addBtn.textContent = 'Jeton At';
  form.appendChild(addBtn);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const videoId = parseVideoId(inputEl.value);
    if (!videoId) {
      showToast('Geçerli bir YouTube linki yapıştır.', 'error');
      return;
    }
    addBtn.disabled = true;
    addBtn.textContent = '...';
    const title = await fetchTitle(videoId);
    sendMessage({ type: 'jukebox_add', payload: { videoId, title } });
    inputEl.value = '';
    addBtn.disabled = false;
    addBtn.textContent = 'Jeton At';
  });
  panelEl.appendChild(form);

  const hint = document.createElement('div');
  hint.className = 'jukebox-panel__hint';
  hint.textContent = 'Şarkı salondaki herkeste çalar. Sıradaki jeton için 20 sn bekle.';
  panelEl.appendChild(hint);

  root.appendChild(panelEl);

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setJukeboxPanelOpen(false);
  });
  onMuteChange(applyMute);
}

export function setJukeboxPanelOpen(open: boolean): void {
  panelEl.classList.toggle('hidden', !open);
  if (open) inputEl.focus();
  else inputEl.blur();
}

export function toggleJukeboxPanel(): void {
  setJukeboxPanelOpen(panelEl.classList.contains('hidden'));
}

export function renderJukeboxState(payload: JukeboxStatePayload, selfName: string): void {
  hasSong = payload.current !== null;
  currentVideoId = payload.current?.videoId ?? null;
  pendingSeekMs = payload.current?.elapsedMs ?? 0;

  if (payload.current) {
    stopMusic(); // gerçek şarkı başlayınca radyo bip'i sussun
    radioBtn?.classList.remove('jukebox-panel__radio--on');
    if (!apiRequested) loadYouTubeApi();
  }
  syncPlayer();

  if (nowTitleEl) {
    if (payload.current) {
      nowTitleEl.textContent = payload.current.title;
      nowByEl.textContent = `Jetonu atan: ${payload.current.addedBy}`;
      skipBtn.classList.toggle('hidden', payload.current.addedBy !== selfName);
    } else {
      nowTitleEl.textContent = 'Sessizlik...';
      nowByEl.textContent = 'İlk jetonu sen at.';
      skipBtn.classList.add('hidden');
      updatePlayHint();
    }

    queueEl.innerHTML = '';
    payload.queue.forEach((song, i) => {
      const li = document.createElement('li');
      li.className = 'jukebox-panel__queue-item';
      const idx = document.createElement('span');
      idx.className = 'jukebox-panel__queue-rank';
      idx.textContent = String(i + 1);
      const title = document.createElement('span');
      title.className = 'jukebox-panel__queue-title';
      title.textContent = song.title;
      title.title = `${song.title} — ekleyen ${song.addedBy}`;
      li.appendChild(idx);
      li.appendChild(title);
      queueEl.appendChild(li);
    });
    if (payload.queue.length === 0) {
      const li = document.createElement('li');
      li.className = 'jukebox-panel__queue-empty';
      li.textContent = 'Kuyruk boş.';
      queueEl.appendChild(li);
    }
  }

  if (radioBtn) radioBtn.classList.toggle('jukebox-panel__radio--on', isMusicOn());
}
