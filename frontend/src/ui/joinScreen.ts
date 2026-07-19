import { Application } from 'pixi.js';
import { AVATAR_PALETTE, HATS, BARS, BAR_CAPACITY, LOBBIES_URL, NAME_MAX_LENGTH, NAME_MIN_LENGTH } from '../config.js';
import { HAT_ICONS } from './icons.js';
import { createPlayerVisual, updatePlayerVisual, playEmote, type PlayerVisual } from '../pixi/player.js';
import { isTouchLayout } from '../input/touch.js';

const NAME_STORAGE_KEY = 'pikselbar.name';
const COLOR_STORAGE_KEY = 'pikselbar.color';
const HAT_STORAGE_KEY = 'pikselbar.hat';
const BAR_STORAGE_KEY = 'pikselbar.bar';

function hexColor(c: number): string {
  return `#${c.toString(16).padStart(6, '0')}`;
}

interface LobbyInfo {
  capacity: number;
  bars: { id: string; count: number }[];
}

// Giriş ekranını kurar; oyuncu oda seçip "Bara Gir" deyince
// onJoin(name, colorIdx, hat, barId) çağrılır ve overlay kapanış animasyonuyla kaldırılır.
export function initJoinScreen(root: HTMLElement, onJoin: (name: string, color: number, hat: number, bar: string) => void): void {
  const overlay = document.createElement('div');
  overlay.className = 'join-screen';

  const logo = document.createElement('div');
  logo.className = 'neon-logo join-screen__logo';
  logo.innerHTML = '<span class="neon-logo__word neon-logo__word--cyan">PİKSEL</span> <span class="neon-logo__word neon-logo__word--pink">BAR</span>';
  overlay.appendChild(logo);

  const tagline = document.createElement('div');
  tagline.className = 'join-screen__tagline';
  tagline.textContent = 'Arkadaşlarınla takıl, otur, oyna';
  overlay.appendChild(tagline);

  const card = document.createElement('form');
  card.className = 'glass-card join-screen__card';

  const nameLabel = document.createElement('label');
  nameLabel.className = 'join-screen__label';
  nameLabel.textContent = 'Takma adın';
  nameLabel.htmlFor = 'join-name';
  card.appendChild(nameLabel);

  const nameInput = document.createElement('input');
  nameInput.id = 'join-name';
  nameInput.className = 'join-screen__input';
  nameInput.type = 'text';
  nameInput.maxLength = NAME_MAX_LENGTH;
  nameInput.placeholder = 'örn. NeonTilki';
  nameInput.autocomplete = 'off';
  nameInput.value = localStorage.getItem(NAME_STORAGE_KEY) ?? '';
  card.appendChild(nameInput);

  // ---- canlı avatar önizlemesi (seçilen renk + şapkayı gerçek karakterle gösterir) ----
  const previewEl = document.createElement('div');
  previewEl.className = 'join-screen__preview';
  card.appendChild(previewEl);
  let previewRedraw: () => void = () => {};
  const previewCleanup = setupAvatarPreview(previewEl, () => selectedColor, () => selectedHat, (fn) => {
    previewRedraw = fn;
  });

  const colorLabel = document.createElement('div');
  colorLabel.className = 'join-screen__label';
  colorLabel.textContent = 'Rengini seç';
  card.appendChild(colorLabel);

  const swatchRow = document.createElement('div');
  swatchRow.className = 'join-screen__swatches';
  const storedColor = Number(localStorage.getItem(COLOR_STORAGE_KEY));
  let selectedColor = Number.isInteger(storedColor) && storedColor >= 0 && storedColor < AVATAR_PALETTE.length
    ? storedColor
    : Math.floor(Math.random() * AVATAR_PALETTE.length);

  const swatchButtons: HTMLButtonElement[] = [];
  AVATAR_PALETTE.forEach((color, idx) => {
    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.className = 'join-screen__swatch';
    swatch.style.setProperty('--swatch-color', hexColor(color));
    swatch.setAttribute('aria-label', `Renk ${idx + 1}`);
    swatch.addEventListener('click', () => {
      selectedColor = idx;
      swatchButtons.forEach((b, i) => b.classList.toggle('join-screen__swatch--selected', i === idx));
      previewRedraw();
    });
    swatchButtons.push(swatch);
    swatchRow.appendChild(swatch);
  });
  swatchButtons[selectedColor].classList.add('join-screen__swatch--selected');
  card.appendChild(swatchRow);

  const hatLabel = document.createElement('div');
  hatLabel.className = 'join-screen__label';
  hatLabel.textContent = 'Şapkanı seç';
  card.appendChild(hatLabel);

  const hatRow = document.createElement('div');
  hatRow.className = 'join-screen__hats';
  const storedHat = Number(localStorage.getItem(HAT_STORAGE_KEY));
  let selectedHat = Number.isInteger(storedHat) && storedHat >= 0 && storedHat < HATS.length ? storedHat : 0;

  const hatButtons: HTMLButtonElement[] = [];
  HATS.forEach((hat, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'join-screen__hat';
    btn.innerHTML = `<span class="join-screen__hat-icon">${HAT_ICONS[idx] ?? HAT_ICONS[0]}</span><span>${hat.label}</span>`;
    btn.addEventListener('click', () => {
      selectedHat = idx;
      hatButtons.forEach((b, i) => b.classList.toggle('join-screen__hat--selected', i === idx));
      previewRedraw();
    });
    hatButtons.push(btn);
    hatRow.appendChild(btn);
  });
  hatButtons[selectedHat].classList.add('join-screen__hat--selected');
  card.appendChild(hatRow);

  // ---- Oda seçimi: 4 salon, canlı doluluk bilgisiyle ----
  const barLabel = document.createElement('div');
  barLabel.className = 'join-screen__label';
  barLabel.textContent = 'Salon seç';
  card.appendChild(barLabel);

  const barGrid = document.createElement('div');
  barGrid.className = 'join-screen__bars';
  const storedBar = localStorage.getItem(BAR_STORAGE_KEY);
  let selectedBar = BARS.some((b) => b.id === storedBar) ? (storedBar as string) : BARS[0].id;
  const barCounts = new Map<string, number>();
  let capacity = BAR_CAPACITY;

  const barButtons = new Map<string, { btn: HTMLButtonElement; countEl: HTMLSpanElement }>();

  function refreshBarButtons(): void {
    for (const [id, { btn, countEl }] of barButtons) {
      const count = barCounts.get(id);
      const full = count !== undefined && count >= capacity;
      countEl.textContent = count === undefined ? '· / ·' : `${count} / ${capacity}`;
      countEl.classList.toggle('join-screen__bar-count--full', full);
      btn.disabled = full;
      if (full && selectedBar === id) {
        const firstOpen = BARS.find((b) => (barCounts.get(b.id) ?? 0) < capacity);
        if (firstOpen) selectedBar = firstOpen.id;
      }
      btn.classList.toggle('join-screen__bar--selected', selectedBar === id);
    }
  }

  BARS.forEach((barDef) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'join-screen__bar';
    const countEl = document.createElement('span');
    countEl.className = 'join-screen__bar-count';
    countEl.textContent = '· / ·';
    btn.style.setProperty('--bar-accent', barDef.accent);
    btn.innerHTML = `<span class="join-screen__bar-dot"></span><span class="join-screen__bar-name">${barDef.name}</span>`;
    btn.appendChild(countEl);
    btn.addEventListener('click', () => {
      selectedBar = barDef.id;
      refreshBarButtons();
    });
    barButtons.set(barDef.id, { btn, countEl });
    barGrid.appendChild(btn);
  });
  card.appendChild(barGrid);
  refreshBarButtons();

  async function pollLobbies(): Promise<void> {
    try {
      const res = await fetch(LOBBIES_URL);
      if (!res.ok) return;
      const data = (await res.json()) as LobbyInfo;
      capacity = data.capacity;
      for (const b of data.bars) barCounts.set(b.id, b.count);
      refreshBarButtons();
    } catch {
      // backend uyanıyor olabilir (cold start); sayaçlar '· / ·' kalır, giriş yine denenebilir
    }
  }
  void pollLobbies();
  const lobbyTimer = setInterval(pollLobbies, 3000);

  const errorEl = document.createElement('div');
  errorEl.className = 'join-screen__error';
  card.appendChild(errorEl);

  const joinBtn = document.createElement('button');
  joinBtn.type = 'submit';
  joinBtn.className = 'join-screen__button';
  joinBtn.textContent = 'BARA GİR';
  card.appendChild(joinBtn);

  card.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    if (name.length < NAME_MIN_LENGTH) {
      errorEl.textContent = `İsim en az ${NAME_MIN_LENGTH} karakter olmalı.`;
      nameInput.focus();
      return;
    }
    const selectedCount = barCounts.get(selectedBar);
    if (selectedCount !== undefined && selectedCount >= capacity) {
      errorEl.textContent = 'Seçtiğin salon dolu, başka bir salon dene.';
      return;
    }
    localStorage.setItem(NAME_STORAGE_KEY, name);
    localStorage.setItem(COLOR_STORAGE_KEY, String(selectedColor));
    localStorage.setItem(HAT_STORAGE_KEY, String(selectedHat));
    localStorage.setItem(BAR_STORAGE_KEY, selectedBar);
    clearInterval(lobbyTimer);
    previewCleanup();
    overlay.classList.add('join-screen--closing');
    overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
    // transitionend bir sebeple gelmezse yine de kaldır
    setTimeout(() => overlay.remove(), 700);
    onJoin(name, selectedColor, selectedHat, selectedBar);
  });

  overlay.appendChild(card);

  const hint = document.createElement('div');
  hint.className = 'join-screen__hint';
  // dokunmatikte klavye ipucu yerine parmak kontrolleri anlatılır
  hint.innerHTML = isTouchLayout()
    ? 'Sol tarafa basılı tutup sürükleyerek gez · <kbd>E</kbd> ile otur'
    : '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> ya da ok tuşları ile gez · <kbd>E</kbd> ile otur';
  overlay.appendChild(hint);

  root.appendChild(overlay);
  nameInput.focus();
}

