import { Container, Graphics, Text } from 'pixi.js';
import { MAP_WIDTH, MAP_HEIGHT } from '../config.js';

function drawBarCounter(worldContainer: Container): void {
  const g = new Graphics();
  const x1 = 300;
  const x2 = 900;
  const y = 55;

  // arka raf + şişe siluetleri
  g.roundRect(x1 - 10, y - 34, x2 - x1 + 20, 16, 4).fill(0x1c1730);
  for (let x = x1 + 10; x < x2 - 10; x += 22) {
    const h = 10 + ((x / 22) % 3) * 3;
    g.roundRect(x, y - 34 - h, 6, h, 1.5).fill(0x3d2a5c);
    // şişelerde hafif neon yansıması
    g.roundRect(x + 1, y - 34 - h, 1.5, h, 0.7).fill({ color: 0x7dd3fc, alpha: 0.25 });
  }

  // tezgah gövdesi
  g.roundRect(x1, y - 14, x2 - x1, 28, 6).fill(0x4a3320);
  g.roundRect(x1, y - 14, x2 - x1, 28, 6).stroke({ width: 2, color: 0x2c1d10 });
  g.roundRect(x1, y - 14, x2 - x1, 8, 6).fill({ color: 0x6f4c2e, alpha: 0.8 });

  worldContainer.addChild(g);
}

// Duvarda parlayan "PİKSEL BAR" neon tabelası (sol üst köşe bölgesi).
function drawNeonSign(worldContainer: Container): void {
  const sign = new Container();
  sign.x = 150;
  sign.y = 38;

  const backboard = new Graphics();
  backboard.roundRect(-92, -24, 184, 48, 10).fill({ color: 0x0d0a18, alpha: 0.85 });
  backboard.roundRect(-92, -24, 184, 48, 10).stroke({ width: 1.5, color: 0x2a2244 });
  // yazının arkasında yumuşak neon parıltısı (sol cyan, sağ pembe)
  backboard.ellipse(-42, 0, 48, 16).fill({ color: 0x38bdf8, alpha: 0.12 });
  backboard.ellipse(46, 0, 38, 16).fill({ color: 0xf472b6, alpha: 0.12 });
  sign.addChild(backboard);

  const pixel = new Text({
    text: 'PİKSEL',
    style: { fill: 0x7dd3fc, fontSize: 20, fontFamily: 'monospace', fontWeight: 'bold', letterSpacing: 2 },
  });
  pixel.anchor.set(1, 0.5);
  pixel.x = 8;
  sign.addChild(pixel);

  const bar = new Text({
    text: ' BAR',
    style: { fill: 0xf9a8d4, fontSize: 20, fontFamily: 'monospace', fontWeight: 'bold', letterSpacing: 2 },
  });
  bar.anchor.set(0, 0.5);
  bar.x = 8;
  sign.addChild(bar);

  worldContainer.addChild(sign);
}

function drawPendantLights(worldContainer: Container): void {
  const positions = [340, 460, 580, 700, 820];
  for (const x of positions) {
    const g = new Graphics();
    // zemine düşen sıcak ışık havuzu (daha belirgin)
    g.ellipse(x, 96, 52, 18).fill({ color: 0xffcf7a, alpha: 0.09 });
    g.ellipse(x, 96, 32, 11).fill({ color: 0xffcf7a, alpha: 0.11 });
    // sarkıt
    g.moveTo(x, 0).lineTo(x, 18).stroke({ width: 1.5, color: 0x2c2440 });
    g.circle(x, 24, 10).fill({ color: 0xffcf7a, alpha: 0.22 });
    g.circle(x, 24, 6).fill({ color: 0xffcf7a, alpha: 0.6 });
    g.circle(x, 24, 3).fill(0xffe4a8);
    worldContainer.addChild(g);
  }
}

// ---- Renkli ampul zincirleri: haritanın üstünde iki sarkık ışık dizisi ----
const BULB_COLORS = [0xff6b6b, 0xfbbf24, 0x4ade80, 0x38bdf8, 0xf472b6];

export interface StringLights {
  container: Container;
  bulbs: { g: Graphics; phase: number; color: number }[];
}

