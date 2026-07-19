import { sendMessage } from '../net/socket.js';
import { displayName } from '../state/store.js';
import { setRestartVisible } from './chatPanel.js';
import { sfx } from './sound.js';

// Dart 301. Atış iki aşamalı süpüren nişangahla yapılır:
// önce dikey çizgi yatayda süpürür (X kilitle), sonra yatay çizgi dikeyde süpürür (Y kilitle).
// Kilit anındaki isabet beceriyi belirler; sunucu küçük bir sapma ekler.

const SVG_NS = 'http://www.w3.org/2000/svg';
const VIEW = 240; // görüntü kutusu -120..120
const R = 100; // tahta yarıçapı (board birimi)

const NUMBERS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

type Phase = 'idle' | 'x' | 'y' | 'sent' | 'result';

let panelEl: HTMLDivElement;
let headingEl: HTMLDivElement;
let scoreEl: HTMLDivElement;
let roleEl: HTMLDivElement;
let statusEl: HTMLDivElement;
let dartsRowEl: HTMLDivElement;
let fxG: SVGGElement;
let actionBtn: HTMLButtonElement;

let phase: Phase = 'idle';
let amThrower = false;
let xLock = 0;
let raf = 0;
let sweepStart = 0;

const SWEEP_MS = 1500;

function polar(aDeg: number, r: number): [number, number] {
  const a = (aDeg * Math.PI) / 180;
  return [r * Math.cos(a), r * Math.sin(a)];
}

function seg(rIn: number, rOut: number, a0: number, a1: number, fill: string): SVGPathElement {
  const [x0o, y0o] = polar(a0, rOut);
  const [x1o, y1o] = polar(a1, rOut);
  const [x1i, y1i] = polar(a1, rIn);
  const [x0i, y0i] = polar(a0, rIn);
  const p = document.createElementNS(SVG_NS, 'path');
  p.setAttribute(
    'd',
    `M ${x0o} ${y0o} A ${rOut} ${rOut} 0 0 1 ${x1o} ${y1o} L ${x1i} ${y1i} A ${rIn} ${rIn} 0 0 0 ${x0i} ${y0i} Z`,
  );
  p.setAttribute('fill', fill);
  return p;
}

function buildBoard(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `${-VIEW / 2} ${-VIEW / 2} ${VIEW} ${VIEW}`);
  svg.setAttribute('class', 'dart-board');

  // dış kasa
  const rim = document.createElementNS(SVG_NS, 'circle');
  rim.setAttribute('r', String(R + 16));
  rim.setAttribute('fill', '#120f1e');
  rim.setAttribute('stroke', '#3a3455');
  rim.setAttribute('stroke-width', '2');
  svg.appendChild(rim);

  const CREAM = '#e8dfc8';
  const DARK = '#2a2438';
  const RED = '#d64545';
  const GREEN = '#3a9d5a';

  for (let i = 0; i < 20; i++) {
    const a0 = -90 + i * 18 - 9;
    const a1 = -90 + i * 18 + 9;
    const light = i % 2 === 0;
    // tek alan (bull ile double arası, ring bölgeleri sonra üzerine gelir)
    svg.appendChild(seg(12, R, a0, a1, light ? CREAM : DARK));
    // triple ring 56-64, double ring 92-100
    svg.appendChild(seg(56, 64, a0, a1, light ? GREEN : RED));
    svg.appendChild(seg(92, R, a0, a1, light ? GREEN : RED));
  }

  // bull
  const bull25 = document.createElementNS(SVG_NS, 'circle');
  bull25.setAttribute('r', '12');
  bull25.setAttribute('fill', '#3a9d5a');
  svg.appendChild(bull25);
  const bull50 = document.createElementNS(SVG_NS, 'circle');
  bull50.setAttribute('r', '5');
  bull50.setAttribute('fill', '#d64545');
  svg.appendChild(bull50);

  // rakamlar (tahtanın dışında)
  for (let i = 0; i < 20; i++) {
    const [tx, ty] = polar(-90 + i * 18, R + 11);
    const t = document.createElementNS(SVG_NS, 'text');
    t.setAttribute('x', String(tx));
    t.setAttribute('y', String(ty));
    t.setAttribute('class', 'dart-board__num');
    t.textContent = String(NUMBERS[i]);
    svg.appendChild(t);
  }

  // dinamik katman (nişangah + saplanan dartlar)
  fxG = document.createElementNS(SVG_NS, 'g');
  svg.appendChild(fxG);
  return svg;
}

