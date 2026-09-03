function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Parses inline markdown tokens (**bold**, *italic*, `code`) into semantic HTML with inline styling.
 * Prevents any raw markdown characters (like ** or `) from leaking into the rich text HTML.
 */
function formatInlineMarkdown(text: string): string {
  if (!text) return '';
  let res = escapeHtml(text);
  // Bold: **text**
  res = res.replace(/\*\*([^*]+)\*\*/g, '<strong style="color: #0f172a; font-weight: 700;">$1</strong>');
  // Italic: *text*
  res = res.replace(/(^|[^*])\*([^*]+)\*([^*]|$)/g, '$1<em style="font-style: italic;">$2</em>$3');
  // Code: `code`
  res = res.replace(/`([^`]+)`/g, '<code style="background: #f1f5f9; padding: 2px 4px; border-radius: 4px; font-size: 0.9em; font-family: monospace; color: #334155;">$1</code>');
  return res;
}

/**
 * Converts standard pipeline export Markdown to semantic, inline-styled rich HTML
 * suitable for pasting into Notion, Google Docs, Apple Notes, and rich-text email clients (Gmail, Outlook).
 * Retains colors matching the UI (amber bronze for Researcher, violet purple for FactChecker,
 * cyan for Planner, blue for sources, and emerald for confirmed by).
 */
export function formatMarkdownToRichHtml(markdown: string, defaultThemeColor?: string): string {
  if (!markdown) return '';
  const lines = markdown.split(/\r?\n/);
  const htmlParts: string[] = [];

  const isResearcher = /Targeted Research Scope|RESEARCHER/i.test(markdown);
  const isFactChecker = /Verification Audit Scope|FACT CHECKER/i.test(markdown);
  const isPlanner = /Targeted Objective|PLANNER/i.test(markdown);

  const primaryAccent = defaultThemeColor || (
    isResearcher ? '#b45309' :
    isFactChecker ? '#7c3aed' :
    isPlanner ? '#0891b2' : '#0284c7'
  );

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (!line) {
      htmlParts.push('<div style="height: 8px;"></div>');
      continue;
    }

    // Horizontal Rule
    if (line === '---' || line === '***' || line === '___') {
      htmlParts.push('<hr style="border: none; border-top: 1px solid #cbd5e1; margin: 16px 0;" />');
      continue;
    }

    // Header 1: # Title
    if (line.startsWith('# ')) {
      const text = line.substring(2).trim();
      htmlParts.push(
        `<h1 style="color: #0284c7; font-size: 20px; font-weight: 800; margin: 20px 0 10px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; border-bottom: 2px solid #0284c7; padding-bottom: 6px;">${escapeHtml(text)}</h1>`
      );
      continue;
    }

    // Header 2: ## Subtitle
    if (line.startsWith('## ')) {
      const text = line.substring(3).trim();
      htmlParts.push(
        `<h2 style="color: #0891b2; font-size: 17px; font-weight: 700; margin: 18px 0 8px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px;">${escapeHtml(text)}</h2>`
      );
      continue;
    }

    // Header 3: ### Section Header
    if (line.startsWith('### ')) {
      const text = line.substring(4).trim();
      let h3Color = primaryAccent;
      if (/Targeted Research Scope|RESEARCHER/i.test(text)) h3Color = '#b45309';
      else if (/Verified Empirical Findings/i.test(text)) h3Color = '#b45309';
      else if (/Verification Audit Scope|FACT CHECKER/i.test(text)) h3Color = '#7c3aed';
      else if (/Verified Empirical Claims/i.test(text)) h3Color = '#7c3aed';
      else if (/Targeted Objective|Strategic Execution Plan|PLANNER/i.test(text)) h3Color = '#0891b2';
      else if (/Quality Assurance|REVIEWER/i.test(text)) h3Color = '#059669';

      htmlParts.push(
        `<h3 style="color: ${h3Color}; font-size: 15px; font-weight: 700; margin: 16px 0 8px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">${escapeHtml(text)}</h3>`
      );
      continue;
    }

    // Scope / Focus line: e.g. **Research Focus:** ... or **Audit Scope:** ... or **Task Scope:** ...
    const scopeMatch = line.match(/^\*\*([^*]+):\*\*\s*(.*)$/);
    if (scopeMatch) {
      const label = scopeMatch[1].trim();
      const val = scopeMatch[2].trim();
      htmlParts.push(
        `<p style="margin: 6px 0 10px 0; font-size: 14px; line-height: 1.6; color: #1e293b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;"><strong style="color: ${primaryAccent}; font-weight: 700;">${escapeHtml(label)}:</strong> <span style="color: #334155;">${formatInlineMarkdown(val)}</span></p>`
      );
      continue;
    }

    // Attribution:   - **Source:** ...
    const sourceMatch = rawLine.match(/^\s*-\s*\*\*Source:\*\*\s*(.*)$/i);
    if (sourceMatch) {
      const sourceContent = sourceMatch[1].trim();
      const dateMatch = sourceContent.match(/^(.*?)\s*(\([^)]+\))$/);
      let domainPart = sourceContent;
      let datePart = '';
      if (dateMatch) {
        domainPart = dateMatch[1].trim();
        datePart = ` ${dateMatch[2].trim()}`;
      }
      htmlParts.push(
        `<div style="margin: 2px 0 3px 24px; font-size: 13px; line-height: 1.5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;"><strong style="color: #64748b;">Source:</strong> <span style="color: #0284c7; font-weight: 600;">${escapeHtml(domainPart)}</span><span style="color: #64748b;">${escapeHtml(datePart)}</span></div>`
      );
      continue;
    }

    // Attribution:   - **Confirmed by:** ...
    const confirmedMatch = rawLine.match(/^\s*-\s*\*\*Confirmed by:\*\*\s*(.*)$/i);
    if (confirmedMatch) {
      const confContent = confirmedMatch[1].trim();
      htmlParts.push(
        `<div style="margin: 2px 0 6px 24px; font-size: 13px; line-height: 1.5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;"><strong style="color: #059669;">Confirmed by:</strong> <span style="color: #059669; font-weight: 600;">${escapeHtml(confContent)}</span></div>`
      );
      continue;
    }

    // Numbered List Item: 1. **Title:** Fact
    const numBoldMatch = line.match(/^(\d+)\.\s+\*\*([^*]+):\*\*\s*(.*)$/);
    if (numBoldMatch) {
      const num = numBoldMatch[1];
      const title = numBoldMatch[2].trim();
      const rest = numBoldMatch[3].trim();
      let titleColor = '#0f172a';
      if (isResearcher) titleColor = '#b45309';
      else if (isFactChecker) titleColor = '#7c3aed';

      htmlParts.push(
        `<div style="margin: 10px 0 4px 0; font-size: 14px; line-height: 1.6; color: #1e293b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;"><strong style="color: ${titleColor}; font-weight: 700;">${num}. ${escapeHtml(title)}:</strong> <span style="color: #334155;">${formatInlineMarkdown(rest)}</span></div>`
      );
      continue;
    }

    // Numbered Item without bold colon: 1. **Title** Rest or 1. Rest
    const numMatch = line.match(/^(\d+)\.\s+(.*)$/);
    if (numMatch) {
      const num = numMatch[1];
      const content = numMatch[2].trim();
      const boldInner = content.match(/^\*\*([^*]+)\*\*\s*(.*)$/);
      if (boldInner) {
        htmlParts.push(
          `<div style="margin: 10px 0 4px 0; font-size: 14px; line-height: 1.6; color: #1e293b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;"><strong style="color: #0f172a; font-weight: 700;">${num}. ${escapeHtml(boldInner[1])}</strong> <span style="color: #334155;">${formatInlineMarkdown(boldInner[2])}</span></div>`
        );
      } else {
        htmlParts.push(
          `<div style="margin: 10px 0 4px 0; font-size: 14px; line-height: 1.6; color: #0f172a; font-weight: 700;">${num}.</strong> <span style="color: #334155;">${formatInlineMarkdown(content)}</span></div>`
        );
      }
      continue;
    }

    // Bullet Directive: - **Label:** Value
    const bulletBoldMatch = line.match(/^[-*•]\s+\*\*([^*]+):\*\*\s*(.*)$/);
    if (bulletBoldMatch) {
      const label = bulletBoldMatch[1].trim();
      const val = bulletBoldMatch[2].trim();
      htmlParts.push(
        `<div style="margin: 4px 0 4px 16px; font-size: 13.5px; line-height: 1.5; color: #1e293b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">• <strong style="color: #334155;">${escapeHtml(label)}:</strong> <span style="color: #475569;">${formatInlineMarkdown(val)}</span></div>`
      );
      continue;
    }

    // Models used / metadata block
    if (line.startsWith('Models Used:') || line.startsWith('Agent:') || line.includes(': unknown') || line.includes(': gemini') || line.includes(': anthropic')) {
      htmlParts.push(
        `<div style="margin-top: 14px; font-size: 12px; color: #64748b; font-family: monospace;">${escapeHtml(line)}</div>`
      );
      continue;
    }

    // Standard paragraph line (convert any inline markdown)
    htmlParts.push(
      `<p style="margin: 6px 0; font-size: 14px; line-height: 1.6; color: #334155; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">${formatInlineMarkdown(line)}</p>`
    );
  }

  return `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 800px;">${htmlParts.join('')}</div>`;
}

