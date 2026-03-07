/**
 * Parlor REST API Server
 * A simple server-first storage solution for syncing data across devices
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Data directory
const DATA_DIR = path.join(__dirname, 'data');
const AVATARS_DIR = path.join(DATA_DIR, 'avatars');
const FILES = {
  characters: path.join(DATA_DIR, 'characters.json'),
  personas: path.join(DATA_DIR, 'personas.json'),
  chats: path.join(DATA_DIR, 'chats.json'),
  presets: path.join(DATA_DIR, 'presets.json'),
  connections: path.join(DATA_DIR, 'connections.json'),
  settings: path.join(DATA_DIR, 'settings.json'),
  regexes: path.join(DATA_DIR, 'regexes.json'),
  lorebook: path.join(DATA_DIR, 'lorebook.json'),
  worldInfo: path.join(DATA_DIR, 'world-info.json'),
};

// Middleware - restrict CORS to localhost and LAN origins
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (server-to-server, curl, etc.)
    if (!origin) return callback(null, true);
    // Allow localhost on any port
    if (origin.match(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/)) return callback(null, true);
    // Allow LAN IPs (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
    if (origin.match(/^https?:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  }
}));
app.use(express.json({ limit: '50mb' }));

// Ensure data directory and files exist
function initializeStorage() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(AVATARS_DIR)) {
    fs.mkdirSync(AVATARS_DIR, { recursive: true });
  }
  
  for (const file of Object.values(FILES)) {
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, '[]');
    }
  }

  // One-time migration: move any inline base64 avatars out of characters.json
  // into sidecar files. Safe to re-run — it's a no-op if already migrated.
  try {
    const raw = fs.readFileSync(FILES.characters, 'utf-8');
    if (raw.includes('"avatar"')) {
      const chars = JSON.parse(raw);
      const slim = chars.map(extractAvatar);
      fs.writeFileSync(FILES.characters, JSON.stringify(slim, null, 2));
      console.log('✅ Migrated character avatars to sidecar files');
    }
  } catch (e) {
    console.warn('Avatar migration skipped:', e.message);
  }

  console.log('✅ Storage initialized');
}

// In-memory cache: avoids re-reading/re-parsing large JSON files on every request.
// Each entry is { data: any[], mtime: number } keyed by type string.
const dataCache = {};

/** Validate that an ID is safe to use as a filename (no path traversal). */
function isSafeId(id) {
  if (!id || typeof id !== 'string') return false;
  // Reject path separators and traversal patterns
  return !/[\/\\]|\.\./.test(id);
}

// Helper functions
function readData(type) {
  try {
    const file = FILES[type];
    if (!file) return null;
    const stat = fs.statSync(file);
    const cached = dataCache[type];
    if (cached && cached.mtime === stat.mtimeMs) {
      return cached.data;
    }
    const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
    dataCache[type] = { data, mtime: stat.mtimeMs };
    return data;
  } catch (error) {
    console.error(`Error reading ${type}:`, error);
    return [];
  }
}

/**
 * Strip the avatar field from a character and persist it to its own file.
 * Returns the character object without the avatar key so characters.json
 * stays small and never hits V8's string-length limit.
 */
function extractAvatar(char) {
  if (!char || !char.id || !isSafeId(char.id)) return char;
  const avatarPath = path.join(AVATARS_DIR, char.id);
  if (char.avatar) {
    try { fs.writeFileSync(avatarPath, char.avatar); } catch (e) {
      console.error('Failed to write avatar for', char.id, e);
    }
  } else if ('avatar' in char && !char.avatar) {
    // Explicitly cleared — remove the old file so stale data isn't served
    try { if (fs.existsSync(avatarPath)) fs.unlinkSync(avatarPath); } catch {}
  }
  const { avatar: _, ...rest } = char;
  return rest;
}

/** Read a character's avatar from its sidecar file. Returns null if absent. */
function readAvatar(id) {
  if (!isSafeId(id)) return null;
  try {
    const p = path.join(AVATARS_DIR, id);
    if (fs.existsSync(p)) return fs.readFileSync(p, 'utf-8');
  } catch {}
  return null;
}

function writeData(type, data) {
  try {
    const file = FILES[type];
    if (!file) return false;
    // Strip base64 avatars from characters — store them as sidecar files so
    // characters.json stays small and JSON.stringify never hits the string limit.
    const dataToWrite = type === 'characters' ? data.map(extractAvatar) : data;
    fs.writeFileSync(file, JSON.stringify(dataToWrite, null, 2));
    // Update cache so subsequent reads don't hit disk again
    const stat = fs.statSync(file);
    dataCache[type] = { data: dataToWrite, mtime: stat.mtimeMs };
    return true;
  } catch (error) {
    console.error(`Error writing ${type}:`, error);
    return false;
  }
}

// API Routes

// POST /api/characters/avatars - Return avatar data for the given IDs.
// Reads from sidecar files in data/avatars/ rather than the character JSON.
// Kept before generic routes to avoid param-route ambiguity.
app.post('/api/characters/avatars', (req, res) => {
  if (!Array.isArray(req.body)) {
    return res.status(400).json({ error: 'Body must be an array of IDs' });
  }
  const result = {};
  for (const id of req.body) {
    if (!isSafeId(id)) continue;
    const avatar = readAvatar(id);
    if (avatar) result[id] = avatar;
  }
  res.json(result);
});

