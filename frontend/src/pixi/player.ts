import { Container, Graphics, Text } from 'pixi.js';
import type { Facing } from '../protocol.js';
import { AVATAR_PALETTE } from '../config.js';

const OUTLINE_COLOR = 0x1c1730;
const BUBBLE_DURATION_MS = 4500;

// Her emote bir karakter animasyonu oynatır (emoji baloncuğu yok).
const ACTION_DURATIONS: Record<string, number> = {
  '👋': 1800,
  '😂': 1800,
  '❤️': 1800,
  '🎉': 2100,
  '😮': 1400,
  '🕺': 2800,
  punch: 450, // yumruk savurma (emote değil, F ile tetiklenir)
};

export type Instrument = 'guitar' | 'drums';

const CONFETTI_COLORS = [0x38bdf8, 0xf472b6, 0xfbbf24, 0x4ade80, 0xb39ddb];

export interface PlayerVisual {
  container: Container;
  shadow: Graphics;
  body: Graphics;
  fx: Graphics; // isim etiketinin de üstünde çizilen efektler (kalp, konfeti)
  nameTagBg: Graphics;
  label: Text;
  speechBubble: Container;
  speechBubbleBg: Graphics;
  speechBubbleText: Text;
  bubbleHideAt: number | null;
  actionEmote: string | null;
  actionStartedAt: number | null;
  lastPuffAt: number;
  walkPhase: number;
  idlePhase: number;
  renderX: number;
  renderY: number;
  isSelf: boolean;
  facing: Facing;
  sitting: boolean;
  instrument: Instrument | null; // sahne koltuğunda çalınan enstrüman
  knockedUntil: number | null; // yumruk yiyen karakter bu ana kadar yerde yatar
  color: number;
  hat: number;
}

export function createPlayerVisual(name: string, colorIdx: number, hat: number, x: number, y: number, isSelf: boolean): PlayerVisual {
  const container = new Container();
  container.x = x;
  container.y = y;

  const color = AVATAR_PALETTE[colorIdx] ?? AVATAR_PALETTE[0];

  const shadow = new Graphics();
  shadow.ellipse(0, 8, 14, 5).fill({ color: 0x05030c, alpha: 0.45 });
  container.addChild(shadow);

  const body = new Graphics();
  container.addChild(body);

  const label = new Text({
    text: name,
    style: { fill: 0xf1f0f6, fontSize: 11, fontFamily: 'Inter Variable, system-ui, sans-serif', fontWeight: '600' },
  });
  label.anchor.set(0.5, 0.5);

  const nameTagBg = new Graphics();
  const tagY = -57; // şapkalara yer açmak için biraz yukarıda
  const padX = 7;
  const padY = 3;
  nameTagBg
    .roundRect(-label.width / 2 - padX, tagY - label.height / 2 - padY, label.width + padX * 2, label.height + padY * 2, 8)
    .fill({ color: 0x120f1e, alpha: 0.72 })
    .stroke({ width: 1, color: isSelf ? color : 0x3a3455, alpha: 0.9 });
  label.x = 0;
  label.y = tagY;
  container.addChild(nameTagBg);
  container.addChild(label);

  const speechBubble = new Container();
  speechBubble.visible = false;
  const speechBubbleBg = new Graphics();
  const speechBubbleText = new Text({
    text: '',
    style: {
      fill: 0x1c1730,
      fontSize: 12,
      fontFamily: 'system-ui, sans-serif',
      wordWrap: true,
      wordWrapWidth: 150,
      align: 'center',
    },
  });
  speechBubbleText.anchor.set(0.5, 0.5);
  speechBubble.addChild(speechBubbleBg);
  speechBubble.addChild(speechBubbleText);
  container.addChild(speechBubble);

  const fx = new Graphics();
  container.addChild(fx); // en üstte: isim etiketini de örtebilir

  const visual: PlayerVisual = {
    container,
    shadow,
    body,
    fx,
    nameTagBg,
    label,
    speechBubble,
    speechBubbleBg,
    speechBubbleText,
    bubbleHideAt: null,
    actionEmote: null,
    actionStartedAt: null,
    lastPuffAt: 0,
    walkPhase: 0,
    idlePhase: Math.random() * Math.PI * 2,
    renderX: x,
    renderY: y,
    isSelf,
    facing: 'down',
    sitting: false,
    instrument: null,
    knockedUntil: null,
    color,
    hat,
  };
  drawCharacter(visual, false);
  return visual;
}

