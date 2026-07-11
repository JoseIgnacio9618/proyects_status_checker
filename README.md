# Pulsewatch

Pulsewatch is a self-hosted API status console. It opens a WebSocket connection to each registered service, tracks its live state, and makes the aggregated result available through a dashboard, HTTP endpoints, and an outbound WebSocket feed.

It is designed to be a single source of truth for an operations screen, health checks, automations, and future integrations such as Stream Deck.

## Features

- Register, edit, enable, disable, and remove monitored services.
- Converts every base URL to a WebSocket endpoint ending in `/status`.
- Automatically reconnects monitored sockets after a disconnection.
- Stores service configuration locally in a JSON file.
- Displays live status without refreshing the dashboard page.
- Exposes JSON endpoints for global and per-service checks.
- Exposes a WebSocket stream for global or per-service subscribers.
- Includes a responsive dashboard with filtering, pagination, activity events, and reconnection controls.

## Requirements

- Node.js 22.12 or newer.
- An API that accepts a WebSocket connection at `<base-url>/status`.

## Local development

```bash
npm install
npm run dev
```

The development server is available at `http://localhost:4321`.

## Production build

```bash
npm run build
npm start
```

`npm start` runs the custom Node server. It serves Astro, static assets, REST routes, and the outbound WebSocket on the `PORT` environment variable (or `4321` locally).

## How services are monitored

When you register `https://api.example.com`, Pulsewatch connects to:

```text
wss://api.example.com/status
```

For an `http://` base URL it uses `ws://`. An open connection is considered `online`; a closed or failed connection is `offline`; an in-progress connection is `connecting`.

## REST API

All response bodies are JSON and use `Cache-Control: no-store`.

| Method | Route | Description |
| --- | --- | --- |
| `GET` | `/api/status` | Global health, counters, and every registered service. |
| `GET` | `/api/status/:id` | State of one service, or `404` if it does not exist. |
| `GET` | `/api/services` | List registered services. |
| `POST` | `/api/services` | Create a service. |
| `PUT` | `/api/services/:id` | Update a service. |
| `DELETE` | `/api/services/:id` | Remove a service. |

### Global status response

```json
{
  "status": "healthy",
  "checkedAt": "2026-07-11T12:00:00.000Z",
  "totals": { "services": 3, "monitored": 2, "online": 2, "failed": 0 },
  "services": []
}
```

`status` is `healthy`, `degraded`, or `pending`. Use `totals.failed` or `status` for an external health check.

### Create or update a service

```json
{
  "name": "Billing API",
  "url": "https://billing.example.com",
  "enabled": true
}
```

## Outbound WebSocket API

Connect consumers to:

```text
ws://localhost:4321/ws
```

Use `wss://your-domain/ws` in production. Each connection immediately receives a global `snapshot` message. To subscribe to a single service, send:

```json
{ "action": "subscribe", "serviceId": "service-id" }
```

Messages use the following shapes:

```json
{ "type": "snapshot", "scope": "all", "status": "healthy", "totals": {}, "services": [] }
{ "type": "snapshot", "scope": "service", "service": {} }
{ "type": "status", "scope": "all", "status": "degraded", "totals": {}, "services": [], "at": "..." }
{ "type": "status", "scope": "service", "service": {}, "at": "..." }
```

The stream checks for changed monitor data once per second and only publishes when the subscribed data changes.

## Persistence

Service configuration is stored in `services.json` under the first configured location below:

1. `RAILWAY_VOLUME_MOUNT_PATH`
2. `PULSEWATCH_DATA_DIR`
3. `./data` in the project directory

Writes are performed through a temporary file and rename operation to avoid partial JSON files. Runtime connection state is intentionally not persisted; it is rebuilt when the server starts.

## Security note

The dashboard, REST API, and WebSocket stream do not include authentication yet. Do not expose a public deployment containing sensitive endpoint names or URLs without placing it behind authentication, a private network, or a reverse proxy access policy.

## Deployment

See [RAILWAY_DEPLOYMENT.md](RAILWAY_DEPLOYMENT.md) for the Railway deployment guide.
