import type { WebSocket } from 'ws';
import { players, countPlayersInBar, toPublicPlayer, type PlayerState } from '../state/players.js';
import { generateAnonId, resolveDisplayName } from '../util/id.js';
import { broadcastBar, send } from '../util/broadcast.js';
import { allPublicZones, cleanupPlayerZonesAndRoom, handleZoneInteract, leaveRoom, handleSeatLeave } from './matchmaking.js';
import { handleMove } from './movement.js';
import { handleChatSend } from './chat.js';
import { handleWorldChatSend } from './worldChat.js';
import { handleEmote } from './emote.js';
import { sendLeaderboardTo } from './social.js';
import { sendJukeboxTo, handleJukeboxAdd, handleJukeboxEnded, handleJukeboxSkip } from './jukebox.js';
import { handleRpsChoice, handlePongInput, handleMemoryFlip, handleGameRestart, handleReflexPress, handlePenaltyPick } from './gameplay.js';
import { handlePunch } from './punch.js';
import type { ClientMessage } from '../protocol.js';
import {
  MAP_WIDTH,
  MAP_HEIGHT,
  HEARTBEAT_INTERVAL_MS,
  STALE_SWEEP_INTERVAL_MS,
  STALE_TIMEOUT_MS,
  MAX_PLAYERS,
  MAX_MESSAGE_BYTES,
  AVATAR_PALETTE,
  HAT_COUNT,
  BAR_IDS,
  BAR_CAPACITY,
} from '../config.js';

// Oda dolu / geçersiz olduğunda istemcinin yeniden bağlanma döngüsüne
// girmemesi için özel kapanış kodu (istemci bunu görünce oda seçimine döner).
export const CLOSE_CODE_BAR_FULL = 4008;

export function handleConnection(
  socket: WebSocket,
  requestedName: string | null,
  requestedColor: number | null,
  requestedHat: number | null,
  requestedBar: string | null,
): void {
  if (players.size >= MAX_PLAYERS) {
    send(socket, { type: 'error', payload: { message: 'Bar şu an tamamen dolu, biraz sonra tekrar dene.' } });
    socket.close(CLOSE_CODE_BAR_FULL, 'server full');
    return;
  }

  const barId = requestedBar !== null && BAR_IDS.includes(requestedBar) ? requestedBar : BAR_IDS[0];
  if (countPlayersInBar(barId) >= BAR_CAPACITY) {
    send(socket, { type: 'error', payload: { message: 'Bu oda dolu, başka bir oda seç.' } });
    socket.close(CLOSE_CODE_BAR_FULL, 'bar full');
    return;
  }

  const id = generateAnonId();
  const name = resolveDisplayName(requestedName) ?? id;
  const color =
    requestedColor !== null && Number.isInteger(requestedColor) && requestedColor >= 0 && requestedColor < AVATAR_PALETTE.length
      ? requestedColor
      : Math.floor(Math.random() * AVATAR_PALETTE.length);
  const hat =
    requestedHat !== null && Number.isInteger(requestedHat) && requestedHat >= 0 && requestedHat < HAT_COUNT
      ? requestedHat
      : 0;
  const x = MAP_WIDTH / 2 + (Math.random() * 100 - 50);
  const y = MAP_HEIGHT / 2 + (Math.random() * 100 - 50);

  const player: PlayerState = {
    id,
    barId,
    name,
    color,
    hat,
    x,
    y,
    facing: 'down',
    moving: false,
    socket,
    roomId: null,
    connectedAt: Date.now(),
    lastSeen: Date.now(),
    isAlive: true,
    lastWorldChatAt: 0,
    lastEmoteAt: 0,
    lastJukeboxAddAt: 0,
    lastPunchAt: 0,
    stunnedUntil: 0,
    wins: 0,
  };
  players.set(id, player);

  send(socket, {
    type: 'welcome',
    payload: {
      selfId: id,
      selfName: name,
      selfColor: color,
      selfHat: hat,
      x,
      y,
      players: [...players.values()].filter((p) => p.id !== id && p.barId === barId).map(toPublicPlayer),
      zones: allPublicZones(barId),
    },
  });

  broadcastBar(barId, { type: 'player_joined', payload: toPublicPlayer(player) }, id);
  sendLeaderboardTo(id); // salonun mevcut lider tablosu
  sendJukeboxTo(id); // çalan şarkı + kuyruk (varsa)

  socket.on('pong', () => {
    player.isAlive = true;
    player.lastSeen = Date.now();
  });

  socket.on('message', (raw, isBinary) => {
    if (isBinary) return;
    const text = raw.toString();
    if (text.length > MAX_MESSAGE_BYTES) return; // aşırı büyük mesajları düşür
    player.lastSeen = Date.now();
    let msg: ClientMessage;
    try {
      msg = JSON.parse(text);
    } catch {
      return;
    }
    dispatch(id, msg);
  });

  socket.on('close', () => {
    cleanupPlayerZonesAndRoom(id);
    players.delete(id);
    broadcastBar(barId, { type: 'player_left', payload: { id } });
  });

  socket.on('error', () => {
    socket.terminate();
  });
}

function dispatch(playerId: string, msg: ClientMessage): void {
  switch (msg.type) {
    case 'move':
      handleMove(playerId, msg.payload.x, msg.payload.y, msg.payload.facing, msg.payload.moving);
      break;
    case 'zone_interact':
      handleZoneInteract(playerId, msg.payload.zoneId);
      break;
    case 'room_leave':
      leaveRoom(playerId, 'left');
      break;
    case 'rps_choice':
      handleRpsChoice(playerId, msg.payload.choice);
      break;
    case 'pong_input':
      handlePongInput(playerId, msg.payload.dir);
      break;
    case 'memory_flip':
      handleMemoryFlip(playerId, msg.payload.cardIndex);
      break;
    case 'chat_send':
      handleChatSend(playerId, msg.payload.text);
      break;
    case 'seat_leave':
      handleSeatLeave(playerId);
      break;
    case 'world_chat_send':
      handleWorldChatSend(playerId, msg.payload.text);
      break;
    case 'emote':
      handleEmote(playerId, msg.payload.emote);
      break;
    case 'game_restart':
      handleGameRestart(playerId);
      break;
    case 'reflex_press':
      handleReflexPress(playerId);
      break;
    case 'jukebox_add':
      handleJukeboxAdd(playerId, msg.payload.videoId, msg.payload.title);
      break;
    case 'jukebox_ended':
      handleJukeboxEnded(playerId, msg.payload.videoId);
      break;
    case 'jukebox_skip':
      handleJukeboxSkip(playerId);
      break;
    case 'punch':
      handlePunch(playerId);
      break;
    case 'penalty_pick':
      handlePenaltyPick(playerId, msg.payload.dir);
      break;
  }
}

export function startHeartbeat(): NodeJS.Timeout {
  return setInterval(() => {
    for (const player of players.values()) {
      if (!player.isAlive) {
        player.socket.terminate();
        continue;
      }
      player.isAlive = false;
      player.socket.ping();
    }
  }, HEARTBEAT_INTERVAL_MS);
}

export function startStaleSweep(): NodeJS.Timeout {
  return setInterval(() => {
    const now = Date.now();
    for (const player of players.values()) {
      if (now - player.lastSeen > STALE_TIMEOUT_MS) {
        player.socket.terminate();
      }
    }
  }, STALE_SWEEP_INTERVAL_MS);
}
