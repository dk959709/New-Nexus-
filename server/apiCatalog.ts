import crypto from 'node:crypto';
import fs from 'node:fs';
import { resolve } from 'node:path';
import { Router, type Request, type Response } from 'express';
import { errorResponse } from './shared.js';

const ALGORITHM = 'aes-256-gcm';
const DATA_DIR = resolve(process.cwd(), 'data');
const SECRET_FILE = resolve(DATA_DIR, '.catalog_secret');
const CATALOG_FILE = resolve(DATA_DIR, 'api_catalog.json');

// Ensure storage directory exists
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
  }
} catch (e) {
  console.warn('[ApiCatalog] Failed to create data dir:', e);
}

// Get or initialize secure 32-byte encryption key
function getEncryptionSecret(): Buffer {
  if (process.env.CATALOG_ENCRYPTION_SECRET && process.env.CATALOG_ENCRYPTION_SECRET.length >= 32) {
    return crypto.createHash('sha256').update(process.env.CATALOG_ENCRYPTION_SECRET).digest();
  }

  try {
    if (fs.existsSync(SECRET_FILE)) {
      const raw = fs.readFileSync(SECRET_FILE, 'utf8').trim();
      if (raw.length === 64) {
        return Buffer.from(raw, 'hex');
      }
    }
  } catch (err) {
    console.warn('[ApiCatalog] Error reading secret file:', err);
  }

  const newSecret = crypto.randomBytes(32);
  try {
    fs.writeFileSync(SECRET_FILE, newSecret.toString('hex'), { mode: 0o600 });
  } catch (err) {
    console.warn('[ApiCatalog] Could not persist secret file:', err);
  }
  return newSecret;
}

const secretKey = getEncryptionSecret();

