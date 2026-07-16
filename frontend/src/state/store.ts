import type { Choice, Facing, PublicPlayer, PublicZone, RoomKind } from '../protocol.js';
import type { ConnectionStatus } from '../net/socket.js';

export interface RemotePlayer {
  id: string;
  name: string;
  color: number;
  hat: number;
  x: number;
  y: number;
  facing: Facing;
  moving: boolean;
}

export interface RoomInfo {
  roomId: string;
  kind: RoomKind;
  zoneId: string;
  playerIds: string[]; // 1 kişi = rakip bekleniyor
  you: string;
  pongSides?: Record<string, 'left' | 'right'>;
}

export interface RpsViewState {
  myChoice: Choice | null;
  waitingOn: string[];
  lastResult: { winner: string | 'draw'; choices: Record<string, Choice> } | null;
  scores: Record<string, number>;
}

export interface PongViewState {
  ball: { x: number; y: number };
  paddles: Record<string, number>;
  score: Record<string, number>;
  ended: { winner: string } | null;
}

export interface MemoryViewState {
  cards: { value: number | null; matched: boolean }[];
  turn: string;
  scores: Record<string, number>;
}

export interface ChatEntry {
  from: string;
  text: string;
  ts: number;
}

interface State {
  status: ConnectionStatus;
  selfId: string | null;
  selfName: string;
  selfColor: number;
  selfHat: number;
  self: { x: number; y: number; facing: Facing; moving: boolean };
  players: Map<string, RemotePlayer>;
  zones: Map<string, PublicZone>;
  room: RoomInfo | null;
  rps: RpsViewState | null;
  pong: PongViewState | null;
  memory: MemoryViewState | null;
  chatMessages: ChatEntry[];
  sittingZoneId: string | null;
}

export const state: State = {
  status: 'connecting',
  selfId: null,
  selfName: '',
  selfColor: 0,
  selfHat: 0,
  self: { x: 0, y: 0, facing: 'down', moving: false },
  players: new Map(),
  zones: new Map(),
  room: null,
  rps: null,
  pong: null,
  memory: null,
  chatMessages: [],
  sittingZoneId: null,
};

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notify(): void {
  for (const l of listeners) l();
}

export function upsertPlayer(p: PublicPlayer): void {
  state.players.set(p.id, { id: p.id, name: p.name, color: p.color, hat: p.hat, x: p.x, y: p.y, facing: p.facing, moving: p.moving });
}

// Hareket güncellemelerinde isim/renk gelmez; mevcut kaydı korur.
export function updatePlayerPosition(id: string, x: number, y: number, facing: Facing, moving: boolean): void {
  const p = state.players.get(id);
  if (!p) return;
  p.x = x;
  p.y = y;
  p.facing = facing;
  p.moving = moving;
}

// Bir oyuncu ID'sini görünen isme çevirir (kendisi dahil).
export function displayName(id: string): string {
  if (id === state.selfId) return state.selfName || id;
  return state.players.get(id)?.name ?? id;
}

export function playerColor(id: string): number | null {
  if (id === state.selfId) return state.selfColor;
  return state.players.get(id)?.color ?? null;
}

export function removePlayer(id: string): void {
  state.players.delete(id);
}

export function setZone(z: PublicZone): void {
  state.zones.set(z.zoneId, z);
}

export function resetRoomState(): void {
  state.room = null;
  state.rps = null;
  state.pong = null;
  state.memory = null;
  state.chatMessages = [];
}
