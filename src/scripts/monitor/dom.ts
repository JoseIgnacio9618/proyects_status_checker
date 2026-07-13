export function requiredElement<T extends HTMLElement>(selector: string) {
  const element = document.querySelector<T>(selector);

  if (!element) {
    throw new Error(`Pulsewatch could not find the required element: ${selector}`);
  }

  return element;
}

export const elements = {
  activeDetail: requiredElement<HTMLElement>('#activeDetail'),
  activeTotal: requiredElement<HTMLElement>('#activeTotal'),
  activityList: requiredElement<HTMLOListElement>('#activityList'),
  addService: requiredElement<HTMLButtonElement>('#addService'),
  clearActivity: requiredElement<HTMLButtonElement>('#clearActivity'),
  clock: requiredElement<HTMLElement>('#clock'),
  dashboardPagination: requiredElement<HTMLElement>('#dashboardPagination'),
  formKicker: requiredElement<HTMLElement>('#formKicker'),
  formTitle: requiredElement<HTMLElement>('#formTitle'),
  incidentTotal: requiredElement<HTMLElement>('#incidentTotal'),
  lastUpdate: requiredElement<HTMLElement>('#lastUpdate'),
  monitorState: requiredElement<HTMLElement>('#monitorState'),
  nextPage: requiredElement<HTMLButtonElement>('#nextPage'),
  openSettings: requiredElement<HTMLButtonElement>('#openSettings'),
  pageInfo: requiredElement<HTMLElement>('#pageInfo'),
  prevPage: requiredElement<HTMLButtonElement>('#prevPage'),
  reconnectInterval: requiredElement<HTMLSelectElement>('#reconnectInterval'),
  refreshAll: requiredElement<HTMLButtonElement>('#refreshAll'),
  reconnectAllServices: requiredElement<HTMLButtonElement>('#reconnectAllServices'),
  searchInput: requiredElement<HTMLInputElement>('#searchInput'),
  serviceDialog: requiredElement<HTMLDialogElement>('#serviceDialog'),
  serviceEnabled: requiredElement<HTMLInputElement>('#serviceEnabled'),
  serviceForm: requiredElement<HTMLFormElement>('#serviceForm'),
  serviceFormMessage: requiredElement<HTMLElement>('#serviceFormMessage'),
  serviceId: requiredElement<HTMLInputElement>('#serviceId'),
  serviceName: requiredElement<HTMLInputElement>('#serviceName'),
  serviceUrl: requiredElement<HTMLInputElement>('#serviceUrl'),
  serviceCount: requiredElement<HTMLElement>('#serviceCount'),
  servicesTable: requiredElement<HTMLTableSectionElement>('#servicesTable'),
  settingsDialog: requiredElement<HTMLDialogElement>('#settingsDialog'),
  settingsForm: requiredElement<HTMLFormElement>('#settingsForm'),
  statusFilter: requiredElement<HTMLSelectElement>('#statusFilter'),
  statusList: requiredElement<HTMLUListElement>('#statusList'),
  toast: requiredElement<HTMLElement>('#toast'),
  uptimeTotal: requiredElement<HTMLElement>('#uptimeTotal'),
  viewKicker: requiredElement<HTMLElement>('#viewKicker'),
  viewTitle: requiredElement<HTMLElement>('#viewTitle'),
};
