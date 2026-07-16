// Paylaşılan WebSocket mesaj protokolü.
// UYARI: Bu dosya backend/src/protocol.ts ile birebir aynı tutulmalıdır.
// Biri değiştirilince diğerine kopyalanmalı (npm workspace kullanılmıyor).

export type Facing = 'up' | 'down' | 'left' | 'right';

export type ZoneType =
  | 'rps_stool'
  | 'pong_cabinet'
  | 'memory_table'
  | 'chat_table'
  | 'bench'
  | 'bar_stool'
  | 'reflex_pad'
  | 'stage_guitar' // sahnede gitar koltuğu (oda açmaz, çalma animasyonu)
  | 'stage_drums' // sahnede bateri koltuğu (oda açmaz, çalma animasyonu)
  | 'penalty_spot'; // penaltı sahası (2 kişilik oyun)
export type RoomKind = 'rps' | 'pong' | 'memory' | 'chat' | 'reflex' | 'penalty';
export type Choice = 'rock' | 'paper' | 'scissors';
export type PenaltyDir = 'left' | 'mid' | 'right';

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
  | { type: 'reflex_press'; payload: Record<string, never> }
  // Müzik kutusu: jeton atıp YouTube şarkısı sıraya ekleme / bitti bildirimi / atlama
  | { type: 'jukebox_add'; payload: { videoId: string; title: string } }
  | { type: 'jukebox_ended'; payload: { videoId: string } }
  | { type: 'jukebox_skip'; payload: Record<string, never> }
  // Yakındaki bir oyuncuya yumruk atma (hedefi sunucu seçer)
  | { type: 'punch'; payload: Record<string, never> }
  // Penaltı: şutör köşe seçer, kaleci uzanacağı köşeyi seçer
  | { type: 'penalty_pick'; payload: { dir: PenaltyDir } };

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
  | { type: 'rps_result'; payload: { round: number; choices: Record<string, Choice>; winner: string | 'draw'; scores: Record<string, number>; matchWinner: string | null } }
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
  // Salon içi olay duyurusu (aktivite şeridi). İsimler görünen isimlerdir (id değil).
  | { type: 'activity'; payload: { kind: 'game_win'; game: RoomKind; winner: string; loser: string } | { kind: 'jukebox'; name: string; title: string } }
  // Müzik kutusu durumu: salonda çalan şarkı + kuyruk (elapsedMs geç katılan senkron olsun diye)
  | { type: 'jukebox_state'; payload: { current: { videoId: string; title: string; addedBy: string; elapsedMs: number } | null; queue: { videoId: string; title: string; addedBy: string }[] } }
  // Gecenin liderleri: bu oturumda en çok galibiyet alan ilk 5 oyuncu (salon bazlı).
  | { type: 'leaderboard'; payload: { top: { name: string; wins: number }[] } }
  // Yumruk: kurban yeni konumuna savrulur ve stunMs boyunca yerde kalır
  | { type: 'punch_event'; payload: { attacker: string; victim: string; victimX: number; victimY: number; stunMs: number } }
  // Penaltı durumu: pick aşamasında iki taraf seçim yapar, result'ta vuruş sonucu gelir
  | {
      type: 'penalty_state';
      payload: {
        phase: 'pick' | 'result';
        kick: number; // 1'den başlayan vuruş sayacı
        totalKicks: number; // normal seri uzunluğu (altın vuruşta aşılabilir)
        shooter: string; // bu vuruşta şutu çeken oyuncu id'si
        scores: Record<string, number>;
        waitingOn: string[]; // henüz seçim yapmayanlar (pick aşaması)
        last: { shooter: string; shot: PenaltyDir; dive: PenaltyDir; goal: boolean } | null;
        suddenDeath: boolean;
        matchWinner: string | null;
      };
    }
  | { type: 'error'; payload: { message: string } };
