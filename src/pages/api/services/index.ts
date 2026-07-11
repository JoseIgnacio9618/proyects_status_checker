import type { APIRoute } from 'astro';
import { createService, listServices } from '../../../lib/monitor-store';
export const prerender = false;
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
export const GET = (async () => json({ services: await listServices() })) satisfies APIRoute;
export const POST = (async ({ request }) => { try { const { name, url, enabled = true } = await request.json(); if (typeof name !== 'string' || !name.trim() || typeof url !== 'string') return json({ error: 'Nombre y URL son obligatorios.' }, 400); new URL(url.startsWith('http') || url.startsWith('ws') ? url : `https://${url}`); return json(await createService({ name: name.trim(), url: url.trim(), enabled: Boolean(enabled) }), 201); } catch { return json({ error: 'Datos de servicio no válidos.' }, 400); } }) satisfies APIRoute;