// Emote'u karakter animasyonu olarak başlatır (el sallama, gülme, dans...).
export function playEmote(v: PlayerVisual, emote: string): void {
  if (emote === '🕺' && v.sitting) return; // otururken dans edilmez
  v.actionEmote = emote;
  v.actionStartedAt = performance.now();
}

export function tickEmote(v: PlayerVisual, now: number): void {
  if (v.knockedUntil !== null && now >= v.knockedUntil) v.knockedUntil = null;
  if (v.actionStartedAt === null || v.actionEmote === null) return;
  const duration = ACTION_DURATIONS[v.actionEmote] ?? 1600;
  if (now - v.actionStartedAt >= duration) {
    v.actionEmote = null;
    v.actionStartedAt = null;
  }
}

// Yumruk savurma animasyonu (saldırgan).
export function playPunch(v: PlayerVisual): void {
  if (v.sitting) return;
  v.actionEmote = 'punch';
  v.actionStartedAt = performance.now();
}

// Yumruk yiyen karakter yere serilir; süre bitince kendiliğinden kalkar.
export function playKnockdown(v: PlayerVisual, stunMs: number): void {
  v.knockedUntil = performance.now() + stunMs;
  v.actionEmote = null;
  v.actionStartedAt = null;
}

export function setInstrument(v: PlayerVisual, instrument: Instrument | null): void {
  v.instrument = instrument;
}

// Bakış yönüne göre göz bebeği kayması.
function pupilOffset(facing: Facing): { dx: number; dy: number } {
  switch (facing) {
    case 'left': return { dx: -1.6, dy: 0 };
    case 'right': return { dx: 1.6, dy: 0 };
    case 'up': return { dx: 0, dy: -1 };
    default: return { dx: 0, dy: 0.6 };
  }
}

// Gözler: bakış yönlü bebekler + periyodik göz kırpma.
function drawEyes(g: Graphics, v: PlayerVisual, eyeY: number, spread: number, now: number): void {
  const blinking = ((now + v.idlePhase * 700) % 4600) < 130;
  if (blinking) {
    g.moveTo(-spread - 1.4, eyeY).lineTo(-spread + 1.4, eyeY).stroke({ width: 1.2, color: OUTLINE_COLOR, cap: 'round' });
    g.moveTo(spread - 1.4, eyeY).lineTo(spread + 1.4, eyeY).stroke({ width: 1.2, color: OUTLINE_COLOR, cap: 'round' });
    return;
  }
  const { dx, dy } = pupilOffset(v.facing);
  g.circle(-spread + dx, eyeY + dy, 1.4).fill(OUTLINE_COLOR);
  g.circle(spread + dx, eyeY + dy, 1.4).fill(OUTLINE_COLOR);
}

// Kapalı "^^" gülme gözleri.
function drawLaughEyes(g: Graphics, eyeY: number, spread: number): void {
  for (const s of [-spread, spread]) {
    g.moveTo(s - 1.6, eyeY + 0.8).lineTo(s, eyeY - 0.8).lineTo(s + 1.6, eyeY + 0.8)
      .stroke({ width: 1.2, color: OUTLINE_COLOR, cap: 'round', join: 'round' });
  }
}

// Gövdeyle çakışan kolların görünmesi için ana rengin koyulaştırılmış tonu.
function darken(color: number, factor: number): number {
  const r = Math.round(((color >> 16) & 0xff) * factor);
  const g = Math.round(((color >> 8) & 0xff) * factor);
  const b = Math.round((color & 0xff) * factor);
  return (r << 16) | (g << 8) | b;
}

