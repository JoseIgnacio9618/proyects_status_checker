import type { APIRoute } from 'astro';
import { removeService, updateService } from '../../../lib/monitor-store';
export const prerender = false;
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
export const PUT = (async ({ params, request }) => { try { const { name, url, enabled = true } = await request.json(); if (typeof name !== 'string' || !name.trim() || typeof url !== 'string') return json({ error: 'Nombre y URL son obligatorios.' }, 400); const service = await updateService(params.id!, { name: name.trim(), url: url.trim(), enabled: Boolean(enabled) }); return service ? json(service) : json({ error: 'Servicio no encontrado' }, 404); } catch { return json({ error: 'Datos de servicio no válidos.' }, 400); } }) satisfies APIRoute;
export const DELETE = (async ({ params }) => await removeService(params.id!) ? new Response(null, { status: 204 }) : json({ error: 'Servicio no encontrado' }, 404)) satisfies APIRoute;