/**
 * Synchronous rich-text copy using a hidden contenteditable container
 * and document.execCommand('copy') with a capture 'copy' event listener.
 * This runs synchronously within the immediate user gesture, working reliably in:
 * - Iframes (where navigator.clipboard is blocked by Permissions-Policy)
 * - Mobile Chrome / WebView (where async clipboard permissions are restricted)
 * - Desktop Safari / Chrome / Firefox
 */
function copyRichHtmlSync(content: string, html: string): boolean {
  if (typeof document === 'undefined') return false;
  let success = false;

  const onCopy = (e: ClipboardEvent) => {
    e.preventDefault();
    if (e.clipboardData) {
      e.clipboardData.clearData();
      // Crucial: Set text/html FIRST so rich text targets (Gmail, Notion, Google Docs) prioritize it,
      // and set text/plain SECOND as the fallback representation.
      e.clipboardData.setData('text/html', html);
      e.clipboardData.setData('text/plain', content);
      success = true;
    }
  };

  document.addEventListener('copy', onCopy, { capture: true });
  try {
    const container = document.createElement('div');
    container.setAttribute('contenteditable', 'true');
    container.innerHTML = html;
    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.left = '-9999px';
    container.style.width = '200px';
    container.style.height = '100px';
    container.style.opacity = '0.01';
    container.style.pointerEvents = 'none';
    document.body.appendChild(container);

    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(container);
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }

    const execResult = document.execCommand('copy');
    if (selection) {
      selection.removeAllRanges();
    }
    document.body.removeChild(container);

    if (execResult && success) {
      return true;
    }
  } catch (err) {
    console.warn('[Clipboard] execCommand rich text sync failed:', err);
  } finally {
    document.removeEventListener('copy', onCopy, { capture: true });
  }

  return success;
}

