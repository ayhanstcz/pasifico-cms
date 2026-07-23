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

// Password (default: admin123 — change in production)
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// Session
app.use(session({
  secret: crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 24 * 60 * 60 * 1000 }
}));

// Body parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static files
app.use('/images', express.static(IMAGES_DIR));

// Image upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, IMAGES_DIR),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// Auth middleware
function requireAuth(req, res, next) {
  if (req.session.authenticated) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Unauthorized' });
  next();
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

// GET all content (public — used by the site)
app.get('/api/data/:name', (req, res) => {
  const { name } = req.params;
  const data = loadData(name);
  if (!data) return res.status(404).json({ error: 'Not found' });
  res.json(data);
});

// GET admin content list (requires auth)
app.get('/api/admin/entries', requireAuth, (req, res) => {
  const files = fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.json'));
  const entries = files.map(f => ({
    name: f.replace('.json', ''),
    label: f.replace('.json', '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }));
  res.json(entries);
});

// GET data entry for admin editing
app.get('/api/admin/data/:name', requireAuth, (req, res) => {
  const data = loadData(req.params.name);
  if (!data) return res.status(404).json({ error: 'Not found' });
  res.json(data);
});

// PUT — update whole dataset
app.put('/api/admin/data/:name', requireAuth, (req, res) => {
  const { name } = req.params;
  const data = req.body;
  if (!data) return res.status(400).json({ error: 'No data' });
  saveData(name, data);
  res.json({ ok: true, message: `${name} saved` });
});

// POST — update single item in an array by id
app.post('/api/admin/data/:name/update', requireAuth, (req, res) => {
  const { name } = req.params;
  const { id, updates } = req.body;
  const data = loadData(name);
  if (!data || !Array.isArray(data)) return res.status(400).json({ error: 'Not an array dataset' });
  const idx = data.findIndex(d => d.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Item not found' });
  data[idx] = { ...data[idx], ...updates };
  saveData(name, data);
  res.json({ ok: true });
});

// POST — add item to array
app.post('/api/admin/data/:name/add', requireAuth, (req, res) => {
  const { name } = req.params;
  const { item } = req.body;
  const data = loadData(name);
  if (!data || !Array.isArray(data)) return res.status(400).json({ error: 'Not an array dataset' });
  if (!item.id) item.id = 'item-' + Date.now();
  data.push(item);
  saveData(name, data);
  res.json({ ok: true, id: item.id });
});

// DELETE — remove item from array by id
app.post('/api/admin/data/:name/delete', requireAuth, (req, res) => {
  const { name } = req.params;
  const { id } = req.body;
  const data = loadData(name);
  if (!data || !Array.isArray(data)) return res.status(400).json({ error: 'Not an array dataset' });
  const idx = data.findIndex(d => d.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Item not found' });
  data.splice(idx, 1);
  saveData(name, data);
  res.json({ ok: true });
});

// Image listing
app.get('/api/images/list', requireAuth, (req, res) => {
  if (!fs.existsSync(IMAGES_DIR)) return res.json({ images: [] });
  const files = fs.readdirSync(IMAGES_DIR).filter(f => /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(f));
  res.json({ images: files });
});

// Upload image
app.post('/api/upload', requireAuth, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  res.json({ url: '/images/' + req.file.filename });
});

// ===================== ADMIN PANEL =====================

app.get('/admin', requireAuth, (req, res) => {
  if (!req.session.authenticated) {
    return res.redirect('/admin/login');
  }
  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

app.get('/admin/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'login.html'));
});

app.get('/admin/*', requireAuth, (req, res) => {
  if (!req.session.authenticated) {
    return res.redirect('/admin/login');
  }
  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

// ===================== PUBLIC SITE =====================

// Serve index.html at root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Fallback for static files
app.use(express.static(__dirname, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
    }
  }
}));

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
