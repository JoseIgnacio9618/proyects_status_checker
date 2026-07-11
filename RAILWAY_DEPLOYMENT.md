# Deploying Pulsewatch to Railway

This guide deploys Pulsewatch as one Railway service with a persistent Volume. The Volume is required: it preserves `services.json` across restarts and deployments.

## Before you start

- Push this repository to GitHub, GitLab, or another source supported by Railway.
- Ensure the project builds locally with `npm run build`.
- Decide whether the dashboard will be public. The current application has no authentication, so private monitoring data should not be exposed publicly.

## 1. Create the service

1. In Railway, create a new project.
2. Add a service from this repository.
3. Select the branch that should deploy.

Railway detects the Node project from `package.json`. No Dockerfile is required.

## 2. Configure build and start commands

In the service settings, use these commands if Railway does not detect them automatically:

```text
Build command: npm run build
Start command: npm start
```

The application reads Railway's `PORT` variable automatically and listens on `0.0.0.0`.

## 3. Attach persistent storage

1. Open the service **Volumes** settings.
2. Add a Volume.
3. Set its **Mount Path** to `/data`.
4. Deploy the service.

Railway exposes the chosen mount path through `RAILWAY_VOLUME_MOUNT_PATH`. Pulsewatch detects that variable and writes its persistent file to:

```text
/data/services.json
```

Do not add `RAILWAY_VOLUME_MOUNT_PATH` manually. Railway provides it after a Volume is attached.

## 4. Create a public domain

1. Open **Settings** > **Networking** for the service.
2. Generate a Railway domain, or attach a custom domain.
3. Open the generated URL to load the dashboard.

Railway terminates TLS for its domain. Browser and integration clients must use `https://` for the dashboard and `wss://` for the live feed.

```text
https://your-service.up.railway.app/
wss://your-service.up.railway.app/ws
https://your-service.up.railway.app/api/status
```

## 5. Validate the deployment

After deployment, open the dashboard and verify the API:

```bash
curl https://your-service.up.railway.app/api/status
```

Expected result: JSON with `status`, `totals`, and `services`.

To validate the WebSocket with a JavaScript client:

```js
const socket = new WebSocket('wss://your-service.up.railway.app/ws');
socket.onmessage = (event) => console.log(JSON.parse(event.data));
```

The first message is a global `snapshot`.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `PORT` | No | Set automatically by Railway. The server uses it when present. |
| `RAILWAY_VOLUME_MOUNT_PATH` | No | Set automatically after attaching a Volume. Used as the data directory. |
| `PULSEWATCH_DATA_DIR` | No | Local or non-Railway override for the data directory. |

## Operations and backups

- Create a Railway Volume backup before changing or deleting production service configuration.
- A Volume is mounted only when the container runs, not during build or pre-deploy phases. Pulsewatch writes its data at runtime, which is the intended behavior.
- Do not delete or wipe the Volume unless you intend to remove all saved monitored services.
- Use the Railway deployment logs to investigate startup errors or rejected WebSocket connections.

## Scaling limitation

The local JSON file and in-process WebSocket monitor are intended for one running instance. Railway Volumes are single-service storage, and this application should run with one replica while using local persistence.

If you need horizontal scaling, move service configuration and live monitor coordination to a shared system such as PostgreSQL plus Redis. Do this before enabling multiple replicas.

## Recommended hardening

Before exposing the deployment beyond a trusted team:

1. Place the dashboard behind authentication or an access proxy.
2. Protect service-management endpoints (`POST`, `PUT`, and `DELETE`) with authentication.
3. Limit access to `/ws` if the stream exposes operational data.
4. Use `wss://` only in production.
