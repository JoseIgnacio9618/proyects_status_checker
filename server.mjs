import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, resolve, sep } from 'node:path';
import { attachRealtimeHub } from './realtime-hub.mjs';

process.env.ASTRO_NODE_AUTOSTART = 'disabled';

const { handler } = await import('./dist/server/entry.mjs');
const port = Number(process.env.PORT ?? 4321);
const clientDirectory = resolve(process.cwd(), 'dist/client');

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

function serveStaticAsset(request, response) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return false;

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
  } catch {
    response.writeHead(400).end();
    return true;
  }

  const filePath = resolve(clientDirectory, `.${pathname}`);
  const isClientAsset = filePath.startsWith(`${clientDirectory}${sep}`);

  if (!isClientAsset || !existsSync(filePath) || !statSync(filePath).isFile()) {
    return false;
  }

  response.writeHead(200, {
    'Content-Type': contentTypes[extname(filePath)] ?? 'application/octet-stream',
    'Cache-Control': 'public, max-age=31536000, immutable',
  });

  if (request.method === 'HEAD') {
    response.end();
  } else {
    createReadStream(filePath).pipe(response);
  }

  return true;
}

const server = http.createServer((request, response) => {
  if (!serveStaticAsset(request, response)) {
    return handler(request, response);
  }
});

async function fetchSummary() {
  const response = await fetch(`http://127.0.0.1:${port}/api/status`);
  if (!response.ok) throw new Error(`Status endpoint returned ${response.status}.`);
  return response.json();
}

const realtimeHub = attachRealtimeHub(server, fetchSummary);

function shutdown(signal) {
  console.info(`Received ${signal}. Shutting down Pulsewatch.`);
  realtimeHub.close();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

server.listen(port, '0.0.0.0', () => {
  console.info(`Pulsewatch is listening on port ${port}.`);
});
