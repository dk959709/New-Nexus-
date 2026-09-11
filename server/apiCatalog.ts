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

export function maskApiKey(key: string | undefined): string {
  if (!key) return '(not configured)';
  const trimmed = key.trim();
  if (!trimmed) return '(empty)';
  if (trimmed.length <= 4) return '••••' + trimmed + ` (len: ${trimmed.length})`;
  const last4 = trimmed.slice(-4);
  const maskLen = Math.min(8, Math.max(4, trimmed.length - 4));
  return '•'.repeat(maskLen) + last4 + ` (len: ${trimmed.length})`;
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

export function isNoAuthPlaceholder(val?: string | null): boolean {
  if (!val) return true;
  const t = val.trim().toLowerCase();
  return (
    t === '' ||
    t === 'none' ||
    t === 'test' ||
    t === 'no_auth' ||
    t === 'noauth' ||
    t === 'no-auth' ||
    t === 'na' ||
    t === 'n/a' ||
    t === 'null' ||
    t === 'empty' ||
    t === 'no-key' ||
    t === 'nokey' ||
    t === 'false' ||
    t === 'not_required' ||
    t === 'public' ||
    t === 'free'
  );
}

interface StoredCatalogRecord {
  id: string;
  name?: string;
  envVar?: string;
  description?: string;
  docsUrl?: string;
  baseUrl?: string;
  queryParamName?: string;
  noAuth?: boolean;
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

/**
 * Runtime lookup with source details (Render process.env vs API Catalog Store)
 */
export function getBackendApiKeyDetail(envVarOrId: string): { key: string | undefined; source: string; masked: string } {
  if (!envVarOrId) return { key: undefined, source: 'none', masked: '(not configured)' };
  const target = envVarOrId.trim();

  // 1. Direct process.env check by envVar name
  if (process.env[target] && process.env[target]!.trim()) {
    const k = process.env[target]!.trim();
    return { key: k, source: `process.env.${target}`, masked: maskApiKey(k) };
  }

  // Check known predefined mapping
  const def = PREDEFINED_CATALOG.find(
    (item) => item.id === target || item.envVar === target || item.fallbackEnvVars?.includes(target),
  );

  if (def) {
    if (process.env[def.envVar] && process.env[def.envVar]!.trim()) {
      const k = process.env[def.envVar]!.trim();
      return { key: k, source: `process.env.${def.envVar}`, masked: maskApiKey(k) };
    }
    if (def.fallbackEnvVars) {
      for (const fallback of def.fallbackEnvVars) {
        if (process.env[fallback] && process.env[fallback]!.trim()) {
          const k = process.env[fallback]!.trim();
          return { key: k, source: `process.env.${fallback}`, masked: maskApiKey(k) };
        }
      }
    }
  }

  // 2. Fall back to secure UI-saved storage layer
  const store = loadCatalogStore();
  let record = store[target];
  if (!record && def) {
    record = store[def.id] || store[def.envVar];
  }
  if (!record) {
    const matched = Object.values(store).find((r) => r.envVar === target);
    if (matched) record = matched;
  }

  if (record && record.encryptedKey) {
    const decrypted = decryptValue(record.encryptedKey);
    if (decrypted && decrypted.trim()) {
      const k = decrypted.trim();
      return { key: k, source: `API Catalog Store (${record.id || record.envVar})`, masked: maskApiKey(k) };
    }
  }

  return { key: undefined, source: 'not found in env or catalog', masked: '(not configured)' };
}

export interface CatalogItemResponse {
  id: string;
  name: string;
  envVar: string;
  fallbackEnvVars?: string[];
  description: string;
  docsUrl: string;
  baseUrl?: string;
  queryParamName?: string;
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
      baseUrl: storedRec?.baseUrl,
      queryParamName: storedRec?.queryParamName || 'q',
      category: def.category,
      status: isConnected ? 'connected' : 'not_configured',
      source,
      // Security policy: Never expose any part of Render environment variables
      maskedKey: isConnected ? (source === 'env' ? '••••••••••••••••' : maskApiKey(key)) : undefined,
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

    const isNoAuth = Boolean(record.noAuth || isNoAuthPlaceholder(key));
    const isConnected = isNoAuth || Boolean(key && key.trim().length > 0);

    results.push({
      id,
      name: record.name || id,
      envVar: record.envVar || `${id.toUpperCase()}_API_KEY`,
      description: record.description || 'Custom configured service API.',
      docsUrl: record.docsUrl || '',
      baseUrl: record.baseUrl,
      queryParamName: record.queryParamName || 'q',
      category: 'general',
      status: isConnected ? 'connected' : 'not_configured',
      source,
      maskedKey: isNoAuth
        ? 'No Auth Required'
        : isConnected
        ? (source === 'env' ? '••••••••••••••••' : maskApiKey(key))
        : undefined,
      updatedAt: record.updatedAt,
      isCustom: true,
      noAuth: isNoAuth,
    });
  }

  return results;
}

export function saveCatalogKeyItem(input: {
  id: string;
  key?: string;
  name?: string;
  envVar?: string;
  description?: string;
  docsUrl?: string;
  baseUrl?: string;
  queryParamName?: string;
  isCustom?: boolean;
  noAuth?: boolean;
}): { success: boolean; item: CatalogItemResponse } {
  const { id } = input;
  const isNoAuth = Boolean(input.noAuth || isNoAuthPlaceholder(input.key));
  const rawKey = input.key !== undefined ? input.key.trim() : '';
  if (!isNoAuth && !rawKey) {
    throw new Error('API key value cannot be empty (or enable "No Authentication Required")');
  }

  const effectiveKey = rawKey || (isNoAuth ? 'none' : '');
  const encryptedKey = encryptValue(effectiveKey);
  const now = new Date().toISOString();

  const store = loadCatalogStore();
  const existing = store[id] || {};
  const predefined = PREDEFINED_CATALOG.find((p) => p.id === id || p.envVar === id);

  const record: StoredCatalogRecord = {
    id,
    name: input.name || predefined?.name || existing.name || id,
    envVar: input.envVar || predefined?.envVar || existing.envVar || `${id.toUpperCase()}_API_KEY`,
    description: input.description || predefined?.description || existing.description || '',
    docsUrl: input.docsUrl || predefined?.docsUrl || existing.docsUrl || '',
    baseUrl: input.baseUrl !== undefined ? input.baseUrl.trim() : existing.baseUrl,
    queryParamName: input.queryParamName !== undefined ? (input.queryParamName.trim() || 'q') : (existing.queryParamName || 'q'),
    noAuth: isNoAuth,
    encryptedKey,
    last4: isNoAuth ? 'none' : effectiveKey.slice(-4),
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
    baseUrl: record.baseUrl,
    queryParamName: record.queryParamName || 'q',
    category: 'general',
    status: 'connected',
    source: 'catalog',
    maskedKey: isNoAuth ? 'No Auth Required' : maskApiKey(effectiveKey),
    updatedAt: now,
    isCustom: Boolean(record.isCustom),
    noAuth: isNoAuth,
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
      const masked = maskApiKey(key);
      const res = await fetch(`https://gnews.io/api/v4/top-headlines?category=general&max=1&apikey=${key}`, {
        signal: AbortSignal.timeout(6000),
      });
      if (res.ok) {
        console.log(`[ApiCatalog GNews Test] Success (HTTP 200) [Key: ${masked}]`);
        return { success: true, message: `GNews API connection verified successfully! [Key: ${masked}]` };
      }
      let bodyText = '';
      try {
        bodyText = await res.text();
      } catch {
        bodyText = '';
      }
      console.warn(`[ApiCatalog GNews Test Failed] HTTP ${res.status}: ${bodyText} [Key: ${masked}]`);
      if (res.status === 401 || res.status === 403) return { success: false, message: `Invalid GNews API Key (HTTP ${res.status}): ${bodyText || 'Unauthorized'} [Key: ${masked}]` };
      if (res.status === 429) return { success: true, message: `Valid key, but daily rate limit reached (HTTP 429): ${bodyText || '100 req/day'} [Key: ${masked}]` };
      return { success: false, message: `GNews returned HTTP ${res.status}: ${bodyText || res.statusText} [Key: ${masked}]` };
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

    // Check if custom or stored record has a configured Base URL to test
    const store = loadCatalogStore();
    const storedRec = store[id] || store[normalized] || Object.values(store).find((r) => r.envVar?.toLowerCase() === normalized || r.name?.toLowerCase() === normalized);
    if (storedRec && storedRec.baseUrl) {
      const testCall = await callCustomApi(id, 'test');
      if (testCall.ok) {
        return { success: true, message: `Connection to ${storedRec.name || id} verified successfully (HTTP ${testCall.statusCode || 200})!` };
      }
      return { success: false, message: testCall.error || `HTTP ${testCall.statusCode} from ${storedRec.name || id}` };
    }

    // Default generic test
    return { success: true, message: 'Key is formatted and securely stored in catalog.' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: `Connection test error: ${msg}` };
  }
}

export interface CustomApiCallResult {
  ok: boolean;
  apiName: string;
  envVar: string;
  urlCalled: string;
  statusCode?: number;
  data?: unknown;
  error?: string;
}

/**
 * Generic execution engine for Custom APIs registered in the catalog
 * Appends query parameters, attempts common API key authentication patterns,
 * and returns parsed JSON results.
 */
export async function callCustomApi(
  envIdentifier: string,
  queryText: string,
): Promise<CustomApiCallResult> {
  if (!envIdentifier || typeof envIdentifier !== 'string' || !envIdentifier.trim()) {
    return {
      ok: false,
      apiName: '',
      envVar: '',
      urlCalled: '',
      error: 'Missing custom API identifier.',
    };
  }

  const rawIdent = envIdentifier.trim();
  const lowerIdent = rawIdent.toLowerCase();
  const slugIdent = lowerIdent.replace(/[^a-z0-9]/g, '');

  const store = loadCatalogStore();

  // Find matching record in catalog store
  let record: StoredCatalogRecord | undefined;
  for (const [id, r] of Object.entries(store)) {
    const rId = id.toLowerCase();
    const rName = (r.name || '').toLowerCase();
    const rEnv = (r.envVar || '').toLowerCase();
    const rSlug = rName.replace(/[^a-z0-9]/g, '');

    if (
      rId === lowerIdent ||
      rName === lowerIdent ||
      rEnv === lowerIdent ||
      (slugIdent && rSlug === slugIdent) ||
      rId.replace(/[^a-z0-9]/g, '') === slugIdent
    ) {
      record = r;
      break;
    }
  }

  if (!record) {
    return {
      ok: false,
      apiName: rawIdent,
      envVar: '',
      urlCalled: '',
      error: `Custom API "${rawIdent}" is not registered in the API Catalog. Please register it in Settings > API Catalog with a valid Base URL first.`,
    };
  }

  const apiName = record.name || record.id;
  const envVar = record.envVar || `${record.id.toUpperCase()}_API_KEY`;

  if (!record.baseUrl || !record.baseUrl.trim()) {
    return {
      ok: false,
      apiName,
      envVar,
      urlCalled: '',
      error: `Custom API "${apiName}" does not have a Base URL configured. Please configure its Base URL in Settings > API Catalog.`,
    };
  }

  const apiKey = getBackendApiKey(record.envVar || record.id);
  const isNoAuth = Boolean(
    record.noAuth ||
    !apiKey ||
    !apiKey.trim() ||
    isNoAuthPlaceholder(apiKey)
  );

  if (!isNoAuth && (!apiKey || !apiKey.trim())) {
    return {
      ok: false,
      apiName,
      envVar,
      urlCalled: '',
      error: `No API key configured for custom API "${apiName}". Please configure an API key or enable "No Authentication Required" in Settings > API Catalog.`,
    };
  }

  let parsedUrl: URL;
  try {
    let cleanBaseUrl = record.baseUrl.trim();
    if (!/^https?:\/\//i.test(cleanBaseUrl)) {
      cleanBaseUrl = `https://${cleanBaseUrl}`;
    }
    parsedUrl = new URL(cleanBaseUrl);
  } catch {
    return {
      ok: false,
      apiName,
      envVar,
      urlCalled: record.baseUrl,
      error: `Invalid Base URL format: "${record.baseUrl}". Expected a valid URL (e.g. https://api.chucknorris.io/jokes/search).`,
    };
  }

  let queryParamName = (record.queryParamName && record.queryParamName.trim()) || 'q';
  if (queryParamName === 'q') {
    if (parsedUrl.hostname.includes('chucknorris.io') || parsedUrl.pathname.includes('/jokes/search')) {
      queryParamName = 'query';
    } else {
      for (const [k] of parsedUrl.searchParams.entries()) {
        if (/^(query|q|search|term|keyword|text|s)$/i.test(k)) {
          queryParamName = k;
          break;
        }
      }
    }
  }

  const queryVal = (queryText || '').trim();

  // Helper to build URL
  const buildUrl = (keyParamName: string | null) => {
    const url = new URL(parsedUrl.toString());
    if (queryVal) {
      url.searchParams.set(queryParamName, queryVal);
    }
    if (keyParamName && !isNoAuth && apiKey && apiKey.trim()) {
      url.searchParams.set(keyParamName, apiKey.trim());
    }
    return url;
  };

  // Helper to mask key in URL for logs/display
  const maskUrl = (rawUrl: URL | string) => {
    try {
      const copy = new URL(rawUrl.toString());
      for (const p of ['apikey', 'api_key', 'access_key', 'key', 'token', 'auth', 'secret', 'app_key', 'appid']) {
        if (copy.searchParams.has(p)) {
          copy.searchParams.set(p, '••••••••');
        }
      }
      if (apiKey && apiKey.trim().length > 2 && !isNoAuth) {
        for (const [k, v] of copy.searchParams.entries()) {
          if (v === apiKey.trim() || v.includes(apiKey.trim())) {
            copy.searchParams.set(k, '••••••••');
          }
        }
      }
      return copy.toString();
    } catch {
      return String(rawUrl);
    }
  };

  const patterns: Array<{ keyParam: string | null; useBearer: boolean }> = isNoAuth
    ? [{ keyParam: null, useBearer: false }]
    : [
        { keyParam: 'apikey', useBearer: false },
        { keyParam: 'access_key', useBearer: false },
        { keyParam: 'api_key', useBearer: false },
        { keyParam: 'key', useBearer: false },
        { keyParam: null, useBearer: true },
      ];

  let lastStatus = 0;
  let lastError = '';
  let lastUrl = '';

  for (let i = 0; i < patterns.length; i++) {
    const pattern = patterns[i];
    const targetUrl = buildUrl(pattern.keyParam);
    lastUrl = maskUrl(targetUrl);

    console.log(`[CustomAPI] Outgoing request to: ${lastUrl} (isNoAuth: ${isNoAuth})`);

    const headers: Record<string, string> = {
      'Accept': 'application/json, text/plain, */*',
      'User-Agent': 'Nexus-Intelligence/1.0',
    };
    if (pattern.useBearer && !isNoAuth && apiKey && apiKey.trim()) {
      headers['Authorization'] = `Bearer ${apiKey.trim()}`;
    }

    try {
      const response = await fetch(targetUrl.toString(), {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(12000),
      });

      lastStatus = response.status;
      const rawText = await response.text();
      let jsonData: unknown = null;
      try {
        jsonData = JSON.parse(rawText);
      } catch {
        if (!response.ok) {
          const errDetail = `HTTP ${response.status} from ${lastUrl}: ${rawText.slice(0, 300) || response.statusText}`;
          console.warn(`[CustomAPI] Non-JSON error: ${errDetail}`);
          if ((response.status === 401 || response.status === 403) && !isNoAuth && i < patterns.length - 1) {
            lastError = errDetail;
            continue;
          }
          return {
            ok: false,
            apiName,
            envVar,
            urlCalled: lastUrl,
            statusCode: response.status,
            error: errDetail,
          };
        }
        return {
          ok: true,
          apiName,
          envVar,
          urlCalled: lastUrl,
          statusCode: response.status,
          data: { rawResponse: rawText.slice(0, 10000) },
        };
      }

      const jsonRec = jsonData && typeof jsonData === 'object' ? (jsonData as Record<string, unknown>) : null;
      const jsonErr = jsonRec && typeof jsonRec.error === 'object' ? (jsonRec.error as Record<string, unknown>) : null;

      const isAuthError =
        !isNoAuth &&
        (response.status === 401 ||
         response.status === 403 ||
         (jsonRec && jsonRec.success === false && jsonErr && /key|auth|unauthorized|access_key/i.test(String(jsonErr.type || jsonErr.info || ''))));

      if (isAuthError && i < patterns.length - 1) {
        lastError = (jsonErr && typeof jsonErr.info === 'string' ? jsonErr.info : undefined) || `HTTP ${response.status} Authentication Failure with ${pattern.keyParam || 'Bearer'}`;
        continue;
      }

      if (!response.ok) {
        const detailMsg =
          jsonRec?.message ||
          (jsonErr && jsonErr.info) ||
          jsonRec?.error ||
          jsonRec?.detail ||
          rawText.slice(0, 200) ||
          `HTTP ${response.status}`;

        const formattedError = `HTTP ${response.status} from ${lastUrl}: ${typeof detailMsg === 'string' ? detailMsg : JSON.stringify(detailMsg)}`;
        console.warn(`[CustomAPI] Call failed for "${apiName}": ${formattedError}`);

        if ((response.status === 401 || response.status === 403) && !isNoAuth && i < patterns.length - 1) {
          lastError = formattedError;
          continue;
        }

        return {
          ok: false,
          apiName,
          envVar,
          urlCalled: lastUrl,
          statusCode: response.status,
          data: jsonData,
          error: formattedError,
        };
      }

      return {
        ok: true,
        apiName,
        envVar,
        urlCalled: lastUrl,
        statusCode: response.status,
        data: jsonData,
      };
    } catch (fetchErr: unknown) {
      const errObj = fetchErr instanceof Error ? fetchErr : null;
      if (errObj && (errObj.name === 'TimeoutError' || errObj.name === 'AbortError')) {
        const timeoutMsg = `Request to ${lastUrl} timed out after 12 seconds. The endpoint may be down or unreachable.`;
        console.warn(`[CustomAPI] ${timeoutMsg}`);
        return {
          ok: false,
          apiName,
          envVar,
          urlCalled: lastUrl,
          error: timeoutMsg,
        };
      }
      lastError = `Failed to connect to ${lastUrl}: ${errObj ? errObj.message : String(fetchErr)}`;
      console.warn(`[CustomAPI] Connection error: ${lastError}`);
      if (!isNoAuth && i < patterns.length - 1) continue;
    }
  }

  return {
    ok: false,
    apiName,
    envVar,
    urlCalled: lastUrl,
    statusCode: lastStatus || undefined,
    error: lastError || `Failed to establish connection to ${lastUrl}`,
  };
}

export const apiCatalogRouter = Router();

apiCatalogRouter.get('/api/catalog', (_req: Request, res: Response) => {
  try {
    const items = listCatalogItems();
    return res.json({ ok: true, apis: items, data: items });
  } catch (err) {
    return errorResponse(res, 500, (err as Error).message);
  }
});

apiCatalogRouter.get('/api/catalog/keys/:id/reveal', (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    if (!id) return errorResponse(res, 400, 'ID is required.');

    // Security policy: Render environment variables must NEVER leave the server or be revealable
    const isPredefined = PREDEFINED_CATALOG.some(
      (p) => p.id === id || p.envVar === id || p.fallbackEnvVars?.includes(id),
    );

    const store = loadCatalogStore();
    const record = store[id];

    if (isPredefined || !record || !record.isCustom) {
      return errorResponse(
        res,
        403,
        'Security policy: Render environment variables cannot be revealed or retrieved from the server.',
      );
    }

    if (!record.encryptedKey && !record.noAuth) {
      return errorResponse(res, 404, 'No API key configured for this custom service.');
    }

    const decrypted = decryptValue(record.encryptedKey);
    return res.json({ ok: true, key: decrypted || 'none' });
  } catch (err) {
    return errorResponse(res, 500, (err as Error).message);
  }
});