// Şapkalar: baş merkezine (hy) ve yarıçapına göre çizilir; poz değişse de uyar.
function drawHat(g: Graphics, hat: number, hy: number, headR: number, bodyColor: number): void {
  const top = hy - headR;
  switch (hat) {
    case 1: { // kırmızı kasket
      g.moveTo(-headR + 1.5, hy - 5).arc(0, hy - 5, headR - 1.5, Math.PI, 0).fill(0xef4444);
      g.moveTo(-headR + 1.5, hy - 5).arc(0, hy - 5, headR - 1.5, Math.PI, 0).stroke({ width: 1.4, color: 0x991b1b });
      g.roundRect(0, hy - 7, headR + 3, 3, 1.5).fill(0xdc2626); // siperlik
      g.circle(0, hy - headR - 1, 1.7).fill(0xfecaca); // tepe düğmesi
      break;
    }
    case 2: { // altın taç
      const y0 = top + 1;
      const pts = [-7, y0 + 4, -7, y0 - 3, -3.5, y0 + 0.5, 0, y0 - 5, 3.5, y0 + 0.5, 7, y0 - 3, 7, y0 + 4];
      g.poly(pts).fill(0xfbbf24);
      g.poly(pts).stroke({ width: 1, color: 0xb45309 });
      g.circle(-4.2, y0 + 2, 1).fill(0xef4444);
      g.circle(0, y0 + 2, 1).fill(0x38bdf8);
      g.circle(4.2, y0 + 2, 1).fill(0x4ade80);
      break;
    }
    case 3: { // kedi kulakları
      const earColor = darken(bodyColor, 0.8);
      const y0 = top + 3;
      g.poly([-8.5, y0, -7, y0 - 8, -2.5, y0 - 1.5]).fill(earColor);
      g.poly([-8.5, y0, -7, y0 - 8, -2.5, y0 - 1.5]).stroke({ width: 1.3, color: OUTLINE_COLOR });
      g.poly([8.5, y0, 7, y0 - 8, 2.5, y0 - 1.5]).fill(earColor);
      g.poly([8.5, y0, 7, y0 - 8, 2.5, y0 - 1.5]).stroke({ width: 1.3, color: OUTLINE_COLOR });
      g.poly([-7.2, y0 - 1, -6.6, y0 - 5.5, -4.2, y0 - 1.6]).fill(0xf9a8d4);
      g.poly([7.2, y0 - 1, 6.6, y0 - 5.5, 4.2, y0 - 1.6]).fill(0xf9a8d4);
      break;
    }
    case 4: { // parti konisi
      const y0 = top + 2;
      g.poly([-5.5, y0, 5.5, y0, 0, y0 - 11]).fill(0x8b5cf6);
      g.poly([-5.5, y0, 5.5, y0, 0, y0 - 11]).stroke({ width: 1.2, color: 0x5b21b6 });
      g.moveTo(-3.6, y0 - 3.8).lineTo(3.6, y0 - 3.8).stroke({ width: 1.6, color: 0xf472b6 });
      g.moveTo(-1.9, y0 - 7.4).lineTo(1.9, y0 - 7.4).stroke({ width: 1.6, color: 0x38bdf8 });
      g.circle(0, y0 - 12, 2).fill(0xfbbf24);
      break;
    }
  }
}

// Baş üstünde süzülen kalp.
function drawHeart(g: Graphics, x: number, y: number, scale: number, alpha: number): void {
  g.circle(x - 2.4 * scale, y - 1.2 * scale, 3 * scale).fill({ color: 0xf472b6, alpha });
  g.circle(x + 2.4 * scale, y - 1.2 * scale, 3 * scale).fill({ color: 0xf472b6, alpha });
  g.poly([
    x - 5.2 * scale, y + 0.4 * scale,
    x + 5.2 * scale, y + 0.4 * scale,
    x, y + 7 * scale,
  ]).fill({ color: 0xf472b6, alpha });
}

