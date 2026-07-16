export const MAP_WIDTH = 1200;
export const MAP_HEIGHT = 700;

// Üst duvar/bar tezgahı bölgesine yürünemez (frontend/src/config.ts ile aynı tutulmalı).
export const PLAYER_MIN_Y = 90;

export const ZONE_INTERACT_RADIUS = 60;

export const HEARTBEAT_INTERVAL_MS = 20_000;
export const STALE_SWEEP_INTERVAL_MS = 15_000;
export const STALE_TIMEOUT_MS = 45_000;

export const CHAT_MAX_LENGTH = 200;
export const CHAT_MIN_INTERVAL_MS = 1000;

export const WORLD_CHAT_RADIUS = 260;

export const PONG_TICK_MS = 1000 / 30;
export const PONG_COURT_W = 700;
export const PONG_COURT_H = 400;
export const PONG_PADDLE_H = 80;
export const PONG_PADDLE_SPEED = 8;
export const PONG_BALL_SPEED = 8;
export const PONG_BALL_MAX_SPEED = 14; // raket çarpışma bandını (15px) atlamamak için sınır
export const PONG_WIN_SCORE = 5;

export const MEMORY_GRID_SIZE = 16;

export const REFLEX_WIN_SCORE = 3;
export const REFLEX_ARM_MIN_MS = 1200; // "BAS!" sinyali için minimum bekleme
export const REFLEX_ARM_MAX_MS = 4200;
export const REFLEX_NEXT_ROUND_MS = 2000;

// Odalar (bar salonları): her biri kendi harita kopyasında yaşar.
// frontend/src/config.ts BARS listesiyle aynı sırada/id'lerde tutulmalı.
export const BAR_IDS = ['neon', 'arcade', 'lofi', 'disko'];
export const BAR_CAPACITY = 25;

export const MAX_PLAYERS = BAR_IDS.length * BAR_CAPACITY; // 100
export const MAX_MESSAGE_BYTES = 2048;

export const NAME_MIN_LENGTH = 2;
export const NAME_MAX_LENGTH = 16;

// frontend/src/config.ts AVATAR_PALETTE ile aynı sırada tutulmalı
export const AVATAR_PALETTE = [0x38bdf8, 0xf472b6, 0xfbbf24, 0x4ade80, 0xb39ddb, 0xff8a80, 0x80cbc4, 0x90caf9];

export const EMOTE_WHITELIST = ['👋', '😂', '❤️', '🎉', '😮', '🕺'];

// frontend/src/config.ts HATS listesiyle aynı uzunlukta tutulmalı (0 = şapkasız)
export const HAT_COUNT = 5;
