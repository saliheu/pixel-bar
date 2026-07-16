// Çok odalı (4 salon) mimarinin sunucu tarafı doğrulaması.
// Kullanım: önce backend'i test portunda başlat (PORT=8099 npm run dev ya da dist),
// sonra: node scripts/smoke-multiroom.mjs [port]
import WebSocket from 'ws';

const PORT = process.argv[2] ?? '8099';
const HTTP = `http://localhost:${PORT}`;
const WS = `ws://localhost:${PORT}`;

let passed = 0;
let failed = 0;

function ok(cond, label) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.error(`  ✗ ${label}`);
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Basit bot: mesajları biriktirir, welcome'ı bekleyebilir.
function bot(name, bar) {
  const ws = new WebSocket(`${WS}?name=${name}&color=1&hat=1&bar=${bar}`);
  const b = {
    ws,
    name,
    msgs: [],
    welcome: null,
    closedCode: null,
    send: (m) => ws.send(JSON.stringify(m)),
    async waitFor(type, timeoutMs = 4000) {
      const t0 = Date.now();
      while (Date.now() - t0 < timeoutMs) {
        const found = this.msgs.find((m) => m.type === type);
        if (found) return found;
        await sleep(25);
      }
      return null;
    },
    async waitForMany(type, count, timeoutMs = 6000) {
      const t0 = Date.now();
      while (Date.now() - t0 < timeoutMs) {
        const found = this.msgs.filter((m) => m.type === type);
        if (found.length >= count) return found;
        await sleep(25);
      }
      return this.msgs.filter((m) => m.type === type);
    },
    count(type) {
      return this.msgs.filter((m) => m.type === type).length;
    },
    close: () => ws.close(),
  };
  ws.on('message', (raw) => {
    const m = JSON.parse(raw.toString());
    b.msgs.push(m);
    if (m.type === 'welcome') b.welcome = m.payload;
  });
  ws.on('close', (code) => {
    b.closedCode = code;
  });
  ws.on('error', () => {});
  return b;
}

async function lobbies() {
  const res = await fetch(`${HTTP}/lobbies`);
  return res.json();
}

console.log('--- 1) /lobbies başlangıç durumu ---');
{
  const data = await lobbies();
  ok(data.capacity === 25, `kapasite 25 (gelen: ${data.capacity})`);
  ok(data.bars.length === 4, `4 salon var (gelen: ${data.bars.length})`);
  ok(data.bars.every((b) => b.count === 0), 'tüm salonlar boş başlıyor');
  ok(JSON.stringify(data.bars.map((b) => b.id)) === JSON.stringify(['neon', 'arcade', 'lofi', 'disko']), 'salon idleri doğru');
}

console.log('--- 2) Aynı salona girenler birbirini görür, farklı salonlar izole ---');
const a = bot('BotA', 'neon');
await a.waitFor('welcome');
ok(a.welcome !== null, 'A (neon) welcome aldı');
ok(a.welcome.players.length === 0, 'A ilk girişte kimseyi görmüyor');
ok(a.welcome.zones.length > 0 && a.welcome.zones.every((z) => z.zoneId.startsWith('neon:')), `A'nın tüm zonları neon: önekli (${a.welcome.zones.length} zon)`);

const b = bot('BotB', 'neon');
await b.waitFor('welcome');
ok(b.welcome.players.length === 1 && b.welcome.players[0].name === 'BotA', 'B (neon) girişte A\'yı görüyor');
ok((await a.waitFor('player_joined')) !== null, 'A, B\'nin katılımını aldı');

const c = bot('BotC', 'arcade');
await c.waitFor('welcome');
ok(c.welcome.players.length === 0, 'C (arcade) kimseyi görmüyor (izolasyon)');
await sleep(400);
ok(a.count('player_joined') === 1, 'A, C\'nin katılımını GÖRMEDİ (izolasyon)');

