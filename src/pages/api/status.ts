import type { APIRoute } from 'astro';
import { json } from '../../lib/api-response';
import { summary } from '../../lib/monitor-store';

export const prerender = false;

export const GET = (async () => json(await summary())) satisfies APIRoute;
