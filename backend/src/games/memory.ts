import { MEMORY_GRID_SIZE } from '../config.js';

export interface MemoryCard {
  value: number;
  matched: boolean;
}

export interface MemoryGame {
  cards: MemoryCard[];
  flipped: number[]; // şu an açık ama henüz eşleşme kararı verilmemiş kart indeksleri (max 2)
  turnOrder: [string, string];
  turnIndex: number;
  scores: Record<string, number>;
}

function shuffledDeck(): MemoryCard[] {
  const pairCount = MEMORY_GRID_SIZE / 2;
  const values: number[] = [];
  for (let v = 0; v < pairCount; v++) values.push(v, v);
  for (let i = values.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }
  return values.map((value) => ({ value, matched: false }));
}

export function initMemory(playerIds: [string, string]): MemoryGame {
  return {
    cards: shuffledDeck(),
    flipped: [],
    turnOrder: playerIds,
    turnIndex: 0,
    scores: { [playerIds[0]]: 0, [playerIds[1]]: 0 },
  };
}

export function currentTurnPlayer(game: MemoryGame): string {
  return game.turnOrder[game.turnIndex];
}

// Biten oyunu aynı oyuncularla sıfırdan başlatır (yeni deste, skorlar sıfır).
export function resetMemory(game: MemoryGame): void {
  game.cards = shuffledDeck();
  game.flipped = [];
  game.turnIndex = 0;
  game.scores = { [game.turnOrder[0]]: 0, [game.turnOrder[1]]: 0 };
}

export interface FlipOutcome {
  ok: boolean;
  resolved?: { indices: number[]; matched: boolean };
}

export function flipCard(game: MemoryGame, playerId: string, cardIndex: number): FlipOutcome {
  if (currentTurnPlayer(game) !== playerId) return { ok: false };
  if (game.flipped.length >= 2) return { ok: false };
  const card = game.cards[cardIndex];
  if (!card || card.matched || game.flipped.includes(cardIndex)) return { ok: false };

  game.flipped.push(cardIndex);
  if (game.flipped.length < 2) {
    return { ok: true };
  }

  const [i1, i2] = game.flipped;
  const matched = game.cards[i1].value === game.cards[i2].value;
  if (matched) {
    game.cards[i1].matched = true;
    game.cards[i2].matched = true;
    game.scores[playerId]++;
    game.flipped = [];
    // eşleşme olursa aynı oyuncu devam eder
  }
  // Eşleşmezse kartlar açık bırakılır (oyuncu ikinci kartı görebilsin);
  // handler kısa bir gecikmeyle hideMismatch çağırıp sırayı devreder.
  // Bu sırada flipped.length === 2 olduğu için yeni hamleler reddedilir.
  return { ok: true, resolved: { indices: [i1, i2], matched } };
}

// Eşleşmeyen açık kartları kapatır ve sırayı diğer oyuncuya geçirir.
export function hideMismatch(game: MemoryGame): void {
  game.flipped = [];
  game.turnIndex = (game.turnIndex + 1) % 2;
}

export function isMemoryComplete(game: MemoryGame): boolean {
  return game.cards.every((c) => c.matched);
}