function clearFx(): void {
  while (fxG.firstChild) fxG.removeChild(fxG.firstChild);
}

function drawDartMarker(x: number, y: number, highlight: boolean): void {
  const g = document.createElementNS(SVG_NS, 'g');
  const tail = document.createElementNS(SVG_NS, 'line');
  tail.setAttribute('x1', String(x + 7));
  tail.setAttribute('y1', String(y - 7));
  tail.setAttribute('x2', String(x));
  tail.setAttribute('y2', String(y));
  tail.setAttribute('stroke', highlight ? '#fbbf24' : '#cbd5e1');
  tail.setAttribute('stroke-width', '1.6');
  const tip = document.createElementNS(SVG_NS, 'circle');
  tip.setAttribute('cx', String(x));
  tip.setAttribute('cy', String(y));
  tip.setAttribute('r', highlight ? '3.2' : '2.4');
  tip.setAttribute('fill', highlight ? '#fbbf24' : '#e8e2d6');
  tip.setAttribute('stroke', '#1c1730');
  tip.setAttribute('stroke-width', '1');
  g.append(tail, tip);
  fxG.appendChild(g);
}

// süpüren nişangah çizgisi
let sweepLine: SVGLineElement | null = null;
function startSweep(kind: 'x' | 'y'): void {
  phase = kind;
  sweepStart = performance.now();
  actionBtn.disabled = false;
  actionBtn.textContent = 'KİLİTLE';
  statusEl.textContent = kind === 'x' ? 'Yatayı ayarla: KİLİTLE' : 'Dikeyi ayarla: KİLİTLE';
  cancelAnimationFrame(raf);
  const tick = (): void => {
    const v = sweepValue(); // -R..R
    if (!sweepLine) {
      sweepLine = document.createElementNS(SVG_NS, 'line');
      sweepLine.setAttribute('class', 'dart-sweep');
      fxG.appendChild(sweepLine);
    }
    if (kind === 'x') {
      sweepLine.setAttribute('x1', String(v));
      sweepLine.setAttribute('y1', String(-R));
      sweepLine.setAttribute('x2', String(v));
      sweepLine.setAttribute('y2', String(R));
    } else {
      // X kilitli göster
      sweepLine.setAttribute('x1', String(-R));
      sweepLine.setAttribute('y1', String(v));
      sweepLine.setAttribute('x2', String(R));
      sweepLine.setAttribute('y2', String(v));
    }
    raf = requestAnimationFrame(tick);
  };
  tick();
}

function sweepValue(): number {
  const t = ((performance.now() - sweepStart) % SWEEP_MS) / SWEEP_MS;
  const tri = 1 - Math.abs(1 - 2 * t); // 0..1 gidip gel
  return (tri * 2 - 1) * R; // -R..R
}

function onAction(): void {
  if (actionBtn.disabled) return;
  if (phase === 'x') {
    xLock = sweepValue();
    cancelAnimationFrame(raf);
    // kilitli X'i sabit çiz
    clearFx();
    sweepLine = null;
    const lx = document.createElementNS(SVG_NS, 'line');
    lx.setAttribute('class', 'dart-sweep dart-sweep--locked');
    lx.setAttribute('x1', String(xLock));
    lx.setAttribute('y1', String(-R));
    lx.setAttribute('x2', String(xLock));
    lx.setAttribute('y2', String(R));
    fxG.appendChild(lx);
    sfx.goal();
    startSweep('y');
    return;
  }
  if (phase === 'y') {
    const yLock = sweepValue();
    cancelAnimationFrame(raf);
    phase = 'sent';
    actionBtn.disabled = true;
    actionBtn.textContent = 'Atıldı';
    statusEl.textContent = 'Dart uçuyor...';
    sendMessage({ type: 'dart_throw', payload: { x: xLock, y: yLock } });
  }
}

