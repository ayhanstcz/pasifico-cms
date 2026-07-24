const express = require('express');
const fs = require('fs');
const path = require('path');
const session = require('express-session');
const multer = require('multer');
const crypto = require('crypto');
const compression = require('compression');

const app = express();
const PORT = 8766;

// V2: serve from v2 directories instead of root
const V2_SITE_DIR = path.join(__dirname, 'v2-site');
const V2_ADMIN_DIR = path.join(__dirname, 'v2-admin-panel');
const CONTENT_DIR = path.join(__dirname, 'content');
const IMAGES_DIR = path.join(__dirname, 'images');

// Gzip compression for all responses (also handles brotli via Accept-Encoding)
app.use(compression({ level: 6, threshold: 256 }));

// ETag & cache config: more aggressive for static assets
app.set('etag', 'strong');

// Static images: cache 1 year with immutable and stale-while-revalidate
const IMG_CACHE = { maxAge: '1y', immutable: true, etag: true, lastModified: true, setHeaders: (res) => {
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable, stale-while-revalidate=86400');
}};
app.use('/images', express.static(IMAGES_DIR, IMG_CACHE));
app.use('/img', express.static(IMAGES_DIR, IMG_CACHE));

// Admin panel assets: cache 1 hour
app.use('/admin-assets', express.static(V2_ADMIN_DIR, { maxAge: '1h' }));

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

app.use(session({
  secret: crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 24 * 60 * 60 * 1000 }
}));

app.use(express.json({ limit: '50mb' }));

// Serve admin panel static files (with cache)
app.use('/admin-assets', express.static(V2_ADMIN_DIR, { maxAge: '1h' }));

// Multer for uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, IMAGES_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, Date.now() + '_' + name + ext);
  }
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

function requireAuth(req, res, next) {
  if (req.session.authenticated) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Unauthorized' });
  res.redirect('/admin-assets/login.html');
}

