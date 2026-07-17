import { Container, Graphics, Text } from 'pixi.js';
import type { PublicZone, ZoneType } from '../protocol.js';
import { MAP_WIDTH, MAP_HEIGHT } from '../config.js';

export const ZONE_SLOT_OFFSET_X = 30;

const ZONE_LABELS: Record<ZoneType, string> = {
  rps_stool: 'Taş-Kağıt-Makas',
  pong_cabinet: 'Retro Pong',
  memory_table: 'Hafıza Kartı',
  chat_table: 'Sohbet Masası',
  bench: '', // bank kendini anlatır; etiket kalabalık yapıyordu
  bar_stool: '', // tabureler etiketlenmez (10 tanesi tezgah boyunca dizili)
  reflex_pad: 'Refleks Düellosu',
  stage_guitar: 'Gitar',
  stage_drums: 'Bateri',
  penalty_spot: 'Penaltı',
  freekick_spot: 'Frikik',
};

// Boş koltuğu işaret eden parıltı rengi. Dolu koltukta parıltı çizilmez;
// doluluğu zaten üstünde oturan avatar gösterir.
const SEAT_EMPTY = 0xf5c451;

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
  freekick_spot: 0x4ade80,
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
      // küçük yuvarlak ahşap masa: tek ayak + eliptik tabla (hafif perspektif)
      drawRug(g, 44, 16, 'rps_stool');
      g.ellipse(0, 14, 15, 5).fill(0x2c1d10); // taban
      g.roundRect(-3.5, 0, 7, 14, 2).fill(0x3d2a1a); // ayak
      g.ellipse(0, 0, 26, 21).fill(0x5a3d24); // tabla kenarı
      g.ellipse(0, 0, 26, 21).stroke({ width: 2, color: 0x33220f });
      g.ellipse(0, -2.5, 24, 19).fill(0x7a5433); // üst yüzey
      g.ellipse(0, -2.5, 24, 19).stroke({ width: 1, color: 0x33220f, alpha: 0.5 });
      // ahşap damarları
      g.ellipse(0, -2.5, 16, 12.5).stroke({ width: 1, color: 0x8a6339, alpha: 0.35 });
      g.ellipse(0, -2.5, 8, 6).stroke({ width: 1, color: 0x8a6339, alpha: 0.28 });
      // üstten gelen ışık parıltısı
      g.ellipse(-7, -8, 8, 4).fill({ color: 0xffe4a8, alpha: 0.1 });
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
    case 'memory_table': {
      // dikdörtgen ahşap masa: 4 ayak + damarlı tabla + üzerinde kart destesi
      drawRug(g, 56, 20, 'memory_table');
      for (const lx of [-34, 34]) {
        g.roundRect(lx - 2.5, 16, 5, 12, 2).fill(0x2c1d10);
        g.ellipse(lx, 28, 5, 2).fill({ color: 0x0a0713, alpha: 0.3 });
      }
      g.roundRect(-42, -24, 84, 48, 6).fill(0x3d2a17); // gövde/kenar
      g.roundRect(-42, -24, 84, 48, 6).stroke({ width: 2, color: 0x241407 });
      g.roundRect(-40, -26, 80, 44, 5).fill(0x6b4a2b); // üst yüzey
      g.roundRect(-40, -26, 80, 44, 5).stroke({ width: 1.2, color: 0x241407, alpha: 0.6 });
      // ahşap damarları
      for (let i = -32; i <= 32; i += 11) {
        g.moveTo(i, -24).lineTo(i + 2, 16).stroke({ width: 1, color: 0x7d5a36, alpha: 0.3 });
      }
      g.roundRect(-36, -23, 72, 4, 2).fill({ color: 0xffe4a8, alpha: 0.08 }); // üst parlaklık
      // masadaki kart destesi
      g.roundRect(-9, -10, 12, 16, 2).fill(0xe8e2d6).stroke({ width: 1, color: 0x33220f });
      g.roundRect(-6, -13, 12, 16, 2).fill(0xf5f1e8).stroke({ width: 1, color: 0x33220f });
      g.roundRect(-3.5, -11, 7, 11, 1).stroke({ width: 0.8, color: 0xc9a05c, alpha: 0.8 });
      // yan yatmış açık kart
      g.roundRect(10, -6, 14, 11, 2).fill(0xf5f1e8).stroke({ width: 1, color: 0x33220f });
      g.circle(17, -0.5, 2.5).fill({ color: 0xef4444, alpha: 0.75 });
      break;
    }
    case 'chat_table': {
      // yuvarlak bistro masası: tek ayak + eliptik mermer tabla + mum ve içkiler
      drawRug(g, 46, 18, 'chat_table');
      g.ellipse(0, 16, 14, 5).fill(0x241b30); // taban
      g.roundRect(-3.5, 2, 7, 14, 2).fill(0x3a2f4a); // ayak
      g.ellipse(0, 0, 30, 24).fill(0x3a2f4a); // tabla kenarı
      g.ellipse(0, 0, 30, 24).stroke({ width: 2, color: 0x211830 });
      g.ellipse(0, -2.5, 28, 22).fill(0x554465); // üst yüzey
      g.ellipse(0, -2.5, 28, 22).stroke({ width: 1, color: 0x211830, alpha: 0.5 });
      // mermer damarları
      g.moveTo(-16, -8).bezierCurveTo(-6, -13, 4, -2, 15, -7).stroke({ width: 1, color: 0x6b587e, alpha: 0.5 });
      g.moveTo(-13, 6).bezierCurveTo(-3, 1, 6, 9, 16, 4).stroke({ width: 1, color: 0x6b587e, alpha: 0.35 });
      g.ellipse(-8, -9, 9, 4).fill({ color: 0xffe4a8, alpha: 0.09 }); // ışık yansıması
      // ortada mum: gövde + alev + ışık halkası
      g.ellipse(0, -1, 12, 6).fill({ color: 0xffcf7a, alpha: 0.12 });
      g.roundRect(-2.5, -9, 5, 8, 1.5).fill(0xf5f1e8);
      g.roundRect(-2.5, -9, 5, 8, 1.5).stroke({ width: 0.9, color: 0xc9a05c, alpha: 0.6 });
      g.ellipse(0, -11.5, 2, 3.5).fill({ color: 0xfbbf24, alpha: 0.95 });
      g.ellipse(0, -12, 1, 2).fill({ color: 0xfff3d6, alpha: 0.9 });
      // iki kokteyl bardağı
      for (const dx of [-15, 15]) {
        g.poly([dx - 4, -4, dx + 4, -4, dx, 2]).fill({ color: 0xd9f3ff, alpha: 0.5 });
        g.poly([dx - 4, -4, dx + 4, -4, dx, 2]).stroke({ width: 0.9, color: 0xbfe9ff, alpha: 0.85 });
        g.moveTo(dx, 2).lineTo(dx, 6).stroke({ width: 1, color: 0xbfe9ff, alpha: 0.7 });
        g.moveTo(dx - 2.5, 6).lineTo(dx + 2.5, 6).stroke({ width: 1, color: 0xbfe9ff, alpha: 0.7 });
        g.poly([dx - 3, -3.4, dx + 3, -3.4, dx, 1]).fill({ color: dx < 0 ? 0xf472b6 : 0xfbbf24, alpha: 0.7 });
      }
      break;
    }
    case 'bench':
      // ahşap bank: latalı oturak + sırtlık + demir ayaklar
      drawRug(g, 50, 14, 'bench');
      for (const lx of [-30, 30]) {
        g.roundRect(lx - 2, 2, 4, 12, 1.5).fill(0x2e2418);
        g.ellipse(lx, 14, 4, 1.8).fill({ color: 0x0a0713, alpha: 0.3 });
      }
      // oturak latları
      g.roundRect(-38, -4, 76, 9, 3).fill(0x6b5236);
      g.roundRect(-38, -4, 76, 9, 3).stroke({ width: 1.4, color: 0x3a2c1c });
      g.moveTo(-36, 0.5).lineTo(36, 0.5).stroke({ width: 0.9, color: 0x3a2c1c, alpha: 0.45 });
      // sırtlık latları
      g.roundRect(-38, -17, 76, 5, 2).fill(0x7d6140);
      g.roundRect(-38, -17, 76, 5, 2).stroke({ width: 1, color: 0x3a2c1c });
      g.roundRect(-38, -10, 76, 4, 2).fill(0x6b5236);
      g.roundRect(-38, -10, 76, 4, 2).stroke({ width: 1, color: 0x3a2c1c });
      // sırtlık dikmeleri
      g.rect(-34, -17, 3, 13).fill(0x4a3a26);
      g.rect(31, -17, 3, 13).fill(0x4a3a26);
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
      // Platform decor.ts'te ortak çizilir. Oyuncu zone merkezine oturduğu için
      // ekipman merkezin dışına yerleştirilir: solda amfi, sağda mikrofon.
      g.roundRect(-34, -2, 22, 22, 3).fill(0x1c1226);
      g.roundRect(-34, -2, 22, 22, 3).stroke({ width: 1.5, color: 0x0f0a16 });
      g.circle(-23, 9, 6.5).fill(0x2a1d38);
      g.circle(-23, 9, 6.5).stroke({ width: 1.2, color: 0x7a5588 });
      g.circle(-23, 9, 2.5).fill({ color: 0xf472b6, alpha: 0.7 });
      g.roundRect(-32, 0, 18, 3, 1).fill({ color: 0x4a3a66, alpha: 0.8 });
      // mikrofon standı (sağda)
      g.ellipse(30, 18, 7, 2.5).fill(0x2a1d38);
      g.moveTo(30, 17).lineTo(30, -14).stroke({ width: 1.6, color: 0x4a4258 });
      g.moveTo(30, -14).lineTo(24, -18).stroke({ width: 1.4, color: 0x4a4258 });
      g.circle(23, -19, 3).fill(0x3a3455);
      g.circle(23, -19, 3).stroke({ width: 1, color: 0x7a5588 });
      break;
    case 'stage_drums':
      // Platform decor.ts'te ortak çizilir. Baterist merkeze oturur:
      // kick önde (aşağıda), tomlar yanlarda, ziller dışta.
      g.ellipse(0, 30, 14, 4).fill({ color: 0x0a0713, alpha: 0.3 });
      g.circle(0, 19, 11).fill(0xb03a5c);
      g.circle(0, 19, 11).stroke({ width: 2, color: 0x5c1c30 });
      g.circle(0, 19, 7.5).fill(0xe8e2d6);
      g.circle(0, 19, 7.5).stroke({ width: 1, color: 0x8a7264 });
      g.circle(-2.5, 16.5, 1.8).fill({ color: 0xffffff, alpha: 0.4 });
      // tomlar (yanlarda, avatarın dışında)
      for (const [tx, ty] of [[-19, 6], [19, 6]] as [number, number][]) {
        g.moveTo(tx, ty).lineTo(tx, ty + 12).stroke({ width: 1.4, color: 0x4a4258 });
        g.ellipse(tx, ty, 8.5, 5).fill(0xd0486e);
        g.ellipse(tx, ty, 8.5, 5).stroke({ width: 1.4, color: 0x5c1c30 });
        g.ellipse(tx, ty - 0.8, 6, 3.2).fill({ color: 0xf5f1e8, alpha: 0.85 });
      }
      // zil (sağ dış)
      g.moveTo(31, -8).lineTo(31, 12).stroke({ width: 1.4, color: 0x4a4258 });
      g.ellipse(31, -8, 9.5, 3).fill(0xd9b955);
      g.ellipse(31, -8, 9.5, 3).stroke({ width: 1, color: 0x8a7222 });
      g.ellipse(31, -8.6, 4, 1.2).fill({ color: 0xfde047, alpha: 0.6 });
      // hi-hat (sol dış)
      g.moveTo(-31, -6).lineTo(-31, 12).stroke({ width: 1.4, color: 0x4a4258 });
      g.ellipse(-31, -6, 7, 2.4).fill(0xd9b955);
      g.ellipse(-31, -3, 7, 2.4).fill(0xc9a945);
      break;
    case 'freekick_spot': {
      // frikik sahası: çim + kale + önünde baraj mankenleri + duran top
      g.roundRect(-52, -34, 104, 66, 10).fill(0x2c5c3a);
      g.roundRect(-52, -34, 104, 66, 10).stroke({ width: 2, color: 0x1c3d26 });
      for (let i = -40; i <= 28; i += 17) {
        g.rect(i, -32, 8, 62).fill({ color: 0x35704a, alpha: 0.5 });
      }
      // kale
      g.moveTo(-30, -34).lineTo(-30, -48).lineTo(30, -48).lineTo(30, -34).stroke({ width: 2.5, color: 0xe8e2d6 });
      for (let i = -26; i <= 26; i += 8) {
        g.moveTo(i, -47).lineTo(i, -35).stroke({ width: 0.8, color: 0xe8e2d6, alpha: 0.5 });
      }
      // baraj: yan yana duran mankenler
      for (let i = 0; i < 4; i++) {
        const bx = -14 + i * 9;
        g.ellipse(bx, -8, 3.5, 1.5).fill({ color: 0x0a0713, alpha: 0.3 });
        g.roundRect(bx - 3, -22, 6, 14, 2.5).fill(0x2a2140);
        g.roundRect(bx - 3, -22, 6, 14, 2.5).stroke({ width: 1, color: 0x171028 });
        g.circle(bx, -24.5, 2.6).fill(0x4a3a66);
        g.circle(bx, -24.5, 2.6).stroke({ width: 0.9, color: 0x171028 });
      }
      // duran top + falso yayı
      g.moveTo(-8, 18).bezierCurveTo(2, 10, 10, 0, 6, -8).stroke({ width: 1, color: 0xfde047, alpha: 0.45 });
      g.circle(-10, 20, 5).fill(0xffffff);
      g.circle(-10, 20, 5).stroke({ width: 1.2, color: 0x1c1730 });
      g.poly([-10, 16.5, -12.8, 19, -11.5, 22.5, -8.5, 22.5, -7.2, 19]).stroke({ width: 0.8, color: 0x1c1730, alpha: 0.7 });
      break;
    }
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

