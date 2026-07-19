import { Application, Container } from 'pixi.js';
import './style.css';
import { MAP_WIDTH, MAP_HEIGHT, PLAYER_MIN_Y, MOVE_SEND_INTERVAL_MS, MOVE_SPEED_PX_PER_S, PONG_COURT_W, PONG_COURT_H } from './config.js';
import { connect, onMessage, onStatus, onRejected, sendMessage } from './net/socket.js';
import { BARS } from './config.js';
import { getMoveVector, getPongDir, type MoveVector } from './input/keyboard.js';
import { isTouchLayout, initTouchControls, setTouchControlsMode } from './input/touch.js';
import {
  state,
  upsertPlayer,
  updatePlayerPosition,
  removePlayer,
  setZone,
  resetRoomState,
  displayName,
  type ChatEntry,
} from './state/store.js';
import {
  createPlayerVisual,
  updatePlayerVisual,
  setSelfPosition,
  setSitting,
  showSpeechBubble,
  tickSpeechBubble,
  playEmote,
  tickEmote,
  playPunch,
  playKnockdown,
  setInstrument,
  type PlayerVisual,
} from './pixi/player.js';
import {
  drawFloor,
  createZoneVisuals,
  updateZoneVisual,
  tickZoneHighlights,
  ZONE_SLOT_OFFSET_X,
  type ZoneVisual,
} from './pixi/world.js';
import {
  createDecor,
  createAmbientParticles,
  tickAmbientParticles,
  createDanceFloor,
  tickDanceFloor,
  createDustLayer,
  spawnDust,
  tickDust,
  createBartender,
  tickBartender,
  bartenderServe,
  bartenderSay,
  createStringLights,
  tickStringLights,
  DANCE_FLOOR_BOUNDS,
  JUKEBOX_POS,
  JUKEBOX_INTERACT_RADIUS,
  createJukeboxGlow,
  tickJukeboxGlow,
  createCoinToken,
  setCoinToken,
  tickCoinToken,
} from './pixi/decor.js';
import { createPongVisual, updatePongVisual, showPongWinner, hidePongWinner } from './pixi/pong.js';
import { initStatusOverlay, updateStatusOverlay } from './ui/statusOverlay.js';
import { initChatPanel, showChatPanel, hideChatPanel, addChatMessage, setRestartVisible } from './ui/chatPanel.js';
import { initRpsPanel, showRpsPanel, hideRpsPanel, renderRpsResult, setRpsOpponentPicked } from './ui/rpsPanel.js';
import { initMemoryPanel, showMemoryPanel, hideMemoryPanel, renderMemoryState } from './ui/memoryPanel.js';
import { initReflexPanel, showReflexPanel, hideReflexPanel, renderReflexState } from './ui/reflexPanel.js';
import { initShootoutPanel, showShootoutPanel, hideShootoutPanel, renderShootoutState } from './ui/shootoutPanel.js';
import { initDartPanel, showDartPanel, hideDartPanel, renderDartState } from './ui/dartPanel.js';
import { createPromptBadge, updatePromptBadge, updateStandUpBadge, updateJukeboxBadge } from './ui/promptBubble.js';
import { initJukebox, renderJukeboxState, toggleJukeboxPanel, jukeboxHasSong } from './ui/jukebox.js';
import { initWorldChatBar, setWorldChatBarVisible } from './ui/worldChatBar.js';
import { initJoinScreen } from './ui/joinScreen.js';
import { initHud, setOnlineCount, setBarName } from './ui/hud.js';
import { initToasts, showToast } from './ui/toast.js';
import { initEmoteBar, setEmoteBarVisible } from './ui/emoteBar.js';
import { initSound, sfx, playGuitarNote, playDrumHit } from './ui/sound.js';
import { initQuests, questComplete } from './ui/quests.js';
import { initActivityFeed, pushActivity } from './ui/activityFeed.js';
import { initLeaderboard, renderLeaderboard } from './ui/leaderboard.js';
import { Graphics } from 'pixi.js';
import type { PublicZone } from './protocol.js';

const appRoot = document.querySelector<HTMLDivElement>('#app')!;
appRoot.innerHTML = '';

const gameWrap = document.createElement('div');
gameWrap.className = 'game-wrap';
appRoot.appendChild(gameWrap);

// Oyun görünümü: bir odaya girince tam ekranı kaplar, haritayı gizler.
// stage = aktif oyun (DOM paneli ya da pong için taşınan canvas), side = sohbet.
const roomView = document.createElement('div');
roomView.className = 'room-view hidden';
const roomStage = document.createElement('div');
roomStage.className = 'room-view__stage';
const roomSide = document.createElement('div');
roomSide.className = 'room-view__side';
roomView.append(roomStage, roomSide);
document.body.appendChild(roomView);

initSound();
initLeaderboard(document.body); // HUD'daki kupa düğmesi bu paneli açar
initJukebox(document.body); // HUD'daki nota düğmesi ve E etkileşimi bu paneli açar
initHud(document.body);
initToasts(document.body);
initActivityFeed(document.body);
initStatusOverlay(document.body);
initChatPanel(roomSide);
initRpsPanel(roomStage);
initMemoryPanel(roomStage);
initReflexPanel(roomStage);
initShootoutPanel(roomStage);
initDartPanel(roomStage);
initWorldChatBar(appRoot);
initEmoteBar(appRoot, (emote) => {
  if (selfVisual) playEmote(selfVisual, emote);
  sfx.emote();
  questComplete('emote');
  if (emote === '🕺' && onFloor(state.self.x, state.self.y)) questComplete('dance');
});

