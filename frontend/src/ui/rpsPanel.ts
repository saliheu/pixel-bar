import { sendMessage } from '../net/socket.js';
import { displayName } from '../state/store.js';
import { setRestartVisible } from './chatPanel.js';
import { ICON_ROCK, ICON_PAPER, ICON_SCISSORS } from './icons.js';
import type { Choice } from '../protocol.js';

let panelEl: HTMLDivElement;
let resultEl: HTMLDivElement;
let scoreYouEl: HTMLSpanElement;
let scoreOppEl: HTMLSpanElement;
let cardYouEl: HTMLDivElement;
let cardOppEl: HTMLDivElement;
let buttons: Record<Choice, HTMLButtonElement>;
let waitingMode = false;

const CHOICE_ICONS: Record<Choice, string> = { rock: ICON_ROCK, paper: ICON_PAPER, scissors: ICON_SCISSORS };
const LABEL: Record<Choice, string> = { rock: 'Taş', paper: 'Kağıt', scissors: 'Makas' };

export function initRpsPanel(root: HTMLElement): void {
  panelEl = document.createElement('div');
  panelEl.className = 'rps-panel hidden';

  const heading = document.createElement('div');
  heading.className = 'rps-panel__heading';
  heading.textContent = 'Taş · Kağıt · Makas';
  panelEl.appendChild(heading);

  // skor satırı: Sen 0 — 0 Rakip
  const scoreRow = document.createElement('div');
  scoreRow.className = 'rps-panel__score';
  scoreYouEl = document.createElement('span');
  scoreYouEl.className = 'rps-panel__score-side rps-panel__score-side--you';
  const scoreSep = document.createElement('span');
  scoreSep.className = 'rps-panel__score-sep';
  scoreSep.textContent = '—';
  scoreOppEl = document.createElement('span');
  scoreOppEl.className = 'rps-panel__score-side';
  scoreRow.appendChild(scoreYouEl);
  scoreRow.appendChild(scoreSep);
  scoreRow.appendChild(scoreOppEl);
  panelEl.appendChild(scoreRow);

  // arena: senin kartın VS rakip kartı
  const arena = document.createElement('div');
  arena.className = 'rps-arena';
  cardYouEl = document.createElement('div');
  cardYouEl.className = 'rps-card rps-card--you';
  const vs = document.createElement('div');
  vs.className = 'rps-arena__vs';
  vs.textContent = 'VS';
  cardOppEl = document.createElement('div');
  cardOppEl.className = 'rps-card';
  arena.appendChild(cardYouEl);
  arena.appendChild(vs);
  arena.appendChild(cardOppEl);
  panelEl.appendChild(arena);

  const buttonRow = document.createElement('div');
  buttonRow.className = 'rps-panel__buttons';
  buttons = {} as Record<Choice, HTMLButtonElement>;
  (['rock', 'paper', 'scissors'] as Choice[]).forEach((choice) => {
    const btn = document.createElement('button');
    btn.className = 'rps-panel__choice';
    btn.innerHTML = `<span class="rps-panel__choice-icon">${CHOICE_ICONS[choice]}</span><span>${LABEL[choice]}</span>`;
    btn.addEventListener('click', () => {
      if (waitingMode) return;
      sendMessage({ type: 'rps_choice', payload: { choice } });
      setCard(cardYouEl, CHOICE_ICONS[choice], 'picked');
      if (!cardOppEl.classList.contains('rps-card--picked')) setCard(cardOppEl, '?', 'thinking');
      resultEl.textContent = 'Rakip bekleniyor...';
      resultEl.className = 'rps-panel__result';
      for (const [c, b] of Object.entries(buttons)) {
        b.classList.toggle('rps-panel__choice--selected', c === choice);
        b.classList.toggle('rps-panel__choice--dimmed', c !== choice);
      }
    });
    buttons[choice] = btn;
    buttonRow.appendChild(btn);
  });
  panelEl.appendChild(buttonRow);

  resultEl = document.createElement('div');
  resultEl.className = 'rps-panel__result';
  panelEl.appendChild(resultEl);

  root.appendChild(panelEl);
}

