import type { RoomKind, ZoneType } from '../protocol.js';
import { players } from '../state/players.js';
import { zonesForBar, findZone, findOpenSlot, toPublicZone, freePlayerFromZones, findSeatZoneFor, type ZoneDef } from '../state/zones.js';
import { rooms, nextRoomId, findRoomByZone, type RoomState } from '../state/rooms.js';
import { broadcastBar, sendToPlayer, sendToPlayers } from '../util/broadcast.js';
import { initRps } from '../games/rps.js';
import { initMemory, type MemoryGame } from '../games/memory.js';
import { initPong, type PongGame } from '../games/pong.js';
import { initReflex, clearReflexTimers, type ReflexGame } from '../games/reflex.js';
import { initShootout, clearShootoutTimer, type ShootoutGame } from '../games/shootout.js';
import { startPongLoop, stopPongLoop } from './pongLoop.js';
import { sendMemoryState, startReflexRound, sendShootoutState } from './gameplay.js';
import { bartenderServeQuip } from './bartender.js';

// Oda/eşleşme AÇMAYAN, sadece görsel oturma sağlayan zone tipleri.
const SEAT_ONLY_TYPES: ZoneType[] = ['bench', 'bar_stool', 'stage_guitar', 'stage_drums'];
type SeatOnlyType = 'bench' | 'bar_stool' | 'stage_guitar' | 'stage_drums';

const ZONE_TYPE_TO_KIND: Record<Exclude<ZoneType, SeatOnlyType>, RoomKind> = {
  rps_stool: 'rps',
  pong_cabinet: 'pong',
  memory_table: 'memory',
  chat_table: 'chat',
  reflex_pad: 'reflex',
  penalty_spot: 'penalty',
  freekick_spot: 'freekick',
};

function distance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x1 - x2, y1 - y2);
}

export function handleZoneInteract(playerId: string, zoneId: string): void {
  const player = players.get(playerId);
  const zone = findZone(zoneId);
  if (!player || !zone) return;
  if (zone.barId !== player.barId) return; // başka odanın masasına oturulamaz

  if (player.roomId) return; // zaten bir odada

  const dist = distance(player.x, player.y, zone.x, zone.y);
  if (dist > zone.radius) {
    sendToPlayer(playerId, { type: 'error', payload: { message: 'Bu masaya yeterince yakın değilsiniz.' } });
    return;
  }

  if (zone.slots.some((s) => s.occupiedBy === playerId)) return; // zaten oturuyor

  const slot = findOpenSlot(zone);
  if (!slot) {
    sendToPlayer(playerId, { type: 'error', payload: { message: 'Bu masa dolu.' } });
    return;
  }

  slot.occupiedBy = playerId;
  broadcastBar(zone.barId, { type: 'zone_state', payload: toPublicZone(zone) });

  // tezgaha oturdu: barmen servis repliğini salondaki herkese yollar
  if (zone.type === 'bar_stool') bartenderServeQuip(zone.barId);

  if (SEAT_ONLY_TYPES.includes(zone.type)) return; // bank/bar taburesi oda açmaz, sadece görsel doluluk

  joinOrCreateRoom(zone, playerId);
}