// Mobilde sahne ekranı kaplar ve kamera oyuncuyu takip eder; masaüstünde
// haritanın tamamı sabit 1200x700 tuvalde görünür.
const touchLayout = isTouchLayout();
if (touchLayout) document.body.classList.add('touch-mode');

const app = new Application();
await app.init({
  width: touchLayout ? window.innerWidth : MAP_WIDTH,
  height: touchLayout ? window.innerHeight : MAP_HEIGHT,
  background: 0x241c3d,
  antialias: true,
  resolution: touchLayout ? Math.min(window.devicePixelRatio || 1, 2) : 1,
  autoDensity: touchLayout,
});
gameWrap.appendChild(app.canvas);

const worldContainer = new Container();
app.stage.addChild(worldContainer);
drawFloor(worldContainer);
const danceFloor = createDanceFloor(worldContainer);
createDecor(worldContainer);
const bartender = createBartender(worldContainer);
const stringLights = createStringLights(worldContainer);
const dustLayer = createDustLayer(worldContainer);
const ambientParticles = createAmbientParticles(worldContainer);
const jukeboxGlow = createJukeboxGlow(worldContainer);
const coinToken = createCoinToken(worldContainer);

const overlayContainer = new Container();
overlayContainer.visible = false;
app.stage.addChild(overlayContainer);

const pongVisual = createPongVisual();
pongVisual.container.visible = true;
overlayContainer.addChild(pongVisual.container);

// Pong kortu ekrana ortalanır ve sığmıyorsa küçültülür (mobil dahil).
function layoutPongOverlay(): void {
  const vw = app.screen.width;
  const vh = app.screen.height;
  const s = Math.min(1, (vw - 16) / PONG_COURT_W, (vh - 16) / PONG_COURT_H);
  overlayContainer.scale.set(s);
  overlayContainer.x = (vw - PONG_COURT_W * s) / 2;
  overlayContainer.y = (vh - PONG_COURT_H * s) / 2;
}
layoutPongOverlay();

// Mobil kamera: dünyayı büyütüp oyuncuyu ortalar, harita kenarlarına clamp'ler.
let camZoom = 1;
function computeCamZoom(): void {
  if (!touchLayout) {
    camZoom = 1;
    return;
  }
  const minSide = Math.min(app.screen.width, app.screen.height);
  camZoom = Math.min(2, Math.max(1, 520 / minSide));
}
computeCamZoom();

function updateCamera(): void {
  if (!touchLayout) return;
  const vw = app.screen.width;
  const vh = app.screen.height;
  const z = camZoom;
  worldContainer.scale.set(z);

  const worldW = MAP_WIDTH * z;
  const worldH = MAP_HEIGHT * z;
  // harita ekrandan genişse oyuncuyu takip et, değilse ortala
  worldContainer.x = worldW <= vw
    ? (vw - worldW) / 2
    : Math.min(0, Math.max(vw - worldW, vw / 2 - state.self.x * z));
  worldContainer.y = worldH <= vh
    ? (vh - worldH) / 2
    : Math.min(0, Math.max(vh - worldH, vh / 2 - state.self.y * z));
}

window.addEventListener('resize', () => {
  if (!touchLayout) return;
  // Mobilde ekran klavyesi açılınca da resize tetiklenir; yazarken sahneyi
  // yeniden boyutlandırmak zıplamaya yol açtığı için atlanır.
  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  app.renderer.resize(window.innerWidth, window.innerHeight);
  computeCamZoom();
  layoutPongOverlay();
  updateCamera();
});

const promptBadge = createPromptBadge();
worldContainer.addChild(promptBadge.container);

let zoneVisuals: Map<string, ZoneVisual> | null = null;
const playerVisuals = new Map<string, PlayerVisual>();
let selfVisual: PlayerVisual | null = null;

// hangi oyuncunun hangi bench zone'unda oturduğunu (kendimiz hariç) client-local takip eder
const otherSittingZone = new Map<string, string>();

let lastFrameTime = performance.now();
let lastMoveSentAt = 0;
let eligibleZoneId: string | null = null;
let selfLastPuffAt = 0;
let selfStunnedUntil = 0; // yumruk yiyince hareket kilidi
let lastGuitarNoteAt = 0;
let lastDrumHitAt = 0;
let drumStep = 0;
let introPlayed = false;
let introSpot: { g: Graphics; startedAt: number } | null = null;

const INTRO_SPOT_MS = 2800;

