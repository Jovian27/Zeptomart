#!/usr/bin/env node
/* ============================================================
   Z MART® — zero-dependency store server
   static hosting + catalogue API + session-protected admin
   ------------------------------------------------------------
   run:  node server.js
   env:  PORT (default 4173)
         ADMIN_USER / ADMIN_PASSWORD  (override stored credentials)
         DISCORD_CLIENT_ID / DISCORD_CLIENT_SECRET
         DISCORD_REDIRECT_URI / ADMIN_DISCORD_ID  (Discord owner login)
   ============================================================ */
'use strict';

const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

/* Minimal .env loader — values already in the real environment always win. */
(function loadEnvFile() {
  try {
    const raw = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const text = line.trim();
      if (!text || text.startsWith('#')) continue;
      const i = text.indexOf('=');
      if (i < 1) continue;
      const key = text.slice(0, i).trim();
      let value = text.slice(i + 1).trim();
      if (/^(".*"|'.*')$/.test(value)) value = value.slice(1, -1);
      if (key && !(key in process.env)) process.env[key] = value;
    }
  } catch {}
})();

const ROOT = __dirname;
const DATA_DIR = process.env.ZM_DATA_DIR ? path.resolve(process.env.ZM_DATA_DIR) : path.join(ROOT, 'data');
const UPLOAD_DIR = process.env.ZM_UPLOAD_DIR ? path.resolve(process.env.ZM_UPLOAD_DIR) : path.join(ROOT, 'uploads');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const AUTH_FILE = path.join(DATA_DIR, 'auth.json');
const CUSTOMERS_FILE = path.join(DATA_DIR, 'customers.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || '127.0.0.1';

const CATEGORIES = ['discord', 'gaming', 'ai', 'software'];
const ART_KEYS = ['nitro', 'boost', 'minecraft', 'steam', 'owo', 'generic'];
const TONES = ['#2a1742', '#221236', '#1a0d2b', '#3b2359', '#33204b'];

const SESSION_COOKIE = 'zm_session';
const OAUTH_COOKIE = 'zm_oauth_state';
const CUSTOMER_COOKIE = 'zm_customer';
const CUST_OAUTH_COOKIE = 'zm_cust_state';
const SESSION_TTL = 8 * 60 * 60 * 1000;
const CUSTOMER_TTL = 7 * 24 * 60 * 60 * 1000;
const OAUTH_TTL = 10 * 60 * 1000;
const sessions = new Map();
const customerSessions = new Map();
const oauthStates = new Map();

/* ------------------------------------------------------------
   SEED — the exact catalogue supplied by the store owner
   ------------------------------------------------------------ */
const SEED = [
  {
    id: 'DIS-001',
    name: 'Nitro IDs',
    category: 'discord',
    price: 45,
    oldPrice: 50,
    usd: 0.46,
    oldUsd: 0.5,
    duration: '25–28 Days Warranty',
    description:
      'Get Nitro IDs with a 25–28 days warranty. Enjoy premium Discord features, including Animated Profile Pictures, Profile Banners, Custom Name Styling, Profile Customization, and more. Upgrade your Discord profile and enjoy a premium experience.',
    image: '',
    art: 'nitro',
    tone: '#2a1742',
    available: true
  },
  {
    id: 'DIS-002',
    name: 'Server Boosts',
    category: 'discord',
    price: 280,
    oldPrice: 300,
    usd: 2.8,
    oldUsd: null,
    duration: '28–30 Days',
    description:
      'Enhance your Discord server with premium Server Boosts. Unlock additional server perks, improve audio quality, enjoy enhanced customization options, and give your community a premium experience. Fast delivery with warranty support.',
    image: '',
    art: 'boost',
    tone: '#221236',
    available: true
  },
  {
    id: 'GAM-001',
    name: 'Minecraft Account',
    category: 'gaming',
    price: 670,
    oldPrice: 755,
    usd: null,
    oldUsd: null,
    duration: 'Lifetime',
    description:
      'Get a Minecraft Account and enjoy an amazing gaming experience. Explore endless worlds, build incredible creations, and experience everything Minecraft has to offer. A great choice for Minecraft enthusiasts.',
    image: '',
    art: 'minecraft',
    tone: '#1a0d2b',
    available: true
  },
  {
    id: 'GAM-002',
    name: 'Steam Account',
    category: 'gaming',
    price: 150,
    oldPrice: 200,
    usd: null,
    oldUsd: null,
    duration: 'Lifetime',
    description:
      'Get a Steam Account and explore the world of PC gaming. Discover exciting games, build your gaming library, and enjoy a great gaming experience at an affordable price.',
    image: '',
    art: 'steam',
    tone: '#221236',
    available: true
  },
  {
    id: 'DIS-003',
    name: 'OwO 20 Level Account',
    category: 'discord',
    price: 315,
    oldPrice: 345,
    usd: null,
    oldUsd: null,
    duration: 'Lifetime',
    description:
      'Get an OwO Bot Account with Level 20 progress, ready to use. Save time and jump straight into the OwO Bot experience with an account that already has Level 20 progression. Perfect for OwO Bot enthusiasts.',
    image: '',
    art: 'owo',
    tone: '#2a1742',
    available: true
  }
];

/* ------------------------------------------------------------
   SMALL UTILITIES
   ------------------------------------------------------------ */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8'
};