function makeSwag(lights: StringLights, x1: number, x2: number, anchorY: number, sag: number): void {
  const wire = new Graphics();
  const steps = 24;
  wire.moveTo(x1, anchorY);
  for (let s = 1; s <= steps; s++) {
    const t = s / steps;
    wire.lineTo(x1 + (x2 - x1) * t, anchorY + Math.sin(t * Math.PI) * sag);
  }
  wire.stroke({ width: 1.4, color: 0x241b3a });
  lights.container.addChild(wire);

  const bulbCount = Math.floor((x2 - x1) / 42);
  for (let i = 1; i <= bulbCount; i++) {
    const t = i / (bulbCount + 1);
    const bx = x1 + (x2 - x1) * t;
    const by = anchorY + Math.sin(t * Math.PI) * sag + 4;
    const color = BULB_COLORS[(i + Math.round(x1)) % BULB_COLORS.length];
    const g = new Graphics();
    g.circle(0, 0, 7).fill({ color, alpha: 0.16 }); // glow
    g.circle(0, 0, 3.2).fill(color);
    g.circle(-1, -1, 1).fill({ color: 0xffffff, alpha: 0.7 });
    g.x = bx;
    g.y = by;
    lights.container.addChild(g);
    lights.bulbs.push({ g, phase: Math.random() * Math.PI * 2, color });
  }
}

export function createStringLights(worldContainer: Container): StringLights {
  const lights: StringLights = { container: new Container(), bulbs: [] };
  // bar tezgahının iki yanına ve üstüne üç sarkık dizi
  makeSwag(lights, 30, 280, 10, 26);
  makeSwag(lights, 300, 900, 6, 30);
  makeSwag(lights, 920, 1170, 10, 26);
  worldContainer.addChild(lights.container);
  return lights;
}

export function tickStringLights(lights: StringLights, now: number): void {
  for (const b of lights.bulbs) {
    b.g.alpha = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(now * 0.0035 + b.phase));
  }
}

function drawDartBoard(worldContainer: Container, x: number, y: number): void {
  const g = new Graphics();
  g.circle(x, y, 22).fill(0x2c1d10);
  g.circle(x, y, 19).fill(0x1c1730);
  const ringColors = [0x3a2f4a, 0xd97a3f, 0x3a2f4a, 0xf5c451];
  ringColors.forEach((color, i) => {
    g.circle(x, y, 16 - i * 4).fill(color);
  });
  g.circle(x, y, 2.5).fill(0xef4444);
  // dartlar
  g.moveTo(x + 6, y - 4).lineTo(x + 14, y - 12).stroke({ width: 1.5, color: 0xcbd5e1 });
  g.moveTo(x - 3, y + 5).lineTo(x - 9, y + 13).stroke({ width: 1.5, color: 0xcbd5e1 });
  worldContainer.addChild(g);
}

// Müzik kutusunun dünya konumu; main tarafı E-etkileşimi yakınlığında kullanır.
export const JUKEBOX_POS = { x: 70, y: 310 };
export const JUKEBOX_INTERACT_RADIUS = 80;

// Şarkı çalarken müzik kutusunun etrafında nabız gibi atan neon halka.
export function createJukeboxGlow(worldContainer: Container): Graphics {
  const g = new Graphics();
  g.visible = false;
  worldContainer.addChild(g);
  return g;
}

export function tickJukeboxGlow(g: Graphics, now: number, playing: boolean): void {
  if (!playing) {
    g.visible = false;
    return;
  }
  g.visible = true;
  const pulse = (Math.sin(now * 0.004) + 1) / 2;
  g.clear();
  g.circle(JUKEBOX_POS.x, JUKEBOX_POS.y - 4, 36 + pulse * 5).stroke({ width: 2, color: 0xf472b6, alpha: 0.22 + pulse * 0.28 });
  g.circle(JUKEBOX_POS.x, JUKEBOX_POS.y - 4, 47 + pulse * 7).stroke({ width: 1.2, color: 0x38bdf8, alpha: 0.12 + pulse * 0.2 });
}

