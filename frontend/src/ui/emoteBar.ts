import { sendMessage } from '../net/socket.js';
import { EMOTES } from '../config.js';
import { ICON_WAVE, ICON_LAUGH, ICON_HEART, ICON_PARTY, ICON_SURPRISE, ICON_DANCE } from './icons.js';

// EMOTES ile aynı sıra: el sallama, gülme, kalp, kutlama, şaşırma, dans
const EMOTE_ICONS = [ICON_WAVE, ICON_LAUGH, ICON_HEART, ICON_PARTY, ICON_SURPRISE, ICON_DANCE];
const EMOTE_TITLES = ['El salla', 'Gül', 'Kalp gönder', 'Kutla', 'Şaşır', 'Dans et'];

let barEl: HTMLDivElement;
let onLocalEmote: (emote: string) => void = () => {};

function sendEmote(emote: string): void {
  sendMessage({ type: 'emote', payload: { emote } });
  onLocalEmote(emote); // kendi avatarında anında göster
}

// Dünya görünümündeyken alttaki emote butonları; 1-5 tuşları da tetikler.
export function initEmoteBar(root: HTMLElement, onLocal: (emote: string) => void): void {
  onLocalEmote = onLocal;

  barEl = document.createElement('div');
  barEl.className = 'emote-bar';

  EMOTES.forEach((emote, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'emote-bar__button';
    btn.innerHTML = EMOTE_ICONS[idx] ?? '';
    btn.title = `${EMOTE_TITLES[idx] ?? 'Emote'} (${idx + 1})`;
    btn.addEventListener('click', () => {
      sendEmote(emote);
      btn.blur();
    });
    barEl.appendChild(btn);
  });

  root.appendChild(barEl);

  window.addEventListener('keydown', (e) => {
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (barEl.classList.contains('hidden')) return;
    const idx = Number(e.key) - 1;
    if (Number.isInteger(idx) && idx >= 0 && idx < EMOTES.length) sendEmote(EMOTES[idx]);
  });
}

export function setEmoteBarVisible(visible: boolean): void {
  barEl.classList.toggle('hidden', !visible);
}