const send = (res, status, body, headers = {}) => {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(String(body));
  res.writeHead(status, { 'Content-Length': buf.length, ...headers });
  res.end(buf);
};

const json = (res, status, value, headers = {}) =>
  send(res, status, JSON.stringify(value), {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers
  });

const redirect = (res, location, headers = {}) => {
  res.writeHead(302, { Location: location, 'Cache-Control': 'no-store', ...headers });
  res.end();
};

const readBody = (req, limit = 8 * 1024 * 1024) =>
  new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > limit) {
        reject(Object.assign(new Error('Payload too large'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {});
      } catch {
        reject(Object.assign(new Error('Invalid JSON'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });

const hashPw = (pw, salt) => crypto.scryptSync(String(pw), salt, 64).toString('hex');

const safeEqual = (a, b) => {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
};

const cookies = req => {
  const out = {};
  const raw = req.headers.cookie || '';
  raw.split(';').forEach(p => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
};

const num = v => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
};

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/* ------------------------------------------------------------
   DISCORD OWNER LOGIN — config
   Credentials come from environment variables (.env is loaded on
   boot and is never served). Scope is `identify`; only the
   Discord user ID is compared.
   ------------------------------------------------------------ */
let discord = { clientId: '', clientSecret: '', redirectUri: '', adminId: '', enabled: false };

function ensureDiscord() {
  discord = {
    clientId: str(process.env.DISCORD_CLIENT_ID, 40),
    clientSecret: str(process.env.DISCORD_CLIENT_SECRET, 120),
    redirectUri: str(process.env.DISCORD_REDIRECT_URI, 400),
    adminId: str(process.env.ADMIN_DISCORD_ID, 40)
  };
  discord.enabled = !!(discord.clientId && discord.clientSecret && discord.redirectUri && discord.adminId);

  if (discord.enabled) {
    console.log(`  Discord owner login ON (id ${discord.adminId.slice(0, 6)}…)`);
  } else {
    console.log('  Discord owner login OFF (.env not configured)');
  }
}

/* Cookies are marked Secure whenever the request arrives over HTTPS
   (directly or through a proxy such as Cloudflare). Plain-HTTP localhost
   keeps working during development. */
const isSecureReq = req =>
  !!req.socket.encrypted ||
  String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';

const cookieSecure = req => (isSecureReq(req) ? '; Secure' : '');

/* ------------------------------------------------------------
   AUTH
   ------------------------------------------------------------ */
let auth = null;

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 14; i++) out += chars[crypto.randomInt(chars.length)];
  return out;
}

async function ensureAuth() {
  await fsp.mkdir(DATA_DIR, { recursive: true });

  if (process.env.ADMIN_USER && process.env.ADMIN_PASSWORD) {
    const salt = crypto.randomBytes(16).toString('hex');
    auth = { user: process.env.ADMIN_USER, salt, hash: hashPw(process.env.ADMIN_PASSWORD, salt) };
    console.log(`  admin user from env: ${auth.user}`);
    return;
  }

  try {
    auth = JSON.parse(await fsp.readFile(AUTH_FILE, 'utf8'));
    if (!auth.user || !auth.salt || !auth.hash) throw new Error('bad auth file');
    return;
  } catch {}

  const password = generatePassword();
  const salt = crypto.randomBytes(16).toString('hex');
  auth = { user: 'zmart', salt, hash: hashPw(password, salt), createdAt: new Date().toISOString() };
  await fsp.writeFile(AUTH_FILE, JSON.stringify(auth, null, 2));

  const note = [
    'Z MART — ADMIN LOGIN',
    '====================',
    `URL:      http://${HOST}:${PORT}/admin`,
    `USER:     ${auth.user}`,
    `PASSWORD: ${password}`,
    '',
    'Keep this file private. To change the login, either:',
    '  1. set ADMIN_USER / ADMIN_PASSWORD environment variables, or',
    '  2. delete data/auth.json and restart the server (a new password is generated).',
    ''
  ].join('\n');
  await fsp.writeFile(path.join(DATA_DIR, 'ADMIN-LOGIN.txt'), note);

  console.log('\n  ┌──────────────────────────────────────────────┐');
  console.log('  │  Z MART admin created                        │');
  console.log(`  │  user:     ${auth.user.padEnd(33)}│`);
  console.log(`  │  password: ${password.padEnd(33)}│`);
  console.log('  │  saved to data/ADMIN-LOGIN.txt               │');
  console.log('  └──────────────────────────────────────────────┘\n');
}

function isAuthed(req) {
  const token = cookies(req)[SESSION_COOKIE];
  if (!token) return false;
  const s = sessions.get(token);
  if (!s) return false;
  if (s.expires < Date.now()) {
    sessions.delete(token);
    return false;
  }
  return true;
}

function requireAuth(req, res) {
  if (isAuthed(req)) return true;
  json(res, 401, { error: 'UNAUTHORIZED' });
  return false;
}

/* login throttling */
const attempts = new Map();
function throttled(ip) {
  const rec = attempts.get(ip);
  if (!rec) return false;
  if (rec.until && rec.until > Date.now()) return true;
  if (rec.until && rec.until <= Date.now()) attempts.delete(ip);
  return false;
}
function noteFailure(ip) {
  const rec = attempts.get(ip) || { count: 0, until: 0 };
  rec.count += 1;
  if (rec.count >= 6) rec.until = Date.now() + 10 * 60 * 1000;
  attempts.set(ip, rec);
}

/* ------------------------------------------------------------
   CATALOGUE
   ------------------------------------------------------------ */
let products = [];

async function loadProducts() {
  await fsp.mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = JSON.parse(await fsp.readFile(PRODUCTS_FILE, 'utf8'));
    products = Array.isArray(raw) ? raw : [];
  } catch {
    products = SEED.map(p => ({ ...p, createdAt: new Date().toISOString() }));
    await saveProducts();
  }
}
const saveProducts = () =>
  fsp.writeFile(PRODUCTS_FILE, JSON.stringify(products, null, 2));

function cleanProduct(body, existing = null) {
  const p = {
    id: str(body.id, 40).toUpperCase() || existing?.id || '',
    name: str(body.name, 120),
    category: CATEGORIES.includes(body.category) ? body.category : existing?.category || 'discord',
    price: num(body.price),
    oldPrice: num(body.oldPrice),
    usd: num(body.usd),
    oldUsd: num(body.oldUsd),
    duration: str(body.duration, 80),
    description: str(body.description, 4000),
    image: typeof body.image === 'string' && /^\/uploads\/[A-Za-z0-9._-]+$/.test(body.image) ? body.image : '',
    art: ART_KEYS.includes(body.art) ? body.art : existing?.art || 'generic',
    tone: TONES.includes(body.tone) ? body.tone : TONES[0],
    available: body.available !== false,
    updatedAt: new Date().toISOString()
  };

  if (!p.name) throw Object.assign(new Error('PRODUCT NAME REQUIRED'), { status: 400 });
  if (!/^[A-Z0-9][A-Z0-9._-]{1,39}$/.test(p.id))
    throw Object.assign(new Error('PRODUCT ID MUST BE 2–40 CHARACTERS: A–Z 0–9 . _ -'), { status: 400 });
  if (p.price === null) throw Object.assign(new Error('VALID INR PRICE REQUIRED'), { status: 400 });
  if (p.oldPrice !== null && p.oldPrice <= p.price) p.oldPrice = null;
  if (p.usd !== null && p.usd <= 0) p.usd = null;
  if (p.oldUsd !== null && (p.usd === null || p.oldUsd <= p.usd)) p.oldUsd = null;
  if (!p.duration) p.duration = 'Instant delivery';
  if (!p.description) throw Object.assign(new Error('DESCRIPTION REQUIRED'), { status: 400 });

  return p;
}

/* ------------------------------------------------------------
   BUYER PROFILES + ORDERS
   JSON storage, same pattern as the catalogue. Orders are read
   from data/orders.json and are never invented by this server.
   ------------------------------------------------------------ */
const ACCENTS = ['#a855f7', '#7c3aed', '#d946ef', '#22d3ee', '#f472b6', '#fbbf24', '#34d399', '#fb7185'];
const ORDER_STATUSES = ['pending', 'processing', 'completed', 'cancelled'];
const CUSTOMER_STATUSES = ['active', 'suspended'];
const AVATAR_RE = /^\/uploads\/cust-avatar-[A-Za-z0-9][A-Za-z0-9._-]*\.(png|jpe?g|webp)$/i;
const BANNER_RE = /^\/uploads\/cust-banner-[A-Za-z0-9][A-Za-z0-9._-]*\.(png|jpe?g|webp)$/i;

let customers = [];
let orders = [];

async function ensureDataFile(file) {
  try { await fsp.access(file); }
  catch { await fsp.writeFile(file, '[]\n'); }
}

async function loadCustomers() {
  await fsp.mkdir(DATA_DIR, { recursive: true });
  await ensureDataFile(CUSTOMERS_FILE);
  try {
    const raw = JSON.parse(await fsp.readFile(CUSTOMERS_FILE, 'utf8'));
    customers = Array.isArray(raw)
      ? raw.filter(c => c && typeof c.id === 'string' && typeof c.discordId === 'string')
      : [];
  } catch {
    customers = [];
  }
}

async function loadOrders() {
  await ensureDataFile(ORDERS_FILE);
  try {
    const raw = JSON.parse(await fsp.readFile(ORDERS_FILE, 'utf8'));
    orders = Array.isArray(raw) ? raw.filter(o => o && o.id && o.customerId) : [];
  } catch {
    orders = [];
  }
}

const saveCustomers = () => fsp.writeFile(CUSTOMERS_FILE, JSON.stringify(customers, null, 2));

function discordAvatarUrl(discordId, hash) {
  if (hash) {
    const ext = String(hash).startsWith('a_') ? 'gif' : 'png';
    return `https://cdn.discordapp.com/avatars/${encodeURIComponent(discordId)}/${encodeURIComponent(hash)}.${ext}?size=256`;
  }
  let index = 0;
  try { index = Number((BigInt(discordId) >> 22n) % 6n); } catch {}
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}

const customerAvatar = c => c.avatar || discordAvatarUrl(c.discordId, c.discordAvatar);

function nextCustomerId() {
  let max = 0;
  for (const c of customers) {
    const m = /^ZM-(\d+)$/.exec(c.id || '');
    if (m) max = Math.max(max, Number(m[1]));
  }
  return 'ZM-' + String(max + 1).padStart(5, '0');
}

function publicOrder(o) {
  return {
    id: o.id,
    productId: o.productId || '',
    productName: o.productName || 'Order',
    price: Number(o.price) || 0,
    status: ORDER_STATUSES.includes(o.status) ? o.status : 'pending',
    createdAt: o.createdAt || null,
    updatedAt: o.updatedAt || o.createdAt || null
  };
}

function publicCustomer(c, admin = false) {
  const list = orders.filter(o => o.customerId === c.id);
  const out = {
    id: c.id,
    discordId: c.discordId,
    username: c.username,
    displayName: c.displayName || c.username,
    avatar: customerAvatar(c),
    avatarCustom: !!c.avatar,
    discordAvatar: discordAvatarUrl(c.discordId, c.discordAvatar),
    banner: c.banner || '',
    bio: c.bio || '',
    accent: ACCENTS.includes(c.accent) ? c.accent : ACCENTS[0],
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    lastLoginAt: c.lastLoginAt || c.createdAt,
    loginCount: Number(c.loginCount) || 0,
    status: CUSTOMER_STATUSES.includes(c.status) ? c.status : 'active',
    totalOrders: list.length,
    completedOrders: list.filter(o => o.status === 'completed').length
  };
  if (admin) out.recentLogins = (Array.isArray(c.logins) ? c.logins : []).slice(-10).reverse();
  return out;
}

async function upsertCustomer(me) {
  const discordId = String(me.id || '');
  const username = str(me.username, 60) || 'discord-user';
  const globalName = str(me.global_name, 60) || username;
  const hash = typeof me.avatar === 'string' ? me.avatar : '';
  const now = new Date().toISOString();

  let c = customers.find(x => x.discordId === discordId);
  if (!c) {
    c = {
      id: nextCustomerId(),
      discordId,
      username,
      displayName: globalName,
      globalName,
      discordAvatar: hash,
      avatar: '',
      banner: '',
      bio: '',
      accent: ACCENTS[0],
      status: 'active',
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now,
      loginCount: 1,
      logins: [now]
    };
    customers.push(c);
  } else {
    c.username = username;
    c.globalName = globalName;
    c.discordAvatar = hash;
    c.lastLoginAt = now;
    c.loginCount = (Number(c.loginCount) || 0) + 1;
    c.logins = [...(Array.isArray(c.logins) ? c.logins : []), now].slice(-10);
    c.status = CUSTOMER_STATUSES.includes(c.status) ? c.status : 'active';
  }
  await saveCustomers();
  return c;
}

function getCustomer(req) {
  const token = cookies(req)[CUSTOMER_COOKIE];
  if (!token) return null;
  const s = customerSessions.get(token);
  if (!s) return null;
  if (s.expires < Date.now()) {
    customerSessions.delete(token);
    return null;
  }
  const c = customers.find(x => x.id === s.customerId);
  if (!c || (c.status || 'active') !== 'active') {
    customerSessions.delete(token);
    return null;
  }
  return c;
}

function requireCustomer(req, res) {
  const c = getCustomer(req);
  if (!c) {
    json(res, 401, { error: 'SIGN IN REQUIRED' });
    return null;
  }
  return c;
}

function cleanProfile(body, c) {
  const name = str(body.displayName, 40)
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .trim();
  if (name.length < 2 || name.length > 32)
    throw Object.assign(new Error('DISPLAY NAME MUST BE 2–32 CHARACTERS'), { status: 400 });

  const bio = str(body.bio, 400)
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f<>]/g, '')
    .trim();
  if (bio.length > 280)
    throw Object.assign(new Error('BIO MUST BE 280 CHARACTERS OR LESS'), { status: 400 });

  const accent = typeof body.accent === 'string' && ACCENTS.includes(body.accent.toLowerCase())
    ? body.accent.toLowerCase()
    : (ACCENTS.includes(c.accent) ? c.accent : ACCENTS[0]);

  const avatar = body.avatar === '' || body.avatar === null || body.avatar === undefined
    ? ''
    : (typeof body.avatar === 'string' && AVATAR_RE.test(body.avatar)
      ? body.avatar
      : c.avatar || '');

  const banner = body.banner === '' || body.banner === null || body.banner === undefined
    ? ''
    : (typeof body.banner === 'string' && BANNER_RE.test(body.banner)
      ? body.banner
      : c.banner || '');

  return { name, bio, accent, avatar, banner };
}

