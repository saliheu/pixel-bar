import { sfx } from './sound.js';
import { showToast } from './toast.js';
import { setRegularBadge } from './hud.js';
import { ICON_WAVE, ICON_CHAT, ICON_COCKTAIL, ICON_DANCE, ICON_GAMEPAD, ICON_TROPHY, ICON_MOON } from './icons.js';

// İlk Gece Görevleri: yeni kullanıcıya ilk dakikalarda hedef verir ve
// barın tüm özelliklerini keşfettirir. Durum localStorage'da tutulur.
const QUESTS = [
  { id: 'emote', icon: ICON_WAVE, label: 'Bir emote yap (1–6)' },
  { id: 'chat', icon: ICON_CHAT, label: 'Sohbete bir şey yaz' },
  { id: 'stool', icon: ICON_COCKTAIL, label: 'Bar taburesine otur, içkini kap' },
  { id: 'dance', icon: ICON_DANCE, label: 'Dans pistinde dans et' },
  { id: 'table', icon: ICON_GAMEPAD, label: 'Bir oyun masasına otur' },
  { id: 'game', icon: ICON_TROPHY, label: 'Bir oyunu sonuna kadar oyna' },
] as const;

export type QuestId = (typeof QUESTS)[number]['id'];

const STORAGE_KEY = 'pikselbar.quests';
const DONE_KEY = 'pikselbar.quests.done';

let panelEl: HTMLDivElement | null = null;
let listEl: HTMLUListElement;
let headerCountEl: HTMLSpanElement;
let completed = new Set<QuestId>();
const itemEls = new Map<QuestId, HTMLLIElement>();

function loadState(): void {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as string[];
    completed = new Set(raw.filter((id): id is QuestId => QUESTS.some((q) => q.id === id)));
  } catch {
    completed = new Set();
  }
}

function saveState(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...completed]));
}

export function isRegular(): boolean {
  return localStorage.getItem(DONE_KEY) === '1';
}

function renderItem(li: HTMLLIElement, done: boolean): void {
  li.classList.toggle('quests__item--done', done);
}

function updateHeader(): void {
  headerCountEl.textContent = `${completed.size}/${QUESTS.length}`;
}

// Ekranın her yerine düşen küçük konfeti parçaları (DOM, 3 sn'de kaybolur).
function confettiBurst(): void {
  const colors = ['#38bdf8', '#f472b6', '#fbbf24', '#4ade80', '#b39ddb'];
  for (let i = 0; i < 28; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = `${Math.random() * 100}vw`;
    piece.style.background = colors[i % colors.length];
    piece.style.animationDelay = `${Math.random() * 0.6}s`;
    piece.style.animationDuration = `${1.8 + Math.random() * 1.4}s`;
    piece.style.setProperty('--drift', `${(Math.random() - 0.5) * 160}px`);
    document.body.appendChild(piece);
    setTimeout(() => piece.remove(), 4000);
  }
}

export function initQuests(root: HTMLElement): void {
  if (isRegular()) {
    setRegularBadge(true);
    return; // görevler zaten bitmiş; panel hiç gösterilmez
  }
  loadState();

  panelEl = document.createElement('div');
  panelEl.className = 'quests';

  const header = document.createElement('button');
  header.type = 'button';
  header.className = 'quests__header';
  header.innerHTML = `<span class="quests__title">${ICON_MOON}<span>İlk Gece Görevleri</span></span>`;
  headerCountEl = document.createElement('span');
  headerCountEl.className = 'quests__count';
  header.appendChild(headerCountEl);
  header.addEventListener('click', () => {
    panelEl?.classList.toggle('quests--collapsed');
    header.blur();
  });
  panelEl.appendChild(header);

  listEl = document.createElement('ul');
  listEl.className = 'quests__list';
  for (const q of QUESTS) {
    const li = document.createElement('li');
    li.className = 'quests__item';
    li.innerHTML = `<span class="quests__check"></span><span class="quests__icon">${q.icon}</span><span>${q.label}</span>`;
    renderItem(li, completed.has(q.id));
    itemEls.set(q.id, li);
    listEl.appendChild(li);
  }
  panelEl.appendChild(listEl);
  updateHeader();

  root.appendChild(panelEl);
}

// Bir görevi tamamlar (idempotent). Hepsi bitince kutlama + kalıcı rozet.
export function questComplete(id: QuestId): void {
  if (!panelEl || isRegular() || completed.has(id)) return;
  completed.add(id);
  saveState();
  const li = itemEls.get(id);
  if (li) {
    renderItem(li, true);
    li.classList.add('quests__item--pop');
  }
  updateHeader();
  sfx.match();

  if (completed.size === QUESTS.length) {
    localStorage.setItem(DONE_KEY, '1');
    setTimeout(() => {
      confettiBurst();
      sfx.win();
      showToast('Tüm görevler tamam! Artık barın müdavimisin.', 'info');
      setRegularBadge(true);
      panelEl?.classList.add('quests--finished');
      setTimeout(() => panelEl?.remove(), 1200);
    }, 600);
  }
}
