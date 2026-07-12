import type { MonitorSocketMessage } from './types';

type ConnectionState = 'connected' | 'connecting' | 'reconnecting' | 'disconnected';

interface RealtimeCallbacks {
  onConnectionState: (state: ConnectionState) => void;
  onMessage: (message: MonitorSocketMessage) => void;
}

export class RealtimeMonitorClient {
  #callbacks: RealtimeCallbacks;
  #reconnectDelay: number;
  #reconnectTimer?: number;
  #socket?: WebSocket;
  #stopped = true;

  constructor(callbacks: RealtimeCallbacks, reconnectDelay: number) {
    this.#callbacks = callbacks;
    this.#reconnectDelay = reconnectDelay;
  }

  setReconnectDelay(delay: number) {
    this.#reconnectDelay = delay;
  }

  start() {
    if (!this.#stopped) return;
    this.#stopped = false;
    this.#connect('connecting');
  }

  stop() {
    this.#stopped = true;
    window.clearTimeout(this.#reconnectTimer);
    this.#reconnectTimer = undefined;

    const socket = this.#socket;
    this.#socket = undefined;
    socket?.close(1000, 'Panel closed');
    this.#callbacks.onConnectionState('disconnected');
  }

  #connect(state: ConnectionState) {
    if (this.#stopped) return;

    this.#callbacks.onConnectionState(state);
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}/ws`);
    this.#socket = socket;

    socket.addEventListener('open', () => {
      if (this.#socket !== socket) return;
      this.#callbacks.onConnectionState('connected');
    });

    socket.addEventListener('message', (event) => {
      try {
        this.#callbacks.onMessage(JSON.parse(event.data) as MonitorSocketMessage);
      } catch {
        // Ignore malformed messages. The next valid snapshot will restore the UI.
      }
    });

    socket.addEventListener('error', () => socket.close());

    socket.addEventListener('close', () => {
      if (this.#socket !== socket || this.#stopped) return;
      this.#socket = undefined;
      this.#scheduleReconnect();
    });
  }

  #scheduleReconnect() {
    this.#callbacks.onConnectionState('reconnecting');
    window.clearTimeout(this.#reconnectTimer);
    this.#reconnectTimer = window.setTimeout(() => {
      this.#connect('reconnecting');
    }, this.#reconnectDelay);
  }
}
