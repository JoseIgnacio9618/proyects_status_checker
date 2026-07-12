import type {
  MonitorState,
  MonitoredService,
  MonitorSummary,
  ServiceInput,
} from '../../lib/monitor-types';

export type { MonitorState, MonitoredService, MonitorSummary, ServiceInput };

export type DisplayState = MonitorState | 'disabled';

export interface ActivityEvent {
  id: string;
  at: Date;
  serviceName: string;
  state: DisplayState;
  message: string;
}

export interface MonitorPreferences {
  reconnectDelay: number;
}

export type MonitorSocketMessage =
  | ({ type: 'snapshot' | 'status'; scope: 'all' } & MonitorSummary & { at?: string })
  | { type: 'snapshot' | 'status'; scope: 'service'; service: MonitoredService; at?: string }
  | { type: 'error'; error: string };
