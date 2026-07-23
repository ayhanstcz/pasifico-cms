# Pasifico Lounge & Dining — CMS Admin Panel

Multi-language CMS for Pasifico Lounge & Dining, Baku.

## Features

- 🚀 **Zero database** — all content in JSON files
- 🌐 **4 languages** — TR / EN / AZ / RU per-field editing
- 🍣 **Full menu editor** — 87 items across 8 categories
- 🖼️ **Image upload & management**
- 🎭 **Event management**
- ⚙️ **Site config** — contact, hours, social links
- 🔒 **Password-protected admin panel**
- 📦 **Git-based versioning**

## Quick Start

```bash
npm install
npm start
```

Then open:
- **Site:** http://localhost:8765
- **Admin:** http://localhost:8765/admin
- **Login:** `admin123` (change via `ADMIN_PASSWORD` env var)

## Structure

```
├── server.js          # Express server + REST API
├── index.html         # Public site (fetches data from API)
├── content/           # JSON data files (editable)
│   ├── menu.json      # 87 menu items, 4 languages
│   ├── i18n.json      # 100+ translation strings
│   ├── featured.json  # Homepage featured plates
│   ├── categories.json
│   ├── events.json
│   ├── site.json      # Contact, social, config
│   └── ...
├── admin/
│   ├── index.html     # Admin SPA dashboard
│   └── login.html     # Login page
└── images/            # Uploaded images
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/data/:name` | Get content (public) |
| PUT | `/api/admin/data/:name` | Update content (auth) |
| POST | `/api/login` | Admin login |
| POST | `/api/upload` | Upload image |
| GET | `/api/images/list` | List images |

## Deploy

```bash
ADMIN_PASSWORD=your-secure-password node server.js
```

Using cloudflared for demo:
```bash
cloudflared tunnel --url http://localhost:8765
```
