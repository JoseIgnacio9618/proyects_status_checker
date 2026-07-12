import type { APIRoute } from 'astro';
import { json } from '../../../lib/api-response';
import { reconnectAllServices } from '../../../lib/monitor-store';

export const prerender = false;

export const POST = (async () => json({ services: await reconnectAllServices() })) satisfies APIRoute;
