import { sendMessage } from '../net/socket.js';
import { MEMORY_GRID_SIZE } from '../config.js';
import { displayName } from '../state/store.js';
import { setRestartVisible } from './chatPanel.js';
import { MEMORY_SHAPES, ICON_COCKTAIL } from './icons.js';

let panelEl: HTMLDivElement;
let gridEl: HTMLDivElement;
let statusEl: HTMLDivElement;
let cardEls: { btn: HTMLButtonElement; back: HTMLSpanElement }[] = [];

// kart yüzleri: 8 farklı renkli sembol (icons.ts MEMORY_SHAPES)

export function initMemoryPanel(root: HTMLElement): void {
  panelEl = document.createElement('div');
  panelEl.className = 'memory-panel hidden';

  const heading = document.createElement('div');
  heading.className = 'memory-panel__heading';
  heading.textContent = 'Hafıza Kartı';
  panelEl.appendChild(heading);

  statusEl = document.createElement('div');
  statusEl.className = 'memory-panel__status';
  panelEl.appendChild(statusEl);

  gridEl = document.createElement('div');
  gridEl.className = 'memory-panel__grid';
  panelEl.appendChild(gridEl);

  root.appendChild(panelEl);
}

export function showMemoryPanel(waiting = false): void {
  panelEl.classList.remove('hidden');
  statusEl.textContent = waiting ? 'Rakip bekleniyor... biri gelince oyun başlar.' : '';
  gridEl.innerHTML = '';
  cardEls = [];
  for (let i = 0; i < MEMORY_GRID_SIZE; i++) {
    const btn = document.createElement('button');
    btn.className = 'memory-card';

    const inner = document.createElement('span');
    inner.className = 'memory-card__inner';

    const front = document.createElement('span');
    front.className = 'memory-card__face memory-card__face--front';
    front.innerHTML = ICON_COCKTAIL;

    const back = document.createElement('span');
    back.className = 'memory-card__face memory-card__face--back';

    inner.appendChild(front);
    inner.appendChild(back);
    btn.appendChild(inner);

    btn.addEventListener('click', () => {
      sendMessage({ type: 'memory_flip', payload: { cardIndex: i } });
    });
    cardEls.push({ btn, back });
    gridEl.appendChild(btn);
  }
}

export function hideMemoryPanel(): void {
  panelEl.classList.add('hidden');
}

export function renderMemoryState(
  cards: { value: number | null; matched: boolean }[],
  turn: string,
  scores: Record<string, number>,
  selfId: string | null,
): void {
  cards.forEach((card, i) => {
    const el = cardEls[i];
    if (!el) return;
    if (card.matched) {
      el.back.innerHTML = card.value !== null ? MEMORY_SHAPES[card.value] ?? '' : '';
      el.btn.className = 'memory-card memory-card--open memory-card--matched';
    } else if (card.value !== null) {
      el.back.innerHTML = MEMORY_SHAPES[card.value] ?? '';
      el.btn.className = 'memory-card memory-card--open';
    } else {
      el.btn.className = 'memory-card';
    }
  });

  const scoreText = Object.entries(scores).map(([pid, s]) => `${displayName(pid)}: ${s}`).join('  ·  ');

  // Oyun bitti mi? Sonucu göster ve "Yeniden Başla"yı aç.
  const finished = cards.length > 0 && cards.every((c) => c.matched);
  if (finished) {
    const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    let endText: string;
    if (entries.length >= 2 && entries[0][1] === entries[1][1]) {
      endText = 'Oyun bitti — Berabere!';
    } else if (entries[0][0] === selfId) {
      endText = `Oyun bitti — Kazandın! (${scoreText})`;
    } else {
      endText = `Oyun bitti — Kazanan: ${displayName(entries[0][0])} (${scoreText})`;
    }
    statusEl.textContent = endText;
    gridEl.classList.remove('memory-panel__grid--my-turn');
    setRestartVisible(true);
    return;
  }

  const myTurn = turn === selfId;
  const turnText = myTurn ? 'Sıra sende!' : `Sıra: ${displayName(turn)}`;
  statusEl.textContent = `${turnText} — ${scoreText}`;
  gridEl.classList.toggle('memory-panel__grid--my-turn', myTurn);
}