// ===================== AUTH =====================
app.post('/api/login', (req, res) => {
  if (req.body.password === ADMIN_PASSWORD) {
    req.session.authenticated = true;
    return res.json({ ok: true });
  }
  res.status(401).json({ error: 'Wrong password' });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

app.get('/api/check-auth', (req, res) => {
  res.json({ authenticated: !!req.session.authenticated });
});

// ===================== DATA CRUD =====================

function loadData(name) {
  const p = path.join(CONTENT_DIR, name + '.json');
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function saveData(name, data) {
  fs.writeFileSync(path.join(CONTENT_DIR, name + '.json'), JSON.stringify(data, null, 2), 'utf8');
}

// In-memory cache for bulk data (refreshed on admin save)
let bulkCache = null;
let bulkCacheTime = 0;

// Admin save also invalidates cache
const origSave = saveData;
saveData = function(name, data) {
  origSave(name, data);
  bulkCache = null;
};

app.get('/api/bulk-data', (req, res) => {
  if (bulkCache && Date.now() - bulkCacheTime < 10000) {
    res.set('Cache-Control', 'public, max-age=10');
    return res.json(bulkCache);
  }
  const bulk = {};
  ['menu','featured','i18n','categories','times','guests','visits','empty-category','events','site']
    .forEach(f => { const p = path.join(CONTENT_DIR, f + '.json'); if (fs.existsSync(p)) bulk[f] = JSON.parse(fs.readFileSync(p, 'utf8')); });
  bulkCache = bulk;
  bulkCacheTime = Date.now();
  res.set('Cache-Control', 'public, max-age=10');
  res.json(bulk);
});

// Individual data
app.get('/api/data/:name', (req, res) => {
  const data = loadData(req.params.name);
  if (!data) return res.status(404).json({ error: 'Not found' });
  res.set('Cache-Control', 'public, max-age=10');
  res.json(data);
});

// Admin: get data
app.get('/api/admin/data/:name', requireAuth, (req, res) => {
  res.set('Cache-Control', 'no-cache');
  res.json(loadData(req.params.name) || {});
});

// Admin: save data
app.put('/api/admin/data/:name', requireAuth, (req, res) => {
  saveData(req.params.name, req.body);
  res.json({ ok: true });
});

// ===================== IMAGES =====================

function walkImages(dir, prefix = '') {
  if (!fs.existsSync(dir)) return [];
  const files = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    const rel = prefix ? prefix + '/' + e.name : e.name;
    if (e.isDirectory()) files.push(...walkImages(full, rel));
    else if (/\.(jpg|jpeg|png|gif|webp|svg|avif)$/i.test(e.name)) files.push(rel);
  }
  return files;
}

app.get('/api/images/list', requireAuth, (req, res) => {
  res.json({ images: walkImages(IMAGES_DIR) });
});

app.post('/api/upload', requireAuth, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  res.json({ url: '/images/' + req.file.filename });
});

// ===================== ADMIN PANEL REDIRECT =====================

app.get('/admin', (req, res) => {
  if (!req.session.authenticated) return res.redirect('/admin-assets/?login=1');
  res.sendFile(path.join(V2_ADMIN_DIR, 'index.html'));
});

// V1 admin redirect (kept for compatibility)
app.get('/admin-v1', (req, res) => {
  if (!req.session.authenticated) return res.redirect('/admin-panel/login.html');
  res.sendFile(path.join(__dirname, 'admin-panel', 'index.html'));
});

// ===================== AI PROXY (9Router) =====================

const AI_API_KEY = (process.env.NINE_ROUTER_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || 'sk-230ddf484e1fde0d-envqre-72f064d5').replace(/[<>]/g, '').trim();
const AI_BASE_URL = process.env.ANTHROPIC_BASE_URL || 'https://9router.ayhanhasanov.cyou/v1';

app.post('/api/ai/chat', requireAuth, async (req, res) => {
  try {
    const { messages, model = 'pasifico-admin', stream: doStream = false } = req.body;
    if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'Messages required' });

    const response = await fetch(`${AI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        max_tokens: 4096
      })
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error('[AI Proxy Error]', response.status, errText);
      return res.status(response.status).json({ error: `AI API error: ${response.status}`, detail: errText });
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('[AI Proxy Fatal]', err.message);
    res.status(500).json({ error: err.message, log: err.message });
  }
});

app.get('/api/ai/models', requireAuth, async (req, res) => {
  try {
    const response = await fetch(`${AI_BASE_URL}/models`, {
      headers: { 'Authorization': `Bearer ${AI_API_KEY}` }
    });
    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error('[AI Models Proxy Error]', response.status, errText);
      return res.status(response.status).json({ error: 'Failed to fetch models', detail: errText });
    }
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('[AI Models Fatal]', err.message);
    res.status(500).json({ error: err.message, log: err.message });
  }
});

// ===================== V2: ADMIN PANEL REDIRECT =====================

app.get('/admin', (req, res) => {
  if (!req.session.authenticated) return res.redirect('/admin-assets/?login=1');
  res.sendFile(path.join(V2_ADMIN_DIR, 'index.html'));
});

// ===================== V2: PUBLIC SITE =====================

app.get('/', (req, res) => {
  res.sendFile(path.join(V2_SITE_DIR, 'index.html'));
});

// Serve static files from v2-site root (for assets)
app.use(express.static(V2_SITE_DIR));
// But also serve from root (for images/ and content/ shared)
app.use(express.static(__dirname));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔══════════════════════════════════════════╗
║   Pasifico V2 — Premium Site + Chatbot  ║
║──────────────────────────────────────────║
║  Site:   http://localhost:${PORT}          ║
║  Admin:  http://localhost:${PORT}/admin    ║
║  Login:  ${ADMIN_PASSWORD}              ║
╚══════════════════════════════════════════╝
  `);
});