// İlk giriş sahnesi: dünya ışıklarla açılır, spawn noktasına spot düşer,
// isimli karşılama banner'ı ve barmen selamıyla karşılanır.
function playIntro(): void {
  worldContainer.alpha = 0;
  // Güvence: açılış solması ticker'a bağlı. Ticker herhangi bir nedenle
  // gecikirse/durursa dünya kalıcı olarak görünmez kalmasın diye zamanlayıcıyla
  // da tam görünürlüğe çekilir (setTimeout ticker'dan bağımsız çalışır).
  setTimeout(() => {
    worldContainer.alpha = 1;
  }, 1500);

  const g = new Graphics();
  for (let i = 5; i >= 1; i--) {
    g.circle(0, -12, i * 15).fill({ color: 0xfff3d6, alpha: 0.05 });
  }
  g.x = state.self.x;
  g.y = state.self.y;
  worldContainer.addChild(g);
  introSpot = { g, startedAt: performance.now() };
  // spot ışığı da ticker'dan bağımsız olarak temizlenir
  setTimeout(() => {
    if (introSpot) {
      worldContainer.removeChild(introSpot.g);
      introSpot.g.destroy();
      introSpot = null;
    }
  }, INTRO_SPOT_MS + 400);

  const banner = document.createElement('div');
  banner.className = 'welcome-banner';
  const title = document.createElement('div');
  title.className = 'welcome-banner__title';
  title.textContent = `Piksel Bar'a hoş geldin, ${state.selfName}!`;
  const sub = document.createElement('div');
  sub.className = 'welcome-banner__sub';
  sub.textContent = 'Etrafa bak, otur, oyna — gece daha yeni başlıyor';
  banner.appendChild(title);
  banner.appendChild(sub);
  document.body.appendChild(banner);
  setTimeout(() => banner.remove(), 4600);

  sfx.welcome();
  // Karşılama repliğini sunucu 'bartender' mesajıyla salondaki herkese yollar.
}

const DUST_INTERVAL_MS = 150;

const GAME_LABELS: Record<string, string> = {
  rps: 'Taş-Kağıt-Makas',
  pong: 'Retro Pong',
  memory: 'Hafıza Kartı',
  reflex: 'Refleks Düellosu',
  penalty: 'Penaltı',
  freekick: 'Frikik',
  dart: 'Dart',
  chat: 'Sohbet',
};

function updateOnlineCount(): void {
  setOnlineCount(state.players.size + (state.selfId ? 1 : 0));
}

// Dans pistinin üzerinde şu an dans eden oyuncu sayısı (parti modu tetikleyicisi).
function onFloor(x: number, y: number): boolean {
  return Math.abs(x - DANCE_FLOOR_BOUNDS.x) <= DANCE_FLOOR_BOUNDS.halfW && Math.abs(y - DANCE_FLOOR_BOUNDS.y) <= DANCE_FLOOR_BOUNDS.halfH;
}

function countDancersOnFloor(): number {
  let count = 0;
  if (selfVisual?.actionStartedAt !== null && selfVisual?.actionEmote === '🕺' && onFloor(state.self.x, state.self.y)) count++;
  for (const v of playerVisuals.values()) {
    if (v.actionStartedAt !== null && v.actionEmote === '🕺' && onFloor(v.renderX, v.renderY)) count++;
  }
  return count;
}

// Yeniden bağlanınca welcome tekrar gelir; eski görselleri temizlemeden
// yenilerini eklersek sahnede kopyalar birikir.
function clearWorldVisuals(): void {
  if (selfVisual) {
    worldContainer.removeChild(selfVisual.container);
    selfVisual = null;
  }
  for (const v of playerVisuals.values()) worldContainer.removeChild(v.container);
  playerVisuals.clear();
  if (zoneVisuals) {
    for (const zv of zoneVisuals.values()) worldContainer.removeChild(zv.container);
    zoneVisuals = null;
  }
  otherSittingZone.clear();
  state.players.clear();
  state.zones.clear();
}

// ---- Socket olayları ----
onStatus((status) => updateStatusOverlay(status));

