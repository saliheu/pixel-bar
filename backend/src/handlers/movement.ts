import { players } from '../state/players.js';
import { broadcastBar } from '../util/broadcast.js';
import { MAP_WIDTH, MAP_HEIGHT, PLAYER_MIN_Y } from '../config.js';
import type { Facing } from '../protocol.js';
import { findSeatZoneFor } from '../state/zones.js';

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

const FACINGS: Facing[] = ['up', 'down', 'left', 'right'];

export function handleMove(playerId: string, x: number, y: number, facing: Facing, moving: boolean): void {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !FACINGS.includes(facing)) return;
  const player = players.get(playerId);
  if (!player) return;
  if (player.roomId) return; // bir odadayken serbest hareket yok
  if (findSeatZoneFor(playerId)) return; // bir koltukta (bank veya masa) otururken kalkmadan hareket yok
  if (Date.now() < player.stunnedUntil) return; // yumruk yiyip yerdeyken hareket yok

  player.x = clamp(x, 0, MAP_WIDTH);
  player.y = clamp(y, PLAYER_MIN_Y, MAP_HEIGHT);
  player.facing = facing;
  player.moving = moving;
  player.lastSeen = Date.now();

  broadcastBar(
    player.barId,
    { type: 'player_moved', payload: { id: playerId, x: player.x, y: player.y, facing, moving } },
  );
}