export function drawCharacter(v: PlayerVisual, moving: boolean): void {
  const g = v.body;
  g.clear();
  v.fx.clear();
  g.rotation = 0;
  g.x = 0;
  const color = v.color;
  const now = performance.now();
  const action = v.actionStartedAt !== null ? v.actionEmote : null;
  const duration = action ? ACTION_DURATIONS[action] ?? 1600 : 1;
  const ap = action ? Math.min(1, (now - (v.actionStartedAt ?? now)) / duration) : 0; // 0..1 ilerleme
  const legSwing = moving ? Math.sin(v.walkPhase) : 0;
  const armSwing = moving ? Math.sin(v.walkPhase + Math.PI) : 0;
  const bob = moving ? 0 : Math.sin(v.idlePhase) * 1.1;
  g.y = bob;

  // yumruk yemiş, yerde: her şeyden öncelikli poz
  if (v.knockedUntil !== null && now < v.knockedUntil) {
    drawKnockedPose(g, v, color, now);
    return;
  }

  if (v.sitting) {
    drawSittingPose(g, v, color, now, action, ap);
    return;
  }

  if (action === '🕺' && !moving) {
    // Dans: gövde iki yana salınır, kollar havada, bacaklar açık
    const dp = now * 0.014 + v.idlePhase;
    const sway = Math.sin(dp);
    g.rotation = sway * 0.12;
    g.y = -Math.abs(Math.sin(dp * 2)) * 2.5;
    g.roundRect(-9, -26, 18, 20, 9).fill(color).stroke({ width: 2, color: OUTLINE_COLOR });
    g.circle(0, -33, 11).fill(color).stroke({ width: 2, color: OUTLINE_COLOR });
    drawEyes(g, v, -34, 3.8, now);
    drawHat(g, v.hat, -33, 11, color);
    g.moveTo(-6, -22).lineTo(-12 - sway * 3, -36 + Math.abs(sway) * 3).stroke({ width: 3.2, color, cap: 'round' });
    g.moveTo(6, -22).lineTo(12 - sway * 3, -36 + Math.abs(-sway) * 3).stroke({ width: 3.2, color, cap: 'round' });
    g.moveTo(-4, -6).lineTo(-8 - sway * 2, 9).stroke({ width: 3.6, color, cap: 'round' });
    g.moveTo(4, -6).lineTo(8 - sway * 2, 9).stroke({ width: 3.6, color, cap: 'round' });
    return;
  }

  if (action && !moving) {
    drawActionPose(g, v, color, now, action, ap);
    return;
  }

  // Ayakta / yürüme pozu
  g.roundRect(-9, -26, 18, 20, 9).fill(color).stroke({ width: 2, color: OUTLINE_COLOR });
  g.circle(0, -33, 11).fill(color).stroke({ width: 2, color: OUTLINE_COLOR });
  drawEyes(g, v, -34, 3.8, now);
  drawHat(g, v.hat, -33, 11, color);

  g.moveTo(-6, -20).lineTo(-9 - armSwing * 5, -8 + Math.abs(armSwing) * 2).stroke({ width: 3.2, color, cap: 'round' });
  g.moveTo(6, -20).lineTo(9 + armSwing * 5, -8 + Math.abs(armSwing) * 2).stroke({ width: 3.2, color, cap: 'round' });
  g.moveTo(-4, -6).lineTo(-6 - legSwing * 7, 9).stroke({ width: 3.6, color, cap: 'round' });
  g.moveTo(4, -6).lineTo(6 + legSwing * 7, 9).stroke({ width: 3.6, color, cap: 'round' });
}

// Yerde yatma pozu: sırtüstü, X gözler, başın üstünde dönen yıldızlar.
function drawKnockedPose(g: Graphics, v: PlayerVisual, color: number, now: number): void {
  g.y = 0;
  g.rotation = Math.sin(now * 0.008) * 0.02; // hafif sersemleme sallantısı

  // gövde yerde (yatay), baş solda, bacaklar sağda
  g.roundRect(-12, -13, 24, 12, 6).fill(color).stroke({ width: 2, color: OUTLINE_COLOR });
  g.circle(-18, -8, 9).fill(color).stroke({ width: 2, color: OUTLINE_COLOR });
  // X gözler
  for (const [ex, ey] of [[-21, -10], [-15.5, -10]] as [number, number][]) {
    g.moveTo(ex - 1.4, ey - 1.4).lineTo(ex + 1.4, ey + 1.4).stroke({ width: 1.2, color: OUTLINE_COLOR, cap: 'round' });
    g.moveTo(ex + 1.4, ey - 1.4).lineTo(ex - 1.4, ey + 1.4).stroke({ width: 1.2, color: OUTLINE_COLOR, cap: 'round' });
  }
  // bacaklar sağa uzanmış, biri hafif kalkık
  g.moveTo(11, -8).lineTo(21, -4).stroke({ width: 3.4, color, cap: 'round' });
  g.moveTo(11, -10).lineTo(22, -12 + Math.sin(now * 0.006) * 1.5).stroke({ width: 3.4, color, cap: 'round' });
  // kollar iki yana
  g.moveTo(-6, -14).lineTo(-9, -20).stroke({ width: 3, color, cap: 'round' });
  g.moveTo(2, -13).lineTo(6, -19).stroke({ width: 3, color, cap: 'round' });

  // başın üstünde dönen küçük yıldızlar
  for (let i = 0; i < 3; i++) {
    const ang = now * 0.005 + (i / 3) * Math.PI * 2;
    const sx = -18 + Math.cos(ang) * 11;
    const sy = -24 + Math.sin(ang) * 3.5;
    const a = 0.5 + 0.4 * Math.sin(now * 0.01 + i * 2);
    v.fx.poly([sx, sy - 2.4, sx + 0.8, sy - 0.8, sx + 2.4, sy, sx + 0.8, sy + 0.8, sx, sy + 2.4, sx - 0.8, sy + 0.8, sx - 2.4, sy, sx - 0.8, sy - 0.8])
      .fill({ color: 0xfde047, alpha: a });
  }
}

