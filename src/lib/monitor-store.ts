import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import WebSocket from 'ws';
import { publishMonitorChange } from '../../monitor-events.mjs';
import type {
  MonitorState,
  MonitoredService,
  MonitorSummary,
  ServiceConfiguration,
  ServiceDataFile,
  ServiceInput,
} from './monitor-types';
import { toStatusSocketUrl } from './service-url';

type LiveService = ServiceConfiguration & {
  state: MonitorState;
  lastSeen?: string;
  latency?: number;
  socket?: WebSocket;
  reconnectTimer?: ReturnType<typeof setTimeout>;
  handshakeTimer?: ReturnType<typeof setTimeout>;
  heartbeatTimer?: ReturnType<typeof setInterval>;
  isAlive?: boolean;
  reconnectAttempts: number;
};

const reconnectBaseDelay = Number(process.env.PULSEWATCH_RECONNECT_MS) || 10_000;
const maxReconnectDelay = 60_000;
const handshakeTimeout = 15_000;
const heartbeatInterval = 30_000;
const dataDirectory = process.env.RAILWAY_VOLUME_MOUNT_PATH
  || process.env.PULSEWATCH_DATA_DIR
  || join(process.cwd(), 'data');
const dataFile = join(dataDirectory, 'services.json');

const defaultServices: ServiceConfiguration[] = [
  { id: 'demo-core', name: 'Core API', url: 'https://api.ejemplo.com', enabled: true },
  { id: 'demo-auth', name: 'Servicio de identidad', url: 'https://auth.ejemplo.com', enabled: true },
  { id: 'demo-pay', name: 'Pasarela de pagos', url: 'https://payments.ejemplo.com', enabled: false },
];

const registry = new Map<string, LiveService>();
let startup: Promise<void> | undefined;
let monitorStarted = false;
let writeQueue = Promise.resolve();

function toPublicService(service: LiveService): MonitoredService {
  const {
    socket: _socket,
    reconnectTimer: _timer,
    handshakeTimer: _handshakeTimer,
    heartbeatTimer: _heartbeatTimer,
    isAlive: _isAlive,
    reconnectAttempts: _reconnectAttempts,
    ...publicService
  } = service;

  return {
    ...publicService,
    websocketUrl: toStatusSocketUrl(service.url),
  };
}

function buildSummary(): MonitorSummary {
  const services = [...registry.values()].map(toPublicService);
  const monitored = services.filter((service) => service.enabled);
  const online = monitored.filter((service) => service.state === 'online');
  const failed = monitored.filter((service) => service.state === 'offline');

  return {
    status: failed.length > 0 ? 'degraded' : online.length === monitored.length && monitored.length > 0 ? 'healthy' : 'pending',
    checkedAt: new Date().toISOString(),
    totals: {
      services: services.length,
      monitored: monitored.length,
      online: online.length,
      failed: failed.length,
    },
    services,
  };
}

function emitChange() {
  publishMonitorChange(buildSummary());
}

function serializableServices() {
  return [...registry.values()].map(({
    socket: _socket,
    reconnectTimer: _timer,
    handshakeTimer: _handshakeTimer,
    heartbeatTimer: _heartbeatTimer,
    isAlive: _isAlive,
    reconnectAttempts: _reconnectAttempts,
    state: _state,
    lastSeen: _lastSeen,
    latency: _latency,
    ...service
  }) => service);
}

function clearReconnectTimer(service: LiveService) {
  if (service.reconnectTimer) {
    clearTimeout(service.reconnectTimer);
    service.reconnectTimer = undefined;
  }
}

function clearConnectionTimers(service: LiveService) {
  if (service.handshakeTimer) {
    clearTimeout(service.handshakeTimer);
    service.handshakeTimer = undefined;
  }

  if (service.heartbeatTimer) {
    clearInterval(service.heartbeatTimer);
    service.heartbeatTimer = undefined;
  }
}

function stopConnection(service: LiveService) {
  clearReconnectTimer(service);
  clearConnectionTimers(service);
  const socket = service.socket;
  service.socket = undefined;
  socket?.terminate();
}

function scheduleReconnect(service: LiveService) {
  clearReconnectTimer(service);
  const exponent = Math.min(service.reconnectAttempts, 4);
  const backoff = Math.min(reconnectBaseDelay * (2 ** exponent), maxReconnectDelay);
  const jitter = Math.round(backoff * (0.8 + Math.random() * 0.4));
  service.reconnectAttempts += 1;
  service.reconnectTimer = setTimeout(() => openConnection(service), jitter);
}

