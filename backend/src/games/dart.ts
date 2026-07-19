import { DART_START } from '../config.js';

// Dart 301: iki oyuncu sırayla 3 dart atar, atılan puanlar toplamdan düşülür.
// Tam 0'a inen kazanır; 0'ın altına düşüren atış "bust" olur ve o tur başındaki
// değere geri dönülür, sıra rakibe geçer.

// Tahta koordinatları: merkez (0,0), yarıçap 100. Standart 20'li dizilim,
// tepedeki dilim 20; saat yönünde sağdaki 1, 18, 4, ...
const NUMBERS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

// Bir isabet noktasının puanı (multiplier dahil). Tahta dışı = 0.
export function dartScore(x: number, y: number): number {
  const r = Math.hypot(x, y);
  if (r > 100) return 0;
  if (r <= 5) return 50; // iç bull
  if (r <= 12) return 25; // dış bull
  // açı -> dilim: tepe (-90°) = 20, saat yönünde 18°'lik dilimler
  const deg = (Math.atan2(y, x) * 180) / Math.PI;
  const idx = ((Math.round((deg + 90) / 18) % 20) + 20) % 20;
  const base = NUMBERS[idx];
  let mult = 1;
  if (r >= 56 && r <= 64) mult = 3; // triple ring
  else if (r >= 92 && r <= 100) mult = 2; // double ring
  return base * mult;
}

export interface DartGame {
  turnOrder: [string, string];
  throwerIdx: 0 | 1;
  remaining: Record<string, number>;
  turnStart: number; // tur başındaki kalan (bust'ta geri dönülür)
  turnDarts: { x: number; y: number; score: number }[];
  lastDart: { x: number; y: number; score: number } | null;
  bust: boolean;
  ended: boolean;
  resultTimer: NodeJS.Timeout | null;
}

export function initDart(playerIds: [string, string]): DartGame {
  return {
    turnOrder: playerIds,
    throwerIdx: 0,
    remaining: { [playerIds[0]]: DART_START, [playerIds[1]]: DART_START },
    turnStart: DART_START,
    turnDarts: [],
    lastDart: null,
    bust: false,
    ended: false,
    resultTimer: null,
  };
}

export function resetDart(game: DartGame): void {
  clearDartTimer(game);
  game.throwerIdx = 0;
  game.remaining = { [game.turnOrder[0]]: DART_START, [game.turnOrder[1]]: DART_START };
  game.turnStart = DART_START;
  game.turnDarts = [];
  game.lastDart = null;
  game.bust = false;
  game.ended = false;
}

export function clearDartTimer(game: DartGame): void {
  if (game.resultTimer) {
    clearTimeout(game.resultTimer);
    game.resultTimer = null;
  }
}

export function currentThrower(game: DartGame): string {
  return game.turnOrder[game.throwerIdx];
}

export function dartWinner(game: DartGame): string | null {
  if (!game.ended) return null;
  const [a, b] = game.turnOrder;
  return game.remaining[a] === 0 ? a : game.remaining[b] === 0 ? b : null;
}

export interface ThrowResult {
  turnOver: boolean; // sıra rakibe geçti mi (tur doldu ya da bust)
  won: boolean;
}

// Bir dart atışını işler. Dönüş turun bitip bitmediğini bildirir.
export function applyDartThrow(game: DartGame, x: number, y: number): ThrowResult {
  const thrower = currentThrower(game);
  const score = dartScore(x, y);
  game.lastDart = { x, y, score };
  game.bust = false;

  const rem = game.remaining[thrower];
  const next = rem - score;

  if (next < 0 || next === 1) {
    // bust: 0'ın altına indi ya da 1'de kaldı (tek atışla bitirilemez) -> tur yanar
    game.bust = true;
    game.remaining[thrower] = game.turnStart;
    game.turnDarts = [];
    advanceTurn(game);
    return { turnOver: true, won: false };
  }

  game.remaining[thrower] = next;
  game.turnDarts.push({ x, y, score });

  if (next === 0) {
    game.ended = true;
    return { turnOver: false, won: true };
  }

  if (game.turnDarts.length >= 3) {
    game.turnDarts = [];
    advanceTurn(game);
    return { turnOver: true, won: false };
  }

  return { turnOver: false, won: false };
}

function advanceTurn(game: DartGame): void {
  game.throwerIdx = game.throwerIdx === 0 ? 1 : 0;
  game.turnStart = game.remaining[currentThrower(game)];
}
