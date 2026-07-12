const supportedProtocols = new Set(['http:', 'https:', 'ws:', 'wss:']);

function parseServiceUrl(value: string) {
  const candidate = value.trim();
  const url = new URL(candidate.includes('://') ? candidate : `https://${candidate}`);

  if (!supportedProtocols.has(url.protocol)) {
    throw new TypeError('The service URL must use HTTP(S) or WS(S).');
  }

  if (url.username || url.password) {
    throw new TypeError('The service URL must not include credentials.');
  }

  if (url.hash) {
    throw new TypeError('The service URL must not include a fragment.');
  }

  return url;
}

export function normalizeServiceUrl(value: string) {
  return parseServiceUrl(value).toString();
}

export function toStatusSocketUrl(value: string) {
  const url = parseServiceUrl(value);
  url.protocol = url.protocol === 'https:' || url.protocol === 'wss:' ? 'wss:' : 'ws:';
  url.pathname = `${url.pathname.replace(/\/$/, '')}/status`;

  return url.toString();
}