const IMAGE_MAGIC = {
  png: b => b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  jpg: b => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  webp: b => b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP'
};

function decodeImage(dataUrl) {
  const m = /^data:image\/(png|jpe?g|webp);base64,([A-Za-z0-9+/=]+)$/i.exec(String(dataUrl || ''));
  if (!m) return null;
  const ext = m[1].toLowerCase() === 'jpeg' ? 'jpg' : m[1].toLowerCase();
  const buf = Buffer.from(m[2], 'base64');
  if (!IMAGE_MAGIC[ext](buf)) return null;
  return { buf, ext };
}

function uploadPath(url) {
  return path.join(UPLOAD_DIR, path.basename(String(url || '')));
}

async function handleCustomerUpload(res, customer, body) {
  const kind = body.kind === 'banner' ? 'banner' : 'avatar';
  const img = decodeImage(body.dataUrl);
  if (!img) return json(res, 400, { error: 'UNSUPPORTED IMAGE — USE PNG, JPG OR WEBP' });

  const max = kind === 'banner' ? 5 * 1024 * 1024 : 2 * 1024 * 1024;
  if (img.buf.length > max)
    return json(res, 413, { error: `IMAGE TOO LARGE — MAX ${kind === 'banner' ? '5' : '2'} MB` });

  const name = `cust-${kind}-${customer.id.toLowerCase()}-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}.${img.ext}`;
  await fsp.mkdir(UPLOAD_DIR, { recursive: true });
  await fsp.writeFile(path.join(UPLOAD_DIR, name), img.buf);
  return json(res, 201, { url: `/uploads/${name}` });
}

