import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { handleApiRequest } from './lib/router.js';
import { runImageJob } from './lib/imageJobs.js';

const PORT = Number(process.env.API_PORT) || 3001;

// Load .env (if present) without pulling in a dependency.
try {
  const envFile = readFileSync(new URL('../.env', import.meta.url), 'utf8');
  for (const line of envFile.split('\n')) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  }
} catch {
  // No .env file — rely on the ambient environment.
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname.replace(/^\/api/, '') || '/';

  let body = null;
  if (req.method === 'POST') {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString('utf8');
    if (raw) {
      try {
        body = JSON.parse(raw);
      } catch {
        res.writeHead(400, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON body' }));
        return;
      }
    }
  }

  try {
    const result = await handleApiRequest({
      method: req.method,
      path,
      query: url.searchParams,
      body,
      headers: req.headers,
      // Local dev is plain HTTP, and a Secure cookie would never be stored —
      // which would make every login here silently fail.
      isSecure: false,
      env: process.env,
      // No function timeout locally, so the job is finished before the client
      // is told about it. Its first poll then returns the image immediately.
      startImageJob: runImageJob,
    });
    res.writeHead(result.status, {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      ...(result.headers || {}),
    });
    res.end(JSON.stringify(result.body));
  } catch (error) {
    console.error('API error:', error);
    res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
});

server.listen(PORT, () => {
  console.log(`TrendMint API proxy listening on http://localhost:${PORT}/api`);
  console.log(`  Etsy key:   ${process.env.ETSY_API_KEY ? 'configured' : 'missing'}`);
  console.log(`  Claude key: ${process.env.ANTHROPIC_API_KEY ? 'configured' : 'missing'}`);
});