function drawJukebox(worldContainer: Container, x: number, y: number): void {
  const g = new Graphics();
  g.ellipse(x, y + 30, 26, 8).fill({ color: 0x0a0713, alpha: 0.35 });
  // gövde
  g.roundRect(x - 22, y - 28, 44, 58, 10).fill(0x3a1d4a);
  g.roundRect(x - 22, y - 28, 44, 58, 10).stroke({ width: 2, color: 0x241030 });
  // kemer üst pencere
  g.roundRect(x - 16, y - 22, 32, 18, 8).fill({ color: 0xfbbf24, alpha: 0.35 });
  g.roundRect(x - 16, y - 22, 32, 18, 8).stroke({ width: 1.2, color: 0xfbbf24, alpha: 0.6 });
  // ızgara
  g.roundRect(x - 14, y + 2, 28, 20, 4).fill(0x1c1030);
  for (let i = -10; i <= 10; i += 5) {
    g.moveTo(x + i, y + 4).lineTo(x + i, y + 20).stroke({ width: 1, color: 0x4c3a6e, alpha: 0.7 });
  }
  // neon şeritler
  g.roundRect(x - 22, y - 28, 4, 58, 2).fill({ color: 0xf472b6, alpha: 0.5 });
  g.roundRect(x + 18, y - 28, 4, 58, 2).fill({ color: 0x38bdf8, alpha: 0.5 });
  // nota
  const note = new Text({ text: '♪', style: { fill: 0xfbbf24, fontSize: 14, fontFamily: 'system-ui' } });
  note.anchor.set(0.5, 0.5);
  note.x = x + 30;
  note.y = y - 34;
  note.alpha = 0.85;
  worldContainer.addChild(g);
  worldContainer.addChild(note);
}

// ---- Disko dans pisti: renk döngülü karolar + disko topu ----
// Sahnenin (y 165-250) tam önünde; backend zones.ts yerleşimiyle uyumlu.
const FLOOR_CX = 600;
const FLOOR_CY = 420;
const TILE = 34;
const TILES_X = 8;
const TILES_Y = 5;
const TILE_COLORS = [0x38bdf8, 0xf472b6, 0xfbbf24, 0x8b5cf6];

// main tarafı dansçı sayarken kullanır: pist sınırları (hafif payla)
export const DANCE_FLOOR_BOUNDS = { x: FLOOR_CX, y: FLOOR_CY, halfW: (TILES_X * TILE) / 2 + 24, halfH: (TILES_Y * TILE) / 2 + 24 };

interface FloorConfetti {
  g: Graphics;
  vx: number;
  vy: number;
  spin: number;
}

export interface DanceFloor {
  container: Container;
  tiles: Graphics[];
  sparkles: Graphics[];
  ball: Graphics;
  lastStep: number;
  confetti: FloorConfetti[];
}

