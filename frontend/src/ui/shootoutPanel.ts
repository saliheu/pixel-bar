import { sendMessage } from '../net/socket.js';
import { displayName } from '../state/store.js';
import { setRestartVisible } from './chatPanel.js';
import { sfx } from './sound.js';
import { GOAL_W, GOAL_H, type ShootMode, type ShotOutcome, type ShotWall } from '../protocol.js';

// Penaltı ve frikik ortak paneli. Saha şutörün gözünden çizilir:
// üstte kale (nişan alınan alan), önünde baraj siluetleri, altta topun durduğu zemin.
//
// Şutör: kaleye nişan al -> güç çubuğunu durdur -> isabet çubuğunu durdur.
// Frikikte ayrıca falso kaydırıcısı; kesikli yörünge topun barajı sıyırıp
// sıyırmadığını canlı gösterir.
// Kaleci: kale ağzında kör bir uzanma noktası seçer (erişim çemberi önizlemeli).

type Phase = 'idle' | 'aim' | 'ready' | 'power' | 'accuracy' | 'sent' | 'result';

const GOAL_PX_W = 320;
const SCALE = GOAL_PX_W / GOAL_W;
const GOAL_PX_H = GOAL_H * SCALE; // ~133
const GROUND_H = 48; // kale altındaki zemin şeridi (topun durduğu yer)
const PITCH_H = GOAL_PX_H + GROUND_H;
const BALL_X = GOAL_PX_W / 2;
const BALL_Y = GOAL_PX_H + 26; // topun duruş noktası

const POWER_PERIOD_MS = 1100;
const accuracyPeriodMs = (p: number): number => Math.max(430, 1000 - p * 5.2);

let panelEl: HTMLDivElement;
let headingEl: HTMLDivElement;
let scoreEl: HTMLDivElement;
let roleEl: HTMLDivElement;
let statusEl: HTMLDivElement;
let pitchEl: HTMLDivElement;
let goalEl: HTMLDivElement;
let markerEl: HTMLDivElement;
let reachEl: HTMLDivElement;
let ballEl: HTMLDivElement;
let keeperEl: HTMLDivElement;
let wallEl: HTMLDivElement;
let pathEl: SVGSVGElement;
let pathLine: SVGPathElement;
let curveRow: HTMLDivElement;
let curveEl: HTMLInputElement;
let barRow: HTMLDivElement;
let barFillEl: HTMLDivElement;
let barMarkerEl: HTMLDivElement;
let barLabelEl: HTMLDivElement;
let actionBtn: HTMLButtonElement;

let mode: ShootMode = 'penalty';
let phase: Phase = 'idle';
let amShooter = false;
let wall: ShotWall | null = null;
let aim: { x: number; y: number } | null = null;
let power = 0;
let barRaf = 0;
let barStart = 0;

const MODE_TITLE: Record<ShootMode, string> = { penalty: 'Penaltı', freekick: 'Frikik — Duvarı Aş' };

function goalToPx(x: number, y: number): { left: number; top: number } {
  return { left: x * SCALE, top: y * SCALE };
}