// GET /api/:type - Get all items
// Supports ?compact=true for characters: strips heavy fields (avatar, gallery,
// characterBook, mesExamples, description, personality, scenario, systemPrompt,
// postHistoryInstructions) to return a fast lightweight list.
app.get('/api/:type', (req, res) => {
  const { type } = req.params;
  let data = readData(type);
  if (data === null) {
    return res.status(404).json({ error: 'Invalid data type' });
  }
  if (req.query.compact === 'true' && type === 'characters') {
    data = data.map(({
      avatar: _a, gallery: _g, characterBook: _cb, mesExamples: _me,
      description: _d, personality: _p, scenario: _s, systemPrompt: _sp,
      postHistoryInstructions: _phi,
      ...rest
    }) => rest);
  }
  // Compact chats: strip messages array so the list is lightweight for sorting
  if (req.query.compact === 'true' && type === 'chats') {
    data = data.map(({ messages: _m, ...rest }) => rest);
  }
  res.json(data);
});

// GET /api/:type/:id - Get single item
app.get('/api/:type/:id', (req, res) => {
  const { type, id } = req.params;
  const data = readData(type);
  if (data === null) {
    return res.status(404).json({ error: 'Invalid data type' });
  }
  let item = data.find(i => i.id === id);
  if (!item) {
    return res.status(404).json({ error: 'Item not found' });
  }
  // Inject avatar from sidecar file for characters
  if (type === 'characters') {
    const avatar = readAvatar(id);
    if (avatar) item = { ...item, avatar };
  }
  res.json(item);
});

// POST /api/:type - Create new item
app.post('/api/:type', (req, res) => {
  const { type } = req.params;
  const data = readData(type);
  if (data === null) {
    return res.status(404).json({ error: 'Invalid data type' });
  }
  const newItem = {
    ...req.body,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  data.push(newItem);
  if (writeData(type, data)) {
    res.status(201).json(newItem);
  } else {
    res.status(500).json({ error: 'Failed to save' });
  }
});

// PUT /api/:type/:id - Update item
app.put('/api/:type/:id', (req, res) => {
  const { type, id } = req.params;
  const data = readData(type);
  if (data === null) {
    return res.status(404).json({ error: 'Invalid data type' });
  }
  const index = data.findIndex(i => i.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Item not found' });
  }
  data[index] = {
    ...data[index],
    ...req.body,
    updatedAt: Date.now(),
  };
  if (writeData(type, data)) {
    res.json(data[index]);
  } else {
    res.status(500).json({ error: 'Failed to save' });
  }
});

// DELETE /api/:type/:id - Delete item
app.delete('/api/:type/:id', (req, res) => {
  const { type, id } = req.params;
  const data = readData(type);
  if (data === null) {
    return res.status(404).json({ error: 'Invalid data type' });
  }
  const index = data.findIndex(i => i.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Item not found' });
  }
  data.splice(index, 1);
  // Remove avatar sidecar file when a character is deleted
  if (type === 'characters' && isSafeId(id)) {
    try {
      const avatarPath = path.join(AVATARS_DIR, id);
      if (fs.existsSync(avatarPath)) fs.unlinkSync(avatarPath);
    } catch {}
  }
  if (writeData(type, data)) {
    res.json({ success: true });
  } else {
    res.status(500).json({ error: 'Failed to delete' });
  }
});

// POST /api/:type/batch-import - Append new items, deduplicated by ID (single read+write)
// Uses a higher body limit to handle large batches with base64 avatars.
app.post('/api/:type/batch-import', (req, res) => {
  const { type } = req.params;
  if (!FILES[type]) {
    return res.status(404).json({ error: 'Invalid data type' });
  }
  if (!Array.isArray(req.body)) {
    return res.status(400).json({ error: 'Body must be an array' });
  }
  const existing = readData(type) || [];
  const existingIds = new Set(existing.map(i => i.id));
  const newItems = req.body
    .filter(item => item && typeof item === 'object' && !Array.isArray(item))
    .filter(item => !existingIds.has(item.id))
    .map(item => ({ ...item, updatedAt: Date.now() }));
  const merged = [...existing, ...newItems];
  if (writeData(type, merged)) {
    res.json({ success: true, imported: newItems.length, skipped: req.body.length - newItems.length });
  } else {
    res.status(500).json({ error: 'Failed to save' });
  }
});

// POST /api/:type/batch - Batch update (replace all)
app.post('/api/:type/batch', (req, res) => {
  const { type } = req.params;
  if (!FILES[type]) {
    return res.status(404).json({ error: 'Invalid data type' });
  }
  // Validate that body is an array of objects
  if (!Array.isArray(req.body)) {
    return res.status(400).json({ error: 'Body must be an array' });
  }
  if (!req.body.every(item => item && typeof item === 'object' && !Array.isArray(item))) {
    return res.status(400).json({ error: 'Each item must be an object' });
  }
  if (writeData(type, req.body)) {
    res.json({ success: true, count: req.body.length });
  } else {
    res.status(500).json({ error: 'Failed to save' });
  }
});

// GET /api/status - Server status
app.get('/api/status', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    dataTypes: Object.keys(FILES),
  });
});

// Serve built frontend in production (when dist/ exists)
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  // SPA fallback — serve index.html for any non-API route
  app.get('{*splat}', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(distPath, 'index.html'));
    }
  });
}

// Start server
initializeStorage();
app.listen(PORT, '0.0.0.0', () => {
  const mode = fs.existsSync(distPath) ? 'production' : 'API-only';
  console.log(`\n🚀 Parlor running in ${mode} mode on port ${PORT}`);
  console.log(`📡 Connect from devices using: http://<your-ip>:${PORT}`);

  // Auto-open in browser
  const url = `http://localhost:${PORT}`;
  const { exec } = require('child_process');
  const platform = process.platform;
  if (platform === 'win32') exec(`start "" "${url}"`);
  else if (platform === 'darwin') exec(`open "${url}"`);
  else exec(`xdg-open "${url}"`);
  console.log(`💻 Local access: http://localhost:${PORT}\n`);
});