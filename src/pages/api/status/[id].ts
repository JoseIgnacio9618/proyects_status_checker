import type { APIRoute } from 'astro';
import { json } from '../../../lib/api-response';
import { getService } from '../../../lib/monitor-store';

export const prerender = false;

export const GET = (async ({ params }) => {
  const service = await getService(params.id ?? '');

  return service
    ? json(service)
    : json({ error: 'Service not found.' }, 404);
}) satisfies APIRoute;