onMessage((msg) => {
  switch (msg.type) {
    case 'welcome': {
      clearWorldVisuals();
      const firstWelcome = state.selfId === null;
      state.selfId = msg.payload.selfId;
      state.selfName = msg.payload.selfName;
      state.selfColor = msg.payload.selfColor;
      state.selfHat = msg.payload.selfHat;
      state.self.x = msg.payload.x;
      state.self.y = msg.payload.y;
      state.sittingZoneId = null;

      zoneVisuals = createZoneVisuals(worldContainer, msg.payload.zones);
      for (const z of msg.payload.zones) state.zones.set(z.zoneId, z);

      selfVisual = createPlayerVisual(state.selfName, state.selfColor, state.selfHat, state.self.x, state.self.y, true);
      worldContainer.addChild(selfVisual.container);

      for (const p of msg.payload.players) {
        upsertPlayer(p);
        const v = createPlayerVisual(p.name, p.color, p.hat, p.x, p.y, false);
        worldContainer.addChild(v.container);
        playerVisuals.set(p.id, v);
      }
      worldContainer.addChild(promptBadge.container); // rozet en üstte kalsın
      updateOnlineCount();
      if (firstWelcome && !introPlayed) {
        introPlayed = true;
        playIntro();
        initQuests(document.body);
      }
      break;
    }
    case 'player_joined': {
      if (msg.payload.id === state.selfId) break;
      upsertPlayer(msg.payload);
      const v = createPlayerVisual(msg.payload.name, msg.payload.color, msg.payload.hat, msg.payload.x, msg.payload.y, false);
      worldContainer.addChild(v.container);
      playerVisuals.set(msg.payload.id, v);
      updateOnlineCount();
      pushActivity(`${msg.payload.name} salona katıldı`);
      break;
    }
    case 'player_moved': {
      if (msg.payload.id === state.selfId) break;
      updatePlayerPosition(msg.payload.id, msg.payload.x, msg.payload.y, msg.payload.facing, msg.payload.moving);
      break;
    }
    case 'player_left': {
      const leftName = state.players.get(msg.payload.id)?.name;
      if (leftName) pushActivity(`${leftName} salondan ayrıldı`);
      removePlayer(msg.payload.id);
      otherSittingZone.delete(msg.payload.id);
      const v = playerVisuals.get(msg.payload.id);
      if (v) {
        worldContainer.removeChild(v.container);
        playerVisuals.delete(msg.payload.id);
      }
      updateOnlineCount();
      break;
    }
    case 'zone_state': {
      // bar taburesine yeni biri oturduysa barmen içki servisine gitsin
      const prev = state.zones.get(msg.payload.zoneId);
      if (
        msg.payload.type === 'bar_stool' &&
        msg.payload.occupiedSlots[0] !== null &&
        prev?.occupiedSlots[0] !== msg.payload.occupiedSlots[0]
      ) {
        bartenderServe(bartender, msg.payload.x, performance.now());
      }
      setZone(msg.payload);
      if (zoneVisuals) updateZoneVisual(zoneVisuals, msg.payload);
      handleSeatingZoneUpdate(msg.payload);
      break;
    }
    case 'room_joined': {
      // Rakip gelince/giden olunca aynı odaya güncel kadroyla tekrar girilir.
      resetRoomState();
      state.room = msg.payload;
      state.sittingZoneId = null; // oda oluştu, artık oturmayı oda yönetir
      setWorldChatBarVisible(false);
      setEmoteBarVisible(false);
      setRestartVisible(false);
      setRoomView(msg.payload.kind); // tam ekran oyun görünümü, harita gizli

      const waiting = msg.payload.playerIds.length < 2;

      const zone = state.zones.get(msg.payload.zoneId);
      for (const pid of msg.payload.playerIds) {
        if (zone) {
          const idx = zone.occupiedSlots.indexOf(pid);
          if (idx !== -1) snapPlayerTo(pid, seatXFor(zone, idx), zone.y);
        }
        const v = pid === state.selfId ? selfVisual : playerVisuals.get(pid);
        if (v) setSitting(v, true);
      }

      showChatPanel(msg.payload.kind);
      if (msg.payload.kind === 'rps') {
        state.rps = { myChoice: null, waitingOn: [], lastResult: null, scores: {} };
        showRpsPanel(waiting);
      } else if (msg.payload.kind === 'memory') {
        state.memory = { cards: [], turn: '', scores: {} };
        showMemoryPanel(waiting);
      } else if (msg.payload.kind === 'reflex') {
        showReflexPanel(waiting);
      } else if (msg.payload.kind === 'penalty' || msg.payload.kind === 'freekick') {
        showShootoutPanel(msg.payload.kind, waiting);
        if (!waiting) sfx.whistle();
      } else if (msg.payload.kind === 'dart') {
        showDartPanel(waiting);
      } else if (msg.payload.kind === 'pong') {
        state.pong = { ball: { x: 350, y: 200 }, paddles: {}, score: {}, ended: null };
        if (waiting) showPongWinner(pongVisual, 'RAKİP BEKLENİYOR...');
        else hidePongWinner(pongVisual);
        overlayContainer.visible = true;
      }
      if (!waiting) sfx.join();
      questComplete('table');
      break;
    }
    case 'room_closed': {
      leaveRoomView();
      break;
    }
    case 'game_restarted': {
      setRestartVisible(false);
      if (msg.payload.kind === 'pong') hidePongWinner(pongVisual);
      if (msg.payload.kind === 'rps') showRpsPanel(false); // kartları/skoru sıfırla
      showToast('Yeni oyun başladı!');
      sfx.join();
      break;
    }
    case 'rps_waiting': {
      if (state.rps) state.rps.waitingOn = msg.payload.waitingOn;
      // bekleyen sadece bensem rakip seçimini yapmış demektir
      if (state.selfId && msg.payload.waitingOn.length === 1 && msg.payload.waitingOn[0] === state.selfId) {
        setRpsOpponentPicked();
      }
      break;
    }
    case 'rps_result': {
      if (state.rps) {
        state.rps.lastResult = { winner: msg.payload.winner, choices: msg.payload.choices };
        state.rps.scores = msg.payload.scores;
      }
      renderRpsResult(msg.payload.winner, msg.payload.choices, msg.payload.scores, state.selfId, msg.payload.matchWinner);
      if (msg.payload.matchWinner) {
        if (msg.payload.matchWinner === state.selfId) sfx.win();
        else sfx.lose();
        questComplete('game');
      }
      break;
    }
    case 'pong_state': {
      if (state.pong) {
        state.pong.ball = msg.payload.ball;
        state.pong.paddles = msg.payload.paddles;
        state.pong.score = msg.payload.score;
      }
      break;
    }
    case 'pong_end': {
      // Oda açık kalır; oyuncular "Yeniden Başla" diyebilir ya da ayrılabilir.
      if (state.pong) state.pong.ended = { winner: msg.payload.winner };
      const winnerLabel = msg.payload.winner === state.selfId ? 'Kazandın!' : `Kazanan: ${displayName(msg.payload.winner)}`;
      showPongWinner(pongVisual, winnerLabel);
      setRestartVisible(true);
      if (msg.payload.winner === state.selfId) sfx.win();
      else sfx.lose();
      questComplete('game');
      break;
    }
    case 'reflex_state': {
      renderReflexState(
        msg.payload.phase,
        msg.payload.round,
        msg.payload.scores,
        msg.payload.lastWinner,
        msg.payload.falseStart,
        msg.payload.matchWinner,
        state.selfId,
      );
      if (msg.payload.phase === 'armed') sfx.goal();
      if (msg.payload.matchWinner) {
        if (msg.payload.matchWinner === state.selfId) sfx.win();
        else sfx.lose();
        questComplete('game');
      }
      break;
    }
    case 'shootout_state': {
      renderShootoutState(
        msg.payload.mode,
        msg.payload.phase,
        msg.payload.kick,
        msg.payload.totalKicks,
        msg.payload.shooter,
        msg.payload.scores,
        msg.payload.waitingOn,
        msg.payload.wall,
        msg.payload.last,
        msg.payload.suddenDeath,
        msg.payload.matchWinner,
        state.selfId,
      );
      if (msg.payload.phase === 'result' && msg.payload.last) {
        if (msg.payload.last.outcome === 'goal') sfx.golScored();
        else sfx.saved();
      }
      if (msg.payload.matchWinner) {
        sfx.whistle();
        if (msg.payload.matchWinner === state.selfId) sfx.win();
        else sfx.lose();
        questComplete('game');
      }
      break;
    }
    case 'dart_state': {
      renderDartState(
        msg.payload.phase,
        msg.payload.thrower,
        msg.payload.remaining,
        msg.payload.turnDarts,
        msg.payload.lastDart,
        msg.payload.bust,
        msg.payload.matchWinner,
        state.selfId,
      );
      if (msg.payload.phase === 'result' && msg.payload.lastDart) {
        if (msg.payload.bust) sfx.lose();
        else if (msg.payload.lastDart.score >= 40) sfx.golScored();
        else if (msg.payload.lastDart.score > 0) sfx.goal();
      }
      if (msg.payload.matchWinner) {
        if (msg.payload.matchWinner === state.selfId) sfx.win();
        else sfx.lose();
        questComplete('game');
      }
      break;
    }
    case 'punch_event': {
      // saldırgan yumruk sallar, kurban savrulup yere serilir
      const attackerV = msg.payload.attacker === state.selfId ? selfVisual : playerVisuals.get(msg.payload.attacker);
      if (attackerV) playPunch(attackerV);
      sfx.punch();

      if (msg.payload.victim === state.selfId) {
        state.self.x = msg.payload.victimX;
        state.self.y = msg.payload.victimY;
        state.self.moving = false;
        selfStunnedUntil = performance.now() + msg.payload.stunMs;
        if (selfVisual) {
          playKnockdown(selfVisual, msg.payload.stunMs);
          setSelfPosition(selfVisual, state.self.x, state.self.y, false, 0);
        }
      } else {
        const p = state.players.get(msg.payload.victim);
        if (p) {
          p.x = msg.payload.victimX;
          p.y = msg.payload.victimY;
          p.moving = false;
        }
        const v = playerVisuals.get(msg.payload.victim);
        if (v) playKnockdown(v, msg.payload.stunMs);
      }
      break;
    }
    case 'memory_state': {
      if (state.memory) {
        state.memory.cards = msg.payload.cards;
        state.memory.turn = msg.payload.turn;
        state.memory.scores = msg.payload.scores;
      }
      renderMemoryState(msg.payload.cards, msg.payload.turn, msg.payload.scores, state.selfId);
      if (msg.payload.cards.length > 0 && msg.payload.cards.every((c) => c.matched)) questComplete('game');
      break;
    }
    case 'memory_match_result': {
      if (msg.payload.matched) sfx.match();
      break; // görsel güncelleme memory_state ile gelir
    }
    case 'pong_goal': {
      sfx.goal();
      break;
    }
    case 'chat_message': {
      const entry: ChatEntry = msg.payload;
      state.chatMessages.push(entry);
      addChatMessage(entry, state.selfId);
      if (entry.from !== state.selfId) sfx.chat();
      break;
    }
    case 'world_chat_message': {
      const v = msg.payload.from === state.selfId ? selfVisual : playerVisuals.get(msg.payload.from);
      if (v) showSpeechBubble(v, msg.payload.text);
      if (msg.payload.from === state.selfId) questComplete('chat');
      break;
    }
    case 'player_emote': {
      if (msg.payload.from === state.selfId) break; // kendi emote'umuz lokal oynatıldı
      const v = playerVisuals.get(msg.payload.from);
      if (v) {
        playEmote(v, msg.payload.emote);
        sfx.emote();
      }
      break;
    }
    case 'activity': {
      if (msg.payload.kind === 'game_win') {
        const label = GAME_LABELS[msg.payload.game] ?? msg.payload.game;
        pushActivity(`${label}: ${msg.payload.winner} kazandı · rakip ${msg.payload.loser}`, 'win');
      } else if (msg.payload.kind === 'jukebox') {
        pushActivity(`${msg.payload.name} müzik kutusuna jeton attı: ${msg.payload.title}`);
      }
      break;
    }
    case 'jukebox_state': {
      renderJukeboxState(msg.payload, state.selfName);
      break;
    }
    case 'leaderboard': {
      renderLeaderboard(msg.payload.top);
      break;
    }
    case 'bartender': {
      // metni sunucu seçti: salondaki herkes aynı repliği görür
      bartenderSay(bartender, msg.payload.text, performance.now());
      break;
    }
    case 'token_state': {
      setCoinToken(coinToken, msg.payload.token);
      break;
    }
    case 'free_songs': {
      if (msg.payload.gained) {
        sfx.match();
        showToast(`Jeton topladın! Bedava şarkı hakkı: ${msg.payload.count}`);
      }
      break;
    }
    case 'error': {
      showToast(msg.payload.message, 'error');
      break;
    }
  }
});

