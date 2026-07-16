import { PONG_TICK_MS } from '../config.js';
import { stepPong, type PongGame } from '../games/pong.js';
import type { RoomState } from '../state/rooms.js';
import { sendToPlayers } from '../util/broadcast.js';
import { recordWin } from './social.js';

export function startPongLoop(room: RoomState): void {
  const game = room.game as PongGame;
  const playerIds = [room.playerIds[0], room.playerIds[1]] as [string, string];
  game.tickInterval = setInterval(() => {
    const result = stepPong(game, playerIds);

    sendToPlayers(room.playerIds, {
      type: 'pong_state',
      payload: { ball: { x: game.ball.x, y: game.ball.y }, paddles: { ...game.paddles }, score: { ...game.score } },
    });

    if (result.goalScorer) {
      sendToPlayers(room.playerIds, {
        type: 'pong_goal',
        payload: { scorer: result.goalScorer, score: { ...game.score } },
      });
    }

    if (result.matchWinner) {
      // Maç bitince oda AÇIK kalır; oyuncular "yeniden başla" diyebilir
      // veya ayrılabilir (leaveRoom odayı kapatır).
      stopPongLoop(room);
      game.ended = true;
      sendToPlayers(room.playerIds, {
        type: 'pong_end',
        payload: { winner: result.matchWinner, score: { ...game.score } },
      });
      const loser = room.playerIds.find((pid) => pid !== result.matchWinner) ?? null;
      recordWin(result.matchWinner, loser, 'pong');
    }
  }, PONG_TICK_MS);
}

export function stopPongLoop(room: RoomState): void {
  const game = room.game as PongGame;
  if (game.tickInterval) {
    clearInterval(game.tickInterval);
    game.tickInterval = null;
  }
}
