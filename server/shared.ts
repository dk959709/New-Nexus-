import type { Response } from 'express';

export function errorResponse(res: Response, status: number, message: string) {
  return res.status(status).json({ error: message });
}

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function normalizeProviderUrl(rawUrl?: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  let url = rawUrl.trim();
  if (url.endsWith('/')) {
    url = url.slice(0, -1);
  }
  return url;
}