export function createDanceFloor(worldContainer: Container): DanceFloor {
  const container = new Container();
  const w = TILES_X * TILE;
  const h = TILES_Y * TILE;
  const left = FLOOR_CX - w / 2;
  const top = FLOOR_CY - h / 2;

  // zemin + çift neon çerçeve (dış cyan, iç pembe) ve köşe ışıkları
  const border = new Graphics();
  border.roundRect(left - 10, top - 10, w + 20, h + 20, 12).fill({ color: 0x0d0a18, alpha: 0.6 });
  border.roundRect(left - 10, top - 10, w + 20, h + 20, 12).stroke({ width: 2.5, color: 0x38bdf8, alpha: 0.6 });
  border.roundRect(left - 5, top - 5, w + 10, h + 10, 9).stroke({ width: 1.5, color: 0xf472b6, alpha: 0.5 });
  for (const [cx, cy] of [[left - 10, top - 10], [left + w + 10, top - 10], [left - 10, top + h + 10], [left + w + 10, top + h + 10]]) {
    border.circle(cx, cy, 3).fill({ color: 0xfbbf24, alpha: 0.55 });
    border.circle(cx, cy, 6).fill({ color: 0xfbbf24, alpha: 0.12 });
  }
  container.addChild(border);

  const tiles: Graphics[] = [];
  for (let ty = 0; ty < TILES_Y; ty++) {
    for (let tx = 0; tx < TILES_X; tx++) {
      const t = new Graphics();
      t.roundRect(left + tx * TILE + 1.5, top + ty * TILE + 1.5, TILE - 3, TILE - 3, 4).fill(0xffffff);
      t.tint = TILE_COLORS[(tx + ty) % TILE_COLORS.length];
      t.alpha = 0.14;
      container.addChild(t);
      tiles.push(t);
    }
  }

  // pistin üstünde asılı disko topu + zemine vuran ışık huzmeleri
  const ball = new Graphics();
  ball.moveTo(0, -14).lineTo(0, -6).stroke({ width: 1.4, color: 0x2c2440 });
  // huzmeler (topun altından pistin içine)
  ball.poly([-3, 8, 3, 8, 26, 66, -32, 62]).fill({ color: 0xf9a8d4, alpha: 0.09 });
  ball.poly([-3, 8, 3, 8, 44, 58, 10, 64]).fill({ color: 0x7dd3fc, alpha: 0.09 });
  ball.circle(0, 2, 11).fill(0xcbd5e1);
  ball.circle(-3.5, -1.5, 2.8).fill({ color: 0xffffff, alpha: 0.9 });
  for (let i = -8; i <= 8; i += 4) {
    const half = Math.sqrt(Math.max(0, 121 - i * i));
    ball.moveTo(i, 2 - half).lineTo(i, 2 + half).stroke({ width: 0.8, color: 0x64748b, alpha: 0.7 });
  }
  for (let j = -6; j <= 6; j += 6) {
    ball.moveTo(-Math.sqrt(121 - j * j), 2 + j).lineTo(Math.sqrt(121 - j * j), 2 + j).stroke({ width: 0.8, color: 0x64748b, alpha: 0.5 });
  }
  ball.x = FLOOR_CX;
  ball.y = top - 8;
  container.addChild(ball);

  // pistte dönen ışık benekleri
  const sparkles: Graphics[] = [];
  for (let i = 0; i < 9; i++) {
    const s = new Graphics();
    s.circle(0, 0, i % 3 === 0 ? 3.5 : 2.4).fill({ color: i % 2 === 0 ? 0xffffff : 0xf9a8d4, alpha: 1 });
    s.alpha = 0.18;
    container.addChild(s);
    sparkles.push(s);
  }

  worldContainer.addChild(container);
  return { container, tiles, sparkles, ball, lastStep: -1, confetti: [] };
}

