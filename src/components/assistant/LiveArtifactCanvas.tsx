import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Code2,
  Eye,
  Sparkles,
  Copy,
  Check,
  Download,
  Maximize2,
  Minimize2,
  RefreshCw,
  Smartphone,
  Tablet,
  Monitor,
  Layers,
  FileText,
  Terminal,
  Wand2,
  Bug,
  Sliders,
  Plus,
  History,
  GitCompare,
  ChevronRight,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  Send,
  Layout,
  Play,
  ArrowUpRight,
  Palette,
  Crosshair,
  Table,
  ShieldCheck,
  Bookmark,
  Columns,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Camera,
  Repeat,
  Trash2,
  Wrench,
  Cpu,
  Bot,
  RotateCcw,
} from 'lucide-react';
import { api } from '@/services/api';
import { storage } from '@/lib/storage';
import { copyToClipboard } from '@/lib/clipboard';
import { cleanMarkdownForSpeech } from '@/lib/format';
import { FormattedText } from '@/components/jarvis/FormattedText';
import type { AIProviderConfig } from '@/types';

const CANVAS_MAX_OUTPUT_TOKENS = 20000;
const CANVAS_AI_TIMEOUT_MS = 120000;

const CANVAS_MODEL_STORAGE_KEY = 'nexus_canvas_model_config_v1';

function getCanvasProviderModels(provider: AIProviderConfig): Array<{ id: string; name: string }> {
  if (Array.isArray(provider.models) && provider.models.length > 0) {
    return provider.models.map((m) => ({ id: m.id, name: m.name || m.id }));
  }
  if (provider.model && provider.model.trim()) {
    return [{ id: provider.model.trim(), name: provider.model.trim() }];
  }
  return [];
}

export type ArtifactKind = 'html' | 'svg' | 'react' | 'code' | 'markdown';

export interface ArtifactVersion {
  versionNumber: number;
  label: string;
  content: string;
  timestamp: number;
}

export interface CanvasArtifact {
  id: string;
  messageIndex: number;
  title: string;
  kind: ArtifactKind;
  language: string;
  content: string;
  versions: ArtifactVersion[];
  currentVersionIndex: number;
  createdAt: number;
}

interface ConsoleLogEntry {
  id: string;
  level: 'log' | 'warn' | 'error';
  text: string;
  timestamp: number;
}

interface InspectedElementInfo {
  tagName: string;
  textSnippet: string;
  className: string;
  outerHTML: string;
}

interface AuditReport {
  overallScore: number;
  performanceScore: number;
  securityScore: number;
  accessibilityScore: number;
  codeQualityScore: number;
  issues: Array<{
    severity: 'high' | 'medium' | 'low';
    category: 'Performance' | 'Security' | 'Accessibility' | 'Quality';
    description: string;
    fixSuggestion: string;
  }>;
}

interface LiveArtifactCanvasProps {
  isOpen: boolean;
  onClose: () => void;
  theme: 'minimal' | 'classic' | 'fulldark';
  artifacts: CanvasArtifact[];
  activeArtifactId: string | null;
  onSelectArtifact: (id: string) => void;
  onUpdateArtifact: (updated: CanvasArtifact) => void;
  onCreateArtifact: (newArtifact: CanvasArtifact) => void;
  onSyncToMessage?: (messageIndex: number, updatedArtifact: CanvasArtifact) => void;
  activeProvider?: AIProviderConfig | null;
  responseLanguage?: string;
}

const VAULT_STORAGE_KEY = 'nexus_canvas_vault_v1';

type CanvasThemePresetId = 'default' | 'cyberpunk' | 'saas_light' | 'apple_glass' | 'emerald_finance' | 'warm_editorial';

const DESIGN_THEME_PRESETS: Array<{
  id: CanvasThemePresetId;
  label: string;
  cssOverride: string;
  promptHint: string;
}> = [
  {
    id: 'default',
    label: 'Default Dark',
    cssOverride: '',
    promptHint: 'Modern sleek zinc dark UI',
  },
  {
    id: 'cyberpunk',
    label: 'Cyberpunk Neon',
    cssOverride: `
      body { background: radial-gradient(circle at top, #0f172a, #020617) !important; color: #e2e8f0 !important; }
      button, input[type="submit"] { box-shadow: 0 0 14px rgba(6, 182, 212, 0.45) !important; }
    `,
    promptHint: 'Cyberpunk high-contrast neon cyan/magenta HUD aesthetic with glowing borders and dark slate surfaces',
  },
  {
    id: 'saas_light',
    label: 'Clean SaaS Light',
    cssOverride: `
      html, body { background: #f8fafc !important; color: #0f172a !important; }
      div, section, article { border-color: #e2e8f0 !important; }
    `,
    promptHint: 'Crisp Stripe/Linear-inspired light mode SaaS interface (#f8fafc background, #0f172a slate text, subtle #e2e8f0 borders, indigo accents)',
  },
  {
    id: 'apple_glass',
    label: 'Glassmorphic Dark',
    cssOverride: `
      body { background: linear-gradient(135deg, #090d16 0%, #111827 50%, #09090b 100%) !important; }
    `,
    promptHint: 'Frosted glassmorphic dark UI with backdrop-blur, soft translucent borders, and refined spatial hierarchy',
  },
  {
    id: 'emerald_finance',
    label: 'Emerald Fintech',
    cssOverride: `
      body { background: #04130e !important; color: #ecfdf5 !important; }
    `,
    promptHint: 'Precision institutional fintech aesthetic with deep emerald/obsidian surfaces, monospace financial figures, and high-trust emerald accents',
  },
  {
    id: 'warm_editorial',
    label: 'Warm Editorial',
    cssOverride: `
      html, body { background: #1c1917 !important; color: #f5f5f4 !important; }
    `,
    promptHint: 'Warm stone & amber editorial interface with refined typography and tactile card hierarchy',
  },
];

