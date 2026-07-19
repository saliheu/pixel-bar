import { AVATAR_PALETTE, HATS, BARS, BAR_CAPACITY, LOBBIES_URL, NAME_MAX_LENGTH, NAME_MIN_LENGTH } from '../config.js';
import { HAT_ICONS } from './icons.js';
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

  // ---- canlı avatar önizlemesi ----
  // Kutu burada oluşturulur (renk seçiminin üstünde dursun diye) ama çizim,
  // selectedColor/selectedHat tanımlandıktan SONRA başlatılır (TDZ hatası olmasın).
  const previewEl = document.createElement('div');
  previewEl.className = 'join-screen__preview';
  card.appendChild(previewEl);
  let previewRedraw: () => void = () => {};

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

  // renk ve şapka artık tanımlı: önizlemeyi çiz ve yeniden çizici fonksiyonu bağla
  const previewCleanup = setupAvatarPreview(previewEl, () => selectedColor, () => selectedHat, (fn) => {
    previewRedraw = fn;
  });

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
// Avatar önizlemesi SVG ile çizilir. Bilerek Pixi KULLANILMAZ: ikinci bir
// Application ikinci bir WebGL bağlamı açar ve tarayıcı bağlam sınırına
// dayandığında ana sahnenin bağlamını düşürebilir (dünya kalıcı olarak boş kalır).
// Şekiller pixi/player.ts'teki ayakta duruş ile aynı koordinatlardadır.
function avatarSvg(colorIdx: number, hat: number): string {
  const c = `#${(AVATAR_PALETTE[colorIdx] ?? AVATAR_PALETTE[0]).toString(16).padStart(6, '0')}`;
  const outline = '#1c1730';

  let hatSvg = '';
  if (hat === 1) {
    // kasket: yarım daire + siperlik + tepe düğmesi
    hatSvg =
      `<path d="M -9.5 -38 A 9.5 9.5 0 0 1 9.5 -38 Z" fill="#ef4444" stroke="#991b1b" stroke-width="1.4"/>` +
      `<rect x="0" y="-41.5" width="14" height="3" rx="1.5" fill="#dc2626"/>` +
      `<circle cx="0" cy="-45" r="1.7" fill="#fecaca"/>`;
  } else if (hat === 2) {
    hatSvg =
      `<polygon points="-7,-39 -7,-46 -3.5,-42.5 0,-48 3.5,-42.5 7,-46 7,-39" fill="#fbbf24" stroke="#b45309" stroke-width="1"/>` +
      `<circle cx="-4.2" cy="-41" r="1" fill="#ef4444"/><circle cx="0" cy="-41" r="1" fill="#38bdf8"/><circle cx="4.2" cy="-41" r="1" fill="#4ade80"/>`;
  } else if (hat === 3) {
    hatSvg =
      `<polygon points="-8.5,-41 -7,-49 -2.5,-42.5" fill="${c}" stroke="${outline}" stroke-width="1.3"/>` +
      `<polygon points="8.5,-41 7,-49 2.5,-42.5" fill="${c}" stroke="${outline}" stroke-width="1.3"/>` +
      `<polygon points="-7.2,-42 -6.6,-46.5 -4.2,-42.6" fill="#f9a8d4"/>` +
      `<polygon points="7.2,-42 6.6,-46.5 4.2,-42.6" fill="#f9a8d4"/>`;
  } else if (hat === 4) {
    hatSvg =
      `<polygon points="-5.5,-42 5.5,-42 0,-53" fill="#8b5cf6" stroke="#5b21b6" stroke-width="1.2"/>` +
      `<line x1="-3.6" y1="-45.8" x2="3.6" y2="-45.8" stroke="#f472b6" stroke-width="1.6"/>` +
      `<line x1="-1.9" y1="-49.4" x2="1.9" y2="-49.4" stroke="#38bdf8" stroke-width="1.6"/>` +
      `<circle cx="0" cy="-54" r="2" fill="#fbbf24"/>`;
  }

  return `<svg viewBox="-22 -58 44 74" class="join-avatar" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="0" cy="8" rx="14" ry="5" fill="#05030c" opacity="0.45"/>
    <line x1="-4" y1="-6" x2="-6" y2="9" stroke="${c}" stroke-width="3.6" stroke-linecap="round"/>
    <line x1="4" y1="-6" x2="6" y2="9" stroke="${c}" stroke-width="3.6" stroke-linecap="round"/>
    <line x1="-6" y1="-20" x2="-9" y2="-8" stroke="${c}" stroke-width="3.2" stroke-linecap="round"/>
    <line x1="6" y1="-20" x2="9" y2="-8" stroke="${c}" stroke-width="3.2" stroke-linecap="round"/>
    <rect x="-9" y="-26" width="18" height="20" rx="9" fill="${c}" stroke="${outline}" stroke-width="2"/>
    <circle cx="0" cy="-33" r="11" fill="${c}" stroke="${outline}" stroke-width="2"/>
    <circle cx="-3.8" cy="-33.4" r="1.4" fill="${outline}"/>
    <circle cx="3.8" cy="-33.4" r="1.4" fill="${outline}"/>
    <path d="M -2.6 -29.5 A 2.6 2.6 0 0 0 2.6 -29.5" fill="none" stroke="${outline}" stroke-width="1.2" stroke-linecap="round"/>
    ${hatSvg}
  </svg>`;
}

// register(fn) ile dışarıya bir "yeniden çiz" fonksiyonu verir; renk/şapka değişince çağrılır.
function setupAvatarPreview(
  host: HTMLElement,
  getColor: () => number,
  getHat: () => number,
  register: (redraw: () => void) => void,
): () => void {
  const draw = (): void => {
    host.innerHTML = avatarSvg(getColor(), getHat());
  };
  draw();
  register(draw);
  return () => {}; // temizlenecek kaynak yok
}