/* ------------------------------------------------------------
   STATIC FILES
   ------------------------------------------------------------ */
const PUBLIC_PAGES = new Set(['/index.html', '/admin.html', '/profile.html']);
const BLOCKED = /(^|\/)(data|server\.js|share-server\.js|package(-lock)?\.json|README\.md|\.git|\.env[^/]*|[^/]*\.log)(\/|$)/i;

async function serveStatic(req, res, urlPath) {
  let rel = decodeURIComponent(urlPath.split('?')[0]);
  if (rel === '/' || rel === '') rel = '/index.html';
  if (rel === '/admin' || rel === '/admin/') rel = '/admin.html';
  if (rel === '/profile' || rel === '/profile/') rel = '/profile.html';

  if (BLOCKED.test(rel) || rel.includes('..')) return json(res, 404, { error: 'NOT FOUND' });

  const file = path.resolve(ROOT, '.' + rel);
  if (!file.startsWith(ROOT + path.sep) && file !== ROOT) return json(res, 404, { error: 'NOT FOUND' });

  const ext = path.extname(file).toLowerCase();
  if (!MIME[ext]) return json(res, 404, { error: 'NOT FOUND' });

  try {
    const stat = await fsp.stat(file);
    if (!stat.isFile()) throw new Error('dir');
    const etag = `W/"${stat.size}-${stat.mtimeMs}"`;
    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304, { ETag: etag });
      return res.end();
    }
    const buf = await fsp.readFile(file);
    const cache = PUBLIC_PAGES.has(rel) || ['.html', '.js', '.css'].includes(ext)
      ? 'no-cache'
      : 'public, max-age=3600';
    send(res, 200, buf, {
      'Content-Type': MIME[ext],
      'Cache-Control': cache,
      ETag: etag
    });
  } catch {
    send(res, 404, '404 — NOT FOUND', { 'Content-Type': 'text/plain; charset=utf-8' });
  }
}

