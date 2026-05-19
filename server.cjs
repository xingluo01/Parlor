/**
 * Parlor REST API Server
 * A simple server-first storage solution for syncing data across devices
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
let PORT = process.env.PORT || 3001;

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
  groupChats: path.join(DATA_DIR, 'group-chats.json'),
  databank: path.join(DATA_DIR, 'databank.json'),
  characterMarkets: path.join(DATA_DIR, 'character-markets.json'),
  novels: path.join(DATA_DIR, 'novels.json'),
  authorNotes: path.join(DATA_DIR, 'author-notes.json'),
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
    // regexes 由后面的特定初始化处理（示例脚本带默认值，不能先写 [] 覆盖）
    if (file === FILES.regexes || file === FILES.authorNotes) continue;
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, '[]');
    }
  }

  // 正则脚本：初始化示例脚本（禁用状态，用户可自行启用）
  const regexFile = FILES.regexes;
  if (!fs.existsSync(regexFile)) {
    const now = Date.now();
    const sampleScripts = [
      {
        id: 'sample-markdown-bold',
        name: '示例：转换 **粗体** 为「粗体」',
        findRegex: '\\*\\*(.+?)\\*\\*',
        replaceString: '「$1」',
        flags: '',
        enabled: false,
        applyTo: 'output',
        order: 0,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'sample-merge-blank-lines',
        name: '示例：合并多余换行',
        findRegex: '\\n{3,}',
        replaceString: '\\n\\n',
        flags: '',
        enabled: false,
        applyTo: 'output',
        order: 1,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'sample-clean-cjk-spaces',
        name: '示例：清除中文间多余空格',
        findRegex: '([\\u4e00-\\u9fff])\\s+([\\u4e00-\\u9fff])',
        replaceString: '$1$2',
        flags: '',
        enabled: false,
        applyTo: 'both',
        order: 2,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'sample-quote-normalize',
        name: '示例：中文引号标准化',
        findRegex: '"([^"]+)"',
        replaceString: '「$1」',
        flags: '',
        enabled: false,
        applyTo: 'output',
        order: 3,
        createdAt: now,
        updatedAt: now,
      },
    ];
    fs.writeFileSync(regexFile, JSON.stringify(sampleScripts, null, 2));
  }

  // ===== 作者备注预设 =====
  const authorNotesFile = FILES.authorNotes;
  if (!fs.existsSync(authorNotesFile)) {
    const now = Date.now();
    const defaultPresets = [
      {
        id: 'preset-status-basic',
        name: '状态栏 - 基础格式',
        content: `你必须严格遵守以下格式，在每次回复末尾输出状态块，不得遗漏：

-[状态]-
[场所: |时间: ]
[身体状况: 生理/心理]
[服装: 上衣/下装/内衣/内裤]`,
        enabled: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'preset-status-detailed',
        name: '状态栏 - 详细版',
        content: `你必须严格遵守以下格式，在每次回复末尾输出完整状态块，不得遗漏：

-[状态]-
[场所: |时间: ]
[身份证: 姓名/性别/年龄/职业/种族/身高/胸围/腰围/臀围]
[身体状况: 生理/心理]
[身体: 头部/胸部/腹部/下体/四肢]
[服装: 头饰/上衣/内衣/腹装/下装/内裤/鞋子]`,
        enabled: false,
        createdAt: now,
        updatedAt: now,
      },
    ];
    fs.writeFileSync(authorNotesFile, JSON.stringify(defaultPresets, null, 2));
  }

  // One-time migration: move any inline base64 avatars out of characters.json
  // into sidecar files. Safe to re-run — it's a no-op if already migrated.
  try {
    const raw = fs.readFileSync(FILES.characters, 'utf-8');
    if (raw.includes('"avatar"')) {
      const chars = JSON.parse(raw);
      const slim = chars.map(extractAvatar);
      fs.writeFileSync(FILES.characters, JSON.stringify(slim));
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
    // 文件不存在→静默初始化为空数组，避免后台刷错
    if (error.code === 'ENOENT') {
      const file = FILES[type];
      if (file) {
        fs.writeFileSync(file, '[]');
        dataCache[type] = { data: [], mtime: Date.now() };
      }
      return [];
    }
    console.debug(`Error reading ${type}:`, error);
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
      console.error('写入头像文件失败:', e.message);
    }
  } else if (char.avatar === null || char.avatar === undefined) {
    // avatar 为 null/undefined 表示无头像数据，不清除已有文件
    // 只有显式设置 avatar = '' 才表示"清空头像"（但这种用法应避免）
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
    fs.writeFileSync(file, JSON.stringify(dataToWrite));
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
  // Compact novels: strip content and parseData for fast list loading
  if (req.query.compact === 'true' && type === 'novels') {
    data = data.map(({ content: _c, parseData: _pd, ...rest }) => rest);
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

// GET /api/sync/manifest - Returns {type: [{id, updatedAt}]} for sync
app.get('/api/sync/manifest', (req, res) => {
  const manifest = {};
  for (const type of Object.keys(FILES)) {
    const data = readData(type);
    if (Array.isArray(data)) {
      manifest[type] = data.map(item => ({ id: item.id, updatedAt: item.updatedAt || 0 }));
    }
  }
  res.json(manifest);
});

// POST /api/sync/pull - Given {type: [id, ...]} returns {type: [fullItem, ...]}
app.post('/api/sync/pull', (req, res) => {
  const request = req.body; // { characters: ["id1","id2"], chats: ["id3"], ... }
  const result = {};
  for (const [type, ids] of Object.entries(request)) {
    if (!FILES[type] || !Array.isArray(ids)) continue;
    const data = readData(type);
    if (!Array.isArray(data)) continue;
    const idSet = new Set(ids);
    let items = data.filter(item => idSet.has(item.id));
    // Inject avatars for characters
    if (type === 'characters') {
      items = items.map(item => {
        const avatar = readAvatar(item.id);
        return avatar ? { ...item, avatar } : item;
      });
    }
    result[type] = items;
  }
  res.json(result);
});

// POST /api/sync/push - Merge incoming items by updatedAt (newer wins)
app.post('/api/sync/push', (req, res) => {
  const incoming = req.body; // { characters: [fullItem, ...], chats: [...], ... }
  const stats = {};
  for (const [type, items] of Object.entries(incoming)) {
    if (!FILES[type] || !Array.isArray(items)) continue;
    const existing = readData(type) || [];
    const existingMap = new Map(existing.map(i => [i.id, i]));
    let added = 0, updated = 0;
    for (const item of items) {
      if (!item || !item.id) continue;
      const local = existingMap.get(item.id);
      if (!local) {
        existingMap.set(item.id, item);
        added++;
      } else if ((item.updatedAt || 0) > (local.updatedAt || 0)) {
        existingMap.set(item.id, { ...local, ...item });
        updated++;
      }
    }
    if (added > 0 || updated > 0) {
      writeData(type, Array.from(existingMap.values()));
    }
    stats[type] = { added, updated };
  }
  res.json({ success: true, stats });
});

// Serve built frontend in production (when dist/ exists)
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  // SPA fallback — serve index.html for any non-API route
  app.get('{*splat}', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.sendFile(path.join(distPath, 'index.html'));
    }
  });
}

// 通用 HTTP 代理 - 用于前端绕过 CORS 获取外部角色卡资源
app.get('/api/proxy/fetch', async (req, res) => {
  const { url } = req.query;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  // 安全检查：只允许 http/https URL
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15s 超时

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Parlor/1.0',
      },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return res.status(response.status).json({ error: `Upstream ${response.status}` });
    }

    const contentType = response.headers.get('content-type') || '';
    res.set('Content-Type', contentType);

    if (contentType.includes('json')) {
      const data = await response.json();
      res.json(data);
    } else if (contentType.includes('image/png') || contentType.includes('image/webp')) {
      // 图片数据转 base64 返回
      const buffer = await response.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      res.json({ data: `data:${contentType};base64,${base64}`, contentType });
    } else {
      const text = await response.text();
      res.send(text);
    }
  } catch (e) {
    if (e.name === 'AbortError') {
      res.status(504).json({ error: 'Request timeout' });
    } else {
      res.status(500).json({ error: e.message || 'Proxy fetch failed' });
    }
  }
});

// ===== 百度翻译 API 代理 =====
const TRANSLATION_CACHE_FILE = path.join(DATA_DIR, 'translations.json');
let translationCache = {};

// 启动时加载翻译缓存
try {
  if (fs.existsSync(TRANSLATION_CACHE_FILE)) {
    translationCache = JSON.parse(fs.readFileSync(TRANSLATION_CACHE_FILE, 'utf-8'));
  }
} catch (e) {
  console.warn('翻译缓存加载失败，将重新创建:', e.message);
}

// 保存翻译缓存
function saveTranslationCache() {
  try {
    // 只保留最近 1000 条防止无限增长
    const keys = Object.keys(translationCache);
    if (keys.length > 1000) {
      const trimmed = {};
      const recentKeys = keys.slice(-1000);
      for (const k of recentKeys) {
        trimmed[k] = translationCache[k];
      }
      translationCache = trimmed;
    }
    fs.writeFileSync(TRANSLATION_CACHE_FILE, JSON.stringify(translationCache, null, 2));
  } catch (e) {
    console.error('保存翻译缓存失败:', e.message);
  }
}

app.post('/api/translate', express.json({ limit: '1mb' }), async (req, res) => {
  try {
    const { text, from = 'auto', to = 'zh', apiUrl, appId, secretKey } = req.body;

    if (!text || !appId || !secretKey) {
      return res.status(400).json({ error: '缺少必要参数：text, appId, secretKey' });
    }

    // 生成本地缓存键
    const cacheKey = `${from}:${to}:${text}`;

    // 检查缓存
    if (translationCache[cacheKey]) {
      return res.json({ translated: translationCache[cacheKey], cached: true });
    }

    // 调用翻译 API
    const salt = Date.now().toString();
    const sign = crypto.createHash('md5')
      .update(appId + text + salt + secretKey)
      .digest('hex');

    // 使用用户配置的 API 地址，或默认百度翻译地址
    const translateUrl = apiUrl || 'https://fanyi-api.baidu.com/api/trans/vip/translate';
    const params = new URLSearchParams({
      q: text,
      from,
      to,
      appid: appId,
      salt,
      sign,
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(translateUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const data = await response.json();

    if (data.error_code) {
      return res.status(400).json({ error: `翻译API错误 [${data.error_code}]: ${data.error_msg || '未知错误'}` });
    }

    // 提取翻译结果
    const translated = data.trans_result?.map(r => r.dst).join('\n') || '';
    if (!translated) {
      return res.status(500).json({ error: '翻译结果为空' });
    }

    // 写入缓存
    translationCache[cacheKey] = translated;
    saveTranslationCache();

    res.json({ translated, cached: false });
  } catch (error) {
    console.error('翻译失败:', error);
    res.status(500).json({ error: '翻译请求失败: ' + (error.message || '未知错误') });
  }
});

// Start server
initializeStorage();

// 检测端口占用
function checkPort(port) {
  return new Promise((resolve) => {
    const testServer = require('net').createServer();
    testServer.once('error', () => resolve(false));
    testServer.once('listening', () => {
      testServer.close();
      resolve(true);
    });
    testServer.listen(port, '0.0.0.0');
  });
}

// 在 listen 之前检测端口
checkPort(PORT).then(available => {
  if (!available) {
    console.log(`\n⚠️  Port ${PORT} is already in use.`);
    console.log(`   Trying port ${PORT + 1}...\n`);
    PORT = PORT + 1;
  }
  const server = app.listen(PORT, '0.0.0.0', () => {
    const mode = fs.existsSync(distPath) ? 'production' : 'API-only';
    console.log(`\n🚀 Parlor running in ${mode} mode on port ${PORT}`);
    console.log(`📡 Connect from devices using: http://<your-ip>:${PORT}`);

    // Auto-open提示（不自动打开，避免关闭后残留标签页）
    console.log(`💻 Local access: http://localhost:${PORT}\n`);

    // Graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 Shutting down Parlor...');
      server.close(() => {
        console.log('Server closed.');
        process.exit(0);
      });
    });

    process.on('SIGTERM', () => {
      server.close(() => process.exit(0));
    });
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n❌ Port ${PORT} is already in use.`);
      console.error(`   Another instance of Parlor may be running.`);
      console.error(`   Stop it first, or use a different port: PORT=3002 node server.cjs\n`);
    } else {
      console.error('\n❌ Server error:', err.message);
    }
    process.exit(1);
  });
});