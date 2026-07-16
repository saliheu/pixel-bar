import { players } from '../state/players.js';
import { rooms } from '../state/rooms.js';
import { sendToPlayers, sendToPlayer } from '../util/broadcast.js';
import { CHAT_MAX_LENGTH, CHAT_MIN_INTERVAL_MS } from '../config.js';

export function handleChatSend(playerId: string, text: string): void {
  const player = players.get(playerId);
  if (!player?.roomId) {
    sendToPlayer(playerId, { type: 'error', payload: { message: 'Sohbet için bir masaya oturmalısınız.' } });
    return;
  }

  const room = rooms.get(player.roomId);
  if (!room) return;

  const now = Date.now();
  const lastSent = room.chatLastSentAt[playerId] ?? 0;
  if (now - lastSent < CHAT_MIN_INTERVAL_MS) return; // sessizce düşür (spam koruması)
  room.chatLastSentAt[playerId] = now;

  const trimmed = text.trim().slice(0, CHAT_MAX_LENGTH);
  if (!trimmed) return;

  sendToPlayers(room.playerIds, {
    type: 'chat_message',
    payload: { from: playerId, text: trimmed, ts: now },
  });
}
