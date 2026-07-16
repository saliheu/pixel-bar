import type { ClientMessage, ServerMessage } from '../protocol.js';
import { WS_URL } from '../config.js';

type MessageHandler = (msg: ServerMessage) => void;
type StatusHandler = (status: ConnectionStatus) => void;
type RejectedHandler = () => void;

export type ConnectionStatus = 'connecting' | 'open' | 'reconnecting';

// Sunucunun "oda dolu / geçersiz" reddi için kullandığı kapanış kodu;
// bu geldiğinde yeniden bağlanma denenmez, oda seçimine dönülür.
const CLOSE_CODE_BAR_FULL = 4008;

let socket: WebSocket | null = null;
let messageHandler: MessageHandler = () => {};
let statusHandler: StatusHandler = () => {};
let rejectedHandler: RejectedHandler = () => {};
let reconnectAttempt = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let joinParams: { name: string; color: number; hat: number; bar: string } | null = null;

const BACKOFF_STEPS_MS = [1000, 2000, 4000, 8000, 10000];

export function onMessage(handler: MessageHandler): void {
  messageHandler = handler;
}

export function onStatus(handler: StatusHandler): void {
  statusHandler = handler;
}

export function onRejected(handler: RejectedHandler): void {
  rejectedHandler = handler;
}

export function connect(name?: string, color?: number, hat?: number, bar?: string): void {
  if (name !== undefined && color !== undefined) {
    joinParams = { name, color, hat: hat ?? 0, bar: bar ?? '' };
  }
  statusHandler(reconnectAttempt === 0 ? 'connecting' : 'reconnecting');

  let url = WS_URL;
  if (joinParams) {
    const qs = new URLSearchParams({
      name: joinParams.name,
      color: String(joinParams.color),
      hat: String(joinParams.hat),
      bar: joinParams.bar,
    });
    url = `${WS_URL}${WS_URL.includes('?') ? '&' : '?'}${qs.toString()}`;
  }
  socket = new WebSocket(url);

  socket.addEventListener('open', () => {
    reconnectAttempt = 0;
    statusHandler('open');
  });

  socket.addEventListener('message', (event) => {
    try {
      const msg = JSON.parse(event.data as string) as ServerMessage;
      messageHandler(msg);
    } catch {
      // yoksay: bozuk mesaj
    }
  });

  socket.addEventListener('close', (ev) => {
    if (ev.code === CLOSE_CODE_BAR_FULL) {
      rejectedHandler();
      return; // yeniden bağlanma yok; kullanıcı başka oda seçecek
    }
    scheduleReconnect();
  });
  socket.addEventListener('error', () => socket?.close());
}

function scheduleReconnect(): void {
  if (reconnectTimer) return;
  const delay = BACKOFF_STEPS_MS[Math.min(reconnectAttempt, BACKOFF_STEPS_MS.length - 1)];
  reconnectAttempt++;
  statusHandler('reconnecting');
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, delay);
}

export function sendMessage(msg: ClientMessage): void {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(msg));
  }
}
