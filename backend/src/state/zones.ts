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

// Bar haritası düzeni (1200x700 dünya koordinatları). Mekân bölgelere ayrılır:
// - Üst şerit (y~105): bar tezgahı boyunca 10 tabure (oturunca sırt kameraya döner)
// - Üst orta (y~208): SAHNE — gitar + bateri, yüzü dans pistine dönük
// - Sol duvar (x~145): Taş-Kağıt-Makas masaları + jukebox (dekor)
// - Sağ duvar (x~1055): Pong arcade kabinleri
// - Orta (600,420): disko dans pisti (dekor), sahnenin tam önünde
// - Alt şerit (y~620): refleks | hafıza x2 | penaltı | sohbet x2 | refleks
// - Banklar: sahnenin önü ve pistin iki yanı (serbest oturma)
// Koordinatlar frontend/src/pixi/decor.ts'teki sahne/pist konumlarıyla uyumlu olmalı.
function makeBarZones(barId: string): ZoneDef[] {
  return [
    ...Array.from({ length: 10 }, (_, i) => makeSingleSeat(barId, `stool-${i + 1}`, 'bar_stool', 330 + i * 60, 105)),
    // sahne: dans pistinin hemen üstünde, ortak platform üzerinde (platform decor'da çizilir)
    makeSingleSeat(barId, 'stage-guitar', 'stage_guitar', 540, 208),
    makeSingleSeat(barId, 'stage-drums', 'stage_drums', 660, 208),
    // sol ve sağ duvarlar (aşağıda refleks kaideleri)
    makeZone(barId, 'rps-1', 'rps_stool', 145, 250),
    makeZone(barId, 'rps-2', 'rps_stool', 145, 430),
    makeZone(barId, 'reflex-1', 'reflex_pad', 145, 560),
    makeZone(barId, 'pong-1', 'pong_cabinet', 1055, 250),
    makeZone(barId, 'pong-2', 'pong_cabinet', 1055, 430),
    makeZone(barId, 'reflex-2', 'reflex_pad', 1055, 560),
    // banklar: sahne önü + pistin yanları
    makeZone(barId, 'bench-1', 'bench', 600, 300),
    makeZone(barId, 'bench-2', 'bench', 295, 330),
    makeZone(barId, 'bench-3', 'bench', 905, 330),
    // alt şerit: hafıza x2 | penaltı | frikik | sohbet x2
    makeZone(barId, 'memory-1', 'memory_table', 262, 620),
    makeZone(barId, 'memory-2', 'memory_table', 400, 620),
    makeZone(barId, 'penalty-1', 'penalty_spot', 548, 620),
    makeZone(barId, 'freekick-1', 'freekick_spot', 706, 620),
    makeZone(barId, 'chat-1', 'chat_table', 843, 620),
    makeZone(barId, 'chat-2', 'chat_table', 968, 620),
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
