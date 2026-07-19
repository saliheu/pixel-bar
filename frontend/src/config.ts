export const MAP_WIDTH = 1200;
export const MAP_HEIGHT = 700;

export const ZONE_INTERACT_RADIUS = 60;
// Üst duvar/bar tezgahı bölgesine yürünemez; karakter gövdesi hep görünür kalır.
// backend/src/config.ts PLAYER_MIN_Y ile aynı tutulmalı.
export const PLAYER_MIN_Y = 90;
export const MOVE_SPEED_PX_PER_S = 180; // FPS'ten bağımsız hareket hızı
export const MOVE_SEND_INTERVAL_MS = 100;

export const PONG_COURT_W = 700;
export const PONG_COURT_H = 400;
export const PONG_PADDLE_H = 80;
export const PONG_PADDLE_W = 12;

export const CHAT_MAX_LENGTH = 200;
export const MEMORY_GRID_SIZE = 16;
export const WORLD_CHAT_RADIUS = 260;

export const NAME_MIN_LENGTH = 2;
export const NAME_MAX_LENGTH = 16;

// backend/src/config.ts AVATAR_PALETTE ile aynı sırada tutulmalı
export const AVATAR_PALETTE = [0x38bdf8, 0xf472b6, 0xfbbf24, 0x4ade80, 0xb39ddb, 0xff8a80, 0x80cbc4, 0x90caf9];

// Her emote karakter üzerinde bir animasyon oynatır (el sallama, gülme, ... dans).
export const EMOTES = ['👋', '😂', '❤️', '🎉', '😮', '🕺', '👏', '😴', '😠'];

// backend/src/config.ts HAT_COUNT ile aynı uzunlukta tutulmalı (0 = şapkasız).
// İkonlar ui/icons.ts HAT_ICONS içinde aynı sırayla tanımlıdır.
export const HATS = [
  { id: 0, label: 'Yok' },
  { id: 1, label: 'Kasket' },
  { id: 2, label: 'Taç' },
  { id: 3, label: 'Kedi' },
  { id: 4, label: 'Parti' },
];

function defaultWsUrl(): string {
  const envUrl = import.meta.env.VITE_WS_URL as string | undefined;
  if (envUrl) return envUrl;
  const { hostname, protocol } = window.location;
  if (hostname === 'localhost' || hostname === '127.0.0.1') return 'ws://localhost:8080';
  // Aynı origin'e reverse proxy kurulmuşsa çalışır; ayrı backend'de VITE_WS_URL zorunludur.
  return `${protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`;
}

export const WS_URL = defaultWsUrl();

// Oda doluluk bilgisi backend'in HTTP tarafından çekilir (ws:// -> http://).
export const LOBBIES_URL = WS_URL.replace(/^ws/, 'http').replace(/\?.*$/, '') + '/lobbies';

// backend/src/config.ts BAR_IDS ile aynı sırada/id'lerde tutulmalı.
// accent: salon kartındaki neon nokta ve seçim vurgusunun rengi.
export const BARS = [
  { id: 'neon', name: 'Neon Salonu', accent: '#38bdf8' },
  { id: 'arcade', name: 'Arcade Salonu', accent: '#fbbf24' },
  { id: 'lofi', name: 'Lofi Salonu', accent: '#b39ddb' },
  { id: 'disko', name: 'Disko Salonu', accent: '#f472b6' },
];
export const BAR_CAPACITY = 25;