function snapPlayerTo(playerId: string, x: number, y: number): void {
  if (playerId === state.selfId) {
    state.self.x = x;
    state.self.y = y;
    if (selfVisual) setSelfPosition(selfVisual, x, y, false, 0);
  } else {
    const p = state.players.get(playerId);
    if (p) {
      p.x = x;
      p.y = y;
    }
    const v = playerVisuals.get(playerId);
    if (v) {
      v.renderX = x;
      v.renderY = y;
      v.container.x = x;
      v.container.y = y;
    }
  }
}

// Bir zonun (bank veya masa) dolulukta değişince: kendimiz veya başka bir oyuncu
// oturup/kalkınca oturma pozunu ve client-local sitting-zone takibini günceller.
// Oda oluşana kadar (room_joined) masalar da tıpkı banklar gibi "oturup bekleme" halinde gösterilir.
// Koltuğun dünya X konumu: tek koltuklu zonlarda (bar taburesi) merkez,
// iki koltuklularda merkezin iki yanı.
function seatXFor(zone: PublicZone, idx: number): number {
  if (zone.occupiedSlots.length === 1) return zone.x;
  return idx === 0 ? zone.x - ZONE_SLOT_OFFSET_X : zone.x + ZONE_SLOT_OFFSET_X;
}

// Sahne koltuğunda hangi enstrümanın çalındığı (yoksa null).
function instrumentFor(zone: PublicZone): 'guitar' | 'drums' | null {
  if (zone.type === 'stage_guitar') return 'guitar';
  if (zone.type === 'stage_drums') return 'drums';
  return null;
}

