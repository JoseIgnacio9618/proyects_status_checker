import { EventEmitter } from 'node:events';

const eventBusKey = Symbol.for('pulsewatch.monitor-events');
const changeEvent = 'change';

function getEventBus() {
  const globalScope = globalThis;

  if (!globalScope[eventBusKey]) {
    globalScope[eventBusKey] = new EventEmitter();
  }

  return globalScope[eventBusKey];
}

export function publishMonitorChange(summary) {
  getEventBus().emit(changeEvent, summary);
}

export function subscribeToMonitorChanges(listener) {
  const eventBus = getEventBus();
  eventBus.on(changeEvent, listener);

  return () => eventBus.off(changeEvent, listener);
}
