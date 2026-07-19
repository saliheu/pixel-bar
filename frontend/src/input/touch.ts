// Dokunmatik kontroller — ekranda joystick GÖRÜNMEZ:
//   • sürükle  -> yürü (görünmez analog joystick)
//   • dokun    -> etkileşim (otur / kalk / oyuna gir / müzik kutusu)
//   • yumruk   -> yalnızca yakında biri varken beliren küçük ikon düğmesi
// Böylece ekranda kalıcı, iri kontrol kutuları durmaz.

const JOY_RADIUS = 54; // parmağın tam ittiği kabul edildiği mesafe (px)
const DEAD_ZONE = 0.18;
const TAP_MS = 300; // bu süreden kısa ve
const TAP_SLOP = 12; // bu mesafeden az kayan dokunuş "tık" sayılır

let punchBtn: HTMLButtonElement | null = null;
let onInteractFn: () => void = () => {};

let joyId: number | null = null;
let originX = 0;
let originY = 0;
let startedAt = 0;
let moved = 0;
let vecX = 0;
let vecY = 0;
let mode: 'world' | 'pong' | 'hidden' = 'world';

export function isTouchLayout(): boolean {
  return window.matchMedia('(pointer: coarse)').matches || window.matchMedia('(max-width: 820px)').matches;
}

export function getTouchAxis(): { x: number; y: number } {
  return { x: vecX, y: vecY };
}

function isUiTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      'button, input, textarea, a, select, .room-view, .jukebox-panel, .leaderboard, .quests, .hud-bar, .emote-bar, .world-chat-bar, .join-screen',
    ),
  );
}

function resetJoy(): void {
  vecX = 0;
  vecY = 0;
  joyId = null;
}

function updateAxis(clientX: number, clientY: number): void {
  let dx = clientX - originX;
  let dy = clientY - originY;
  moved = Math.max(moved, Math.hypot(dx, dy));

  const len = Math.hypot(dx, dy);
  if (len > JOY_RADIUS) {
    dx = (dx / len) * JOY_RADIUS;
    dy = (dy / len) * JOY_RADIUS;
  }
  const nx = dx / JOY_RADIUS;
  const ny = dy / JOY_RADIUS;
  if (Math.hypot(nx, ny) < DEAD_ZONE) {
    vecX = 0;
    vecY = 0;
    return;
  }
  vecX = nx;
  vecY = ny;
}

export interface TouchHandlers {
  onInteract: () => void;
  onPunch: () => void;
}

export function initTouchControls(root: HTMLElement, handlers: TouchHandlers): void {
  if (!isTouchLayout()) return;
  onInteractFn = handlers.onInteract;

  // Yumruk: küçük, yarı saydam ve yalnızca menzilde biri varken görünür.
  punchBtn = document.createElement('button');
  punchBtn.type = 'button';
  punchBtn.className = 'touch-punch hidden';
  punchBtn.setAttribute('aria-label', 'Yumruk at');
  punchBtn.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M7 11.5V8a1.6 1.6 0 0 1 3.2 0v2.5"/><path d="M10.2 10.5V7.2a1.6 1.6 0 0 1 3.2 0v3.3"/>' +
    '<path d="M13.4 10.8V8.6a1.6 1.6 0 0 1 3.2 0v4.9a5.5 5.5 0 0 1-5.5 5.5h-.7a5 5 0 0 1-4-2l-2-2.6a1.5 1.5 0 0 1 2.3-1.9L7 13"/>' +
    '</svg>';
  punchBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    punchBtn?.classList.add('touch-punch--down');
    handlers.onPunch();
  });
  const up = (): void => punchBtn?.classList.remove('touch-punch--down');
  punchBtn.addEventListener('pointerup', up);
  punchBtn.addEventListener('pointercancel', up);
  punchBtn.addEventListener('pointerleave', up);
  root.appendChild(punchBtn);

  window.addEventListener(
    'touchstart',
    (e) => {
      if (joyId !== null || mode === 'hidden') return;
      for (const t of Array.from(e.changedTouches)) {
        if (isUiTarget(t.target)) continue;
        joyId = t.identifier;
        originX = t.clientX;
        originY = t.clientY;
        startedAt = performance.now();
        moved = 0;
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
        updateAxis(t.clientX, t.clientY);
        e.preventDefault();
        break;
      }
    },
    { passive: false },
  );

  const endTouch = (e: TouchEvent): void => {
    if (joyId === null) return;
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier !== joyId) continue;
      // kısa ve neredeyse hiç kaymayan dokunuş: etkileşim (E) sayılır
      const isTap = performance.now() - startedAt < TAP_MS && moved < TAP_SLOP;
      resetJoy();
      if (isTap && mode === 'world') onInteractFn();
      break;
    }
  };
  window.addEventListener('touchend', endTouch);
  window.addEventListener('touchcancel', endTouch);
  window.addEventListener('blur', resetJoy);
}

// Yumruk düğmesi yalnızca menzilde bir oyuncu varken gösterilir.
export function setPunchAvailable(available: boolean): void {
  if (!punchBtn) return;
  punchBtn.classList.toggle('hidden', !available || mode !== 'world');
}

export function setTouchControlsMode(next: 'world' | 'pong' | 'hidden'): void {
  mode = next;
  if (next !== 'world') {
    resetJoy();
    punchBtn?.classList.add('hidden');
  }
}
