import { players } from '../state/players.js';
import { rooms } from '../state/rooms.js';
import { sendToPlayers } from '../util/broadcast.js';
import { resolveRps, resetRps, rpsMatchWinner, type RpsGame } from '../games/rps.js';
import { flipCard, hideMismatch, isMemoryComplete, resetMemory, type MemoryGame } from '../games/memory.js';
import { resetPong, type PongGame } from '../games/pong.js';
import { clearReflexTimers, resetReflex, scoreReflexRound, type ReflexGame } from '../games/reflex.js';
import { resetPenalty, currentShooter, resolveKick, penaltyWinner, type PenaltyGame } from '../games/penalty.js';
import { startPongLoop } from './pongLoop.js';
import { recordWin } from './social.js';
import type { RoomState } from '../state/rooms.js';
import { REFLEX_ARM_MIN_MS, REFLEX_ARM_MAX_MS, REFLEX_NEXT_ROUND_MS, PENALTY_RESULT_MS } from '../config.js';
import type { Choice } from '../protocol.js';

const MEMORY_MISMATCH_REVEAL_MS = 1100;

export function handleRpsChoice(playerId: string, choice: Choice): void {
  const player = players.get(playerId);
  const room = player?.roomId ? rooms.get(player.roomId) : undefined;
  if (!room || room.kind !== 'rps' || !room.game) return; // game null = rakip bekleniyor
  const game = room.game as RpsGame;

  if (game.ended) return; // maç bitti, "yeniden başla" bekleniyor
  game.choices[playerId] = choice;

  const result = resolveRps(game, [room.playerIds[0], room.playerIds[1]] as [string, string]);
  if (!result) {
    const waitingOn = room.playerIds.filter((pid) => !game.choices[pid]);
    sendToPlayers(room.playerIds, { type: 'rps_waiting', payload: { waitingOn } });
    return;
  }

  const matchWinner = rpsMatchWinner(game);
  if (matchWinner) game.ended = true;

  sendToPlayers(room.playerIds, {
    type: 'rps_result',
    payload: { round: game.round - 1, choices: result.choices, winner: result.winner, scores: { ...game.scores }, matchWinner },
  });

  // Lider tablosu ve şerit duyurusu yalnızca maç bitince (tur tur değil).
  if (matchWinner) {
    const loser = room.playerIds.find((pid) => pid !== matchWinner) ?? null;
    recordWin(matchWinner, loser, 'rps');
  }
}

export function handlePongInput(playerId: string, dir: -1 | 0 | 1): void {
  const player = players.get(playerId);
  const room = player?.roomId ? rooms.get(player.roomId) : undefined;
  if (!room || room.kind !== 'pong' || !room.game) return;
  const game = room.game as PongGame;
  game.inputDir[playerId] = dir;
}

// ---- Refleks Düellosu ----

function sendReflexState(roomPlayerIds: readonly string[], game: ReflexGame): void {
  sendToPlayers(roomPlayerIds, {
    type: 'reflex_state',
    payload: {
      phase: game.phase,
      round: game.round,
      scores: { ...game.scores },
      lastWinner: game.lastWinner,
      falseStart: game.falseStart,
      matchWinner: game.ended ? game.lastWinner : null,
    },
  });
}

// Yeni tur başlatır: "hazır ol" yayınlanır, rastgele gecikme sonra "BAS!" gelir.
export function startReflexRound(room: RoomState): void {
  const game = room.game as ReflexGame;
  clearReflexTimers(game);
  game.phase = 'get_ready';
  game.falseStart = null;
  sendReflexState(room.playerIds, game);

  const delay = REFLEX_ARM_MIN_MS + Math.random() * (REFLEX_ARM_MAX_MS - REFLEX_ARM_MIN_MS);
  game.armTimer = setTimeout(() => {
    game.armTimer = null;
    if (rooms.get(room.roomId) !== room || room.game !== game) return; // oda kapandı / oyun sıfırlandı
    game.phase = 'armed';
    sendReflexState(room.playerIds, game);
  }, delay);
}

