import { players } from '../state/players.js';
import { broadcastBar, sendToPlayer } from '../util/broadcast.js';
import type { RoomKind } from '../protocol.js';

const LEADERBOARD_SIZE = 5;

function leaderboardFor(barId: string): { name: string; wins: number }[] {
  return [...players.values()]
    .filter((p) => p.barId === barId && p.wins > 0)
    .sort((a, b) => b.wins - a.wins)
    .slice(0, LEADERBOARD_SIZE)
    .map((p) => ({ name: p.name, wins: p.wins }));
}

// Yeni bağlanan oyuncuya salonun mevcut lider tablosunu gönderir.
export function sendLeaderboardTo(playerId: string): void {
  const player = players.get(playerId);
  if (!player) return;
  sendToPlayer(playerId, { type: 'leaderboard', payload: { top: leaderboardFor(player.barId) } });
}

// Galibiyeti işler: sayaç artar, salonun lider tablosu yayınlanır;
// announceGame verilmişse aktivite şeridine oyun sonucu duyurulur.
export function recordWin(winnerId: string, loserId: string | null, announceGame: RoomKind | null): void {
  const winner = players.get(winnerId);
  if (!winner) return;
  winner.wins++;

  broadcastBar(winner.barId, { type: 'leaderboard', payload: { top: leaderboardFor(winner.barId) } });

  if (announceGame) {
    const loserName = loserId ? players.get(loserId)?.name ?? '?' : '?';
    broadcastBar(winner.barId, {
      type: 'activity',
      payload: { kind: 'game_win', game: announceGame, winner: winner.name, loser: loserName },
    });
  }
}