// Küçük bağımsız Pixi sahnesi: seçilen renk+şapkayı gerçek karakterle canlı gösterir.
// register(fn) ile dışarıya bir "yeniden çiz" fonksiyonu verir; renk/şapka değişince çağrılır.
// Dönen fonksiyon çağrılınca sahne yok edilir (WebGL bağlamı serbest kalır).
function setupAvatarPreview(
  host: HTMLElement,
  getColor: () => number,
  getHat: () => number,
  register: (redraw: () => void) => void,
): () => void {
  const W = 128;
  const H = 150;
  let app: Application | null = null;
  let visual: PlayerVisual | null = null;
  let destroyed = false;
  let last = performance.now();
  let nextEmoteAt = performance.now() + 2600;

  const app2 = new Application();
  void app2
    .init({ width: W, height: H, backgroundAlpha: 0, antialias: true })
    .then(() => {
      if (destroyed) {
        app2.destroy(true);
        return;
      }
      app = app2;
      host.appendChild(app.canvas);
      rebuild();
      app.ticker.add(() => {
        if (!visual) return;
        const now = performance.now();
        const dt = now - last;
        last = now;
        // arada bir küçük emote oynatıp sahneyi canlı tut
        if (now >= nextEmoteAt) {
          const set = ['👋', '😂', '🎉', '👏'];
          playEmote(visual, set[Math.floor(Math.random() * set.length)]);
          nextEmoteAt = now + 3600 + Math.random() * 2600;
        }
        updatePlayerVisual(visual, W / 2, H - 26, false, dt);
      });
    });

  function rebuild(): void {
    if (!app) return;
    if (visual) app.stage.removeChild(visual.container);
    visual = createPlayerVisual('', getColor(), getHat(), W / 2, H - 26, true);
    visual.container.scale.set(1.35);
    visual.label.visible = false;
    visual.nameTagBg.visible = false;
    app.stage.addChild(visual.container);
  }

  register(() => rebuild());

  return () => {
    destroyed = true;
    if (app) {
      app.destroy(true);
      app = null;
    }
  };
}
