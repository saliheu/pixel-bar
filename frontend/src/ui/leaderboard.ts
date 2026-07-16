import { ICON_TROPHY } from './icons.js';

// Gecenin Liderleri: bu oturumda en çok oyun kazanan 5 kişi (salon bazlı,
// sunucudan canlı gelir). HUD'daki kupa düğmesiyle açılıp kapanır.

let panelEl: HTMLDivElement;
let listEl: HTMLOListElement;
let latestTop: { name: string; wins: number }[] = [];

export function initLeaderboard(root: HTMLElement): void {
  panelEl = document.createElement('div');
  panelEl.className = 'leaderboard hidden';

  const heading = document.createElement('div');
  heading.className = 'leaderboard__heading';
  heading.innerHTML = `${ICON_TROPHY}<span>Gecenin Liderleri</span>`;
  panelEl.appendChild(heading);

  listEl = document.createElement('ol');
  listEl.className = 'leaderboard__list';
  panelEl.appendChild(listEl);

  root.appendChild(panelEl);
  render();
}

export function toggleLeaderboard(): void {
  panelEl.classList.toggle('hidden');
}

export function renderLeaderboard(top: { name: string; wins: number }[]): void {
  latestTop = top;
  render();
}

function render(): void {
  if (!listEl) return;
  listEl.innerHTML = '';
  if (latestTop.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'leaderboard__empty';
    empty.textContent = 'Henüz galibiyet yok — ilk sen ol!';
    listEl.appendChild(empty);
    return;
  }
  latestTop.forEach((entry, i) => {
    const li = document.createElement('li');
    li.className = 'leaderboard__row' + (i === 0 ? ' leaderboard__row--first' : '');
    const rank = document.createElement('span');
    rank.className = 'leaderboard__rank';
    rank.textContent = String(i + 1);
    const name = document.createElement('span');
    name.className = 'leaderboard__name';
    name.textContent = entry.name;
    const wins = document.createElement('span');
    wins.className = 'leaderboard__wins';
    wins.textContent = String(entry.wins);
    li.appendChild(rank);
    li.appendChild(name);
    li.appendChild(wins);
    listEl.appendChild(li);
  });
}