export function handleReflexPress(playerId: string): void {
  const player = players.get(playerId);
  const room = player?.roomId ? rooms.get(player.roomId) : undefined;
  if (!room || room.kind !== 'reflex' || !room.game || room.playerIds.length < 2) return;
  const game = room.game as ReflexGame;

  if (game.phase === 'result') return; // tur arası; basışlar yok sayılır

  if (game.phase === 'armed') {
    scoreReflexRound(game, playerId, null);
  } else {
    // erken start: turu rakip kazanır
    const opponent = room.playerIds.find((pid) => pid !== playerId);
    if (!opponent) return;
    scoreReflexRound(game, opponent, playerId);
  }
  clearReflexTimers(game);
  sendReflexState(room.playerIds, game);

  if (game.ended && game.lastWinner) {
    const loser = room.playerIds.find((pid) => pid !== game.lastWinner) ?? null;
    recordWin(game.lastWinner, loser, 'reflex');
  }

  if (!game.ended) {
    game.round++;
    game.nextRoundTimer = setTimeout(() => {
      game.nextRoundTimer = null;
      if (rooms.get(room.roomId) !== room || room.game !== game) return;
      startReflexRound(room);
    }, REFLEX_NEXT_ROUND_MS);
  }
}

// ---- Penaltı ----

// phase 'pick': seçim bekleniyor; 'result': vuruş sonucu gösteriliyor.
export function sendPenaltyState(room: RoomState, phase: 'pick' | 'result' = 'pick'): void {
  const game = room.game as PenaltyGame;
  sendToPlayers(room.playerIds, {
    type: 'penalty_state',
    payload: {
      phase,
      kick: game.kick,
      totalKicks: game.turnOrder.length * 5,
      shooter: currentShooter(game),
      scores: { ...game.scores },
      waitingOn: phase === 'pick' ? game.turnOrder.filter((pid) => !game.picks[pid]) : [],
      last: game.last,
      suddenDeath: game.suddenDeath,
      matchWinner: penaltyWinner(game),
    },
  });
}

export function handlePenaltyPick(playerId: string, dir: unknown): void {
  const player = players.get(playerId);
  const room = player?.roomId ? rooms.get(player.roomId) : undefined;
  if (!room || room.kind !== 'penalty' || !room.game) return; // game null = rakip bekleniyor
  const game = room.game as PenaltyGame;
  if (game.ended || game.nextKickTimer) return; // sonuç gösterilirken seçim alınmaz
  if (dir !== 'left' && dir !== 'mid' && dir !== 'right') return;
  if (game.picks[playerId]) return; // seçim değiştirilemez

  game.picks[playerId] = dir;

  if (!resolveKick(game)) {
    sendPenaltyState(room, 'pick'); // waitingOn güncellensin
    return;
  }

  // Vuruş sonuçlandı: sonucu göster, kısa aradan sonra yeni vuruşa geç.
  sendPenaltyState(room, 'result');

  if (game.ended) {
    const winner = penaltyWinner(game);
    if (winner) {
      const loser = room.playerIds.find((pid) => pid !== winner) ?? null;
      recordWin(winner, loser, 'penalty');
    }
    return;
  }

  game.nextKickTimer = setTimeout(() => {
    game.nextKickTimer = null;
    if (rooms.get(room.roomId) !== room || room.game !== game) return;
    sendPenaltyState(room, 'pick');
  }, PENALTY_RESULT_MS);
}

