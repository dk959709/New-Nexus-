import type { CanvasArtifact } from '@/components/assistant/LiveArtifactCanvas';

export interface DesignTweakState {
  accentColor: string;
  borderRadiusPx: number | null;
  fontScalePct: number;
  spacingScalePct: number;
  surfaceMode: 'inherit' | 'dark' | 'light';
}

export const DEFAULT_DESIGN_TWEAKS: DesignTweakState = {
  accentColor: '',
  borderRadiusPx: null,
  fontScalePct: 100,
  spacingScalePct: 100,
  surfaceMode: 'inherit',
};

export interface MobileSmokeTapTarget {
  tag: string;
  label: string;
  width: number;
  height: number;
}

export interface MobileSmokeBrokenImage {
  src: string;
  alt: string;
}

export interface MobileSmokeReport {
  checkedAt: number;
  viewportWidth: number;
  horizontalOverflowPx: number;
  smallTapTargets: MobileSmokeTapTarget[];
  brokenImages: MobileSmokeBrokenImage[];
  emptyRender: boolean;
  runtimeErrors: string[];
  staticHints: string[];
  source: 'live' | 'static-fallback';
}

export interface SandboxNetworkEntry {
  id: string;
  method: string;
  url: string;
  status: number | string;
  durationMs: number;
  ok: boolean;
  timestamp: number;
}

export interface SandboxStorageEntry {
  key: string;
  value: string;
}

export interface SeoMetaInfo {
  title: string;
  description: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  viewport: string;
  hasLangAttr: boolean;
  hasH1: boolean;
}

export interface CodeOutlineSymbol {
  line: number;
  label: string;
  kind: 'component' | 'function' | 'section' | 'style' | 'heading';
}

export interface ExtractedColorSwatch {
  color: string;
  count: number;
}

