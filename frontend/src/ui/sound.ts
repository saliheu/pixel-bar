// Minik sentez ses efektleri (WebAudio, harici dosya yok).
// Tarayıcı politikası gereği AudioContext ilk kullanıcı etkileşiminde açılır.

const MUTE_KEY = 'pikselbar.muted';

let ctx: AudioContext | null = null;
let muted = localStorage.getItem(MUTE_KEY) === '1';

function ensureCtx(): AudioContext | null {
  if (typeof AudioContext === 'undefined') return null;
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function initSound(): void {
  const unlock = () => ensureCtx();
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });
}

export function isMuted(): boolean {
  return muted;
}

export function toggleMute(): boolean {
  muted = !muted;
  localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  return muted;
}

function tone(freq: number, durMs: number, type: OscillatorType = 'square', gain = 0.025, delayMs = 0): void {
  if (muted) return;
  const ac = ensureCtx();
  if (!ac || ac.state !== 'running') return;
  const t0 = ac.currentTime + delayMs / 1000;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + durMs / 1000);
  osc.connect(g).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + durMs / 1000 + 0.02);
}

// ---- Jukebox: küçük lo-fi chiptune döngüsü (16 adım, tamamen sentez) ----
let musicTimer: ReturnType<typeof setInterval> | null = null;
let musicStep = 0;

// A minör pentatonik üzerinde hafif bir bar teması
const BASS = [110, 0, 110, 0, 130.8, 0, 98, 0, 110, 0, 110, 0, 87.3, 0, 98, 0];
const LEAD = [0, 440, 523.3, 0, 587.3, 0, 523.3, 440, 0, 392, 440, 0, 329.6, 0, 392, 0];

export function isMusicOn(): boolean {
  return musicTimer !== null;
}

export function toggleMusic(): boolean {
  if (musicTimer) {
    clearInterval(musicTimer);
    musicTimer = null;
    return false;
  }
  ensureCtx();
  musicStep = 0;
  musicTimer = setInterval(() => {
    const bass = BASS[musicStep % BASS.length];
    const lead = LEAD[musicStep % LEAD.length];
    if (bass) tone(bass, 180, 'triangle', 0.02);
    if (lead) tone(lead, 140, 'square', 0.008);
    if (musicStep % 4 === 0) tone(2200, 25, 'square', 0.004); // hi-hat tıkırtısı
    musicStep++;
  }, 200);
  return true;
}

// Retro-arcade tarzı küçük efektler.
export const sfx = {
  // bara ilk giriş: yükselen 4 notalık karşılama
  welcome(): void {
    tone(392, 90, 'triangle', 0.025);
    tone(523, 90, 'triangle', 0.025, 90);
    tone(659, 90, 'triangle', 0.025, 180);
    tone(784, 220, 'triangle', 0.03, 270);
  },
  chat(): void {
    tone(880, 70, 'sine', 0.02);
  },
  emote(): void {
    tone(587, 60, 'triangle', 0.03);
    tone(784, 80, 'triangle', 0.03, 60);
  },
  sit(): void {
    tone(392, 80, 'sine', 0.025);
  },
  join(): void {
    tone(523, 70, 'triangle', 0.025);
    tone(659, 90, 'triangle', 0.025, 70);
  },
  win(): void {
    tone(523, 110, 'square', 0.025);
    tone(659, 110, 'square', 0.025, 110);
    tone(784, 200, 'square', 0.03, 220);
  },
  lose(): void {
    tone(330, 130, 'square', 0.02);
    tone(262, 220, 'square', 0.02, 130);
  },
  match(): void {
    tone(698, 70, 'triangle', 0.03);
    tone(932, 110, 'triangle', 0.03, 70);
  },
  goal(): void {
    tone(440, 60, 'square', 0.02);
    tone(880, 90, 'square', 0.02, 60);
  },
};
