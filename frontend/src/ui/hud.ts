import { isMuted, toggleMute } from './sound.js';
import { ICON_DOOR, ICON_NOTE, ICON_SOUND_ON, ICON_SOUND_OFF, ICON_STAR, ICON_TROPHY } from './icons.js';
import { toggleLeaderboard } from './leaderboard.js';
import { toggleJukeboxPanel } from './jukebox.js';

let countEl: HTMLSpanElement;
let barNameEl: HTMLSpanElement;
let badgeEl: HTMLSpanElement;

// Üst HUD çubuğu: logo, kontrol ipuçları, canlı oyuncu sayısı.
export function initHud(root: HTMLElement): void {
  const bar = document.createElement('div');
  bar.className = 'hud-bar';

  const logo = document.createElement('div');
  logo.className = 'hud-bar__logo neon-logo neon-logo--small';
  logo.innerHTML = '<span class="neon-logo__word neon-logo__word--cyan">PİKSEL</span> <span class="neon-logo__word neon-logo__word--pink">BAR</span>';
  bar.appendChild(logo);

  barNameEl = document.createElement('span');
  barNameEl.className = 'hud-bar__room';
  bar.appendChild(barNameEl);

  badgeEl = document.createElement('span');
  badgeEl.className = 'hud-bar__badge hidden';
  badgeEl.innerHTML = `${ICON_STAR}<span>Müdavim</span>`;
  badgeEl.title = 'İlk Gece Görevleri tamamlandı';
  bar.appendChild(badgeEl);

  const hints = document.createElement('div');
  hints.className = 'hud-bar__hints';
  hints.innerHTML =
    '<span class="hud-hint"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> gez</span>' +
    '<span class="hud-hint"><kbd>E</kbd> otur / kalk</span>' +
    '<span class="hud-hint"><kbd>1</kbd>–<kbd>6</kbd> emote</span>';
  bar.appendChild(hints);

  const right = document.createElement('div');
  right.className = 'hud-bar__right';

  const online = document.createElement('div');
  online.className = 'hud-bar__online';
  online.innerHTML = '<span class="hud-bar__online-dot"></span>';
  countEl = document.createElement('span');
  countEl.textContent = '–';
  online.appendChild(countEl);
  right.appendChild(online);

  const trophyBtn = document.createElement('button');
  trophyBtn.type = 'button';
  trophyBtn.className = 'hud-bar__mute';
  trophyBtn.innerHTML = ICON_TROPHY;
  trophyBtn.title = 'Gecenin Liderleri';
  trophyBtn.addEventListener('click', () => {
    toggleLeaderboard();
    trophyBtn.blur();
  });
  right.appendChild(trophyBtn);

  const switchBtn = document.createElement('button');
  switchBtn.type = 'button';
  switchBtn.className = 'hud-bar__mute';
  switchBtn.innerHTML = ICON_DOOR;
  switchBtn.title = 'Salon değiştir';
  switchBtn.addEventListener('click', () => {
    // en temiz salon geçişi: bağlantıyı koparıp giriş ekranına dönmek
    window.location.reload();
  });
  right.appendChild(switchBtn);

  const musicBtn = document.createElement('button');
  musicBtn.type = 'button';
  musicBtn.className = 'hud-bar__mute';
  musicBtn.innerHTML = ICON_NOTE;
  musicBtn.title = 'Müzik Kutusu';
  musicBtn.addEventListener('click', () => {
    toggleJukeboxPanel();
    musicBtn.blur();
  });
  right.appendChild(musicBtn);

  const muteBtn = document.createElement('button');
  muteBtn.type = 'button';
  muteBtn.className = 'hud-bar__mute';
  muteBtn.innerHTML = isMuted() ? ICON_SOUND_OFF : ICON_SOUND_ON;
  muteBtn.title = 'Ses aç/kapat';
  muteBtn.addEventListener('click', () => {
    muteBtn.innerHTML = toggleMute() ? ICON_SOUND_OFF : ICON_SOUND_ON;
    muteBtn.blur();
  });
  right.appendChild(muteBtn);

  bar.appendChild(right);

  root.appendChild(bar);
}

export function setOnlineCount(n: number): void {
  if (countEl) countEl.textContent = `${n} kişi salonda`;
}

export function setBarName(label: string): void {
  if (barNameEl) barNameEl.textContent = label;
}

export function setRegularBadge(visible: boolean): void {
  if (badgeEl) badgeEl.classList.toggle('hidden', !visible);
}