// Oturma pozu; bar taburesinde (facing 'up') sırt kameraya dönüktür.
function drawSittingPose(g: Graphics, v: PlayerVisual, color: number, now: number, action: string | null, ap: number): void {
  const backView = v.facing === 'up';

  g.roundRect(-9, -20, 18, 16, 8).fill(color).stroke({ width: 2, color: OUTLINE_COLOR });
  g.circle(0, -27, 10).fill(color).stroke({ width: 2, color: OUTLINE_COLOR });

  if (backView) {
    // ense gölgesi: başın alt yarısında hafif koyu hilal
    g.ellipse(0, -23.5, 6.5, 3).fill({ color: OUTLINE_COLOR, alpha: 0.18 });
  } else if (action === '😂') {
    drawLaughEyes(g, -28, 3.5);
    g.moveTo(-2.6, -24.5).arc(0, -24.5, 2.6, Math.PI, 0, true).fill(OUTLINE_COLOR);
  } else if (action === '😮') {
    g.circle(-3.5, -28, 1.8).fill(OUTLINE_COLOR);
    g.circle(3.5, -28, 1.8).fill(OUTLINE_COLOR);
    g.circle(0, -23.5, 2).stroke({ width: 1.3, color: OUTLINE_COLOR });
  } else {
    drawEyes(g, v, -28, 3.5, now);
  }
  drawHat(g, v.hat, -27, 10, color);

  // bacaklar - öne (aşağı-dışa) kısa ve bükük
  g.moveTo(-5, -5).lineTo(-9, 4).stroke({ width: 3.4, color, cap: 'round' });
  g.moveTo(5, -5).lineTo(9, 4).stroke({ width: 3.4, color, cap: 'round' });

  if (action === '👋') {
    // el sallama: bir kol havada iki yana sallanır
    const wave = Math.sin(now * 0.02) * 3.5;
    g.moveTo(-8, -14).lineTo(-10, -6).stroke({ width: 3, color, cap: 'round' });
    g.moveTo(8, -14).lineTo(12 + wave, -30).stroke({ width: 3, color, cap: 'round' });
    g.circle(12 + wave, -31, 2.2).fill(color).stroke({ width: 1.2, color: OUTLINE_COLOR });
    return;
  }
  if (action === '🎉') {
    // kutlama: iki kol havada + konfeti (konfeti fx katmanında, etiketin üstünde)
    g.moveTo(-8, -14).lineTo(-13, -28).stroke({ width: 3, color, cap: 'round' });
    g.moveTo(8, -14).lineTo(13, -28).stroke({ width: 3, color, cap: 'round' });
    drawConfetti(v.fx, now, ap, -30);
    return;
  }
  if (action === '❤️') {
    // kollar göğüste: gövdeyle karışmasın diye koyu ton
    const armColor = darken(color, 0.55);
    g.moveTo(-8, -14).lineTo(-2, -16).stroke({ width: 3, color: armColor, cap: 'round' });
    g.moveTo(8, -14).lineTo(2, -16).stroke({ width: 3, color: armColor, cap: 'round' });
    drawHeart(v.fx, 0, -62 - ap * 10, 0.9 + 0.2 * Math.sin(now * 0.01), 1 - ap * 0.7);
    return;
  }

  if (backView) {
    // kollar öne, tezgaha uzanır (dirsekler hafif dışarıda)
    g.moveTo(-8, -14).lineTo(-11.5, -19).stroke({ width: 3, color, cap: 'round' });
    g.moveTo(8, -14).lineTo(11.5, -19).stroke({ width: 3, color, cap: 'round' });
    return;
  }

  if (v.instrument === 'guitar') {
    // gitar: sap sola yukarı, gövde kucakta; sağ el tıngırdatır, sol el sapta kayar
    const strum = Math.sin(now * 0.012) * 2.5;
    const fret = Math.sin(now * 0.004) * 3;
    g.moveTo(-4, -10).lineTo(-17, -22).stroke({ width: 2.2, color: 0x8a5a2e }); // sap
    g.moveTo(-17.5, -23.5).lineTo(-15.5, -21.5).stroke({ width: 3.5, color: 0x5c3a1c, cap: 'round' }); // baş
    g.ellipse(0, -8, 8.5, 7).fill(0xb0703a);
    g.ellipse(0, -8, 8.5, 7).stroke({ width: 1.6, color: 0x5c3a1c });
    g.circle(0, -8, 2.6).fill(0x2c1a0c);
    g.moveTo(-15, -20).lineTo(4, -6).stroke({ width: 0.7, color: 0xe8e2d6, alpha: 0.8 }); // teller
    g.moveTo(-8, -14).lineTo(-13 - fret * 0.3, -19 + fret * 0.2).stroke({ width: 3, color: darken(color, 0.75), cap: 'round' }); // sol el
    g.moveTo(8, -14).lineTo(4, -4 + strum).stroke({ width: 3, color, cap: 'round' }); // sağ el
    drawMusicNotes(v.fx, now, -34);
    return;
  }
  if (v.instrument === 'drums') {
    // bateri: iki el bagetlerle dönüşümlü vurur
    const hitL = Math.max(0, Math.sin(now * 0.014));
    const hitR = Math.max(0, Math.sin(now * 0.014 + Math.PI));
    const lx = -10;
    const rx = 10;
    const ly = -12 + hitL * 6;
    const ry = -12 + hitR * 6;
    g.moveTo(-8, -14).lineTo(lx, ly).stroke({ width: 3, color, cap: 'round' });
    g.moveTo(8, -14).lineTo(rx, ry).stroke({ width: 3, color, cap: 'round' });
    // bagetler
    g.moveTo(lx, ly).lineTo(lx - 3, ly + 7).stroke({ width: 1.6, color: 0xd9b98c, cap: 'round' });
    g.moveTo(rx, ry).lineTo(rx + 3, ry + 7).stroke({ width: 1.6, color: 0xd9b98c, cap: 'round' });
    drawMusicNotes(v.fx, now, -34);
    return;
  }

  // varsayılan: sol kol aşağıda, sağ kol içki tutuyor
  g.moveTo(-8, -14).lineTo(-10, -6).stroke({ width: 3, color, cap: 'round' });
  g.moveTo(8, -14).lineTo(11, -9).stroke({ width: 3, color, cap: 'round' });
  g.roundRect(9.5, -16, 5, 7, 1).fill({ color: 0xd9f3ff, alpha: 0.5 }).stroke({ width: 1, color: 0xbfe9ff, alpha: 0.9 });
  g.rect(9.9, -14.4, 4.2, 5).fill({ color: 0xfbbf24, alpha: 0.9 });
  g.moveTo(12, -16).lineTo(13.6, -20).stroke({ width: 1, color: 0xf472b6 });
}

