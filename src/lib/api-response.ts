import type { ServiceInput } from './monitor-types';
import { normalizeServiceUrl } from './service-url';

const jsonHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

export class ValidationError extends Error {}

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: jsonHeaders });
}

export function noContent() {
  return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
}

export function requestError(error: unknown) {
  if (error instanceof ValidationError) {
    return json({ error: error.message }, 400);
  }

  console.error('Pulsewatch API request failed.', error);
  return json({ error: 'The server could not complete this request.' }, 500);
}

export async function readServiceInput(request: Request): Promise<ServiceInput> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    throw new ValidationError('The request body must contain valid JSON.');
  }

  if (!body || typeof body !== 'object') {
    throw new ValidationError('The request body must be a JSON object.');
  }

  const { name, url, enabled = true } = body as Record<string, unknown>;

  if (typeof name !== 'string' || !name.trim() || name.trim().length > 48) {
    throw new ValidationError('A service name between 1 and 48 characters is required.');
  }

  if (typeof url !== 'string' || !url.trim() || url.trim().length > 2_048) {
    throw new ValidationError('A valid service URL is required.');
  }

  if (typeof enabled !== 'boolean') {
    throw new ValidationError('Enabled must be a boolean value.');
  }

  try {
    return {
      name: name.trim(),
      url: normalizeServiceUrl(url),
      enabled,
    };
  } catch (error) {
    throw new ValidationError(error instanceof Error ? error.message : 'A valid service URL is required.');
  }
}
