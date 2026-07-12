import { monitorApi } from './monitor/api-client';
import { elements } from './monitor/dom';
import { RealtimeMonitorClient } from './monitor/realtime-client';
import {
  renderActivity,
  renderClock,
  renderDashboard,
  renderServices,
  setConnectionState,
  showToast,
} from './monitor/renderer';
import { ServiceStore } from './monitor/store';
import type {
  ActivityEvent,
  DisplayState,
  MonitorPreferences,
  MonitorSocketMessage,
  MonitoredService,
  ServiceInput,
} from './monitor/types';

const preferencesKey = 'pulsewatch.preferences.v1';
const defaultPreferences: MonitorPreferences = { reconnectDelay: 3_000 };

const viewMetadata = {
  dashboard: ['Vista general', 'MONITORIZACIÓN EN DIRECTO'],
  services: ['Servicios', 'GESTIÓN DE ENDPOINTS'],
  activity: ['Actividad', 'EVENTOS DE ESTA SESIÓN'],
} as const;

const store = new ServiceStore();
let activity: ActivityEvent[] = [];
let currentPage = 1;
let currentFilter = 'all';
let currentQuery = '';
let activeView: keyof typeof viewMetadata = 'dashboard';
let preferences = loadPreferences();
let toastTimer: number | undefined;

function loadPreferences(): MonitorPreferences {
  try {
    const saved = JSON.parse(localStorage.getItem(preferencesKey) ?? '{}') as Partial<MonitorPreferences>;
    const reconnectDelay = Number(saved.reconnectDelay);

    return Number.isFinite(reconnectDelay) && reconnectDelay >= 1_000
      ? { reconnectDelay }
      : defaultPreferences;
  } catch {
    return defaultPreferences;
  }
}

function savePreferences() {
  localStorage.setItem(preferencesKey, JSON.stringify(preferences));
}

function serviceDisplayState(service: MonitoredService): DisplayState {
  return service.enabled ? service.state : 'disabled';
}

function stateMessage(state: DisplayState) {
  return {
    online: 'El servicio está operativo.',
    offline: 'El servicio no responde.',
    connecting: 'El monitor está intentando conectar.',
    disabled: 'La monitorización está pausada.',
  }[state];
}

function render() {
  renderDashboard(store.services);
  currentPage = renderServices(store.services, currentFilter, currentQuery, currentPage);
}

function renderAndTrack(nextServices: MonitoredService[]) {
  const previous = new Map(store.services.map((service) => [service.id, service]));
  const changed = store.setServices(nextServices);

  if (!changed) return;

  nextServices.forEach((service) => {
    const previousService = previous.get(service.id);
    const nextState = serviceDisplayState(service);

    if (previousService && serviceDisplayState(previousService) !== nextState) {
      addActivity({
        serviceName: service.name,
        state: nextState,
        message: stateMessage(nextState),
      });
    }
  });

  render();
}

function addActivity(event: Omit<ActivityEvent, 'id' | 'at'>) {
  activity = [{ id: crypto.randomUUID(), at: new Date(), ...event }, ...activity].slice(0, 100);
  renderActivity(activity);
}

function notify(message: string) {
  window.clearTimeout(toastTimer);
  showToast(message);
  toastTimer = window.setTimeout(() => {
    elements.toast.hidden = true;
  }, 4_000);
}

function showView(view: keyof typeof viewMetadata) {
  activeView = view;

  (Object.keys(viewMetadata) as Array<keyof typeof viewMetadata>).forEach((name) => {
    const section = document.querySelector<HTMLElement>(`#${name}View`)!;
    const navigation = document.querySelector<HTMLElement>(`.nav-link[data-view="${name}"]`)!;
    const isActive = name === view;

    section.hidden = !isActive;
    section.classList.toggle('is-active', isActive);
    navigation.classList.toggle('is-active', isActive);
  });

  const [title, kicker] = viewMetadata[view];
  elements.viewTitle.textContent = title;
  elements.viewKicker.textContent = kicker;
}

function openServiceDialog(service?: MonitoredService) {
  elements.serviceForm.reset();
  elements.serviceFormMessage.textContent = '';
  elements.serviceId.value = service?.id ?? '';
  elements.serviceName.value = service?.name ?? '';
  elements.serviceUrl.value = service?.url ?? '';
  elements.serviceEnabled.checked = service?.enabled ?? true;
  elements.formTitle.textContent = service ? 'Editar servicio' : 'Añadir servicio';
  elements.formKicker.textContent = service ? 'CONFIGURACIÓN' : 'NUEVO ENDPOINT';
  elements.serviceDialog.showModal();
  elements.serviceName.focus();
}

function closeDialog(button: HTMLElement) {
  button.closest('dialog')?.close();
}

function toServiceInput(): ServiceInput {
  return {
    name: elements.serviceName.value.trim(),
    url: elements.serviceUrl.value.trim(),
    enabled: elements.serviceEnabled.checked,
  };
}

async function loadServices() {
  try {
    const { services } = await monitorApi.listServices();
    renderAndTrack(services);
  } catch (error) {
    setConnectionState('disconnected');
    notify(error instanceof Error ? error.message : 'No se pudo cargar el monitor.');
  }
}

