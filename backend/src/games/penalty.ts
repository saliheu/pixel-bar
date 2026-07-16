import { PENALTY_KICKS_EACH } from '../config.js';
import type { PenaltyDir } from '../protocol.js';

// Penaltı: her vuruşta şutör köşe seçer, kaleci uzanacağı köşeyi seçer.
// Aynı köşe = kurtarış, farklı köşe = gol. Roller her vuruşta değişir;
// normal seri 5'er vuruş, eşitlikte altın vuruş (ikişerli turlar) oynanır.
export interface PenaltyGame {
  kick: number; // 1'den başlayan vuruş sayacı
  shooterIdx: 0 | 1; // turnOrder içindeki şutör
  turnOrder: [string, string];
  picks: Partial<Record<string, PenaltyDir>>;
  scores: Record<string, number>;
  last: { shooter: string; shot: PenaltyDir; dive: PenaltyDir; goal: boolean } | null;
  suddenDeath: boolean;
  ended: boolean;
  nextKickTimer: NodeJS.Timeout | null;
}

export function initPenalty(playerIds: [string, string]): PenaltyGame {
  return {
    kick: 1,
    shooterIdx: 0,
    turnOrder: playerIds,
    picks: {},
    scores: { [playerIds[0]]: 0, [playerIds[1]]: 0 },
    last: null,
    suddenDeath: false,
    ended: false,
    nextKickTimer: null,
  };
}

export function resetPenalty(game: PenaltyGame): void {
  clearPenaltyTimer(game);
  game.kick = 1;
  game.shooterIdx = 0;
  game.picks = {};
  game.scores = { [game.turnOrder[0]]: 0, [game.turnOrder[1]]: 0 };
  game.last = null;
  game.suddenDeath = false;
  game.ended = false;
}

export function clearPenaltyTimer(game: PenaltyGame): void {
  if (game.nextKickTimer) {
    clearTimeout(game.nextKickTimer);
    game.nextKickTimer = null;
  }
}

export function currentShooter(game: PenaltyGame): string {
  return game.turnOrder[game.shooterIdx];
}

// İki seçim de geldiyse vuruşu sonuçlandırır; oyun durumunu ilerletir.
// true dönerse vuruş çözüldü (yayın gerekir), false ise hâlâ seçim bekleniyor.
export function resolveKick(game: PenaltyGame): boolean {
  const shooter = currentShooter(game);
  const keeper = game.turnOrder[game.shooterIdx === 0 ? 1 : 0];
  const shot = game.picks[shooter];
  const dive = game.picks[keeper];
  if (!shot || !dive) return false;

  const goal = shot !== dive;
  if (goal) game.scores[shooter]++;
  game.last = { shooter, shot, dive, goal };
  game.picks = {};

  const completed = game.kick; // bu vuruş tamamlandı
  game.kick++;
  game.shooterIdx = game.shooterIdx === 0 ? 1 : 0;

  // Seri bitti mi? Normal seri: herkes PENALTY_KICKS_EACH vuruş yaptı.
  // Eşitlikte altın vuruş: her iki oyuncu birer vuruş daha yapar, fark oluşunca biter.
  const pairDone = completed % 2 === 0;
  const normalDone = completed >= PENALTY_KICKS_EACH * 2;
  if (pairDone && normalDone) {
    const [a, b] = game.turnOrder;
    if (game.scores[a] !== game.scores[b]) {
      game.ended = true;
    } else {
      game.suddenDeath = true;
    }
  }
  return true;
}

export function penaltyWinner(game: PenaltyGame): string | null {
  if (!game.ended) return null;
  const [a, b] = game.turnOrder;
  return game.scores[a] > game.scores[b] ? a : b;
}
