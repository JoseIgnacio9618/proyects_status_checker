import type { APIRoute } from 'astro';
import { json, readServiceInput, requestError } from '../../../lib/api-response';
import { createService, listServices } from '../../../lib/monitor-store';

export const prerender = false;

export const GET = (async () => json({ services: await listServices() })) satisfies APIRoute;

export const POST = (async ({ request }) => {
  try {
    const service = await createService(await readServiceInput(request));
    return json(service, 201);
  } catch (error) {
    return requestError(error);
  }
}) satisfies APIRoute;