// Masaya oturan oyuncu odaya hemen girer: ilk oturan tek başına bekler,
// ikinci oturan gelince oyun kurulup başlar.
function joinOrCreateRoom(zone: ZoneDef, playerId: string): void {
  const kind = ZONE_TYPE_TO_KIND[zone.type as Exclude<ZoneType, SeatOnlyType>];

  let room = findRoomByZone(zone.zoneId);
  if (!room) {
    room = { roomId: nextRoomId(), kind, zoneId: zone.zoneId, playerIds: [playerId], game: null, chatLastSentAt: {} };
    rooms.set(room.roomId, room);
  } else {
    room.playerIds.push(playerId);
  }

  const player = players.get(playerId);
  if (player) player.roomId = room.roomId;

  let pongSides: Record<string, 'left' | 'right'> | undefined;
  if (room.playerIds.length === 2) {
    const pids = [room.playerIds[0], room.playerIds[1]] as [string, string];
    if (kind === 'rps') room.game = initRps(pids);
    else if (kind === 'memory') room.game = initMemory(pids);
    else if (kind === 'reflex') room.game = initReflex(pids);
    else if (kind === 'penalty' || kind === 'freekick') room.game = initShootout(kind, pids);
    else if (kind === 'pong') {
      room.game = initPong(pids);
      pongSides = { ...(room.game as PongGame).sides };
    }
    // 'chat' -> game null kalır
  }

  // 'you' alanı her oyuncuya özel olduğu için tek tek gönderilir (broadcast değil):
  for (const pid of room.playerIds) {
    sendToPlayer(pid, {
      type: 'room_joined',
      payload: { roomId: room.roomId, kind, zoneId: zone.zoneId, playerIds: [...room.playerIds], you: pid, pongSides },
    });
  }

  if (room.playerIds.length === 2) {
    if (kind === 'pong') startPongLoop(room);
    if (kind === 'memory') sendMemoryState(room.playerIds, room.game as MemoryGame); // ilk sıra bilgisi
    if (kind === 'reflex') startReflexRound(room);
    if (kind === 'penalty' || kind === 'freekick') sendShootoutState(room); // ilk vuruşun rolleri bildirilsin
  }
}

export function leaveRoom(playerId: string, reason: 'left' | 'disconnected'): void {
  const player = players.get(playerId);
  const roomId = player?.roomId;
  if (!roomId) return;

  const room = rooms.get(roomId);
  if (!room) return;

  if (room.kind === 'pong' && room.game) {
    stopPongLoop(room);
  }
  if (room.kind === 'reflex' && room.game) {
    clearReflexTimers(room.game as ReflexGame);
  }
  if ((room.kind === 'penalty' || room.kind === 'freekick') && room.game) {
    clearShootoutTimer(room.game as ShootoutGame);
  }

  // sadece ayrılan oyuncunun koltuğu boşalır; kalan oturmaya devam eder
  const zone = findZone(room.zoneId);
  if (zone) {
    for (const slot of zone.slots) {
      if (slot.occupiedBy === playerId) slot.occupiedBy = null;
    }
    broadcastBar(zone.barId, { type: 'zone_state', payload: toPublicZone(zone) });
  }

  if (player) player.roomId = null;
  room.playerIds = room.playerIds.filter((pid) => pid !== playerId);
  sendToPlayer(playerId, { type: 'room_closed', payload: { roomId, reason } });

  if (room.playerIds.length === 0) {
    rooms.delete(roomId);
    return;
  }

  // Kalan oyuncu bekleme moduna döner: oyun durumu sıfırlanır, oda açık kalır.
  room.game = null;
  const remaining = room.playerIds[0];
  sendToPlayer(remaining, {
    type: 'room_joined',
    payload: { roomId: room.roomId, kind: room.kind, zoneId: room.zoneId, playerIds: [remaining], you: remaining },
  });
}

// Bir koltuktan (bank veya oda henüz oluşmamış masa) kalkma. Oda oluşmuşsa
// (player.roomId set) bunun yerine room_leave kullanılır; bu yüzden burada engellenir.
export function handleSeatLeave(playerId: string): void {
  const player = players.get(playerId);
  if (player?.roomId) return;
  const zone = findSeatZoneFor(playerId);
  if (!zone) return;
  for (const slot of zone.slots) {
    if (slot.occupiedBy === playerId) slot.occupiedBy = null;
  }
  broadcastBar(zone.barId, { type: 'zone_state', payload: toPublicZone(zone) });
}

export function cleanupPlayerZonesAndRoom(playerId: string): void {
  const player = players.get(playerId);
  if (player?.roomId) {
    leaveRoom(playerId, 'disconnected');
  }
  const affectedZones = freePlayerFromZones(playerId);
  for (const zone of affectedZones) {
    broadcastBar(zone.barId, { type: 'zone_state', payload: toPublicZone(zone) });
  }
}

export function allPublicZones(barId: string) {
  return zonesForBar(barId).map(toPublicZone);
}
