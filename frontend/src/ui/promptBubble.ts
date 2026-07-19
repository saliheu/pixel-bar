import { Container, Graphics, Text } from 'pixi.js';
import type { PublicZone } from '../protocol.js';

const PROMPT_LABEL: Record<string, string> = {
  rps_stool: 'Otur',
  pong_cabinet: 'Oyuna Gir',
  memory_table: 'Otur',
  chat_table: 'Otur',
  bench: 'Otur',
  bar_stool: 'Otur',
  reflex_pad: 'Oyuna Gir',
  stage_guitar: 'Gitar Çal',
  stage_drums: 'Bateri Çal',
  penalty_spot: 'Oyuna Gir',
  freekick_spot: 'Oyuna Gir',
  dart_board: 'Oyuna Gir',
};

const STAND_UP_LABEL = 'Kalk';

export interface PromptBadge {
  container: Container;
  bg: Graphics;
  keyBg: Graphics;
  keyText: Text;
  labelText: Text;
  currentLabel: string;
  contextKey: string; // aynı bağlamda (aynı zone / oturma durumu) tekrar gösterme
  shownAt: number;
}

// Rozet birkaç saniye görünüp söner; bağlam değişince (başka masa, oturma/kalkma)
// yeniden belirir. Böylece isim etiketi ve konuşma balonlarıyla çakışıp
// sürekli ekranda durmaz.
const BADGE_VISIBLE_MS = 2600;
const BADGE_FADE_MS = 450;
// Karakterin ALTINDA durur (üstü isim etiketi + balonlara ait).
const BADGE_BELOW_OFFSET = 42;
const MAP_BOTTOM_SAFE = 660; // haritanın en altındayken üstte gösterilir

// "E Otur" biçiminde keycap görünümlü rozet.
export function createPromptBadge(): PromptBadge {
  const container = new Container();
  container.visible = false;

  const bg = new Graphics();
  container.addChild(bg);

  const keyBg = new Graphics();
  container.addChild(keyBg);

  const keyText = new Text({
    text: 'E',
    style: { fill: 0x0a0812, fontSize: 11, fontFamily: 'monospace', fontWeight: 'bold' },
  });
  keyText.anchor.set(0.5, 0.5);
  container.addChild(keyText);

  const labelText = new Text({
    text: '',
    style: { fill: 0xf1f0f6, fontSize: 12, fontFamily: 'Inter Variable, system-ui, sans-serif', fontWeight: '600' },
  });
  labelText.anchor.set(0, 0.5);
  container.addChild(labelText);

  return { container, bg, keyBg, keyText, labelText, currentLabel: '', contextKey: '', shownAt: 0 };
}

// Bağlama göre görünürlük/solma; yeni bağlamda sayaç sıfırlanır.
function applyBadgeLifetime(badge: PromptBadge, key: string): void {
  const now = performance.now();
  if (badge.contextKey !== key) {
    badge.contextKey = key;
    badge.shownAt = now;
  }
  const t = now - badge.shownAt;
  if (t < BADGE_VISIBLE_MS) {
    badge.container.alpha = 1;
    badge.container.visible = true;
  } else if (t < BADGE_VISIBLE_MS + BADGE_FADE_MS) {
    badge.container.alpha = 1 - (t - BADGE_VISIBLE_MS) / BADGE_FADE_MS;
    badge.container.visible = true;
  } else {
    badge.container.visible = false;
  }
}

function positionBadge(badge: PromptBadge, selfX: number, selfY: number): void {
  badge.container.x = selfX;
  // altta yer yoksa (harita dibi) eski gibi üstte göster
  badge.container.y = selfY > MAP_BOTTOM_SAFE ? selfY - 58 : selfY + BADGE_BELOW_OFFSET;
}

function layoutBadge(badge: PromptBadge, label: string): void {
  if (badge.currentLabel === label) return;
  badge.currentLabel = label;
  badge.labelText.text = label;

  const keySize = 18;
  const gap = 6;
  const padX = 9;
  const padY = 6;
  const contentW = keySize + gap + badge.labelText.width;
  const w = contentW + padX * 2;
  const h = keySize + padY * 2;

  badge.bg.clear();
  badge.bg.roundRect(-w / 2, -h, w, h, 9)
    .fill({ color: 0x120f1e, alpha: 0.88 })
    .stroke({ width: 1, color: 0x38bdf8, alpha: 0.55 });

  const keyX = -w / 2 + padX;
  const keyY = -h + padY;
  badge.keyBg.clear();
  badge.keyBg.roundRect(keyX, keyY, keySize, keySize, 4).fill(0xfacc15);
  badge.keyBg.roundRect(keyX, keyY + keySize - 3, keySize, 3, 1.5).fill({ color: 0x8a6d00, alpha: 0.8 });

  badge.keyText.x = keyX + keySize / 2;
  badge.keyText.y = keyY + keySize / 2 - 1;
  badge.labelText.x = keyX + keySize + gap;
  badge.labelText.y = -h / 2;
}

export function updatePromptBadge(badge: PromptBadge, zone: PublicZone | null, selfX: number, selfY: number): void {
  if (!zone) {
    badge.container.visible = false;
    badge.contextKey = '';
    return;
  }
  layoutBadge(badge, PROMPT_LABEL[zone.type] ?? 'Otur');
  positionBadge(badge, selfX, selfY);
  applyBadgeLifetime(badge, `zone:${zone.zoneId}`);
}

// Müzik kutusunun yanındayken: "E Müzik Kutusu"
export function updateJukeboxBadge(badge: PromptBadge, selfX: number, selfY: number): void {
  layoutBadge(badge, 'Müzik Kutusu');
  positionBadge(badge, selfX, selfY);
  applyBadgeLifetime(badge, 'jukebox');
}

export function updateStandUpBadge(badge: PromptBadge, selfX: number, selfY: number, seatKey: string): void {
  layoutBadge(badge, STAND_UP_LABEL);
  positionBadge(badge, selfX, selfY);
  applyBadgeLifetime(badge, `standup:${seatKey}`);
}