export function encryptValue(plainText: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, secretKey, iv);
  let encrypted = cipher.update(plainText.trim(), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

export function decryptValue(cipherPayload: string): string | null {
  try {
    const parts = cipherPayload.split(':');
    if (parts.length !== 3) return null;
    const [ivHex, authTagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, secretKey, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.warn('[ApiCatalog] Decryption error:', err);
    return null;
  }
}

export function maskApiKey(key: string): string {
  const trimmed = key.trim();
  if (!trimmed) return '';
  if (trimmed.length <= 4) return '••••' + trimmed;
  const last4 = trimmed.slice(-4);
  const maskLen = Math.min(12, Math.max(4, trimmed.length - 4));
  return '•'.repeat(maskLen) + last4;
}

export interface CatalogItemDefinition {
  id: string;
  name: string;
  envVar: string;
  fallbackEnvVars?: string[];
  description: string;
  docsUrl: string;
  category: 'news' | 'search' | 'weather' | 'space' | 'media' | 'general';
}

export const PREDEFINED_CATALOG: CatalogItemDefinition[] = [
  {
    id: 'gnews',
    name: 'GNews API',
    envVar: 'GNEWS_API_KEY',
    description: 'High-relevance global breaking news headlines, full articles, and publisher metadata.',
    docsUrl: 'https://gnews.io',
    category: 'news',
  },
  {
    id: 'newsdata',
    name: 'NewsData.io',
    envVar: 'NEWSDATA_API_KEY',
    description: 'Real-time multi-country news feed and secondary fallback intelligence layer.',
    docsUrl: 'https://newsdata.io',
    category: 'news',
  },
  {
    id: 'tavily',
    name: 'Tavily Web Search',
    envVar: 'SEARCH_API_KEY',
    fallbackEnvVars: ['TAVILY_API_KEY'],
    description: 'Real-time AI-optimized search engine for deep factual research and web grounding.',
    docsUrl: 'https://tavily.com',
    category: 'search',
  },
  {
    id: 'openweathermap',
    name: 'OpenWeatherMap',
    envVar: 'WEATHER_API_KEY',
    fallbackEnvVars: ['MAP_API_KEY'],
    description: 'Real-time weather data, forecasts, and live meteorological radar/satellite map tiles.',
    docsUrl: 'https://openweathermap.org/api',
    category: 'weather',
  },
  {
    id: 'nasa',
    name: 'NASA Open APIs',
    envVar: 'NASA_API_KEY',
    description: 'Astronomy Picture of the Day (APOD), Mars Rover photography, and cosmic space feeds.',
    docsUrl: 'https://api.nasa.gov',
    category: 'space',
  },
  {
    id: 'pexels',
    name: 'Pexels API',
    envVar: 'PEXELS_API_KEY',
    description: 'Curated library of high-resolution abstract, cosmic, and cyberpunk landscape wallpapers.',
    docsUrl: 'https://www.pexels.com/api',
    category: 'media',
  },
  {
    id: 'pixabay',
    name: 'Pixabay API',
    envVar: 'PIXABAY_API_KEY',
    description: 'Royalty-free photos, vector illustrations, and media for visual cards.',
    docsUrl: 'https://pixabay.com/api/docs/',
    category: 'media',
  },
  {
    id: 'exa',
    name: 'Exa.ai Neural Search',
    envVar: 'EXA_API_KEY',
    description: 'Neural semantic web search engine for high-density academic and deep-topic synthesis.',
    docsUrl: 'https://exa.ai',
    category: 'search',
  },
];

interface StoredCatalogRecord {
  id: string;
  name?: string;
  envVar?: string;
  description?: string;
  docsUrl?: string;
  encryptedKey: string;
  last4: string;
  createdAt: string;
  updatedAt: string;
  isCustom?: boolean;
}

type CatalogStore = Record<string, StoredCatalogRecord>;

function loadCatalogStore(): CatalogStore {
  try {
    if (fs.existsSync(CATALOG_FILE)) {
      const raw = fs.readFileSync(CATALOG_FILE, 'utf8');
      return JSON.parse(raw) as CatalogStore;
    }
  } catch (err) {
    console.warn('[ApiCatalog] Error reading catalog file:', err);
  }
  return {};
}

function saveCatalogStore(store: CatalogStore): void {
  try {
    fs.writeFileSync(CATALOG_FILE, JSON.stringify(store, null, 2), { mode: 0o600 });
  } catch (err) {
    console.warn('[ApiCatalog] Error saving catalog file:', err);
  }
}

/**
 * Core runtime lookup:
 * 1. Checks process.env (Render / System environment variables take priority)
 * 2. If not found or empty, checks the secure catalog storage layer
 */
export function getBackendApiKey(envVarOrId: string): string | undefined {
  if (!envVarOrId) return undefined;
  const target = envVarOrId.trim();

  // 1. Direct process.env check by envVar name
  if (process.env[target] && process.env[target]!.trim()) {
    return process.env[target]!.trim();
  }

  // Check known predefined mapping (e.g. if passed 'gnews' or 'GNEWS_API_KEY')
  const def = PREDEFINED_CATALOG.find(
    (item) => item.id === target || item.envVar === target || item.fallbackEnvVars?.includes(target),
  );

  if (def) {
    if (process.env[def.envVar] && process.env[def.envVar]!.trim()) {
      return process.env[def.envVar]!.trim();
    }
    if (def.fallbackEnvVars) {
      for (const fallback of def.fallbackEnvVars) {
        if (process.env[fallback] && process.env[fallback]!.trim()) {
          return process.env[fallback]!.trim();
        }
      }
    }
  }

  // 2. Fall back to secure UI-saved storage layer
  const store = loadCatalogStore();

  // Try direct lookup by ID or envVar
  let record = store[target];
  if (!record && def) {
    record = store[def.id] || store[def.envVar];
  }

  if (!record) {
    // Search by envVar match in store
    const matched = Object.values(store).find((r) => r.envVar === target);
    if (matched) record = matched;
  }

  if (record && record.encryptedKey) {
    const decrypted = decryptValue(record.encryptedKey);
    if (decrypted && decrypted.trim()) {
      return decrypted.trim();
    }
  }

  return undefined;
}

export interface CatalogItemResponse {
  id: string;
  name: string;
  envVar: string;
  fallbackEnvVars?: string[];
  description: string;
  docsUrl: string;
  category: string;
  status: 'connected' | 'not_configured';
  source: 'env' | 'catalog' | 'none';
  maskedKey?: string;
  updatedAt?: string;
  isCustom: boolean;
}

export function listCatalogItems(): CatalogItemResponse[] {
  const store = loadCatalogStore();
  const results: CatalogItemResponse[] = [];

  // 1. Predefined APIs
  for (const def of PREDEFINED_CATALOG) {
    let key = '';
    let source: 'env' | 'catalog' | 'none' = 'none';

    // Check process.env first
    if (process.env[def.envVar] && process.env[def.envVar]!.trim()) {
      key = process.env[def.envVar]!.trim();
      source = 'env';
    } else if (def.fallbackEnvVars?.some((v) => process.env[v] && process.env[v]!.trim())) {
      const foundVar = def.fallbackEnvVars.find((v) => process.env[v] && process.env[v]!.trim())!;
      key = process.env[foundVar]!.trim();
      source = 'env';
    } else {
      // Check stored
      const stored = store[def.id] || store[def.envVar];
      if (stored && stored.encryptedKey) {
        const decrypted = decryptValue(stored.encryptedKey);
        if (decrypted) {
          key = decrypted;
          source = 'catalog';
        }
      }
    }

    const isConnected = Boolean(key && key.trim().length > 0);
    const storedRec = store[def.id] || store[def.envVar];

    results.push({
      id: def.id,
      name: def.name,
      envVar: def.envVar,
      fallbackEnvVars: def.fallbackEnvVars,
      description: def.description,
      docsUrl: def.docsUrl,
      category: def.category,
      status: isConnected ? 'connected' : 'not_configured',
      source,
      maskedKey: isConnected ? maskApiKey(key) : undefined,
      updatedAt: storedRec?.updatedAt,
      isCustom: false,
    });
  }

  // 2. Custom APIs added by user
  for (const [id, record] of Object.entries(store)) {
    if (PREDEFINED_CATALOG.some((p) => p.id === id || p.envVar === id)) {
      continue;
    }
    const envKey = record.envVar ? process.env[record.envVar] : undefined;
    let key = '';
    let source: 'env' | 'catalog' | 'none' = 'none';

    if (envKey && envKey.trim()) {
      key = envKey.trim();
      source = 'env';
    } else if (record.encryptedKey) {
      const dec = decryptValue(record.encryptedKey);
      if (dec) {
        key = dec;
        source = 'catalog';
      }
    }

    const isConnected = Boolean(key && key.trim().length > 0);

    results.push({
      id,
      name: record.name || id,
      envVar: record.envVar || `${id.toUpperCase()}_API_KEY`,
      description: record.description || 'Custom configured service API.',
      docsUrl: record.docsUrl || '',
      category: 'general',
      status: isConnected ? 'connected' : 'not_configured',
      source,
      maskedKey: isConnected ? maskApiKey(key) : undefined,
      updatedAt: record.updatedAt,
      isCustom: true,
    });
  }

  return results;
}

export function saveCatalogKeyItem(input: {
  id: string;
  key: string;
  name?: string;
  envVar?: string;
  description?: string;
  docsUrl?: string;
  isCustom?: boolean;
}): { success: boolean; item: CatalogItemResponse } {
  const { id, key } = input;
  const trimmedKey = key.trim();
  if (!trimmedKey) {
    throw new Error('API key value cannot be empty');
  }

  const store = loadCatalogStore();
  const existing = store[id] || {};
  const predefined = PREDEFINED_CATALOG.find((p) => p.id === id || p.envVar === id);

  const encryptedKey = encryptValue(trimmedKey);
  const now = new Date().toISOString();

  const record: StoredCatalogRecord = {
    id,
    name: input.name || predefined?.name || existing.name || id,
    envVar: input.envVar || predefined?.envVar || existing.envVar || `${id.toUpperCase()}_API_KEY`,
    description: input.description || predefined?.description || existing.description || '',
    docsUrl: input.docsUrl || predefined?.docsUrl || existing.docsUrl || '',
    encryptedKey,
    last4: trimmedKey.slice(-4),
    createdAt: existing.createdAt || now,
    updatedAt: now,
    isCustom: Boolean(input.isCustom ?? (!predefined && (existing.isCustom || true))),
  };

  store[id] = record;
  saveCatalogStore(store);

  // Return the updated item
  const all = listCatalogItems();
  const updated = all.find((item) => item.id === id) || {
    id,
    name: record.name || id,
    envVar: record.envVar || id,
    description: record.description || '',
    docsUrl: record.docsUrl || '',
    category: 'general',
    status: 'connected',
    source: 'catalog',
    maskedKey: maskApiKey(trimmedKey),
    updatedAt: now,
    isCustom: Boolean(record.isCustom),
  };

  return { success: true, item: updated };
}

export function deleteCatalogKeyItem(id: string): { success: boolean } {
  const store = loadCatalogStore();
  if (store[id]) {
    delete store[id];
    saveCatalogStore(store);
    return { success: true };
  }
  // Also check if stored by envVar
  for (const [key, record] of Object.entries(store)) {
    if (record.envVar === id) {
      delete store[key];
      saveCatalogStore(store);
      return { success: true };
    }
  }
  return { success: true };
}

/**
 * Lightweight ping tester for key validity
 */
export async function testServiceApiKey(id: string): Promise<{ success: boolean; message: string }> {
  const key = getBackendApiKey(id);
  if (!key) {
    return { success: false, message: 'No API key configured for this service.' };
  }

  const normalized = id.toLowerCase();
  try {
    if (normalized === 'gnews' || normalized === 'gnews_api_key') {
      const res = await fetch(`https://gnews.io/api/v4/top-headlines?category=general&max=1&apikey=${key}`, {
        signal: AbortSignal.timeout(6000),
      });
      if (res.ok) return { success: true, message: 'GNews API connection verified successfully!' };
      if (res.status === 401 || res.status === 403) return { success: false, message: 'Invalid GNews API Key (401/403).' };
      if (res.status === 429) return { success: true, message: 'Valid key, but daily rate limit reached (100 req/day).' };
      return { success: false, message: `GNews returned HTTP ${res.status}.` };
    }

    if (normalized === 'newsdata' || normalized === 'newsdata_api_key') {
      const res = await fetch(`https://newsdata.io/api/1/latest?apikey=${key}&q=news&size=1`, {
        signal: AbortSignal.timeout(6000),
      });
      if (res.ok) return { success: true, message: 'NewsData.io API connection verified successfully!' };
      if (res.status === 401 || res.status === 403) return { success: false, message: 'Invalid NewsData.io API Key (401/403).' };
      if (res.status === 429) return { success: true, message: 'Valid key, but NewsData rate limit reached.' };
      return { success: false, message: `NewsData returned HTTP ${res.status}.` };
    }

    if (normalized === 'tavily' || normalized === 'search_api_key' || normalized === 'tavily_api_key') {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: key, query: 'test ping', max_results: 1 }),
        signal: AbortSignal.timeout(6000),
      });
      if (res.ok) return { success: true, message: 'Tavily Search API connection verified successfully!' };
      if (res.status === 401 || res.status === 403) return { success: false, message: 'Invalid Tavily API Key (401/403).' };
      return { success: false, message: `Tavily returned HTTP ${res.status}.` };
    }

    if (normalized === 'nasa' || normalized === 'nasa_api_key') {
      const res = await fetch(`https://api.nasa.gov/planetary/apod?api_key=${key}`, {
        signal: AbortSignal.timeout(6000),
      });
      if (res.ok) return { success: true, message: 'NASA Open API connection verified successfully!' };
      if (res.status === 403) return { success: false, message: 'Invalid NASA API Key (403).' };
      return { success: false, message: `NASA API returned HTTP ${res.status}.` };
    }

    if (normalized === 'pexels' || normalized === 'pexels_api_key') {
      const res = await fetch('https://api.pexels.com/v1/curated?per_page=1', {
        headers: { Authorization: key },
        signal: AbortSignal.timeout(6000),
      });
      if (res.ok) return { success: true, message: 'Pexels API connection verified successfully!' };
      if (res.status === 401) return { success: false, message: 'Invalid Pexels API Key (401).' };
      return { success: false, message: `Pexels returned HTTP ${res.status}.` };
    }

    if (normalized === 'pixabay' || normalized === 'pixabay_api_key') {
      const res = await fetch(`https://pixabay.com/api/?key=${key}&q=nature&per_page=3`, {
        signal: AbortSignal.timeout(6000),
      });
      if (res.ok) return { success: true, message: 'Pixabay API connection verified successfully!' };
      if (res.status === 400 || res.status === 401) return { success: false, message: 'Invalid Pixabay API Key.' };
      return { success: false, message: `Pixabay returned HTTP ${res.status}.` };
    }

    if (normalized === 'exa' || normalized === 'exa_api_key') {
      const res = await fetch('https://api.exa.ai/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': key },
        body: JSON.stringify({ query: 'test', numResults: 1 }),
        signal: AbortSignal.timeout(6000),
      });
      if (res.ok) return { success: true, message: 'Exa.ai API connection verified successfully!' };
      if (res.status === 401 || res.status === 403) return { success: false, message: 'Invalid Exa API Key.' };
      return { success: false, message: `Exa returned HTTP ${res.status}.` };
    }

    // Default generic test
    return { success: true, message: 'Key is formatted and securely stored in catalog.' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: `Connection test error: ${msg}` };
  }
}

