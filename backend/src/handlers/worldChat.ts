import { players } from '../state/players.js';
import { send } from '../util/broadcast.js';
import { CHAT_MAX_LENGTH, CHAT_MIN_INTERVAL_MS, WORLD_CHAT_RADIUS } from '../config.js';

export function handleWorldChatSend(playerId: string, text: string): void {
  const player = players.get(playerId);
  if (!player) return;

  const now = Date.now();
  if (now - player.lastWorldChatAt < CHAT_MIN_INTERVAL_MS) return; // sessizce düşür (spam koruması)
  player.lastWorldChatAt = now;

  const trimmed = text.trim().slice(0, CHAT_MAX_LENGTH);
  if (!trimmed) return;

  const payload = { from: playerId, text: trimmed, x: player.x, y: player.y, ts: now };

  for (const other of players.values()) {
    if (other.barId !== player.barId) continue; // farklı odalar birbirini duymaz
    const dist = Math.hypot(other.x - player.x, other.y - player.y);
    if (dist <= WORLD_CHAT_RADIUS) {
      send(other.socket, { type: 'world_chat_message', payload });
    }
  }
}