export function initShootoutPanel(root: HTMLElement): void {
  panelEl = document.createElement('div');
  panelEl.className = 'shootout-panel hidden';

  headingEl = document.createElement('div');
  headingEl.className = 'shootout-panel__heading';
  panelEl.appendChild(headingEl);

  scoreEl = document.createElement('div');
  scoreEl.className = 'shootout-panel__score';
  panelEl.appendChild(scoreEl);

  // ---- saha: kale + baraj + zemin ----
  pitchEl = document.createElement('div');
  pitchEl.className = 'shootout-pitch';
  pitchEl.style.width = `${GOAL_PX_W}px`;
  pitchEl.style.height = `${PITCH_H}px`;

  goalEl = document.createElement('div');
  goalEl.className = 'shootout-pitch__goal';
  goalEl.style.height = `${GOAL_PX_H}px`;
  pitchEl.appendChild(goalEl);

  const ground = document.createElement('div');
  ground.className = 'shootout-pitch__ground';
  ground.style.height = `${GROUND_H}px`;
  pitchEl.appendChild(ground);

  keeperEl = document.createElement('div');
  keeperEl.className = 'shootout-keeper';
  pitchEl.appendChild(keeperEl);

  // baraj: kalenin önünde duran siluetler (yarı saydam, kaleci arkasından görünsün)
  wallEl = document.createElement('div');
  wallEl.className = 'shootout-wall hidden';
  for (let i = 0; i < 4; i++) {
    const man = document.createElement('div');
    man.className = 'shootout-wall__man';
    wallEl.appendChild(man);
  }
  pitchEl.appendChild(wallEl);

  reachEl = document.createElement('div');
  reachEl.className = 'shootout-reach hidden';
  pitchEl.appendChild(reachEl);

  markerEl = document.createElement('div');
  markerEl.className = 'shootout-marker hidden';
  pitchEl.appendChild(markerEl);

  pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  pathEl.setAttribute('class', 'shootout-path hidden');
  pathEl.setAttribute('viewBox', `0 0 ${GOAL_PX_W} ${PITCH_H}`);
  pathLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  pathLine.setAttribute('fill', 'none');
  pathLine.setAttribute('stroke-width', '2.5');
  pathLine.setAttribute('stroke-dasharray', '6 5');
  pathLine.setAttribute('stroke-linecap', 'round');
  pathEl.appendChild(pathLine);
  pitchEl.appendChild(pathEl);

  ballEl = document.createElement('div');
  ballEl.className = 'shootout-ball';
  pitchEl.appendChild(ballEl);

  // nişan/uzanma yalnızca kale ağzından alınır
  goalEl.addEventListener('click', (e) => {
    const rect = goalEl.getBoundingClientRect();
    const gx = ((e.clientX - rect.left) / rect.width) * GOAL_W;
    const gy = ((e.clientY - rect.top) / rect.height) * GOAL_H;
    onGoalClick(gx, gy);
  });
  panelEl.appendChild(pitchEl);

  // ---- falso (yalnız frikik) ----
  curveRow = document.createElement('div');
  curveRow.className = 'shootout-panel__curve hidden';
  const curveLabel = document.createElement('span');
  curveLabel.textContent = 'Falso';
  curveEl = document.createElement('input');
  curveEl.type = 'range';
  curveEl.min = '-100';
  curveEl.max = '100';
  curveEl.step = '1';
  curveEl.value = '0';
  curveEl.addEventListener('input', drawPreview);
  curveRow.append(curveLabel, curveEl);
  panelEl.appendChild(curveRow);

  // ---- güç / isabet çubuğu ----
  barRow = document.createElement('div');
  barRow.className = 'shootout-bar hidden';
  barLabelEl = document.createElement('div');
  barLabelEl.className = 'shootout-bar__label';
  const track = document.createElement('div');
  track.className = 'shootout-bar__track';
  barFillEl = document.createElement('div');
  barFillEl.className = 'shootout-bar__fill';
  barMarkerEl = document.createElement('div');
  barMarkerEl.className = 'shootout-bar__marker';
  const sweet = document.createElement('div');
  sweet.className = 'shootout-bar__sweet';
  track.append(barFillEl, sweet, barMarkerEl);
  barRow.append(barLabelEl, track);
  panelEl.appendChild(barRow);

  actionBtn = document.createElement('button');
  actionBtn.type = 'button';
  actionBtn.className = 'shootout-panel__action';
  actionBtn.addEventListener('click', onAction);
  panelEl.appendChild(actionBtn);

  statusEl = document.createElement('div');
  statusEl.className = 'shootout-panel__status';
  panelEl.appendChild(statusEl);

  roleEl = document.createElement('div');
  roleEl.className = 'shootout-panel__role';
  panelEl.appendChild(roleEl);

  root.appendChild(panelEl);

  // Boşluk tuşu çubukları durdurur / hamleyi onaylar
  window.addEventListener('keydown', (e) => {
    if (e.key !== ' ') return;
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (panelEl.classList.contains('hidden')) return;
    e.preventDefault();
    onAction();
  });
}

