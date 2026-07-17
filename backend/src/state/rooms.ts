import type { RoomKind } from '../protocol.js';
import type { RpsGame } from '../games/rps.js';
import type { PongGame } from '../games/pong.js';
import type { MemoryGame } from '../games/memory.js';
import type { ReflexGame } from '../games/reflex.js';
import type { ShootoutGame } from '../games/shootout.js';

export interface RoomState {
  roomId: string;
  kind: RoomKind;
  zoneId: string;
  playerIds: string[]; // 1 kişi = rakip bekleniyor, 2 kişi = oyun aktif
  game: RpsGame | PongGame | MemoryGame | ReflexGame | ShootoutGame | null; // tek kişiyken null
  chatLastSentAt: Partial<Record<string, number>>; // rate-limit için
}

export const rooms = new Map<string, RoomState>();

let roomCounter = 0;
export function nextRoomId(): string {
  roomCounter++;
  return `room-${roomCounter}-${Date.now().toString(36)}`;
}

export function findRoomByZone(zoneId: string): RoomState | undefined {
  for (const room of rooms.values()) {
    if (room.zoneId === zoneId) return room;
  }
  return undefined;
}
