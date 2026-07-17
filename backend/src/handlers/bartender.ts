import { broadcastBar } from '../util/broadcast.js';
import { countPlayersInBar } from '../state/players.js';
import { BAR_IDS } from '../config.js';

// Barmenin replikleri sunucuda seçilir ve salondaki HERKESE aynı anda yayınlanır;
// böylece iki oyuncu farklı söz görmez.

const SERVE_QUIPS = [
  'Bu içki benden!',
  'Buyur bakalım, taze piksel kolada.',
  'Bugün spesiyalimiz: neon limonata.',
  'Buzlu mu buzsuz mu? Şaka şaka, hepsi piksel.',
  'Afiyet olsun şef!',
];

const IDLE_QUIPS = [
  'Bardaklar kendini parlatmıyor...',
  'Dans pistine bakan var mı? Işıklar boşa yanıyor.',
  'Bir taş-kağıt-makas efsanesi arıyorum.',
  'Sahnede gitar var, çalacak yiğit yok.',
  'En hızlı refleks bende sanıyordum, düelloya girmem.',
  'Penaltıda kaleci olmak varmış.',
];

const IDLE_CHECK_MS = 30_000;
const IDLE_CHANCE = 0.45; // her kontrolde salon başına konuşma olasılığı

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function say(barId: string, text: string): void {
  broadcastBar(barId, { type: 'bartender', payload: { text } });
}

// Bara yeni giren oyuncuyu adıyla karşılar (salondaki herkes duyar).
export function bartenderGreet(barId: string, name: string): void {
  say(barId, `Hoş geldin ${name}! İlk içki benden.`);
}

// Bar taburesine oturana içki servisi repliği.
export function bartenderServeQuip(barId: string): void {
  say(barId, pick(SERVE_QUIPS));
}

// Boş anlarda kendi kendine söylenir; yalnızca içinde oyuncu olan salonlarda.
export function startBartenderIdle(): NodeJS.Timeout {
  return setInterval(() => {
    for (const barId of BAR_IDS) {
      if (countPlayersInBar(barId) === 0) continue;
      if (Math.random() > IDLE_CHANCE) continue;
      say(barId, pick(IDLE_QUIPS));
    }
  }, IDLE_CHECK_MS);
}
