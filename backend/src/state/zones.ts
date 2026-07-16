import type { ZoneType, PublicZone } from '../protocol.js';
import { ZONE_INTERACT_RADIUS, BAR_IDS } from '../config.js';

export interface ZoneSlot {
  slotId: string;
  x: number;
  y: number;
  occupiedBy: string | null; // playerId
}

export interface ZoneDef {
  zoneId: string;
  barId: string; // zonun ait olduğu oda
  type: ZoneType;
  x: number;
  y: number;
  radius: number;
  slots: ZoneSlot[]; // masalar/banklar 2 koltuk, bar tabureleri 1 koltuk
}

function makeZone(barId: string, localId: string, type: ZoneType, x: number, y: number): ZoneDef {
  const zoneId = `${barId}:${localId}`;
  return {
    zoneId,
    barId,
    type,
    x,
    y,
    radius: ZONE_INTERACT_RADIUS,
    slots: [
      { slotId: `${zoneId}-a`, x: x - 30, y, occupiedBy: null },
      { slotId: `${zoneId}-b`, x: x + 30, y, occupiedBy: null },
    ],
  };
}

// Tek koltuklu zone (bar taburesi, sahne koltukları): koltuk tam zone merkezinde,
// etkileşim yarıçapı birbirine yakın dizilen koltuklar için daha dar tutulur.
function makeSingleSeat(barId: string, localId: string, type: ZoneType, x: number, y: number): ZoneDef {
  const zoneId = `${barId}:${localId}`;
  return {
    zoneId,
    barId,
    type,
    x,
    y,
    radius: 40,
    slots: [{ slotId: `${zoneId}-a`, x, y, occupiedBy: null }],
  };
}

// Bar haritası düzeni (1200x700 dünya koordinatları):
// - Üst: bar tezgahı boyunca 10 tabure (oturunca sırt kameraya döner)
// - Sol taraf: Taş-Kağıt-Makas tabureleri
// - Sağ taraf: Pong arcade kabinleri
// - Alt: hafıza kartı (solda), sohbet masaları (sağda), köşelerde refleks
// - Orta: disko dans pisti (dekoratif) + serbest oturma bankları
// Her oda (bar salonu) bu düzenin kendi kopyasını alır.
function makeBarZones(barId: string): ZoneDef[] {
  return [
    ...Array.from({ length: 10 }, (_, i) => makeSingleSeat(barId, `stool-${i + 1}`, 'bar_stool', 330 + i * 60, 100)),
    makeZone(barId, 'rps-1', 'rps_stool', 150, 200),
    makeZone(barId, 'rps-2', 'rps_stool', 150, 420),
    makeZone(barId, 'pong-1', 'pong_cabinet', 1050, 200),
    makeZone(barId, 'pong-2', 'pong_cabinet', 1050, 420),
    makeZone(barId, 'memory-1', 'memory_table', 330, 600),
    makeZone(barId, 'memory-2', 'memory_table', 510, 600),
    makeZone(barId, 'chat-1', 'chat_table', 750, 600),
    makeZone(barId, 'chat-2', 'chat_table', 930, 600),
    makeZone(barId, 'reflex-1', 'reflex_pad', 150, 600),
    makeZone(barId, 'reflex-2', 'reflex_pad', 1050, 600),
    makeZone(barId, 'penalty-1', 'penalty_spot', 600, 240),
    makeZone(barId, 'bench-1', 'bench', 370, 230),
    makeZone(barId, 'bench-2', 'bench', 250, 520),
    makeZone(barId, 'bench-3', 'bench', 950, 520),
    // sahne: dans pistinin sağında, gitar + bateri koltukları
    makeSingleSeat(barId, 'stage-guitar', 'stage_guitar', 828, 330),
    makeSingleSeat(barId, 'stage-drums', 'stage_drums', 905, 330),
  ];
}

export const zones: ZoneDef[] = BAR_IDS.flatMap(makeBarZones);

export function zonesForBar(barId: string): ZoneDef[] {
  return zones.filter((z) => z.barId === barId);
}

export function findZone(zoneId: string): ZoneDef | undefined {
  return zones.find((z) => z.zoneId === zoneId);
}

export function toPublicZone(z: ZoneDef): PublicZone {
  return {
    zoneId: z.zoneId,
    type: z.type,
    x: z.x,
    y: z.y,
    radius: z.radius,
    occupiedSlots: z.slots.map((s) => s.occupiedBy),
  };
}

export function findOpenSlot(zone: ZoneDef): ZoneSlot | undefined {
  return zone.slots.find((s) => s.occupiedBy === null);
}

export function freePlayerFromZones(playerId: string): ZoneDef[] {
  const affected: ZoneDef[] = [];
  for (const zone of zones) {
    let changed = false;
    for (const slot of zone.slots) {
      if (slot.occupiedBy === playerId) {
        slot.occupiedBy = null;
        changed = true;
      }
    }
    if (changed) affected.push(zone);
  }
  return affected;
}

// Oyuncunun bir koltuğunu işgal ettiği herhangi bir zonu bulur (bank veya masa).
// Oda henüz oluşmamış "oturup bekleme" durumunu tespit etmek için kullanılır.
export function findSeatZoneFor(playerId: string): ZoneDef | undefined {
  return zones.find((z) => z.slots.some((s) => s.occupiedBy === playerId));
}
