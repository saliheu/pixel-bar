import { Container, Graphics, Text } from 'pixi.js';
import type { PublicZone, ZoneType } from '../protocol.js';
import { MAP_WIDTH, MAP_HEIGHT } from '../config.js';

export const ZONE_SLOT_OFFSET_X = 30;

const ZONE_LABELS: Record<ZoneType, string> = {
  rps_stool: 'Taş-Kağıt-Makas',
  pong_cabinet: 'Retro Pong',
  memory_table: 'Hafıza Kartı',
  chat_table: 'Sohbet Masası',
  bench: 'Bank',
  bar_stool: '', // tabureler etiketlenmez (10 tanesi tezgah boyunca dizili)
  reflex_pad: 'Refleks Düellosu',
  stage_guitar: 'Gitar',
  stage_drums: 'Bateri',
  penalty_spot: 'Penaltı',
};

const SEAT_EMPTY = 0xf5c451;
const SEAT_OCCUPIED = 0xd97a3f;

export interface ZoneVisual {
  container: Container;
  highlight: Graphics;
  base: Graphics;
  seats: Graphics[]; // koltuk sayısı zone'a göre 1 veya 2
  type: ZoneType;
}

export function drawFloor(worldContainer: Container): void {
  const floor = new Graphics();
  floor.rect(0, 0, MAP_WIDTH, MAP_HEIGHT).fill(0x342a4f);

  // iki tonlu ahşap zemin şeritleri (sıcak mor-erik tonları)
  for (let x = 0; x < MAP_WIDTH; x += 46) {
    const shade = (Math.floor(x / 46) % 2 === 0) ? 0x3c3059 : 0x382d54;
    floor.rect(x, 0, 46, MAP_HEIGHT).fill({ color: shade, alpha: 0.6 });
  }
  for (let y = 0; y < MAP_HEIGHT; y += 90) {
    floor.moveTo(0, y).lineTo(MAP_WIDTH, y).stroke({ width: 1, color: 0x241b3a, alpha: 0.4 });
  }

  // zemine vuran renkli ortam ışıkları (geniş, çok hafif renk havuzları)
  floor.circle(180, 300, 240).fill({ color: 0xfbbf24, alpha: 0.045 });
  floor.circle(1020, 300, 240).fill({ color: 0x38bdf8, alpha: 0.05 });
  floor.circle(600, 560, 280).fill({ color: 0xf472b6, alpha: 0.04 });

  // köşe vinyeti (öncekinden daha hafif)
  const vignetteSpots: [number, number, number][] = [
    [0, 0, 300], [MAP_WIDTH, 0, 300], [0, MAP_HEIGHT, 300], [MAP_WIDTH, MAP_HEIGHT, 300],
  ];
  for (const [x, y, r] of vignetteSpots) {
    floor.circle(x, y, r).fill({ color: 0x140f24, alpha: 0.16 });
  }

  floor.rect(0, 0, MAP_WIDTH, MAP_HEIGHT).stroke({ width: 5, color: 0x6b52a0 });
  floor.rect(4, 4, MAP_WIDTH - 8, MAP_HEIGHT - 8).stroke({ width: 1.5, color: 0x9d7fe0, alpha: 0.5 });
  worldContainer.addChild(floor);
}

// Zone tipine göre renkli halı + hafif gölge.
const RUG_COLORS: Record<ZoneType, number> = {
  rps_stool: 0xfbbf24,
  pong_cabinet: 0x38bdf8,
  memory_table: 0x4ade80,
  chat_table: 0xf472b6,
  bench: 0xb39ddb,
  bar_stool: 0xfbbf24,
  reflex_pad: 0xff6b6b,
  stage_guitar: 0xf472b6,
  stage_drums: 0xf472b6,
  penalty_spot: 0x4ade80,
};

function drawRug(g: Graphics, w: number, h: number, type?: ZoneType): void {
  if (type) {
    const color = RUG_COLORS[type];
    g.ellipse(0, 6, w + 6, h + 3).fill({ color, alpha: 0.12 });
    g.ellipse(0, 6, w + 6, h + 3).stroke({ width: 1.5, color, alpha: 0.3 });
  }
  g.ellipse(0, 6, w, h).fill({ color: 0x140f24, alpha: 0.28 });
}