export function extractSeoMetaInfo(code: string, titleFallback: string): SeoMetaInfo {
  const safeCode = code || '';
  const titleMatch = safeCode.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const descMatch =
    safeCode.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i) ||
    safeCode.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i);
  const ogTitleMatch =
    safeCode.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["']/i) ||
    safeCode.match(/<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:title["']/i);
  const ogDescMatch =
    safeCode.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["']/i) ||
    safeCode.match(/<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:description["']/i);
  const ogImageMatch =
    safeCode.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']*)["']/i) ||
    safeCode.match(/<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:image["']/i);
  const viewportMatch =
    safeCode.match(/<meta[^>]*name=["']viewport["'][^>]*content=["']([^"']*)["']/i) ||
    safeCode.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']viewport["']/i);

  return {
    title: titleMatch?.[1]?.trim() || titleFallback || 'Untitled Web App',
    description: descMatch?.[1]?.trim() || '',
    ogTitle: ogTitleMatch?.[1]?.trim() || '',
    ogDescription: ogDescMatch?.[1]?.trim() || '',
    ogImage: ogImageMatch?.[1]?.trim() || '',
    viewport: viewportMatch?.[1]?.trim() || '',
    hasLangAttr: /<html[^>]*\blang=/i.test(safeCode),
    hasH1: /<h1[\s>]/i.test(safeCode) || /^\s*#\s+/m.test(safeCode),
  };
}

export function extractColorPalette(code: string): ExtractedColorSwatch[] {
  const matches = (code || '').match(/#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g) || [];
  const counts = new Map<string, number>();
  for (const raw of matches) {
    const normalized = raw.toLowerCase();
    counts.set(normalized, (counts.get(normalized) || 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 16)
    .map(([color, count]) => ({ color, count }));
}

export function extractCodeOutline(code: string, kind: string): CodeOutlineSymbol[] {
  const lines = (code || '').split('\n');
  const symbols: CodeOutlineSymbol[] = [];

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const line = lines[i].trim();
    if (!line) continue;

    // Multi-file project boundary marker
    if (line.startsWith('=== FILE: ') && line.endsWith(' ===')) {
      symbols.push({
        line: lineNum,
        label: line.slice(10, -4).trim(),
        kind: 'section',
      });
      continue;
    }

    // Markdown headings
    if (kind === 'markdown') {
      const md = line.match(/^(#{1,3})\s+(.+)$/);
      if (md) {
        symbols.push({ line: lineNum, label: md[2].trim().slice(0, 48), kind: 'heading' });
      }
      continue;
    }

    // Functions / Components
    const fnMatch = line.match(/^(?:export\s+(?:default\s+)?)?(?:async\s+)?function\s+([A-Za-z0-9_]+)/);
    if (fnMatch) {
      const isComponent = /^[A-Z]/.test(fnMatch[1]);
      symbols.push({
        line: lineNum,
        label: `${fnMatch[1]}()`,
        kind: isComponent ? 'component' : 'function',
      });
      continue;
    }

    const constFnMatch = line.match(/^(?:export\s+)?const\s+([A-Za-z0-9_]+)\s*(?::[^=]+)?=\s*(?:async\s*)?\(/);
    if (constFnMatch) {
      const isComponent = /^[A-Z]/.test(constFnMatch[1]);
      symbols.push({
        line: lineNum,
        label: `${constFnMatch[1]}()`,
        kind: isComponent ? 'component' : 'function',
      });
      continue;
    }

    // Key HTML Landmarks or headings
    const tagMatch = line.match(/^<(header|main|section|nav|footer|form|table|style|script)\b([^>]*)>/i);
    if (tagMatch) {
      const idMatch = tagMatch[2].match(/\bid=["']([^"']+)["']/i);
      symbols.push({
        line: lineNum,
        label: idMatch ? `<${tagMatch[1].toLowerCase()}#${idMatch[1]}>` : `<${tagMatch[1].toLowerCase()}>`,
        kind: tagMatch[1].toLowerCase() === 'style' ? 'style' : 'section',
      });
      continue;
    }

    const hMatch = line.match(/^<(h[1-3])[^>]*>([^<]{2,42})<\/\1>/i);
    if (hMatch) {
      symbols.push({
        line: lineNum,
        label: `${hMatch[1].toUpperCase()}: ${hMatch[2].trim()}`,
        kind: 'heading',
      });
    }
  }

  return symbols.slice(0, 60);
}

export function formatCanvasCode(code: string, kind: string): string {
  const raw = (code || '').replace(/\r\n/g, '\n');
  if (!raw.trim()) return raw;

  if (kind === 'json') {
    try {
      return JSON.stringify(JSON.parse(raw), null, 2);
    } catch {
      return raw;
    }
  }

  // Clean trailing whitespace + normalize excessive blank lines
  const lines = raw.split('\n').map((l) => l.replace(/[ \t]+$/g, ''));
  const compact: string[] = [];
  let blankStreak = 0;
  for (const line of lines) {
    if (!line.trim()) {
      blankStreak += 1;
      if (blankStreak <= 1) compact.push('');
    } else {
      blankStreak = 0;
      compact.push(line);
    }
  }
  return compact.join('\n').trim() + '\n';
}

export function buildDesignTweaksCss(tweaks: DesignTweakState): string {
  const rules: string[] = [];

  if (tweaks.accentColor) {
    rules.push(`
      :root { --nexus-accent: ${tweaks.accentColor}; }
      a { color: ${tweaks.accentColor} !important; }
      input[type="range"], input[type="checkbox"], input[type="radio"] { accent-color: ${tweaks.accentColor} !important; }
      button.bg-cyan-600, button.bg-cyan-500, button.bg-indigo-600, button.bg-blue-600,
      .bg-cyan-600, .bg-cyan-500, .bg-indigo-600, .bg-blue-600 {
        background-color: ${tweaks.accentColor} !important;
        border-color: ${tweaks.accentColor} !important;
      }
      .text-cyan-400, .text-cyan-300, .text-indigo-400, .text-blue-400 {
        color: ${tweaks.accentColor} !important;
      }
    `);
  }

  if (tweaks.borderRadiusPx !== null) {
    const r = Math.max(0, Math.min(28, tweaks.borderRadiusPx));
    rules.push(`
      button, input, select, textarea,
      .rounded, .rounded-md, .rounded-lg, .rounded-xl, .rounded-2xl, .rounded-3xl,
      section, article, .card {
        border-radius: ${r}px !important;
      }
    `);
  }

  if (tweaks.fontScalePct !== 100) {
    rules.push(`
      html { font-size: ${tweaks.fontScalePct}% !important; }
    `);
  }

  if (tweaks.spacingScalePct !== 100) {
    const scale = tweaks.spacingScalePct / 100;
    const pad = Math.round(16 * scale);
    rules.push(`
      body { padding: ${pad}px !important; }
      main, section, article, .space-y-4, .space-y-6 {
        gap: ${(1 * scale).toFixed(2)}rem !important;
      }
    `);
  }

  if (tweaks.surfaceMode === 'light') {
    rules.push(`
      html, body { background: #f8fafc !important; color: #0f172a !important; }
      header, section, article, aside, nav, main > div, .bg-zinc-900, .bg-zinc-950, .bg-slate-900, .bg-slate-950 {
        background-color: #ffffff !important;
        color: #0f172a !important;
        border-color: #e2e8f0 !important;
      }
      p, span, label, td, th, li { color: #334155; }
      h1, h2, h3, h4 { color: #0f172a !important; }
      input, select, textarea {
        background-color: #f1f5f9 !important;
        color: #0f172a !important;
        border-color: #cbd5e1 !important;
      }
    `);
  } else if (tweaks.surfaceMode === 'dark') {
    rules.push(`
      html, body { background: #09090b !important; color: #f4f4f5 !important; }
      header, section, article, aside, .bg-white, .bg-slate-50, .bg-gray-50 {
        background-color: #18181b !important;
        color: #f4f4f5 !important;
        border-color: #27272a !important;
      }
      h1, h2, h3, h4 { color: #fafafa !important; }
    `);
  }

  return rules.join('\n');
}

export function hasActiveDesignTweaks(tweaks: DesignTweakState): boolean {
  return (
    Boolean(tweaks.accentColor) ||
    tweaks.borderRadiusPx !== null ||
    tweaks.fontScalePct !== 100 ||
    tweaks.spacingScalePct !== 100 ||
    tweaks.surfaceMode !== 'inherit'
  );
}

/**
 * Extracts imported identifiers from `lucide-react` and maps them to window.__nexusLucide bindings,
 * then strips module import/export syntax so TypeScript/JSX compiles cleanly via Babel Standalone.
 */
export function prepareReactTsxSource(rawCode: string): string {
  const lucideBindings: string[] = [];
  const seenLocalNames = new Set<string>();

  // 1. Collect destructured imports from lucide-react
  const lucideImportRegex = /^\s*import\s+\{([^}]+)\}\s+from\s+['"]lucide-react['"];?\s*$/gm;
  let match: RegExpExecArray | null;
  while ((match = lucideImportRegex.exec(rawCode)) !== null) {
    const specifiers = match[1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    for (const spec of specifiers) {
      const aliasParts = spec.split(/\s+as\s+/);
      const importedName = aliasParts[0].replace(/^type\s+/, '').trim();
      const localName = (aliasParts[1] || importedName).trim();
      if (importedName && localName && /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(localName) && !seenLocalNames.has(localName)) {
        seenLocalNames.add(localName);
        lucideBindings.push(`const ${localName} = window.__nexusLucide('${importedName}');`);
      }
    }
  }

  // 2. Collect namespace import `import * as Icons from 'lucide-react'`
  const lucideNsRegex = /^\s*import\s+\*\s+as\s+([A-Za-z_$][A-Za-z0-9_$]*)\s+from\s+['"]lucide-react['"];?\s*$/gm;
  while ((match = lucideNsRegex.exec(rawCode)) !== null) {
    const nsName = match[1];
    if (!seenLocalNames.has(nsName)) {
      seenLocalNames.add(nsName);
      lucideBindings.push(`const ${nsName} = window.__nexusLucideProxy;`);
    }
  }

  // 3. Strip TypeScript/ESM imports & normalize exports cleanly
  let cleaned = rawCode
    .replace(/^\s*import\s+type\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '')
    .replace(/^\s*import\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '')
    .replace(/^\s*import\s+['"][^'"]+['"];?\s*$/gm, '')
    .replace(/\bexport\s+default\s+async\s+function\s+([A-Za-z0-9_]+)/g, 'async function $1\nconst DefaultExport = $1;')
    .replace(/\bexport\s+default\s+function\s+([A-Za-z0-9_]+)/g, 'function $1\nconst DefaultExport = $1;')
    .replace(/\bexport\s+default\s+class\s+([A-Za-z0-9_]+)/g, 'class $1\nconst DefaultExport = $1;')
    .replace(/\bexport\s+default\s+/g, 'const DefaultExport = ')
    .replace(/^\s*export\s+(?=(const|let|var|function|async\s+function|class|type|interface|enum)\b)/gm, '');

  // Avoid duplicate `const DefaultExport` declarations if multiple files are concatenated
  let defaultCount = 0;
  cleaned = cleaned.replace(/\bconst\s+DefaultExport\s*=/g, () => {
    defaultCount += 1;
    return defaultCount === 1 ? 'const DefaultExport =' : 'const _UnusedDefaultExport' + defaultCount + ' =';
  });

  if (lucideBindings.length > 0) {
    return `${lucideBindings.join('\n')}\n\n${cleaned}`;
  }
  return cleaned;
}

export function runStaticMobileResponsiveAudit(content: string): string[] {
  const hints: string[] = [];
  const lower = (content || '').toLowerCase();

  if ((lower.includes('<!doctype html') || lower.includes('<html')) && !lower.includes('name="viewport"') && !lower.includes("name='viewport'")) {
    hints.push('Missing <meta name="viewport" content="width=device-width, initial-scale=1.0"> in HTML <head>.');
  }

  if (/\bw-\[(?:[4-9]\d{2}|[1-9]\d{3})px\]/i.test(content) || /\bmin-w-\[(?:[4-9]\d{2}|[1-9]\d{3})px\]/i.test(content)) {
    hints.push('Fixed wide pixel utility class (w-[>=400px]) may cause horizontal scrolling on 375px phones.');
  }

  if (/<table\b/i.test(content) && !/overflow-x-auto|overflow-auto/i.test(content)) {
    hints.push('Detected <table> without an overflow-x-auto scroll container for narrow mobile screens.');
  }

  return hints;
}

export interface BuildSandboxOptions {
  artifact: Pick<CanvasArtifact, 'kind' | 'content' | 'title'>;
  inspectMode: boolean;
  themeCssOverride: string;
  extraCss?: string;
}

/**
 * Builds a complete, runnable HTML document for the sandboxed iframe preview,
 * with Tailwind CSS CDN, TypeScript + React TSX Babel compilation, dynamic Lucide icon proxy,
 * Console Error Bridge, Instant Theme Style Patching, Touch/Mouse Inspector, and Mobile 375px Smoke Check.
 */
export function buildRunnableSandboxHtml({
  artifact,
  inspectMode,
  themeCssOverride,
  extraCss = '',
}: BuildSandboxOptions): string {
  const combinedCss = [extraCss, themeCssOverride].filter(Boolean).join('\n');

  const bridgeScript = `
    <script>
      (function() {
        const origLog = console.log;
        const origWarn = console.warn;
        const origError = console.error;
        function sendToHost(level, args) {
          try {
            const text = Array.from(args).map(function(a) {
              if (a instanceof Error) return a.message || String(a);
              if (typeof a === 'object') {
                try { return JSON.stringify(a); } catch (e) { return String(a); }
              }
              return String(a);
            }).join(' ');
            window.parent.postMessage({ type: 'NEXUS_CANVAS_CONSOLE', level: level, text: text }, '*');
          } catch (e) {}
        }
        console.log = function() { sendToHost('log', arguments); origLog.apply(console, arguments); };
        console.warn = function() { sendToHost('warn', arguments); origWarn.apply(console, arguments); };
        console.error = function() { sendToHost('error', arguments); origError.apply(console, arguments); };
        window.addEventListener('error', function(e) {
          sendToHost('error', [e.message + (e.lineno ? ' (line ' + e.lineno + ')' : '')]);
        });
        window.addEventListener('unhandledrejection', function(e) {
          sendToHost('error', ['Unhandled Promise Rejection: ' + (e.reason && e.reason.message ? e.reason.message : String(e.reason))]);
        });

        // Safe In-Memory Storage Fallback for Opaque Sandbox Iframe Origins
        var __memStorage = {};
        function safeReadAllStorage() {
          var entries = [];
          try {
            if (window.localStorage) {
              for (var k = 0; k < window.localStorage.length; k++) {
                var key = window.localStorage.key(k);
                if (key !== null) {
                  entries.push({ key: key, value: String(window.localStorage.getItem(key) || '').slice(0, 160) });
                }
              }
              return entries;
            }
          } catch (e) {}
          var memKeys = Object.keys(__memStorage);
          for (var m = 0; m < memKeys.length; m++) {
            entries.push({ key: memKeys[m], value: String(__memStorage[memKeys[m]] || '').slice(0, 160) });
          }
          return entries;
        }
        try {
          // Probe native localStorage access
          window.localStorage.getItem('__nexus_probe');
        } catch (storageErr) {
          try {
            Object.defineProperty(window, 'localStorage', {
              configurable: true,
              value: {
                getItem: function(k) { return Object.prototype.hasOwnProperty.call(__memStorage, k) ? __memStorage[k] : null; },
                setItem: function(k, v) { __memStorage[String(k)] = String(v); },
                removeItem: function(k) { delete __memStorage[String(k)]; },
                clear: function() { __memStorage = {}; },
                key: function(idx) { return Object.keys(__memStorage)[idx] || null; },
                get length() { return Object.keys(__memStorage).length; }
              }
            });
          } catch (defineErr) {}
        }

        // Network fetch() monitor
        if (typeof window.fetch === 'function') {
          var origFetch = window.fetch.bind(window);
          window.fetch = function(input, init) {
            var startedAt = Date.now();
            var urlStr = typeof input === 'string' ? input : (input && input.url ? input.url : 'request');
            var methodStr = (init && init.method ? init.method : (input && input.method ? input.method : 'GET')).toUpperCase();
            return origFetch(input, init).then(function(resp) {
              window.parent.postMessage({
                type: 'NEXUS_CANVAS_NET_LOG',
                method: methodStr,
                url: String(urlStr).slice(0, 180),
                status: resp.status,
                ok: resp.ok,
                durationMs: Date.now() - startedAt
              }, '*');
              return resp;
            }).catch(function(err) {
              window.parent.postMessage({
                type: 'NEXUS_CANVAS_NET_LOG',
                method: methodStr,
                url: String(urlStr).slice(0, 180),
                status: 'ERR',
                ok: false,
                durationMs: Date.now() - startedAt
              }, '*');
              throw err;
            });
          };
        }

        // Host <-> Sandbox Bridge (Live Style Patcher, Mobile Smoke Check, Storage & Smart Auto-Fill)
        window.addEventListener('message', function(event) {
          var data = event.data;
          if (!data || typeof data !== 'object') return;

          if (data.type === 'NEXUS_CANVAS_APPLY_STYLE') {
            var styleEl = document.getElementById('nexus-theme-override');
            if (!styleEl) {
              styleEl = document.createElement('style');
              styleEl.id = 'nexus-theme-override';
              (document.head || document.documentElement).appendChild(styleEl);
            }
            styleEl.textContent = String(data.css || '');
            return;
          }

          if (data.type === 'NEXUS_CANVAS_GET_STORAGE') {
            window.parent.postMessage({
              type: 'NEXUS_CANVAS_STORAGE_DATA',
              entries: safeReadAllStorage()
            }, '*');
            return;
          }

          if (data.type === 'NEXUS_CANVAS_CLEAR_STORAGE') {
            try { if (window.localStorage) window.localStorage.clear(); } catch (e) {}
            try { if (window.sessionStorage) window.sessionStorage.clear(); } catch (e) {}
            __memStorage = {};
            window.parent.postMessage({
              type: 'NEXUS_CANVAS_STORAGE_DATA',
              entries: []
            }, '*');
            return;
          }

          if (data.type === 'NEXUS_CANVAS_AUTOFILL_FORMS') {
            try {
              var filledCount = 0;
              var setNativeValue = function(el, value) {
                var proto = el.tagName === 'TEXTAREA'
                  ? window.HTMLTextAreaElement && window.HTMLTextAreaElement.prototype
                  : el.tagName === 'SELECT'
                  ? window.HTMLSelectElement && window.HTMLSelectElement.prototype
                  : window.HTMLInputElement && window.HTMLInputElement.prototype;
                var desc = proto ? Object.getOwnPropertyDescriptor(proto, 'value') : null;
                if (desc && desc.set) {
                  desc.set.call(el, value);
                } else {
                  el.value = value;
                }
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
              };

              var inputs = document.querySelectorAll('input, textarea, select');
              for (var idx = 0; idx < inputs.length; idx++) {
                var field = inputs[idx];
                if (field.disabled || field.readOnly) continue;
                if (field.tagName === 'SELECT') {
                  if (field.options && field.options.length > 1) {
                    setNativeValue(field, field.options[1].value);
                    filledCount += 1;
                  }
                  continue;
                }
                var t = (field.getAttribute('type') || 'text').toLowerCase();
                if (t === 'hidden' || t === 'submit' || t === 'button') continue;
                var hint = ((field.getAttribute('name') || '') + ' ' + (field.getAttribute('placeholder') || '') + ' ' + (field.getAttribute('aria-label') || '')).toLowerCase();
                if (t === 'checkbox' || t === 'radio') {
                  field.checked = true;
                  field.dispatchEvent(new Event('change', { bubbles: true }));
                  filledCount += 1;
                } else if (t === 'email' || hint.includes('email')) {
                  setNativeValue(field, 'alex.morgan@nexus.dev');
                  filledCount += 1;
                } else if (t === 'tel' || hint.includes('phone') || hint.includes('mobile')) {
                  setNativeValue(field, '+1 (555) 234-8910');
                  filledCount += 1;
                } else if (t === 'number' || hint.includes('amount') || hint.includes('price') || hint.includes('count') || hint.includes('qty')) {
                  setNativeValue(field, '42');
                  filledCount += 1;
                } else if (t === 'date') {
                  setNativeValue(field, '2026-11-15');
                  filledCount += 1;
                } else if (t === 'url' || hint.includes('url') || hint.includes('website')) {
                  setNativeValue(field, 'https://example.com');
                  filledCount += 1;
                } else if (hint.includes('name') || hint.includes('title')) {
                  setNativeValue(field, 'Alex Morgan — Q4 Launch');
                  filledCount += 1;
                } else {
                  setNativeValue(field, 'Sample responsive test input');
                  filledCount += 1;
                }
              }
              console.log('Auto-filled ' + filledCount + ' visible form field(s).');
            } catch (autoErr) {}
            return;
          }

          if (data.type === 'NEXUS_CANVAS_SMOKE_CHECK') {
            try {
              var vw = window.innerWidth || document.documentElement.clientWidth || 375;
              var sw = document.documentElement.scrollWidth || vw;
              var overflowPx = Math.max(0, Math.round(sw - vw));

              var interactive = document.querySelectorAll('button, a, input:not([type="hidden"]), select, textarea, [role="button"]');
              var smallTargets = [];
              for (var i = 0; i < interactive.length; i++) {
                var el = interactive[i];
                var rect = el.getBoundingClientRect();
                if (rect.width <= 0 || rect.height <= 0) continue;
                var style = window.getComputedStyle(el);
                if (style.display === 'none' || style.visibility === 'hidden') continue;
                if (rect.height < 40) {
                  var rawLabel = (el.innerText || el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.getAttribute('title') || '').trim().replace(/\\s+/g, ' ');
                  smallTargets.push({
                    tag: (el.tagName || 'button').toLowerCase(),
                    label: rawLabel.slice(0, 32) || '(unlabeled)',
                    width: Math.round(rect.width),
                    height: Math.round(rect.height)
                  });
                  if (smallTargets.length >= 8) break;
                }
              }

              var imgs = document.querySelectorAll('img');
              var brokenImages = [];
              for (var j = 0; j < imgs.length; j++) {
                var img = imgs[j];
                if (img.complete && img.naturalWidth === 0) {
                  brokenImages.push({
                    src: (img.getAttribute('src') || '').slice(0, 80),
                    alt: (img.getAttribute('alt') || 'image').slice(0, 40)
                  });
                  if (brokenImages.length >= 6) break;
                }
              }

              var textLen = document.body ? (document.body.innerText || '').trim().length : 0;
              var hasVisualNode = Boolean(document.querySelector('svg, canvas, img, video, input'));
              var emptyRender = textLen === 0 && !hasVisualNode;

              window.parent.postMessage({
                type: 'NEXUS_CANVAS_SMOKE_RESULT',
                checkId: data.checkId,
                viewportWidth: vw,
                horizontalOverflowPx: overflowPx,
                smallTapTargets: smallTargets,
                brokenImages: brokenImages,
                emptyRender: emptyRender
              }, '*');
            } catch (err) {
              window.parent.postMessage({
                type: 'NEXUS_CANVAS_SMOKE_RESULT',
                checkId: data.checkId,
                viewportWidth: 375,
                horizontalOverflowPx: 0,
                smallTapTargets: [],
                brokenImages: [],
                emptyRender: false,
                error: err && err.message ? err.message : String(err)
              }, '*');
            }
          }
        });

        // Touch & Mouse Visual Element Inspector Bridge
        var inspectActive = ${inspectMode ? 'true' : 'false'};
        if (inspectActive) {
          var lastEl = null;
          function highlightEl(el) {
            if (!el || el === document.body || el === document.documentElement) return;
            if (lastEl && lastEl !== el) {
              lastEl.style.outline = '';
              lastEl.style.outlineOffset = '';
            }
            el.style.outline = '2px dashed #06b6d4';
            el.style.outlineOffset = '2px';
            lastEl = el;
          }
          function emitInspectedEl(el) {
            if (!el || el === document.body || el === document.documentElement) return;
            highlightEl(el);
            var clone = el.cloneNode(true);
            if (clone.style) {
              clone.style.outline = '';
              clone.style.outlineOffset = '';
            }
            window.parent.postMessage({
              type: 'NEXUS_CANVAS_INSPECT',
              tagName: (el.tagName || 'DIV').toLowerCase(),
              textSnippet: (el.innerText || el.textContent || '').trim().slice(0, 80),
              className: typeof el.className === 'string' ? el.className : '',
              outerHTML: (clone.outerHTML || '').slice(0, 600)
            }, '*');
          }

          document.addEventListener('mouseover', function(e) {
            highlightEl(e.target);
          }, true);

          document.addEventListener('mouseout', function(e) {
            if (e.target && e.target === lastEl) {
              e.target.style.outline = '';
              e.target.style.outlineOffset = '';
            }
          }, true);

          document.addEventListener('touchstart', function(e) {
            if (e.target) highlightEl(e.target);
          }, { passive: true, capture: true });

          document.addEventListener('click', function(e) {
            var el = e.target;
            if (!el || el === document.body || el === document.documentElement) return;
            e.preventDefault();
            e.stopPropagation();
            emitInspectedEl(el);
          }, true);
        }
      })();
    </script>
    <style id="nexus-theme-override">${combinedCss}</style>
  `;

  if (artifact.kind === 'html') {
    const raw = artifact.content.trim();
    const hasTailwind = raw.includes('cdn.tailwindcss.com') || raw.includes('tailwind');
    const tailwindTag = hasTailwind ? '' : '<script src="https://cdn.tailwindcss.com/3.4.17"></script>';

    if (raw.toLowerCase().includes('<!doctype html') || raw.toLowerCase().includes('<html')) {
      if (raw.includes('<head>')) {
        return raw.replace('<head>', `<head>\n${tailwindTag}\n${bridgeScript}`);
      }
      if (raw.includes('<HEAD>')) {
        return raw.replace('<HEAD>', `<HEAD>\n${tailwindTag}\n${bridgeScript}`);
      }
      return `${tailwindTag}\n${bridgeScript}\n${raw}`;
    }

    return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <script src="https://cdn.tailwindcss.com/3.4.17"></script>
  <style>
    body { background-color: #09090b; color: #f4f4f5; font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 16px; }
  </style>
  ${bridgeScript}
</head>
<body>
  ${raw}
</body>
</html>`;
  }

  if (artifact.kind === 'react') {
    const preparedCode = prepareReactTsxSource(artifact.content);
    const encodedUserCode = JSON.stringify(preparedCode).replace(/<\/script/gi, '<\\/script');

    return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <script src="https://cdn.tailwindcss.com/3.4.17"></script>
  <script crossorigin src="https://unpkg.com/react@18.3.1/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone@7.26.4/babel.min.js"></script>
  <script src="https://unpkg.com/lucide@0.468.0/dist/umd/lucide.min.js"></script>
  <style>
    body { background-color: #09090b; color: #f4f4f5; font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 16px; }
  </style>
  ${bridgeScript}
</head>
<body>
  <div id="root"></div>
  <script>
    (function() {
      // Dynamic Lucide-React Icon Factory using lucide UMD AST (with safe inline SVG fallback)
      function toKebabCase(str) {
        return String(str || '').replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
      }
      function renderIconChildren(children) {
        if (!Array.isArray(children)) return null;
        return children.map(function(node, idx) {
          var tag = node[0];
          var attrs = Object.assign({ key: idx }, node[1] || {});
          return React.createElement(tag, attrs, renderIconChildren(node[2]));
        });
      }
      window.__nexusLucide = function(iconName) {
        return function LucideIconShim(props) {
          props = props || {};
          var size = props.size || 18;
          var color = props.color || 'currentColor';
          var strokeWidth = props.strokeWidth || 2;
          var className = props.className || '';
          var iconsMap = window.lucide && window.lucide.icons;
          var def = iconsMap && (iconsMap[iconName] || iconsMap[toKebabCase(iconName)]);
          var svgProps = {
            xmlns: 'http://www.w3.org/2000/svg',
            width: size,
            height: size,
            viewBox: '0 0 24 24',
            fill: 'none',
            stroke: color,
            strokeWidth: strokeWidth,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            className: className,
            style: props.style
          };
          if (def) {
            return React.createElement('svg', svgProps, renderIconChildren(def));
          }
          // Minimal fallback circle+dot icon so offline or custom icon names never crash React render
          return React.createElement(
            'svg',
            svgProps,
            React.createElement('circle', { cx: 12, cy: 12, r: 9 }),
            React.createElement('path', { d: 'M12 8v4l2.5 1.5' })
          );
        };
      };
      window.__nexusLucideProxy = new Proxy({}, {
        get: function(_, prop) {
          if (typeof prop !== 'string') return undefined;
          return window.__nexusLucide(prop);
        }
      });

      function showCompileError(title, message) {
        console.error(title + ': ' + message);
        var rootEl = document.getElementById('root');
        if (rootEl) {
          rootEl.innerHTML =
            '<div style="max-width:560px;margin:24px auto;padding:16px;border-radius:12px;border:1px solid rgba(244,63,94,0.4);background:rgba(76,5,25,0.45);color:#fecdd3;font-family:ui-monospace,monospace;font-size:12px;line-height:1.5;">' +
            '<div style="font-weight:700;color:#fb7185;margin-bottom:6px;">' + title + '</div>' +
            '<pre style="margin:0;white-space:pre-wrap;word-break:break-word;">' + String(message).replace(/</g, '&lt;') + '</pre>' +
            '</div>';
        }
      }

      window.addEventListener('DOMContentLoaded', function() {
        try {
          if (typeof React === 'undefined' || typeof ReactDOM === 'undefined' || typeof Babel === 'undefined') {
            showCompileError('Sandbox Runtime Loading Failed', 'React or Babel CDN could not load inside the sandbox preview.');
            return;
          }

          var rawUserTsx = ${encodedUserCode};
          var wrappedSource = [
            'const { useState, useEffect, useMemo, useRef, useCallback, useReducer, useContext, useLayoutEffect, createContext, Fragment, memo, forwardRef, StrictMode, Children, cloneElement, isValidElement } = React;',
            rawUserTsx,
            '',
            'const __RootComponent =',
            '  typeof App !== "undefined" ? App :',
            '  typeof DefaultExport !== "undefined" ? DefaultExport :',
            '  typeof Component !== "undefined" ? Component :',
            '  typeof Page !== "undefined" ? Page :',
            '  () => React.createElement("div", { className: "p-4 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-300 text-sm" }, "Component compiled cleanly. Export or name your main component App to render it automatically.");',
            '',
            'const __root = ReactDOM.createRoot(document.getElementById("root"));',
            '__root.render(React.createElement(__RootComponent));'
          ].join('\\n');

          var transformed = Babel.transform(wrappedSource, {
            filename: 'App.tsx',
            presets: ['react', 'typescript']
          });

          var runner = new Function('React', 'ReactDOM', transformed.code);
          runner(React, ReactDOM);
        } catch (err) {
          showCompileError('React / TSX Runtime Error', err && err.message ? err.message : String(err));
        }
      });
    })();
  </script>
</body>
</html>`;
  }

  return '';
}
