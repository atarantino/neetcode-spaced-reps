import { startDevServer, root } from './lib/dev-server.mjs';
const app = await startDevServer({
  port: Number(process.env.PORT || 0),
  syncUrl: process.env.INTERVAL_SYNC_URL || '',
  googleClientId: process.env.INTERVAL_GOOGLE_CLIENT_ID || 'PLACEHOLDER_CLIENT_ID',
});
console.log(`Interval: ${app.url}\nWorktree: ${root}\nHealth: ${app.url}/__health\nSync: ${process.env.INTERVAL_SYNC_URL ? 'configured' : 'disabled'}\nStop: Ctrl-C`);
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await app.close(); process.exit(0); });
