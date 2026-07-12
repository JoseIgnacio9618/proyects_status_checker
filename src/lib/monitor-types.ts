export const monitorStates = ['online', 'offline', 'connecting'] as const;

export type MonitorState = (typeof monitorStates)[number];
export type OverallStatus = 'healthy' | 'degraded' | 'pending';

export interface ServiceConfiguration {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
}

export interface ServiceInput {
  name: string;
  url: string;
  enabled: boolean;
}

export interface MonitoredService extends ServiceConfiguration {
  state: MonitorState;
  lastSeen?: string;
  latency?: number;
  websocketUrl: string;
}

export interface MonitorSummary {
  status: OverallStatus;
  checkedAt: string;
  totals: {
    services: number;
    monitored: number;
    online: number;
    failed: number;
  };
  services: MonitoredService[];
}

export interface ServiceDataFile {
  version: 1;
  services: ServiceConfiguration[];
}
