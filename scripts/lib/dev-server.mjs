import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('../../', import.meta.url));

// Serve only the app, never repository files, credentials, or development artifacts.
// Overrides exist in the served response; index.html remains independently deployable.
export async function startDevServer({ port = 0, syncUrl = '', googleClientId = 'PLACEHOLDER_CLIENT_ID' } = {}) {
  if (syncUrl && !/^https?:\/\//.test(syncUrl)) throw new Error('INTERVAL_SYNC_URL must be an absolute HTTP(S) URL');
  const literal = value => JSON.stringify(value).replaceAll('<', '\\u003c');
  const server = http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
      if (req.url === '/__health') {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ root, pid: process.pid, sync: syncUrl ? 'configured' : 'disabled' }));
        return;
      }
      if (req.method !== 'GET' || !['/', '/index.html'].includes(req.url.split('?')[0])) {
        res.writeHead(404); res.end('Not found'); return;
      }
      let html = await readFile(new URL('../../index.html', import.meta.url), 'utf8');
      for (const [name, value] of Object.entries({ SYNC_URL: syncUrl, GOOGLE_CLIENT_ID: googleClientId })) {
        const pattern = new RegExp(`const ${name} = '[^']*';`);
        if (!pattern.test(html)) throw new Error(`Missing configuration declaration: ${name}`);
        html = html.replace(pattern, () => `const ${name} = ${literal(value)};`);
      }
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(html);
    } catch (error) {
      console.error(error);
      res.writeHead(500); res.end('Development server error; see server log');
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  const url = `http://127.0.0.1:${server.address().port}`;
  return { url, close: () => new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
    server.closeAllConnections();
  }) };
}