/* ------------------------------------------------------------
   API
   ------------------------------------------------------------ */
async function handleLogin(req, res) {
  const ip = req.socket.remoteAddress || 'unknown';
  if (throttled(ip)) return json(res, 429, { error: 'TOO MANY ATTEMPTS. TRY AGAIN IN 10 MINUTES.' });

  const body = await readBody(req, 8 * 1024);
  const user = str(body.user, 80);
  const pass = str(body.password, 200);

  const userOk = safeEqual(user, auth.user);
  const passOk = safeEqual(hashPw(pass, auth.salt), auth.hash);

  if (!userOk || !passOk) {
    noteFailure(ip);
    return json(res, 401, { error: 'INVALID USERNAME OR PASSWORD' });
  }

  attempts.delete(ip);
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { user: auth.user, expires: Date.now() + SESSION_TTL });

  json(res, 200, { ok: true, user: auth.user }, {
    'Set-Cookie': `${SESSION_COOKIE}=${token}; HttpOnly${cookieSecure(req)}; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL / 1000}`
  });
}

/* ------------------------------------------------------------
   DISCORD OAUTH — two separate flows, one callback
   GET /auth/discord           admin owner login
   GET /auth/discord/customer  buyer login
   GET /auth/discord/callback  exchange code, verify profile
   ------------------------------------------------------------ */
