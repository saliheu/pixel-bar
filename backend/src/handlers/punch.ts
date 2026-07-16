import { players } from '../state/players.js';
import { broadcastBar } from '../util/broadcast.js';
import { findSeatZoneFor } from '../state/zones.js';
import { MAP_WIDTH, MAP_HEIGHT, PLAYER_MIN_Y, PUNCH_RANGE, PUNCH_KNOCKBACK, PUNCH_COOLDOWN_MS, PUNCH_STUN_MS } from '../config.js';

// Yumruk: en yakındaki ayakta duran oyuncuyu seçer, savurur ve kısa süre yere serer.
// Hedef seçimi ve konum değişikliği sunucu otoritesindedir.
export function handlePunch(playerId: string): void {
  const attacker = players.get(playerId);
  if (!attacker) return;

  const now = Date.now();
  if (now - attacker.lastPunchAt < PUNCH_COOLDOWN_MS) return;
  if (now < attacker.stunnedUntil) return; // yerdeyken yumruk atılamaz
  if (attacker.roomId || findSeatZoneFor(playerId)) return; // otururken/oyundayken olmaz

  // aynı salonda, ayakta, menzildeki en yakın oyuncu
  let victim = null as typeof attacker | null;
  let best = PUNCH_RANGE;
  for (const p of players.values()) {
    if (p.id === playerId || p.barId !== attacker.barId) continue;
    if (p.roomId || findSeatZoneFor(p.id)) continue;
    const dist = Math.hypot(p.x - attacker.x, p.y - attacker.y);
    if (dist <= best) {
      best = dist;
      victim = p;
    }
  }

  attacker.lastPunchAt = now; // menzilde kimse yoksa da sallanmış sayılır
  if (!victim) return;

  // savrulma: saldırgandan uzağa; üst üsteyse rastgele yön
  let dx = victim.x - attacker.x;
  let dy = victim.y - attacker.y;
  const len = Math.hypot(dx, dy);
  if (len < 1) {
    const ang = Math.random() * Math.PI * 2;
    dx = Math.cos(ang);
    dy = Math.sin(ang);
  } else {
    dx /= len;
    dy /= len;
  }
  victim.x = Math.max(0, Math.min(MAP_WIDTH, victim.x + dx * PUNCH_KNOCKBACK));
  victim.y = Math.max(PLAYER_MIN_Y, Math.min(MAP_HEIGHT, victim.y + dy * PUNCH_KNOCKBACK));
  victim.stunnedUntil = now + PUNCH_STUN_MS;
  victim.moving = false;

  broadcastBar(attacker.barId, {
    type: 'punch_event',
    payload: { attacker: attacker.id, victim: victim.id, victimX: victim.x, victimY: victim.y, stunMs: PUNCH_STUN_MS },
  });
}