// Biten bir oyunu (hafıza/pong/refleks/penaltı) aynı odada yeniden başlatır.
export function handleGameRestart(playerId: string): void {
  const player = players.get(playerId);
  const room = player?.roomId ? rooms.get(player.roomId) : undefined;
  if (!room || !room.game || room.playerIds.length < 2) return;

  if (room.kind === 'rps') {
    const game = room.game as RpsGame;
    if (!game.ended) return;
    resetRps(game);
    sendToPlayers(room.playerIds, { type: 'game_restarted', payload: { kind: 'rps' } });
  } else if (room.kind === 'memory') {
    const game = room.game as MemoryGame;
    if (!isMemoryComplete(game)) return; // oyun sürerken sıfırlanamaz
    resetMemory(game);
    sendToPlayers(room.playerIds, { type: 'game_restarted', payload: { kind: 'memory' } });
    sendMemoryState(room.playerIds, game);
  } else if (room.kind === 'pong') {
    const game = room.game as PongGame;
    if (!game.ended) return;
    resetPong(game, room.playerIds);
    sendToPlayers(room.playerIds, { type: 'game_restarted', payload: { kind: 'pong' } });
    startPongLoop(room);
  } else if (room.kind === 'reflex') {
    const game = room.game as ReflexGame;
    if (!game.ended) return;
    resetReflex(game, room.playerIds);
    sendToPlayers(room.playerIds, { type: 'game_restarted', payload: { kind: 'reflex' } });
    startReflexRound(room);
  } else if (room.kind === 'penalty') {
    const game = room.game as PenaltyGame;
    if (!game.ended) return;
    resetPenalty(game);
    sendToPlayers(room.playerIds, { type: 'game_restarted', payload: { kind: 'penalty' } });
    sendPenaltyState(room, 'pick');
  }
}

export function sendMemoryState(roomPlayerIds: readonly string[], game: MemoryGame): void {
  sendToPlayers(roomPlayerIds, {
    type: 'memory_state',
    payload: {
      cards: game.cards.map((c, i) => ({ value: c.matched || game.flipped.includes(i) ? c.value : null, matched: c.matched })),
      turn: game.turnOrder[game.turnIndex],
      scores: { ...game.scores },
    },
  });
}

export function handleMemoryFlip(playerId: string, cardIndex: number): void {
  const player = players.get(playerId);
  const room = player?.roomId ? rooms.get(player.roomId) : undefined;
  if (!room || room.kind !== 'memory' || !room.game) return; // game null = rakip bekleniyor
  const game = room.game as MemoryGame;

  const outcome = flipCard(game, playerId, cardIndex);
  // Geçersiz hamle (sıra bende değil, kart zaten açık, kapatma beklemesi vb.)
  // normal oyun akışının parçası; sessizce yoksayılır.
  if (!outcome.ok) return;

  if (outcome.resolved) {
    sendToPlayers(room.playerIds, {
      type: 'memory_match_result',
      payload: {
        indices: outcome.resolved.indices,
        matched: outcome.resolved.matched,
        turn: game.turnOrder[game.turnIndex],
        scores: { ...game.scores },
      },
    });
  }

  sendMemoryState(room.playerIds, game);

  // Eşleşmeyen ikili: oyuncu ikinci kartı görebilsin diye kartlar kısa süre açık
  // kalır, sonra kapatılıp sıra devredilir.
  if (outcome.resolved && !outcome.resolved.matched) {
    setTimeout(() => {
      // oda kapandıysa ya da oyun bu arada sıfırlandıysa dokunma
      if (rooms.get(room.roomId) !== room || room.game !== game) return;
      hideMismatch(game);
      sendMemoryState(room.playerIds, game);
    }, MEMORY_MISMATCH_REVEAL_MS);
  }

  if (isMemoryComplete(game)) {
    // Oyun bitti ama masa açık kalır; oyuncular chat'e devam edebilir veya room_leave ile ayrılabilir.
    const [a, b] = game.turnOrder;
    if (game.scores[a] !== game.scores[b]) {
      const winner = game.scores[a] > game.scores[b] ? a : b;
      const loser = winner === a ? b : a;
      recordWin(winner, loser, 'memory');
    }
  }
}