function drawBase(g: Graphics, type: ZoneType): void {
  g.clear();
  switch (type) {
    case 'rps_stool':
      drawRug(g, 44, 16, 'rps_stool');
      g.circle(0, 0, 27).fill(0x5a3d24);
      g.circle(0, 0, 22).fill(0x6f4c2e);
      g.circle(0, 0, 22).stroke({ width: 2, color: 0x3d2a1a });
      g.circle(0, 0, 14).stroke({ width: 1.2, color: 0x8a6339, alpha: 0.7 });
      break;
    case 'pong_cabinet':
      drawRug(g, 48, 18, 'pong_cabinet');
      g.roundRect(-32, -22, 64, 46, 5).fill(0x241f33);
      g.roundRect(-32, -22, 64, 46, 5).stroke({ width: 2, color: 0x120f1e });
      g.roundRect(-28, -18, 56, 8, 2).fill(0x6d28d9); // marquee şeridi
      g.roundRect(-24, -8, 48, 24, 2).fill(0x083b3a);
      g.roundRect(-24, -8, 48, 24, 2).stroke({ width: 1, color: 0x14b8a6, alpha: 0.6 });
      g.moveTo(-24, -2).lineTo(24, -2).stroke({ width: 1, color: 0x2dd4bf, alpha: 0.35 });
      g.circle(-18, 20, 3).fill(0xef4444);
      g.circle(-9, 20, 3).fill(0xfacc15);
      break;
    case 'memory_table':
      drawRug(g, 56, 20, 'memory_table');
      g.roundRect(-42, -26, 84, 52, 8).fill(0x4a3320);
      g.roundRect(-42, -26, 84, 52, 8).stroke({ width: 2, color: 0x2c1d10 });
      for (let i = -30; i <= 30; i += 12) {
        g.moveTo(i, -22).lineTo(i, 22).stroke({ width: 1, color: 0x3a2718, alpha: 0.5 });
      }
      g.roundRect(-16, -12, 32, 24, 3).stroke({ width: 1.3, color: 0xc9a05c, alpha: 0.55 });
      break;
    case 'chat_table':
      drawRug(g, 46, 18, 'chat_table');
      g.circle(0, 0, 31).fill(0x3a2f4a);
      g.circle(0, 0, 31).stroke({ width: 2, color: 0x241b30 });
      g.circle(0, 0, 24).fill(0x453a58);
      for (let a = 0; a < 8; a++) {
        const ang = (a / 8) * Math.PI * 2;
        g.moveTo(0, 0).lineTo(Math.cos(ang) * 24, Math.sin(ang) * 24).stroke({ width: 1, color: 0x241b30, alpha: 0.4 });
      }
      g.circle(0, 0, 4).fill({ color: 0xfacc15, alpha: 0.85 });
      break;
    case 'bench':
      drawRug(g, 50, 14, 'bench');
      g.roundRect(-38, -6, 76, 10, 3).fill(0x5a4530);
      g.roundRect(-38, -6, 76, 10, 3).stroke({ width: 1.5, color: 0x3a2c1c });
      g.roundRect(-38, -16, 76, 7, 2).fill(0x6b5236);
      g.roundRect(-38, -16, 76, 7, 2).stroke({ width: 1, color: 0x3a2c1c });
      g.rect(-32, -6, 4, 14).fill(0x2e2418);
      g.rect(30, -6, 4, 14).fill(0x2e2418);
      break;
    case 'reflex_pad':
      // refleks masası: koyu kaide + büyük kırmızı buzzer + şimşek
      drawRug(g, 46, 17, 'reflex_pad');
      g.roundRect(-30, -20, 60, 42, 8).fill(0x2a2140);
      g.roundRect(-30, -20, 60, 42, 8).stroke({ width: 2, color: 0x171028 });
      g.ellipse(0, -4, 19, 9).fill(0x171028);
      g.circle(0, -8, 13).fill(0xef4444);
      g.circle(0, -8, 13).stroke({ width: 2, color: 0x991b1b });
      g.ellipse(-4, -12, 5, 3).fill({ color: 0xffffff, alpha: 0.35 });
      // şimşek işareti
      g.poly([1, -15, -4, -7, -0.5, -7, -2, -1, 4, -9, 0.5, -9]).fill(0xfde047);
      break;
    case 'bar_stool':
      // tezgah önü taburesi: küçük yuvarlak oturak + metal ayak
      g.ellipse(0, 10, 13, 5).fill({ color: 0x0a0713, alpha: 0.3 });
      g.moveTo(0, 8).lineTo(0, 0).stroke({ width: 2.5, color: 0x4a4258 });
      g.ellipse(0, 8, 7, 2.5).fill(0x4a4258);
      g.circle(0, -2, 10).fill(0x5a3d64);
      g.circle(0, -2, 10).stroke({ width: 2, color: 0x37243e });
      g.circle(0, -2, 5.5).stroke({ width: 1, color: 0x7a5588, alpha: 0.7 });
      break;
    case 'stage_guitar':
      // sahne platform parçası + amfi + gitar standı
      drawRug(g, 40, 15, 'stage_guitar');
      g.roundRect(-34, -14, 68, 34, 6).fill(0x3a2450);
      g.roundRect(-34, -14, 68, 34, 6).stroke({ width: 2, color: 0x241335 });
      // amfi
      g.roundRect(-30, -30, 20, 20, 3).fill(0x1c1226);
      g.roundRect(-30, -30, 20, 20, 3).stroke({ width: 1.5, color: 0x0f0a16 });
      g.circle(-20, -20, 6).stroke({ width: 1.2, color: 0x7a5588 });
      g.circle(-20, -20, 2.5).fill({ color: 0xf472b6, alpha: 0.7 });
      // gitar standında duran gitar silueti (boş koltuk gösterimi)
      g.moveTo(20, -28).lineTo(20, -8).stroke({ width: 2, color: 0x8a5a2e });
      g.ellipse(20, -8, 6, 7).fill(0xb0703a);
      g.ellipse(20, -8, 6, 7).stroke({ width: 1.4, color: 0x5c3a1c });
      g.circle(20, -9, 2).fill(0x2c1a0c);
      break;
    case 'stage_drums':
      // sahne platform parçası + bateri seti
      drawRug(g, 40, 15, 'stage_drums');
      g.roundRect(-34, -14, 68, 34, 6).fill(0x3a2450);
      g.roundRect(-34, -14, 68, 34, 6).stroke({ width: 2, color: 0x241335 });
      // kick davulu (önde, yüzü kameraya dönük)
      g.circle(0, -6, 12).fill(0xb03a5c);
      g.circle(0, -6, 12).stroke({ width: 2, color: 0x5c1c30 });
      g.circle(0, -6, 8).fill(0xe8e2d6);
      // tom + trampet
      g.ellipse(-16, -18, 8, 5).fill(0xd0486e);
      g.ellipse(-16, -18, 8, 5).stroke({ width: 1.4, color: 0x5c1c30 });
      g.ellipse(16, -18, 8, 5).fill(0xd0486e);
      g.ellipse(16, -18, 8, 5).stroke({ width: 1.4, color: 0x5c1c30 });
      // zil
      g.ellipse(26, -28, 9, 3).fill(0xd9b955);
      g.ellipse(26, -28, 9, 3).stroke({ width: 1, color: 0x8a7222 });
      g.moveTo(26, -26).lineTo(26, -12).stroke({ width: 1.5, color: 0x4a4258 });
      break;
    case 'penalty_spot':
      // mini saha: çim zemin + penaltı noktası + üstte kale
      g.roundRect(-52, -34, 104, 66, 10).fill(0x2c5c3a);
      g.roundRect(-52, -34, 104, 66, 10).stroke({ width: 2, color: 0x1c3d26 });
      // çim şeritleri
      for (let i = -40; i <= 28; i += 17) {
        g.rect(i, -32, 8, 62).fill({ color: 0x35704a, alpha: 0.5 });
      }
      // kale (üst kenarda)
      g.moveTo(-30, -34).lineTo(-30, -48).lineTo(30, -48).lineTo(30, -34).stroke({ width: 2.5, color: 0xe8e2d6 });
      for (let i = -26; i <= 26; i += 8) {
        g.moveTo(i, -47).lineTo(i, -35).stroke({ width: 0.8, color: 0xe8e2d6, alpha: 0.5 });
      }
      // ceza yayı + penaltı noktası + top
      g.circle(0, 6, 2.5).fill(0xe8e2d6);
      g.circle(0, 8, 5).fill(0xffffff);
      g.circle(0, 8, 5).stroke({ width: 1.2, color: 0x1c1730 });
      g.poly([0, 4.5, -2.8, 7, -1.5, 10.5, 1.5, 10.5, 2.8, 7]).stroke({ width: 0.8, color: 0x1c1730, alpha: 0.7 });
      break;
  }
}

