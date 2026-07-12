import type { MonitoredService, ServiceInput } from './types';

type ServiceListResponse = { services: MonitoredService[] };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });

  if (response.ok) {
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }

  const payload = await response.json().catch(() => null) as { error?: string } | null;
  throw new Error(payload?.error ?? `Request failed with status ${response.status}.`);
}

export const monitorApi = {
  listServices: () => request<ServiceListResponse>('/api/services'),
  createService: (input: ServiceInput) => request<MonitoredService>('/api/services', {
    method: 'POST',
    body: JSON.stringify(input),
  }),
  updateService: (id: string, input: ServiceInput) => request<MonitoredService>(`/api/services/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  }),
  deleteService: (id: string) => request<void>(`/api/services/${id}`, { method: 'DELETE' }),
  reconnectService: (id: string) => request<MonitoredService>(`/api/services/${id}/reconnect`, { method: 'POST' }),
  reconnectAll: () => request<ServiceListResponse>('/api/services/reconnect', { method: 'POST' }),
};
