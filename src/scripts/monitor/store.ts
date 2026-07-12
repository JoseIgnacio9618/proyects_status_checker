import type { MonitoredService } from './types';

function fingerprint(services: MonitoredService[]) {
  return JSON.stringify(services.map(({ id, name, url, enabled, state, lastSeen, latency }) => ({
    id,
    name,
    url,
    enabled,
    state,
    lastSeen,
    latency,
  })));
}

export class ServiceStore {
  #services: MonitoredService[] = [];
  #fingerprint = '';

  get services() {
    return this.#services;
  }

  setServices(services: MonitoredService[]) {
    const nextFingerprint = fingerprint(services);
    if (nextFingerprint === this.#fingerprint) return false;

    this.#services = services;
    this.#fingerprint = nextFingerprint;
    return true;
  }

  upsert(service: MonitoredService) {
    const index = this.#services.findIndex((current) => current.id === service.id);
    const next = [...this.#services];

    if (index === -1) {
      next.unshift(service);
    } else {
      next[index] = service;
    }

    return this.setServices(next);
  }

  remove(id: string) {
    return this.setServices(this.#services.filter((service) => service.id !== id));
  }

  find(id: string) {
    return this.#services.find((service) => service.id === id);
  }
}