function loadVaultArtifacts(): CanvasArtifact[] {
  try {
    const raw = localStorage.getItem(VAULT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveVaultArtifacts(list: CanvasArtifact[]): boolean {
  try {
    let prepared = list.map((item) => {
      const versions = item.versions || [];
      const trimmedVersions = versions.slice(-5);
      const droppedCount = Math.max(0, versions.length - trimmedVersions.length);
      const adjustedIndex =
        trimmedVersions.length > 0
          ? Math.max(
              0,
              Math.min(trimmedVersions.length - 1, (item.currentVersionIndex ?? 0) - droppedCount),
            )
          : 0;
      return {
        ...item,
        versions: trimmedVersions,
        currentVersionIndex: adjustedIndex,
      };
    });

    let json = JSON.stringify(prepared);
    while (json.length > 3500000 && prepared.length > 0) {
      prepared = prepared.slice(0, -1);
      json = JSON.stringify(prepared);
    }

    localStorage.setItem(VAULT_STORAGE_KEY, json);
    return true;
  } catch {
    return false;
  }
}

/**
 * Extracts artifact code from an AI response and detects truncation.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function extractArtifactFromAnswer(answer: string): { code: string; truncated: boolean } {
  const trimmed = (answer || '').trim();
  let code = trimmed;
  let truncated = false;

  const completeMatch = trimmed.match(/```[a-zA-Z0-9_-]*\r?\n([\s\S]*?)```/);
  if (completeMatch && completeMatch[1] !== undefined) {
    code = completeMatch[1].trim();
    truncated = false;
  } else {
    const openFenceMatch = trimmed.match(/(?:^|\n)[ \t]*```[a-zA-Z0-9_-]*\r?\n([\s\S]*)$/);
    if (openFenceMatch && openFenceMatch[1] !== undefined) {
      code = openFenceMatch[1].trim();
      truncated = true;
    } else {
      code = trimmed;
      truncated = false;
    }
  }

  const lower = code.toLowerCase();
  const isHtml = lower.includes('<!doctype html') || lower.includes('<html');
  if (isHtml && !lower.includes('</html>')) {
    truncated = true;
  }
  const trimmedCode = code.trim();
  if (trimmedCode.toLowerCase().startsWith('<svg') && !trimmedCode.toLowerCase().includes('</svg>')) {
    truncated = true;
  }

  return { code, truncated };
}

/**
 * Extracts all runnable or editable artifacts from a single Assistant message.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function extractArtifactsFromMessage(
  content: string,
  messageIndex: number,
  diagramSvg?: string,
): CanvasArtifact[] {
  const results: CanvasArtifact[] = [];
  const now = Date.now();

  if (diagramSvg && diagramSvg.trim().includes('<svg')) {
    const svgContent = diagramSvg.trim();
    results.push({
      id: `msg-${messageIndex}-architect-svg`,
      messageIndex,
      title: `Architectural Blueprint SVG (#${messageIndex + 1})`,
      kind: 'svg',
      language: 'svg',
      content: svgContent,
      versions: [
        {
          versionNumber: 1,
          label: 'Initial Blueprint',
          content: svgContent,
          timestamp: now,
        },
      ],
      currentVersionIndex: 0,
      createdAt: now,
    });
  }

  if (!content || !content.trim()) return results;

  const fenceRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  let blockIdx = 0;

  const htmlParts: string[] = [];
  const cssParts: string[] = [];
  const jsParts: string[] = [];

  while ((match = fenceRegex.exec(content)) !== null) {
    const rawLang = (match[1] || 'text').toLowerCase().trim();
    const codeBody = (match[2] || '').trim();
    if (!codeBody) continue;

    blockIdx += 1;
    let kind: ArtifactKind = 'code';
    let title = `${rawLang.toUpperCase() || 'CODE'} Snippet #${blockIdx}`;

    if (
      rawLang === 'html' ||
      rawLang === 'htm' ||
      codeBody.includes('<!DOCTYPE html') ||
      (codeBody.includes('<html') && codeBody.includes('</html>'))
    ) {
      kind = 'html';
      title = extractHtmlTitle(codeBody) || `Interactive Web App #${blockIdx}`;
      htmlParts.push(codeBody);
    } else if (rawLang === 'svg' || (rawLang === 'xml' && codeBody.includes('<svg'))) {
      kind = 'svg';
      title = `Vector Graphic SVG #${blockIdx}`;
    } else if (rawLang === 'jsx' || rawLang === 'tsx' || rawLang === 'react') {
      kind = 'react';
      title = `React Component #${blockIdx}`;
    } else if (rawLang === 'css') {
      cssParts.push(codeBody);
      title = `Stylesheet CSS #${blockIdx}`;
    } else if (rawLang === 'js' || rawLang === 'javascript') {
      jsParts.push(codeBody);
      title = `JavaScript Module #${blockIdx}`;
    } else if (rawLang === 'md' || rawLang === 'markdown') {
      kind = 'markdown';
      title = `Markdown Document #${blockIdx}`;
    }

    results.push({
      id: `msg-${messageIndex}-block-${blockIdx}`,
      messageIndex,
      title,
      kind,
      language: rawLang || 'text',
      content: codeBody,
      versions: [
        {
          versionNumber: 1,
          label: 'Initial Extract',
          content: codeBody,
          timestamp: now,
        },
      ],
      currentVersionIndex: 0,
      createdAt: now,
    });
  }

  if (htmlParts.length > 0 && (cssParts.length > 0 || jsParts.length > 0)) {
    const combinedHtml = combineHtmlCssJs(
      htmlParts.join('\n\n'),
      cssParts.join('\n\n'),
      jsParts.join('\n\n'),
    );
    results.unshift({
      id: `msg-${messageIndex}-combined-webapp`,
      messageIndex,
      title: `Combined Web App (HTML+CSS+JS) #${messageIndex + 1}`,
      kind: 'html',
      language: 'html',
      content: combinedHtml,
      versions: [
        {
          versionNumber: 1,
          label: 'Combined Web Bundle',
          content: combinedHtml,
          timestamp: now,
        },
      ],
      currentVersionIndex: 0,
      createdAt: now,
    });
  }

  const cleanFull = content.trim();
  if (results.length === 0 && cleanFull.length > 0) {
    const headingMatch = cleanFull.match(/^#{1,3}\s+(.+)$/m);
    const docTitle = headingMatch
      ? headingMatch[1].replace(/[*_`#]/g, '').trim().slice(0, 42)
      : `AI Response Document (#${messageIndex + 1})`;
    results.push({
      id: `msg-${messageIndex}-doc`,
      messageIndex,
      title: docTitle,
      kind: 'markdown',
      language: 'markdown',
      content: cleanFull,
      versions: [
        {
          versionNumber: 1,
          label: 'Original Response',
          content: cleanFull,
          timestamp: now,
        },
      ],
      currentVersionIndex: 0,
      createdAt: now,
    });
  }

  return results;
}

function extractHtmlTitle(html: string): string | null {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch && titleMatch[1] && titleMatch[1].trim()) {
    return titleMatch[1].trim().slice(0, 40);
  }
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match && h1Match[1]) {
    const clean = h1Match[1].replace(/<[^>]+>/g, '').trim();
    if (clean) return clean.slice(0, 40);
  }
  return null;
}

function combineHtmlCssJs(html: string, css: string, js: string): string {
  let output = html;
  if (css) {
    if (output.includes('</head>')) {
      output = output.replace('</head>', `<style>\n${css}\n</style>\n</head>`);
    } else {
      output = `<style>\n${css}\n</style>\n${output}`;
    }
  }
  if (js) {
    if (output.includes('</body>')) {
      output = output.replace('</body>', `<script>\n${js}\n</script>\n</body>`);
    } else {
      output = `${output}\n<script>\n${js}\n</script>`;
    }
  }
  return output;
}

/**
 * Builds a complete, runnable HTML document for the sandboxed iframe preview,
 * including Tailwind CSS CDN, Console Error Bridge, Live Theme CSS injection,
 * and Visual Element Inspector ("Click-to-Edit") bridge.
 */
function buildRunnableSandboxHtml(
  artifact: CanvasArtifact,
  inspectMode: boolean,
  themeCssOverride: string,
): string {
  const bridgeScript = `
    <script>
      (function() {
        const origLog = console.log;
        const origWarn = console.warn;
        const origError = console.error;
        function sendToHost(level, args) {
          try {
            const text = Array.from(args).map(a => {
              if (typeof a === 'object') {
                try { return JSON.stringify(a); } catch (e) { return String(a); }
              }
              return String(a);
            }).join(' ');
            window.parent.postMessage({ type: 'NEXUS_CANVAS_CONSOLE', level, text }, '*');
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

        // Visual Element Inspector Bridge
        const inspectActive = ${inspectMode ? 'true' : 'false'};
        if (inspectActive) {
          let lastEl = null;
          document.addEventListener('mouseover', function(e) {
            const el = e.target;
            if (!el || el === document.body || el === document.documentElement) return;
            if (lastEl && lastEl !== el) {
              lastEl.style.outline = '';
            }
            el.style.outline = '2px dashed #06b6d4';
            el.style.outlineOffset = '2px';
            lastEl = el;
          }, true);

          document.addEventListener('mouseout', function(e) {
            const el = e.target;
            if (el && el === lastEl) {
              el.style.outline = '';
            }
          }, true);

          document.addEventListener('click', function(e) {
            const el = e.target;
            if (!el || el === document.body || el === document.documentElement) return;
            e.preventDefault();
            e.stopPropagation();
            const clone = el.cloneNode(true);
            clone.style.outline = '';
            clone.style.outlineOffset = '';
            window.parent.postMessage({
              type: 'NEXUS_CANVAS_INSPECT',
              tagName: (el.tagName || 'DIV').toLowerCase(),
              textSnippet: (el.innerText || el.textContent || '').trim().slice(0, 80),
              className: typeof el.className === 'string' ? el.className : '',
              outerHTML: (clone.outerHTML || '').slice(0, 600)
            }, '*');
          }, true);
        }
      })();
    </script>
    ${themeCssOverride ? `<style id="nexus-theme-override">${themeCssOverride}</style>` : ''}
  `;

  if (artifact.kind === 'html') {
    const raw = artifact.content.trim();
    const hasTailwind = raw.includes('cdn.tailwindcss.com') || raw.includes('tailwind');
    const tailwindTag = hasTailwind ? '' : '<script src="https://cdn.tailwindcss.com/3.4.17"></script>';

    if (raw.toLowerCase().includes('<!doctype html') || raw.toLowerCase().includes('<html')) {
      if (raw.includes('<head>')) {
        return raw.replace('<head>', `<head>\n${tailwindTag}\n${bridgeScript}`);
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
    const cleanedCode = artifact.content
      .replace(/^\s*import\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '')
      .replace(/export\s+default\s+function\s+([A-Za-z0-9_]+)/g, 'function $1')
      .replace(/export\s+default\s+/g, 'const DefaultExport = ');

    return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <script src="https://cdn.tailwindcss.com/3.4.17"></script>
  <script crossorigin src="https://unpkg.com/react@18.3.1/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone@7.26.4/babel.min.js"></script>
  <style>
    body { background-color: #09090b; color: #f4f4f5; font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 16px; }
  </style>
  ${bridgeScript}
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
    const { useState, useEffect, useMemo, useRef, useCallback } = React;
    ${cleanedCode}
    const RootComponent =
      typeof App !== 'undefined' ? App :
      typeof DefaultExport !== 'undefined' ? DefaultExport :
      typeof Component !== 'undefined' ? Component :
      () => <div className="p-4 text-zinc-300">Component loaded. Name your main function <code>App</code> to render automatically.</div>;
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(<RootComponent />);
  </script>
</body>
</html>`;
  }

  return '';
}

/**
 * Instant static audit + heuristic analyzer for Feature 7 (Security, Perf & Accessibility Auditor)
 */
function runStaticArtifactAudit(artifact: CanvasArtifact, content: string): AuditReport {
  const issues: AuditReport['issues'] = [];
  let perf = 94;
  let sec = 96;
  let a11y = 90;
  let qual = 92;

  if (/eval\s*\(|innerHTML\s*=|document\.write\s*\(/i.test(content)) {
    sec -= 18;
    issues.push({
      severity: 'high',
      category: 'Security',
      description: 'Detected raw DOM HTML injection or eval() usage that could expose XSS vectors.',
      fixSuggestion: 'Replace innerHTML/eval with safe textContent or structured DOM creation.',
    });
  }

  if (artifact.kind === 'html' && /<img(?![^>]*\balt=)[^>]*>/i.test(content)) {
    a11y -= 14;
    issues.push({
      severity: 'medium',
      category: 'Accessibility',
      description: 'Found <img> tags without descriptive alt attributes for screen readers.',
      fixSuggestion: 'Add meaningful alt="..." attributes to all image elements.',
    });
  }

  if (artifact.kind === 'html' && /<input(?![^>]*\baria-label=)(?![^>]*\bid=)[^>]*>/i.test(content)) {
    a11y -= 10;
    issues.push({
      severity: 'low',
      category: 'Accessibility',
      description: 'Interactive <input> elements lack explicit labels or aria-label attributes.',
      fixSuggestion: 'Associate <label> elements or add aria-label to all form inputs.',
    });
  }

  if (content.length > 15000) {
    perf -= 12;
    issues.push({
      severity: 'low',
      category: 'Performance',
      description: 'Large single-file bundle size may impact initial render speed on mobile.',
      fixSuggestion: 'Modularize repeated styles and debounce frequent DOM updates.',
    });
  }

  if (/var\s+[a-zA-Z0-9_]+\s*=/g.test(content)) {
    qual -= 8;
    issues.push({
      severity: 'low',
      category: 'Quality',
      description: 'Legacy var declarations detected instead of block-scoped const/let.',
      fixSuggestion: 'Upgrade variable declarations to const and let.',
    });
  }

  if (issues.length === 0) {
    issues.push({
      severity: 'low',
      category: 'Quality',
      description: 'No critical security or accessibility bottlenecks detected in static pass.',
      fixSuggestion: 'Run Deep AI Audit & Auto-Harden to optimize edge cases and ARIA roles.',
    });
  }

  const overall = Math.round((perf + sec + a11y + qual) / 4);
  return {
    overallScore: overall,
    performanceScore: perf,
    securityScore: sec,
    accessibilityScore: a11y,
    codeQualityScore: qual,
    issues,
  };
}

/**
 * Extracts editable tabular rows from JSON arrays or Markdown tables for Feature 4 (Data Playground)
 */
function extractTableRowsFromContent(content: string): {
  headers: string[];
  rows: string[][];
  format: 'markdown' | 'json' | 'sample';
} {
  // 1. Check for Markdown table
  const lines = content.split('\n').map((l) => l.trim());
  const tableLines = lines.filter((l) => l.startsWith('|') && l.endsWith('|'));
  if (tableLines.length >= 2) {
    const parseCells = (line: string) =>
      line
        .slice(1, -1)
        .split('|')
        .map((c) => c.trim());
    const headers = parseCells(tableLines[0]);
    const dataRows = tableLines
      .slice(1)
      .filter((l) => !/^\|[\s:-]+\|$/.test(l))
      .map(parseCells);
    if (headers.length > 0 && dataRows.length > 0) {
      return { headers, rows: dataRows, format: 'markdown' };
    }
  }

  // 2. Check for JSON array of objects
  const jsonMatch = content.match(/\[\s*\{[\s\S]*?\}\s*\]/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object') {
        const headers = Object.keys(parsed[0]).slice(0, 6);
        const rows = parsed.slice(0, 20).map((item) =>
          headers.map((h) => String((item as Record<string, unknown>)[h] ?? '')),
        );
        return { headers, rows, format: 'json' };
      }
    } catch {
      // ignore invalid JSON snippet
    }
  }

  return {
    headers: ['Metric / Item', 'Value', 'Category', 'Status'],
    rows: [
      ['Active Users', '2,500', 'Growth', 'Active'],
      ['Conversion Rate', '4.5%', 'Funnel', 'Optimized'],
      ['Monthly MRR', '$5,537', 'Revenue', 'On Track'],
    ],
    format: 'sample',
  };
}

const STARTER_TEMPLATES: Array<{
  title: string;
  kind: ArtifactKind;
  language: string;
  description: string;
  content: string;
}> = [
  {
    title: 'Interactive ROI & Pricing Calculator',
    kind: 'html',
    language: 'html',
    description: 'Live SaaS revenue & ROI simulator with interactive sliders and metrics',
    content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <script src="https://cdn.tailwindcss.com/3.4.17"></script>
</head>
<body class="bg-zinc-950 text-zinc-100 p-6 font-sans">
  <div class="max-w-xl mx-auto rounded-2xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl space-y-6">
    <div class="flex items-center justify-between border-b border-zinc-800 pb-4">
      <div>
        <h1 class="text-lg font-bold text-white">SaaS Revenue & ROI Simulator</h1>
        <p class="text-xs text-zinc-400">Adjust active seats and conversion rate to project annual impact</p>
      </div>
      <span class="text-xs font-mono text-cyan-400">LIVE MODEL</span>
    </div>

    <div class="space-y-4">
      <div>
        <div class="flex justify-between text-xs mb-1.5">
          <span class="text-zinc-400">Monthly Active Users</span>
          <span id="usersVal" class="font-mono font-bold text-cyan-300">2,500</span>
        </div>
        <input id="usersInput" type="range" min="100" max="20000" step="100" value="2500" class="w-full accent-cyan-400 cursor-pointer" />
      </div>

      <div>
        <div class="flex justify-between text-xs mb-1.5">
          <span class="text-zinc-400">Pro Conversion Rate (%)</span>
          <span id="convVal" class="font-mono font-bold text-emerald-300">4.5%</span>
        </div>
        <input id="convInput" type="range" min="0.5" max="20" step="0.5" value="4.5" class="w-full accent-emerald-400 cursor-pointer" />
      </div>

      <div>
        <div class="flex justify-between text-xs mb-1.5">
          <span class="text-zinc-400">Average Subscription ($/mo)</span>
          <span id="arpuVal" class="font-mono font-bold text-indigo-300">$49</span>
        </div>
        <input id="arpuInput" type="range" min="9" max="299" step="5" value="49" class="w-full accent-indigo-400 cursor-pointer" />
      </div>
    </div>

    <div class="grid grid-cols-3 gap-3 pt-2">
      <div class="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800">
        <div class="text-[11px] text-zinc-400">Paid Subscribers</div>
        <div id="paidOut" class="text-lg font-bold font-mono text-white mt-1">113</div>
      </div>
      <div class="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800">
        <div class="text-[11px] text-zinc-400">Monthly MRR</div>
        <div id="mrrOut" class="text-lg font-bold font-mono text-cyan-400 mt-1">$5,537</div>
      </div>
      <div class="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800">
        <div class="text-[11px] text-zinc-400">Projected ARR</div>
        <div id="arrOut" class="text-lg font-bold font-mono text-emerald-400 mt-1">$66,444</div>
      </div>
    </div>
  </div>

  <script>
    const usersInput = document.getElementById('usersInput');
    const convInput = document.getElementById('convInput');
    const arpuInput = document.getElementById('arpuInput');

    function update() {
      const users = Number(usersInput.value);
      const conv = Number(convInput.value);
      const arpu = Number(arpuInput.value);
      const paid = Math.round(users * (conv / 100));
      const mrr = paid * arpu;
      const arr = mrr * 12;

      document.getElementById('usersVal').textContent = users.toLocaleString();
      document.getElementById('convVal').textContent = conv.toFixed(1) + '%';
      document.getElementById('arpuVal').textContent = '$' + arpu;
      document.getElementById('paidOut').textContent = paid.toLocaleString();
      document.getElementById('mrrOut').textContent = '$' + mrr.toLocaleString();
      document.getElementById('arrOut').textContent = '$' + arr.toLocaleString();
      console.log('Updated ARR projection:', arr);
    }

    usersInput.addEventListener('input', update);
    convInput.addEventListener('input', update);
    arpuInput.addEventListener('input', update);
  </script>
</body>
</html>`,
  },
  {
    title: 'System Architecture Topology SVG',
    kind: 'svg',
    language: 'svg',
    description: 'Scalable vector microservice & AI gateway architecture diagram',
    content: `<svg viewBox="0 0 760 320" xmlns="http://www.w3.org/2000/svg" style="background:#09090b;font-family:system-ui,sans-serif">
  <defs>
    <linearGradient id="edgeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#06b6d4" />
      <stop offset="100%" stop-color="#6366f1" />
    </linearGradient>
  </defs>
  <g stroke="#18181b" stroke-width="1">
    <line x1="0" y1="80" x2="760" y2="80" />
    <line x1="0" y1="160" x2="760" y2="160" />
    <line x1="0" y1="240" x2="760" y2="240" />
  </g>
  <path d="M 180 160 L 290 160" stroke="url(#edgeGrad)" stroke-width="2.5" fill="none" />
  <path d="M 450 160 L 550 95" stroke="url(#edgeGrad)" stroke-width="2.5" fill="none" />
  <path d="M 450 160 L 550 225" stroke="url(#edgeGrad)" stroke-width="2.5" fill="none" />
  <rect x="40" y="120" width="140" height="80" rx="14" fill="#18181b" stroke="#06b6d4" stroke-width="2" />
  <text x="110" y="155" fill="#f4f4f5" font-size="13" font-weight="bold" text-anchor="middle">Web / Mobile UI</text>
  <text x="110" y="175" fill="#a1a1aa" font-size="10" text-anchor="middle">React + Edge Stream</text>
  <rect x="290" y="115" width="160" height="90" rx="14" fill="#18181b" stroke="#6366f1" stroke-width="2" />
  <text x="370" y="152" fill="#f4f4f5" font-size="13" font-weight="bold" text-anchor="middle">AI Orchestrator</text>
  <text x="370" y="172" fill="#818cf8" font-size="10" text-anchor="middle">Router + Context Cache</text>
  <rect x="550" y="55" width="165" height="75" rx="14" fill="#18181b" stroke="#10b981" stroke-width="2" />
  <text x="632" y="88" fill="#f4f4f5" font-size="12" font-weight="bold" text-anchor="middle">Multi-Model Cluster</text>
  <text x="632" y="108" fill="#34d399" font-size="10" text-anchor="middle">Gemini • GPT-4o • Claude</text>
  <rect x="550" y="185" width="165" height="75" rx="14" fill="#18181b" stroke="#f59e0b" stroke-width="2" />
  <text x="632" y="218" fill="#f4f4f5" font-size="12" font-weight="bold" text-anchor="middle">Vector Memory DB</text>
  <text x="632" y="238" fill="#fbbf24" font-size="10" text-anchor="middle">Hybrid Semantic Index</text>
</svg>`,
  },
];

export const LiveArtifactCanvas: React.FC<LiveArtifactCanvasProps> = ({
  isOpen,
  onClose,
  theme,
  artifacts,
  activeArtifactId,
  onSelectArtifact,
  onUpdateArtifact,
  onCreateArtifact,
  onSyncToMessage,
  activeProvider,
  responseLanguage,
}) => {
  const [activeTab, setActiveTab] = useState<
    'preview' | 'split' | 'code' | 'data' | 'audit' | 'diff' | 'templates'
  >('preview');
  const [viewportSize, setViewportSize] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [syncedNotice, setSyncedNotice] = useState(false);
  const [iframeRefreshKey, setIframeRefreshKey] = useState(0);
  const [svgZoom, setSvgZoom] = useState(100);
  const [consoleLogs, setConsoleLogs] = useState<ConsoleLogEntry[]>([]);
  const [showConsole, setShowConsole] = useState(false);

  // Feature 2: Live Theme & Design Token Switcher
  const [selectedThemePreset, setSelectedThemePreset] = useState<CanvasThemePresetId>('default');

  // Feature 3: Visual Element Inspector ("Click-to-Edit")
  const [inspectMode, setInspectMode] = useState(false);
  const [inspectedElement, setInspectedElement] = useState<InspectedElementInfo | null>(null);

  // Feature 4: Interactive Data & Table Playground
  const [dataHeaders, setDataHeaders] = useState<string[]>([]);
  const [dataRows, setDataRows] = useState<string[][]>([]);

  // Feature 8: Persistent Artifact Vault
  const [vaultArtifacts, setVaultArtifacts] = useState<CanvasArtifact[]>(() => loadVaultArtifacts());
  const [savedToVaultNotice, setSavedToVaultNotice] = useState(false);
  const [vaultError, setVaultError] = useState<string | null>(null);

  // Feature 10: Voice-to-Canvas Mic & Audio Walkthrough
  const [isListeningMic, setIsListeningMic] = useState(false);
  const [isExplainingAudio, setIsExplainingAudio] = useState(false);
  const [explainingLoading, setExplainingLoading] = useState(false);
  const speechRecRef = useRef<{ stop: () => void } | null>(null);
  const explainAudioRef = useRef<HTMLAudioElement | null>(null);

  // AI Refinement States
  const [aiRefining, setAiRefining] = useState(false);
  const [aiRefiningLabel, setAiRefiningLabel] = useState('');
  const [customAiPrompt, setCustomAiPrompt] = useState('');
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiWarning, setAiWarning] = useState<string | null>(null);

  // Canvas AI Provider & Model Selection State
  const [configuredProviders, setConfiguredProviders] = useState<AIProviderConfig[]>(() => {
    try {
      return storage.getAIProvidersState().providers || [];
    } catch {
      return [];
    }
  });
  const [canvasProviderId, setCanvasProviderId] = useState<string>(() => {
    try {
      const raw = localStorage.getItem(CANVAS_MODEL_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.providerId === 'string') return parsed.providerId;
      }
    } catch {
      // ignore
    }
    return 'session';
  });
  const [canvasModelId, setCanvasModelId] = useState<string>(() => {
    try {
      const raw = localStorage.getItem(CANVAS_MODEL_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.modelId === 'string') return parsed.modelId;
      }
    } catch {
      // ignore
    }
    return '';
  });
  const [modelModalOpen, setModelModalOpen] = useState(false);
  const [providerDraft, setProviderDraft] = useState<string>('session');
  const [modelIdDraft, setModelIdDraft] = useState<string>('');

  useEffect(() => {
    const syncProviders = () => {
      try {
        setConfiguredProviders(storage.getAIProvidersState().providers || []);
      } catch {
        // ignore
      }
    };
    window.addEventListener('storage', syncProviders);
    window.addEventListener('nexus-ai-providers-updated', syncProviders);
    return () => {
      window.removeEventListener('storage', syncProviders);
      window.removeEventListener('nexus-ai-providers-updated', syncProviders);
    };
  }, []);

  const effectiveCanvasProvider = useMemo<AIProviderConfig | null | undefined>(() => {
    if (canvasProviderId === 'session') {
      return activeProvider;
    }
    if (canvasProviderId === 'existing') {
      return storage.getActiveAIProvider();
    }
    const matched = configuredProviders.find((p) => p.id === canvasProviderId);
    if (matched) {
      return {
        ...matched,
        model: canvasModelId.trim() || matched.model,
      };
    }
    return storage.getProviderForSession(canvasProviderId, canvasModelId);
  }, [canvasProviderId, canvasModelId, activeProvider, configuredProviders]);

  const activeCanvasModelLabel = useMemo(() => {
    if (canvasProviderId === 'session') {
      if (activeProvider?.model) {
        return activeProvider.model.split('/').pop() || activeProvider.model;
      }
      if (activeProvider?.name) {
        return activeProvider.name;
      }
      return 'Chat Model';
    }
    if (canvasProviderId === 'existing') {
      const globalProv = storage.getActiveAIProvider();
      if (globalProv?.model) {
        return globalProv.model.split('/').pop() || globalProv.model;
      }
      return 'Default AI';
    }
    const found = configuredProviders.find((p) => p.id === canvasProviderId);
    const chosenModel = canvasModelId || found?.model || found?.name || 'Custom Model';
    return chosenModel.split('/').pop() || chosenModel;
  }, [canvasProviderId, canvasModelId, activeProvider, configuredProviders]);

  const handleOpenModelModal = () => {
    setProviderDraft(canvasProviderId);
    setModelIdDraft(canvasModelId);
    setModelModalOpen(true);
  };

  const handleSaveCanvasModel = () => {
    let finalModel = modelIdDraft.trim();
    if (providerDraft !== 'session' && providerDraft !== 'existing' && !finalModel) {
      const prov = configuredProviders.find((p) => p.id === providerDraft);
      if (prov) {
        finalModel = getCanvasProviderModels(prov)[0]?.id || prov.model || '';
      }
    }
    setCanvasProviderId(providerDraft);
    setCanvasModelId(finalModel);
    try {
      localStorage.setItem(
        CANVAS_MODEL_STORAGE_KEY,
        JSON.stringify({ providerId: providerDraft, modelId: finalModel }),
      );
    } catch {
      // ignore
    }
    setModelModalOpen(false);
  };

  // Local editor draft
  const [editorDraft, setEditorDraft] = useState('');
  const [hasUnsavedEdits, setHasUnsavedEdits] = useState(false);

  // Live Coding Process Studio State
  const [liveCodingActive, setLiveCodingActive] = useState(false);
  const [liveCodingPhase, setLiveCodingPhase] = useState<'planning' | 'streaming' | 'compiling'>('planning');
  const [liveCodingBuffer, setLiveCodingBuffer] = useState('');
  const [liveCodingTotalLen, setLiveCodingTotalLen] = useState(0);
  const [liveCodingElapsedMs, setLiveCodingElapsedMs] = useState(0);
  const [liveCodingSpeed, setLiveCodingSpeed] = useState<'normal' | 'turbo'>('normal');
  const [liveCodingStatusText, setLiveCodingStatusText] = useState('Initializing AI Canvas Compiler...');
  const liveCodeScrollRef = useRef<HTMLDivElement | null>(null);
  const liveCodingSkipRef = useRef(false);
  const liveCodingSpeedRef = useRef<'normal' | 'turbo'>('normal');

  useEffect(() => {
    liveCodingSpeedRef.current = liveCodingSpeed;
  }, [liveCodingSpeed]);

  // Auto-scroll live coding terminal to bottom as lines stream in
  useEffect(() => {
    if (liveCodingActive && liveCodeScrollRef.current) {
      liveCodeScrollRef.current.scrollTop = liveCodeScrollRef.current.scrollHeight;
    }
  }, [liveCodingBuffer, liveCodingActive]);

  // Live stopwatch while aiRefining or liveCodingActive is running
  useEffect(() => {
    if (!aiRefining && !liveCodingActive) {
      setLiveCodingElapsedMs(0);
      return;
    }
    const started = Date.now();
    const timer = window.setInterval(() => {
      setLiveCodingElapsedMs(Date.now() - started);
    }, 100);
    return () => window.clearInterval(timer);
  }, [aiRefining, liveCodingActive]);

  const streamCodeIntoCanvas = async (
    fullCode: string,
    onProgressDraft?: (partial: string) => void,
  ): Promise<void> => {
    liveCodingSkipRef.current = false;
    setLiveCodingActive(true);
    setLiveCodingPhase('streaming');
    setLiveCodingTotalLen(fullCode.length);
    setLiveCodingStatusText('Streaming synthesized code & binding interactive DOM...');

    const lines = fullCode.split('\n');
    const totalLines = lines.length;
    let currentLineIdx = 0;

    return new Promise<void>((resolve) => {
      const step = () => {
        if (liveCodingSkipRef.current) {
          setLiveCodingBuffer(fullCode);
          if (onProgressDraft) onProgressDraft(fullCode);
          setLiveCodingPhase('compiling');
          setLiveCodingStatusText('Mounting live sandbox preview...');
          window.setTimeout(() => {
            setLiveCodingActive(false);
            resolve();
          }, 120);
          return;
        }

        const isTurbo = liveCodingSpeedRef.current === 'turbo';
        const linesPerTick = isTurbo
          ? Math.max(3, Math.ceil(totalLines / 18))
          : Math.max(1, Math.ceil(totalLines / 42));

        currentLineIdx = Math.min(totalLines, currentLineIdx + linesPerTick);
        const partial = lines.slice(0, currentLineIdx).join('\n');
        setLiveCodingBuffer(partial);
        if (onProgressDraft) onProgressDraft(partial);

        const ratio = currentLineIdx / Math.max(1, totalLines);
        if (ratio < 0.35) {
          setLiveCodingStatusText('Scaffolding document head, layout grid & Tailwind tokens...');
        } else if (ratio < 0.75) {
          setLiveCodingStatusText('Writing UI components, cards & responsive layout...');
        } else {
          setLiveCodingStatusText('Binding interactive event listeners & state handlers...');
        }

        if (currentLineIdx >= totalLines) {
          setLiveCodingPhase('compiling');
          setLiveCodingStatusText('Compiling & mounting live interactive sandbox...');
          window.setTimeout(() => {
            setLiveCodingActive(false);
            resolve();
          }, 220);
        } else {
          window.setTimeout(step, isTurbo ? 22 : 38);
        }
      };
      step();
    });
  };

  const handleWatchLiveCodeReplay = async () => {
    if (!activeArtifact || aiRefining || liveCodingActive) return;
    const targetCode = hasUnsavedEdits ? editorDraft : activeArtifact.content;
    setAiRefiningLabel(`Live Coding: ${activeArtifact.title}`);
    await streamCodeIntoCanvas(targetCode);
    setAiRefiningLabel('');
  };

  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const activeArtifact = useMemo(() => {
    if (!artifacts.length) return null;
    return artifacts.find((a) => a.id === activeArtifactId) || artifacts[0];
  }, [artifacts, activeArtifactId]);

  const activeThemePresetObj = useMemo(
    () => DESIGN_THEME_PRESETS.find((p) => p.id === selectedThemePreset) || DESIGN_THEME_PRESETS[0],
    [selectedThemePreset],
  );

  // Sync editor draft & extracted table data when switching artifacts or versions
  useEffect(() => {
    if (activeArtifact) {
      setEditorDraft(activeArtifact.content);
      setHasUnsavedEdits(false);
      setConsoleLogs([]);
      setAiError(null);
      setInspectedElement(null);
      const tableExtracted = extractTableRowsFromContent(activeArtifact.content);
      setDataHeaders(tableExtracted.headers);
      setDataRows(tableExtracted.rows);
    }
  }, [activeArtifact]);

  // Listen for console logs AND Visual Inspector clicks from inside the sandboxed iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (!event.data || typeof event.data !== 'object') return;
      if (event.data.type === 'NEXUS_CANVAS_CONSOLE') {
        setConsoleLogs((prev) => [
          ...prev.slice(-39),
          {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            level: event.data.level || 'log',
            text: String(event.data.text || ''),
            timestamp: Date.now(),
          },
        ]);
      } else if (event.data.type === 'NEXUS_CANVAS_INSPECT') {
        setInspectedElement({
          tagName: String(event.data.tagName || 'div'),
          textSnippet: String(event.data.textSnippet || ''),
          className: String(event.data.className || ''),
          outerHTML: String(event.data.outerHTML || ''),
        });
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const isRunnableWeb =
    activeArtifact?.kind === 'html' || activeArtifact?.kind === 'react';
  const isSvg = activeArtifact?.kind === 'svg';

  const latestRuntimeError = useMemo(
    () => [...consoleLogs].reverse().find((l) => l.level === 'error') || null,
    [consoleLogs],
  );

  const staticAuditReport = useMemo(() => {
    if (!activeArtifact) return null;
    const currentCode = hasUnsavedEdits ? editorDraft : activeArtifact.content;
    return runStaticArtifactAudit(activeArtifact, currentCode);
  }, [activeArtifact, editorDraft, hasUnsavedEdits]);

  const [previewSource, setPreviewSource] = useState<string>(() =>
    hasUnsavedEdits ? editorDraft : activeArtifact?.content || '',
  );

  useEffect(() => {
    if (!hasUnsavedEdits) {
      setPreviewSource(activeArtifact?.content || '');
      return;
    }
    const timer = window.setTimeout(() => {
      setPreviewSource(editorDraft);
    }, 700);

    return () => {
      window.clearTimeout(timer);
    };
  }, [hasUnsavedEdits, editorDraft, activeArtifact?.id, activeArtifact?.currentVersionIndex, activeArtifact?.content]);

  const svgDataUrl = useMemo(() => {
    if (!previewSource || !previewSource.includes('<svg')) return '';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(previewSource);
  }, [previewSource]);

  const commitNewVersion = (
    newContent: string,
    label: string,
    newKind?: ArtifactKind,
    newLang?: string,
  ) => {
    if (!activeArtifact) return;
    const nextVersionNum = activeArtifact.versions.length + 1;
    const nextVersions: ArtifactVersion[] = [
      ...activeArtifact.versions,
      {
        versionNumber: nextVersionNum,
        label,
        content: newContent,
        timestamp: Date.now(),
      },
    ];
    const updated: CanvasArtifact = {
      ...activeArtifact,
      kind: newKind || activeArtifact.kind,
      language: newLang || (newKind === 'html' ? 'html' : activeArtifact.language),
      content: newContent,
      versions: nextVersions,
      currentVersionIndex: nextVersions.length - 1,
    };
    onUpdateArtifact(updated);
    setEditorDraft(newContent);
    setHasUnsavedEdits(false);
    setInspectedElement(null);
    setIframeRefreshKey((k) => k + 1);
  };

  const handleSaveManualEdits = () => {
    if (!activeArtifact || !hasUnsavedEdits) return;
    commitNewVersion(editorDraft, 'Manual Code Edit');
  };

  const handleSelectVersion = (versionIdx: number) => {
    if (!activeArtifact) return;
    const targetVer = activeArtifact.versions[versionIdx];
    if (!targetVer) return;
    const updated: CanvasArtifact = {
      ...activeArtifact,
      content: targetVer.content,
      currentVersionIndex: versionIdx,
    };
    onUpdateArtifact(updated);
    setEditorDraft(targetVer.content);
    setHasUnsavedEdits(false);
    setIframeRefreshKey((k) => k + 1);
  };

  const handleCopyArtifact = async () => {
    const textToCopy = hasUnsavedEdits ? editorDraft : activeArtifact?.content || '';
    if (!textToCopy) return;
    const ok = await copyToClipboard(textToCopy);
    if (ok) {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleDownloadArtifact = () => {
    if (!activeArtifact) return;
    const contentToSave = hasUnsavedEdits ? editorDraft : activeArtifact.content;
    const extMap: Record<ArtifactKind, string> = {
      html: 'html',
      svg: 'svg',
      react: 'tsx',
      markdown: 'md',
      code: activeArtifact.language || 'txt',
    };
    const ext = extMap[activeArtifact.kind] || 'txt';
    const mimeMap: Record<string, string> = {
      html: 'text/html;charset=utf-8',
      svg: 'image/svg+xml;charset=utf-8',
      md: 'text/markdown;charset=utf-8',
    };
    const mime = mimeMap[ext] || 'text/plain;charset=utf-8';
    const blob = new Blob([contentToSave], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeTitle = activeArtifact.title
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '_')
      .slice(0, 32);
    a.href = url;
    a.download = `${safeTitle || 'nexus_artifact'}_v${activeArtifact.currentVersionIndex + 1}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  // Feature 6: High-Res PNG Snapshot Exporter
  const handleExportPngSnapshot = () => {
    if (!activeArtifact) return;
    const contentToRender = hasUnsavedEdits ? editorDraft : activeArtifact.content;
    const safeTitle = activeArtifact.title
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '_')
      .slice(0, 28);

    if (activeArtifact.kind === 'svg' && contentToRender.includes('<svg')) {
      const svgBlob = new Blob([contentToRender], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1200, img.width * 2);
        canvas.height = Math.max(700, img.height * 2);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#09090b';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const pngUrl = canvas.toDataURL('image/png');
          const a = document.createElement('a');
          a.href = pngUrl;
          a.download = `${safeTitle}_snapshot.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
        URL.revokeObjectURL(url);
      };
      img.src = url;
      return;
    }

    // Render visual card snapshot onto high-DPI canvas
    const canvas = document.createElement('canvas');
    canvas.width = 1400;
    canvas.height = 900;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 3;
    ctx.strokeRect(24, 24, canvas.width - 48, canvas.height - 48);

    ctx.fillStyle = '#22d3ee';
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.fillText(`NEXUS LIVE AI CANVAS • ${activeArtifact.title}`, 56, 78);

    ctx.fillStyle = '#a1a1aa';
    ctx.font = '16px monospace';
    ctx.fillText(
      `Type: ${activeArtifact.kind.toUpperCase()} | Version: v${activeArtifact.currentVersionIndex + 1} | Exported: ${new Date().toLocaleString()}`,
      56,
      112,
    );

    ctx.fillStyle = '#e4e4e7';
    ctx.font = '15px monospace';
    const previewLines = contentToRender.split('\n').slice(0, 32);
    previewLines.forEach((line, i) => {
      ctx.fillText(line.slice(0, 105), 56, 160 + i * 22);
    });

    const pngUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = pngUrl;
    a.download = `${safeTitle}_snapshot.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Feature 8: Save / Remove Artifact in Persistent Vault
  const handleSaveToVault = () => {
    if (!activeArtifact) return;
    const itemToSave: CanvasArtifact = {
      ...activeArtifact,
      id: `vault-${Date.now()}`,
      content: hasUnsavedEdits ? editorDraft : activeArtifact.content,
    };
    const next = [itemToSave, ...vaultArtifacts.filter((v) => v.title !== itemToSave.title)].slice(
      0,
      30,
    );
    const success = saveVaultArtifacts(next);
    if (success) {
      setVaultArtifacts(next);
      setVaultError(null);
      setSavedToVaultNotice(true);
      setTimeout(() => setSavedToVaultNotice(false), 2000);
    } else {
      setVaultError('Could not save: browser storage is full. Delete old vault items and try again.');
      setTimeout(() => setVaultError(null), 4000);
    }
  };

  const handleDeleteVaultItem = (id: string) => {
    const next = vaultArtifacts.filter((v) => v.id !== id);
    setVaultArtifacts(next);
    saveVaultArtifacts(next);
  };

  const handleSyncBackToChat = () => {
    if (!activeArtifact || !onSyncToMessage) return;
    const latest = hasUnsavedEdits
      ? { ...activeArtifact, content: editorDraft }
      : activeArtifact;
    onSyncToMessage(activeArtifact.messageIndex, latest);
    setSyncedNotice(true);
    setTimeout(() => setSyncedNotice(false), 2200);
  };

  // Feature 10: Voice-to-Canvas Mic Dictation & Neural Audio Walkthrough
  const handleToggleMic = () => {
    if (isListeningMic && speechRecRef.current) {
      speechRecRef.current.stop();
      setIsListeningMic(false);
      return;
    }

    const SpeechRec =
      (window as unknown as { SpeechRecognition?: new () => unknown; webkitSpeechRecognition?: new () => unknown })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => unknown }).webkitSpeechRecognition;

    if (!SpeechRec) {
      setAiError('Voice dictation is not supported in this browser.');
      return;
    }

    try {
      const rec = new SpeechRec() as {
        lang: string;
        continuous: boolean;
        interimResults: boolean;
        onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
        onerror: (() => void) | null;
        onend: (() => void) | null;
        start: () => void;
        stop: () => void;
      };
      rec.lang = 'en-US';
      rec.continuous = false;
      rec.interimResults = false;
      rec.onresult = (event) => {
        const transcript = event.results?.[0]?.[0]?.transcript || '';
        if (transcript) {
          setCustomAiPrompt((prev) => (prev ? `${prev} ${transcript}` : transcript));
        }
      };
      rec.onerror = () => setIsListeningMic(false);
      rec.onend = () => setIsListeningMic(false);
      speechRecRef.current = rec;
      setIsListeningMic(true);
      rec.start();
    } catch {
      setIsListeningMic(false);
    }
  };

  const handleExplainArtifactAudio = async () => {
    if (!activeArtifact) return;
    if (isExplainingAudio) {
      if (explainAudioRef.current) {
        explainAudioRef.current.pause();
        explainAudioRef.current = null;
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setIsExplainingAudio(false);
      return;
    }

    setExplainingLoading(true);
    try {
      const sourceText = (hasUnsavedEdits ? editorDraft : activeArtifact.content).slice(0, 2600);
      const explainPrompt = `In 3 concise, clear spoken sentences, explain what this ${activeArtifact.kind} artifact ("${activeArtifact.title}") does and how its key parts work:\n\n${sourceText}`;
      const res = await api.aiChat(explainPrompt, [], '', effectiveCanvasProvider, false, {
        language: responseLanguage || undefined,
        maxTokens: 350,
      });
      const spokenText = cleanMarkdownForSpeech(res.answer || activeArtifact.title);

      const ttsRes = await fetch('/api/edge-tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: spokenText.slice(0, 1500),
          voice: 'en-US-AriaNeural',
        }),
      });

      if (ttsRes.ok) {
        const blob = await ttsRes.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        explainAudioRef.current = audio;
        audio.onplay = () => {
          setIsExplainingAudio(true);
          setExplainingLoading(false);
        };
        audio.onended = () => {
          setIsExplainingAudio(false);
          URL.revokeObjectURL(url);
        };
        audio.onerror = () => {
          setIsExplainingAudio(false);
          URL.revokeObjectURL(url);
        };
        await audio.play();
      } else if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        setExplainingLoading(false);
        setIsExplainingAudio(true);
        const utt = new SpeechSynthesisUtterance(spokenText);
        utt.onend = () => setIsExplainingAudio(false);
        utt.onerror = () => setIsExplainingAudio(false);
        window.speechSynthesis.speak(utt);
      }
    } catch {
      setExplainingLoading(false);
      setIsExplainingAudio(false);
    }
  };

  const handleRunAiRefinement = async (
    instruction: string,
    shortLabel: string,
    forceHtmlOutput = false,
    targetKindOverride?: ArtifactKind,
    targetLangOverride?: string,
  ) => {
    if (!activeArtifact || aiRefining) return;
    setAiRefining(true);
    setAiRefiningLabel(shortLabel);
    setAiError(null);
    setAiWarning(null);
    liveCodingSkipRef.current = false;
    setLiveCodingActive(true);
    setLiveCodingPhase('planning');
    setLiveCodingStatusText(`Analyzing "${activeArtifact.title}" & planning AST transformations...`);

    const sourceContent = hasUnsavedEdits ? editorDraft : activeArtifact.content;
    const sourceLines = sourceContent.split('\n');
    setLiveCodingTotalLen(sourceContent.length);

    // Stage 1: Progressive live code inspection stream while waiting for AI response
    let preStreamIdx = 0;
    const preStreamHeader = [
      `// ⚡ NEXUS LIVE AI CANVAS COMPILER — ${shortLabel.toUpperCase()}`,
      `// 🤖 Model: ${activeCanvasModelLabel}`,
      `// 🎯 Directive: ${instruction.slice(0, 90)}${instruction.length > 90 ? '...' : ''}`,
      ``,
      ...sourceLines.slice(0, 90),
    ];
    const preTimer = window.setInterval(() => {
      preStreamIdx = Math.min(preStreamHeader.length, preStreamIdx + 2);
      setLiveCodingBuffer(preStreamHeader.slice(0, preStreamIdx).join('\n'));
      if (preStreamIdx > 8) {
        setLiveCodingStatusText(`Synthesizing updated ${targetLangOverride || activeArtifact.kind.toUpperCase()} code with ${activeCanvasModelLabel}...`);
      }
    }, 65);

    const inspectContext = inspectedElement
      ? `\nFOCUS SPECIFICALLY ON THIS CLICKED ELEMENT (<${inspectedElement.tagName}>): ${inspectedElement.outerHTML}\n`
      : '';
    const targetFormat = targetLangOverride
      ? `complete, production-ready ${targetLangOverride.toUpperCase()} code`
      : forceHtmlOutput
      ? 'a complete, self-contained, single-file HTML5 interactive web application using Tailwind CSS (<script src="https://cdn.tailwindcss.com"></script>) and vanilla JavaScript'
      : activeArtifact.kind === 'html'
      ? 'a complete, self-contained HTML5 document with Tailwind CSS and interactive JavaScript'
      : activeArtifact.kind === 'svg'
      ? 'valid, standalone <svg>...</svg> markup with rich visual styling'
      : activeArtifact.kind === 'markdown'
      ? 'clean, well-structured Markdown'
      : `clean, production-ready ${activeArtifact.language || 'code'}`;

    const prompt = [
      `You are the NEXUS Live AI Canvas Studio engine.`,
      `Task: ${instruction}`,
      inspectContext,
      `Output format requirement: Return ONLY ${targetFormat}. Do NOT include conversational filler before or after the artifact. If returning code/HTML/SVG, wrap it in a single fenced block or return raw markup directly.`,
      ``,
      `--- CURRENT ARTIFACT (${activeArtifact.title}) ---`,
      sourceContent,
    ].join('\n');

    try {
      const response = await api.aiChat(
        prompt,
        [],
        '',
        effectiveCanvasProvider,
        false,
        {
          language: responseLanguage || undefined,
          maxTokens: CANVAS_MAX_OUTPUT_TOKENS,
          timeoutMs: CANVAS_AI_TIMEOUT_MS,
        },
      );

      window.clearInterval(preTimer);

      const { code: extracted, truncated } = extractArtifactFromAnswer(response.answer || '');

      if (!extracted) {
        throw new Error('AI returned an empty artifact response.');
      }

      if (truncated) {
        window.clearInterval(preTimer);
        setLiveCodingActive(false);
        setEditorDraft(extracted);
        setHasUnsavedEdits(true);
        if (activeTab !== 'split') {
          setActiveTab('code');
        }
        setAiWarning(
          "The AI answer was cut off (token limit), so it was NOT saved as a new version. Review the code, or try a smaller change. Use 'Save edits' only if the code looks complete.",
        );
        return;
      }

      const nextKind: ArtifactKind =
        targetKindOverride ||
        (forceHtmlOutput ||
        extracted.includes('<!DOCTYPE html') ||
        (extracted.includes('<html') && extracted.includes('</html>'))
          ? 'html'
          : extracted.startsWith('<svg')
          ? 'svg'
          : activeArtifact.kind);

      // Stage 2: Stream the generated code live into the Live Coding Terminal & Editor
      await streamCodeIntoCanvas(extracted, (partial) => {
        setEditorDraft(partial);
      });

      commitNewVersion(extracted, shortLabel, nextKind, targetLangOverride);
      if (forceHtmlOutput || nextKind === 'html' || nextKind === 'svg') {
        if (activeTab !== 'split') setActiveTab('preview');
      } else if (targetKindOverride) {
        setActiveTab('code');
      }
    } catch (err) {
      window.clearInterval(preTimer);
      setLiveCodingActive(false);
      setAiError(err instanceof Error ? err.message : 'Failed to refine artifact with AI');
    } finally {
      window.clearInterval(preTimer);
      setAiRefining(false);
      setAiRefiningLabel('');
    }
  };

  const handleCreateArtifactFromPrompt = async (userPrompt: string) => {
    if (aiRefining) return;
    setAiRefining(true);
    setAiRefiningLabel(`Building: ${userPrompt.slice(0, 28)}`);
    setAiError(null);
    setAiWarning(null);
    liveCodingSkipRef.current = false;
    setLiveCodingActive(true);
    setLiveCodingPhase('planning');
    setLiveCodingStatusText(`Architecting new application from prompt with ${activeCanvasModelLabel}...`);

    const isSvgRequest = /\b(svg|diagram|flowchart|blueprint|vector)\b/i.test(userPrompt);
    const bootstrapScaffold = isSvgRequest
      ? [
          `<!-- ⚡ NEXUS LIVE AI CANVAS COMPILER -->`,
          `<!-- 🤖 Model: ${activeCanvasModelLabel} -->`,
          `<!-- 🎯 Prompt: ${userPrompt.slice(0, 80)} -->`,
          `<svg viewBox="0 0 800 420" xmlns="http://www.w3.org/2000/svg" style="background:#09090b;font-family:system-ui,sans-serif">`,
          `  <defs>`,
          `    <linearGradient id="nexusGrad" x1="0%" y1="0%" x2="100%" y2="100%">`,
          `      <stop offset="0%" stop-color="#06b6d4" />`,
          `      <stop offset="100%" stop-color="#6366f1" />`,
          `    </linearGradient>`,
          `  </defs>`,
          `  <!-- Synthesizing vector topology & nodes... -->`,
        ]
      : [
          `<!DOCTYPE html>`,
          `<html lang="en" class="dark">`,
          `<head>`,
          `  <meta charset="UTF-8" />`,
          `  <meta name="viewport" content="width=device-width, initial-scale=1.0" />`,
          `  <title>${userPrompt.slice(0, 42)}</title>`,
          `  <script src="https://cdn.tailwindcss.com"></script>`,
          `</head>`,
          `<body class="bg-zinc-950 text-zinc-100 min-h-screen p-6 font-sans">`,
          `  <!-- ⚡ NEXUS Live AI Canvas Studio (${activeCanvasModelLabel}) -->`,
          `  <!-- 🎯 Building: ${userPrompt.slice(0, 80)} -->`,
          `  <main class="max-w-4xl mx-auto space-y-6">`,
        ];

    setLiveCodingTotalLen(1800);
    let bootIdx = 0;
    const bootTimer = window.setInterval(() => {
      bootIdx = Math.min(bootstrapScaffold.length, bootIdx + 1);
      setLiveCodingBuffer(bootstrapScaffold.slice(0, bootIdx).join('\n'));
      if (bootIdx >= 4) {
        setLiveCodingStatusText(`Generating interactive components & logic with ${activeCanvasModelLabel}...`);
      }
    }, 90);

    const prompt = [
      `You are the NEXUS Live AI Canvas Studio engine.`,
      `User Request: ${userPrompt}`,
      isSvgRequest
        ? `Output format requirement: Return ONLY valid, standalone <svg>...</svg> markup with rich dark-mode visual styling. No conversational text.`
        : `Output format requirement: Build a complete, self-contained, single-file HTML5 interactive web application using Tailwind CSS (<script src="https://cdn.tailwindcss.com"></script>) and vanilla JavaScript. Return ONLY the HTML code.`,
    ].join('\n');

    try {
      const response = await api.aiChat(
        prompt,
        [],
        '',
        effectiveCanvasProvider,
        false,
        {
          language: responseLanguage || undefined,
          maxTokens: CANVAS_MAX_OUTPUT_TOKENS,
          timeoutMs: CANVAS_AI_TIMEOUT_MS,
        },
      );

      window.clearInterval(bootTimer);

      const { code: extracted, truncated } = extractArtifactFromAnswer(response.answer || '');
      if (!extracted) {
        throw new Error('AI returned an empty response.');
      }

      if (truncated) {
        setAiWarning(
          'The AI answer looks cut off, so the code may be incomplete. Try a shorter request or ask the AI to continue.',
        );
      }

      // Stream the newly generated application code live into the Live Coding Terminal
      await streamCodeIntoCanvas(extracted);

      const kind: ArtifactKind = extracted.startsWith('<svg') ? 'svg' : 'html';
      const now = Date.now();
      const created: CanvasArtifact = {
        id: `ai-canvas-${now}`,
        messageIndex: -1,
        title: userPrompt.slice(0, 38),
        kind,
        language: kind,
        content: extracted,
        versions: [
          {
            versionNumber: 1,
            label: 'AI Generated Artifact',
            content: extracted,
            timestamp: now,
          },
        ],
        currentVersionIndex: 0,
        createdAt: now,
      };
      onCreateArtifact(created);
      setActiveTab('preview');
    } catch (err) {
      window.clearInterval(bootTimer);
      setLiveCodingActive(false);
      setAiError(err instanceof Error ? err.message : 'Failed to generate artifact with AI');
    } finally {
      window.clearInterval(bootTimer);
      setAiRefining(false);
      setAiRefiningLabel('');
    }
  };

  // Feature 4: Apply edited Data Playground table into the artifact
  const handleInjectTableDataIntoArtifact = () => {
    if (!activeArtifact) return;
    const mdTable = [
      `| ${dataHeaders.join(' | ')} |`,
      `| ${dataHeaders.map(() => '---').join(' | ')} |`,
      ...dataRows.map((r) => `| ${r.join(' | ')} |`),
    ].join('\n');

    if (activeArtifact.kind === 'markdown') {
      commitNewVersion(`${activeArtifact.content}\n\n### Updated Data Table\n${mdTable}`, 'Updated Data Table');
      setActiveTab('preview');
    } else {
      handleRunAiRefinement(
        `Update the data inside this artifact to use these exact table records:\n${mdTable}`,
        'Injected Data Table',
      );
    }
  };

  // Compute simple line diff between previous version and current version
  const diffLines = useMemo(() => {
    if (!activeArtifact) return [];
    const currText = hasUnsavedEdits ? editorDraft : activeArtifact.content;
    const prevVersion =
      activeArtifact.currentVersionIndex > 0
        ? activeArtifact.versions[activeArtifact.currentVersionIndex - 1]
        : activeArtifact.versions[0];
    const prevText = prevVersion ? prevVersion.content : '';

    const prevArr = prevText.split('\n');
    const currArr = currText.split('\n');
    const maxLen = Math.max(prevArr.length, currArr.length);
    const rows: Array<{
      lineNum: number;
      type: 'same' | 'added' | 'removed' | 'modified';
      oldLine?: string;
      newLine?: string;
    }> = [];

    for (let i = 0; i < maxLen; i++) {
      const o = prevArr[i];
      const n = currArr[i];
      if (o === n) {
        rows.push({ lineNum: i + 1, type: 'same', newLine: n });
      } else if (o === undefined && n !== undefined) {
        rows.push({ lineNum: i + 1, type: 'added', newLine: n });
      } else if (o !== undefined && n === undefined) {
        rows.push({ lineNum: i + 1, type: 'removed', oldLine: o });
      } else {
        rows.push({ lineNum: i + 1, type: 'modified', oldLine: o, newLine: n });
      }
    }
    return rows;
  }, [activeArtifact, editorDraft, hasUnsavedEdits]);

  const lineCount = (hasUnsavedEdits ? editorDraft : activeArtifact?.content || '').split('\n').length;

  if (!isOpen) return null;

  const renderLivePreviewSurface = () => {
    if (!activeArtifact) return null;
    if (isRunnableWeb) {
      return (
        <div
          className={`h-full min-h-[360px] rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950 shadow-2xl transition-all duration-200 ${
            viewportSize === 'mobile'
              ? 'w-[375px]'
              : viewportSize === 'tablet'
              ? 'w-[768px]'
              : 'w-full'
          }`}
        >
          <iframe
            key={`${activeArtifact.id}-${activeArtifact.currentVersionIndex}-${iframeRefreshKey}-${inspectMode}-${selectedThemePreset}`}
            ref={iframeRef}
            title={activeArtifact.title}
            sandbox="allow-scripts allow-modals allow-forms"
            srcDoc={buildRunnableSandboxHtml(
              {
                ...activeArtifact,
                content: previewSource,
              },
              inspectMode,
              activeThemePresetObj.cssOverride,
            )}
            className="w-full h-full min-h-[420px] border-0 bg-zinc-950"
          />
        </div>
      );
    }
    if (isSvg) {
      const isValid = previewSource.includes('<svg');
      return (
        <div className="w-full h-full min-h-[340px] flex items-center justify-center overflow-auto p-4 rounded-xl border border-zinc-800/80 bg-[#0c0c10]">
          {isValid ? (
            <img
              src={svgDataUrl}
              alt={activeArtifact.title}
              draggable={false}
              style={{
                transform: `scale(${svgZoom / 100})`,
                transformOrigin: 'center center',
              }}
              className="transition-transform duration-150 max-w-full"
            />
          ) : (
            <p className="text-xs text-zinc-400">This is not valid SVG markup.</p>
          )}
        </div>
      );
    }
    return (
      <div className="w-full max-w-3xl mx-auto p-4 sm:p-6 rounded-xl bg-zinc-900/70 border border-zinc-800/90 text-sm text-zinc-200 leading-relaxed">
        {activeArtifact.kind === 'markdown' ? (
          <FormattedText content={previewSource} />
        ) : (
          <FormattedText
            content={`\`\`\`${activeArtifact.language || 'text'}\n${previewSource}\n\`\`\``}
          />
        )}
      </div>
    );
  };

  return (
    <div
      role="dialog"
      aria-label="Live AI Canvas & Interactive Artifact Studio"
      style={{ zIndex: 1100 }}
      className={`fixed top-0 right-0 bottom-0 h-[100dvh] max-h-[100dvh] flex flex-col border-l shadow-2xl transition-all duration-200 overflow-hidden ${
        isFullscreen ? 'w-full left-0' : 'w-full lg:w-[54%] xl:w-[56%]'
      } ${
        theme === 'classic'
          ? 'bg-[#050c16]/98 border-cyan-500/35 text-slate-100 backdrop-blur-xl'
          : theme === 'fulldark'
          ? 'bg-[#0a0a0c] border-[#262626] text-[#ececec]'
          : 'bg-[#121215]/98 border-zinc-800 text-zinc-100 backdrop-blur-xl'
      }`}
    >
      {/* Top Studio Header Bar */}
      <div
        className={`px-3 sm:px-4 py-2.5 border-b flex items-center justify-between gap-2 shrink-0 ${
          theme === 'classic'
            ? 'border-cyan-500/25 bg-slate-950/80'
            : theme === 'fulldark'
            ? 'border-[#222] bg-[#0f0f12]'
            : 'border-zinc-800/90 bg-zinc-950/80'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center border shrink-0 ${
              theme === 'classic'
                ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                : 'bg-indigo-500/15 border-indigo-500/35 text-indigo-300'
            }`}
          >
            <Layout size={15} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-xs sm:text-sm font-bold tracking-tight text-white truncate">
                Live AI Canvas Studio
              </h2>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-zinc-400 font-mono">
              <span>{artifacts.length} Artifacts</span>
              {activeArtifact && (
                <>
                  <span>·</span>
                  <span className="text-cyan-400">
                    v{activeArtifact.currentVersionIndex + 1}/{activeArtifact.versions.length}
                  </span>
                  <span className="hidden sm:inline">·</span>
                  <span className="hidden sm:inline">{lineCount} lines</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right Controls: Audio Walkthrough, Save Vault, PNG Snapshot, Export, Sync, Fullscreen, Close */}
        <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
          {activeArtifact && (
            <>
              {/* Feature 10: Audio Walkthrough ("Explain App") */}
              <button
                type="button"
                onClick={handleExplainArtifactAudio}
                disabled={explainingLoading}
                className={`p-1.5 sm:px-2 sm:py-1 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1 cursor-pointer ${
                  isExplainingAudio
                    ? 'bg-purple-500/20 border-purple-500/40 text-purple-300'
                    : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-700/80 text-zinc-200'
                }`}
                title="AI Voice Walkthrough: Explain how this artifact works aloud"
              >
                {explainingLoading ? (
                  <Loader2 size={13} className="animate-spin text-purple-400" />
                ) : isExplainingAudio ? (
                  <VolumeX size={13} className="text-purple-400 animate-pulse" />
                ) : (
                  <Volume2 size={13} className="text-purple-400" />
                )}
                <span className="hidden xl:inline">
                  {isExplainingAudio ? 'Stop' : 'Explain'}
                </span>
              </button>

              {/* Feature 8: Save to Persistent Canvas Vault */}
              <div className="relative inline-flex items-center">
                <button
                  type="button"
                  onClick={handleSaveToVault}
                  className={`p-1.5 sm:px-2 sm:py-1 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1 cursor-pointer ${
                    savedToVaultNotice
                      ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                      : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-700/80 text-zinc-200'
                  }`}
                  title="Save artifact to persistent Canvas Vault across sessions"
                >
                  <Bookmark
                    size={13}
                    className={savedToVaultNotice ? 'fill-amber-400 text-amber-400' : 'text-amber-400'}
                  />
                  <span className="hidden xl:inline">
                    {savedToVaultNotice ? 'Saved' : 'Vault'}
                  </span>
                </button>
                {vaultError && (
                  <div
                    role="alert"
                    className="absolute right-0 top-full mt-1.5 z-50 w-60 sm:w-64 p-2 rounded-lg bg-amber-950/95 border border-amber-500/50 shadow-2xl text-[11px] text-amber-200 leading-snug flex items-start gap-1.5"
                  >
                    <AlertTriangle size={13} className="text-amber-400 shrink-0 mt-0.5" />
                    <span>{vaultError}</span>
                  </div>
                )}
              </div>

              {/* Feature 6: High-Res PNG Snapshot */}
              <button
                type="button"
                onClick={handleExportPngSnapshot}
                className="p-1.5 sm:px-2 sm:py-1 rounded-lg text-xs font-medium bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-zinc-200 transition-colors flex items-center gap-1 cursor-pointer"
                title="Download high-resolution PNG snapshot"
              >
                <Camera size={13} className="text-emerald-400" />
                <span className="hidden xl:inline">PNG</span>
              </button>

              <button
                type="button"
                onClick={handleCopyArtifact}
                className={`p-1.5 sm:px-2 sm:py-1 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1 cursor-pointer ${
                  copiedCode
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                    : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-700/80 text-zinc-200'
                }`}
                title="Copy artifact source"
              >
                {copiedCode ? (
                  <Check size={13} className="text-emerald-400" />
                ) : (
                  <Copy size={13} />
                )}
                <span className="hidden sm:inline">{copiedCode ? 'Copied' : 'Copy'}</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadArtifact}
                className="p-1.5 sm:px-2 sm:py-1 rounded-lg text-xs font-medium bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-zinc-200 transition-colors flex items-center gap-1 cursor-pointer"
                title="Download standalone file"
              >
                <Download size={13} className="text-cyan-400" />
                <span className="hidden sm:inline">Export</span>
              </button>
            </>
          )}

          {activeArtifact && onSyncToMessage && activeArtifact.messageIndex >= 0 && (
            <button
              type="button"
              onClick={handleSyncBackToChat}
              className={`p-1.5 sm:px-2 sm:py-1 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1 cursor-pointer ${
                syncedNotice
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                  : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-700/80 text-zinc-200'
              }`}
              title="Sync current Canvas version back to the chat message"
            >
              {syncedNotice ? (
                <Check size={13} className="text-emerald-400" />
              ) : (
                <ArrowUpRight size={13} className="text-cyan-400" />
              )}
              <span className="hidden md:inline">{syncedNotice ? 'Synced' : 'Sync'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsFullscreen((prev) => !prev)}
            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-zinc-300 hover:text-white transition-colors cursor-pointer hidden sm:flex"
            title={isFullscreen ? 'Restore Split-Screen View' : 'Expand Canvas to Fullscreen'}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-rose-950/60 border border-zinc-700/80 hover:border-rose-500/40 text-zinc-300 hover:text-rose-200 transition-colors cursor-pointer"
            title="Close Live AI Canvas"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Artifact Selector Bar + Version Selector */}
      <div
        className={`px-3 sm:px-4 py-2 border-b flex items-center justify-between gap-2 flex-wrap shrink-0 ${
          theme === 'classic'
            ? 'border-cyan-500/20 bg-slate-900/60'
            : 'border-zinc-800/80 bg-zinc-900/50'
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <Layers size={13} className="text-cyan-400 shrink-0" />
          <select
            value={activeArtifact?.id || ''}
            onChange={(e) => onSelectArtifact(e.target.value)}
            className="min-w-0 flex-1 max-w-xs sm:max-w-md rounded-lg bg-zinc-950 border border-zinc-700/80 px-2 py-1 text-xs text-zinc-100 outline-none focus:border-cyan-500 cursor-pointer"
          >
            {artifacts.map((art, idx) => (
              <option key={art.id} value={art.id}>
                {idx + 1}. [{art.kind.toUpperCase()}] {art.title}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setActiveTab('templates')}
            className={`px-2 py-1 rounded-lg text-xs font-medium border flex items-center gap-1 transition-colors cursor-pointer shrink-0 ${
              activeTab === 'templates'
                ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-200'
                : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-700/80 text-zinc-300'
            }`}
            title="Templates & Saved Vault"
          >
            <Plus size={12} />
            <span>Vault ({vaultArtifacts.length})</span>
          </button>

          {/* Select AI Model Button in Sub-Toolbar */}
          <button
            type="button"
            onClick={handleOpenModelModal}
            className={`px-2 py-1 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 ${
              canvasProviderId !== 'session'
                ? 'bg-purple-500/20 border-purple-500/50 text-purple-200'
                : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-700/80 text-zinc-200'
            }`}
            title="Select AI Provider & Model for Live AI Canvas Studio"
          >
            <Cpu size={12} className="text-purple-400 shrink-0" />
            <span className="truncate max-w-[110px] sm:max-w-[150px] font-mono text-[11px]">
              {activeCanvasModelLabel}
            </span>
          </button>
        </div>

        {/* Version History Pills */}
        {activeArtifact && activeArtifact.versions.length > 0 && (
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            <History size={12} className="text-zinc-400 mr-0.5 shrink-0" />
            {activeArtifact.versions.map((ver, vIdx) => {
              const isCurrent = vIdx === activeArtifact.currentVersionIndex;
              return (
                <button
                  key={`${ver.versionNumber}-${vIdx}`}
                  type="button"
                  onClick={() => handleSelectVersion(vIdx)}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-mono transition-colors cursor-pointer shrink-0 ${
                    isCurrent
                      ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/50 font-semibold'
                      : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                  }`}
                  title={`${ver.label} (${new Date(ver.timestamp).toLocaleTimeString()})`}
                >
                  v{ver.versionNumber}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Mode Switcher Tabs + Viewport & Inspector Controls */}
      <div className="px-3 sm:px-4 py-1.5 border-b border-zinc-800/80 bg-zinc-950/60 flex items-center justify-between gap-2 flex-wrap shrink-0">
        <div className="flex items-center gap-0.5 p-1 rounded-xl bg-zinc-900/90 border border-zinc-800 overflow-x-auto no-scrollbar max-w-full">
          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer shrink-0 ${
              activeTab === 'preview'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Eye size={12} className={activeTab === 'preview' ? 'text-cyan-400' : ''} />
            <span>Preview</span>
          </button>

          {/* Feature 9: Split Code + Live Preview Tab */}
          <button
            type="button"
            onClick={() => setActiveTab('split')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer shrink-0 ${
              activeTab === 'split'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            title="Side-by-Side / Stacked Live Code + Preview"
          >
            <Columns size={12} className={activeTab === 'split' ? 'text-indigo-400' : ''} />
            <span>Split</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('code')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer shrink-0 ${
              activeTab === 'code'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Code2 size={12} className={activeTab === 'code' ? 'text-emerald-400' : ''} />
            <span>Code</span>
            {hasUnsavedEdits && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Unsaved edits" />
            )}
          </button>

          {/* Feature 4: Interactive Data & Table Playground Tab */}
          <button
            type="button"
            onClick={() => setActiveTab('data')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer shrink-0 ${
              activeTab === 'data'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            title="Interactive Data Table & Mock Data Playground"
          >
            <Table size={12} className={activeTab === 'data' ? 'text-amber-400' : ''} />
            <span>Data</span>
          </button>

          {/* Feature 7: Security, Performance & WCAG Auditor Tab */}
          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer shrink-0 ${
              activeTab === 'audit'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            title="Security, Performance & Accessibility Scorecard"
          >
            <ShieldCheck size={12} className={activeTab === 'audit' ? 'text-emerald-400' : ''} />
            <span>Audit</span>
            {staticAuditReport && (
              <span className="text-[10px] font-mono text-emerald-400">
                {staticAuditReport.overallScore}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('diff')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer shrink-0 ${
              activeTab === 'diff'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <GitCompare size={12} className={activeTab === 'diff' ? 'text-purple-400' : ''} />
            <span>Diff</span>
          </button>

          {/* Watch Live Coding Process Button */}
          {activeArtifact && (
            <button
              type="button"
              disabled={aiRefining || liveCodingActive}
              onClick={handleWatchLiveCodeReplay}
              className="px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer shrink-0 text-cyan-300 hover:bg-cyan-500/15 hover:text-cyan-200 disabled:opacity-40"
              title="Watch the Live Coding Process step-by-step in real time"
            >
              <Play size={11} className="text-cyan-400 fill-cyan-400/30" />
              <span>Live Code</span>
            </button>
          )}
        </div>

        {/* Right contextual controls for Preview / Split / Code */}
        {(activeTab === 'preview' || activeTab === 'split') && isRunnableWeb && (
          <div className="flex items-center gap-1 flex-wrap">
            {/* Feature 3: Visual Element Inspector ("Click-to-Edit") */}
            <button
              type="button"
              onClick={() => {
                setInspectMode((prev) => !prev);
                if (inspectMode) setInspectedElement(null);
              }}
              className={`px-2 py-1 rounded-lg text-xs font-medium border flex items-center gap-1 transition-colors cursor-pointer ${
                inspectMode
                  ? 'bg-cyan-500/20 border-cyan-400/60 text-cyan-200'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
              title="Click-to-Edit Inspector: Click any element in the live preview to target it with AI"
            >
              <Crosshair size={12} className={inspectMode ? 'text-cyan-300 animate-pulse' : ''} />
              <span className="hidden sm:inline">Inspect</span>
            </button>

            <div className="hidden sm:flex items-center gap-0.5 p-0.5 rounded-lg bg-zinc-900 border border-zinc-800">
              <button
                type="button"
                onClick={() => setViewportSize('desktop')}
                className={`p-1 rounded-md transition-colors cursor-pointer ${
                  viewportSize === 'desktop'
                    ? 'bg-zinc-800 text-cyan-300'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
                title="Desktop Viewport (100%)"
              >
                <Monitor size={12} />
              </button>
              <button
                type="button"
                onClick={() => setViewportSize('tablet')}
                className={`p-1 rounded-md transition-colors cursor-pointer ${
                  viewportSize === 'tablet'
                    ? 'bg-zinc-800 text-cyan-300'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
                title="Tablet Viewport (768px)"
              >
                <Tablet size={12} />
              </button>
              <button
                type="button"
                onClick={() => setViewportSize('mobile')}
                className={`p-1 rounded-md transition-colors cursor-pointer ${
                  viewportSize === 'mobile'
                    ? 'bg-zinc-800 text-cyan-300'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
                title="Mobile Viewport (375px)"
              >
                <Smartphone size={12} />
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setConsoleLogs([]);
                setIframeRefreshKey((k) => k + 1);
              }}
              className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white transition-colors cursor-pointer"
              title="Reload Live Sandbox"
            >
              <RefreshCw size={12} />
            </button>

            <button
              type="button"
              onClick={() => setShowConsole((prev) => !prev)}
              className={`px-2 py-1 rounded-lg text-xs font-mono border flex items-center gap-1 transition-colors cursor-pointer ${
                showConsole
                  ? 'bg-zinc-800 border-cyan-500/40 text-cyan-300'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
              title="Toggle Sandbox Console Output"
            >
              <Terminal size={11} />
              <span>{consoleLogs.length}</span>
            </button>
          </div>
        )}

        {(activeTab === 'preview' || activeTab === 'split') && isSvg && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSvgZoom((z) => Math.max(40, z - 20))}
              className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300"
              title="Zoom Out"
            >
              <ZoomOut size={12} />
            </button>
            <span className="text-xs font-mono text-zinc-300 px-1">{svgZoom}%</span>
            <button
              type="button"
              onClick={() => setSvgZoom((z) => Math.min(260, z + 20))}
              className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300"
              title="Zoom In"
            >
              <ZoomIn size={12} />
            </button>
          </div>
        )}

        {(activeTab === 'code' || activeTab === 'split') && hasUnsavedEdits && (
          <button
            type="button"
            onClick={handleSaveManualEdits}
            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1 shadow-sm cursor-pointer"
          >
            <CheckCircle2 size={12} />
            <span>Save v{(activeArtifact?.versions.length || 1) + 1}</span>
          </button>
        )}
      </div>

      {/* 1-Click AI Refinement + Theme Preset + Framework Converter Bar */}
      {activeArtifact && activeTab !== 'templates' && (
        <div className="px-3 sm:px-4 py-1.5 border-b border-zinc-800/80 bg-zinc-900/40 flex flex-col gap-1.5 shrink-0">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <span className="text-[10.5px] font-mono text-zinc-400 flex items-center gap-1 shrink-0">
              <Sparkles size={11} className="text-cyan-400" />
              <span>Studio:</span>
            </span>

            <button
              type="button"
              disabled={aiRefining}
              onClick={() =>
                handleRunAiRefinement(
                  'Upgrade the visual design, typography, spacing, dark-mode contrast, and modern interactive polish while preserving all core functionality.',
                  'Polish UI & Design',
                )
              }
              className="px-2 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-[11px] text-zinc-200 flex items-center gap-1 shrink-0 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Wand2 size={11} className="text-cyan-400" />
              <span>Polish UI</span>
            </button>

            <button
              type="button"
              disabled={aiRefining}
              onClick={() =>
                handleRunAiRefinement(
                  'Audit this artifact for any bugs, missing edge cases, broken layout issues, or incomplete logic, and return the fixed, hardened version.',
                  'Fix Bugs & Edge Cases',
                )
              }
              className="px-2 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-[11px] text-zinc-200 flex items-center gap-1 shrink-0 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Bug size={11} className="text-amber-400" />
              <span>Fix Bugs</span>
            </button>

            <button
              type="button"
              disabled={aiRefining}
              onClick={() =>
                handleRunAiRefinement(
                  'Add interactive controls, live filters, dynamic state sliders, or interactive tabs so the user can explore and manipulate the data/interface in real time.',
                  'Add Interactive Controls',
                  activeArtifact.kind !== 'svg',
                )
              }
              className="px-2 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-[11px] text-zinc-200 flex items-center gap-1 shrink-0 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Sliders size={11} className="text-emerald-400" />
              <span>Add Controls</span>
            </button>

            {/* Feature 2: Live Theme & Design Token Switcher */}
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-zinc-900 border border-zinc-700/80 shrink-0">
              <Palette size={11} className="text-pink-400 shrink-0" />
              <select
                value={selectedThemePreset}
                disabled={aiRefining}
                onChange={(e) => {
                  const nextId = e.target.value as CanvasThemePresetId;
                  setSelectedThemePreset(nextId);
                  const preset = DESIGN_THEME_PRESETS.find((p) => p.id === nextId);
                  if (preset && nextId !== 'default' && !isRunnableWeb) {
                    handleRunAiRefinement(
                      `Restyle this artifact using the "${preset.label}" theme direction: ${preset.promptHint}.`,
                      `Theme: ${preset.label}`,
                    );
                  }
                }}
                className="bg-transparent text-[11px] text-zinc-200 outline-none cursor-pointer"
                title="Live Theme & Design Palette Switcher"
              >
                {DESIGN_THEME_PRESETS.map((p) => (
                  <option key={p.id} value={p.id} className="bg-zinc-900 text-zinc-100">
                    🎨 {p.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Feature 5: Multi-Framework Code Converter */}
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-zinc-900 border border-zinc-700/80 shrink-0">
              <Repeat size={11} className="text-indigo-400 shrink-0" />
              <select
                value=""
                disabled={aiRefining}
                onChange={(e) => {
                  const target = e.target.value;
                  if (!target) return;
                  if (target === 'html') {
                    handleRunAiRefinement(
                      'Port this artifact into a complete, self-contained HTML5 + Tailwind CSS + vanilla JavaScript interactive web application.',
                      'Ported to HTML5 Web App',
                      true,
                      'html',
                      'html',
                    );
                  } else if (target === 'react') {
                    handleRunAiRefinement(
                      'Port this artifact into a clean, self-contained React function component named App using Tailwind CSS classes and React hooks (useState, useMemo).',
                      'Ported to React TSX',
                      false,
                      'react',
                      'tsx',
                    );
                  } else if (target === 'vue') {
                    handleRunAiRefinement(
                      'Port this artifact into a clean Vue 3 Single-File Component (<script setup>, <template>, <style>) with Tailwind CSS.',
                      'Ported to Vue 3',
                      false,
                      'code',
                      'vue',
                    );
                  } else if (target === 'python') {
                    handleRunAiRefinement(
                      'Port this artifact into an interactive Python Streamlit dashboard application.',
                      'Ported to Python Streamlit',
                      false,
                      'code',
                      'python',
                    );
                  }
                }}
                className="bg-transparent text-[11px] text-zinc-200 outline-none cursor-pointer"
                title="Convert artifact between HTML, React TSX, Vue 3, or Python Streamlit"
              >
                <option value="" className="bg-zinc-900 text-zinc-400">
                  🔄 Port Code To...
                </option>
                <option value="html" className="bg-zinc-900 text-zinc-100">
                  HTML5 + Tailwind Web App
                </option>
                <option value="react" className="bg-zinc-900 text-zinc-100">
                  React + TypeScript (TSX)
                </option>
                <option value="vue" className="bg-zinc-900 text-zinc-100">
                  Vue 3 Component (.vue)
                </option>
                <option value="python" className="bg-zinc-900 text-zinc-100">
                  Python Streamlit App (.py)
                </option>
              </select>
            </div>

            {!isRunnableWeb && (
              <button
                type="button"
                disabled={aiRefining}
                onClick={() =>
                  handleRunAiRefinement(
                    'Transform this content into a complete, interactive, single-file HTML5 + Tailwind CSS + JavaScript web application with interactive tabs, metrics, and controls.',
                    'Convert to Interactive Web App',
                    true,
                  )
                }
                className="px-2 py-1 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/40 text-[11px] text-indigo-200 flex items-center gap-1 shrink-0 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Play size={11} className="text-indigo-400" />
                <span>Convert to Live App</span>
              </button>
            )}
          </div>

          {/* Feature 1: Auto Error-Catch & 1-Click AI Auto-Heal Banner */}
          {latestRuntimeError && (
            <div className="px-3 py-1.5 rounded-lg bg-amber-950/75 border border-amber-500/45 text-xs text-amber-200 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <Wrench size={13} className="text-amber-400 shrink-0" />
                <span className="truncate font-mono text-[11px]">
                  Runtime Error: {latestRuntimeError.text}
                </span>
              </div>
              <button
                type="button"
                disabled={aiRefining}
                onClick={() =>
                  handleRunAiRefinement(
                    `Fix this runtime error thrown inside the sandboxed preview: "${latestRuntimeError.text}". Ensure all DOM references and variables are safely initialized.`,
                    'AI Auto-Heal Error Fix',
                  )
                }
                className="px-2.5 py-1 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-[11px] flex items-center gap-1 shrink-0 cursor-pointer"
              >
                <Sparkles size={11} />
                <span>Auto-Heal with AI</span>
              </button>
            </div>
          )}

          {aiError && (
            <div className="px-3 py-1.5 rounded-lg bg-rose-950/70 border border-rose-500/40 text-xs text-rose-200 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <AlertTriangle size={12} className="text-rose-400 shrink-0" />
                <span className="truncate">{aiError}</span>
              </div>
              <button
                type="button"
                onClick={() => setAiError(null)}
                className="text-rose-300 hover:text-white"
              >
                <X size={12} />
              </button>
            </div>
          )}

          {aiWarning && (
            <div className="px-3 py-1.5 rounded-lg bg-amber-950/70 border border-amber-500/40 text-xs text-amber-200 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <AlertTriangle size={12} className="text-amber-400 shrink-0" />
                <span className="truncate">{aiWarning}</span>
              </div>
              <button
                type="button"
                onClick={() => setAiWarning(null)}
                className="text-amber-300 hover:text-white"
              >
                <X size={12} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Main Workspace Body */}
      <div className="flex-1 min-h-0 relative flex flex-col overflow-hidden bg-zinc-950">
        {(aiRefining || liveCodingActive) && (
          <div className="absolute inset-0 z-30 bg-zinc-950/95 backdrop-blur-md flex flex-col overflow-hidden">
            {/* Live Coding Process Top Telemetry Header */}
            <div className="px-3 sm:px-4 py-2.5 border-b border-cyan-500/30 bg-gradient-to-r from-slate-950 via-zinc-900 to-slate-950 flex items-center justify-between gap-2 flex-wrap shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500" />
                </span>
                <span className="px-2 py-0.5 rounded-md bg-cyan-500/20 border border-cyan-400/50 text-[10px] font-mono font-bold uppercase tracking-wider text-cyan-300 shrink-0">
                  LIVE CODING
                </span>
                <span className="text-xs font-semibold text-white truncate">
                  {aiRefiningLabel || 'Synthesizing Live Code'}
                </span>
                <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-500/15 border border-purple-500/30 text-[10px] font-mono text-purple-300 shrink-0">
                  <Cpu size={10} />
                  <span>{activeCanvasModelLabel}</span>
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono text-zinc-400">
                  <span className="text-cyan-300">
                    {liveCodingBuffer.split('\n').length} lines
                  </span>
                  <span>·</span>
                  <span>{liveCodingBuffer.length.toLocaleString()} chars</span>
                  <span>·</span>
                  <span className="text-emerald-400">
                    {(liveCodingElapsedMs / 1000).toFixed(1)}s
                  </span>
                </div>

                {/* Speed Toggle (1x / 3x Turbo) */}
                <button
                  type="button"
                  onClick={() =>
                    setLiveCodingSpeed((prev) => (prev === 'normal' ? 'turbo' : 'normal'))
                  }
                  className={`px-2 py-1 rounded-lg border text-[11px] font-mono font-semibold transition-colors cursor-pointer ${
                    liveCodingSpeed === 'turbo'
                      ? 'bg-amber-500/20 border-amber-400/60 text-amber-300'
                      : 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:text-white'
                  }`}
                  title="Toggle Live Coding Speed (1x / 3x Turbo)"
                >
                  {liveCodingSpeed === 'turbo' ? '⚡ 3x Turbo' : '1x Speed'}
                </button>

                {/* Instant Finish Button */}
                {liveCodingPhase === 'streaming' && (
                  <button
                    type="button"
                    onClick={() => {
                      liveCodingSkipRef.current = true;
                    }}
                    className="px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer shadow-sm"
                    title="Skip typing animation and jump immediately to rendered preview"
                  >
                    <Sparkles size={11} />
                    <span>Instant Finish</span>
                  </button>
                )}
              </div>
            </div>

            {/* 4-Stage Live Pipeline Progress Bar */}
            {(() => {
              const progressPct =
                liveCodingPhase === 'planning'
                  ? Math.min(32, Math.round((liveCodingBuffer.length / Math.max(400, liveCodingTotalLen)) * 35))
                  : liveCodingPhase === 'compiling'
                  ? 100
                  : Math.min(
                      98,
                      Math.max(
                        35,
                        Math.round((liveCodingBuffer.length / Math.max(1, liveCodingTotalLen)) * 100),
                      ),
                    );
              return (
                <div className="px-3 sm:px-4 py-1.5 border-b border-zinc-800 bg-zinc-900/80 flex flex-col gap-1.5 shrink-0">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-cyan-300 truncate flex items-center gap-1.5">
                      <Terminal size={11} className="text-cyan-400 shrink-0" />
                      <span>{liveCodingStatusText}</span>
                    </span>
                    <span className="text-cyan-400 font-bold shrink-0">{progressPct}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 via-indigo-500 to-emerald-400 transition-all duration-150"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>
              );
            })()}

            {/* Live Streaming Code IDE Window */}
            <div
              ref={liveCodeScrollRef}
              className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 font-mono text-xs leading-relaxed bg-[#07090e] text-zinc-100 select-text"
            >
              {liveCodingBuffer.split('\n').map((line, idx, arr) => {
                const isLastLine = idx === arr.length - 1;
                const trimmed = line.trim();
                const isComment =
                  trimmed.startsWith('//') ||
                  trimmed.startsWith('<!--') ||
                  trimmed.startsWith('/*');
                const isTag = trimmed.startsWith('<') || trimmed.endsWith('>');
                const isKeyword =
                  /\b(function|const|let|var|return|import|export|async|await|if|else|for|while|class)\b/.test(
                    trimmed,
                  );

                return (
                  <div
                    key={idx}
                    className={`flex items-start gap-3 px-2 py-0.5 rounded ${
                      isLastLine ? 'bg-cyan-500/10 border-l-2 border-cyan-400' : ''
                    }`}
                  >
                    <span className="w-8 text-right text-[10px] text-zinc-600 select-none shrink-0 pt-0.5">
                      {idx + 1}
                    </span>
                    <span
                      className={`whitespace-pre-wrap break-all flex-1 ${
                        isComment
                          ? 'text-emerald-400/80 italic'
                          : isKeyword
                          ? 'text-purple-300'
                          : isTag
                          ? 'text-cyan-200'
                          : 'text-zinc-200'
                      }`}
                    >
                      {line || ' '}
                      {isLastLine && (
                        <span className="inline-block w-2 h-3.5 ml-1 align-middle bg-cyan-400 animate-pulse" />
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!activeArtifact && activeTab !== 'templates' ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-3">
            <Layout size={32} className="text-zinc-600" />
            <h3 className="text-sm font-semibold text-zinc-200">
              No Artifacts Extracted Yet
            </h3>
            <p className="text-xs text-zinc-400 max-w-sm">
              Use the bottom input bar to build an interactive app from scratch, or launch a template from your Vault below.
            </p>
            <button
              type="button"
              onClick={() => setActiveTab('templates')}
              className="mt-1 px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Plus size={14} />
              <span>Open Starter Templates &amp; Vault</span>
            </button>
          </div>
        ) : activeTab === 'templates' ? (
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-6">
            {/* Feature 8: Saved Canvas Vault Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Bookmark size={14} className="text-amber-400" />
                    <span>Saved Canvas Vault ({vaultArtifacts.length})</span>
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Your bookmarked apps, calculators, and SVG blueprints persisted across sessions.
                  </p>
                </div>
              </div>

              {vaultArtifacts.length === 0 ? (
                <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/80 text-xs text-zinc-400">
                  No saved Vault artifacts yet. Click the <strong>Vault</strong> bookmark icon in the top bar while viewing any artifact to save it here permanently.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2.5">
                  {vaultArtifacts.map((item) => (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-xl bg-zinc-900/90 border border-zinc-800 hover:border-amber-500/40 transition-all flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-mono uppercase text-amber-400">
                            {item.kind}
                          </span>
                          <span className="text-zinc-600">·</span>
                          <h4 className="text-xs sm:text-sm font-semibold text-white truncate">
                            {item.title}
                          </h4>
                        </div>
                        <p className="text-[11px] text-zinc-500 mt-0.5 font-mono">
                          Saved {new Date(item.createdAt).toLocaleDateString()} · {item.content.length.toLocaleString()} chars
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            onCreateArtifact({
                              ...item,
                              id: `loaded-${Date.now()}`,
                            });
                            setActiveTab('preview');
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <span>Open</span>
                          <ChevronRight size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteVaultItem(item.id)}
                          className="p-1.5 rounded-lg bg-zinc-800 hover:bg-rose-950/60 text-zinc-400 hover:text-rose-300 transition-colors cursor-pointer"
                          title="Remove from Vault"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Starter Templates Section */}
            <div className="space-y-3 pt-2 border-t border-zinc-800/80">
              <div>
                <h3 className="text-sm font-bold text-white">
                  Built-In Interactive Starter Templates
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Launch a ready-made interactive web app or architecture blueprint.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {STARTER_TEMPLATES.map((tpl, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-zinc-900/90 border border-zinc-800 hover:border-cyan-500/40 transition-all flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono uppercase text-cyan-400">
                          {tpl.kind}
                        </span>
                        <span className="text-zinc-600">·</span>
                        <h4 className="text-sm font-semibold text-white truncate">
                          {tpl.title}
                        </h4>
                      </div>
                      <p className="text-xs text-zinc-400 mt-1">
                        {tpl.description}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const now = Date.now();
                        const created: CanvasArtifact = {
                          id: `custom-tpl-${now}`,
                          messageIndex: -1,
                          title: tpl.title,
                          kind: tpl.kind,
                          language: tpl.language,
                          content: tpl.content,
                          versions: [
                            {
                              versionNumber: 1,
                              label: 'Starter Template',
                              content: tpl.content,
                              timestamp: now,
                            },
                          ],
                          currentVersionIndex: 0,
                          createdAt: now,
                        };
                        onCreateArtifact(created);
                        setActiveTab('preview');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-1 shrink-0 cursor-pointer"
                    >
                      <span>Launch</span>
                      <ChevronRight size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : activeTab === 'preview' && activeArtifact ? (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="flex-1 overflow-auto flex items-start justify-center p-3 sm:p-4 bg-[#09090b]">
              {renderLivePreviewSurface()}
            </div>

            {isRunnableWeb && showConsole && (
              <div className="h-36 border-t border-zinc-800 bg-zinc-950 flex flex-col shrink-0">
                <div className="px-3 py-1.5 border-b border-zinc-800/80 flex items-center justify-between text-[11px] font-mono text-zinc-400">
                  <div className="flex items-center gap-1.5">
                    <Terminal size={12} className="text-cyan-400" />
                    <span>Live Sandbox Console</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConsoleLogs([])}
                    className="text-zinc-500 hover:text-zinc-300"
                  >
                    Clear
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-2.5 space-y-1 font-mono text-xs">
                  {consoleLogs.length === 0 ? (
                    <div className="text-zinc-600 text-[11px]">
                      No console output recorded yet.
                    </div>
                  ) : (
                    consoleLogs.map((entry) => (
                      <div
                        key={entry.id}
                        className={`flex items-start gap-2 ${
                          entry.level === 'error'
                            ? 'text-rose-400'
                            : entry.level === 'warn'
                            ? 'text-amber-300'
                            : 'text-zinc-300'
                        }`}
                      >
                        <span className="text-zinc-600 select-none">
                          {new Date(entry.timestamp).toLocaleTimeString([], {
                            hour12: false,
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </span>
                        <span className="break-all">{entry.text}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        ) : activeTab === 'split' && activeArtifact ? (
          /* Feature 9: Split Code + Live Preview Side-by-Side (Desktop) / Stacked (Mobile) */
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 min-h-0 overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-zinc-800">
            <div className="flex flex-col min-h-0 overflow-hidden">
              <div className="px-3 py-1.5 bg-zinc-900/80 border-b border-zinc-800 text-[11px] font-mono text-zinc-400 flex items-center justify-between">
                <span>LIVE SOURCE EDITOR</span>
                <span>Hot-Reload Active</span>
              </div>
              <textarea
                value={editorDraft}
                onChange={(e) => {
                  setEditorDraft(e.target.value);
                  setHasUnsavedEdits(e.target.value !== activeArtifact.content);
                }}
                spellCheck={false}
                className="flex-1 w-full p-3 bg-[#0b0b0e] text-zinc-100 font-mono text-xs leading-5 outline-none resize-none overflow-auto"
              />
            </div>
            <div className="flex flex-col min-h-0 overflow-auto p-2.5 bg-[#09090b]">
              {renderLivePreviewSurface()}
            </div>
          </div>
        ) : activeTab === 'code' && activeArtifact ? (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="flex-1 relative flex overflow-hidden">
              <div
                aria-hidden="true"
                className="py-4 px-2.5 bg-zinc-950 border-r border-zinc-800/80 text-right font-mono text-xs text-zinc-600 select-none overflow-hidden shrink-0"
              >
                {Array.from({ length: Math.max(1, lineCount) }).map((_, i) => (
                  <div key={i} className="leading-6">
                    {i + 1}
                  </div>
                ))}
              </div>
              <textarea
                value={editorDraft}
                onChange={(e) => {
                  setEditorDraft(e.target.value);
                  setHasUnsavedEdits(e.target.value !== activeArtifact.content);
                }}
                spellCheck={false}
                className="flex-1 w-full h-full p-4 bg-[#0b0b0e] text-zinc-100 font-mono text-xs sm:text-[13px] leading-6 outline-none resize-none overflow-auto"
                placeholder="Edit artifact code or markdown..."
              />
            </div>
          </div>
        ) : activeTab === 'data' && activeArtifact ? (
          /* Feature 4: Interactive Data & Table Playground */
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Table size={15} className="text-amber-400" />
                  <span>Interactive Data &amp; Table Playground</span>
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Edit cells directly, add rows, or generate realistic datasets with AI and sync them into your artifact.
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={aiRefining}
                  onClick={() =>
                    handleRunAiRefinement(
                      'Generate 8 rows of realistic, domain-accurate sample data for this artifact and update its UI/table with the new dataset.',
                      'AI Realistic Dataset',
                    )
                  }
                  className="px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs text-amber-300 font-medium flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles size={12} />
                  <span>AI Mock Data</span>
                </button>
                <button
                  type="button"
                  onClick={handleInjectTableDataIntoArtifact}
                  className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Check size={12} />
                  <span>Sync Table to Artifact</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/60">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-950/80">
                    {dataHeaders.map((h, hIdx) => (
                      <th key={hIdx} className="p-2.5">
                        <input
                          type="text"
                          value={h}
                          onChange={(e) => {
                            const next = [...dataHeaders];
                            next[hIdx] = e.target.value;
                            setDataHeaders(next);
                          }}
                          className="w-full bg-transparent font-mono font-bold text-cyan-300 outline-none focus:underline"
                        />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/70">
                  {dataRows.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-zinc-800/30">
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="p-2">
                          <input
                            type="text"
                            value={cell}
                            onChange={(e) => {
                              const next = dataRows.map((r) => [...r]);
                              next[rIdx][cIdx] = e.target.value;
                              setDataRows(next);
                            }}
                            className="w-full bg-zinc-950/60 border border-zinc-800 focus:border-cyan-500 rounded px-2 py-1 text-zinc-200 outline-none"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              type="button"
              onClick={() =>
                setDataRows((prev) => [...prev, dataHeaders.map(() => 'New Value')])
              }
              className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-300 flex items-center gap-1 cursor-pointer"
            >
              <Plus size={12} />
              <span>Add Row</span>
            </button>
          </div>
        ) : activeTab === 'audit' && activeArtifact && staticAuditReport ? (
          /* Feature 7: AI Security, Performance & Accessibility Auditor */
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldCheck size={16} className="text-emerald-400" />
                  <span>Security, Performance &amp; Accessibility Audit</span>
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Automated static code inspection + 1-click AI security &amp; WCAG hardening.
                </p>
              </div>
              <button
                type="button"
                disabled={aiRefining}
                onClick={() =>
                  handleRunAiRefinement(
                    'Fix all security, performance, WCAG accessibility (alt tags, ARIA labels, keyboard navigation), and code quality issues in this artifact.',
                    'AI Security & WCAG Hardening',
                  )
                }
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Wrench size={13} />
                <span>Fix All Issues with AI</span>
              </button>
            </div>

            {/* 4 Metric Scorecards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Performance', score: staticAuditReport.performanceScore, color: 'text-cyan-400' },
                { label: 'Security (XSS)', score: staticAuditReport.securityScore, color: 'text-emerald-400' },
                { label: 'Accessibility', score: staticAuditReport.accessibilityScore, color: 'text-amber-400' },
                { label: 'Code Quality', score: staticAuditReport.codeQualityScore, color: 'text-indigo-400' },
              ].map((m) => (
                <div
                  key={m.label}
                  className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800 flex flex-col justify-between"
                >
                  <span className="text-[11px] text-zinc-400">{m.label}</span>
                  <div className={`text-xl font-bold font-mono mt-1 ${m.color}`}>
                    {m.score}/100
                  </div>
                </div>
              ))}
            </div>

            {/* Findings List */}
            <div className="space-y-2.5">
              <h4 className="text-xs font-mono uppercase tracking-wider text-zinc-400">
                Audit Findings &amp; Recommendations
              </h4>
              {staticAuditReport.issues.map((iss, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-1"
                >
                  <div className="flex items-center gap-2 text-xs">
                    <span
                      className={`font-mono font-bold uppercase text-[10px] ${
                        iss.severity === 'high'
                          ? 'text-rose-400'
                          : iss.severity === 'medium'
                          ? 'text-amber-400'
                          : 'text-cyan-400'
                      }`}
                    >
                      [{iss.severity}] {iss.category}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-200">{iss.description}</p>
                  <p className="text-[11px] text-zinc-400 font-mono">
                    Fix: {iss.fixSuggestion}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : activeTab === 'diff' && activeArtifact ? (
          <div className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-1 bg-[#0b0b0e]">
            <div className="pb-2 mb-2 border-b border-zinc-800 flex items-center justify-between text-zinc-400">
              <span>
                Comparing{' '}
                <strong className="text-zinc-200">
                  v{Math.max(1, activeArtifact.currentVersionIndex)}
                </strong>{' '}
                →{' '}
                <strong className="text-cyan-300">
                  v{activeArtifact.currentVersionIndex + 1}
                  {hasUnsavedEdits ? ' (unsaved draft)' : ''}
                </strong>
              </span>
              <FileText size={13} />
            </div>
            {diffLines.map((row) => {
              if (row.type === 'same') {
                return (
                  <div key={row.lineNum} className="flex items-start gap-3 px-2 py-0.5 text-zinc-500">
                    <span className="w-8 text-right select-none opacity-50">{row.lineNum}</span>
                    <span className="w-3 select-none"> </span>
                    <span className="whitespace-pre-wrap break-all">{row.newLine}</span>
                  </div>
                );
              }
              if (row.type === 'added') {
                return (
                  <div
                    key={row.lineNum}
                    className="flex items-start gap-3 px-2 py-0.5 bg-emerald-950/40 text-emerald-300 rounded"
                  >
                    <span className="w-8 text-right select-none opacity-70">{row.lineNum}</span>
                    <span className="w-3 select-none font-bold">+</span>
                    <span className="whitespace-pre-wrap break-all">{row.newLine}</span>
                  </div>
                );
              }
              if (row.type === 'removed') {
                return (
                  <div
                    key={row.lineNum}
                    className="flex items-start gap-3 px-2 py-0.5 bg-rose-950/40 text-rose-300 rounded"
                  >
                    <span className="w-8 text-right select-none opacity-70">{row.lineNum}</span>
                    <span className="w-3 select-none font-bold">-</span>
                    <span className="whitespace-pre-wrap break-all">{row.oldLine}</span>
                  </div>
                );
              }
              return (
                <div key={row.lineNum} className="space-y-0.5">
                  <div className="flex items-start gap-3 px-2 py-0.5 bg-rose-950/40 text-rose-300 rounded">
                    <span className="w-8 text-right select-none opacity-70">{row.lineNum}</span>
                    <span className="w-3 select-none font-bold">-</span>
                    <span className="whitespace-pre-wrap break-all">{row.oldLine}</span>
                  </div>
                  <div className="flex items-start gap-3 px-2 py-0.5 bg-emerald-950/40 text-emerald-300 rounded">
                    <span className="w-8 text-right select-none opacity-70">{row.lineNum}</span>
                    <span className="w-3 select-none font-bold">+</span>
                    <span className="whitespace-pre-wrap break-all">{row.newLine}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      {/* Feature 3: Clicked Element Inspector Target Banner */}
      {inspectedElement && (
        <div className="px-3 py-1.5 border-t border-cyan-500/40 bg-cyan-950/80 flex items-center justify-between gap-2 text-xs text-cyan-200 shrink-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <Crosshair size={12} className="text-cyan-400 shrink-0" />
            <span className="font-mono font-bold">&lt;{inspectedElement.tagName}&gt;</span>
            {inspectedElement.textSnippet && (
              <span className="truncate text-cyan-300/90">
                &ldquo;{inspectedElement.textSnippet}&rdquo;
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setInspectedElement(null)}
            className="text-cyan-300 hover:text-white p-0.5"
            title="Clear selected element"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* Bottom Inline AI Canvas Edit / Build Prompt Bar + Voice Mic (Always Visible on Mobile & Desktop) */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const trimmed = customAiPrompt.trim();
          if (!trimmed || aiRefining) return;
          setCustomAiPrompt('');
          if (activeArtifact && activeTab !== 'templates') {
            handleRunAiRefinement(trimmed, `AI Edit: ${trimmed.slice(0, 24)}`);
          } else {
            handleCreateArtifactFromPrompt(trimmed);
          }
        }}
        style={{
          paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0.75rem))',
        }}
        className={`px-3 pt-2.5 border-t flex items-center gap-2 shrink-0 w-full box-border ${
          theme === 'classic'
            ? 'border-cyan-500/30 bg-slate-950/95'
            : 'border-zinc-800 bg-zinc-950/95'
        }`}
      >
        {/* Feature 10: Voice Dictation Mic Button */}
        <button
          type="button"
          onClick={handleToggleMic}
          className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
            isListeningMic
              ? 'bg-rose-500/25 border-rose-500/60 text-rose-300 animate-pulse'
              : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-700/80 text-cyan-400'
          }`}
          title={isListeningMic ? 'Stop voice dictation' : 'Dictate Canvas changes by voice'}
        >
          {isListeningMic ? <MicOff size={15} /> : <Mic size={15} />}
        </button>

        {/* Quick Model Selector Button inside Bottom Prompt Bar */}
        <button
          type="button"
          onClick={handleOpenModelModal}
          className={`h-9 px-2.5 rounded-xl border flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer ${
            canvasProviderId !== 'session'
              ? 'bg-purple-500/20 border-purple-500/50 text-purple-200'
              : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-700/80 text-zinc-300'
          }`}
          title={`Canvas AI Model: ${activeCanvasModelLabel} (Click to change model)`}
        >
          <Cpu size={14} className="text-purple-400 shrink-0" />
          <span className="hidden sm:inline text-[11px] font-mono truncate max-w-[96px]">
            {activeCanvasModelLabel}
          </span>
        </button>

        <input
          type="text"
          value={customAiPrompt}
          onChange={(e) => setCustomAiPrompt(e.target.value)}
          disabled={aiRefining}
          placeholder={
            inspectedElement
              ? `Tell AI how to change <${inspectedElement.tagName}>...`
              : activeArtifact && activeTab !== 'templates'
              ? `Tell AI how to modify "${activeArtifact.title}"...`
              : 'Describe an interactive app, calculator, or SVG diagram to build...'
          }
          className="flex-1 min-w-0 min-h-[42px] bg-zinc-900 border border-zinc-700/90 focus:border-cyan-400 rounded-xl px-3 py-2 text-[15px] sm:text-xs text-zinc-100 placeholder-zinc-400 outline-none shadow-inner"
        />

        <button
          type="submit"
          disabled={!customAiPrompt.trim() || aiRefining}
          className="min-h-[42px] px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer shadow-sm"
        >
          <Send size={13} />
          <span>{activeArtifact && activeTab !== 'templates' ? 'Apply' : 'Build'}</span>
        </button>
      </form>

      {/* Canvas AI Model & Provider Selector Modal */}
      {modelModalOpen && (
        <div
          className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          style={{ zIndex: 1200 }}
          onClick={() => setModelModalOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950 p-4 sm:p-5 shadow-2xl space-y-4 max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-500/15 border border-purple-500/40 flex items-center justify-center text-purple-400">
                  <Cpu size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Select Canvas AI Model
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Choose which AI provider & model powers Live AI Canvas Studio
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModelModalOpen(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto pr-1 flex-1">
              {/* Step 1: Select AI Provider */}
              <div className="space-y-2">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                  1. Select AI Provider
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {/* Follow Chat Session Model */}
                  <button
                    type="button"
                    onClick={() => {
                      setProviderDraft('session');
                      setModelIdDraft('');
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                      providerDraft === 'session'
                        ? 'border-cyan-500/60 bg-cyan-950/35 text-cyan-200 ring-1 ring-cyan-500/30'
                        : 'border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800/60 text-zinc-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Sparkles
                        size={14}
                        className={providerDraft === 'session' ? 'text-cyan-400' : 'text-zinc-400'}
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-zinc-100 truncate">
                          Follow Chat Session
                        </div>
                        <div className="text-[10px] text-zinc-500 truncate">
                          {activeProvider?.model || activeProvider?.name || 'Active session model'}
                        </div>
                      </div>
                    </div>
                    {providerDraft === 'session' && (
                      <Check size={13} className="text-cyan-400 shrink-0" />
                    )}
                  </button>

                  {/* Global Default AI */}
                  <button
                    type="button"
                    onClick={() => {
                      setProviderDraft('existing');
                      setModelIdDraft('');
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                      providerDraft === 'existing'
                        ? 'border-emerald-500/60 bg-emerald-950/35 text-emerald-200 ring-1 ring-emerald-500/30'
                        : 'border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800/60 text-zinc-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Cpu
                        size={14}
                        className={providerDraft === 'existing' ? 'text-emerald-400' : 'text-zinc-400'}
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-zinc-100 truncate">
                          Global Default AI
                        </div>
                        <div className="text-[10px] text-zinc-500 truncate">
                          Use global default setting
                        </div>
                      </div>
                    </div>
                    {providerDraft === 'existing' && (
                      <Check size={13} className="text-emerald-400 shrink-0" />
                    )}
                  </button>

                  {/* Configured AI Providers from Settings */}
                  {configuredProviders.map((prov) => {
                    const isSelected = providerDraft === prov.id;
                    const models = getCanvasProviderModels(prov);
                    return (
                      <button
                        key={prov.id}
                        type="button"
                        onClick={() => {
                          setProviderDraft(prov.id);
                          setModelIdDraft(models[0]?.id || prov.model || '');
                        }}
                        className={`p-2.5 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? 'border-purple-500/60 bg-purple-950/40 text-purple-200 ring-1 ring-purple-500/40'
                            : 'border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800/60 text-zinc-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Bot
                            size={14}
                            className={isSelected ? 'text-purple-400' : 'text-zinc-400'}
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-zinc-100 truncate">
                              {prov.name}
                            </div>
                            <div className="text-[10px] text-zinc-500 truncate">
                              {models.length} {models.length === 1 ? 'model' : 'models'} available
                            </div>
                          </div>
                        </div>
                        {isSelected && (
                          <Check size={13} className="text-purple-400 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 2: Select Model for Chosen Provider */}
              {providerDraft !== 'session' && providerDraft !== 'existing' && (
                <div className="space-y-2.5 pt-2 border-t border-zinc-800/80">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-300">
                      2. Select Model
                    </label>
                    <span className="text-[10.5px] font-mono text-purple-300 bg-purple-950/60 px-2 py-0.5 rounded border border-purple-500/30 truncate max-w-[220px]">
                      {modelIdDraft || 'None selected'}
                    </span>
                  </div>

                  {(() => {
                    const selectedProv = configuredProviders.find((p) => p.id === providerDraft);
                    const models = selectedProv ? getCanvasProviderModels(selectedProv) : [];
                    return (
                      <div className="space-y-2.5">
                        {models.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
                            {models.map((m) => {
                              const isSelected = modelIdDraft === m.id;
                              return (
                                <button
                                  key={m.id}
                                  type="button"
                                  onClick={() => setModelIdDraft(m.id)}
                                  className={`p-2 rounded-lg border text-left text-xs transition-all flex items-center justify-between cursor-pointer ${
                                    isSelected
                                      ? 'border-purple-500 bg-purple-900/30 text-purple-200 font-medium'
                                      : 'border-zinc-800 bg-zinc-900/40 hover:bg-zinc-800/60 text-zinc-300'
                                  }`}
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="truncate">{m.name || m.id}</div>
                                    {m.name && m.name !== m.id && (
                                      <div className="text-[10px] text-zinc-500 font-mono truncate">
                                        {m.id}
                                      </div>
                                    )}
                                  </div>
                                  {isSelected && (
                                    <Check size={12} className="text-purple-400 shrink-0 ml-1" />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-xs text-zinc-400 bg-zinc-900/50 p-2.5 rounded-lg border border-zinc-800">
                            No predefined models listed for this provider. Enter a custom model ID below:
                          </p>
                        )}

                        <div>
                          <label className="text-[11px] text-zinc-400 block mb-1">
                            Or enter a custom Model ID:
                          </label>
                          <input
                            type="text"
                            value={modelIdDraft}
                            onChange={(e) => setModelIdDraft(e.target.value)}
                            placeholder="e.g. google/gemini-2.5-pro, anthropic/claude-3.7-sonnet, gpt-4o..."
                            className="w-full px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-900 text-xs text-zinc-100 placeholder-zinc-500 outline-none focus:border-purple-500 font-mono"
                          />
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-zinc-800 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setProviderDraft('session');
                  setModelIdDraft('');
                }}
                className="text-xs text-zinc-400 hover:text-zinc-200 px-2.5 py-1.5 rounded-lg hover:bg-zinc-800 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <RotateCcw size={12} />
                <span>Reset to Chat Model</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setModelModalOpen(false)}
                  className="text-xs text-zinc-400 hover:text-zinc-200 px-3 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveCanvasModel}
                  className="text-xs px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold transition-colors cursor-pointer"
                >
                  Apply Model
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