function onGoalClick(gx: number, gy: number): void {
  // nişan alma aşamasında (ve nişanı değiştirirken) çalışır
  if (phase !== 'aim' && phase !== 'ready') return;
  aim = { x: gx, y: gy };
  phase = 'ready';

  const { left, top } = goalToPx(gx, gy);
  markerEl.style.left = `${left}px`;
  markerEl.style.top = `${top}px`;
  markerEl.classList.remove('hidden');
  markerEl.classList.toggle('shootout-marker--keeper', !amShooter);

  actionBtn.disabled = false;
  if (amShooter) {
    drawPreview();
    actionBtn.textContent = 'Şutu Çek';
    if (mode !== 'freekick') statusEl.textContent = 'Hazırsan şutu çek.';
  } else {
    // kaleci: ortalama güce göre erişim çemberi önizlemesi
    const r = 48 * SCALE;
    reachEl.style.width = `${r * 2}px`;
    reachEl.style.height = `${r * 2 * 0.45}px`;
    reachEl.style.left = `${left}px`;
    reachEl.style.top = `${top}px`;
    reachEl.classList.remove('hidden');
    keeperEl.style.left = `${left}px`;
    keeperEl.style.top = `${top}px`;
    actionBtn.textContent = 'Buraya Uzan';
    statusEl.textContent = 'Onaylayınca şutör vurur.';
  }
}

// Frikikte topun barajın önünden geçtiği noktayı gösteren kesikli yörünge.
function drawPreview(): void {
  if (mode !== 'freekick' || !aim || !amShooter) {
    pathEl.classList.add('hidden');
    return;
  }
  const curve = Number(curveEl.value);
  const passX = aim.x - curve * 0.75; // topun baraj hizasındaki yanal konumu
  const a = goalToPx(aim.x, aim.y);
  const passPx = passX * SCALE;
  // Quadratic Bezier'in orta noktası passX'ten geçsin diye kontrol noktası:
  const ctrlX = 2 * passPx - 0.5 * BALL_X - 0.5 * a.left;
  const ctrlY = (BALL_Y + a.top) / 2;
  pathLine.setAttribute('d', `M ${BALL_X} ${BALL_Y} Q ${ctrlX} ${ctrlY} ${a.left} ${a.top}`);

  const blocked = wall !== null && aim.y > wall.top && passX > wall.x1 && passX < wall.x2;
  pathLine.setAttribute('stroke', blocked ? '#f87171' : '#4ade80');
  pathEl.classList.remove('hidden');
  statusEl.textContent = blocked ? 'Bu yörünge baraja takılır — falsoyu değiştir.' : 'Yol açık! Şutu çek.';
}

function startBar(kind: 'power' | 'accuracy'): void {
  phase = kind;
  barRow.classList.remove('hidden');
  barRow.classList.toggle('shootout-bar--accuracy', kind === 'accuracy');
  barLabelEl.textContent = kind === 'power' ? 'GÜÇ — durdur' : 'İSABET — ortada durdur';
  actionBtn.textContent = 'DURDUR';
  barStart = performance.now();
  cancelAnimationFrame(barRaf);
  const tick = (): void => {
    const v = readBar(kind);
    if (kind === 'power') barFillEl.style.width = `${v * 100}%`;
    barMarkerEl.style.left = `${v * 100}%`;
    barRaf = requestAnimationFrame(tick);
  };
  tick();
}

function readBar(kind: 'power' | 'accuracy'): number {
  const periodMs = kind === 'power' ? POWER_PERIOD_MS : accuracyPeriodMs(power);
  const t = ((performance.now() - barStart) % periodMs) / periodMs;
  return 1 - Math.abs(1 - 2 * t); // 0 -> 1 -> 0 gidip gelme
}