// Koltuk görselleri. Oyuncu avatarı koltuğun üstüne çizildiği için sandalye
// her durumda aynı çizilir; doluluk yalnızca "boş koltuk" parıltısıyla belli olur.
// side: sandalyenin masaya göre yönü (-1 sol, +1 sağ, 0 tek koltuk).
function drawSeat(g: Graphics, occupied: boolean, type?: ZoneType, side: -1 | 0 | 1 = 0): void {
  g.clear();

  if (type === 'bar_stool') {
    // tabure gövdesi drawBase'te; burada sadece boş koltuk parıltısı
    if (!occupied) {
      g.circle(0, -2, 2).fill({ color: SEAT_EMPTY, alpha: 0.9 });
      g.circle(0, -2, 4.5).fill({ color: SEAT_EMPTY, alpha: 0.15 });
    }
    return;
  }

  if (type === 'stage_guitar' || type === 'stage_drums') {
    // sahne taburesi: yuvarlak oturak + üç ayak
    g.ellipse(0, 12, 9, 3).fill({ color: 0x0a0713, alpha: 0.3 });
    g.moveTo(-5, 4).lineTo(-7, 12).stroke({ width: 1.5, color: 0x4a4258, cap: 'round' });
    g.moveTo(5, 4).lineTo(7, 12).stroke({ width: 1.5, color: 0x4a4258, cap: 'round' });
    g.moveTo(0, 4).lineTo(0, 12).stroke({ width: 1.5, color: 0x4a4258, cap: 'round' });
    g.ellipse(0, 2, 9, 5).fill(0x2a1d38);
    g.ellipse(0, 1, 9, 5).fill(0x4a3a66);
    g.ellipse(0, 1, 9, 5).stroke({ width: 1.2, color: 0x241335 });
    g.ellipse(-2.5, -0.5, 3.5, 1.6).fill({ color: 0xffffff, alpha: 0.12 });

    // Gitar standı koltuğun solunda: gitar yalnızca kimse çalmıyorken standda durur
    // (çalan oyuncunun elinde player.ts çiziyor).
    if (type === 'stage_guitar') {
      g.moveTo(-13, 8).lineTo(-9, 13).stroke({ width: 1.3, color: 0x4a4258 });
      g.moveTo(-9, 8).lineTo(-13, 13).stroke({ width: 1.3, color: 0x4a4258 });
      if (!occupied) {
        g.moveTo(-11, -14).lineTo(-11, 2).stroke({ width: 2.2, color: 0x8a5a2e });
        g.moveTo(-12.4, -17).lineTo(-9.6, -17).stroke({ width: 3.6, color: 0x5c3a1c, cap: 'round' });
        g.ellipse(-11, 5, 6, 7).fill(0xd94f3a);
        g.ellipse(-11, 5, 6, 7).stroke({ width: 1.3, color: 0x7a2418 });
        g.circle(-11, 6, 1.8).fill(0x2c1a0c);
        g.ellipse(-12.6, 2.5, 2, 1.6).fill({ color: 0xffffff, alpha: 0.25 });
      }
    }

    if (!occupied) {
      g.circle(0, 1, 1.8).fill({ color: SEAT_EMPTY, alpha: 0.85 });
      g.circle(0, 1, 4).fill({ color: SEAT_EMPTY, alpha: 0.14 });
    }
    return;
  }

  // Masa sandalyesi: sırtlık dışa, oturak masaya bakar.
  const accent = type ? RUG_COLORS[type] : SEAT_EMPTY;
  const backX = side * 8; // sırtlık dış kenarda; tek koltukta arkada

  g.ellipse(0, 10, 10, 3.5).fill({ color: 0x0a0713, alpha: 0.32 }); // gölge

  // arka bacaklar
  g.moveTo(backX * 0.7, 3).lineTo(backX * 0.85, 10).stroke({ width: 1.5, color: 0x33220f, cap: 'round' });
  // sırtlık: dikmeler + iki lata
  if (side === 0) {
    g.roundRect(-7, -13, 14, 4, 1.5).fill(0x7d6140).stroke({ width: 1, color: 0x33220f });
    g.roundRect(-7, -7, 14, 3, 1.2).fill(0x6b5236).stroke({ width: 0.9, color: 0x33220f });
    g.rect(-7, -13, 2.5, 10).fill(0x4a3a26);
    g.rect(4.5, -13, 2.5, 10).fill(0x4a3a26);
  } else {
    g.roundRect(backX - 2, -14, 4.5, 16, 1.5).fill(0x7d6140).stroke({ width: 1, color: 0x33220f });
    g.roundRect(backX - 2 - side * 3.5, -12, 4, 4, 1).fill({ color: accent, alpha: 0.4 });
  }

  // oturak: ahşap çerçeve + renkli minder
  g.roundRect(-8, -4, 16, 9, 3).fill(0x6b5236);
  g.roundRect(-8, -4, 16, 9, 3).stroke({ width: 1.3, color: 0x33220f });
  g.roundRect(-6.3, -2.8, 12.6, 6, 2).fill({ color: accent, alpha: 0.5 });
  g.roundRect(-6.3, -2.8, 12.6, 6, 2).stroke({ width: 0.8, color: accent, alpha: 0.7 });

  // ön bacaklar
  g.moveTo(-6, 5).lineTo(-7, 10).stroke({ width: 1.6, color: 0x33220f, cap: 'round' });
  g.moveTo(6, 5).lineTo(7, 10).stroke({ width: 1.6, color: 0x33220f, cap: 'round' });

  // boş koltuk: davetkâr parıltı
  if (!occupied) {
    g.circle(0, 0, 2).fill({ color: SEAT_EMPTY, alpha: 0.9 });
    g.circle(0, 0, 5).fill({ color: SEAT_EMPTY, alpha: 0.15 });
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

// Koltuğun zone merkezine göre yatay konumu ve masaya bakış yönü.
function seatOffsetX(zone: PublicZone, idx: number): number {
  if (zone.occupiedSlots.length === 1) return 0;
  return idx === 0 ? -ZONE_SLOT_OFFSET_X : ZONE_SLOT_OFFSET_X;
}

function seatSide(zone: PublicZone, idx: number): -1 | 0 | 1 {
  if (zone.occupiedSlots.length === 1) return 0;
  return idx === 0 ? -1 : 1;
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

    // koltuklar: tek koltuklu zonlarda merkezde, iki koltuklularda ±offset
    const seats: Graphics[] = zone.occupiedSlots.map((occupant, idx) => {
      const seat = new Graphics();
      seat.x = seatOffsetX(zone, idx);
      drawSeat(seat, Boolean(occupant), zone.type, seatSide(zone, idx));
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
  v.seats.forEach((seat, idx) => drawSeat(seat, Boolean(zone.occupiedSlots[idx]), zone.type, seatSide(zone, idx)));
}