// party: pistte 2+ kişi dans ediyorsa ışıklar coşar ve konfeti yağar.
export function tickDanceFloor(floor: DanceFloor, now: number, dtMs: number, party = false): void {
  const stepMs = party ? 260 : 520; // partide renkler iki kat hızlı döner
  const step = Math.floor(now / stepMs);
  if (step !== floor.lastStep) {
    floor.lastStep = step;
    floor.tiles.forEach((t, i) => {
      const tx = i % TILES_X;
      const ty = Math.floor(i / TILES_X);
      t.tint = TILE_COLORS[(tx + ty + step) % TILE_COLORS.length];
    });
  }
  // karo parlaklığı dalga gibi yayılır (kesintisiz, adımsız)
  const base = party ? 0.34 : 0.2;
  const wave = party ? 0.22 : 0.15;
  floor.tiles.forEach((t, i) => {
    const tx = i % TILES_X;
    const ty = Math.floor(i / TILES_X);
    t.alpha = base + wave * (0.5 + 0.5 * Math.sin(now * (party ? 0.005 : 0.0025) + tx * 0.7 + ty * 0.9));
  });
  floor.sparkles.forEach((s, i) => {
    const ang = now * (0.0007 + (i % 3) * 0.0003) * (party ? 2 : 1) + (i / floor.sparkles.length) * Math.PI * 2;
    s.x = FLOOR_CX + Math.cos(ang) * (95 - (i % 3) * 22);
    s.y = FLOOR_CY + Math.sin(ang) * (58 - (i % 3) * 14);
    s.alpha = (party ? 0.2 : 0.08) + 0.16 * (0.5 + 0.5 * Math.sin(now * 0.004 + i * 2));
  });
  floor.ball.rotation = Math.sin(now * (party ? 0.003 : 0.0012)) * 0.15;

  // konfeti: partide pistin üstünden süzülür
  if (party && floor.confetti.length < 36 && Math.random() < dtMs * 0.02) {
    const g = new Graphics();
    const colors = [0x38bdf8, 0xf472b6, 0xfbbf24, 0x4ade80];
    g.rect(-2, -1.2, 4, 2.4).fill(colors[Math.floor(Math.random() * colors.length)]);
    g.x = FLOOR_CX + (Math.random() - 0.5) * TILES_X * TILE;
    g.y = FLOOR_CY - (TILES_Y * TILE) / 2 - 20;
    floor.container.addChild(g);
    floor.confetti.push({ g, vx: (Math.random() - 0.5) * 0.03, vy: 0.04 + Math.random() * 0.03, spin: (Math.random() - 0.5) * 0.01 });
  }
  for (let i = floor.confetti.length - 1; i >= 0; i--) {
    const c = floor.confetti[i];
    c.g.x += c.vx * dtMs + Math.sin(now * 0.004 + i) * 0.4;
    c.g.y += c.vy * dtMs;
    c.g.rotation += c.spin * dtMs;
    if (c.g.y > FLOOR_CY + (TILES_Y * TILE) / 2 + 6) {
      floor.container.removeChild(c.g);
      c.g.destroy();
      floor.confetti.splice(i, 1);
    }
  }
}

// ---- Yürüme tozu: ayak dibinde beliren, kısa sürede solan minik halkalar ----
interface DustPuff {
  g: Graphics;
  bornAt: number;
}

export interface DustLayer {
  container: Container;
  puffs: DustPuff[];
}

const DUST_LIFETIME_MS = 420;

export function createDustLayer(worldContainer: Container): DustLayer {
  const container = new Container();
  worldContainer.addChild(container);
  return { container, puffs: [] };
}

export function spawnDust(layer: DustLayer, x: number, y: number): void {
  if (layer.puffs.length > 40) return; // taşma koruması
  const g = new Graphics();
  g.circle(0, 0, 2.2).stroke({ width: 1.1, color: 0xb8a8d8, alpha: 1 });
  g.x = x + (Math.random() - 0.5) * 6;
  g.y = y + 8;
  layer.container.addChild(g);
  layer.puffs.push({ g, bornAt: performance.now() });
}

export function tickDust(layer: DustLayer, now: number): void {
  for (let i = layer.puffs.length - 1; i >= 0; i--) {
    const p = layer.puffs[i];
    const t = (now - p.bornAt) / DUST_LIFETIME_MS;
    if (t >= 1) {
      layer.container.removeChild(p.g);
      p.g.destroy();
      layer.puffs.splice(i, 1);
      continue;
    }
    p.g.alpha = 0.5 * (1 - t);
    p.g.scale.set(1 + t * 1.6);
    p.g.y -= 0.2;
  }
}

interface Particle {
  g: Graphics;
  vx: number;
  vy: number;
  baseAlpha: number;
  phase: number;
}

export interface AmbientParticles {
  container: Container;
  particles: Particle[];
}

// Barda süzülen toz/ışık zerreleri; main döngüsünde tickAmbientParticles ile oynatılır.
export function createAmbientParticles(worldContainer: Container, count = 26): AmbientParticles {
  const container = new Container();
  const particles: Particle[] = [];
  const colors = [0xffcf7a, 0x7dd3fc, 0xf9a8d4];
  for (let i = 0; i < count; i++) {
    const g = new Graphics();
    const r = 1 + Math.random() * 1.8;
    const color = colors[i % colors.length];
    g.circle(0, 0, r).fill({ color, alpha: 1 });
    g.x = Math.random() * MAP_WIDTH;
    g.y = Math.random() * MAP_HEIGHT;
    const baseAlpha = 0.12 + Math.random() * 0.2;
    g.alpha = baseAlpha;
    container.addChild(g);
    particles.push({
      g,
      vx: (Math.random() - 0.5) * 0.012,
      vy: -0.006 - Math.random() * 0.012,
      baseAlpha,
      phase: Math.random() * Math.PI * 2,
    });
  }
  worldContainer.addChild(container);
  return { container, particles };
}