function handleSeatingZoneUpdate(zone: PublicZone): void {
  const selfId = state.selfId;
  const selfIdx = selfId ? zone.occupiedSlots.indexOf(selfId) : -1;
  const barStool = zone.type === 'bar_stool'; // tezgaha oturunca sırt kameraya döner
  const instrument = instrumentFor(zone);

  if (selfIdx !== -1 && state.sittingZoneId !== zone.zoneId) {
    state.sittingZoneId = zone.zoneId;
    snapPlayerTo(selfId!, seatXFor(zone, selfIdx), zone.y);
    if (selfVisual) {
      if (barStool) {
        state.self.facing = 'up';
        selfVisual.facing = 'up';
      }
      setInstrument(selfVisual, instrument);
      setSitting(selfVisual, true);
    }
    sfx.sit();
    if (barStool) questComplete('stool');
  } else if (selfIdx === -1 && state.sittingZoneId === zone.zoneId) {
    state.sittingZoneId = null;
    if (selfVisual) {
      setInstrument(selfVisual, null);
      setSitting(selfVisual, false);
    }
  }

  for (const [pid, zid] of [...otherSittingZone]) {
    if (zid === zone.zoneId && !zone.occupiedSlots.includes(pid)) {
      otherSittingZone.delete(pid);
      const v = playerVisuals.get(pid);
      if (v) {
        setInstrument(v, null);
        setSitting(v, false);
      }
    }
  }

  zone.occupiedSlots.forEach((occupantId, idx) => {
    if (!occupantId || occupantId === selfId) return;
    if (otherSittingZone.get(occupantId) === zone.zoneId) return;
    otherSittingZone.set(occupantId, zone.zoneId);
    snapPlayerTo(occupantId, seatXFor(zone, idx), zone.y);
    const v = playerVisuals.get(occupantId);
    if (v) {
      if (barStool) v.facing = 'up';
      setInstrument(v, instrument);
      setSitting(v, true);
    }
  });
}

// Oda görünümünü açar/kapatır: haritayı gizler, tam ekran oyun katmanını gösterir.
// Pong canvas tabanlı olduğu için canvas'ı sahneye taşırız; DOM oyunlarda canvas gizlenir.
function setRoomView(kind: import('./protocol.js').RoomKind | null): void {
  const inRoom = kind !== null;
  document.body.classList.toggle('in-room', inRoom);
  document.body.classList.toggle('room-pong', kind === 'pong');
  worldContainer.visible = !inRoom;

  // Mobilde tuval zaten tam ekran sabit; taşımaya gerek yok (ve taşımak
  // fixed konumlandırmayı bozar). Masaüstünde pong tuvali sahneye taşınır.
  if (!touchLayout) {
    if (kind === 'pong') {
      roomStage.appendChild(gameWrap);
    } else if (gameWrap.parentElement !== appRoot) {
      appRoot.insertBefore(gameWrap, appRoot.firstChild);
    }
  }
  roomView.classList.toggle('hidden', !inRoom);
  setTouchControlsMode(!inRoom ? 'world' : kind === 'pong' ? 'pong' : 'hidden');
}