function applyRealtimeMessage(message: MonitorSocketMessage) {
  if (message.type === 'error') {
    notify(message.error);
    return;
  }

  if (message.scope === 'all') {
    renderAndTrack(message.services);
    return;
  }

  const next = store.services.map((service) => (
    service.id === message.service.id ? message.service : service
  ));

  if (!store.find(message.service.id)) {
    next.unshift(message.service);
  }

  renderAndTrack(next);
}

const realtime = new RealtimeMonitorClient({
  onConnectionState: setConnectionState,
  onMessage: applyRealtimeMessage,
}, preferences.reconnectDelay);

async function handleServiceSubmit(event: SubmitEvent) {
  event.preventDefault();
  elements.serviceFormMessage.textContent = '';

  if (!elements.serviceForm.reportValidity()) return;

  const id = elements.serviceId.value;
  const input = toServiceInput();

  try {
    const service = id
      ? await monitorApi.updateService(id, input)
      : await monitorApi.createService(input);

    store.upsert(service);
    render();
    elements.serviceDialog.close();
    addActivity({
      serviceName: service.name,
      state: serviceDisplayState(service),
      message: id ? 'Configuración actualizada.' : 'Servicio añadido al monitor.',
    });
  } catch (error) {
    elements.serviceFormMessage.textContent = error instanceof Error
      ? error.message
      : 'No se ha podido guardar el servicio.';
  }
}

async function handleServiceAction(target: HTMLElement) {
  const button = target.closest<HTMLButtonElement>('[data-action]');
  if (!button) return;

  const service = store.find(button.dataset.serviceId ?? '');
  if (!service) return;

  switch (button.dataset.action) {
    case 'edit':
      openServiceDialog(service);
      break;
    case 'reconnect':
      try {
        const updated = await monitorApi.reconnectService(service.id);
        store.upsert(updated);
        render();
        addActivity({ serviceName: updated.name, state: 'connecting', message: 'Reconexión solicitada.' });
      } catch (error) {
        notify(error instanceof Error ? error.message : 'No se pudo reconectar el servicio.');
      }
      break;
    case 'delete':
      if (!window.confirm(`¿Eliminar “${service.name}” del monitor?`)) return;

      try {
        await monitorApi.deleteService(service.id);
        store.remove(service.id);
        render();
        addActivity({ serviceName: service.name, state: 'disabled', message: 'Servicio eliminado.' });
      } catch (error) {
        notify(error instanceof Error ? error.message : 'No se pudo eliminar el servicio.');
      }
      break;
  }
}

function bindEvents() {
  elements.addService.addEventListener('click', () => openServiceDialog());
  elements.openSettings.addEventListener('click', () => {
    elements.reconnectInterval.value = String(preferences.reconnectDelay);
    elements.settingsDialog.showModal();
  });

  document.querySelectorAll<HTMLElement>('[data-view]').forEach((button) => {
    button.addEventListener('click', () => showView(button.dataset.view as keyof typeof viewMetadata));
  });

  document.querySelectorAll<HTMLElement>('[data-go]').forEach((button) => {
    button.addEventListener('click', () => showView(button.dataset.go as keyof typeof viewMetadata));
  });

  document.querySelectorAll<HTMLElement>('[data-close-dialog]').forEach((button) => {
    button.addEventListener('click', () => closeDialog(button));
  });

  elements.serviceForm.addEventListener('submit', handleServiceSubmit);
  elements.settingsForm.addEventListener('submit', (event) => {
    event.preventDefault();
    preferences = { reconnectDelay: Number(elements.reconnectInterval.value) };
    savePreferences();
    realtime.setReconnectDelay(preferences.reconnectDelay);
    elements.settingsDialog.close();
    notify('Ajustes del panel guardados.');
  });

  elements.searchInput.addEventListener('input', () => {
    currentQuery = elements.searchInput.value;
    currentPage = 1;
    render();
  });

  elements.statusFilter.addEventListener('change', () => {
    currentFilter = elements.statusFilter.value;
    currentPage = 1;
    render();
  });

  elements.prevPage.addEventListener('click', () => {
    currentPage -= 1;
    render();
  });

  elements.nextPage.addEventListener('click', () => {
    currentPage += 1;
    render();
  });

  elements.refreshAll.addEventListener('click', async () => {
    try {
      const { services } = await monitorApi.reconnectAll();
      renderAndTrack(services);
      notify('Reconexión solicitada para los servicios activos.');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'No se pudo iniciar la reconexión.');
    }
  });

  elements.clearActivity.addEventListener('click', () => {
    activity = [];
    renderActivity(activity);
  });

  elements.statusList.addEventListener('click', (event) => void handleServiceAction(event.target as HTMLElement));
  elements.servicesTable.addEventListener('click', (event) => void handleServiceAction(event.target as HTMLElement));
  window.addEventListener('pagehide', () => realtime.stop(), { once: true });
}

async function bootstrap() {
  bindEvents();
  renderClock();
  window.setInterval(renderClock, 30_000);
  renderActivity(activity);
  await loadServices();
  realtime.start();
}

void bootstrap();
