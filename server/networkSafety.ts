const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/**
 * Check whether a hostname is local, private, link-local, or otherwise not
 * publicly routable. This is intentionally conservative because the result is
 * used for server-side fetches and outbound webhooks.
 */
export function isPrivateOrLocalHostname(hostname: string): boolean {
  const host = hostname
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '');
  if (!host) return true;
  if (host === 'localhost' || host === '0.0.0.0' || host === '::' || host === '::1') return true;
  if (host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.lan')) return true;
  if (host === 'metadata.google.internal') return true;

  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const p1 = parseInt(ipv4[1], 10);
    const p2 = parseInt(ipv4[2], 10);
    if (p1 === 10 || p1 === 127 || p1 === 0) return true;
    if (p1 === 100 && p2 >= 64 && p2 <= 127) return true;
    if (p1 === 169 && p2 === 254) return true;
    if (p1 === 172 && p2 >= 16 && p2 <= 31) return true;
    if (p1 === 192 && p2 === 168) return true;
  }

  if (host.includes(':')) {
    const mapped = host.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
    if (mapped) return isPrivateOrLocalHostname(mapped[1]);
    const mappedHex = host.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (mappedHex) {
      const high = parseInt(mappedHex[1], 16);
      const low = parseInt(mappedHex[2], 16);
      return isPrivateOrLocalHostname(
        [(high >> 8) & 255, high & 255, (low >> 8) & 255, low & 255].join('.'),
      );
    }
    const first = host.split(':')[0];
    if (
      first.startsWith('fc') ||
      first.startsWith('fd') ||
      first.startsWith('fe8') ||
      first.startsWith('fe9') ||
      first.startsWith('fea') ||
      first.startsWith('feb')
    ) {
      return true;
    }
  }

  return false;
}

export interface PublicUrlOptions {
  httpsOnly?: boolean;
  allowCredentials?: boolean;
}

/**
 * Parse and validate a URL that a server-side integration is allowed to call.
 * Throws a user-readable error when the target is unsafe.
 */
export function requirePublicUrl(rawUrl: string, options: PublicUrlOptions = {}): URL {
  let parsed: URL;
  try {
    parsed = new URL(String(rawUrl || '').trim());
  } catch {
    throw new Error('Enter a valid HTTP or HTTPS URL.');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only HTTP and HTTPS URLs are supported.');
  }
  if (options.httpsOnly && parsed.protocol !== 'https:') {
    throw new Error('This integration requires an HTTPS URL.');
  }
  if (!options.allowCredentials && (parsed.username || parsed.password)) {
    throw new Error('URLs with embedded credentials are not allowed.');
  }
  if (isPrivateOrLocalHostname(parsed.hostname)) {
    throw new Error('Local and private network URLs are not allowed.');
  }
  return parsed;
}

/**
 * Fetch a URL while validating every redirect target. Redirects are followed
 * manually so a public URL cannot bounce the server into a private network.
 */
export async function fetchWithSafeRedirects(
  targetUrl: string,
  init: RequestInit,
  maxRedirects = 5,
): Promise<Response> {
  let current = new URL(targetUrl);
  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    if (current.protocol !== 'http:' && current.protocol !== 'https:') {
      throw new Error(`Unsupported redirect protocol: ${current.protocol}`);
    }
    if (current.username || current.password) {
      throw new Error('Redirects with embedded credentials are not allowed');
    }
    if (isPrivateOrLocalHostname(current.hostname)) {
      throw new Error('Redirect to a local or private network URL is not allowed');
    }

    const response = await fetch(current.toString(), {
      ...init,
      redirect: 'manual',
    });

    if (REDIRECT_STATUSES.has(response.status)) {
      const location = response.headers.get('location');
      if (!location) return response;
      current = new URL(location, current);
      continue;
    }
    return response;
  }
  throw new Error('Too many redirects');
}

/**
 * Read a response body with a hard byte limit. Prevents a remote file from
 * exhausting server memory even when Content-Length is absent or misleading.
 */
export async function readResponseBuffer(
  response: Response,
  maxBytes: number,
): Promise<{ buffer: Buffer; truncated: boolean }> {
  const contentLength = Number(response.headers.get('content-length') || 0);
  if (contentLength > maxBytes) {
    throw new Error(`Response is too large (limit ${Math.round(maxBytes / 1024 / 1024)} MB).`);
  }
  if (!response.body) return { buffer: Buffer.alloc(0), truncated: false };

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let truncated = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        truncated = true;
        await reader.cancel().catch(() => undefined);
        break;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return { buffer: Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))), truncated };
}
