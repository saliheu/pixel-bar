// Dokunmatik kontroller: sol yarıda "yüzen" sanal joystick, sağ altta aksiyon
// düğmeleri. Joystick parmağın bastığı yerde belirir; oyuncunun ekranın belli
// bir noktasına nişan alması gerekmez.

const JOY_RADIUS = 54; // knob'un merkezden azami uzaklığı (px)
const DEAD_ZONE = 0.18; // bu eşiğin altındaki itiş yok sayılır

let layerEl: HTMLDivElement | null = null;
let baseEl: HTMLDivElement;
let knobEl: HTMLDivElement;

let joyId: number | null = null;
let originX = 0;
let originY = 0;
let vecX = 0;
let vecY = 0;
// 'world': serbest gezinme, 'pong': sadece raket yönü, 'hidden': girdi kapalı
let mode: 'world' | 'pong' | 'hidden' = 'world';

// Dokunmatik birincil giriş mi? (dar ekran ya da kaba işaretçi)
export function isTouchLayout(): boolean {
  return window.matchMedia('(pointer: coarse)').matches || window.matchMedia('(max-width: 820px)').matches;
}

export function getTouchAxis(): { x: number; y: number } {
  return { x: vecX, y: vecY };
}

// Joystick'in dokunma katmanı dışındaki UI'ya (düğme, panel, giriş) basıldığında
// hareket başlatmaması için hedef kontrolü.
function isUiTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      'button, input, textarea, a, select, .room-view, .jukebox-panel, .leaderboard, .quests, .hud-bar, .emote-bar, .world-chat-bar, .touch-actions, .join-screen',
    ),
  );
}

function showJoystick(x: number, y: number): void {
  baseEl.style.left = `${x}px`;
  baseEl.style.top = `${y}px`;
  knobEl.style.left = `${x}px`;
  knobEl.style.top = `${y}px`;
  baseEl.classList.add('touch-joy--on');
  knobEl.classList.add('touch-joy--on');
}

function hideJoystick(): void {
  baseEl.classList.remove('touch-joy--on');
  knobEl.classList.remove('touch-joy--on');
  vecX = 0;
  vecY = 0;
  joyId = null;
}

function moveKnob(clientX: number, clientY: number): void {
  let dx = clientX - originX;
  let dy = clientY - originY;
  const len = Math.hypot(dx, dy);
  if (len > JOY_RADIUS) {
    dx = (dx / len) * JOY_RADIUS;
    dy = (dy / len) * JOY_RADIUS;
  }
  knobEl.style.left = `${originX + dx}px`;
  knobEl.style.top = `${originY + dy}px`;

  const nx = dx / JOY_RADIUS;
  const ny = dy / JOY_RADIUS;
  const mag = Math.hypot(nx, ny);
  if (mag < DEAD_ZONE) {
    vecX = 0;
    vecY = 0;
    return;
  }
  vecX = nx;
  vecY = ny;
}

export interface TouchHandlers {
  onInteract: () => void; // E: otur / kalk / oyuna gir
  onPunch: () => void; // F: yumruk
}

export function initTouchControls(root: HTMLElement, handlers: TouchHandlers): void {
  if (!isTouchLayout()) return; // masaüstünde hiç kurulmaz

  layerEl = document.createElement('div');
  layerEl.className = 'touch-layer';

  baseEl = document.createElement('div');
  baseEl.className = 'touch-joy touch-joy__base';
  knobEl = document.createElement('div');
  knobEl.className = 'touch-joy touch-joy__knob';
  layerEl.append(baseEl, knobEl);

  const actions = document.createElement('div');
  actions.className = 'touch-actions';

  const mkBtn = (label: string, cls: string, fn: () => void): HTMLButtonElement => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `touch-btn ${cls}`;
    b.textContent = label;
    // pointerdown hem dokunmayı hem fareyi kapsar ve tıklama gecikmesi yaşatmaz
    // (dokunmatik ekranlı dizüstülerde fareyle de çalışsın diye).
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      b.classList.add('touch-btn--down');
      fn();
    });
    const up = (): void => b.classList.remove('touch-btn--down');
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    b.addEventListener('pointerleave', up);
    return b;
  };

  actions.appendChild(mkBtn('E', 'touch-btn--interact', handlers.onInteract));
  actions.appendChild(mkBtn('F', 'touch-btn--punch', handlers.onPunch));

  root.append(layerEl, actions);

  // ---- joystick dokunma takibi ----
  window.addEventListener(
    'touchstart',
    (e) => {
      if (joyId !== null || mode === 'hidden') return;
      for (const t of Array.from(e.changedTouches)) {
        if (isUiTarget(t.target)) continue;
        // Dünyada sol taraf joystick'e, sağ taraf aksiyon düğmelerine ayrılmıştır.
        // Pong'da aksiyon düğmesi olmadığı için ekranın tamamı raket kontrolüdür.
        if (mode === 'world' && t.clientX > window.innerWidth * 0.62) continue;
        joyId = t.identifier;
        originX = t.clientX;
        originY = t.clientY;
        showJoystick(originX, originY);
        moveKnob(t.clientX, t.clientY);
        e.preventDefault();
        break;
      }
    },
    { passive: false },
  );

  window.addEventListener(
    'touchmove',
    (e) => {
      if (joyId === null) return;
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier !== joyId) continue;
        moveKnob(t.clientX, t.clientY);
        e.preventDefault();
        break;
      }
    },
    { passive: false },
  );

  const endTouch = (e: TouchEvent): void => {
    if (joyId === null) return;
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier === joyId) {
        hideJoystick();
        break;
      }
    }
  };
  window.addEventListener('touchend', endTouch);
  window.addEventListener('touchcancel', endTouch);
  window.addEventListener('blur', () => hideJoystick());
}

// Odaya girince hareket kontrolleri gizlenir; pong'da joystick açık kalır
// (raket yön girişi için) ama aksiyon düğmeleri gizlenir.
export function setTouchControlsMode(next: 'world' | 'pong' | 'hidden'): void {
  mode = next;
  if (!layerEl) return;
  layerEl.classList.toggle('hidden', next === 'hidden');
  document.querySelector('.touch-actions')?.classList.toggle('hidden', next !== 'world');
  if (next === 'hidden') hideJoystick();
}
