import { sendMessage } from '../net/socket.js';
import { displayName } from '../state/store.js';
import { setRestartVisible } from './chatPanel.js';

let panelEl: HTMLDivElement;
let padEl: HTMLButtonElement;
let statusEl: HTMLDivElement;
let scoreEl: HTMLDivElement;
let waitingMode = false;
let currentPhase: 'get_ready' | 'armed' | 'result' | 'idle' = 'idle';

function press(): void {
  if (waitingMode || currentPhase === 'idle' || currentPhase === 'result') return;
  sendMessage({ type: 'reflex_press', payload: {} });
}

export function initReflexPanel(root: HTMLElement): void {
  panelEl = document.createElement('div');
  panelEl.className = 'reflex-panel hidden';

  const heading = document.createElement('div');
  heading.className = 'reflex-panel__heading';
  heading.textContent = 'Refleks Düellosu';
  panelEl.appendChild(heading);

  scoreEl = document.createElement('div');
  scoreEl.className = 'reflex-panel__score';
  panelEl.appendChild(scoreEl);

  padEl = document.createElement('button');
  padEl.type = 'button';
  padEl.className = 'reflex-pad-btn';
  padEl.textContent = '···';
  padEl.addEventListener('click', press);
  panelEl.appendChild(padEl);

  statusEl = document.createElement('div');
  statusEl.className = 'reflex-panel__status';
  panelEl.appendChild(statusEl);

  root.appendChild(panelEl);

  // Boşluk tuşu da basma sayılır (yazı yazarken değil)
  window.addEventListener('keydown', (e) => {
    if (e.key !== ' ') return;
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (panelEl.classList.contains('hidden')) return;
    e.preventDefault();
    press();
  });
}

function setPad(state: 'idle' | 'get_ready' | 'armed', label: string): void {
  padEl.classList.remove('reflex-pad-btn--ready', 'reflex-pad-btn--armed');
  if (state === 'get_ready') padEl.classList.add('reflex-pad-btn--ready');
  if (state === 'armed') padEl.classList.add('reflex-pad-btn--armed');
  padEl.textContent = label;
}

export function showReflexPanel(waiting: boolean): void {
  waitingMode = waiting;
  currentPhase = 'idle';
  panelEl.classList.remove('hidden');
  scoreEl.textContent = '';
  setPad('idle', '···');
  statusEl.textContent = waiting
    ? 'Rakip bekleniyor... biri gelince düello başlar.'
    : 'Hazırlanılıyor...';
}

export function hideReflexPanel(): void {
  panelEl.classList.add('hidden');
  currentPhase = 'idle';
}

export function renderReflexState(
  phase: 'get_ready' | 'armed' | 'result',
  round: number,
  scores: Record<string, number>,
  lastWinner: string | null,
  falseStart: string | null,
  matchWinner: string | null,
  selfId: string | null,
): void {
  waitingMode = false;
  currentPhase = phase;

  scoreEl.textContent = Object.entries(scores)
    .map(([pid, s]) => `${pid === selfId ? 'Sen' : displayName(pid)}: ${s}`)
    .join('  ·  ');

  if (phase === 'get_ready') {
    setPad('get_ready', 'BEKLE...');
    statusEl.textContent = `Tur ${round} — Yeşili görünce bas! (tık ya da Boşluk)`;
    return;
  }
  if (phase === 'armed') {
    setPad('armed', 'BAS!');
    statusEl.textContent = 'ŞİMDİ!';
    return;
  }

  // result
  setPad('idle', '···');
  let text: string;
  if (falseStart) {
    text = falseStart === selfId ? 'Erken bastın! Tur rakibin.' : `${displayName(falseStart)} erken bastı! Tur senin.`;
  } else if (lastWinner === selfId) {
    text = 'Hızlısın! Turu aldın.';
  } else if (lastWinner) {
    text = `${displayName(lastWinner)} daha hızlıydı.`;
  } else {
    text = '';
  }

  if (matchWinner) {
    const won = matchWinner === selfId;
    statusEl.textContent = `${text} Maç bitti — ${won ? 'Kazandın!' : `Kazanan: ${displayName(matchWinner)}`}`;
    setRestartVisible(true);
  } else {
    statusEl.textContent = `${text} Yeni tur geliyor...`;
  }
}
