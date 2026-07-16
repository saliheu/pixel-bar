import type { WebSocket } from 'ws';
import type { Facing, PublicPlayer } from '../protocol.js';

export interface PlayerState {
  id: string; // benzersiz kimlik, aynı zamanda Map key'i
  barId: string; // oyuncunun bulunduğu oda (bar salonu)
  name: string; // oyuncunun seçtiği (veya anonim üretilen) görünen isim
  color: number; // AVATAR_PALETTE indeksi
  hat: number; // şapka indeksi (0 = yok)
  x: number;
  y: number;
  facing: Facing;
  moving: boolean;
  socket: WebSocket;
  roomId: string | null;
  connectedAt: number;
  lastSeen: number;
  isAlive: boolean; // ws heartbeat için
  lastWorldChatAt: number; // dünya sohbeti rate-limit için
  lastEmoteAt: number; // emote rate-limit için
  wins: number; // bu oturumdaki oyun galibiyetleri (lider tablosu için)
}

export const players = new Map<string, PlayerState>();

export function countPlayersInBar(barId: string): number {
  let n = 0;
  for (const p of players.values()) {
    if (p.barId === barId) n++;
  }
  return n;
}

export function toPublicPlayer(p: PlayerState): PublicPlayer {
  return { id: p.id, name: p.name, color: p.color, hat: p.hat, x: p.x, y: p.y, facing: p.facing, moving: p.moving };
}