function leaveRoomView(): void {
  const prevPlayerIds = state.room?.playerIds ?? [];
  state.room = null;
  resetRoomState();
  setRoomView(null);
  hideChatPanel();
  hideRpsPanel();
  hideMemoryPanel();
  hideReflexPanel();
  hideShootoutPanel();
  hideDartPanel();
  overlayContainer.visible = false;
  setWorldChatBarVisible(true);
  setEmoteBarVisible(true);
  for (const pid of prevPlayerIds) {
    const v = pid === state.selfId ? selfVisual : playerVisuals.get(pid);
    if (v) setSitting(v, false);
  }
}

// Otur / kalk / oyuna gir / müzik kutusu — 'E' tuşu ve dokunmatik E düğmesi paylaşır.
function doInteract(): void {
  if (state.room) return;
  if (state.sittingZoneId) {
    sendMessage({ type: 'seat_leave', payload: {} });
    return;
  }
  if (eligibleZoneId) {
    sendMessage({ type: 'zone_interact', payload: { zoneId: eligibleZoneId } });
  } else if (nearJukebox()) {
    toggleJukeboxPanel();
  }
}

// Yakındaki oyuncuya yumruk (hedefi sunucu seçer) — 'F' tuşu ve dokunmatik F düğmesi.
function doPunch(): void {
  if (state.room || state.sittingZoneId) return;
  if (performance.now() < selfStunnedUntil) return; // yerdeyken yumruk yok
  sendMessage({ type: 'punch', payload: {} });
  if (selfVisual) playPunch(selfVisual); // menzilde kimse yoksa da sallanır
}

function isTypingTarget(): boolean {
  const tag = document.activeElement?.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA';
}

window.addEventListener('keydown', (e) => {
  if (isTypingTarget()) return;
  const k = e.key.toLowerCase();
  if (k === 'e') doInteract();
  else if (k === 'f') doPunch();
});

initTouchControls(document.body, { onInteract: doInteract, onPunch: doPunch });

function nearJukebox(): boolean {
  return Math.hypot(state.self.x - JUKEBOX_POS.x, state.self.y - JUKEBOX_POS.y) < JUKEBOX_INTERACT_RADIUS;
}

// Dünya görünümündeki E rozetini günceller: önce oturulabilir zone, yoksa müzik kutusu.
function updateWorldPrompt(eligible: PublicZone | null): void {
  if (!eligible && nearJukebox()) {
    updateJukeboxBadge(promptBadge, state.self.x, state.self.y);
    return;
  }
  updatePromptBadge(promptBadge, eligible, state.self.x, state.self.y);
}

function findEligibleZone(): PublicZone | null {
  for (const zone of state.zones.values()) {
    const dist = Math.hypot(zone.x - state.self.x, zone.y - state.self.y);
    if (dist > zone.radius) continue;
    if (zone.occupiedSlots.every((s) => s !== null)) continue;
    if (zone.occupiedSlots.includes(state.selfId)) continue;
    return zone;
  }
  return null;
}

function applyMovement(vec: MoveVector, dtMs: number, now: number): void {
  if (!selfVisual) return;
  // yumruk yiyip yerdeyken hareket edilemez (sunucu da reddediyor)
  if (now < selfStunnedUntil) {
    setSelfPosition(selfVisual, state.self.x, state.self.y, false, dtMs);
    return;
  }
  if (vec.moving) {
    // FPS'ten bağımsız hız; sekme arka plana düşüp dönünce ışınlanmayı önlemek için dt sınırlanır
    const step = MOVE_SPEED_PX_PER_S * Math.min(dtMs, 100) / 1000;
    state.self.x = Math.max(0, Math.min(MAP_WIDTH, state.self.x + vec.dx * step));
    // üst sınır: bar tezgahının arkasına yürünemez, karakter hep tam görünür
    state.self.y = Math.max(PLAYER_MIN_Y, Math.min(MAP_HEIGHT, state.self.y + vec.dy * step));
    if (vec.facing) state.self.facing = vec.facing;
  }
  state.self.moving = vec.moving;
  setSelfPosition(selfVisual, state.self.x, state.self.y, vec.moving, dtMs, state.self.facing);

  if (vec.moving && now - selfLastPuffAt > DUST_INTERVAL_MS) {
    selfLastPuffAt = now;
    spawnDust(dustLayer, state.self.x, state.self.y);
  }

  if (now - lastMoveSentAt > MOVE_SEND_INTERVAL_MS) {
    lastMoveSentAt = now;
    sendMessage({
      type: 'move',
      payload: { x: state.self.x, y: state.self.y, facing: state.self.facing, moving: vec.moving },
    });
  }
}

