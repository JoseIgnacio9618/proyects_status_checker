import { WebSocket, WebSocketServer } from 'ws';
import { subscribeToMonitorChanges } from './monitor-events.mjs';

const heartbeatInterval = 30_000;

function buildSnapshot(summary, serviceId, type = 'snapshot') {
  if (!serviceId) {
    return { type, scope: 'all', ...summary };
  }

  const service = summary.services.find((item) => item.id === serviceId);
  return service
    ? { type, scope: 'service', service }
    : { type: 'error', error: 'Service not found.' };
}

function snapshotSignature(message) {
  const { at: _at, checkedAt: _checkedAt, type: _type, ...stableMessage } = message;
  return JSON.stringify(stableMessage);
}

function send(client, message) {
  if (client.readyState === WebSocket.OPEN) {
    client.send(JSON.stringify(message));
  }
}

/**
 * Attaches the Pulsewatch outbound WebSocket endpoint to an existing HTTP server.
 * `getSummary` is deliberately injected so the same hub works in production and Vite dev.
 */
export function attachRealtimeHub(httpServer, getSummary, { allowOtherUpgrades = false } = {}) {
  const socketServer = new WebSocketServer({ noServer: true, maxPayload: 8 * 1024 });
  const subscriptions = new Map();

  function publishSnapshot(client, subscription, summary, type = 'snapshot') {
    const message = buildSnapshot(summary, subscription.serviceId, type);
    const signature = snapshotSignature(message);

    if (signature === subscription.lastSignature) return;

    subscription.lastSignature = signature;
    send(client, type === 'status' ? { ...message, at: new Date().toISOString() } : message);
  }

  function publishError(client, subscription, error) {
    const message = { type: 'error', error };
    const signature = JSON.stringify(message);

    if (signature === subscription.lastSignature) return;

    subscription.lastSignature = signature;
    send(client, message);
  }

  socketServer.on('connection', async (client) => {
    const subscription = { serviceId: null, lastSignature: '' };
    client.isAlive = true;
    subscriptions.set(client, subscription);

    try {
      publishSnapshot(client, subscription, await getSummary());
    } catch {
      publishError(client, subscription, 'Monitor status is temporarily unavailable.');
    }

    client.on('message', async (rawMessage) => {
      try {
        const message = JSON.parse(rawMessage.toString());

        if (message.action !== 'subscribe') {
          publishError(client, subscription, 'Unsupported action.');
          return;
        }

        subscription.serviceId = typeof message.serviceId === 'string' ? message.serviceId : null;
        subscription.lastSignature = '';
        publishSnapshot(client, subscription, await getSummary());
      } catch {
        publishError(client, subscription, 'Invalid JSON message.');
      }
    });

    client.on('close', () => subscriptions.delete(client));
    client.on('error', () => subscriptions.delete(client));
    client.on('pong', () => {
      client.isAlive = true;
    });
  });

  const unsubscribeFromMonitor = subscribeToMonitorChanges((summary) => {
    subscriptions.forEach((subscription, client) => {
      publishSnapshot(client, subscription, summary, 'status');
    });
  });

  const heartbeatTimer = setInterval(() => {
    socketServer.clients.forEach((client) => {
      if (client.isAlive === false) {
        subscriptions.delete(client);
        client.terminate();
        return;
      }

      client.isAlive = false;
      client.ping();
    });
  }, heartbeatInterval);

  function handleUpgrade(request, socket, head) {
    try {
      const requestUrl = new URL(request.url ?? '/', 'http://localhost');
      if (requestUrl.pathname !== '/ws') return;

      socketServer.handleUpgrade(request, socket, head, (client) => {
        socketServer.emit('connection', client, request);
      });
      return true;
    } catch {
      socket.destroy();
      return true;
    }
  }

  function upgradeListener(request, socket, head) {
    if (handleUpgrade(request, socket, head)) return;
    if (!allowOtherUpgrades) socket.destroy();
  }

  httpServer.on('upgrade', upgradeListener);

  return {
    close() {
      clearInterval(heartbeatTimer);
      unsubscribeFromMonitor();
      httpServer.off('upgrade', upgradeListener);
      socketServer.clients.forEach((client) => client.close(1001, 'Server shutting down'));
      socketServer.close();
      subscriptions.clear();
    },
  };
}
