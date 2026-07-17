import { SHOOTOUT_KICKS_EACH } from '../config.js';
import { GOAL_W, GOAL_H, type ShootMode, type ShotOutcome, type ShotWall } from '../protocol.js';

// Penaltı ve frikik ortak iskeleti ("shootout"):
// Şutör kale ağzında bir nokta seçer, güç ve isabet çubuklarını durdurur;
// kaleci kör olarak bir uzanma noktası seçer. Top nişanın isabet hatasıyla
// kaydırılmış haline düşer; kalecinin erişim çemberine girerse kurtarılır.
// Frikikte ayrıca önde bir baraj vardır: falso ile etrafından dolanmak ya da
// üstünden aşırmak gerekir.

export interface Shot {
  aimX: number;
  aimY: number;
  power: number; // 0..100
  accuracy: number; // -1..1 (0 = tam isabet)
  curve: number; // -100..100 (yalnız frikikte kullanılır)
}

export interface Dive {
  x: number;
  y: number;
}

export interface ShootoutResult {
  shooter: string;
  landX: number;
  landY: number;
  diveX: number;
  diveY: number;
  reach: number;
  outcome: ShotOutcome;
}

export interface ShootoutGame {
  mode: ShootMode;
  kick: number;
  shooterIdx: 0 | 1;
  turnOrder: [string, string];
  shot: Shot | null;
  dive: Dive | null;
  scores: Record<string, number>;
  wall: ShotWall | null;
  last: ShootoutResult | null;
  suddenDeath: boolean;
  ended: boolean;
  nextKickTimer: NodeJS.Timeout | null;
}

// Baraj her vuruşta rastgele bir yere kurulur; şutörün falso planı değişsin diye.
function makeWall(): ShotWall {
  const width = 74;
  const cx = 62 + Math.random() * 116; // 62..178
  return { x1: cx - width / 2, x2: cx + width / 2, top: 42 };
}

export function initShootout(mode: ShootMode, playerIds: [string, string]): ShootoutGame {
  return {
    mode,
    kick: 1,
    shooterIdx: 0,
    turnOrder: playerIds,
    shot: null,
    dive: null,
    scores: { [playerIds[0]]: 0, [playerIds[1]]: 0 },
    wall: mode === 'freekick' ? makeWall() : null,
    last: null,
    suddenDeath: false,
    ended: false,
    nextKickTimer: null,
  };
}

export function resetShootout(game: ShootoutGame): void {
  clearShootoutTimer(game);
  game.kick = 1;
  game.shooterIdx = 0;
  game.shot = null;
  game.dive = null;
  game.scores = { [game.turnOrder[0]]: 0, [game.turnOrder[1]]: 0 };
  game.wall = game.mode === 'freekick' ? makeWall() : null;
  game.last = null;
  game.suddenDeath = false;
  game.ended = false;
}

export function clearShootoutTimer(game: ShootoutGame): void {
  if (game.nextKickTimer) {
    clearTimeout(game.nextKickTimer);
    game.nextKickTimer = null;
  }
}

export function currentShooter(game: ShootoutGame): string {
  return game.turnOrder[game.shooterIdx];
}

export function currentKeeper(game: ShootoutGame): string {
  return game.turnOrder[game.shooterIdx === 0 ? 1 : 0];
}

// Kalecinin erişim yarıçapı: şut ne kadar sertse o kadar daralır (risk/ödül).
export function keeperReach(power: number): number {
  return 62 - clamp(power, 0, 100) * 0.28; // 62 -> 34 px
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// Gelen şutu güvenli aralıklara çeker (istemciye güvenilmez).
export function sanitizeShot(raw: Partial<Shot>): Shot | null {
  const nums = [raw.aimX, raw.aimY, raw.power, raw.accuracy, raw.curve];
  if (nums.some((n) => typeof n !== 'number' || !Number.isFinite(n))) return null;
  return {
    aimX: clamp(raw.aimX!, 0, GOAL_W),
    aimY: clamp(raw.aimY!, 0, GOAL_H),
    power: clamp(raw.power!, 0, 100),
    accuracy: clamp(raw.accuracy!, -1, 1),
    curve: clamp(raw.curve!, -100, 100),
  };
}

export function sanitizeDive(raw: Partial<Dive>): Dive | null {
  if (typeof raw.x !== 'number' || typeof raw.y !== 'number') return null;
  if (!Number.isFinite(raw.x) || !Number.isFinite(raw.y)) return null;
  return { x: clamp(raw.x, 0, GOAL_W), y: clamp(raw.y, 0, GOAL_H) };
}

// Şut sonucu: isabet hatası nişanı kaydırır, sert şutta sapma büyür.
function computeOutcome(game: ShootoutGame, shooter: string, shot: Shot, dive: Dive): ShootoutResult {
  const devX = shot.accuracy * (22 + shot.power * 0.55); // ±77 px'e kadar
  const devY = -Math.abs(shot.accuracy) * (8 + shot.power * 0.22); // hata üste doğru kaçırır
  const landX = shot.aimX + devX;
  const landY = shot.aimY + devY;
  const reach = keeperReach(shot.power);
  const base = { shooter, landX, landY, diveX: dive.x, diveY: dive.y, reach };

  // direkleri/üst direği aşan şut: aut
  if (landX < 4 || landX > GOAL_W - 4 || landY < 3 || landY > GOAL_H) {
    return { ...base, outcome: 'miss' };
  }

  // frikik barajı: alçak şut, barajın önünden geçtiği noktada takılır
  if (game.wall) {
    const passX = landX - shot.curve * 0.75; // falso topu önce dışarı savurur
    if (landY > game.wall.top && passX > game.wall.x1 && passX < game.wall.x2) {
      return { ...base, outcome: 'blocked' };
    }
  }

  // kaleci: erişim çemberi yatayda geniş, dikeyde dar
  const dx = landX - dive.x;
  const dy = (landY - dive.y) * 2.2;
  if (Math.hypot(dx, dy) < reach) return { ...base, outcome: 'save' };
  return { ...base, outcome: 'goal' };
}

// İki hamle de geldiyse vuruşu sonuçlandırır. false = hâlâ bekleniyor.
export function resolveShootoutKick(game: ShootoutGame): boolean {
  if (!game.shot || !game.dive) return false;

  const shooter = currentShooter(game);
  const result = computeOutcome(game, shooter, game.shot, game.dive);
  if (result.outcome === 'goal') game.scores[shooter]++;
  game.last = result;
  game.shot = null;
  game.dive = null;

  const completed = game.kick;
  game.kick++;
  game.shooterIdx = game.shooterIdx === 0 ? 1 : 0;
  if (game.mode === 'freekick') game.wall = makeWall(); // yeni vuruş, yeni baraj

  // Normal seri bitti mi? Eşitlikte altın vuruş (ikişerli turlar).
  const pairDone = completed % 2 === 0;
  if (pairDone && completed >= SHOOTOUT_KICKS_EACH * 2) {
    const [a, b] = game.turnOrder;
    if (game.scores[a] !== game.scores[b]) game.ended = true;
    else game.suddenDeath = true;
  }
  return true;
}

export function shootoutWinner(game: ShootoutGame): string | null {
  if (!game.ended) return null;
  const [a, b] = game.turnOrder;
  return game.scores[a] > game.scores[b] ? a : b;
}
