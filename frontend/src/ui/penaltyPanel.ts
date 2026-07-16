import { sendMessage } from '../net/socket.js';
import { displayName } from '../state/store.js';
import { setRestartVisible } from './chatPanel.js';
import type { PenaltyDir } from '../protocol.js';

// Penaltı paneli: mini kale görseli, üç köşe butonu, skor ve vuruş sayacı.
// Şutör gol atmaya, kaleci doğru köşeye uzanmaya çalışır (aynı köşe = kurtarış).

let panelEl: HTMLDivElement;
let goalEl: HTMLDivElement;
let ballEl: HTMLDivElement;
let keeperEl: HTMLDivElement;
let scoreEl: HTMLDivElement;
let roleEl: HTMLDivElement;
let statusEl: HTMLDivElement;
let buttons: Record<PenaltyDir, HTMLButtonElement>;
let picked = false;
let waitingMode = false;

const DIR_LABEL: Record<PenaltyDir, string> = { left: 'Sol', mid: 'Orta', right: 'Sağ' };
const DIR_POS: Record<PenaltyDir, string> = { left: '14%', mid: '50%', right: '86%' };

export function initPenaltyPanel(root: HTMLElement): void {
  panelEl = document.createElement('div');
  panelEl.className = 'penalty-panel hidden';

  const heading = document.createElement('div');
  heading.className = 'penalty-panel__heading';
  heading.textContent = 'Penaltı';
  panelEl.appendChild(heading);

  scoreEl = document.createElement('div');
  scoreEl.className = 'penalty-panel__score';
  panelEl.appendChild(scoreEl);

  // mini kale sahnesi
  goalEl = document.createElement('div');
  goalEl.className = 'penalty-goal';
  keeperEl = document.createElement('div');
  keeperEl.className = 'penalty-goal__keeper';
  ballEl = document.createElement('div');
  ballEl.className = 'penalty-goal__ball';
  goalEl.appendChild(keeperEl);
  goalEl.appendChild(ballEl);
  panelEl.appendChild(goalEl);

  roleEl = document.createElement('div');
  roleEl.className = 'penalty-panel__role';
  panelEl.appendChild(roleEl);

  const row = document.createElement('div');
  row.className = 'penalty-panel__buttons';
  buttons = {} as Record<PenaltyDir, HTMLButtonElement>;
  (['left', 'mid', 'right'] as PenaltyDir[]).forEach((dir) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'penalty-panel__choice';
    btn.textContent = DIR_LABEL[dir];
    btn.addEventListener('click', () => {
      if (picked || waitingMode) return;
      picked = true;
      sendMessage({ type: 'penalty_pick', payload: { dir } });
      for (const [d, b] of Object.entries(buttons)) {
        b.classList.toggle('penalty-panel__choice--selected', d === dir);
        b.disabled = true;
      }
      statusEl.textContent = 'Rakip bekleniyor...';
    });
    buttons[dir] = btn;
    row.appendChild(btn);
  });
  panelEl.appendChild(row);

  statusEl = document.createElement('div');
  statusEl.className = 'penalty-panel__status';
  panelEl.appendChild(statusEl);

  root.appendChild(panelEl);
}

function resetScene(): void {
  ballEl.className = 'penalty-goal__ball';
  ballEl.style.removeProperty('--target-x');
  keeperEl.className = 'penalty-goal__keeper';
  keeperEl.style.removeProperty('--dive-x');
}

function resetButtons(disabled: boolean): void {
  picked = false;
  for (const b of Object.values(buttons)) {
    b.classList.remove('penalty-panel__choice--selected');
    b.disabled = disabled;
  }
}

export function showPenaltyPanel(waiting: boolean): void {
  waitingMode = waiting;
  panelEl.classList.remove('hidden');
  scoreEl.textContent = '';
  roleEl.textContent = '';
  resetScene();
  resetButtons(waiting);
  statusEl.textContent = waiting ? 'Rakip bekleniyor... biri gelince maç başlar.' : 'Hazırlanılıyor...';
}

export function hidePenaltyPanel(): void {
  panelEl.classList.add('hidden');
}

export function renderPenaltyState(
  phase: 'pick' | 'result',
  kick: number,
  totalKicks: number,
  shooter: string,
  scores: Record<string, number>,
  waitingOn: string[],
  last: { shooter: string; shot: PenaltyDir; dive: PenaltyDir; goal: boolean } | null,
  suddenDeath: boolean,
  matchWinner: string | null,
  selfId: string | null,
): void {
  waitingMode = false;

  scoreEl.textContent = Object.entries(scores)
    .map(([pid, s]) => `${pid === selfId ? 'Sen' : displayName(pid)}: ${s}`)
    .join('  ·  ');

  if (phase === 'pick') {
    resetScene();
    const amShooter = shooter === selfId;
    const kickLabel = suddenDeath ? 'Altın vuruş!' : `Vuruş ${Math.min(kick, totalKicks)}/${totalKicks}`;
    roleEl.textContent = amShooter ? `${kickLabel} — Şut çekiyorsun` : `${kickLabel} — Kalecisin`;
    roleEl.classList.toggle('penalty-panel__role--shooter', amShooter);
    const iPicked = selfId !== null && !waitingOn.includes(selfId);
    resetButtons(false);
    if (iPicked) {
      picked = true;
      for (const b of Object.values(buttons)) b.disabled = true;
      statusEl.textContent = 'Rakip bekleniyor...';
    } else {
      statusEl.textContent = amShooter ? 'Köşeni seç ve şutu çek!' : 'Bir köşeye uzan!';
    }
    return;
  }

  // result: top seçilen köşeye uçar, kaleci seçtiği köşeye uzanır
  if (last) {
    ballEl.style.setProperty('--target-x', DIR_POS[last.shot]);
    keeperEl.style.setProperty('--dive-x', DIR_POS[last.dive]);
    ballEl.classList.add('penalty-goal__ball--shot');
    keeperEl.classList.add('penalty-goal__keeper--dive');
    goalEl.classList.remove('penalty-goal--goal', 'penalty-goal--save');
    void goalEl.offsetWidth;
    goalEl.classList.add(last.goal ? 'penalty-goal--goal' : 'penalty-goal--save');

    const shooterName = last.shooter === selfId ? 'Sen' : displayName(last.shooter);
    statusEl.textContent = last.goal ? `GOL! (${shooterName})` : `Kaleci kurtardı! (${shooterName})`;
  }
  for (const b of Object.values(buttons)) b.disabled = true;

  if (matchWinner) {
    const won = matchWinner === selfId;
    roleEl.textContent = won ? 'Maç bitti — Kazandın!' : `Maç bitti — Kazanan: ${displayName(matchWinner)}`;
    setRestartVisible(true);
  }
}
