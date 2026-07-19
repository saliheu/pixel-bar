import { players } from '../state/players.js';
import { rooms } from '../state/rooms.js';
import { sendToPlayers } from '../util/broadcast.js';
import { resolveRps, resetRps, rpsMatchWinner, type RpsGame } from '../games/rps.js';
import { flipCard, hideMismatch, isMemoryComplete, resetMemory, type MemoryGame } from '../games/memory.js';
import { resetPong, type PongGame } from '../games/pong.js';
import { clearReflexTimers, resetReflex, scoreReflexRound, type ReflexGame } from '../games/reflex.js';
import {
  resetShootout,
  currentShooter,
  currentKeeper,
  resolveShootoutKick,
  shootoutWinner,
  sanitizeShot,
  sanitizeDive,
  type ShootoutGame,
} from '../games/shootout.js';
import {
  initDart,
  resetDart,
  clearDartTimer,
  currentThrower,
  applyDartThrow,
  dartWinner,
  type DartGame,
} from '../games/dart.js';
import { startPongLoop } from './pongLoop.js';
import { recordWin } from './social.js';
import type { RoomState } from '../state/rooms.js';
import { REFLEX_ARM_MIN_MS, REFLEX_ARM_MAX_MS, REFLEX_NEXT_ROUND_MS, SHOOTOUT_RESULT_MS, SHOOTOUT_KICKS_EACH, DART_RESULT_MS, DART_SCATTER } from '../config.js';
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

// ---- Penaltı / Frikik (ortak shootout) ----

// phase 'pick': hamleler bekleniyor; 'result': vuruş sonucu gösteriliyor.
export function sendShootoutState(room: RoomState, phase: 'pick' | 'result' = 'pick'): void {
  const game = room.game as ShootoutGame;
  const waitingOn: string[] = [];
  if (phase === 'pick') {
    if (!game.shot) waitingOn.push(currentShooter(game));
    if (!game.dive) waitingOn.push(currentKeeper(game));
  }
  sendToPlayers(room.playerIds, {
    type: 'shootout_state',
    payload: {
      mode: game.mode,
      phase,
      kick: game.kick,
      totalKicks: SHOOTOUT_KICKS_EACH * 2,
      shooter: currentShooter(game),
      scores: { ...game.scores },
      waitingOn,
      wall: game.wall,
      last: game.last,
      suddenDeath: game.suddenDeath,
      matchWinner: shootoutWinner(game),
    },
  });
}

// Şut ve uzanma aynı akışa girer: ikisi de gelince vuruş çözülür.
function submitShootoutMove(playerId: string, apply: (game: ShootoutGame) => boolean): void {
  const player = players.get(playerId);
  const room = player?.roomId ? rooms.get(player.roomId) : undefined;
  if (!room || (room.kind !== 'penalty' && room.kind !== 'freekick') || !room.game) return;
  const game = room.game as ShootoutGame;
  if (game.ended || game.nextKickTimer) return; // sonuç gösterilirken hamle alınmaz
  if (!apply(game)) return;

  if (!resolveShootoutKick(game)) {
    sendShootoutState(room, 'pick'); // waitingOn güncellensin
    return;
  }

  sendShootoutState(room, 'result');

  if (game.ended) {
    const winner = shootoutWinner(game);
    if (winner) {
      const loser = room.playerIds.find((pid) => pid !== winner) ?? null;
      recordWin(winner, loser, room.kind);
    }
    return;
  }

  game.nextKickTimer = setTimeout(() => {
    game.nextKickTimer = null;
    if (rooms.get(room.roomId) !== room || room.game !== game) return;
    sendShootoutState(room, 'pick');
  }, SHOOTOUT_RESULT_MS);
}

export function handleShoot(playerId: string, raw: unknown): void {
  submitShootoutMove(playerId, (game) => {
    if (currentShooter(game) !== playerId || game.shot) return false; // sırası değil / şutunu attı
    const shot = sanitizeShot(raw as Record<string, number>);
    if (!shot) return false;
    game.shot = shot;
    return true;
  });
}

export function handleDive(playerId: string, raw: unknown): void {
  submitShootoutMove(playerId, (game) => {
    if (currentKeeper(game) !== playerId || game.dive) return false;
    const dive = sanitizeDive(raw as Record<string, number>);
    if (!dive) return false;
    game.dive = dive;
    return true;
  });
}

// ---- Dart (301) ----

export function sendDartState(room: RoomState, phase: 'aim' | 'result' = 'aim'): void {
  const game = room.game as DartGame;
  sendToPlayers(room.playerIds, {
    type: 'dart_state',
    payload: {
      phase,
      thrower: currentThrower(game),
      remaining: { ...game.remaining },
      turnDarts: game.turnDarts.map((d) => ({ ...d })),
      lastDart: game.lastDart,
      bust: game.bust,
      matchWinner: dartWinner(game),
    },
  });
}

export function handleDartThrow(playerId: string, raw: unknown): void {
  const player = players.get(playerId);
  const room = player?.roomId ? rooms.get(player.roomId) : undefined;
  if (!room || room.kind !== 'dart' || !room.game) return; // game null = rakip bekleniyor
  const game = room.game as DartGame;
  if (game.ended || game.resultTimer) return; // sonuç gösterilirken atış alınmaz
  if (currentThrower(game) !== playerId) return; // sıra sende değil

  const p = raw as { x?: unknown; y?: unknown };
  if (typeof p.x !== 'number' || typeof p.y !== 'number' || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return;
  // hafif rastgele sapma: mükemmel koordinat gönderilse de bull garanti olmasın
  const x = p.x + (Math.random() * 2 - 1) * DART_SCATTER;
  const y = p.y + (Math.random() * 2 - 1) * DART_SCATTER;

  const result = applyDartThrow(game, x, y);
  sendDartState(room, 'result');

  if (result.won) {
    const loser = room.playerIds.find((pid) => pid !== playerId) ?? null;
    recordWin(playerId, loser, 'dart');
    return;
  }

  // kısa sonuç gösterimi, sonra sıradaki atış/oyuncu
  game.resultTimer = setTimeout(() => {
    game.resultTimer = null;
    if (rooms.get(room.roomId) !== room || room.game !== game) return;
    sendDartState(room, 'aim');
  }, DART_RESULT_MS);
}

// Biten bir oyunu (hafıza/pong/refleks/penaltı/frikik/dart) aynı odada yeniden başlatır.
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
  } else if (room.kind === 'penalty' || room.kind === 'freekick') {
    const game = room.game as ShootoutGame;
    if (!game.ended) return;
    resetShootout(game);
    sendToPlayers(room.playerIds, { type: 'game_restarted', payload: { kind: room.kind } });
    sendShootoutState(room, 'pick');
  } else if (room.kind === 'dart') {
    const game = room.game as DartGame;
    if (!game.ended) return;
    resetDart(game);
    sendToPlayers(room.playerIds, { type: 'game_restarted', payload: { kind: 'dart' } });
    sendDartState(room, 'aim');
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
