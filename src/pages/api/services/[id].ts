import type { APIRoute } from 'astro';
import { json, noContent, readServiceInput, requestError } from '../../../lib/api-response';
import { removeService, updateService } from '../../../lib/monitor-store';

export const prerender = false;

export const PUT = (async ({ params, request }) => {
  try {
    const service = await updateService(params.id ?? '', await readServiceInput(request));
    return service ? json(service) : json({ error: 'Service not found.' }, 404);
  } catch (error) {
    return requestError(error);
  }
}) satisfies APIRoute;

export const DELETE = (async ({ params }) => (
  await removeService(params.id ?? '')
    ? noContent()
    : json({ error: 'Service not found.' }, 404)
)) satisfies APIRoute;
