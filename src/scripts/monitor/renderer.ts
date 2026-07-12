import { elements } from './dom';
import type { ActivityEvent, DisplayState, MonitoredService } from './types';

const stateLabels: Record<DisplayState, string> = {
  online: 'OPERATIVO',
  offline: 'SIN CONEXIÓN',
  connecting: 'CONECTANDO',
  disabled: 'PAUSADO',
};

function displayState(service: MonitoredService): DisplayState {
  return service.enabled ? service.state : 'disabled';
}

function createElement<K extends keyof HTMLElementTagNameMap>(tagName: K, className?: string) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  return element;
}

function createEmptyState(message: string) {
  const item = createElement('li', 'empty-state');
  item.textContent = message;
  return item;
}

function createStatusRow(service: MonitoredService) {
  const row = createElement('li', 'status-row');
  row.dataset.serviceId = service.id;

  const dot = createElement('span', 'status-dot');
  dot.dataset.role = 'dot';

  const name = createElement('span', 'service-name');
  name.dataset.role = 'name';

  const endpoint = createElement('code', 'service-url');
  endpoint.dataset.role = 'endpoint';

  const latency = createElement('span', 'service-latency');
  latency.dataset.role = 'latency';

  const state = createElement('span', 'state-label');
  state.dataset.role = 'state';

  const actions = createElement('div', 'status-actions');
  const edit = createActionButton('edit', 'Editar servicio', '•••');
  actions.append(edit);

  row.append(dot, name, endpoint, latency, state, actions);
  updateStatusRow(row, service);

  return row;
}

function updateStatusRow(row: HTMLLIElement, service: MonitoredService) {
  const state = displayState(service);
  const dot = row.querySelector<HTMLElement>('[data-role="dot"]')!;
  const name = row.querySelector<HTMLElement>('[data-role="name"]')!;
  const endpoint = row.querySelector<HTMLElement>('[data-role="endpoint"]')!;
  const latency = row.querySelector<HTMLElement>('[data-role="latency"]')!;
  const label = row.querySelector<HTMLElement>('[data-role="state"]')!;
  const edit = row.querySelector<HTMLButtonElement>('[data-action="edit"]')!;

  dot.dataset.state = state;
  name.textContent = service.name;
  endpoint.textContent = service.websocketUrl;
  latency.textContent = service.latency ? `${service.latency} ms` : '—';
  label.dataset.state = state;
  label.textContent = stateLabels[state];
  edit.dataset.serviceId = service.id;
}

function createActionButton(action: string, label: string, icon: string) {
  const button = createElement('button', 'icon-button');
  button.type = 'button';
  button.dataset.action = action;
  button.setAttribute('aria-label', label);
  button.textContent = icon;
  return button;
}

function createServiceRow(service: MonitoredService) {
  const row = document.createElement('tr');
  row.dataset.serviceId = service.id;

  const serviceCell = document.createElement('td');
  const name = createElement('span', 'table-service-name');
  name.dataset.role = 'name';
  const url = createElement('code', 'service-url');
  url.dataset.role = 'url';
  serviceCell.append(name, url);

  const endpointCell = document.createElement('td');
  const endpoint = createElement('code', 'service-url');
  endpoint.dataset.role = 'endpoint';
  endpointCell.append(endpoint);

  const stateCell = document.createElement('td');
  const state = createElement('span', 'state-label');
  state.dataset.role = 'state';
  stateCell.append(state);

  const seenCell = document.createElement('td');
  const seen = createElement('span', 'service-last-seen');
  seen.dataset.role = 'seen';
  seenCell.append(seen);

  const actionsCell = document.createElement('td');
  const actions = createElement('div', 'table-actions');
  actions.append(
    createActionButton('reconnect', 'Reconectar servicio', '↻'),
    createActionButton('edit', 'Editar servicio', '✎'),
    createActionButton('delete', 'Eliminar servicio', '×'),
  );
  actionsCell.append(actions);

  row.append(serviceCell, endpointCell, stateCell, seenCell, actionsCell);
  updateServiceRow(row, service);

  return row;
}

function updateServiceRow(row: HTMLTableRowElement, service: MonitoredService) {
  const state = displayState(service);
  row.querySelector<HTMLElement>('[data-role="name"]')!.textContent = service.name;
  row.querySelector<HTMLElement>('[data-role="url"]')!.textContent = service.url;
  row.querySelector<HTMLElement>('[data-role="endpoint"]')!.textContent = service.websocketUrl;

  const stateElement = row.querySelector<HTMLElement>('[data-role="state"]')!;
  stateElement.dataset.state = state;
  stateElement.textContent = stateLabels[state];

  row.querySelector<HTMLElement>('[data-role="seen"]')!.textContent = service.lastSeen
    ? new Date(service.lastSeen).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    : 'Sin señal';

  row.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((button) => {
    button.dataset.serviceId = service.id;
  });

  const reconnect = row.querySelector<HTMLButtonElement>('[data-action="reconnect"]')!;
  reconnect.disabled = !service.enabled;
  reconnect.title = service.enabled ? 'Reconectar servicio' : 'Activa el servicio para reconectarlo';
}

