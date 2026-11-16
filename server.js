const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 3000);
const PUBLIC = path.join(ROOT, 'public');

// Only route requests to known OpenAI-compatible providers. API keys are received
// per request and are never written to disk or retained by this server.
const PROVIDERS = {
  openai: { base: 'https://api.openai.com/v1', host: 'api.openai.com' },
  openrouter: { base: 'https://openrouter.ai/api/v1', host: 'openrouter.ai' },
  groq: { base: 'https://api.groq.com/openai/v1', host: 'api.groq.com' },
  together: { base: 'https://api.together.xyz/v1', host: 'api.together.xyz' },
  mistral: { base: 'https://api.mistral.ai/v1', host: 'api.mistral.ai' },
  deepseek: { base: 'https://api.deepseek.com/v1', host: 'api.deepseek.com' },
  fireworks: { base: 'https://api.fireworks.ai/inference/v1', host: 'api.fireworks.ai' }
};

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml' };

function send(res, status, data, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' });
  res.end(type.startsWith('application/json') ? JSON.stringify(data) : data);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1_000_000) { reject(new Error('Request is too large.')); req.destroy(); }
    });
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); } catch { reject(new Error('Invalid JSON request.')); }
    });
    req.on('error', reject);
  });
}

async function providerRequest(req, res, suffix, body) {
  const provider = PROVIDERS[body.provider];
  const key = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
  if (!provider) return send(res, 400, { error: 'Choose a supported provider.' });
  if (!key || key.length > 500) return send(res, 400, { error: 'Enter a valid API key.' });
  if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) return send(res, 403, { error: 'Cross-origin requests are not allowed.' });

  try {
    const response = await fetch(`${provider.base}${suffix}`, {
      method: 'POST',
      redirect: 'error',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body.payload),
      signal: AbortSignal.timeout(120_000)
    });
    if (!response.ok) {
      const message = (await response.text()).slice(0, 1200);
      return send(res, response.status, { error: `Provider error (${response.status}): ${message}` });
    }
    if (suffix === '/audio/speech') {
      const audio = Buffer.from(await response.arrayBuffer());
      res.writeHead(200, { 'Content-Type': response.headers.get('content-type') || 'audio/mpeg', 'Content-Length': audio.length, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      return res.end(audio);
    }
    const result = await response.json();
    return send(res, 200, result);
  } catch (error) {
    return send(res, 502, { error: error.name === 'TimeoutError' ? 'The provider request timed out.' : `Could not reach the provider: ${error.message}` });
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (req.method === 'POST' && ['/api/chat/completions', '/api/audio/speech'].includes(url.pathname)) {
    try {
      const body = await readJson(req);
      return providerRequest(req, res, url.pathname.replace('/api', ''), body);
    } catch (error) { return send(res, 400, { error: error.message }); }
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'Method not allowed.' });
  let requested = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
  const file = path.resolve(PUBLIC, `.${requested}`);
  if (!file.startsWith(`${PUBLIC}${path.sep}`)) return send(res, 403, { error: 'Forbidden.' });
  fs.readFile(file, (error, content) => {
    if (error) return send(res, 404, 'Not found', 'text/plain; charset=utf-8');
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' });
    if (req.method === 'HEAD') return res.end();
    res.end(content);
  });
});

server.listen(PORT, () => console.log(`Video Render Studio is running at http://localhost:${PORT}`));