apiCatalogRouter.post('/api/catalog/custom-call', async (req: Request, res: Response) => {
  try {
    const { api, query } = req.body || {};
    if (!api || typeof api !== 'string') {
      return errorResponse(res, 400, 'API identifier (api) is required.');
    }
    const result = await callCustomApi(api, typeof query === 'string' ? query : '');
    return res.json(result);
  } catch (err) {
    return errorResponse(res, 500, (err as Error).message);
  }
});

apiCatalogRouter.post('/api/catalog/keys', (req: Request, res: Response) => {
  try {
    const { id, key, name, envVar, description, docsUrl, baseUrl, queryParamName, isCustom, noAuth } = req.body || {};
    if (!id || typeof id !== 'string' || !id.trim()) {
      return errorResponse(res, 400, 'API identifier (id) is required.');
    }
    const isNoAuth = Boolean(noAuth || isNoAuthPlaceholder(key));
    if (!isNoAuth && (!key || typeof key !== 'string' || !key.trim())) {
      return errorResponse(res, 400, 'API key value is required (or enable No Authentication Required).');
    }
    if (isCustom && (!baseUrl || typeof baseUrl !== 'string' || !baseUrl.trim())) {
      return errorResponse(res, 400, 'Base URL is required for custom APIs.');
    }

    const result = saveCatalogKeyItem({
      id: id.trim().toLowerCase(),
      key: typeof key === 'string' ? key.trim() : '',
      name: typeof name === 'string' ? name.trim() : undefined,
      envVar: typeof envVar === 'string' ? envVar.trim().toUpperCase() : undefined,
      description: typeof description === 'string' ? description.trim() : undefined,
      docsUrl: typeof docsUrl === 'string' ? docsUrl.trim() : undefined,
      baseUrl: typeof baseUrl === 'string' ? baseUrl.trim() : undefined,
      queryParamName: typeof queryParamName === 'string' ? queryParamName.trim() : undefined,
      isCustom: Boolean(isCustom),
      noAuth: isNoAuth,
    });

    return res.json({ ok: true, data: result.item, item: result.item, message: 'API key securely saved to catalog.' });
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
