import { Router } from 'express';
import fs from 'node:fs';
import { resolve } from 'node:path';
import { getBackendApiKey } from '../apiCatalog.js';
import { fetchWithSafeRedirects, readResponseBuffer, requirePublicUrl } from '../networkSafety.js';
import { errorResponse } from '../shared.js';

export const integrationsRouter = Router();

const MAX_WEBHOOK_BODY = 20000;
const MAX_EMAIL_BODY = 50000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SENDER_PATTERN = /^(?:(.{1,80}?)\s*<([^<>\s@]+@[^<>\s@]+\.[^<>\s@]+)>|([^<>\s@]+@[^<>\s@]+\.[^<>\s@]+))$/;
const DEFAULT_EMAIL_FROM = 'NEXUS Automation <onboarding@resend.dev>';

const DATA_DIR = resolve(process.cwd(), 'data');
const INTEGRATION_CONFIG_FILE = resolve(DATA_DIR, 'integrations.json');

interface IntegrationConfig {
  emailFrom?: string;
}

let cachedConfig: IntegrationConfig | null = null;

function loadIntegrationConfig(): IntegrationConfig {
  if (cachedConfig) return cachedConfig;
  try {
    if (!fs.existsSync(INTEGRATION_CONFIG_FILE)) {
      cachedConfig = {};
      return cachedConfig;
    }
    const raw = JSON.parse(fs.readFileSync(INTEGRATION_CONFIG_FILE, 'utf8')) as unknown;
    cachedConfig = raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as IntegrationConfig)
      : {};
  } catch (err) {
    console.warn('[Integrations] Failed to load config:', err);
    cachedConfig = {};
  }
  return cachedConfig;
}