/**
 * Bulletproof clipboard utility that handles iframes, touch devices,
 * mobile Chrome, browser permission restrictions, and rich text (HTML + plain text) copying.
 * When html is provided, apps supporting rich text (Gmail, Notion, Google Docs, Apple Notes)
 * paste the formatted text with preserved colors and headings, while plain text editors
 * receive the exact plain text string.
 */
export async function copyToClipboard(text: string, html?: string): Promise<boolean> {
  if (text === undefined || text === null) return false;
  const content = typeof text === 'string' ? text : String(text);

  let richCopied = false;

  // 1. If HTML is provided, first execute synchronous rich text copy
  // This preserves the synchronous user gesture in iframes and mobile Chrome
  if (html) {
    richCopied = copyRichHtmlSync(content, html);
  }

  // 2. Try modern Async Clipboard API with ClipboardItem containing text/html FIRST, text/plain SECOND
  if (
    typeof navigator !== 'undefined' &&
    navigator.clipboard &&
    typeof navigator.clipboard.write === 'function' &&
    typeof ClipboardItem !== 'undefined' &&
    html
  ) {
    try {
      const htmlBlob = new Blob([html], { type: 'text/html' });
      const textBlob = new Blob([content], { type: 'text/plain' });
      // IMPORTANT: In ClipboardItem, 'text/html' MUST come before 'text/plain'
      // so Chrome Android and clipboard managers treat the HTML representation as primary!
      const clipboardItem = new ClipboardItem({
        'text/html': htmlBlob,
        'text/plain': textBlob,
      });
      await navigator.clipboard.write([clipboardItem]);
      richCopied = true;
    } catch (err) {
      console.warn('[Clipboard] navigator.clipboard.write with HTML failed (permissions or iframe):', err);
    }
  }

  // If rich text copying succeeded (either via execCommand or Async Clipboard), return true!
  // CRITICAL: Do NOT fall through to writeText, which would overwrite the clipboard with raw markdown!
  if (richCopied) {
    return true;
  }

  // 3. Fallback for plain text ONLY if rich text copying was not requested or failed completely
  if (
    typeof navigator !== 'undefined' &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === 'function'
  ) {
    try {
      await navigator.clipboard.writeText(content);
      return true;
    } catch (err) {
      console.warn('[Clipboard] navigator.clipboard.writeText failed, trying textarea fallback:', err);
    }
  }

  // 4. Synchronous plain text textarea fallback
  if (typeof document !== 'undefined') {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = content;
      textarea.style.position = 'fixed';
      textarea.style.top = '0px';
      textarea.style.left = '0px';
      textarea.style.width = '2em';
      textarea.style.height = '2em';
      textarea.style.padding = '0';
      textarea.style.border = 'none';
      textarea.style.outline = 'none';
      textarea.style.boxShadow = 'none';
      textarea.style.background = 'transparent';
      textarea.setAttribute('readonly', '');
      textarea.style.opacity = '0.01';

      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);

      const successful = document.execCommand('copy');
      document.body.removeChild(textarea);
      return successful;
    } catch (fallbackErr) {
      console.error('[Clipboard] All copy attempts failed:', fallbackErr);
      return false;
    }
  }

  return false;
}