// Ayakta emote pozları: el sallama, gülme, kalp, kutlama, şaşırma.
function drawActionPose(g: Graphics, v: PlayerVisual, color: number, now: number, action: string, ap: number): void {
  // gülmede gövde titrer, kutlamada zıplar, şaşırmada geri çekilir
  if (action === '😂') g.y = Math.sin(now * 0.03) * 1.8;
  if (action === '🎉') g.y = -Math.abs(Math.sin(now * 0.018)) * 3.5;
  if (action === '😮') g.y = ap < 0.15 ? -3 * (1 - ap / 0.15) : 0;

  g.roundRect(-9, -26, 18, 20, 9).fill(color).stroke({ width: 2, color: OUTLINE_COLOR });
  g.circle(0, -33, 11).fill(color).stroke({ width: 2, color: OUTLINE_COLOR });

  // yüz
  if (action === '😂') {
    drawLaughEyes(g, -34, 3.8);
    g.moveTo(-3, -29.5).arc(0, -29.5, 3, Math.PI, 0, true).fill(OUTLINE_COLOR);
  } else if (action === '😮') {
    g.circle(-3.8, -34, 1.9).fill(OUTLINE_COLOR);
    g.circle(3.8, -34, 1.9).fill(OUTLINE_COLOR);
    g.circle(0, -28.5, 2.3).stroke({ width: 1.4, color: OUTLINE_COLOR });
  } else {
    drawEyes(g, v, -34, 3.8, now);
    if (action === '👋' || action === '🎉' || action === '❤️') {
      // hafif gülümseme
      g.moveTo(-2.6, -29.5).arc(0, -29.5, 2.6, Math.PI * 0.85, Math.PI * 0.15, true).stroke({ width: 1.2, color: OUTLINE_COLOR, cap: 'round' });
    }
  }
  drawHat(g, v.hat, -33, 11, color);

  // bacaklar sabit
  g.moveTo(-4, -6).lineTo(-6, 9).stroke({ width: 3.6, color, cap: 'round' });
  g.moveTo(4, -6).lineTo(6, 9).stroke({ width: 3.6, color, cap: 'round' });

  // kollar + aksesuarlar
  switch (action) {
    case '👋': {
      const wave = Math.sin(now * 0.02) * 4;
      g.moveTo(-6, -20).lineTo(-9, -8).stroke({ width: 3.2, color, cap: 'round' });
      g.moveTo(6, -20).lineTo(12 + wave, -37).stroke({ width: 3.2, color, cap: 'round' });
      g.circle(12 + wave, -38, 2.4).fill(color).stroke({ width: 1.2, color: OUTLINE_COLOR });
      break;
    }
    case '😂': {
      // eller karında: gövde üstünde kaldığı için koyu ton
      const armColor = darken(color, 0.55);
      g.moveTo(-6, -20).lineTo(-3, -13).stroke({ width: 3.2, color: armColor, cap: 'round' });
      g.moveTo(6, -20).lineTo(3, -13).stroke({ width: 3.2, color: armColor, cap: 'round' });
      break;
    }
    case '❤️': {
      // kollar kalp gibi göğüste birleşir (koyu ton) + etiketin üstünde süzülen kalp
      const armColor = darken(color, 0.55);
      g.moveTo(-6, -20).lineTo(2, -16).stroke({ width: 3.2, color: armColor, cap: 'round' });
      g.moveTo(6, -20).lineTo(-2, -16).stroke({ width: 3.2, color: armColor, cap: 'round' });
      drawHeart(v.fx, 0, -66 - ap * 10, 0.95 + 0.2 * Math.sin(now * 0.01), 1 - ap * 0.7);
      break;
    }
    case '🎉': {
      g.moveTo(-6, -20).lineTo(-13, -36).stroke({ width: 3.2, color, cap: 'round' });
      g.moveTo(6, -20).lineTo(13, -36).stroke({ width: 3.2, color, cap: 'round' });
      drawConfetti(v.fx, now, ap, -40);
      break;
    }
    case '😮': {
      // kollar iki yana açık
      g.moveTo(-6, -20).lineTo(-13, -16).stroke({ width: 3.2, color, cap: 'round' });
      g.moveTo(6, -20).lineTo(13, -16).stroke({ width: 3.2, color, cap: 'round' });
      break;
    }
    case 'punch': {
      // ileri hamle + düz yumruk: ilk %40'ta uzanır, sonra geri çekilir
      const ext = ap < 0.4 ? ap / 0.4 : 1 - (ap - 0.4) / 0.6;
      g.x = ext * 4;
      const fx = 8 + ext * 10;
      g.moveTo(-6, -20).lineTo(-10, -14).stroke({ width: 3.2, color, cap: 'round' }); // gard kolu
      g.moveTo(6, -18).lineTo(fx, -18).stroke({ width: 3.4, color, cap: 'round' });
      g.circle(fx + 1.5, -18, 3).fill(color).stroke({ width: 1.4, color: OUTLINE_COLOR }); // yumruk
      // hız çizgileri
      if (ext > 0.6) {
        g.moveTo(fx + 6, -21).lineTo(fx + 11, -21).stroke({ width: 1, color: 0xffffff, alpha: (ext - 0.6) * 1.5 });
        g.moveTo(fx + 6, -15).lineTo(fx + 11, -15).stroke({ width: 1, color: 0xffffff, alpha: (ext - 0.6) * 1.5 });
      }
      break;
    }
  }
}