function openConnection(service: LiveService) {
  if (!service.enabled) {
    service.state = 'offline';
    emitChange();
    return;
  }

  stopConnection(service);
  service.state = 'connecting';
  service.latency = undefined;
  emitChange();
  const startedAt = Date.now();

  try {
    const socket = new WebSocket(toStatusSocketUrl(service.url));
    service.socket = socket;
    service.isAlive = true;
    service.handshakeTimer = setTimeout(() => socket.terminate(), handshakeTimeout);

    socket.on('open', () => {
      if (service.socket !== socket) return;
      clearConnectionTimers(service);
      service.state = 'online';
      service.lastSeen = new Date().toISOString();
      service.latency = Date.now() - startedAt;
      service.reconnectAttempts = 0;
      service.isAlive = true;
      service.heartbeatTimer = setInterval(() => {
        if (service.socket !== socket) return;
        if (service.isAlive === false) {
          socket.terminate();
          return;
        }

        service.isAlive = false;
        socket.ping();
      }, heartbeatInterval);
      emitChange();
    });

    socket.on('message', () => {
      if (service.socket !== socket) return;
      service.state = 'online';
      service.lastSeen = new Date().toISOString();
      service.isAlive = true;
      emitChange();
    });

    socket.on('pong', () => {
      if (service.socket === socket) service.isAlive = true;
    });

    socket.on('error', () => socket.close());

    socket.on('close', () => {
      if (service.socket !== socket) return;
      service.socket = undefined;
      clearConnectionTimers(service);
      service.state = 'offline';
      service.latency = undefined;
      scheduleReconnect(service);
      emitChange();
    });
  } catch {
    service.state = 'offline';
    scheduleReconnect(service);
  }
}

async function persistConfiguration() {
  const payload: ServiceDataFile = {
    version: 1,
    services: serializableServices(),
  };

  writeQueue = writeQueue.catch(() => undefined).then(async () => {
    await mkdir(dataDirectory, { recursive: true });
    const temporaryFile = `${dataFile}.tmp`;
    await writeFile(temporaryFile, JSON.stringify(payload, null, 2), 'utf8');
    await rename(temporaryFile, dataFile);
  });

  return writeQueue;
}

function hydrate(services: ServiceConfiguration[]) {
  registry.clear();

  services.forEach((service) => {
    registry.set(service.id, {
      ...service,
      state: service.enabled ? 'connecting' : 'offline',
      reconnectAttempts: 0,
    });
  });
}

function isServiceConfiguration(value: unknown): value is ServiceConfiguration {
  if (!value || typeof value !== 'object') return false;

  const service = value as Partial<ServiceConfiguration>;
  if (
    typeof service.id !== 'string'
    || !service.id
    || typeof service.name !== 'string'
    || !service.name
    || typeof service.url !== 'string'
    || typeof service.enabled !== 'boolean'
  ) {
    return false;
  }

  try {
    toStatusSocketUrl(service.url);
    return true;
  } catch {
    return false;
  }
}

async function loadConfiguration() {
  let services = defaultServices;

  try {
    const file = JSON.parse(await readFile(dataFile, 'utf8')) as Partial<ServiceDataFile>;
    if (file.version !== 1 || !Array.isArray(file.services) || !file.services.every(isServiceConfiguration)) {
      throw new Error('The persisted services.json file has an unsupported or invalid structure.');
    }
    services = file.services;
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }

  hydrate(services);
  await persistConfiguration();
}

async function ensureStarted() {
  if (!startup) {
    startup = loadConfiguration();
  }

  await startup;

  if (monitorStarted) return;
  monitorStarted = true;
  registry.forEach(openConnection);
}

export async function listServices() {
  await ensureStarted();
  return [...registry.values()].map(toPublicService);
}

export async function getService(id: string) {
  await ensureStarted();
  const service = registry.get(id);

  return service ? toPublicService(service) : undefined;
}

export async function createService(input: ServiceInput) {
  await ensureStarted();

  const service: LiveService = {
    ...input,
    id: crypto.randomUUID(),
    state: input.enabled ? 'connecting' : 'offline',
    reconnectAttempts: 0,
  };

  registry.set(service.id, service);
  await persistConfiguration();
  openConnection(service);

  return toPublicService(service);
}

export async function updateService(id: string, input: ServiceInput) {
  await ensureStarted();
  const service = registry.get(id);

  if (!service) return undefined;

  stopConnection(service);
  Object.assign(service, input, { state: input.enabled ? 'connecting' : 'offline' });
  await persistConfiguration();

  if (service.enabled) {
    openConnection(service);
  } else {
    emitChange();
  }

  return toPublicService(service);
}

export async function removeService(id: string) {
  await ensureStarted();
  const service = registry.get(id);

  if (!service) return false;

  stopConnection(service);
  registry.delete(id);
  await persistConfiguration();
  emitChange();

  return true;
}

export async function reconnectService(id: string) {
  await ensureStarted();
  const service = registry.get(id);

  if (!service || !service.enabled) return undefined;

  openConnection(service);
  return toPublicService(service);
}

export async function reconnectAllServices() {
  await ensureStarted();
  const services = [...registry.values()].filter((service) => service.enabled);
  services.forEach(openConnection);

  return services.map(toPublicService);
}

export async function summary(): Promise<MonitorSummary> {
  await ensureStarted();
  return buildSummary();
}