function reconcileRows<T extends HTMLElement>(
  container: HTMLElement,
  items: MonitoredService[],
  create: (service: MonitoredService) => T,
  update: (row: T, service: MonitoredService) => void,
) {
  const existing = new Map(
    [...container.children].map((child) => [child.getAttribute('data-service-id'), child as T]),
  );

  items.forEach((service) => {
    const row = existing.get(service.id) ?? create(service);
    update(row, service);
    container.append(row);
    existing.delete(service.id);
  });

  existing.forEach((row) => row.remove());
}

export function renderDashboard(services: MonitoredService[]) {
  const monitored = services.filter((service) => service.enabled);
  const online = monitored.filter((service) => service.state === 'online');
  const failed = monitored.filter((service) => service.state === 'offline');
  const availability = monitored.length ? Math.round((online.length / monitored.length) * 100) : 0;

  elements.serviceCount.textContent = String(services.length);
  elements.activeTotal.textContent = `${online.length}/${monitored.length}`;
  elements.activeDetail.textContent = monitored.length ? `${online.length} operativos ahora` : 'No hay servicios activos';
  elements.uptimeTotal.textContent = monitored.length ? `${availability}%` : '—';
  elements.incidentTotal.textContent = String(failed.length);
  elements.lastUpdate.textContent = `Actualizado ${new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;

  const featured = services.slice(0, 5);
  if (featured.length === 0) {
    elements.statusList.replaceChildren(createEmptyState('Aún no has añadido servicios.'));
  } else {
    reconcileRows(elements.statusList, featured, createStatusRow, updateStatusRow);
  }

  elements.dashboardPagination.textContent = services.length > 5
    ? `Mostrando 5 de ${services.length} servicios`
    : `${services.length} servicios`;
}

export function renderServices(
  services: MonitoredService[],
  filter: string,
  query: string,
  requestedPage: number,
) {
  const normalizedQuery = query.trim().toLocaleLowerCase('es');
  const matching = services.filter((service) => {
    const state = displayState(service);
    const matchesState = filter === 'all' || state === filter;
    const matchesQuery = `${service.name} ${service.url}`.toLocaleLowerCase('es').includes(normalizedQuery);
    return matchesState && matchesQuery;
  });
  const totalPages = Math.max(1, Math.ceil(matching.length / 8));
  const page = Math.min(Math.max(requestedPage, 1), totalPages);
  const current = matching.slice((page - 1) * 8, page * 8);

  if (current.length === 0) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 5;
    cell.className = 'empty-state';
    cell.textContent = 'No hay servicios que coincidan con el filtro.';
    row.append(cell);
    elements.servicesTable.replaceChildren(row);
  } else {
    reconcileRows(elements.servicesTable, current, createServiceRow, updateServiceRow);
  }

  elements.pageInfo.textContent = `Página ${page} de ${totalPages}`;
  elements.prevPage.disabled = page === 1;
  elements.nextPage.disabled = page === totalPages;

  return page;
}

export function renderActivity(events: ActivityEvent[]) {
  if (events.length === 0) {
    elements.activityList.replaceChildren(createEmptyState('Todavía no hay eventos en esta sesión.'));
    return;
  }

  const fragment = document.createDocumentFragment();
  events.forEach((event) => {
    const row = createElement('li', 'activity-row');
    const time = document.createElement('time');
    time.dateTime = event.at.toISOString();
    time.textContent = event.at.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const dot = createElement('span', 'status-dot');
    dot.dataset.state = event.state;

    const message = document.createElement('span');
    const service = document.createElement('strong');
    service.textContent = event.serviceName;
    message.append(service, ` · ${event.message}`);

    const state = createElement('span', 'state-label');
    state.dataset.state = event.state;
    state.textContent = stateLabels[event.state];

    row.append(time, dot, message, state);
    fragment.append(row);
  });

  elements.activityList.replaceChildren(fragment);
}

export function renderClock() {
  elements.clock.textContent = new Date().toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function setConnectionState(state: 'connected' | 'connecting' | 'reconnecting' | 'disconnected') {
  const labels = {
    connected: 'Monitor activo',
    connecting: 'Conectando al monitor…',
    reconnecting: 'Reconectando panel…',
    disconnected: 'Monitor desconectado',
  };

  elements.monitorState.textContent = labels[state];
}

export function showToast(message: string) {
  elements.toast.textContent = message;
  elements.toast.hidden = false;
}