async function handleDiscordAuth(req, res, url) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'METHOD NOT ALLOWED' });

  const isCustomerStart = url.pathname === '/auth/discord/customer';

  if (url.pathname === '/auth/discord' || isCustomerStart) {
    const startPath = isCustomerStart ? '/auth/discord/customer' : '/auth/discord';
    const failPath = isCustomerStart ? '/profile' : '/admin';

    if (!discord.enabled) return redirect(res, `${failPath}?discord=unconfigured`);

    // Keep the OAuth host aligned with the registered redirect URI.
    try {
      const target = new URL(discord.redirectUri);
      if (req.headers.host !== target.host) return redirect(res, `${target.origin}${startPath}`);
    } catch {
      return redirect(res, `${failPath}?discord=unconfigured`);
    }

    const state = crypto.randomBytes(24).toString('hex');
    for (const [key, rec] of oauthStates) if (!rec || rec.expires < Date.now()) oauthStates.delete(key);
    oauthStates.set(state, { expires: Date.now() + OAUTH_TTL, kind: isCustomerStart ? 'customer' : 'admin' });

    const params = new URLSearchParams({
      client_id: discord.clientId,
      response_type: 'code',
      redirect_uri: discord.redirectUri,
      scope: 'identify',
      state,
      prompt: 'consent'
    });
    const cookieName = isCustomerStart ? CUST_OAUTH_COOKIE : OAUTH_COOKIE;
    return redirect(res, `https://discord.com/oauth2/authorize?${params}`, {
      'Set-Cookie': `${cookieName}=${state}; HttpOnly${cookieSecure(req)}; SameSite=Lax; Path=/auth/discord; Max-Age=600`
    });
  }

  if (url.pathname === '/auth/discord/callback') {
    const clearAdmin = `${OAUTH_COOKIE}=; HttpOnly${cookieSecure(req)}; SameSite=Lax; Path=/auth/discord; Max-Age=0`;
    const clearCustomer = `${CUST_OAUTH_COOKIE}=; HttpOnly${cookieSecure(req)}; SameSite=Lax; Path=/auth/discord; Max-Age=0`;
    const clearBoth = [clearAdmin, clearCustomer];

    const state = url.searchParams.get('state') || '';
    const adminCookie = cookies(req)[OAUTH_COOKIE] || '';
    const customerCookie = cookies(req)[CUST_OAUTH_COOKIE] || '';
    const code = url.searchParams.get('code') || '';
    const denied = url.searchParams.get('error');

    const issued = oauthStates.get(state);
    oauthStates.delete(state);

    let kind = '';
    if (issued && Date.now() <= issued.expires) {
      if (issued.kind === 'admin' && adminCookie && safeEqual(state, adminCookie)) kind = 'admin';
      if (issued.kind === 'customer' && customerCookie && safeEqual(state, customerCookie)) kind = 'customer';
    }

    const intended = kind || (customerCookie ? 'customer' : 'admin');
    const failPath = intended === 'customer' ? '/profile' : '/admin';

    if (denied || !code || !kind) {
      return redirect(res, `${failPath}?discord=${denied ? 'denied' : 'invalid'}`, { 'Set-Cookie': clearBoth });
    }
    if (!discord.enabled) {
      return redirect(res, `${failPath}?discord=unconfigured`, { 'Set-Cookie': clearBoth });
    }

    try {
      const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: discord.clientId,
          client_secret: discord.clientSecret,
          grant_type: 'authorization_code',
          code,
          redirect_uri: discord.redirectUri
        }),
        signal: AbortSignal.timeout(10000)
      });
      if (!tokenRes.ok) throw new Error('token exchange failed');
      const token = await tokenRes.json();

      const meRes = await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${token.access_token}` },
        signal: AbortSignal.timeout(10000)
      });
      if (!meRes.ok) throw new Error('profile fetch failed');
      const me = await meRes.json();
      const id = String(me.id || '');
      if (!id) throw new Error('profile missing id');

      if (kind === 'admin') {
        if (!safeEqual(id, discord.adminId)) {
          console.warn(`  discord owner login rejected (id ${id.slice(0, 6)}…)`);
          return redirect(res, '/admin?discord=denied', { 'Set-Cookie': clearBoth });
        }

        const sessionToken = crypto.randomBytes(32).toString('hex');
        sessions.set(sessionToken, {
          user: auth.user,
          via: 'discord',
          discordId: id,
          expires: Date.now() + SESSION_TTL
        });

        console.log(`  discord owner login OK (${id})`);
        return redirect(res, '/admin', {
          'Set-Cookie': [
            ...clearBoth,
            `${SESSION_COOKIE}=${sessionToken}; HttpOnly${cookieSecure(req)}; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL / 1000}`
          ]
        });
      }

      const customer = await upsertCustomer(me);
      if ((customer.status || 'active') !== 'active') {
        return redirect(res, '/profile?discord=suspended', { 'Set-Cookie': clearBoth });
      }

      const sessionToken = crypto.randomBytes(32).toString('hex');
      customerSessions.set(sessionToken, {
        customerId: customer.id,
        expires: Date.now() + CUSTOMER_TTL
      });

      console.log('  discord customer login OK');
      return redirect(res, '/profile', {
        'Set-Cookie': [
          ...clearBoth,
          `${CUSTOMER_COOKIE}=${sessionToken}; HttpOnly${cookieSecure(req)}; SameSite=Lax; Path=/; Max-Age=${CUSTOMER_TTL / 1000}`
        ]
      });
    } catch (err) {
      console.error(`  discord login failed: ${err.message}`);
      return redirect(res, `${failPath}?discord=error`, { 'Set-Cookie': clearBoth });
    }
  }

  return json(res, 404, { error: 'NOT FOUND' });
}

async function handleUpload(res, body) {
  const match = /^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(body.dataUrl || '');
  if (!match) return json(res, 400, { error: 'UNSUPPORTED IMAGE — USE PNG, JPG OR WEBP' });

  const buf = Buffer.from(match[2], 'base64');
  if (buf.length > 3 * 1024 * 1024) return json(res, 413, { error: 'IMAGE TOO LARGE (MAX 3 MB)' });

  const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
  const name = `p-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
  await fsp.mkdir(UPLOAD_DIR, { recursive: true });
  await fsp.writeFile(path.join(UPLOAD_DIR, name), buf);
  json(res, 201, { url: `/uploads/${name}` });
}

