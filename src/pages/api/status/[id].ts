import type { APIRoute } from 'astro';
import { getService } from '../../../lib/monitor-store';
export const prerender = false;
export const GET = (async ({ params }) => { const service = await getService(params.id!); return service ? new Response(JSON.stringify(service), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } }) : new Response(JSON.stringify({ error: 'Servicio no encontrado' }), { status: 404, headers: { 'Content-Type': 'application/json' } }); }) satisfies APIRoute;
