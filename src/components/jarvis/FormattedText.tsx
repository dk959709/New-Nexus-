import React, { useState, useMemo } from 'react';
import {
  ExternalLink,
  Copy,
  Check,
  Play,
  Square,
  RotateCcw,
  Download,
  Maximize2,
  Minimize2,
  Monitor,
  Tablet,
  Smartphone,
  Code2,
  Eye,
  Columns,
  Sun,
  Moon,
  X,
} from 'lucide-react';

export interface SiblingCodeBundle {
  html?: string;
  css?: string;
  js?: string;
}

/**
 * Determines whether a fenced code block can be executed/rendered in the Live Preview Sandbox.
 */
function isRunnableCodeBlock(code: string, language?: string): boolean {
  const lang = (language || '').toLowerCase().trim();
  const trimmed = (code || '').trim();
  if (!trimmed || trimmed.length < 10) return false;

  const runnableLangs = new Set([
    'html',
    'htm',
    'svg',
    'xml',
    'css',
    'javascript',
    'js',
    'jsx',
    'tsx',
    'react',
    'typescript',
    'ts',
  ]);

  if (runnableLangs.has(lang)) return true;

  // Auto-detect HTML / SVG markup even when language tag is omitted
  if (
    /^<!doctype\s+html/i.test(trimmed) ||
    /^<html[\s>]/i.test(trimmed) ||
    /^<svg[\s>]/i.test(trimmed) ||
    (/<(div|section|main|header|canvas|button|form|style|script|table|ul|ol|h1|h2|p)\b/i.test(
      trimmed,
    ) &&
      /<\/(div|section|main|header|canvas|button|form|style|script|table|ul|ol|h1|h2|p)>/i.test(
        trimmed,
      ))
  ) {
    return true;
  }

  return false;
}

/**
 * Builds a complete, safe, self-contained HTML5 document string for the iframe srcDoc.
 * Supports HTML, SVG, CSS, JS/TS (with live console output capture), and React/JSX/TSX components.
 */
function buildSandboxSrcDoc(
  code: string,
  language?: string,
  siblings?: SiblingCodeBundle,
  canvasBg: 'dark' | 'light' = 'dark',
): string {
  const lang = (language || '').toLowerCase().trim();
  const trimmed = (code || '').trim();
  const bgStyle =
    canvasBg === 'light'
      ? 'background-color: #ffffff; color: #0f172a;'
      : 'background-color: #090d16; color: #f1f5f9;';

  // 1. If the code is already a full HTML document (<!DOCTYPE html> or <html>)
  if (/^<!doctype\s+html/i.test(trimmed) || /^<html[\s>]/i.test(trimmed)) {
    let doc = trimmed;
    // Inject sibling CSS/JS if not already present and siblings exist
    if (siblings?.css && !doc.includes(siblings.css.slice(0, 40))) {
      doc = doc.replace(
        /<\/head>/i,
        `<style>\n${siblings.css}\n</style>\n</head>`,
      );
    }
    if (siblings?.js && !doc.includes(siblings.js.slice(0, 40))) {
      doc = doc.replace(
        /<\/body>/i,
        `<script>\n${siblings.js}\n</script>\n</body>`,
      );
    }
    return doc;
  }

  // 2. Pure SVG block
  if (lang === 'svg' || /^<svg[\s>]/i.test(trimmed)) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<style>
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 16px;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: system-ui, -apple-system, sans-serif;
    ${bgStyle}
  }
  svg {
    max-width: 100%;
    height: auto;
    display: block;
  }
</style>
</head>
<body>
${trimmed}
</body>
</html>`;
  }

  // 3. React / JSX / TSX component block
  const looksLikeReact =
    lang === 'jsx' ||
    lang === 'tsx' ||
    lang === 'react' ||
    ((lang === 'js' || lang === 'javascript' || lang === 'ts' || lang === 'typescript') &&
      (/import\s+.*from\s+['"]react['"]/.test(trimmed) ||
        /export\s+default\s+function/.test(trimmed) ||
        (/function\s+[A-Z]\w*\s*\(/.test(trimmed) && /return\s*\(\s*</.test(trimmed))));

  if (looksLikeReact) {
    // Strip ES module imports and prepare component mount
    const cleanedJsx = trimmed
      .replace(/^\s*import\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '')
      .replace(/export\s+default\s+function\s+([A-Z]\w*)/g, 'function $1')
      .replace(/export\s+default\s+/g, 'const __DefaultExport__ = ')
      .replace(/export\s+function\s+/g, 'function ')
      .replace(/export\s+const\s+/g, 'const ');

    const compNameMatch =
      cleanedJsx.match(/function\s+([A-Z]\w*)\s*\(/) ||
      cleanedJsx.match(/const\s+([A-Z]\w*)\s*=\s*(?:\([^)]*\)|[a-zA-Z0-9_]+)\s*=>/);
    const detectedComp = compNameMatch ? compNameMatch[1] : '__DefaultExport__';

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<script src="https://cdn.tailwindcss.com"></script>
<script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script>
<script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
<style>
  body { margin: 0; padding: 16px; font-family: system-ui, -apple-system, sans-serif; ${bgStyle} }
  ${siblings?.css || ''}
</style>
</head>
<body>
<div id="root"></div>
<script type="text/babel" data-presets="react,typescript">
  const { useState, useEffect, useRef, useMemo, useCallback, Fragment } = React;
  try {
    ${cleanedJsx}
    const TargetComponent = typeof ${detectedComp} !== 'undefined' ? ${detectedComp} : (typeof App !== 'undefined' ? App : null);
    if (TargetComponent) {
      ReactDOM.createRoot(document.getElementById('root')).render(<TargetComponent />);
    } else {
      document.getElementById('root').innerHTML = '<div style="padding:12px;color:#38bdf8;font-family:monospace;">Component evaluated. Define a function component (e.g. function App()) to render UI.</div>';
    }
  } catch (err) {
    document.getElementById('root').innerHTML = '<pre style="color:#fb7185;background:rgba(244,63,94,0.1);padding:12px;border-radius:8px;border:1px solid rgba(244,63,94,0.3);font-size:12px;white-space:pre-wrap;">' + (err && err.stack ? err.stack : String(err)) + '</pre>';
  }
</script>
</body>
</html>`;
  }

  // 4. HTML snippet or CSS/JS with sibling HTML
  const hasHtmlMarkup =
    lang === 'html' ||
    lang === 'htm' ||
    lang === 'xml' ||
    /<[a-z][\s\S]*>/i.test(trimmed);

  if (hasHtmlMarkup) {
    const extraCss = siblings?.css ? `\n<style>\n${siblings.css}\n</style>` : '';
    const extraJs = siblings?.js ? `\n<script>\n${siblings.js}\n</script>` : '';
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<script src="https://cdn.tailwindcss.com"></script>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 16px;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    ${bgStyle}
  }