// Çalarken başın üstünde süzülen notalar (daire + sap).
function drawMusicNotes(g: Graphics, now: number, baseY: number): void {
  for (let i = 0; i < 2; i++) {
    const t = ((now * 0.0006 + i * 0.5) % 1);
    const alpha = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85;
    const nx = 10 + Math.sin(now * 0.003 + i * 3) * 4 + t * 8;
    const ny = baseY - t * 22;
    g.circle(nx, ny, 2).fill({ color: 0xf9a8d4, alpha });
    g.moveTo(nx + 2, ny).lineTo(nx + 2, ny - 7).stroke({ width: 1.1, color: 0xf9a8d4, alpha, cap: 'round' });
    g.moveTo(nx + 2, ny - 7).lineTo(nx + 4.5, ny - 5.5).stroke({ width: 1.1, color: 0xf9a8d4, alpha, cap: 'round' });
  }
}

// Baş çevresinde dönerek saçılan konfeti tanecikleri.
function drawConfetti(g: Graphics, now: number, ap: number, centerY: number): void {
  const alpha = Math.max(0, 1 - ap * 1.1);
  if (alpha <= 0) return;
  for (let i = 0; i < 7; i++) {
    const ang = (i / 7) * Math.PI * 2 + now * 0.003;
    const r = 13 + ap * 16 + Math.sin(now * 0.006 + i * 2) * 2;
    const px = Math.cos(ang) * r;
    const py = centerY + Math.sin(ang) * r * 0.6 - ap * 6;
    g.rect(px - 1.4, py - 1.4, 2.8, 2.8).fill({ color: CONFETTI_COLORS[i % CONFETTI_COLORS.length], alpha });
  }
}

