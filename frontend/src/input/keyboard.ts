import type { Facing } from '../protocol.js';
import { getTouchAxis } from './touch.js';

const held = new Set<string>();

// WASD tuşları ok tuşlarına eşlenir; held kümesi hep ok tuşu adlarıyla tutulur.
const KEY_ALIASES: Record<string, string> = {
  w: 'ArrowUp', s: 'ArrowDown', a: 'ArrowLeft', d: 'ArrowRight',
};

function normalizeKey(key: string): string | null {
  if (key.startsWith('Arrow')) return key;
  return KEY_ALIASES[key.toLowerCase()] ?? null;
}

function isTypingInInput(): boolean {
  const tag = document.activeElement?.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA';
}

window.addEventListener('keydown', (e) => {
  if (isTypingInInput()) return; // bir metin kutusunda yazarken tuşlar metin girişi içindir
  const key = normalizeKey(e.key);
  if (key) {
    held.add(key);
    e.preventDefault();
  }
});
window.addEventListener('keyup', (e) => {
  const key = normalizeKey(e.key);
  if (key) {
    held.delete(key);
    e.preventDefault();
  }
});
window.addEventListener('blur', () => held.clear());

export interface MoveVector {
  dx: number;
  dy: number;
  moving: boolean;
  facing: Facing | null;
}

function facingOf(dx: number, dy: number): Facing | null {
  // baskın eksen bakış yönünü belirler
  if (Math.abs(dy) >= Math.abs(dx)) {
    if (dy < 0) return 'up';
    if (dy > 0) return 'down';
    return null;
  }
  return dx < 0 ? 'left' : 'right';
}

// Serbest dünya hareketi (oda dışındayken). Klavye ve dokunmatik joystick birleşir;
// joystick analog olduğu için itiş miktarı hıza yansır.
export function getMoveVector(): MoveVector {
  const touch = getTouchAxis();
  if (touch.x !== 0 || touch.y !== 0) {
    // joystick etkin: uzunluk 1'i aşmasın (köşegende hızlanma olmasın)
    let dx = touch.x;
    let dy = touch.y;
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }
    return { dx, dy, moving: true, facing: facingOf(dx, dy) };
  }

  let dx = 0;
  let dy = 0;
  if (held.has('ArrowUp')) dy -= 1;
  if (held.has('ArrowDown')) dy += 1;
  if (held.has('ArrowLeft')) dx -= 1;
  if (held.has('ArrowRight')) dx += 1;

  const moving = dx !== 0 || dy !== 0;
  const facing = facingOf(dx, dy);

  if (moving && dx !== 0 && dy !== 0) {
    const norm = Math.SQRT1_2;
    dx *= norm;
    dy *= norm;
  }

  return { dx, dy, moving, facing };
}

// Pong raket girişi (sadece Pong odasındayken). Dokunmatikte joystick'in dikey ekseni.
export function getPongDir(): -1 | 0 | 1 {
  const touch = getTouchAxis();
  if (touch.y < -0.25) return -1;
  if (touch.y > 0.25) return 1;
  if (held.has('ArrowUp')) return -1;
  if (held.has('ArrowDown')) return 1;
  return 0;
}