// ---- Ana döngü ----
app.ticker.add(() => {
  const now = performance.now();
  const dtMs = now - lastFrameTime;
  lastFrameTime = now;

  // giriş sahnesi: dünya yumuşakça aydınlanır, spot ışığı söner
  if (worldContainer.alpha < 1) {
    worldContainer.alpha = Math.min(1, worldContainer.alpha + dtMs / 900);
  }
  if (introSpot) {
    const t = (now - introSpot.startedAt) / INTRO_SPOT_MS;
    if (t >= 1) {
      worldContainer.removeChild(introSpot.g);
      introSpot.g.destroy();
      introSpot = null;
    } else {
      introSpot.g.alpha = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
      introSpot.g.scale.set(1 + t * 0.15);
    }
  }

  tickAmbientParticles(ambientParticles, dtMs, now);
  tickDanceFloor(danceFloor, now, dtMs, countDancersOnFloor() >= 2);
  tickDust(dustLayer, now);
  tickBartender(bartender, now);
  tickStringLights(stringLights, now);
  tickJukeboxGlow(jukeboxGlow, now, jukeboxHasSong());
  tickCoinToken(coinToken, now);

  // Sahne: koltuklar doluysa hafif enstrüman sesleri (görsel animasyon oturma pozunda)
  let guitarOn = false;
  let drumsOn = false;
  for (const zone of state.zones.values()) {
    if (zone.type === 'stage_guitar' && zone.occupiedSlots[0]) guitarOn = true;
    if (zone.type === 'stage_drums' && zone.occupiedSlots[0]) drumsOn = true;
  }
  if (guitarOn && now - lastGuitarNoteAt > 430) {
    lastGuitarNoteAt = now;
    playGuitarNote();
  }
  if (drumsOn && now - lastDrumHitAt > 225) {
    lastDrumHitAt = now;
    playDrumHit(drumStep++);
  }

  if (!state.room && selfVisual) {
    if (state.sittingZoneId) {
      const vec = getMoveVector();
      if (vec.moving) {
        sendMessage({ type: 'seat_leave', payload: {} });
        state.sittingZoneId = null;
        setSitting(selfVisual, false);
        applyMovement(vec, dtMs, now);
        const eligible = findEligibleZone();
        eligibleZoneId = eligible?.zoneId ?? null;
        updateWorldPrompt(eligible);
      } else {
        setSelfPosition(selfVisual, state.self.x, state.self.y, false, dtMs);
        updateStandUpBadge(promptBadge, state.self.x, state.self.y, state.sittingZoneId ?? 'seat');
      }
    } else {
      const vec = getMoveVector();
      applyMovement(vec, dtMs, now);
      const eligible = findEligibleZone();
      eligibleZoneId = eligible?.zoneId ?? null;
      updateWorldPrompt(eligible);
    }
  } else {
    promptBadge.container.visible = false;
    eligibleZoneId = null;
    // Odadayken de karakter yeniden çizilsin (göz kırpma vb. animasyonlar donmasın)
    if (selfVisual) setSelfPosition(selfVisual, state.self.x, state.self.y, false, dtMs);
  }

  if (zoneVisuals) tickZoneHighlights(zoneVisuals, state.room || state.sittingZoneId ? null : eligibleZoneId, now);

  for (const [id, target] of state.players) {
    const v = playerVisuals.get(id);
    if (!v) continue;
    updatePlayerVisual(v, target.x, target.y, target.moving, dtMs, target.facing);
    if (target.moving && now - v.lastPuffAt > DUST_INTERVAL_MS) {
      v.lastPuffAt = now;
      spawnDust(dustLayer, v.renderX, v.renderY);
    }
  }

  if (selfVisual) {
    tickSpeechBubble(selfVisual, now);
    tickEmote(selfVisual, now);
  }
  for (const v of playerVisuals.values()) {
    tickSpeechBubble(v, now);
    tickEmote(v, now);
  }

  updateCamera(); // mobilde kamerayı oyuncuya kilitler (masaüstünde no-op)

  if (state.room?.kind === 'pong' && state.pong && state.room.pongSides && state.room.playerIds.length === 2) {
    const dir = getPongDir();
    sendMessage({ type: 'pong_input', payload: { dir } });

    const [pA, pB] = state.room.playerIds;
    const leftId = state.room.pongSides[pA] === 'left' ? pA : pB;
    const rightId = leftId === pA ? pB : pA;
    const leftY = state.pong.paddles[leftId] ?? 160;
    const rightY = state.pong.paddles[rightId] ?? 160;
    const score: [number, number] = [state.pong.score[leftId] ?? 0, state.pong.score[rightId] ?? 0];
    updatePongVisual(pongVisual, state.pong.ball, leftY, rightY, score);
  }
});

// ---- Giriş ekranı: oyuncu adını, rengini, şapkasını ve salonunu seçince bağlan ----
initJoinScreen(document.body, (name, color, hat, bar) => {
  const barDef = BARS.find((b) => b.id === bar);
  setBarName(barDef ? barDef.name : '');
  connect(name, color, hat, bar);
});

// Salon dolu reddi: yeniden bağlanma döngüsüne girme, oda seçimine dön.
onRejected(() => {
  showToast('Seçtiğin salon dolu. Salon seçimine dönülüyor...', 'error');
  setTimeout(() => window.location.reload(), 1800);
});