{
  const data = await lobbies();
  const get = (id) => data.bars.find((x) => x.id === id).count;
  ok(get('neon') === 2 && get('arcade') === 1 && get('lofi') === 0, `doluluk: neon=2 arcade=1 lofi=0 (gelen: ${data.bars.map((x) => x.count)})`);
}

console.log('--- 3) Hareket ve dünya sohbeti salon içinde kalır ---');
a.msgs.length = 0;
b.msgs.length = 0;
c.msgs.length = 0;
a.send({ type: 'move', payload: { x: 610, y: 360, facing: 'down', moving: false } });
ok((await b.waitFor('player_moved')) !== null, 'B, A\'nın hareketini aldı');
await sleep(300);
ok(c.count('player_moved') === 0, 'C, A\'nın hareketini almadı');

b.send({ type: 'move', payload: { x: 600, y: 350, facing: 'down', moving: false } });
await sleep(150);
a.send({ type: 'world_chat_send', payload: { text: 'selam neon!' } });
ok((await b.waitFor('world_chat_message')) !== null, 'B, dünya sohbetini aldı (aynı salon, yakın)');
await sleep(300);
ok(c.count('world_chat_message') === 0, 'C, dünya sohbetini almadı (farklı salon, aynı koordinatlar)');

console.log('--- 4) Oyun odaları salon içinde çalışıyor (refleks) ---');
a.msgs.length = 0;
b.msgs.length = 0;
a.send({ type: 'move', payload: { x: 150, y: 600, facing: 'down', moving: false } });
b.send({ type: 'move', payload: { x: 150, y: 600, facing: 'down', moving: false } });
await sleep(150);
a.send({ type: 'zone_interact', payload: { zoneId: 'neon:reflex-1' } });
await a.waitFor('room_joined');
b.send({ type: 'zone_interact', payload: { zoneId: 'neon:reflex-1' } });
const roomB = await b.waitFor('room_joined');
ok(roomB !== null && roomB.payload.kind === 'reflex' && roomB.payload.playerIds.length === 2, 'refleks odası 2 kişiyle kuruldu');
ok((await a.waitFor('reflex_state')) !== null, 'reflex_state akmaya başladı');

console.log('--- 5) Başka salonun masasına oturulamaz ---');
c.msgs.length = 0;
c.send({ type: 'move', payload: { x: 150, y: 600, facing: 'down', moving: false } });
await sleep(100);
c.send({ type: 'zone_interact', payload: { zoneId: 'neon:reflex-2' } });
await sleep(400);
ok(c.count('room_joined') === 0, 'C (arcade) neon masasına oturamadı');

console.log('--- 6) Kapasite: 25 dolunca 26. kişi 4008 ile reddedilir ---');
const fillers = [];
for (let i = 0; i < 25; i++) fillers.push(bot(`Lofi${i}`, 'lofi'));
await Promise.all(fillers.map((f) => f.waitFor('welcome', 8000)));
const gotIn = fillers.filter((f) => f.welcome !== null).length;
ok(gotIn === 25, `25 bot lofi'ye girdi (giren: ${gotIn})`);
const extra = bot('Fazlalik', 'lofi');
const t0 = Date.now();
while (extra.closedCode === null && Date.now() - t0 < 4000) await sleep(30);
ok(extra.closedCode === 4008, `26. bot 4008 ile reddedildi (gelen kod: ${extra.closedCode})`);
{
  const data = await lobbies();
  ok(data.bars.find((x) => x.id === 'lofi').count === 25, 'lobbies lofi=25 gösteriyor');
}

console.log('--- 7) Temizlik: bağlantılar kapanınca sayaçlar düşer ---');
for (const f of fillers) f.close();
a.close();
b.close();
c.close();
await sleep(800);
{
  const data = await lobbies();
  ok(data.bars.every((x) => x.count === 0), `tüm salonlar boşaldı (gelen: ${data.bars.map((x) => x.count)})`);
}

console.log(`\nSonuç: ${passed} geçti, ${failed} kaldı`);
process.exit(failed === 0 ? 0 : 1);
