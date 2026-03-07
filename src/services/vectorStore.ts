// Vector store service for RAG — offline TF-IDF embeddings stored in IndexedDB

const DB_NAME = 'parlor-vectors';
const DB_VERSION = 1;
const STORE_NAME = 'embeddings';
const VECTOR_DIM = 128;

interface EmbeddingEntry {
  messageId: string;
  chatId: string;
  embedding: number[];
  text: string;
}

// ---------------------------------------------------------------------------
// IndexedDB helpers
// ---------------------------------------------------------------------------

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'messageId' });
        store.createIndex('chatId', 'chatId', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txPromise<T>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const request = fn(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ---------------------------------------------------------------------------
// Tokenization & hashing
// ---------------------------------------------------------------------------

/** Basic tokenizer: lowercase, strip non-alphanumeric, split on whitespace. */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

/**
 * Simple FNV-1a-inspired hash that maps a string to a bucket in [0, dim).
 * Deterministic and fast.
 */
function hashToken(token: string, dim: number): number {
  let h = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < token.length; i++) {
    h ^= token.charCodeAt(i);
    h = Math.imul(h, 0x01000193); // FNV prime
  }
  return ((h >>> 0) % dim);
}

// ---------------------------------------------------------------------------
// Embedding & similarity
// ---------------------------------------------------------------------------

/**
 * Produce a 128-dimensional embedding using hash-based feature hashing.
 * Each token is hashed to a bucket and the count at that bucket is incremented.
 * The resulting vector is L2-normalised so cosine similarity works correctly.
 */
export function embedText(text: string): number[] {
  const vec = new Array<number>(VECTOR_DIM).fill(0);
  const tokens = tokenize(text);

  for (const token of tokens) {
    const idx = hashToken(token, VECTOR_DIM);
    vec[idx] += 1;
  }

  // L2 normalise
  let norm = 0;
  for (let i = 0; i < VECTOR_DIM; i++) {
    norm += vec[i] * vec[i];
  }
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < VECTOR_DIM; i++) {
      vec[i] /= norm;
    }
  }

  return vec;
}

/** Standard cosine similarity between two vectors of equal length. */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Embed `text` and persist the entry in IndexedDB. */
export async function storeEmbedding(
  chatId: string,
  messageId: string,
  text: string,
): Promise<void> {
  const truncated = text.slice(0, 400);
  const embedding = embedText(truncated);
  const entry: EmbeddingEntry = { messageId, chatId, embedding, text: truncated };

  const db = await openDB();
  await txPromise(db, 'readwrite', (store) => store.put(entry));
  db.close();
}

/**
 * Search for the `topK` most similar stored messages in a given chat.
 *
 * Accepts one or more query texts — the final score for each candidate is the
 * maximum similarity across all query embeddings. This lets callers pass e.g.
 * the last few user messages to broaden recall.
 */
export async function searchSimilar(
  chatId: string,
  queryTexts: string[],
  topK: number = 5,
): Promise<{ messageId: string; text: string; score: number }[]> {
  const queryEmbeddings = queryTexts.map((t) => embedText(t.slice(0, 400)));

  const db = await openDB();
  const entries = await new Promise<EmbeddingEntry[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('chatId');
    const req = index.getAll(chatId);
    req.onsuccess = () => resolve(req.result as EmbeddingEntry[]);
    req.onerror = () => reject(req.error);
  });
  db.close();

  const scored = entries.map((entry) => {
    let best = -Infinity;
    for (const qe of queryEmbeddings) {
      const sim = cosineSimilarity(qe, entry.embedding);
      if (sim > best) best = sim;
    }
    return { messageId: entry.messageId, text: entry.text, score: best };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

/** Remove all stored embeddings for a single chat. */
export async function clearChatEmbeddings(chatId: string): Promise<void> {
  const db = await openDB();
  const entries = await new Promise<EmbeddingEntry[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('chatId');
    const req = index.getAll(chatId);
    req.onsuccess = () => resolve(req.result as EmbeddingEntry[]);
    req.onerror = () => reject(req.error);
  });

  if (entries.length > 0) {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      for (const entry of entries) {
        store.delete(entry.messageId);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  db.close();
}

/** Remove every embedding across all chats. */
export async function clearAllEmbeddings(): Promise<void> {
  const db = await openDB();
  await txPromise(db, 'readwrite', (store) => store.clear());
  db.close();
}
