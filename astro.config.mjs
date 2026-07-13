// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import { attachRealtimeHub } from './realtime-hub.mjs';

function pulsewatchDevWebSocket() {
  /** @type {{ close: () => void } | undefined} */
  let hub;

  return {
    name: 'pulsewatch-dev-websocket',
    hooks: {
      /** @param {{ server: import('vite').ViteDevServer }} options */
      'astro:server:setup': (options) => {
        const { server } = options;
        const httpServer = server.httpServer;
        if (!httpServer) return;

        hub = attachRealtimeHub(httpServer, async () => {
          const address = httpServer.address();
          const port = typeof address === 'object' && address ? address.port : 4321;
          const response = await fetch(`http://localhost:${port}/api/status`);

          if (!response.ok) throw new Error(`Status endpoint returned ${response.status}.`);
          return response.json();
        }, { allowOtherUpgrades: true });
      },
      'astro:server:done': () => hub?.close(),
    },
  };
}

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'middleware' }),
  integrations: [pulsewatchDevWebSocket()],
  security: {
    allowedDomains: [
      {
        protocol: 'https',
        hostname: 'proyectsstatuschecker-production.up.railway.app',
      },
    ],
  },
});
