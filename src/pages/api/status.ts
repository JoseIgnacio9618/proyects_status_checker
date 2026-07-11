import type { APIRoute } from 'astro';
import { summary } from '../../lib/monitor-store';
export const prerender = false;
export const GET = (async () => new Response(JSON.stringify(await summary()), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } })) satisfies APIRoute;
