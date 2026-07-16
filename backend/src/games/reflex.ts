import { REFLEX_WIN_SCORE } from '../config.js';

// Refleks Düellosu: rastgele bir gecikmeden sonra "BAS!" sinyali gelir;
// önce basan turu alır, sinyalden önce basan (erken start) turu rakibine verir.
export interface ReflexGame {
  scores: Record<string, number>;
  round: number;
  phase: 'get_ready' | 'armed' | 'result';
  lastWinner: string | null;
  falseStart: string | null;
  armTimer: NodeJS.Timeout | null;
  nextRoundTimer: NodeJS.Timeout | null;
  ended: boolean;
}

export function initReflex(playerIds: [string, string]): ReflexGame {
  return {
    scores: { [playerIds[0]]: 0, [playerIds[1]]: 0 },
    round: 1,
    phase: 'get_ready',
    lastWinner: null,
    falseStart: null,
    armTimer: null,
    nextRoundTimer: null,
    ended: false,
  };
}

export function resetReflex(game: ReflexGame, playerIds: string[]): void {
  clearReflexTimers(game);
  for (const pid of playerIds) game.scores[pid] = 0;
  game.round = 1;
  game.phase = 'get_ready';
  game.lastWinner = null;
  game.falseStart = null;
  game.ended = false;
}

export function clearReflexTimers(game: ReflexGame): void {
  if (game.armTimer) {
    clearTimeout(game.armTimer);
    game.armTimer = null;
  }
  if (game.nextRoundTimer) {
    clearTimeout(game.nextRoundTimer);
    game.nextRoundTimer = null;
  }
}

// Turu sonuçlandırır: winner puan alır; maç bitti mi kontrol edilir.
export function scoreReflexRound(game: ReflexGame, winner: string, falseStart: string | null): void {
  game.scores[winner] = (game.scores[winner] ?? 0) + 1;
  game.phase = 'result';
  game.lastWinner = winner;
  game.falseStart = falseStart;
  if (game.scores[winner] >= REFLEX_WIN_SCORE) {
    game.ended = true;
  }
}