export function initDartPanel(root: HTMLElement): void {
  panelEl = document.createElement('div');
  panelEl.className = 'dart-panel hidden';

  headingEl = document.createElement('div');
  headingEl.className = 'dart-panel__heading';
  headingEl.textContent = 'Dart · 301';
  panelEl.appendChild(headingEl);

  scoreEl = document.createElement('div');
  scoreEl.className = 'dart-panel__score';
  panelEl.appendChild(scoreEl);

  const boardWrap = document.createElement('div');
  boardWrap.className = 'dart-panel__board';
  boardWrap.appendChild(buildBoard());
  boardWrap.addEventListener('click', () => onAction());
  panelEl.appendChild(boardWrap);

  dartsRowEl = document.createElement('div');
  dartsRowEl.className = 'dart-panel__darts';
  panelEl.appendChild(dartsRowEl);

  actionBtn = document.createElement('button');
  actionBtn.type = 'button';
  actionBtn.className = 'dart-panel__action';
  actionBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    onAction();
  });
  panelEl.appendChild(actionBtn);

  statusEl = document.createElement('div');
  statusEl.className = 'dart-panel__status';
  panelEl.appendChild(statusEl);

  roleEl = document.createElement('div');
  roleEl.className = 'dart-panel__role';
  panelEl.appendChild(roleEl);

  root.appendChild(panelEl);

  window.addEventListener('keydown', (e) => {
    if (e.key !== ' ') return;
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (panelEl.classList.contains('hidden')) return;
    e.preventDefault();
    onAction();
  });
}

function renderDartsRow(count: number): void {
  dartsRowEl.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const d = document.createElement('span');
    d.className = 'dart-panel__pip' + (i < count ? ' dart-panel__pip--used' : '');
    dartsRowEl.appendChild(d);
  }
}

export function showDartPanel(waiting: boolean): void {
  panelEl.classList.remove('hidden');
  scoreEl.textContent = '';
  roleEl.textContent = '';
  clearFx();
  sweepLine = null;
  phase = 'idle';
  actionBtn.disabled = true;
  actionBtn.textContent = 'Bekleniyor';
  renderDartsRow(0);
  statusEl.textContent = waiting ? 'Rakip bekleniyor... biri gelince maç başlar.' : 'Hazırlanılıyor...';
}

export function hideDartPanel(): void {
  panelEl.classList.add('hidden');
  cancelAnimationFrame(raf);
  phase = 'idle';
}

export function renderDartState(
  p: 'aim' | 'result',
  thrower: string,
  remaining: Record<string, number>,
  turnDarts: { x: number; y: number; score: number }[],
  lastDart: { x: number; y: number; score: number } | null,
  bust: boolean,
  matchWinner: string | null,
  selfId: string | null,
): void {
  scoreEl.textContent = Object.entries(remaining)
    .map(([pid, r]) => `${pid === selfId ? 'Sen' : displayName(pid)}: ${r}`)
    .join('   —   ');

  amThrower = thrower === selfId;
  renderDartsRow(turnDarts.length);

  // saplanan dartları çiz (bu turdakiler + son atış)
  cancelAnimationFrame(raf);
  clearFx();
  sweepLine = null;
  for (const d of turnDarts) drawDartMarker(d.x, d.y, false);
  if (lastDart) drawDartMarker(lastDart.x, lastDart.y, true);

  if (p === 'result') {
    phase = 'result';
    actionBtn.disabled = true;
    actionBtn.textContent = 'Sıradaki...';
    const who = thrower === selfId ? 'Sen' : displayName(thrower);
    if (bust) {
      statusEl.textContent = `${lastDart ? lastDart.score + ' — ' : ''}BATTI! Tur yandı.`;
    } else if (lastDart) {
      const label = lastDart.score === 50 ? 'BULLSEYE!' : lastDart.score === 0 ? 'Iska!' : `${lastDart.score} puan`;
      statusEl.textContent = `${who}: ${label}`;
    }
    roleEl.textContent = '';
    if (matchWinner) {
      const won = matchWinner === selfId;
      roleEl.textContent = won ? 'Maç bitti — Kazandın!' : `Maç bitti — Kazanan: ${displayName(matchWinner)}`;
      setRestartVisible(true);
    }
    return;
  }

  // aim
  const remLabel = selfId ? remaining[selfId] : 0;
  roleEl.textContent = amThrower ? `Sıra sende — kalan ${remLabel}` : `Sıra: ${displayName(thrower)}`;
  roleEl.classList.toggle('dart-panel__role--mine', amThrower);
  if (amThrower) {
    startSweep('x');
  } else {
    phase = 'idle';
    actionBtn.disabled = true;
    actionBtn.textContent = 'Rakip atıyor';
    statusEl.textContent = 'Rakibin atışını izle.';
  }
}
