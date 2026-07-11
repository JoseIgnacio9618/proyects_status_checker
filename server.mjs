import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { WebSocketServer, WebSocket } from 'ws';

process.env.ASTRO_NODE_AUTOSTART = 'disabled';
const { handler } = await import('./dist/server/entry.mjs');
const clientDirectory = resolve(process.cwd(), 'dist/client');
const contentTypes = { '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json; charset=utf-8' };
function serveStatic(request, response) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return false;
  const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
  const candidate = resolve(clientDirectory, `.${pathname}`);
  if (!candidate.startsWith(`${clientDirectory}${sep}`) || !existsSync(candidate) || !statSync(candidate).isFile()) return false;
  response.writeHead(200, { 'Content-Type': contentTypes[extname(candidate)] ?? 'application/octet-stream', 'Cache-Control': 'public, max-age=31536000, immutable' });
  if (request.method === 'HEAD') response.end(); else createReadStream(candidate).pipe(response);
  return true;
}
const server = http.createServer((request, response) => { if (!serveStatic(request, response)) return handler(request, response); });
const sockets = new WebSocketServer({ noServer: true });
const clients = new Map();
const port = Number(process.env.PORT || 4321);

function send(client, message) { if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify(message)); }
async function snapshot(serviceId) {
  const response = await fetch(`http://127.0.0.1:${port}/api/status`);
  const all = await response.json();
  if (!serviceId) return { type: 'snapshot', scope: 'all', ...all };
  const service = all.services.find((item) => item.id === serviceId);
  return service ? { type: 'snapshot', scope: 'service', service } : { type: 'error', error: 'Servicio no encontrado.' };
}
sockets.on('connection', async (client) => {
  clients.set(client, { serviceId: null, previous: '' });
  const first = await snapshot(null); clients.get(client).previous = JSON.stringify(first); send(client, first);
  client.on('message', async (raw) => {
    try {
      const message = JSON.parse(raw.toString());
      if (message.action !== 'subscribe') return send(client, { type: 'error', error: 'Acción no válida.' });
      const serviceId = typeof message.serviceId === 'string' ? message.serviceId : null;
      const next = await snapshot(serviceId); clients.set(client, { serviceId, previous: JSON.stringify(next) }); send(client, next);
    } catch { send(client, { type: 'error', error: 'Mensaje JSON no válido.' }); }
  });
  client.on('close', () => clients.delete(client));
});
setInterval(async () => { for (const [client, subscription] of clients) { try { const next = await snapshot(subscription.serviceId); const serialised = JSON.stringify(next); if (serialised !== subscription.previous) { subscription.previous = serialised; send(client, { type: 'status', ...next, at: new Date().toISOString() }); } } catch { send(client, { type: 'error', error: 'No se pudo consultar el monitor.' }); } } }, 1000);
server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
  if (url.pathname !== '/ws') return socket.destroy();
  sockets.handleUpgrade(request, socket, head, (client) => sockets.emit('connection', client, request));
});
server.listen(port, '0.0.0.0', () => console.log(`Pulsewatch listening on ${port}`));
