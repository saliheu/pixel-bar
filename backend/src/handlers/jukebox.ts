import { players } from '../state/players.js';
import { broadcastBar, sendToPlayer } from '../util/broadcast.js';
import { JUKEBOX_QUEUE_MAX, JUKEBOX_ADD_COOLDOWN_MS, JUKEBOX_TITLE_MAX } from '../config.js';

// Salon başına müzik kutusu: çalan şarkı + kuyruk. Süre takibi istemcidedir
// (YouTube player "bitti" deyince jukebox_ended gelir); sunucu yalnızca
// hangi şarkının ne zaman başladığını bilir ve geç katılanlara elapsedMs verir.

interface Song {
  videoId: string;
  title: string;
  addedBy: string; // görünen isim
}

interface Jukebox {
  current: Song | null;
  startedAt: number;
  queue: Song[];
}

const jukeboxes = new Map<string, Jukebox>();

const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

function boxFor(barId: string): Jukebox {
  let box = jukeboxes.get(barId);
  if (!box) {
    box = { current: null, startedAt: 0, queue: [] };
    jukeboxes.set(barId, box);
  }
  return box;
}

function statePayload(box: Jukebox) {
  return {
    current: box.current
      ? { videoId: box.current.videoId, title: box.current.title, addedBy: box.current.addedBy, elapsedMs: Date.now() - box.startedAt }
      : null,
    queue: box.queue.map((s) => ({ videoId: s.videoId, title: s.title, addedBy: s.addedBy })),
  };
}

function broadcastState(barId: string): void {
  broadcastBar(barId, { type: 'jukebox_state', payload: statePayload(boxFor(barId)) });
}

// Yeni bağlanan oyuncuya salonun mevcut müzik durumu gönderilir.
export function sendJukeboxTo(playerId: string): void {
  const player = players.get(playerId);
  if (!player) return;
  sendToPlayer(playerId, { type: 'jukebox_state', payload: statePayload(boxFor(player.barId)) });
}

function sanitizeTitle(raw: string): string {
  let out = '';
  for (const ch of raw) {
    const code = ch.codePointAt(0)!;
    if (code < 0x20 || (code >= 0x7f && code <= 0x9f)) continue;
    out += ch;
  }
  out = out.trim().slice(0, JUKEBOX_TITLE_MAX);
  return out || 'YouTube parçası';
}

export function handleJukeboxAdd(playerId: string, videoId: string, title: string): void {
  const player = players.get(playerId);
  if (!player) return;
  if (typeof videoId !== 'string' || !VIDEO_ID_RE.test(videoId)) return;

  const now = Date.now();
  // Bedava şarkı hakkı (jeton toplayarak kazanılır) bekleme süresini atlar.
  const useFreeSong = player.freeSongs > 0;
  if (!useFreeSong && now - player.lastJukeboxAddAt < JUKEBOX_ADD_COOLDOWN_MS) {
    sendToPlayer(playerId, { type: 'error', payload: { message: 'Jetonun daha yeni düştü, biraz bekle.' } });
    return;
  }

  const box = boxFor(player.barId);
  if (box.queue.length >= JUKEBOX_QUEUE_MAX) {
    sendToPlayer(playerId, { type: 'error', payload: { message: 'Kuyruk dolu, biraz sonra dene.' } });
    return;
  }

  if (useFreeSong) {
    player.freeSongs--;
    sendToPlayer(playerId, { type: 'free_songs', payload: { count: player.freeSongs, gained: false } });
  } else {
    player.lastJukeboxAddAt = now;
  }
  const song: Song = { videoId, title: sanitizeTitle(String(title ?? '')), addedBy: player.name };

  if (!box.current) {
    box.current = song;
    box.startedAt = now;
  } else {
    box.queue.push(song);
  }

  broadcastState(player.barId);
  broadcastBar(player.barId, {
    type: 'activity',
    payload: { kind: 'jukebox', name: player.name, title: song.title },
  });
}

function advance(barId: string): void {
  const box = boxFor(barId);
  box.current = box.queue.shift() ?? null;
  box.startedAt = Date.now();
  broadcastState(barId);
}

// Herhangi bir istemci "şarkı bitti" diyebilir; videoId eşleşmesi sayesinde
// aynı şarkı için gelen yarış halindeki ikinci bildirim yok sayılır.
export function handleJukeboxEnded(playerId: string, videoId: string): void {
  const player = players.get(playerId);
  if (!player) return;
  const box = boxFor(player.barId);
  if (!box.current || box.current.videoId !== videoId) return;
  advance(player.barId);
}

// Sadece şarkıyı ekleyen atlayabilir (isim üzerinden; oturumluk kimlik yeterli).
export function handleJukeboxSkip(playerId: string): void {
  const player = players.get(playerId);
  if (!player) return;
  const box = boxFor(player.barId);
  if (!box.current) return;
  if (box.current.addedBy !== player.name) {
    sendToPlayer(playerId, { type: 'error', payload: { message: 'Sadece şarkıyı ekleyen atlayabilir.' } });
    return;
  }
  advance(player.barId);
}