function onAction(): void {
  if (actionBtn.disabled) return;

  if (phase === 'power') {
    power = readBar('power') * 100;
    cancelAnimationFrame(barRaf);
    barFillEl.style.width = `${power}%`;
    barMarkerEl.style.left = `${power}%`;
    sfx.goal();
    startBar('accuracy');
    return;
  }

  if (phase === 'accuracy') {
    const v = readBar('accuracy');
    cancelAnimationFrame(barRaf);
    barMarkerEl.style.left = `${v * 100}%`;
    const accuracy = (v - 0.5) * 2; // -1..1, 0 = tam isabet
    phase = 'sent';
    actionBtn.disabled = true;
    actionBtn.textContent = 'Şut çekildi';
    statusEl.textContent = 'Kaleci bekleniyor...';
    sendMessage({
      type: 'shoot',
      payload: {
        aimX: aim?.x ?? GOAL_W / 2,
        aimY: aim?.y ?? GOAL_H / 2,
        power,
        accuracy,
        curve: mode === 'freekick' ? Number(curveEl.value) : 0,
      },
    });
    return;
  }

  if (phase !== 'ready' || !aim) return; // önce nişan al

  if (amShooter) {
    curveRow.classList.add('hidden');
    pathEl.classList.add('hidden');
    startBar('power');
    return;
  }

  phase = 'sent';
  actionBtn.disabled = true;
  actionBtn.textContent = 'Uzanıldı';
  statusEl.textContent = 'Şutör bekleniyor...';
  sendMessage({ type: 'dive', payload: { x: aim.x, y: aim.y } });
}

function resetScene(): void {
  cancelAnimationFrame(barRaf);
  aim = null;
  power = 0;
  markerEl.classList.add('hidden');
  reachEl.classList.add('hidden');
  pathEl.classList.add('hidden');
  barRow.classList.add('hidden');
  pitchEl.classList.remove('shootout-pitch--goal', 'shootout-pitch--save', 'shootout-pitch--miss');
  ballEl.classList.remove('shootout-ball--fly');
  ballEl.style.left = `${BALL_X}px`;
  ballEl.style.top = `${BALL_Y}px`;
  keeperEl.style.left = `${GOAL_PX_W / 2}px`;
  keeperEl.style.top = `${GOAL_PX_H * 0.62}px`;
  curveEl.value = '0';
}

export function showShootoutPanel(m: ShootMode, waiting: boolean): void {
  mode = m;
  panelEl.classList.remove('hidden');
  headingEl.textContent = MODE_TITLE[m];
  scoreEl.textContent = '';
  roleEl.textContent = '';
  wallEl.classList.add('hidden');
  resetScene();
  phase = 'idle';
  actionBtn.disabled = true;
  actionBtn.textContent = 'Bekleniyor';
  statusEl.textContent = waiting ? 'Rakip bekleniyor... biri gelince maç başlar.' : 'Hazırlanılıyor...';
}

export function hideShootoutPanel(): void {
  panelEl.classList.add('hidden');
  cancelAnimationFrame(barRaf);
  phase = 'idle';
}