function setCard(card: HTMLDivElement, content: string, state: 'empty' | 'thinking' | 'picked' | 'reveal'): void {
  card.innerHTML = content; // içerik ya sabit metin ya da icons.ts'ten gelen SVG
  card.classList.toggle('rps-card--text', !content.startsWith('<svg'));
  card.classList.remove('rps-card--thinking', 'rps-card--picked', 'rps-card--reveal');
  if (state === 'thinking') card.classList.add('rps-card--thinking');
  if (state === 'picked') card.classList.add('rps-card--picked');
  if (state === 'reveal') {
    // animasyonu yeniden tetiklemek için sınıfı bir frame sonra ekle
    void card.offsetWidth;
    card.classList.add('rps-card--reveal');
  }
}

function resetButtons(): void {
  for (const b of Object.values(buttons)) {
    b.classList.remove('rps-panel__choice--selected', 'rps-panel__choice--dimmed');
    b.disabled = waitingMode;
  }
}

export function showRpsPanel(waiting: boolean): void {
  waitingMode = waiting;
  panelEl.classList.remove('hidden');
  setCard(cardYouEl, '?', 'empty');
  setCard(cardOppEl, waiting ? '···' : '?', waiting ? 'empty' : 'thinking');
  scoreYouEl.textContent = '';
  scoreOppEl.textContent = '';
  resultEl.textContent = waiting ? 'Rakip bekleniyor... biri gelince oyun başlar.' : 'Elini seç! (İlk 5 galibiyet kazanır)';
  resultEl.className = 'rps-panel__result';
  resetButtons();
}

export function hideRpsPanel(): void {
  panelEl.classList.add('hidden');
}

// Rakip seçimini yaptığında kartında "hazır" işareti belirir.
export function setRpsOpponentPicked(): void {
  setCard(cardOppEl, '✓', 'picked');
}

export function renderRpsResult(
  winner: string | 'draw',
  choices: Record<string, Choice>,
  scores: Record<string, number>,
  selfId: string | null,
  matchWinner: string | null,
): void {
  const oppId = Object.keys(choices).find((pid) => pid !== selfId) ?? '';
  const myChoice = selfId ? choices[selfId] : undefined;
  const oppChoice = choices[oppId];

  if (myChoice) setCard(cardYouEl, CHOICE_ICONS[myChoice], 'reveal');
  if (oppChoice) setCard(cardOppEl, CHOICE_ICONS[oppChoice], 'reveal');

  let resultClass = 'rps-panel__result';
  let outcome: string;
  if (matchWinner) {
    // maç bitti: turun galibinden bağımsız, seriyi kim aldı
    if (matchWinner === selfId) {
      outcome = 'Maç bitti — Kazandın!';
      resultClass += ' rps-panel__result--win';
    } else {
      outcome = `Maç bitti — Kazanan: ${displayName(matchWinner)}`;
      resultClass += ' rps-panel__result--lose';
    }
  } else if (winner === 'draw') {
    outcome = 'Berabere! Tekrar seç.';
  } else if (winner === selfId) {
    outcome = 'Turu aldın!';
    resultClass += ' rps-panel__result--win';
  } else {
    outcome = 'Turu kaybettin.';
    resultClass += ' rps-panel__result--lose';
  }
  resultEl.textContent = outcome;
  resultEl.className = resultClass;

  scoreYouEl.textContent = `Sen ${selfId ? scores[selfId] ?? 0 : 0}`;
  scoreOppEl.textContent = `${scores[oppId] ?? 0} ${displayName(oppId)}`;

  if (matchWinner) {
    // butonları kilitle ve "Yeniden Başla"yı göster
    for (const b of Object.values(buttons)) b.disabled = true;
    setRestartVisible(true);
  } else {
    resetButtons();
  }
}