export function tickAmbientParticles(ambient: AmbientParticles, dtMs: number, now: number): void {
  for (const p of ambient.particles) {
    p.g.x += p.vx * dtMs;
    p.g.y += p.vy * dtMs;
    p.g.alpha = p.baseAlpha * (0.6 + 0.4 * Math.sin(now * 0.001 + p.phase));
    if (p.g.y < -6) {
      p.g.y = MAP_HEIGHT + 4;
      p.g.x = Math.random() * MAP_WIDTH;
    }
    if (p.g.x < -6) p.g.x = MAP_WIDTH + 4;
    if (p.g.x > MAP_WIDTH + 6) p.g.x = -4;
  }
}

// ---- Barmen NPC: tezgahın arkasında volta atar, bardak parlatır ----
export interface Bartender {
  container: Container;
  body: Graphics;
  phase: number;
  serveX: number | null; // servis hedefi (tabure x'i)
  serveUntil: number | null;
  quipBg: Graphics;
  quipText: Text;
  quipUntil: number | null;
}

// Barmenin replikleri sunucudan gelir ('bartender' mesajı) ki salondaki
// herkes aynı anda aynı sözü görsün.

export function createBartender(worldContainer: Container): Bartender {
  const container = new Container();
  container.y = 34; // tezgahın arkası (tezgah gövdesi y≈41-69)
  const body = new Graphics();
  container.addChild(body);

  const quipBg = new Graphics();
  const quipText = new Text({
    text: '',
    style: { fill: 0x1c1730, fontSize: 11, fontFamily: 'Inter Variable, system-ui, sans-serif', wordWrap: true, wordWrapWidth: 150, align: 'center' },
  });
  quipText.anchor.set(0.5, 0.5);
  quipBg.visible = false;
  quipText.visible = false;
  container.addChild(quipBg);
  container.addChild(quipText);

  worldContainer.addChild(container);
  const bartender: Bartender = {
    container,
    body,
    phase: Math.random() * 10,
    serveX: null,
    serveUntil: null,
    quipBg,
    quipText,
    quipUntil: null,
  };
  drawBartender(bartender, 0);
  return bartender;
}

export function bartenderSay(b: Bartender, text: string, now: number): void {
  b.quipText.text = text;
  const w = Math.min(b.quipText.width, 150) + 16;
  const h = b.quipText.height + 12;
  // Barmen haritanın üst kenarına yakın durduğu için baloncuk yukarıda ekran
  // dışında kalıyordu; tezgahın önüne (aşağı) çizilir, kuyruğu yukarı bakar.
  const top = 26;
  b.quipText.x = 0;
  b.quipText.y = top + h / 2;
  b.quipBg.clear();
  b.quipBg.roundRect(-w / 2, top, w, h, 8).fill({ color: 0xfdf6e3, alpha: 0.96 }).stroke({ width: 1.2, color: 0x1c1730, alpha: 0.35 });
  b.quipBg.moveTo(-4, top).lineTo(4, top).lineTo(0, top - 6).fill({ color: 0xfdf6e3, alpha: 0.96 });
  b.quipBg.visible = true;
  b.quipText.visible = true;
  b.quipUntil = now + 3800;
}

