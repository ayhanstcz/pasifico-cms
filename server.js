const express = require('express');
const fs = require('fs');
const path = require('path');
const session = require('express-session');
const multer = require('multer');
const crypto = require('crypto');
const compression = require('compression');

const app = express();
const PORT = 8765;
const CONTENT_DIR = path.join(__dirname, 'content');
const IMAGES_DIR = path.join(__dirname, 'images');

// Gzip compression for all responses
app.use(compression({ level: 6, threshold: 256 }));

// Cache headers for static assets
const CACHE_YEAR = 'public, max-age=31536000, immutable';
const CACHE_SHORT = 'public, max-age=300';
const CACHE_NO = 'no-cache';

// Static images: cache 1 year
app.use('/images', express.static(IMAGES_DIR, { maxAge: '1y', immutable: true }));
app.use('/img', express.static(IMAGES_DIR, { maxAge: '1y', immutable: true }));

// Admin panel assets: cache 1 hour
app.use('/admin-assets', express.static(path.join(__dirname, 'admin-panel'), { maxAge: '1h' }));

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

app.use(session({
  secret: crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 24 * 60 * 60 * 1000 }
}));

app.use(express.json({ limit: '50mb' }));

// Serve admin panel static files (with cache)
app.use('/admin-assets', express.static(path.join(__dirname, 'admin-panel'), { maxAge: '1h' }));

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
  res.redirect('/admin-panel/login.html');
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
  if (!req.session.authenticated) return res.redirect('/admin-panel/login.html');
  res.sendFile(path.join(__dirname, 'admin-panel', 'index.html'));
});

// ===================== PUBLIC SITE =====================

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.use(express.static(__dirname));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔══════════════════════════════════════════╗
║     Pasifico Lounge & Dining — CMS      ║
║──────────────────────────────────────────║
║  Site:   http://localhost:${PORT}          ║
║  Admin:  http://localhost:${PORT}/admin    ║
║  Login:  ${ADMIN_PASSWORD}              ║
╚══════════════════════════════════════════╝
  `);
});