async function api(req, res, url) {
  const p = url.pathname;
  const method = req.method;

  if (p === '/api/session' && method === 'GET') {
    return json(res, 200, { authenticated: isAuthed(req), user: isAuthed(req) ? auth.user : null });
  }

  if (p === '/api/auth-config' && method === 'GET') {
    return json(res, 200, {
      discordLogin: discord.enabled,
      customerLogin: discord.enabled,
      accents: ACCENTS
    });
  }

  if (p === '/api/login' && method === 'POST') return handleLogin(req, res);

  if (p === '/api/logout' && method === 'POST') {
    const token = cookies(req)[SESSION_COOKIE];
    if (token) sessions.delete(token);
    return json(res, 200, { ok: true }, {
      'Set-Cookie': `${SESSION_COOKIE}=; HttpOnly${cookieSecure(req)}; SameSite=Strict; Path=/; Max-Age=0`
    });
  }

  /* ---------------- buyer session + profile ---------------- */
  if (p === '/api/customer/session' && method === 'GET') {
    const c = getCustomer(req);
    return json(res, 200, c
      ? { authenticated: true, customer: publicCustomer(c) }
      : { authenticated: false });
  }

  if (p === '/api/customer/logout' && method === 'POST') {
    const token = cookies(req)[CUSTOMER_COOKIE];
    if (token) customerSessions.delete(token);
    return json(res, 200, { ok: true }, {
      'Set-Cookie': `${CUSTOMER_COOKIE}=; HttpOnly${cookieSecure(req)}; SameSite=Lax; Path=/; Max-Age=0`
    });
  }

  if (p === '/api/customer/profile' && method === 'GET') {
    const c = requireCustomer(req, res);
    if (!c) return;
    return json(res, 200, { customer: publicCustomer(c) });
  }

  if (p === '/api/customer/profile' && method === 'PUT') {
    const c = requireCustomer(req, res);
    if (!c) return;
    const body = await readBody(req, 64 * 1024);
    const next = cleanProfile(body, c);

    const oldAvatar = c.avatar;
    const oldBanner = c.banner;
    c.displayName = next.name;
    c.bio = next.bio;
    c.accent = next.accent;
    c.avatar = next.avatar;
    c.banner = next.banner;
    c.updatedAt = new Date().toISOString();
    await saveCustomers();

    if (oldAvatar && oldAvatar !== next.avatar) fsp.unlink(uploadPath(oldAvatar)).catch(() => {});
    if (oldBanner && oldBanner !== next.banner) fsp.unlink(uploadPath(oldBanner)).catch(() => {});

    return json(res, 200, { customer: publicCustomer(c) });
  }

  if (p === '/api/customer/upload' && method === 'POST') {
    const c = requireCustomer(req, res);
    if (!c) return;
    const body = await readBody(req, 8 * 1024 * 1024);
    return handleCustomerUpload(res, c, body);
  }

  if (p === '/api/customer/orders' && method === 'GET') {
    const c = requireCustomer(req, res);
    if (!c) return;
    const list = orders
      .filter(o => o.customerId === c.id)
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
      .map(publicOrder);
    return json(res, 200, { orders: list });
  }

  const orderMatch = /^\/api\/customer\/orders\/([^/]+)$/.exec(p);
  if (orderMatch && method === 'GET') {
    const c = requireCustomer(req, res);
    if (!c) return;
    const id = decodeURIComponent(orderMatch[1]);
    const order = orders.find(o => o.id === id && o.customerId === c.id);
    if (!order) return json(res, 404, { error: 'ORDER NOT FOUND' });
    return json(res, 200, { order: publicOrder(order) });
  }

  /* ---------------- admin customer management ---------------- */
  if (p === '/api/admin/customers' && method === 'GET') {
    if (!requireAuth(req, res)) return;
    const q = str(url.searchParams.get('q'), 80).toLowerCase();
    const status = url.searchParams.get('status') || 'all';
    const sort = url.searchParams.get('sort') || 'newest';

    let list = customers.slice();
    if (q) {
      list = list.filter(c =>
        String(c.username || '').toLowerCase().includes(q) ||
        String(c.displayName || '').toLowerCase().includes(q) ||
        String(c.discordId || '').includes(q) ||
        String(c.id || '').toLowerCase().includes(q)
      );
    }
    if (CUSTOMER_STATUSES.includes(status)) {
      list = list.filter(c => (c.status || 'active') === status);
    }
    if (sort === 'recent') {
      list.sort((a, b) => String(b.lastLoginAt || '').localeCompare(String(a.lastLoginAt || '')));
    } else if (sort === 'oldest') {
      list.sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
    } else {
      list.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    }

    return json(res, 200, {
      customers: list.map(c => publicCustomer(c, true)),
      total: customers.length,
      active: customers.filter(c => (c.status || 'active') === 'active').length,
      suspended: customers.filter(c => c.status === 'suspended').length
    });
  }

  const customerMatch = /^\/api\/admin\/customers\/([^/]+)$/.exec(p);
  if (customerMatch) {
    if (!requireAuth(req, res)) return;
    const id = decodeURIComponent(customerMatch[1]);
    const c = customers.find(x => x.id === id);
    if (!c) return json(res, 404, { error: 'CUSTOMER NOT FOUND' });

    if (method === 'GET') {
      const history = orders
        .filter(o => o.customerId === c.id)
        .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
        .map(publicOrder);
      return json(res, 200, {
        customer: publicCustomer(c, true),
        orders: history,
        recentLogins: (Array.isArray(c.logins) ? c.logins : []).slice(-10).reverse()
      });
    }

    if (method === 'PUT') {
      const body = await readBody(req, 8 * 1024);
      const status = str(body.status, 20).toLowerCase();
      if (!CUSTOMER_STATUSES.includes(status))
        return json(res, 400, { error: 'STATUS MUST BE ACTIVE OR SUSPENDED' });
      c.status = status;
      c.updatedAt = new Date().toISOString();
      await saveCustomers();

      if (status === 'suspended') {
        for (const [token, session] of customerSessions) {
          if (session.customerId === c.id) customerSessions.delete(token);
        }
      }
      return json(res, 200, { customer: publicCustomer(c, true) });
    }
  }

  if (p === '/api/products' && method === 'GET') {
    const all = url.searchParams.get('all') === '1';
    if (all && !isAuthed(req)) return json(res, 401, { error: 'UNAUTHORIZED' });
    const list = all ? products : products.filter(x => x.available !== false);
    return json(res, 200, { products: list, categories: CATEGORIES });
  }

  if (p === '/api/products' && method === 'POST') {
    if (!requireAuth(req, res)) return;
    const body = await readBody(req);
    const item = cleanProduct(body);
    if (products.some(x => x.id === item.id))
      return json(res, 409, { error: `PRODUCT ID ${item.id} ALREADY EXISTS` });
    item.createdAt = new Date().toISOString();
    products.push(item);
    await saveProducts();
    return json(res, 201, { product: item });
  }

  const m = /^\/api\/products\/([^/]+)$/.exec(p);
  if (m) {
    if (!requireAuth(req, res)) return;
    const key = decodeURIComponent(m[1]).toUpperCase();
    const idx = products.findIndex(x => x.id === key);
    if (idx === -1) return json(res, 404, { error: 'PRODUCT NOT FOUND' });

    if (method === 'PUT') {
      const body = await readBody(req);
      const updated = cleanProduct(body, products[idx]);
      if (updated.id !== key && products.some(x => x.id === updated.id))
        return json(res, 409, { error: `PRODUCT ID ${updated.id} ALREADY EXISTS` });
      updated.createdAt = products[idx].createdAt;
      products[idx] = updated;
      await saveProducts();
      return json(res, 200, { product: updated });
    }

    if (method === 'DELETE') {
      const [removed] = products.splice(idx, 1);
      await saveProducts();
      if (removed.image) fsp.unlink(path.join(ROOT, removed.image)).catch(() => {});
      return json(res, 200, { ok: true });
    }
  }

  if (p === '/api/upload' && method === 'POST') {
    if (!requireAuth(req, res)) return;
    const body = await readBody(req, 6 * 1024 * 1024);
    return handleUpload(res, body);
  }

  json(res, 404, { error: 'NOT FOUND' });
}

