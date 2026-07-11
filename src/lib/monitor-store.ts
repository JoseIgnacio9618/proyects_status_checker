import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import WebSocket from 'ws';

export type MonitorState = 'online' | 'offline' | 'connecting';
export type Service = { id: string; name: string; url: string; enabled: boolean };
type LiveService = Service & { state: MonitorState; lastSeen?: string; latency?: number; socket?: WebSocket; reconnect?: ReturnType<typeof setTimeout> };

const initial: Service[] = [
  { id: 'demo-core', name: 'Core API', url: 'https://api.ejemplo.com', enabled: true },
  { id: 'demo-auth', name: 'Servicio de identidad', url: 'https://auth.ejemplo.com', enabled: true },
  { id: 'demo-pay', name: 'Pasarela de pagos', url: 'https://payments.ejemplo.com', enabled: false },
];
const dataDirectory = process.env.RAILWAY_VOLUME_MOUNT_PATH || process.env.PULSEWATCH_DATA_DIR || join(process.cwd(), 'data');
const dataFile = join(dataDirectory, 'services.json');
const services = new Map<string, LiveService>();
const listeners = new Set<(service: ReturnType<typeof publicService>) => void>();
let started = false;
let loading: Promise<void> | undefined;

function websocketUrl(raw: string) {
  const url = new URL(raw.startsWith('ws') ? raw : `https://${raw.replace(/^https?:\/\//, '')}`);
  url.protocol = url.protocol === 'https:' || url.protocol === 'wss:' ? 'wss:' : 'ws:';
  url.pathname = `${url.pathname.replace(/\/$/, '')}/status`;
  return url.toString();
}
function publicService({ socket, reconnect, ...service }: LiveService) { return { ...service, websocketUrl: websocketUrl(service.url) }; }
function publish(service: LiveService) { const event = publicService(service); listeners.forEach((listener) => listener(event)); }
function serializable() { return [...services.values()].map(({ socket, reconnect, state, lastSeen, latency, ...service }) => service); }
async function persist() {
  await mkdir(dataDirectory, { recursive: true });
  const temporary = `${dataFile}.tmp`;
  await writeFile(temporary, JSON.stringify({ version: 1, services: serializable() }, null, 2), 'utf8');
  await rename(temporary, dataFile);
}
async function ensureLoaded() {
  if (loading) return loading;
  loading = (async () => {
    let saved: Service[] = initial;
    try {
      const parsed = JSON.parse(await readFile(dataFile, 'utf8')) as { services?: Service[] };
      if (Array.isArray(parsed.services)) saved = parsed.services;
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      await mkdir(dirname(dataFile), { recursive: true });
    }
    saved.forEach((service) => services.set(service.id, { ...service, state: service.enabled ? 'connecting' : 'offline' }));
    if (!services.size) initial.forEach((service) => services.set(service.id, { ...service, state: service.enabled ? 'connecting' : 'offline' }));
    await persist();
  })();
  return loading;
}
function connect(service: LiveService) {
  if (!service.enabled) return;
  service.socket?.terminate(); service.state = 'connecting';
  const began = Date.now();
  try {
    const socket = new WebSocket(websocketUrl(service.url)); service.socket = socket;
    socket.on('open', () => { service.state = 'online'; service.lastSeen = new Date().toISOString(); service.latency = Date.now() - began; publish(service); });
    socket.on('message', () => { service.state = 'online'; service.lastSeen = new Date().toISOString(); publish(service); });
    socket.on('error', () => socket.close());
    socket.on('close', () => { if (service.socket !== socket) return; service.state = 'offline'; publish(service); service.reconnect = setTimeout(() => connect(service), 10_000); });
  } catch { service.state = 'offline'; publish(service); }
}
export async function startMonitor() { await ensureLoaded(); if (started) return; started = true; services.forEach(connect); }
export async function listServices() { await startMonitor(); return [...services.values()].map(publicService); }
export async function getService(id: string) { return (await listServices()).find((service) => service.id === id); }
export async function createService(input: Omit<Service, 'id'>) { await startMonitor(); const service: LiveService = { ...input, id: crypto.randomUUID(), state: input.enabled ? 'connecting' : 'offline' }; services.set(service.id, service); await persist(); publish(service); connect(service); return (await getService(service.id))!; }
export async function updateService(id: string, input: Omit<Service, 'id'>) { await startMonitor(); const service = services.get(id); if (!service) return; service.socket?.terminate(); Object.assign(service, input, { state: input.enabled ? 'connecting' : 'offline' }); await persist(); publish(service); if (input.enabled) connect(service); return getService(id); }
export async function removeService(id: string) { await startMonitor(); const service = services.get(id); if (!service) return false; service.socket?.terminate(); if (service.reconnect) clearTimeout(service.reconnect); services.delete(id); await persist(); publish({ ...service, state: 'offline' }); return true; }
export async function summary() { const all = await listServices(); const monitored = all.filter((service) => service.enabled); const failed = monitored.filter((service) => service.state === 'offline'); return { status: failed.length ? 'degraded' : monitored.length && monitored.every((service) => service.state === 'online') ? 'healthy' : 'pending', checkedAt: new Date().toISOString(), totals: { services: all.length, monitored: monitored.length, online: monitored.filter((service) => service.state === 'online').length, failed: failed.length }, services: all }; }
export function subscribeUpdates(listener: (service: ReturnType<typeof publicService>) => void) { listeners.add(listener); return () => listeners.delete(listener); }