</style>${extraCss}
</head>
<body>
${trimmed}
${extraJs}
</body>
</html>`;
  }

  // 5. Pure CSS block (with optional sibling HTML)
  if (lang === 'css') {
    const htmlBody =
      siblings?.html ||
      `<div class="demo-card card container box button btn" style="padding:24px;border-radius:14px;border:1px solid rgba(56,189,248,0.3);max-width:480px;margin:20px auto;text-align:center;">
        <h2>Live CSS Preview</h2>
        <p>Your custom stylesheet is active inside this sandbox.</p>
        <button style="padding:8px 16px;border-radius:8px;cursor:pointer;">Sample Button</button>
      </div>`;
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<style>
  body { margin: 0; padding: 16px; font-family: system-ui, -apple-system, sans-serif; ${bgStyle} }
  ${trimmed}
</style>
</head>
<body>
${htmlBody}
${siblings?.js ? `<script>\n${siblings.js}\n</script>` : ''}
</body>
</html>`;
  }

  // 6. JavaScript / TypeScript execution sandbox with Live Console & DOM / Canvas Mount
  const htmlScaffold = siblings?.html || `<div id="app"></div>`;
  const cssScaffold = siblings?.css || '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<script src="https://cdn.tailwindcss.com"></script>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 14px;
    font-family: system-ui, -apple-system, sans-serif;
    ${bgStyle}
  }
  #__console_panel {
    margin-top: 12px;
    border-radius: 10px;
    border: 1px solid rgba(56, 189, 248, 0.25);
    background: rgba(2, 6, 23, 0.92);
    color: #e2e8f0;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 12px;
    overflow: hidden;
  }
  #__console_header {
    padding: 6px 12px;
    background: rgba(15, 23, 42, 0.9);
    border-bottom: 1px solid rgba(56, 189, 248, 0.2);
    color: #38bdf8;
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    display: flex;
    justify-content: space-between;
  }
  #__console_logs {
    padding: 10px 12px;
    max-height: 260px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .log-line {
    white-space: pre-wrap;
    word-break: break-word;
    padding: 4px 8px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.03);
    border-left: 2px solid #22d3ee;
  }
  .log-warn { border-left-color: #fbbf24; color: #fde68a; }
  .log-error { border-left-color: #f43f5e; color: #fda4af; background: rgba(244, 63, 94, 0.08); }
  ${cssScaffold}
</style>
</head>
<body>
${htmlScaffold}
<div id="__console_panel" style="display:none;">
  <div id="__console_header">
    <span>⚡ Live JS Console Output</span>
    <span id="__console_status">Executed</span>
  </div>
  <div id="__console_logs"></div>
</div>
<script>
(function() {
  const panel = document.getElementById('__console_panel');
  const logsEl = document.getElementById('__console_logs');
  function formatVal(v) {
    if (typeof v === 'object' && v !== null) {
      try { return JSON.stringify(v, null, 2); } catch { return String(v); }
    }
    return String(v);
  }
  function appendLog(type, args) {
    panel.style.display = 'block';
    const div = document.createElement('div');
    div.className = 'log-line' + (type === 'warn' ? ' log-warn' : type === 'error' ? ' log-error' : '');
    div.textContent = Array.from(args).map(formatVal).join(' ');
    logsEl.appendChild(div);
  }
  const origLog = console.log;
  const origWarn = console.warn;
  const origError = console.error;
  console.log = function() { origLog.apply(console, arguments); appendLog('log', arguments); };
  console.info = function() { origLog.apply(console, arguments); appendLog('log', arguments); };
  console.warn = function() { origWarn.apply(console, arguments); appendLog('warn', arguments); };
  console.error = function() { origError.apply(console, arguments); appendLog('error', arguments); };
  window.addEventListener('error', function(e) {
    appendLog('error', [e.message || 'Runtime error']);
  });
  try {
    const result = (0, eval)(${JSON.stringify(trimmed)});
    if (result !== undefined && logsEl.children.length === 0 && !document.getElementById('app').innerHTML.trim()) {
      appendLog('log', ['Return value:', result]);
    } else if (logsEl.children.length === 0 && !document.getElementById('app').innerHTML.trim()) {
      appendLog('log', ['✓ Script executed with no console output.']);
    }
  } catch (err) {
    appendLog('error', [err && err.stack ? err.stack : String(err)]);
  }
})();
</script>
</body>
</html>`;
}

interface JarvisCodeBlockProps {
  code: string;
  language?: string;
  showCopyButton?: boolean;
  siblings?: SiblingCodeBundle;
}

export function JarvisCodeBlock({
  code,
  language,
  showCopyButton = true,
  siblings,
}: JarvisCodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [splitModalOpen, setSplitModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'code' | 'split'>('preview');
  const [deviceSize, setDeviceSize] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [canvasBg, setCanvasBg] = useState<'dark' | 'light'>('dark');
  const [reloadKey, setReloadKey] = useState(0);
  const [editableCode, setEditableCode] = useState(code);

  // Sync editableCode when source code changes (e.g. streaming or new message)
  React.useEffect(() => {
    setEditableCode(code);
  }, [code]);

  const canRunPreview = useMemo(
    () => isRunnableCodeBlock(code, language),
    [code, language],
  );

  const srcDoc = useMemo(() => {
    if (!previewOpen && !splitModalOpen) return '';
    return buildSandboxSrcDoc(editableCode, language, siblings, canvasBg);
  }, [editableCode, language, siblings, canvasBg, previewOpen, splitModalOpen]);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const textToCopy = editableCode || code;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = textToCopy;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      setCopied(false);
    }
  };

  const handleDownloadHtml = (e: React.MouseEvent) => {
    e.stopPropagation();
    const fullDoc = buildSandboxSrcDoc(editableCode, language, siblings, canvasBg);
    const blob = new Blob([fullDoc], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nexus-live-artifact-${Date.now()}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const displayLang = language ? language.toUpperCase() : 'CODE / SYNTAX';

  const iframeWidthClass =
    deviceSize === 'mobile'
      ? 'w-[375px] max-w-full mx-auto border-x border-cyan-500/30 shadow-2xl'
      : deviceSize === 'tablet'
      ? 'w-[768px] max-w-full mx-auto border-x border-cyan-500/30 shadow-2xl'
      : 'w-full';

  return (
    <div className="my-3 rounded-2xl overflow-hidden border border-cyan-500/30 shadow-lg">
      {/* Code Block Top Header Bar */}
      <div
        className="px-3.5 py-2 border-b border-cyan-500/20 flex items-center justify-between flex-wrap gap-2 text-[11px] font-mono text-cyan-300 font-semibold"
        style={{ backgroundColor: 'var(--assistant-answer-box-bg, #020617)' }}
      >
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
          <span className="ml-2 font-bold tracking-wider">{displayLang}</span>
          {canRunPreview && (
            <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-cyan-500/15 border border-cyan-400/30 text-[9.5px] text-cyan-300 font-mono">
              SANDBOX READY
            </span>
          )}
        </span>

        <div className="flex items-center gap-1.5 flex-wrap">
          {/* ▶ Run Live Preview Button */}
          {canRunPreview && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setPreviewOpen((prev) => !prev);
                }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10.5px] font-mono font-bold transition-all duration-200 border cursor-pointer select-none active:scale-95 ${
                  previewOpen
                    ? 'bg-amber-500/20 text-amber-200 border-amber-400/50 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                    : 'bg-gradient-to-r from-cyan-500/25 via-indigo-500/25 to-purple-500/25 hover:from-cyan-500/35 hover:to-purple-500/35 text-cyan-200 border-cyan-400/45 shadow-[0_0_12px_rgba(6,182,212,0.25)]'
                }`}
                title={
                  previewOpen
                    ? 'Close inline live preview'
                    : 'Run this code inside an interactive Live Preview Sandbox'
                }
              >
                {previewOpen ? (
                  <>
                    <Square size={10} className="fill-current text-amber-300 shrink-0" />
                    <span>Close Preview</span>
                  </>
                ) : (
                  <>
                    <Play size={11} className="fill-current text-cyan-300 shrink-0" />
                    <span>Run Live Preview</span>
                  </>
                )}
              </button>

              {/* Split / Fullscreen Artifact Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveTab('split');
                  setSplitModalOpen(true);
                }}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-mono font-semibold bg-white/5 hover:bg-purple-500/20 text-slate-300 hover:text-purple-200 border border-white/10 hover:border-purple-400/40 transition-all cursor-pointer active:scale-95"
                title="Open Artifact Split View (Code + Live Preview side-by-side)"
              >
                <Columns size={11} className="text-purple-300 shrink-0" />
                <span className="hidden sm:inline">Split View</span>
              </button>
            </>
          )}

          {showCopyButton && (
            <button
              type="button"
              onClick={handleCopy}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-mono font-medium transition-all duration-200 border cursor-pointer select-none active:scale-95 ${
                copied
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-[0_0_12px_rgba(16,185,129,0.35)]'
                  : 'bg-white/5 hover:bg-cyan-500/15 text-slate-300 hover:text-cyan-200 border-white/10 hover:border-cyan-400/40'
              }`}
              title={copied ? 'Code copied to clipboard!' : 'Copy code only'}
              aria-label="Copy code block"
            >
              {copied ? (
                <>
                  <Check size={12} className="text-emerald-400 shrink-0" />
                  <span className="text-emerald-300 font-semibold">Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={12} className="opacity-75 shrink-0" />
                  <span>Copy Code</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Inline Interactive Live Preview Sandbox */}
      {previewOpen && (
        <div className="border-b border-cyan-500/25 bg-[#060a12]">
          {/* Sandbox Controls Toolbar */}
          <div className="px-3 py-2 bg-slate-950/90 border-b border-white/10 flex items-center justify-between flex-wrap gap-2 text-[11px] font-mono">
            {/* Left: View Mode Switcher (Live View vs Live Code Editor) */}
            <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-white/10">
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`px-2 py-1 rounded-md flex items-center gap-1 text-[10px] font-semibold transition-colors cursor-pointer ${
                  activeTab === 'preview'
                    ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Eye size={11} />
                <span>Live View</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('code')}
                className={`px-2 py-1 rounded-md flex items-center gap-1 text-[10px] font-semibold transition-colors cursor-pointer ${
                  activeTab === 'code'
                    ? 'bg-purple-500/25 text-purple-200 border border-purple-400/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Code2 size={11} />
                <span>Edit Code</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('split')}
                className={`hidden md:flex px-2 py-1 rounded-md items-center gap-1 text-[10px] font-semibold transition-colors cursor-pointer ${
                  activeTab === 'split'
                    ? 'bg-indigo-500/25 text-indigo-200 border border-indigo-400/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Columns size={11} />
                <span>Split</span>
              </button>
            </div>

            {/* Right: Device Width, Canvas Theme, Reload, Download, Fullscreen */}
            <div className="flex items-center gap-1 flex-wrap">
              {/* Device Viewport Switcher */}
              <div className="hidden sm:flex items-center gap-0.5 bg-slate-900 p-0.5 rounded-lg border border-white/10">
                <button
                  type="button"
                  onClick={() => setDeviceSize('desktop')}
                  className={`p-1 rounded transition-colors cursor-pointer ${
                    deviceSize === 'desktop'
                      ? 'bg-cyan-500/20 text-cyan-300'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Desktop width (100%)"
                >
                  <Monitor size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => setDeviceSize('tablet')}
                  className={`p-1 rounded transition-colors cursor-pointer ${
                    deviceSize === 'tablet'
                      ? 'bg-cyan-500/20 text-cyan-300'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Tablet width (768px)"
                >
                  <Tablet size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => setDeviceSize('mobile')}
                  className={`p-1 rounded transition-colors cursor-pointer ${
                    deviceSize === 'mobile'
                      ? 'bg-cyan-500/20 text-cyan-300'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Mobile width (375px)"
                >
                  <Smartphone size={12} />
                </button>
              </div>

              {/* Canvas Dark/Light Toggle */}
              <button
                type="button"
                onClick={() => setCanvasBg((prev) => (prev === 'dark' ? 'light' : 'dark'))}
                className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/10 transition-colors cursor-pointer"
                title={`Switch sandbox canvas to ${canvasBg === 'dark' ? 'Light' : 'Dark'} background`}
              >
                {canvasBg === 'dark' ? <Sun size={12} className="text-amber-300" /> : <Moon size={12} className="text-cyan-300" />}
              </button>

              {/* Reload Sandbox */}
              <button
                type="button"
                onClick={() => setReloadKey((k) => k + 1)}
                className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 border border-white/10 transition-colors cursor-pointer"
                title="Reload sandbox execution"
              >
                <RotateCcw size={12} />
              </button>

              {/* Download .html */}
              <button
                type="button"
                onClick={handleDownloadHtml}
                className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-emerald-300 border border-white/10 flex items-center gap-1 text-[10px] transition-colors cursor-pointer"
                title="Download working standalone .html file"
              >
                <Download size={11} />
                <span className="hidden sm:inline">.html</span>
              </button>

              {/* Expand Fullscreen Split Modal */}
              <button
                type="button"
                onClick={() => {
                  setActiveTab('split');
                  setSplitModalOpen(true);
                }}
                className="p-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 transition-colors cursor-pointer"
                title="Open Fullscreen Artifact Split View"
              >
                <Maximize2 size={12} />
              </button>
            </div>
          </div>

          {/* Sandbox Body: Preview / Live Editor / Split */}
          <div
            className={`grid ${
              activeTab === 'split' ? 'grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white/10' : 'grid-cols-1'
            }`}
          >
            {(activeTab === 'code' || activeTab === 'split') && (
              <div className="flex flex-col bg-[#050811]">
                <div className="px-3 py-1.5 bg-slate-950 border-b border-white/5 flex items-center justify-between text-[10px] font-mono text-slate-400">
                  <span>LIVE CODE EDITOR (EDITS UPDATE PREVIEW INSTANTLY)</span>
                  {editableCode !== code && (
                    <button
                      type="button"
                      onClick={() => setEditableCode(code)}
                      className="text-amber-300 hover:underline cursor-pointer"
                    >
                      Reset edits
                    </button>
                  )}
                </div>
                <textarea
                  value={editableCode}
                  onChange={(e) => setEditableCode(e.target.value)}
                  spellCheck={false}
                  className="w-full h-[340px] p-3.5 bg-transparent text-cyan-200 font-mono text-xs leading-relaxed focus:outline-none resize-y"
                />
              </div>
            )}

            {(activeTab === 'preview' || activeTab === 'split') && (
              <div className="w-full bg-[#090d16] p-1 sm:p-2 overflow-x-auto">
                <div className={iframeWidthClass}>
                  <iframe
                    key={`inline-sandbox-${reloadKey}-${canvasBg}`}
                    title="NEXUS Live Code Preview Sandbox"
                    srcDoc={srcDoc}
                    sandbox="allow-scripts allow-modals"
                    className="w-full h-[360px] rounded-xl border border-white/10 bg-transparent"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Default Source Code View (shown when inline preview is closed) */}
      {!previewOpen && (
        <pre
          className="p-4 text-cyan-200 font-mono text-xs overflow-x-auto m-0 leading-relaxed"
          style={{ backgroundColor: 'var(--assistant-answer-box-bg, rgba(2,6,23,0.9))' }}
        >
          <code>{editableCode}</code>
        </pre>
      )}

      {/* Fullscreen Artifact Split-View Modal */}
      {splitModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col p-2 sm:p-4 md:p-6 animate-in fade-in duration-150"
          onClick={() => setSplitModalOpen(false)}
        >
          <div
            className="w-full max-w-7xl mx-auto flex-1 flex flex-col rounded-2xl border border-cyan-500/35 bg-[#060a12] shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Top Header */}
            <div className="px-4 py-3 bg-slate-950 border-b border-cyan-500/25 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
                <span className="px-headline-aurora font-mono text-xs sm:text-sm font-extrabold uppercase tracking-wider">
                  LIVE ARTIFACT SANDBOX // {displayLang}
                </span>
              </div>

              {/* Center Tabs */}
              <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-white/10 font-mono text-xs">
                <button
                  type="button"
                  onClick={() => setActiveTab('split')}
                  className={`px-2.5 py-1 rounded-lg flex items-center gap-1.5 font-semibold transition-colors cursor-pointer ${
                    activeTab === 'split'
                      ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/40'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Columns size={12} />
                  <span>Split View</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('preview')}
                  className={`px-2.5 py-1 rounded-lg flex items-center gap-1.5 font-semibold transition-colors cursor-pointer ${
                    activeTab === 'preview'
                      ? 'bg-emerald-500/25 text-emerald-200 border border-emerald-400/40'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Eye size={12} />
                  <span>Preview Only</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('code')}
                  className={`px-2.5 py-1 rounded-lg flex items-center gap-1.5 font-semibold transition-colors cursor-pointer ${
                    activeTab === 'code'
                      ? 'bg-purple-500/25 text-purple-200 border border-purple-400/40'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Code2 size={12} />
                  <span>Code Only</span>
                </button>
              </div>

              {/* Right Actions */}
              <div className="flex items-center gap-1.5">
                <div className="hidden sm:flex items-center gap-0.5 bg-slate-900 p-1 rounded-lg border border-white/10">
                  <button
                    type="button"
                    onClick={() => setDeviceSize('desktop')}
                    className={`p-1 rounded cursor-pointer ${
                      deviceSize === 'desktop' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-white'
                    }`}
                    title="Desktop width"
                  >
                    <Monitor size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeviceSize('tablet')}
                    className={`p-1 rounded cursor-pointer ${
                      deviceSize === 'tablet' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-white'
                    }`}
                    title="Tablet width"
                  >
                    <Tablet size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeviceSize('mobile')}
                    className={`p-1 rounded cursor-pointer ${
                      deviceSize === 'mobile' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-white'
                    }`}
                    title="Mobile width"
                  >
                    <Smartphone size={13} />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setCanvasBg((prev) => (prev === 'dark' ? 'light' : 'dark'))}
                  className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-white/10 cursor-pointer"
                  title="Toggle Dark / Light canvas backdrop"
                >
                  {canvasBg === 'dark' ? <Sun size={14} className="text-amber-300" /> : <Moon size={14} className="text-cyan-300" />}
                </button>

                <button
                  type="button"
                  onClick={() => setReloadKey((k) => k + 1)}
                  className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 border border-white/10 cursor-pointer"
                  title="Reload preview"
                >
                  <RotateCcw size={14} />
                </button>

                <button
                  type="button"
                  onClick={handleDownloadHtml}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 flex items-center gap-1 text-xs font-mono font-semibold cursor-pointer"
                  title="Download standalone .html file"
                >
                  <Download size={13} />
                  <span className="hidden sm:inline">Download .html</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSplitModalOpen(false)}
                  className="p-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 cursor-pointer"
                  title="Close Artifact Split View"
                >
                  <Minimize2 size={14} className="hidden sm:block" />
                  <X size={14} className="sm:hidden" />
                </button>
              </div>
            </div>

            {/* Modal Split Content */}
            <div
              className={`flex-1 min-h-0 grid ${
                activeTab === 'split'
                  ? 'grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-white/10'
                  : 'grid-cols-1'
              }`}
            >
              {(activeTab === 'code' || activeTab === 'split') && (
                <div className="flex flex-col h-full min-h-[260px] bg-[#050811]">
                  <div className="px-4 py-2 bg-slate-950/80 border-b border-white/10 flex items-center justify-between text-[11px] font-mono text-slate-400">
                    <span>SOURCE CODE (LIVE EDITABLE)</span>
                    <div className="flex items-center gap-3">
                      {editableCode !== code && (
                        <button
                          type="button"
                          onClick={() => setEditableCode(code)}
                          className="text-amber-300 hover:underline cursor-pointer"
                        >
                          Reset to original
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleCopy}
                        className="text-cyan-300 hover:underline cursor-pointer"
                      >
                        {copied ? 'Copied ✓' : 'Copy Code'}
                      </button>
                    </div>
                  </div>
                  <textarea
                    value={editableCode}
                    onChange={(e) => setEditableCode(e.target.value)}
                    spellCheck={false}
                    className="flex-1 w-full p-4 bg-transparent text-cyan-200 font-mono text-xs sm:text-[13px] leading-relaxed focus:outline-none resize-none"
                  />
                </div>
              )}

              {(activeTab === 'preview' || activeTab === 'split') && (
                <div className="flex flex-col h-full min-h-[300px] bg-[#090d16] p-2 sm:p-3 overflow-auto">
                  <div className={`flex-1 flex flex-col ${iframeWidthClass}`}>
                    <iframe
                      key={`modal-sandbox-${reloadKey}-${canvasBg}`}
                      title="NEXUS Artifact Split Preview"
                      srcDoc={srcDoc}
                      sandbox="allow-scripts allow-modals"
                      className="w-full flex-1 min-h-[320px] rounded-xl border border-white/10 bg-transparent"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function cleanFormula(formula: string): string {
  if (!formula) return '';
  const f = formula
    .replace(/\\text\{([^}]+)\}/g, '$1')
    .replace(/\\mathrm\{([^}]+)\}/g, '$1')
    .replace(/\\mathbf\{([^}]+)\}/g, '$1')
    .replace(/\\left/g, '')
    .replace(/\\right/g, '')
    .replace(/\\times/g, ' × ')
    .replace(/\\cdot/g, ' · ')
    .replace(/\\approx/g, ' ≈ ')
    .replace(/\\neq/g, ' ≠ ')
    .replace(/\\leq/g, ' ≤ ')
    .replace(/\\geq/g, ' ≥ ')
    .replace(/\\pm/g, ' ± ')
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1 / $2)')
    .replace(/\\sqrt\{([^}]+)\}/g, '√($1)')
    .replace(/\\quad|\\qquad/g, '  ')
    .replace(/\\,/g, ' ')
    .replace(/\\;/g, ' ')
    .replace(/\\!/g, '')
    .replace(/\\/g, '')
    .trim();
  return f;
}

function cleanLatexMath(raw: string): string {
  if (!raw) return '';
  let text = raw;
  // Replace block math delimiters \[ ... \] or $$ ... $$
  text = text.replace(/\\\[([\s\S]*?)\\\]/g, (_match, math) => cleanFormula(math));
  text = text.replace(/\$\$([\s\S]*?)\$\$/g, (_match, math) => cleanFormula(math));
  // Replace inline math delimiters \( ... \) or $...$
  text = text.replace(/\\\(([\s\S]*?)\\\)/g, (_match, math) => cleanFormula(math));
  return text;
}

function renderInline(text: string): React.ReactNode {
  if (!text) return null;
  const sanitized = cleanLatexMath(text);
  // Split by markdown syntax: **bold**, `code`, [link text](url), *italic*, _italic_
  const parts = sanitized.split(
    /(\*\*.*?\*\*|`.*?`|\[[^\]]+\]\(https?:\/\/[^\s)]+\)|\*[^*\n]+\*|_[^_\n]+_)/g,
  );

  return parts.map((part, i) => {
    if (!part) return null;

    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return (
        <strong key={i} className="text-white font-bold tracking-tight">
          {part.slice(2, -2)}
        </strong>
      );
    }

    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <code
          key={i}
          className="px-2 py-0.5 mx-0.5 rounded-lg font-mono text-xs font-semibold"
          style={{
            background: 'var(--assistant-answer-box-bg, rgba(97,215,201,0.15))',
            color: 'var(--assistant-answer-link-color, #61d7c9)',
            border: '1px solid rgba(97,215,201,0.3)',
          }}
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    const linkMatch = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
    if (linkMatch) {
      return (
        <a
          key={i}
          href={linkMatch[2]}
          target="_blank"
          rel="noreferrer"
          className="text-cyan-300 hover:text-cyan-100 underline decoration-cyan-400/50 underline-offset-2 transition-colors font-medium inline-flex items-center gap-0.5"
          style={{
            color: 'var(--assistant-answer-link-color, inherit)',
            textDecorationColor: 'var(--assistant-answer-link-color, currentColor)',
          }}
        >
          <span>{linkMatch[1]}</span>
          <ExternalLink size={10} className="inline opacity-70 ml-0.5" />
        </a>
      );
    }

    if (
      ((part.startsWith('*') && part.endsWith('*')) ||
        (part.startsWith('_') && part.endsWith('_'))) &&
      part.length >= 2
    ) {
      return (
        <em key={i} className="text-slate-200 italic">
          {part.slice(1, -1)}
        </em>
      );
    }

    return part;
  });
}

export function FormattedText({
  content,
  enableCopyCode,
  variant = 'default',
}: {
  content: string;
  enableCopyCode?: boolean;
  variant?: 'default' | 'plain';
}) {
  if (!content) return null;

  const isPlain = variant === 'plain';

  const shouldEnableCopy =
    enableCopyCode !== undefined
      ? enableCopyCode
      : typeof window !== 'undefined'
        ? !window.location.pathname.includes('/multi-chat')
        : true;

  const rawLines = content.split('\n');

  // Pre-scan fenced code blocks to bundle sibling HTML + CSS + JS blocks in the same response
  const siblingBundle: SiblingCodeBundle = {};
  {
    let scanInBlock = false;
    let scanLang = '';
    let scanBuf: string[] = [];
    for (let i = 0; i < rawLines.length; i++) {
      const t = rawLines[i].trim();
      if (t.startsWith('```')) {
        if (scanInBlock) {
          const blockCode = scanBuf.join('\n');
          const norm = scanLang.toLowerCase();
          if ((norm === 'html' || norm === 'htm') && !siblingBundle.html) {
            siblingBundle.html = blockCode;
          } else if ((norm === 'css' || norm === 'scss') && !siblingBundle.css) {
            siblingBundle.css = blockCode;
          } else if (
            (norm === 'javascript' || norm === 'js') &&
            !siblingBundle.js
          ) {
            siblingBundle.js = blockCode;
          }
          scanBuf = [];
          scanLang = '';
          scanInBlock = false;
        } else {
          scanInBlock = true;
          scanLang = t.slice(3).trim();
        }
      } else if (scanInBlock) {
        scanBuf.push(rawLines[i]);
      }
    }
  }

  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBuffer: string[] = [];
  let codeLang = '';

  let tableBuffer: string[] = [];
  const flushTable = (keyPrefix: string) => {
    if (tableBuffer.length === 0) return;
    const rows = tableBuffer.map((r) =>
      r
        .trim()
        .replace(/^\||\|$/g, '')
        .split('|')
        .map((cell) => cell.trim()),
    );
    tableBuffer = [];
    if (rows.length === 0) return;

    // Check if second row is separator like --- | ---
    const isSeparator = (row: string[]) =>
      row.every((cell) => /^:?-+:?$/.test(cell));

    let headerRow: string[] | null = null;
    let bodyRows: string[][] = [];

    if (rows.length >= 2 && isSeparator(rows[1])) {
      headerRow = rows[0];
      bodyRows = rows.slice(2);
    } else {
      bodyRows = rows;
    }

    if (isPlain) {
      elements.push(
        <div
          key={`table-${keyPrefix}`}
          className="my-3 max-w-full overflow-x-auto rounded-xl border border-white/[0.1] bg-white/[0.02]"
        >
          <table className="min-w-full divide-y divide-white/[0.1] text-xs sm:text-[13px]">
            {headerRow && (
              <thead className="bg-white/[0.04]">
                <tr>
                  {headerRow.map((h, i) => (
                    <th
                      key={i}
                      className="px-3 py-2 text-left font-semibold text-slate-200 uppercase tracking-wider font-mono text-[11px] sm:text-xs whitespace-nowrap"
                    >
                      {renderInline(h)}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody className="divide-y divide-white/[0.08]">
              {bodyRows.map((row, rIdx) => (
                <tr key={rIdx} className={rIdx % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.02]'}>
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="px-3 py-2 text-slate-200 align-top">
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      return;
    }

    elements.push(
      <div
        key={`table-${keyPrefix}`}
        className="my-3.5 overflow-x-auto rounded-xl border border-cyan-500/25 shadow-md"
        style={{ backgroundColor: 'var(--assistant-answer-box-bg, rgba(2,6,23,0.6))' }}
      >
        <table className="min-w-full divide-y divide-cyan-500/20 text-xs sm:text-sm">
          {headerRow && (
            <thead className="bg-cyan-950/40">
              <tr>
                {headerRow.map((h, i) => (
                  <th
                    key={i}
                    className="px-3.5 py-2 text-left font-bold text-cyan-300 uppercase tracking-wider font-mono"
                  >
                    {renderInline(h)}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody className="divide-y divide-white/5">
            {bodyRows.map((row, rIdx) => (
              <tr key={rIdx} className={rIdx % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.02]'}>
                {row.map((cell, cIdx) => (
                  <td key={cIdx} className="px-3.5 py-2 text-slate-200">
                    {renderInline(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>,
    );
  };

  for (let idx = 0; idx < rawLines.length; idx++) {
    const line = rawLines[idx];
    const trimmed = line.trim();

    // Code blocks
    if (trimmed.startsWith('```')) {
      if (tableBuffer.length > 0) flushTable(`pre-code-${idx}`);
      if (inCodeBlock) {
        elements.push(
          <JarvisCodeBlock
            key={`code-box-${idx}`}
            code={codeBuffer.join('\n')}
            language={codeLang}
            showCopyButton={shouldEnableCopy}
            siblings={siblingBundle}
          />,
        );
        codeBuffer = [];
        codeLang = '';
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
        codeLang = trimmed.slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      continue;
    }

    // Markdown table rows
    if (trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.length > 2) {
      tableBuffer.push(trimmed);
      continue;
    } else if (tableBuffer.length > 0) {
      flushTable(`line-${idx}`);
    }

    // Blank line
    if (!trimmed) {
      elements.push(<div key={`space-${idx}`} className="h-2" />);
      continue;
    }

    // Horizontal Rule
    if (/^([-*_]){3,}$/.test(trimmed)) {
      elements.push(<hr key={`hr-${idx}`} className="my-4 border-t border-white/15" />);
      continue;
    }

    // Headings
    if (trimmed.startsWith('#### ')) {
      elements.push(
        isPlain ? (
          <div key={idx} className="mt-3 mb-1">
            <h5 className="text-xs sm:text-sm font-semibold text-slate-200 m-0 tracking-wide">
              {renderInline(trimmed.slice(5))}
            </h5>
          </div>
        ) : (
          <div key={idx} className="flex items-center gap-2 mt-3 mb-1.5">
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              className="shrink-0 overflow-visible"
              aria-hidden="true"
            >
              <circle
                cx="8"
                cy="8"
                r="5.8"
                fill="none"
                stroke="#2dd4bf"
                strokeWidth="1.3"
                strokeDasharray="3 2"
                className="mc-orbit-cw"
              />
              <circle cx="8" cy="8" r="2.2" fill="#38bdf8" />
            </svg>
            <h5
              className="text-sm font-extrabold px-section-headline m-0 tracking-wide"
              style={{ color: 'var(--assistant-answer-title-color, inherit)' }}
            >
              {renderInline(trimmed.slice(5))}
            </h5>
          </div>
        ),
      );
      continue;
    }

    if (trimmed.startsWith('### ')) {
      elements.push(
        isPlain ? (
          <div key={idx} className="mt-3.5 mb-1.5">
            <h4 className="text-sm sm:text-[15px] font-bold text-slate-100 m-0 tracking-tight">
              {renderInline(trimmed.slice(4))}
            </h4>
          </div>
        ) : (
          <div key={idx} className="mt-4 mb-2 space-y-1">
            <div className="flex items-center gap-2">
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                className="shrink-0 overflow-visible"
                aria-hidden="true"
              >
                <circle
                  cx="8"
                  cy="8"
                  r="6.2"
                  fill="none"
                  stroke="#00f0ff"
                  strokeWidth="1.3"
                  strokeDasharray="3.5 2"
                  className="mc-orbit-cw"
                />
                <circle cx="8" cy="8" r="2.5" fill="#c084fc" />
              </svg>
              <h4
                className="text-base font-extrabold px-section-headline m-0 tracking-wide"
                style={{ color: 'var(--assistant-answer-title-color, inherit)' }}
              >
                {renderInline(trimmed.slice(4))}
              </h4>
            </div>
            <div className="px-headline-laser-track !max-w-[180px]" />
          </div>
        ),
      );
      continue;
    }

    if (trimmed.startsWith('## ')) {
      elements.push(
        isPlain ? (
          <div
            key={idx}
            className="mt-4 mb-2 pt-2.5 border-t border-white/[0.08] first:mt-1 first:pt-0 first:border-t-0"
          >
            <h3 className="text-sm sm:text-base font-bold text-white m-0 tracking-tight">
              {renderInline(trimmed.slice(3))}
            </h3>
          </div>
        ) : (
          <div key={idx} className="mt-5 mb-2.5 pt-2 border-t border-white/10 space-y-1.5">
            <div className="flex items-center gap-2.5">
              <svg
                width="16"
                height="16"
                viewBox="0 0 18 18"
                className="shrink-0 overflow-visible"
                aria-hidden="true"
              >
                <circle
                  cx="9"
                  cy="9"
                  r="7"
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="1.3"
                  strokeDasharray="4 2"
                  className="mc-orbit-cw"
                />
                <circle
                  cx="9"
                  cy="9"
                  r="4.2"
                  fill="none"
                  stroke="#ec4899"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                  className="mc-orbit-ccw"
                />
                <circle cx="9" cy="9" r="2.2" fill="#fbbf24" />
              </svg>
              <h3
                className="text-lg font-black px-headline-aurora m-0 tracking-tight"
                style={{ color: 'var(--assistant-answer-title-color, inherit)' }}
              >
                {renderInline(trimmed.slice(3))}
              </h3>
            </div>
            <div className="px-headline-laser-track !max-w-[240px]" />
          </div>
        ),
      );
      continue;
    }

    if (trimmed.startsWith('# ')) {
      elements.push(
        isPlain ? (
          <div key={idx} className="mt-5 mb-2.5">
            <h2 className="text-base sm:text-lg font-bold text-white m-0 tracking-tight">
              {renderInline(trimmed.slice(2))}
            </h2>
          </div>
        ) : (
          <div key={idx} className="mt-6 mb-3 space-y-1.5">
            <div className="flex items-center gap-3">
              <svg
                width="18"
                height="18"
                viewBox="0 0 20 20"
                className="shrink-0 overflow-visible"
                aria-hidden="true"
              >
                <circle
                  cx="10"
                  cy="10"
                  r="8"
                  fill="none"
                  stroke="#00f0ff"
                  strokeWidth="1.4"
                  strokeDasharray="4 2"
                  className="mc-orbit-cw"
                />
                <circle
                  cx="10"
                  cy="10"
                  r="5"
                  fill="none"
                  stroke="#a855f7"
                  strokeWidth="1.1"
                  strokeDasharray="2.5 2"
                  className="mc-orbit-ccw"
                />
                <circle cx="10" cy="10" r="2.5" fill="#ec4899" />
              </svg>
              <h2
                className="text-xl font-black px-headline-aurora m-0 tracking-tight"
                style={{ color: 'var(--assistant-answer-title-color, inherit)' }}
              >
                {renderInline(trimmed.slice(2))}
              </h2>
            </div>
            <div className="px-headline-laser-track !max-w-[280px]" />
          </div>
        ),
      );
      continue;
    }

    // Blockquote
    if (trimmed.startsWith('>')) {
      const quoteText = trimmed.replace(/^>\s*/, '');
      elements.push(
        <blockquote
          key={idx}
          className={
            isPlain
              ? 'my-2 pl-3 py-1 border-l-2 border-white/20 text-slate-300 text-xs sm:text-sm italic'
              : 'my-2.5 pl-3.5 py-1.5 border-l-2 border-cyan-400/60 rounded-r-lg text-cyan-100/90 text-sm italic'
          }
          style={
            isPlain
              ? undefined
              : { backgroundColor: 'var(--assistant-answer-box-bg, rgba(8,47,73,0.2))' }
          }
        >
          {renderInline(quoteText)}
        </blockquote>,
      );
      continue;
    }

    // Indentation calculation
    const leadingWhitespaceMatch = line.match(/^(\s*)/);
    const leadingSpaces = leadingWhitespaceMatch
      ? leadingWhitespaceMatch[1].replace(/\t/g, '  ').length
      : 0;
    const indentLevel = Math.floor(leadingSpaces / 2);

    // Numbered list item: e.g. "1. Accretion Disk:" or "2) Title" or "10. ..."
    const numberedMatch = trimmed.match(/^(\d+)[.)]\s+(.*)$/);
    if (numberedMatch) {
      const num = numberedMatch[1];
      const itemText = numberedMatch[2];

      if (indentLevel === 0) {
        elements.push(
          <div key={idx} className="flex items-start gap-2.5 my-1.5 pl-1">
            <span
              className={
                isPlain
                  ? 'inline-flex items-center justify-center min-w-[20px] h-[20px] px-1 rounded bg-white/[0.06] border border-white/[0.1] text-slate-200 font-mono text-[11px] font-semibold shrink-0 mt-0.5'
                  : 'inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-md bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 font-mono text-xs font-bold shrink-0 mt-0.5 shadow-[0_0_8px_rgba(97,215,201,0.2)]'
              }
            >
              {num}
            </span>
            <div
              className={`flex-1 leading-relaxed text-slate-100 ${
                isPlain ? 'text-[13px] sm:text-sm' : 'text-sm sm:text-[15px]'
              }`}
            >
              {renderInline(itemText)}
            </div>
          </div>,
        );
      } else {
        elements.push(
          <div
            key={idx}
            className={`flex items-start gap-2 my-1.5 ${indentLevel === 1 ? 'pl-6 sm:pl-8' : 'pl-10 sm:pl-12'}`}
          >
            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded bg-white/[0.06] border border-white/[0.1] text-slate-300 font-mono text-[11px] font-bold shrink-0 mt-0.5">
              {num}
            </span>
            <div className="flex-1 leading-relaxed text-slate-200 text-xs sm:text-sm">
              {renderInline(itemText)}
            </div>
          </div>,
        );
      }
      continue;
    }

    // Bullet list item: e.g. "- item", "* item", "• item", "+ item"
    if (
      trimmed.startsWith('- ') ||
      trimmed.startsWith('* ') ||
      trimmed.startsWith('• ') ||
      trimmed.startsWith('+ ')
    ) {
      const itemText = trimmed.replace(/^[-*•+]\s+/, '');

      if (indentLevel === 0) {
        elements.push(
          <div key={idx} className="flex items-start gap-2.5 my-1.5 pl-1.5">
            <span
              className={
                isPlain
                  ? 'w-1.5 h-1.5 rounded-full bg-slate-400 mt-2 shrink-0'
                  : 'w-1.5 h-1.5 rounded-full bg-cyan-400 mt-2 shrink-0 shadow-[0_0_6px_#61d7c9]'
              }
            />
            <div
              className={`flex-1 leading-relaxed text-slate-200 ${
                isPlain ? 'text-[13px] sm:text-sm' : 'text-sm sm:text-[15px]'
              }`}
            >
              {renderInline(itemText)}
            </div>
          </div>,
        );
      } else if (indentLevel === 1) {
        elements.push(
          <div key={idx} className="flex items-start gap-2.5 my-1.5 pl-6 sm:pl-8">
            <span
              className={
                isPlain
                  ? 'w-1.5 h-1.5 rounded-full bg-slate-500 mt-2 shrink-0'
                  : 'w-1.5 h-1.5 rounded-full bg-pink-400 mt-2 shrink-0 shadow-[0_0_6px_#f472b6]'
              }
            />
            <div className="flex-1 leading-relaxed text-slate-300 text-xs sm:text-sm">
              {renderInline(itemText)}
            </div>
          </div>,
        );
      } else {
        elements.push(
          <div key={idx} className="flex items-start gap-2 my-1 pl-10 sm:pl-12">
            <span className="w-1 h-1 rounded-full bg-slate-400 mt-2.5 shrink-0" />
            <div className="flex-1 leading-relaxed text-slate-300 text-xs sm:text-sm">
              {renderInline(itemText)}
            </div>
          </div>,
        );
      }
      continue;
    }

    // Indented continuation paragraph
    if (indentLevel > 0) {
      elements.push(
        <div
          key={idx}
          className={`my-1 leading-relaxed text-slate-300 text-xs sm:text-sm ${
            indentLevel === 1 ? 'pl-6 sm:pl-8' : 'pl-10 sm:pl-12'
          }`}
        >
          {renderInline(trimmed)}
        </div>,
      );
      continue;
    }

    // Default regular paragraph
    elements.push(
      <p
        key={idx}
        className={`my-1.5 leading-relaxed text-slate-200 ${
          isPlain ? 'text-[13px] sm:text-sm' : 'text-sm sm:text-[15px]'
        }`}
      >
        {renderInline(line)}
      </p>,
    );
  }

  if (inCodeBlock && codeBuffer.length > 0) {
    elements.push(
      <JarvisCodeBlock
        key="code-box-end"
        code={codeBuffer.join('\n')}
        language={codeLang}
        showCopyButton={shouldEnableCopy}
        siblings={siblingBundle}
      />,
    );
    codeBuffer = [];
  }

  if (tableBuffer.length > 0) {
    flushTable('end');
  }

  return (
    <div className="formatted-text-content min-w-0 max-w-full overflow-x-hidden">
      {elements}
    </div>
  );
}