/* ------------------------------------------------------------
   SERVER
   ------------------------------------------------------------ */
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const origin = req.headers.origin;

  if (origin && ['POST', 'PUT', 'DELETE'].includes(req.method)) {
    let host = '';
    try { host = new URL(origin).host; } catch {}
    if (host !== req.headers.host) return json(res, 403, { error: 'BAD ORIGIN' });
  }

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  try {
    if (url.pathname === '/auth/discord' || url.pathname === '/auth/discord/customer' || url.pathname === '/auth/discord/callback')
      return await handleDiscordAuth(req, res, url);
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'METHOD NOT ALLOWED' });
    return await serveStatic(req, res, url.pathname);
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    json(res, status, { error: err.message || 'SERVER ERROR' });
  }
});

(async () => {
  await ensureAuth();
  await ensureDiscord();
  await loadProducts();
  await loadCustomers();
  await loadOrders();
  server.listen(PORT, HOST, () => {
    console.log(`\n  Z MART running → http://${HOST}:${PORT}`);
    console.log(`  Admin          → http://${HOST}:${PORT}/admin`);
    console.log(`  Buyer profile  → http://${HOST}:${PORT}/profile`);
    if (!fs.existsSync(path.join(DATA_DIR, 'ADMIN-LOGIN.txt')) && !process.env.ADMIN_PASSWORD) {
      console.log('  Login saved in data/ADMIN-LOGIN.txt');
    }
    console.log('  Ctrl+C to stop\n');
  });
})();
