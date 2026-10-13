const http = require('http');

const PORT = Number(process.env.PORT || 3000);
const DEEPL_API_KEY = process.env.DEEPL_API_KEY || '';
const DEEPL_API_URL = process.env.DEEPL_API_URL || 'https://api-free.deepl.com/v2/translate';
const MAX_TEXT_LENGTH = Number(process.env.MAX_TEXT_LENGTH || 5000);
const REQUESTS_PER_MINUTE = Number(process.env.REQUESTS_PER_MINUTE || 30);

const allowedTargets = new Set([
  'EN-US', 'EN-GB', 'ES', 'FR', 'DE', 'IT', 'PT-BR', 'PT-PT',
  'JA', 'KO', 'ZH-HANS', 'ZH-HANT', 'NL', 'PL', 'RU', 'TR',
  'SV', 'DA', 'NB', 'FI', 'EL', 'CS', 'HU', 'RO', 'SK', 'SL',
  'BG', 'ET', 'LV', 'LT', 'ID', 'UK'
]);

const rateBuckets = new Map();

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

function rateLimited(ip) {
  const now = Date.now();
  const windowMs = 60_000;
  let bucket = rateBuckets.get(ip);
  if (!bucket || now - bucket.startedAt >= windowMs) {
    bucket = { startedAt: now, count: 0 };
    rateBuckets.set(ip, bucket);
  }
  bucket.count += 1;
  return bucket.count > REQUESTS_PER_MINUTE;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    const maxBytes = 64 * 1024;
    req.on('data', chunk => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error('Request is too large.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function translate(text, target) {
  const response = await fetch(DEEPL_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `DeepL-Auth-Key ${DEEPL_API_KEY}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      text: [text],
      target_lang: target
    })
  });

  const raw = await response.text();
  if (!response.ok) {
    console.error(`DeepL HTTP ${response.status}: ${raw}`);
    throw new Error(`Translation provider returned HTTP ${response.status}.`);
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error('Translation provider returned invalid JSON.');
  }

  const result = data?.translations?.[0]?.text;
  if (typeof result !== 'string') {
    throw new Error('Translation provider returned no translated text.');
  }
  return result;
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
    });
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    json(res, 200, { ok: true });
    return;
  }

  if (req.method !== 'POST' || req.url !== '/translate') {
    json(res, 404, { error: 'Not found.' });
    return;
  }

  if (!DEEPL_API_KEY) {
    json(res, 503, { error: 'Translation server is not configured yet.' });
    return;
  }

  const ip = clientIp(req);
  if (rateLimited(ip)) {
    json(res, 429, { error: 'Too many translation requests. Please try again in a minute.' });
    return;
  }

  try {
    const rawBody = await readBody(req);
    let body;
    try {
      body = JSON.parse(rawBody);
    } catch {
      json(res, 400, { error: 'Invalid JSON request.' });
      return;
    }

    const text = typeof body.text === 'string' ? body.text : '';
    const target = typeof body.target === 'string' ? body.target.toUpperCase() : '';

    if (!text.trim()) {
      json(res, 400, { error: 'Text is required.' });
      return;
    }
    if (text.length > MAX_TEXT_LENGTH) {
      json(res, 413, { error: `Text is too long. Maximum is ${MAX_TEXT_LENGTH} characters per request.` });
      return;
    }
    if (!allowedTargets.has(target)) {
      json(res, 400, { error: 'Unsupported target language.' });
      return;
    }

    const translatedText = await translate(text, target);
    json(res, 200, { translatedText });
  } catch (error) {
    console.error(error);
    if (!res.headersSent) {
      json(res, 502, { error: 'Translation failed on the server. Please try again.' });
    }
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`JWebEdit translation server listening on port ${PORT}`);
});
