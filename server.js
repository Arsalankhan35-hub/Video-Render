const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 3000);
const MAX_BODY_BYTES = 1_000_000;

if (Number(process.versions.node.split('.')[0]) < 18) {
  console.error('Node.js 18 or newer is required. Install the current LTS version from https://nodejs.org/');
  process.exit(1);
}

const PROVIDERS = {
  openai: 'https://api.openai.com/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  groq: 'https://api.groq.com/openai/v1',
  together: 'https://api.together.xyz/v1',
  mistral: 'https://api.mistral.ai/v1',
  deepseek: 'https://api.deepseek.com/v1',
  fireworks: 'https://api.fireworks.ai/inference/v1'
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function sendJson(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(data));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
        reject(new Error('Request is too large.'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch {
        reject(new Error('Invalid JSON request.'));
      }
    });
    req.on('error', reject);
  });
}

async function callProvider(req, res, endpoint, body) {
  const baseUrl = PROVIDERS[body.provider];
  const apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';

  if (!baseUrl) return sendJson(res, 400, { error: 'Select a supported API provider.' });
  if (!apiKey || apiKey.length > 500) return sendJson(res, 400, { error: 'Enter a valid API key.' });
  if (!body.payload || typeof body.payload !== 'object') return sendJson(res, 400, { error: 'Request payload is missing.' });

  // This app is intended for local use. Refuse requests from other origins.
  if (req.headers.origin) {
    try {
      const origin = new URL(req.headers.origin);
      if (origin.host !== req.headers.host) return sendJson(res, 403, { error: 'Cross-origin requests are not allowed.' });
    } catch {
      return sendJson(res, 403, { error: 'Invalid request origin.' });
    }
  }

  try {
    const upstream = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      redirect: 'error',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body.payload),
      signal: AbortSignal.timeout(120_000)
    });

    if (!upstream.ok) {
      const message = (await upstream.text()).slice(0, 1200);
      return sendJson(res, upstream.status, { error: `Provider error (${upstream.status}): ${message}` });
    }

    if (endpoint === '/audio/speech') {
      const audio = Buffer.from(await upstream.arrayBuffer());
      res.writeHead(200, {
        'Content-Type': upstream.headers.get('content-type') || 'audio/mpeg',
        'Content-Length': audio.length,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff'
      });
      return res.end(audio);
    }

    return sendJson(res, 200, await upstream.json());
  } catch (error) {
    const message = error.name === 'TimeoutError'
      ? 'The provider request timed out. Try again.'
      : 'Could not reach the provider. Check your internet connection and try again.';
    return sendJson(res, 502, { error: message });
  }
}

const server = http.createServer(async (req, res) => {
  let url;
  try {
    url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  } catch {
    return sendJson(res, 400, { error: 'Invalid request URL.' });
  }

  if (req.method === 'GET' && url.pathname === '/api/health') {
    return sendJson(res, 200, { ok: true, name: 'Motioncraft', node: process.versions.node });
  }

  if (req.method === 'POST' && ['/api/chat/completions', '/api/audio/speech'].includes(url.pathname)) {
    try {
      const body = await readJson(req);
      return await callProvider(req, res, url.pathname.replace('/api', ''), body);
    } catch (error) {
      if (!res.headersSent && !res.destroyed) return sendJson(res, 400, { error: error.message });
      return;
    }
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD, POST' });
    return res.end('Method not allowed');
  }

  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return sendJson(res, 400, { error: 'Invalid path.' });
  }

  if (pathname === '/') pathname = '/index.html';
  const file = path.resolve(PUBLIC, `.${pathname}`);
  if (file !== PUBLIC && !file.startsWith(`${PUBLIC}${path.sep}`)) return sendJson(res, 403, { error: 'Forbidden.' });

  fs.readFile(file, (error, contents) => {
    if (error) {
      const status = error.code === 'ENOENT' ? 404 : 500;
      res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(status === 404 ? 'Not found' : 'Could not read requested file');
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store'
    });
    return req.method === 'HEAD' ? res.end() : res.end(contents);
  });
});

server.on('error', error => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Close the other app or start Motioncraft on another port:`);
    console.error(process.platform === 'win32' ? '  set PORT=3001 && npm start' : '  PORT=3001 npm start');
  } else {
    console.error('Could not start Motioncraft:', error.message);
  }
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log(`Motioncraft is ready: http://localhost:${PORT}`);
  console.log('Keep this terminal open while using the app. Press Ctrl+C to stop it.');
});