function drawSeat(g: Graphics, occupied: boolean, type?: ZoneType): void {
  g.clear();
  const color = occupied ? SEAT_OCCUPIED : SEAT_EMPTY;
  if (type === 'bar_stool') {
    // tabure zaten çizili; boş koltuk için sadece küçük bir parıltı noktası
    if (!occupied) g.circle(0, -2, 1.8).fill({ color, alpha: 0.9 });
    return;
  }
  if (occupied) {
    g.roundRect(-8, -6, 16, 12, 3).fill(color);
    g.roundRect(-8, -6, 16, 12, 3).stroke({ width: 1.3, color: 0x2c1d10 });
    g.moveTo(-8, -6).lineTo(-8, -13).stroke({ width: 2.5, color, cap: 'round' });
    g.moveTo(8, -6).lineTo(8, -13).stroke({ width: 2.5, color, cap: 'round' });
  } else {
    g.roundRect(-8, -6, 16, 12, 3).stroke({ width: 1.6, color, alpha: 0.85 });
    g.moveTo(-8, -6).lineTo(-8, -13).stroke({ width: 2, color, alpha: 0.85, cap: 'round' });
    g.moveTo(8, -6).lineTo(8, -13).stroke({ width: 2, color, alpha: 0.85, cap: 'round' });
    g.circle(0, -2, 1.6).fill({ color, alpha: 0.9 });
  }
}