function drawBartender(b: Bartender, now: number): void {
  const g = b.body;
  g.clear();
  const bob = Math.sin(now * 0.003 + b.phase) * 0.8;

  // gövde: beyaz gömlek + bordo önlük
  g.roundRect(-8, -8 + bob, 16, 16, 6).fill(0xe8e2d6).stroke({ width: 1.6, color: 0x1c1730 });
  g.roundRect(-8, -2 + bob, 16, 10, 4).fill(0x7a2740);
  // baş
  g.circle(0, -15 + bob, 8).fill(0xd9b38c).stroke({ width: 1.6, color: 0x1c1730 });
  // saç + bıyık
  g.moveTo(-7, -18 + bob).arc(0, -16 + bob, 7.6, Math.PI * 1.05, Math.PI * 1.95).fill(0x2c1d10);
  g.moveTo(-3, -12 + bob).lineTo(3, -12 + bob).stroke({ width: 1.6, color: 0x2c1d10, cap: 'round' });
  // gözler
  g.circle(-2.6, -15.5 + bob, 1).fill(0x1c1730);
  g.circle(2.6, -15.5 + bob, 1).fill(0x1c1730);
  // papyon
  g.poly([-3, -7 + bob, 0, -5.5 + bob, -3, -4 + bob]).fill(0xf472b6);
  g.poly([3, -7 + bob, 0, -5.5 + bob, 3, -4 + bob]).fill(0xf472b6);

  // bardak parlatma: sağ el dairesel hareketle bardağın üstünde
  const wipe = now * 0.006 + b.phase;
  const hx = 10 + Math.cos(wipe) * 1.8;
  const hy = -4 + bob + Math.sin(wipe) * 1.8;
  g.moveTo(6, -4 + bob).lineTo(hx, hy).stroke({ width: 2.6, color: 0xe8e2d6, cap: 'round' });
  g.moveTo(-6, -4 + bob).lineTo(-10, 0 + bob).stroke({ width: 2.6, color: 0xe8e2d6, cap: 'round' });
  // bardak
  g.roundRect(8.5, -2 + bob, 5, 6.5, 1).fill({ color: 0xd9f3ff, alpha: 0.55 }).stroke({ width: 1, color: 0xbfe9ff, alpha: 0.9 });
  // parlama yıldızı
  const tw = (Math.sin(now * 0.008 + b.phase) + 1) / 2;
  g.circle(14.5, -5 + bob, 1 + tw).fill({ color: 0xffffff, alpha: 0.25 + tw * 0.4 });
}

// Bir bar taburesine oturan olunca barmen oraya gidip içki servis eder.
// Repliği sunucu ayrıca 'bartender' mesajıyla herkese yollar.
export function bartenderServe(b: Bartender, stoolX: number, now: number): void {
  b.serveX = Math.max(320, Math.min(880, stoolX));
  b.serveUntil = now + 3200;
}

export function tickBartender(b: Bartender, now: number): void {
  if (b.serveUntil !== null && now >= b.serveUntil) {
    b.serveUntil = null;
    b.serveX = null;
  }

  // konuşma baloncuğu süresi doldu mu?
  if (b.quipUntil !== null && now >= b.quipUntil) {
    b.quipUntil = null;
    b.quipBg.visible = false;
    b.quipText.visible = false;
  }

  // hedef: servis noktası ya da tezgah boyunca volta; ani sıçrama olmasın diye yumuşak takip
  const desired = b.serveX ?? 600 + Math.sin(now * 0.00022 + b.phase) * 220;
  b.container.x += (desired - b.container.x) * 0.045;

  drawBartender(b, now);

  // servis: hedefe varınca tezgaha içki koyar
  if (b.serveX !== null && Math.abs(b.container.x - b.serveX) < 10) {
    const g = b.body;
    const t = (b.serveUntil ?? now) - now; // kalan süre
    const slide = Math.max(0, Math.min(1, 1 - t / 2800));
    // tezgah üzerinde kayarak öne gelen içki
    g.roundRect(-2.5, 16 + slide * 6, 5, 7, 1).fill({ color: 0xffd9ec, alpha: 0.85 }).stroke({ width: 1, color: 0xf472b6 });
    g.rect(-2.1, 18 + slide * 6, 4.2, 4.5).fill({ color: 0xf472b6, alpha: 0.85 });
    g.moveTo(0, 16 + slide * 6).lineTo(2, 12 + slide * 6).stroke({ width: 1, color: 0xfbbf24 });
    // konuşma benzeri küçük kalp/yıldız
    g.circle(8, 4, 1.4).fill({ color: 0xfbbf24, alpha: 0.7 });
  }
}

