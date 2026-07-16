import { players } from '../state/players.js';
import { send } from '../util/broadcast.js';
import { CHAT_MIN_INTERVAL_MS, WORLD_CHAT_RADIUS, EMOTE_WHITELIST } from '../config.js';

export function handleEmote(playerId: string, emote: string): void {
  const player = players.get(playerId);
  if (!player) return;
  if (!EMOTE_WHITELIST.includes(emote)) return;

  const now = Date.now();
  if (now - player.lastEmoteAt < CHAT_MIN_INTERVAL_MS) return; // sessizce düşür (spam koruması)
  player.lastEmoteAt = now;

  const payload = { from: playerId, emote };

  // Odadaysa oda arkadaşı dahil herkes yakınlık kuralına tabi; emote görsel bir jest,
  // dünya sohbeti gibi yakın çevreye yayınlanır.
  for (const other of players.values()) {
    if (other.barId !== player.barId) continue; // farklı odalar birbirini görmez
    const dist = Math.hypot(other.x - player.x, other.y - player.y);
    if (dist <= WORLD_CHAT_RADIUS) {
      send(other.socket, { type: 'player_emote', payload });
    }
  }
}
