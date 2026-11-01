'use strict';
/* ============================================================
   Z MART - public share proxy (storefront only)

   Serves a read-only view of the storefront on its own port so a
   link can be shared without exposing the admin panel or any write
   API. Everything not on the allowlist returns 404.

   Run (server.js must already be running):
     node share-server.js

   Env:
     SHARE_PORT  (default 4174)
     SHARE_TARGET(default http://127.0.0.1:4173)
   ============================================================ */

const http = require('node:http');

const PORT = Number(process.env.SHARE_PORT) || 4174;
const TARGET = new URL(process.env.SHARE_TARGET || 'http://127.0.0.1:4173');

const STATIC_OK = new Set(['/', '/index.html', '/styles.css', '/profile.css', '/app.js', '/customer-nav.js']);
const UPLOAD_RE = /^\/uploads\/[A-Za-z0-9][A-Za-z0-9._-]*\.(png|jpe?g|webp)$/i;

function allowed(pathname, searchParams) {
  if (STATIC_OK.has(pathname)) return true;
  if (UPLOAD_RE.test(pathname)) return true;
  if (pathname === '/api/products') return !searchParams.has('all');
  return false;
}

function deny(res) {
  res.writeHead(404, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Robots-Tag': 'noindex, nofollow'
  });
  res.end('404 - NOT FOUND');
}

const SHARE_CSS = '<style>.footer__admin{visibility:hidden!important;pointer-events:none!important}.auth-nav,.mobile-menu__auth{display:none!important}</style>';

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return deny(res);

  let url;
  try { url = new URL(req.url, 'http://share.local'); } catch { return deny(res); }

  if (!allowed(url.pathname, url.searchParams)) return deny(res);

  const headers = { ...req.headers, host: TARGET.host };
  delete headers.cookie;
  delete headers.authorization;
  delete headers.connection;

  const upstream = http.request({
    protocol: TARGET.protocol,
    hostname: TARGET.hostname,
    port: TARGET.port,
    method: req.method,
    path: url.pathname + url.search,
    headers
  }, up => {
    const out = { ...up.headers };
    delete out['set-cookie'];
    delete out['transfer-encoding'];
    delete out.connection;
    out['x-robots-tag'] = 'noindex, nofollow';

    const isHtml = (up.headers['content-type'] || '').includes('text/html');
    if (!isHtml) {
      res.writeHead(up.statusCode || 502, out);
      return up.pipe(res);
    }

    const chunks = [];
    up.on('data', c => chunks.push(c));
    up.on('end', () => {
      let body = Buffer.concat(chunks).toString('utf8');
      body = body.includes('</head>') ? body.replace('</head>', SHARE_CSS + '</head>') : SHARE_CSS + body;
      out['content-length'] = Buffer.byteLength(body);
      res.writeHead(up.statusCode || 502, out);
      res.end(req.method === 'HEAD' ? undefined : body);
    });
  });

  upstream.on('error', () => {
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    }
    res.end('502 - STOREFRONT UNAVAILABLE');
  });

  upstream.end();
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Z MART share view  ->  http://localhost:${PORT}/`);
  console.log(`  read-only: /admin, /api/login, /api/session and all writes are blocked`);
});