export const apiCatalogRouter = Router();

apiCatalogRouter.get('/api/catalog', (_req: Request, res: Response) => {
  try {
    const items = listCatalogItems();
    return res.json({ ok: true, apis: items });
  } catch (err) {
    return errorResponse(res, 500, (err as Error).message);
  }
});

apiCatalogRouter.post('/api/catalog/keys', (req: Request, res: Response) => {
  try {
    const { id, key, name, envVar, description, docsUrl, isCustom } = req.body || {};
    if (!id || typeof id !== 'string' || !id.trim()) {
      return errorResponse(res, 400, 'API identifier (id) is required.');
    }
    if (!key || typeof key !== 'string' || !key.trim()) {
      return errorResponse(res, 400, 'API key value is required.');
    }

    const result = saveCatalogKeyItem({
      id: id.trim().toLowerCase(),
      key: key.trim(),
      name: typeof name === 'string' ? name.trim() : undefined,
      envVar: typeof envVar === 'string' ? envVar.trim().toUpperCase() : undefined,
      description: typeof description === 'string' ? description.trim() : undefined,
      docsUrl: typeof docsUrl === 'string' ? docsUrl.trim() : undefined,
      isCustom: Boolean(isCustom),
    });

    return res.json({ ok: true, data: result.item, message: 'API key securely saved to catalog.' });
  } catch (err) {
    return errorResponse(res, 500, (err as Error).message);
  }
});

apiCatalogRouter.delete('/api/catalog/keys/:id', (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    if (!id) return errorResponse(res, 400, 'ID is required.');
    deleteCatalogKeyItem(id);
    return res.json({ ok: true, message: 'Key removed from catalog storage.' });
  } catch (err) {
    return errorResponse(res, 500, (err as Error).message);
  }
});

apiCatalogRouter.post('/api/catalog/test/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    if (!id) return errorResponse(res, 400, 'ID is required.');
    const result = await testServiceApiKey(id);
    return res.json({ ok: true, ...result });
  } catch (err) {
    return errorResponse(res, 500, (err as Error).message);
  }
});
