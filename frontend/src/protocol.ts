// Paylaşılan WebSocket mesaj protokolü.
// UYARI: Bu dosya backend/src/protocol.ts ile birebir aynı tutulmalıdır.
// Biri değiştirilince diğerine kopyalanmalı (npm workspace kullanılmıyor).

export type Facing = 'up' | 'down' | 'left' | 'right';

export type ZoneType = 'rps_stool' | 'pong_cabinet' | 'memory_table' | 'chat_table' | 'bench' | 'bar_stool' | 'reflex_pad';
export type RoomKind = 'rps' | 'pong' | 'memory' | 'chat' | 'reflex';
export type Choice = 'rock' | 'paper' | 'scissors';

export interface PublicPlayer {
  id: string;
  name: string;
  color: number; // avatar renk paleti indeksi (0-7)
  hat: number; // şapka indeksi (0 = yok)
  x: number;
  y: number;
  facing: Facing;
  moving: boolean;
}

export interface PublicZone {
  zoneId: string;
  type: ZoneType;
  x: number;
  y: number;
  radius: number;
  occupiedSlots: (string | null)[]; // [slotA occupant playerId | null, slotB ...]
}

// ---- Client -> Server ----
export type ClientMessage =
  | { type: 'move'; payload: { x: number; y: number; facing: Facing; moving: boolean } }
  | { type: 'zone_interact'; payload: { zoneId: string } }
  | { type: 'room_leave'; payload: Record<string, never> }
  | { type: 'rps_choice'; payload: { choice: Choice } }
  | { type: 'pong_input'; payload: { dir: -1 | 0 | 1 } }
  | { type: 'memory_flip'; payload: { cardIndex: number } }
  | { type: 'chat_send'; payload: { text: string } }
  | { type: 'seat_leave'; payload: Record<string, never> }
  | { type: 'world_chat_send'; payload: { text: string } }
  | { type: 'emote'; payload: { emote: string } }
  | { type: 'game_restart'; payload: Record<string, never> }
  | { type: 'reflex_press'; payload: Record<string, never> };

// ---- Server -> Client ----
export type ServerMessage =
  | { type: 'welcome'; payload: { selfId: string; selfName: string; selfColor: number; selfHat: number; x: number; y: number; players: PublicPlayer[]; zones: PublicZone[] } }
  | { type: 'player_joined'; payload: PublicPlayer }
  | { type: 'player_moved'; payload: { id: string; x: number; y: number; facing: Facing; moving: boolean } }
  | { type: 'player_left'; payload: { id: string } }
  | { type: 'zone_state'; payload: PublicZone }
  // playerIds 1 kişi olabilir: masaya ilk oturan oda içinde rakip bekler
  | { type: 'room_joined'; payload: { roomId: string; kind: RoomKind; zoneId: string; playerIds: string[]; you: string; pongSides?: Record<string, 'left' | 'right'> } }
  | { type: 'room_closed'; payload: { roomId: string; reason: 'left' | 'disconnected' } }
  | { type: 'game_restarted'; payload: { kind: RoomKind } }
  | { type: 'rps_result'; payload: { round: number; choices: Record<string, Choice>; winner: string | 'draw'; scores: Record<string, number> } }
  | { type: 'rps_waiting'; payload: { waitingOn: string[] } }
  | { type: 'pong_state'; payload: { ball: { x: number; y: number }; paddles: Record<string, number>; score: Record<string, number> } }
  | { type: 'pong_goal'; payload: { scorer: string; score: Record<string, number> } }
  | { type: 'pong_end'; payload: { winner: string; score: Record<string, number> } }
  // Refleks Düellosu: get_ready (kırmızı, bekle) -> armed (yeşil, BAS!) -> result (tur sonucu)
  | { type: 'reflex_state'; payload: { phase: 'get_ready' | 'armed' | 'result'; round: number; scores: Record<string, number>; lastWinner: string | null; falseStart: string | null; matchWinner: string | null } }
  | { type: 'memory_state'; payload: { cards: ({ value: number | null; matched: boolean })[]; turn: string; scores: Record<string, number> } }
  | { type: 'memory_match_result'; payload: { indices: number[]; matched: boolean; turn: string; scores: Record<string, number> } }
  | { type: 'chat_message'; payload: { from: string; text: string; ts: number } }
  | { type: 'world_chat_message'; payload: { from: string; text: string; x: number; y: number; ts: number } }
  | { type: 'player_emote'; payload: { from: string; emote: string } }
  // Salon içi olay duyurusu (aktivite şeridi): oyun bittiğinde herkese yayınlanır.
  // winner/loser görünen isimlerdir (id değil).
  | { type: 'activity'; payload: { kind: 'game_win'; game: RoomKind; winner: string; loser: string } }
  // Gecenin liderleri: bu oturumda en çok galibiyet alan ilk 5 oyuncu (salon bazlı).
  | { type: 'leaderboard'; payload: { top: { name: string; wins: number }[] } }
  | { type: 'error'; payload: { message: string } };
