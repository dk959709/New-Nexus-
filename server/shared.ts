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
  if (!url) return '';

  // Remove trailing slashes
  while (url.endsWith('/')) {
    url = url.slice(0, -1);
  }

  // If already ending with /chat/completions, return as-is
  if (url.endsWith('/chat/completions')) {
    return url;
  }

  // If URL ends with /chat, append /completions
  if (url.endsWith('/chat')) {
    return `${url}/completions`;
  }

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname.replace(/\/+$/, '');

    // Cloudflare AI Gateway (e.g. gateway.ai.cloudflare.com/v1/{account}/{gateway}/workers-ai)
    if (host === 'gateway.ai.cloudflare.com') {
      if (pathname.endsWith('/workers-ai')) {
        return `${parsed.origin}${pathname}/chat/completions`;
      }
      return `${url}/chat/completions`;
    }

    // Mistral API (api.mistral.ai)
    if (host === 'api.mistral.ai' || host.endsWith('.mistral.ai')) {
      if (!pathname || pathname === '' || pathname === '/') {
        return `${parsed.origin}/v1/chat/completions`;
      }
      if (pathname === '/v1') {
        return `${parsed.origin}/v1/chat/completions`;
      }
      return `${url}/chat/completions`;
    }

    // OpenRouter (openrouter.ai)
    if (host === 'openrouter.ai' || host.endsWith('.openrouter.ai')) {
      if (!pathname || pathname === '' || pathname === '/') {
        return `${parsed.origin}/api/v1/chat/completions`;
      }
      if (pathname === '/api' || pathname === '/api/v1') {
        return `${parsed.origin}/api/v1/chat/completions`;
      }
      return `${url}/chat/completions`;
    }

    // Groq (api.groq.com)
    if (host === 'api.groq.com') {
      if (!pathname || pathname === '' || pathname === '/') {
        return `${parsed.origin}/openai/v1/chat/completions`;
      }
      if (pathname === '/openai/v1' || pathname === '/v1') {
        return `${parsed.origin}${pathname}/chat/completions`;
      }
      return `${url}/chat/completions`;
    }

    // OpenAI (api.openai.com)
    if (host === 'api.openai.com') {
      if (!pathname || pathname === '' || pathname === '/') {
        return `${parsed.origin}/v1/chat/completions`;
      }
      if (pathname === '/v1') {
        return `${parsed.origin}/v1/chat/completions`;
      }
      return `${url}/chat/completions`;
    }

    // DeepSeek (api.deepseek.com)
    if (host === 'api.deepseek.com') {
      if (!pathname || pathname === '' || pathname === '/') {
        return `${parsed.origin}/chat/completions`;
      }
      if (pathname === '/v1') {
        return `${parsed.origin}/v1/chat/completions`;
      }
      return `${url}/chat/completions`;
    }

    // Perplexity (api.perplexity.ai)
    if (host === 'api.perplexity.ai') {
      if (!pathname || pathname === '' || pathname === '/') {
        return `${parsed.origin}/chat/completions`;
      }
      return `${url}/chat/completions`;
    }

    // Standard OpenAI-compatible endpoints ending in /v1, /openai/v1, /v1beta
    if (
      pathname.endsWith('/v1') ||
      pathname.endsWith('/openai/v1') ||
      pathname.endsWith('/v1beta')
    ) {
      return `${url}/chat/completions`;
    }

    // Bare origin / host with no path (e.g. http://localhost:11434)
    if (!pathname || pathname === '' || pathname === '/') {
      return `${url}/v1/chat/completions`;
    }

    // Any other custom endpoint URL without /chat/completions
    return `${url}/chat/completions`;
  } catch {
    if (url.endsWith('/v1')) {
      return `${url}/chat/completions`;
    }
    return `${url}/chat/completions`;
  }
}
