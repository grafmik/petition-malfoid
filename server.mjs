// Petition "Malfoid as the female protagonist of GTA VI" — zero-dependency Node server.
// Signatures live in SQLite (node:sqlite) under DATA_DIR (a persistent volume on Coolify).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { createHash, timingSafeEqual } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = process.env.DATA_DIR || './data';
const SALT = process.env.IP_SALT || 'malfoid';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || ''; // enables GET /api/export when set (>= 32 chars)
mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(`${DATA_DIR}/signatures.db`);
db.exec(`CREATE TABLE IF NOT EXISTS signatures (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT '',
  comment TEXT NOT NULL DEFAULT '',
  ip_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`);
db.exec('CREATE INDEX IF NOT EXISTS sig_ip ON signatures(ip_hash, created_at)');
// Emails: stored for verification and (opt-in) updates, never exposed by the API.
const cols = db.prepare('PRAGMA table_info(signatures)').all().map((c) => c.name);
if (!cols.includes('email')) db.exec('ALTER TABLE signatures ADD COLUMN email TEXT');
if (!cols.includes('opt_in')) db.exec('ALTER TABLE signatures ADD COLUMN opt_in INTEGER NOT NULL DEFAULT 0');
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS sig_email ON signatures(lower(email)) WHERE email IS NOT NULL');

const count = db.prepare('SELECT COUNT(*) AS n FROM signatures');
const recent = db.prepare('SELECT name, country, comment, created_at FROM signatures ORDER BY id DESC LIMIT 30');
const sameEmail = db.prepare('SELECT 1 FROM signatures WHERE lower(email) = lower(?)');
const lastHour = db.prepare("SELECT COUNT(*) AS n FROM signatures WHERE ip_hash = ? AND created_at > datetime('now','-1 hour')");
const insert = db.prepare('INSERT INTO signatures (name, country, comment, ip_hash, email, opt_in) VALUES (?, ?, ?, ?, ?, ?)');
const exportAll = db.prepare('SELECT id, created_at, name, email, country, opt_in, comment FROM signatures ORDER BY id');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const page = await readFile(new URL('./public/index.html', import.meta.url), 'utf8');

const clientIp = (req) =>
  (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '';
const ipHash = (ip) => createHash('sha256').update(SALT + ip).digest('hex').slice(0, 32);
const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

function readBody(req, limit = 4096) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > limit) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      res.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'content-security-policy': "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self' 'unsafe-inline'; img-src 'self' data:",
        'x-content-type-options': 'nosniff',
      });
      return res.end(page);
    }
    if (req.method === 'GET' && url.pathname === '/api/signatures') {
      return json(res, 200, { count: count.get().n, recent: recent.all() });
    }
    if (req.method === 'POST' && url.pathname === '/api/sign') {
      let data;
      try { data = JSON.parse(await readBody(req)); } catch { return json(res, 400, { error: 'Invalid request.' }); }
      if (data.website) return json(res, 200, { ok: true, count: count.get().n }); // honeypot: pretend success
      const name = clean(data.name, 60);
      const country = clean(data.country, 40);
      const comment = clean(data.comment, 280);
      const email = clean(data.email, 254).toLowerCase();
      const optIn = 1; // consent text says signers receive emails about the petition
      if (name.length < 2) return json(res, 400, { error: 'Please enter your name.' });
      if (!EMAIL_RE.test(email)) return json(res, 400, { error: 'Please enter a valid email address.' });
      if (data.consent !== true && data.consent !== 'on') return json(res, 400, { error: 'Please agree to receive emails about this petition to sign.' });
      const h = ipHash(clientIp(req));
      if (sameEmail.get(email)) return json(res, 409, { error: 'This email address has already signed. Thank you!' });
      if (lastHour.get(h).n >= 5) return json(res, 429, { error: 'Too many signatures from your connection. Try again later.' });
      insert.run(name, country, comment, h, email, optIn);
      return json(res, 201, { ok: true, count: count.get().n });
    }
    if (req.method === 'GET' && url.pathname === '/api/export') {
      const given = Buffer.from((req.headers.authorization || '').replace(/^Bearer /, ''));
      const want = Buffer.from(ADMIN_TOKEN);
      if (ADMIN_TOKEN.length < 32 || given.length !== want.length || !timingSafeEqual(given, want)) {
        res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('Not found');
      }
      const q = (v) => { v = String(v ?? ''); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
      const lines = ['id,created_at,name,email,country,opt_in,comment'];
      for (const r of exportAll.all()) lines.push([r.id, r.created_at, r.name, r.email, r.country, r.opt_in, r.comment].map(q).join(','));
      res.writeHead(200, { 'content-type': 'text/csv; charset=utf-8', 'cache-control': 'no-store' });
      return res.end(lines.join('\n') + '\n');
    }
    if (req.method === 'GET' && url.pathname === '/healthz') return json(res, 200, { ok: true });
    res.writeHead(404, { 'content-type': 'text/plain' }); res.end('Not found');
  } catch (e) {
    console.error(e);
    json(res, 500, { error: 'Server error.' });
  }
}).listen(PORT, () => console.log(`petition listening on :${PORT}`));
