const express = require('express');
const fs = require('fs');
const path = require('path');
const session = require('express-session');
const multer = require('multer');
const crypto = require('crypto');

const app = express();
const PORT = 8765;
const CONTENT_DIR = path.join(__dirname, 'content');
const IMAGES_DIR = path.join(__dirname, 'images');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// Session
app.use(session({
  secret: crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 24 * 60 * 60 * 1000 }
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static images (must be before catch-all)
app.use('/images', express.static(IMAGES_DIR));
app.use('/admin', express.static(path.join(__dirname, 'admin')));

// Multer for uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, IMAGES_DIR),
  filename: (req, file, cb) => {
    // Use original name, prefix timestamp to avoid collisions
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, name + ext);
  }
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

// Auth
function requireAuth(req, res, next) {
  if (req.session.authenticated) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Unauthorized' });
  res.redirect('/admin/login');
}

// ===================== AUTH =====================
app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
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
  const p = path.join(CONTENT_DIR, name + '.json');
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
}

// 🔥 BULK DATA — site loader calls this ONCE instead of 8 separate fetches
app.get('/api/bulk-data', (req, res) => {
  const bulk = {};
  const files = ['menu','featured','i18n','categories','times','guests','visits','empty-category','events','site'];
  for (const f of files) {
    const p = path.join(CONTENT_DIR, f + '.json');
    if (fs.existsSync(p)) bulk[f] = JSON.parse(fs.readFileSync(p, 'utf8'));
  }
  res.json(bulk);
});

// Individual data (kept for admin panel)
app.get('/api/data/:name', (req, res) => {
  const data = loadData(req.params.name);
  if (!data) return res.status(404).json({ error: 'Not found' });
  res.json(data);
});

// Admin API
app.get('/api/admin/entries', requireAuth, (req, res) => {
  const files = fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.json'));
  res.json(files.map(f => ({ name: f.replace('.json', '') })));
});

app.get('/api/admin/data/:name', requireAuth, (req, res) => {
  const data = loadData(req.params.name);
  if (!data) return res.status(404).json({ error: 'Not found' });
  res.json(data);
});

app.put('/api/admin/data/:name', requireAuth, (req, res) => {
  saveData(req.params.name, req.body);
  res.json({ ok: true });
});

// ===================== IMAGES =====================

// Recursive image listing
function walkImages(dir, prefix = '') {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    const rel = prefix ? prefix + '/' + e.name : e.name;
    if (e.isDirectory()) {
      files.push(...walkImages(full, rel));
    } else if (/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(e.name)) {
      files.push(rel);
    }
  }
  return files;
}

app.get('/api/images/list', requireAuth, (req, res) => {
  if (!fs.existsSync(IMAGES_DIR)) return res.json({ images: [] });
  const files = walkImages(IMAGES_DIR);
  res.json({ images: files });
});

// Upload single image
app.post('/api/upload', requireAuth, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  res.json({ url: '/images/' + req.file.filename });
});

// Upload with custom folder path
app.post('/api/upload-to', requireAuth, (req, res) => {
  const folder = req.body.folder || '';
  const dest = folder ? path.join(IMAGES_DIR, folder) : IMAGES_DIR;
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });

  upload.single('image')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file' });
    // Move to custom folder if needed
    const targetPath = path.join(dest, req.file.filename);
    if (req.file.path !== targetPath) {
      fs.renameSync(req.file.path, targetPath);
    }
    const urlPath = folder ? `/images/${folder}/${req.file.filename}` : `/images/${req.file.filename}`;
    res.json({ url: urlPath });
  });
});

// ===================== ADMIN PANEL =====================

app.get('/admin', (req, res) => {
  if (!req.session.authenticated) return res.redirect('/admin/login');
  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

app.get('/admin/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'login.html'));
});

// ===================== PUBLIC SITE =====================

// Serve index.html — everything else is static
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Catch-all for static files
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