export function setSitting(v: PlayerVisual, sitting: boolean): void {
  if (v.sitting === sitting) return;
  v.sitting = sitting;
  v.walkPhase = 0;
  if (sitting && v.actionEmote === '🕺') {
    v.actionEmote = null;
    v.actionStartedAt = null;
  }
  drawCharacter(v, false);
}

export function showSpeechBubble(v: PlayerVisual, text: string): void {
  const t = v.speechBubbleText;
  t.text = text;
  const padX = 10;
  const padY = 7;
  const w = Math.min(t.width, 150) + padX * 2;
  const h = t.height + padY * 2;
  t.x = 0;
  t.y = -h / 2;

  const g = v.speechBubbleBg;
  g.clear();
  g.roundRect(-w / 2, -h, w, h, 10).fill({ color: 0xfdf6e3, alpha: 0.96 }).stroke({ width: 1.5, color: 0x1c1730, alpha: 0.4 });
  g.moveTo(-5, 0).lineTo(5, 0).lineTo(0, 7).fill({ color: 0xfdf6e3, alpha: 0.96 });
  t.style.fill = 0x1c1730;

  // Haritanın üst kenarına yakınken (ör. bar taburesi) balon canvas dışına
  // taşıp okunmaz olmasın: üst kenardan en az 6px içeride kalacak kadar aşağı alınır.
  v.speechBubble.y = Math.max(-68, 6 + h - v.renderY);
  v.speechBubble.visible = true;
  v.bubbleHideAt = performance.now() + BUBBLE_DURATION_MS;
}

export function tickSpeechBubble(v: PlayerVisual, now: number): void {
  if (v.bubbleHideAt !== null && now >= v.bubbleHideAt) {
    v.speechBubble.visible = false;
    v.bubbleHideAt = null;
  }
}

export function updatePlayerVisual(v: PlayerVisual, targetX: number, targetY: number, moving: boolean, dtMs: number, facing?: Facing): void {
  // otururken bakış yönü koltuk tarafından belirlenir (bar taburesinde sırt dönük)
  if (facing && !v.sitting) v.facing = facing;
  const lerpFactor = Math.min(1, dtMs / 120);
  v.renderX += (targetX - v.renderX) * lerpFactor;
  v.renderY += (targetY - v.renderY) * lerpFactor;
  v.container.x = v.renderX;
  v.container.y = v.renderY;

  if (moving) {
    v.walkPhase += dtMs * 0.012;
  } else {
    v.walkPhase = 0;
    v.idlePhase += dtMs * 0.0022;
  }
  drawCharacter(v, moving);
}

export function setSelfPosition(v: PlayerVisual, x: number, y: number, moving: boolean, dtMs: number, facing?: Facing): void {
  if (facing && !v.sitting) v.facing = facing;
  v.renderX = x;
  v.renderY = y;
  v.container.x = x;
  v.container.y = y;
  if (moving) {
    v.walkPhase += dtMs * 0.012;
  } else {
    v.walkPhase = 0;
    v.idlePhase += dtMs * 0.0022;
  }
  drawCharacter(v, moving);
}
