import { players, countPlayersInBar } from '../state/players.js';
import { broadcastBar, sendToPlayer } from '../util/broadcast.js';
import { BAR_IDS, MAP_WIDTH, MAP_HEIGHT, PLAYER_MIN_Y } from '../config.js';

// Salonlarda rastgele beliren toplanabilir altın jeton. Üstünden geçen oyuncu
// toplar ve bir "bedava şarkı" hakkı kazanır (jukebox eklemede bekleme atlanır).

const COLLECT_RADIUS = 26;
const SPAWN_CHECK_MS = 9000;
const SPAWN_CHANCE = 0.5; // her kontrolde jetonsuz salon başına belirme olasılığı

const tokens = new Map<string, { x: number; y: number } | null>();

function randomSpot(): { x: number; y: number } {
  // kenarlardan ve üst tezgah bölgesinden uzak, oyuncuların gezdiği alan
  return {
    x: 120 + Math.random() * (MAP_WIDTH - 240),
    y: PLAYER_MIN_Y + 60 + Math.random() * (MAP_HEIGHT - PLAYER_MIN_Y - 160),
  };
}

export function currentToken(barId: string): { x: number; y: number } | null {
  return tokens.get(barId) ?? null;
}

export function sendTokenTo(playerId: string): void {
  const player = players.get(playerId);
  if (!player) return;
  sendToPlayer(playerId, { type: 'token_state', payload: { token: currentToken(player.barId) } });
}

// Oyuncu her hareket ettiğinde çağrılır: jetonun üstünden geçtiyse toplar.
export function checkTokenCollect(playerId: string): void {
  const player = players.get(playerId);
  if (!player) return;
  const token = tokens.get(player.barId);
  if (!token) return;
  if (Math.hypot(player.x - token.x, player.y - token.y) > COLLECT_RADIUS) return;

  tokens.set(player.barId, null);
  broadcastBar(player.barId, { type: 'token_state', payload: { token: null } });
  player.freeSongs++;
  sendToPlayer(playerId, { type: 'free_songs', payload: { count: player.freeSongs, gained: true } });
}

export function startTokenSpawner(): NodeJS.Timeout {
  return setInterval(() => {
    for (const barId of BAR_IDS) {
      if (countPlayersInBar(barId) === 0) continue;
      if (tokens.get(barId)) continue; // zaten bir jeton var
      if (Math.random() > SPAWN_CHANCE) continue;
      const spot = randomSpot();
      tokens.set(barId, spot);
      broadcastBar(barId, { type: 'token_state', payload: { token: spot } });
    }
  }, SPAWN_CHECK_MS);
}