// ---- Sahne platformu: gitar ve bateri koltuklarının üzerinde durduğu ortak podyum ----
// Koltuklar (zones.ts: stage-guitar 540, stage-drums 660 @ y=208) bunun üstüne çizilir.
const STAGE = { x1: 470, x2: 730, y1: 165, y2: 250 };

function drawStage(worldContainer: Container): void {
  const g = new Graphics();
  const { x1, x2, y1, y2 } = STAGE;
  const w = x2 - x1;

  // arka perde: koyu kadife + kıvrımlar
  g.roundRect(x1 - 6, y1 - 30, w + 12, 40, 4).fill(0x2a1038);
  for (let x = x1; x < x2; x += 16) {
    g.moveTo(x, y1 - 30).lineTo(x, y1 + 8).stroke({ width: 1, color: 0x1a0a24, alpha: 0.5 });
  }

  // podyum gövdesi (öne doğru hafif perspektif: alt kenar daha geniş)
  g.poly([x1, y1, x2, y1, x2 + 8, y2, x1 - 8, y2]).fill(0x3a2450);
  g.poly([x1, y1, x2, y1, x2 + 8, y2, x1 - 8, y2]).stroke({ width: 2, color: 0x241335 });
  // üst yüzey parlaklığı
  g.poly([x1 + 4, y1 + 3, x2 - 4, y1 + 3, x2 - 2, y1 + 14, x1 + 2, y1 + 14]).fill({ color: 0x4a2f66, alpha: 0.7 });
  // ön kenar şeridi (sahne ışığı bandı)
  g.roundRect(x1 - 8, y2 - 6, w + 16, 6, 3).fill(0x241335);
  for (let x = x1; x <= x2; x += 26) {
    g.circle(x, y2 - 3, 2).fill({ color: 0xfbbf24, alpha: 0.75 });
    g.circle(x, y2 - 3, 4.5).fill({ color: 0xfbbf24, alpha: 0.12 });
  }

  // sahne spotları: podyuma düşen iki renkli ışık konisi
  g.poly([x1 + 60, y1 - 26, x1 + 30, y2 - 4, x1 + 110, y2 - 4]).fill({ color: 0xf472b6, alpha: 0.07 });
  g.poly([x2 - 60, y1 - 26, x2 - 110, y2 - 4, x2 - 30, y2 - 4]).fill({ color: 0x38bdf8, alpha: 0.07 });

  // yan hoparlör kuleleri
  for (const sx of [x1 - 26, x2 + 26]) {
    g.roundRect(sx - 11, y1 - 6, 22, 54, 3).fill(0x1c1226);
    g.roundRect(sx - 11, y1 - 6, 22, 54, 3).stroke({ width: 1.5, color: 0x0f0a16 });
    g.circle(sx, y1 + 10, 7).fill(0x2a1d38);
    g.circle(sx, y1 + 10, 7).stroke({ width: 1.2, color: 0x7a5588, alpha: 0.8 });
    g.circle(sx, y1 + 10, 2.5).fill({ color: 0xf472b6, alpha: 0.6 });
    g.circle(sx, y1 + 32, 5).fill(0x2a1d38);
    g.circle(sx, y1 + 32, 5).stroke({ width: 1, color: 0x7a5588, alpha: 0.6 });
  }

  worldContainer.addChild(g);

  // "SAHNE" tabelası, perdenin üstünde
  const sign = new Text({
    text: 'SAHNE',
    style: { fill: 0xf9a8d4, fontSize: 9, fontFamily: 'monospace', fontWeight: 'bold', letterSpacing: 3 },
  });
  sign.anchor.set(0.5, 0.5);
  sign.x = (x1 + x2) / 2;
  sign.y = y1 - 22;
  sign.alpha = 0.85;
  worldContainer.addChild(sign);
}

export function createDecor(worldContainer: Container): void {
  drawBarCounter(worldContainer);
  drawNeonSign(worldContainer);
  drawPendantLights(worldContainer);
  drawStage(worldContainer);

  drawDartBoard(worldContainer, 1040, 50);
  drawJukebox(worldContainer, JUKEBOX_POS.x, JUKEBOX_POS.y);
}