export function renderShootoutState(
  m: ShootMode,
  p: 'pick' | 'result',
  kick: number,
  totalKicks: number,
  shooter: string,
  scores: Record<string, number>,
  waitingOn: string[],
  w: ShotWall | null,
  last: { shooter: string; landX: number; landY: number; diveX: number; diveY: number; reach: number; outcome: ShotOutcome } | null,
  suddenDeath: boolean,
  matchWinner: string | null,
  selfId: string | null,
): void {
  mode = m;
  wall = w;
  headingEl.textContent = MODE_TITLE[m];
  scoreEl.textContent = Object.entries(scores)
    .map(([pid, s]) => `${pid === selfId ? 'Sen' : displayName(pid)}: ${s}`)
    .join('  ·  ');

  // baraj: kalenin önünde, w.top'tan yere kadar
  if (w) {
    const a = goalToPx(w.x1, w.top);
    const b = goalToPx(w.x2, GOAL_H);
    wallEl.style.left = `${a.left}px`;
    wallEl.style.top = `${a.top}px`;
    wallEl.style.width = `${b.left - a.left}px`;
    wallEl.style.height = `${b.top - a.top}px`;
    wallEl.classList.remove('hidden');
  } else {
    wallEl.classList.add('hidden');
  }

  if (p === 'pick') {
    resetScene();
    amShooter = shooter === selfId;
    const kickLabel = suddenDeath ? 'Altın vuruş!' : `Vuruş ${Math.min(kick, totalKicks)}/${totalKicks}`;
    roleEl.textContent = amShooter ? `${kickLabel} — Şut sende` : `${kickLabel} — Kalecisin`;
    roleEl.classList.toggle('shootout-panel__role--shooter', amShooter);
    curveRow.classList.toggle('hidden', !(amShooter && m === 'freekick'));

    if (selfId !== null && !waitingOn.includes(selfId)) {
      phase = 'sent'; // hamlemi yaptım, rakip bekleniyor
      actionBtn.disabled = true;
      actionBtn.textContent = 'Bekleniyor';
      statusEl.textContent = 'Rakip bekleniyor...';
      return;
    }

    phase = 'aim';
    actionBtn.disabled = true;
    actionBtn.textContent = amShooter ? 'Önce nişan al' : 'Önce nokta seç';
    statusEl.textContent = amShooter
      ? m === 'freekick'
        ? 'Kaleye nişan al — barajın etrafından dolan ya da üstünden aşır.'
        : 'Kale ağzında bir nokta seç.'
      : 'Nereye uzanacağını seç (şutu göremezsin).';
    return;
  }

  // ---- result: topu ve kaleciyi animasyonla göster ----
  phase = 'result';
  actionBtn.disabled = true;
  actionBtn.textContent = 'Vuruş bitti';
  barRow.classList.add('hidden');
  curveRow.classList.add('hidden');
  markerEl.classList.add('hidden');
  pathEl.classList.add('hidden');

  if (last) {
    const land = goalToPx(last.landX, last.landY);
    const dive = goalToPx(last.diveX, last.diveY);

    reachEl.style.width = `${last.reach * SCALE * 2}px`;
    reachEl.style.height = `${last.reach * SCALE * 2 * 0.45}px`;
    reachEl.style.left = `${dive.left}px`;
    reachEl.style.top = `${dive.top}px`;
    reachEl.classList.remove('hidden');
    keeperEl.style.left = `${dive.left}px`;
    keeperEl.style.top = `${dive.top}px`;

    // top zeminden kalkıp düştüğü noktaya uçar
    ballEl.classList.remove('shootout-ball--fly');
    ballEl.style.left = `${BALL_X}px`;
    ballEl.style.top = `${BALL_Y}px`;
    void ballEl.offsetWidth; // animasyonu yeniden tetikle
    ballEl.classList.add('shootout-ball--fly');
    ballEl.style.left = `${land.left}px`;
    ballEl.style.top = `${land.top}px`;

    pitchEl.classList.add(
      last.outcome === 'goal' ? 'shootout-pitch--goal' : last.outcome === 'save' ? 'shootout-pitch--save' : 'shootout-pitch--miss',
    );

    const who = last.shooter === selfId ? 'Sen' : displayName(last.shooter);
    const TEXT: Record<ShotOutcome, string> = {
      goal: `GOL! (${who})`,
      save: `Kaleci kurtardı! (${who})`,
      miss: `Auta gitti! (${who})`,
      blocked: `Baraja takıldı! (${who})`,
    };
    statusEl.textContent = TEXT[last.outcome];
  }

  if (matchWinner) {
    const won = matchWinner === selfId;
    roleEl.textContent = won ? 'Maç bitti — Kazandın!' : `Maç bitti — Kazanan: ${displayName(matchWinner)}`;
    setRestartVisible(true);
  }
}
