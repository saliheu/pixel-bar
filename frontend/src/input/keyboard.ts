import type { Facing } from '../protocol.js';

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

// Serbest dünya hareketi için (oda dışındayken kullanılır)
export function getMoveVector(): MoveVector {
  let dx = 0;
  let dy = 0;
  if (held.has('ArrowUp')) dy -= 1;
  if (held.has('ArrowDown')) dy += 1;
  if (held.has('ArrowLeft')) dx -= 1;
  if (held.has('ArrowRight')) dx += 1;

  const moving = dx !== 0 || dy !== 0;
  let facing: Facing | null = null;
  if (dy < 0) facing = 'up';
  else if (dy > 0) facing = 'down';
  else if (dx < 0) facing = 'left';
  else if (dx > 0) facing = 'right';

  if (moving && dx !== 0 && dy !== 0) {
    const norm = Math.SQRT1_2;
    dx *= norm;
    dy *= norm;
  }

  return { dx, dy, moving, facing };
}

// Pong raket girişi için (sadece Pong odasındayken kullanılır)
export function getPongDir(): -1 | 0 | 1 {
  if (held.has('ArrowUp')) return -1;
  if (held.has('ArrowDown')) return 1;
  return 0;
}
