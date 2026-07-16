import type { WebSocket } from 'ws';
import type { ServerMessage } from '../protocol.js';
import { players } from '../state/players.js';

export function send(socket: WebSocket, msg: ServerMessage): void {
  if (socket.readyState !== socket.OPEN) return;
  socket.send(JSON.stringify(msg));
}

export function sendToPlayer(playerId: string, msg: ServerMessage): void {
  const player = players.get(playerId);
  if (!player) return;
  send(player.socket, msg);
}

export function sendToPlayers(playerIds: readonly string[], msg: ServerMessage): void {
  for (const id of playerIds) sendToPlayer(id, msg);
}

export function broadcastAll(msg: ServerMessage, exceptId?: string): void {
  for (const player of players.values()) {
    if (player.id === exceptId) continue;
    send(player.socket, msg);
  }
}

// Sadece verilen odadaki (bar salonu) oyunculara yayınlar.
export function broadcastBar(barId: string, msg: ServerMessage, exceptId?: string): void {
  for (const player of players.values()) {
    if (player.barId !== barId) continue;
    if (player.id === exceptId) continue;
    send(player.socket, msg);
  }
}