function saveIntegrationConfig(config: IntegrationConfig): void {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tempPath = `${INTEGRATION_CONFIG_FILE}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(config, null, 2), {
      encoding: 'utf8',
      mode: 0o600,
    });
    fs.renameSync(tempPath, INTEGRATION_CONFIG_FILE);
    cachedConfig = config;
  } catch (err) {
    console.error('[Integrations] Failed to save config:', err);
    throw new Error('Could not save integration settings.');
  }
}

/**
 * Resolve the sender address. Environment variables take priority over the
 * UI-saved value so deployment configuration remains authoritative.
 */
export function getEffectiveEmailFrom(): {
  from: string;
  source: 'env' | 'config' | 'default';
} {
  const envFrom = (process.env.EMAIL_FROM || process.env.RESEND_FROM || '').trim();
  if (envFrom) return { from: envFrom, source: 'env' };
  const saved = (loadIntegrationConfig().emailFrom || '').trim();
  if (saved) return { from: saved, source: 'config' };
  return { from: DEFAULT_EMAIL_FROM, source: 'default' };
}

function normalizeSender(value: unknown): { ok: true; value: string } | { ok: false; error: string } {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return { ok: true, value: '' };
  if (raw.length > 160) return { ok: false, error: 'Sender address is too long (160 characters max).' };
  if (/[\r\n]/.test(raw)) return { ok: false, error: 'Sender address cannot contain line breaks.' };

  const match = raw.match(SENDER_PATTERN);
  if (!match) {
    return {
      ok: false,
      error: 'Use an email address like name@example.com or a display name like NEXUS <name@example.com>.',
    };
  }
  const name = (match[1] || '').trim().replace(/^"|"$/g, '').trim();
  const address = (match[2] || match[3] || '').trim().toLowerCase();
  if (!EMAIL_PATTERN.test(address)) {
    return { ok: false, error: 'Enter a valid sender email address.' };
  }
  return {
    ok: true,
    value: name ? `${name} <${address}>` : address,
  };
}

function cleanText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function parseEmailRecipients(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  const recipients = raw
    .map((item) => cleanText(item, 254).toLowerCase())
    .filter(Boolean);
  return Array.from(new Set(recipients)).slice(0, 5);
}

/**
 * POST /api/integrations/webhook - Deliver an automation result to a public
 * HTTPS webhook. Outbound targets are SSRF-validated and redirect-safe.
 */
integrationsRouter.post('/api/integrations/webhook', async (req, res) => {
  const rawUrl = cleanText(req.body?.url, 1200);
  if (!rawUrl) return errorResponse(res, 400, 'A webhook URL is required.');

  let target: URL;
  try {
    target = requirePublicUrl(rawUrl, { httpsOnly: true });
  } catch (err) {
    return errorResponse(res, 400, err instanceof Error ? err.message : 'Invalid webhook URL.');
  }

  const rawBody = req.body?.body;
  let payload = '';
  let contentType = 'text/plain; charset=utf-8';
  if (rawBody !== undefined) {
    if (typeof rawBody === 'string') {
      payload = rawBody.slice(0, MAX_WEBHOOK_BODY);
      try {
        JSON.parse(payload);
        contentType = 'application/json; charset=utf-8';
      } catch {
        // Keep as plain text.
      }
    } else {
      payload = JSON.stringify(rawBody).slice(0, MAX_WEBHOOK_BODY);
      contentType = 'application/json; charset=utf-8';
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetchWithSafeRedirects(target.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': contentType,
        'User-Agent': 'NEXUS-Automation/1.0 (https://nexus.app)',
      },
      body: payload,
      signal: controller.signal,
    });
    const { buffer } = await readResponseBuffer(response, 4096);
    const responseText = buffer.toString('utf8').slice(0, 2000);
    if (!response.ok) {
      return res.status(502).json({
        ok: false,
        error: `Webhook returned HTTP ${response.status}${responseText ? `: ${responseText}` : ''}`,
      });
    }
    return res.json({
      ok: true,
      data: {
        url: target.toString(),
        status: response.status,
        response: responseText,
      },
    });
  } catch (err: unknown) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    return res.status(aborted ? 504 : 502).json({
      ok: false,
      error: aborted
        ? 'Webhook delivery timed out.'
        : err instanceof Error
          ? err.message
          : 'Webhook delivery failed.',
    });
  } finally {
    clearTimeout(timeout);
  }
});

/**
 * POST /api/integrations/email - Send an automation result through Resend.
 * The API key stays server-side. Configure RESEND_API_KEY and EMAIL_FROM.
 */
integrationsRouter.post('/api/integrations/email', async (req, res) => {
  const recipients = parseEmailRecipients(req.body?.to);
  if (recipients.length === 0) return errorResponse(res, 400, 'Enter at least one recipient email address.');
  const invalid = recipients.find((recipient) => !EMAIL_PATTERN.test(recipient));
  if (invalid) return errorResponse(res, 400, `Invalid recipient email: ${invalid}`);

  const subject = cleanText(req.body?.subject, 180) || 'NEXUS Automation result';
  const body = cleanText(req.body?.body, MAX_EMAIL_BODY);
  if (!body) return errorResponse(res, 400, 'Email body is empty.');

  const apiKey =
    process.env.RESEND_API_KEY ||
    getBackendApiKey('RESEND_API_KEY');
  if (!apiKey) {
    return errorResponse(
      res,
      503,
      'Email is not configured. Add RESEND_API_KEY and EMAIL_FROM on the server.',
    );
  }
  const from = getEffectiveEmailFrom().from;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: recipients,
        subject,
        text: body,
      }),
      signal: controller.signal,
    });
    const payload = (await response.json().catch(() => ({}))) as {
      id?: string;
      message?: string;
      error?: { message?: string };
    };
    if (!response.ok) {
      const message = payload.message || payload.error?.message || `HTTP ${response.status}`;
      return res.status(502).json({ ok: false, error: `Email delivery failed: ${message}` });
    }
    return res.json({
      ok: true,
      data: {
        id: payload.id || '',
        recipients,
        subject,
      },
    });
  } catch (err: unknown) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    return res.status(aborted ? 504 : 502).json({
      ok: false,
      error: aborted
        ? 'Email delivery timed out.'
        : err instanceof Error
          ? err.message
          : 'Email delivery failed.',
    });
  } finally {
    clearTimeout(timeout);
  }
});

/**
 * GET /api/integrations/email-config - Current sender configuration.
 */
integrationsRouter.get('/api/integrations/email-config', (_req, res) => {
  const effective = getEffectiveEmailFrom();
  res.json({
    data: {
      emailFrom: effective.source === 'config' ? effective.from : '',
      effectiveFrom: effective.from,
      source: effective.source,
      defaultFrom: DEFAULT_EMAIL_FROM,
    },
  });
});

/**
 * POST /api/integrations/email-config - Save the sender used for automation
 * email. An empty value clears the saved sender and falls back to env/default.
 */
integrationsRouter.post('/api/integrations/email-config', (req, res) => {
  const normalized = normalizeSender(req.body?.from);
  if (!normalized.ok) return errorResponse(res, 400, normalized.error);
  try {
    const config = { ...loadIntegrationConfig(), emailFrom: normalized.value || undefined };
    if (!normalized.value) delete config.emailFrom;
    saveIntegrationConfig(config);
    const effective = getEffectiveEmailFrom();
    return res.json({
      data: {
        emailFrom: normalized.value,
        effectiveFrom: effective.from,
        source: effective.source,
        defaultFrom: DEFAULT_EMAIL_FROM,
      },
    });
  } catch (err) {
    return errorResponse(res, 500, err instanceof Error ? err.message : 'Could not save sender address.');
  }
});

/**
 * GET /api/integrations/status - Tells the UI whether delivery is configured.
 */
integrationsRouter.get('/api/integrations/status', (_req, res) => {
  const effective = getEffectiveEmailFrom();
  res.json({
    data: {
      webhook: true,
      email: Boolean(process.env.RESEND_API_KEY || getBackendApiKey('RESEND_API_KEY')),
      emailFromConfigured: effective.source !== 'default',
      emailFromSource: effective.source,
      emailFrom: effective.from,
    },
  });
});

export default integrationsRouter;
