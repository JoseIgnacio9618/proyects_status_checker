import type { APIRoute } from 'astro';
import { json } from '../../../../lib/api-response';
import { reconnectService } from '../../../../lib/monitor-store';

export const prerender = false;

export const POST = (async ({ params }) => {
  const service = await reconnectService(params.id ?? '');
  return service ? json(service) : json({ error: 'Enabled service not found.' }, 404);
}) satisfies APIRoute;
