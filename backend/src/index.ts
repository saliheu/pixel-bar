import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { handleConnection, startHeartbeat, startStaleSweep } from './handlers/connection.js';
import { startBartenderIdle } from './handlers/bartender.js';
import { startTokenSpawner } from './handlers/token.js';
import { countPlayersInBar } from './state/players.js';
import { BAR_IDS, BAR_CAPACITY } from './config.js';

const PORT = Number(process.env.PORT) || 8080;
// Virgülle ayrılmış izinli origin listesi; boşsa tüm origin'ler kabul edilir.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGIN ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const httpServer = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
    return;
  }
  // Oda seçim ekranı için doluluk bilgisi (frontend ayrı origin'de olduğundan CORS açık).
  if (req.url === '/lobbies') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
    });
    res.end(
      JSON.stringify({
        capacity: BAR_CAPACITY,
        bars: BAR_IDS.map((id) => ({ id, count: countPlayersInBar(id) })),
      }),
    );
    return;
  }
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('not found');
});

const wss = new WebSocketServer({
  server: httpServer,
  verifyClient: ({ origin }: { origin?: string }) =>
    ALLOWED_ORIGINS.length === 0 || (origin !== undefined && ALLOWED_ORIGINS.includes(origin)),
});

wss.on('connection', (socket, req) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const name = url.searchParams.get('name');
  const colorRaw = url.searchParams.get('color');
  const color = colorRaw !== null && colorRaw !== '' ? Number(colorRaw) : null;
  const hatRaw = url.searchParams.get('hat');
  const hat = hatRaw !== null && hatRaw !== '' ? Number(hatRaw) : null;
  const bar = url.searchParams.get('bar');
  handleConnection(socket, name, color, hat, bar);
});

const heartbeat = startHeartbeat();
const staleSweep = startStaleSweep();
const bartenderIdle = startBartenderIdle();
const tokenSpawner = startTokenSpawner();

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend dinliyor: 0.0.0.0:${PORT}`);
});

function shutdown(): void {
  console.log('Kapanış sinyali alındı, sunucu kapatılıyor...');
  clearInterval(heartbeat);
  clearInterval(staleSweep);
  clearInterval(bartenderIdle);
  clearInterval(tokenSpawner);
  for (const client of wss.clients) client.close(1001, 'server shutting down');
  wss.close();
  httpServer.close(() => process.exit(0));
  // bağlantılar makul sürede kapanmazsa zorla çık
  setTimeout(() => process.exit(0), 5000).unref();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