function makeLabelTag(text: string, type: ZoneType): Container {
  const container = new Container();
  const t = new Text({ text, style: { fill: 0xf2eefc, fontSize: 11, fontFamily: 'system-ui, sans-serif', fontWeight: '600' } });
  t.anchor.set(0.5, 0.5);
  const padX = 8;
  const padY = 4;
  const bg = new Graphics();
  bg.roundRect(-t.width / 2 - padX, -t.height / 2 - padY, t.width + padX * 2, t.height + padY * 2, 7)
    .fill({ color: 0x1a1430, alpha: 0.75 })
    .stroke({ width: 1.2, color: RUG_COLORS[type], alpha: 0.65 });
  container.addChild(bg);
  container.addChild(t);
  return container;
}

export function createZoneVisuals(worldContainer: Container, zones: PublicZone[]): Map<string, ZoneVisual> {
  const map = new Map<string, ZoneVisual>();
  for (const zone of zones) {
    const container = new Container();
    container.x = zone.x;
    container.y = zone.y;

    const highlight = new Graphics();
    highlight.visible = false;
    container.addChild(highlight);

    const base = new Graphics();
    drawBase(base, zone.type);
    container.addChild(base);

    // koltuk işaretleri: tek koltuklu zonlarda merkezde, iki koltuklularda ±offset
    const seats: Graphics[] = zone.occupiedSlots.map((occupant, idx) => {
      const seat = new Graphics();
      seat.x = zone.occupiedSlots.length === 1 ? 0 : (idx === 0 ? -ZONE_SLOT_OFFSET_X : ZONE_SLOT_OFFSET_X);
      // bar taburesinde tabure görseli koltuğun kendisi; işaret sadece boşken gösterilir
      if (zone.type !== 'bar_stool' || !occupant) drawSeat(seat, Boolean(occupant), zone.type);
      container.addChild(seat);
      return seat;
    });

    const labelText = ZONE_LABELS[zone.type];
    if (labelText) {
      const label = makeLabelTag(labelText, zone.type);
      label.y = -52;
      container.addChild(label);
    }

    worldContainer.addChild(container);
    map.set(zone.zoneId, { container, highlight, base, seats, type: zone.type });
  }
  return map;
}

// Etkileşim menzilindeki zonun altında nabız gibi atan cyan halka.
// Her frame çağrılır; eligibleZoneId null ise tüm halkalar gizlenir.
export function tickZoneHighlights(visuals: Map<string, ZoneVisual>, eligibleZoneId: string | null, now: number): void {
  for (const [zoneId, v] of visuals) {
    if (zoneId !== eligibleZoneId) {
      v.highlight.visible = false;
      continue;
    }
    const pulse = (Math.sin(now * 0.005) + 1) / 2; // 0..1
    const baseR = v.type === 'bar_stool' ? 24 : 46;
    const r = baseR + pulse * 6;
    v.highlight.clear();
    v.highlight.ellipse(0, 6, r, r * 0.42).stroke({ width: 2.5, color: 0x38bdf8, alpha: 0.35 + pulse * 0.45 });
    v.highlight.ellipse(0, 6, r * 0.8, r * 0.42 * 0.8).stroke({ width: 1.2, color: 0x7dd3fc, alpha: 0.2 + pulse * 0.3 });
    v.highlight.visible = true;
  }
}

export function updateZoneVisual(visuals: Map<string, ZoneVisual>, zone: PublicZone): void {
  const v = visuals.get(zone.zoneId);
  if (!v) return;
  v.seats.forEach((seat, idx) => drawSeat(seat, Boolean(zone.occupiedSlots[idx]), zone.type));
}
