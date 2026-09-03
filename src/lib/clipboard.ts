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
function formatInlineMarkdown(text: string, color?: string, strongColor?: string): string {
  if (!text) return '';
  let res = escapeHtml(text);
  const boldColor = strongColor || color || '#0f172a';
  // Bold: **text**
  res = res.replace(/\*\*([^*]+)\*\*/g, `<strong style="color: ${boldColor}; font-weight: 700;">$1</strong>`);
  // Italic: *text*
  res = res.replace(/(^|[^*])\*([^*]+)\*([^*]|$)/g, '$1<em style="font-style: italic;">$2</em>$3');
  // Code: `code`
  res = res.replace(/`([^`]+)`/g, `<code style="background: rgba(0, 0, 0, 0.05); padding: 2px 4px; border-radius: 4px; font-size: 0.9em; font-family: monospace; color: ${boldColor};">$1</code>`);
  return res;
}

interface SectionTheme {
  primary: string;
  strong: string;
  border: string;
}

const SECTION_THEMES: Record<string, SectionTheme> = {
  header: {
    primary: '#64748b', // Slate 500 (light neutral grey)
    strong: '#475569',  // Slate 600
    border: '#cbd5e1',  // Slate 300
  },
  footer: {
    primary: '#64748b', // Slate 500 (light neutral grey)
    strong: '#475569',
    border: '#cbd5e1',
  },
  planner: {
    primary: '#0891b2', // Cyan 600
    strong: '#0e7490',  // Cyan 700 (bold cyan)
    border: '#0891b2',
  },
  researcher: {
    primary: '#b45309', // Amber 700 / Brown
    strong: '#92400e',  // Amber 800
    border: '#b45309',
  },
  factchecker: {
    primary: '#7c3aed', // Violet 600 / Purple
    strong: '#6d28d9',  // Violet 700
    border: '#7c3aed',
  },
  reviewer: {
    primary: '#059669', // Emerald 600 Green
    strong: '#047857',  // Emerald 700
    border: '#059669',
  },
  synth: {
    primary: '#9333ea', // Purple 600 Glow (matching on-screen UI badge)
    strong: '#7e22ce',  // Purple 700
    border: '#9333ea',
  },
  citations: {
    primary: '#0284c7', // Sky / Blue 600
    strong: '#0369a1',
    border: '#0284c7',
  },
  advisor: {
    primary: '#4f46e5', // Indigo 600
    strong: '#4338ca',
    border: '#4f46e5',
  },
  webfetcher: {
    primary: '#0d9488', // Teal 600
    strong: '#0f766e',
    border: '#0d9488',
  },
  default: {
    primary: '#334155', // Slate 700
    strong: '#0f172a',
    border: '#cbd5e1',
  },
};

/**
 * Converts standard pipeline export Markdown to semantic, inline-styled rich HTML
 * suitable for pasting into Notion, Google Docs, Apple Notes, and rich-text email clients (Gmail, Outlook).
 * Applies full-line section coloring across every component of the report:
 * - Neutral light grey (#64748b) for Report Header/Footer and Models Used
 * - Cyan (#0891b2) for Planner title and body lines
 * - Brown/Amber (#b45309) for Researcher findings title and description
 * - Purple (#7c3aed) for FactChecker claims title and description (isolated per section)
 * - Emerald green (#059669) for Reviewer verdict, score, and critique
 * - Purple glow (#9333ea) for Final Synthesis unified intelligence
 * - Blue (#0284c7) for Source and Green (#059669) for Confirmed by
 */
export function formatMarkdownToRichHtml(markdown: string, defaultThemeColor?: string): string {
  if (!markdown) return '';
  const lines = markdown.split(/\r?\n/);
  const htmlParts: string[] = [];

  let currentSection = 'default';

  if (defaultThemeColor) {
    const colorLower = defaultThemeColor.toLowerCase();
    if (colorLower.includes('b45309') || colorLower.includes('d97706') || colorLower.includes('amber')) {
      currentSection = 'researcher';
    } else if (colorLower.includes('7c3aed') || colorLower.includes('purple') || colorLower.includes('violet')) {
      currentSection = 'factchecker';
    } else if (colorLower.includes('0891b2') || colorLower.includes('06b6d4') || colorLower.includes('cyan')) {
      currentSection = 'planner';
    } else if (colorLower.includes('059669') || colorLower.includes('10b981') || colorLower.includes('emerald') || colorLower.includes('green')) {
      currentSection = 'reviewer';
    } else if (colorLower.includes('c084fc') || colorLower.includes('9333ea') || colorLower.includes('a855f7')) {
      currentSection = 'synth';
    }
  } else if (/JARVIS INTELLIGENCE REPORT|^={10,}/m.test(markdown)) {
    currentSection = 'header';
  } else if (/Targeted Research Scope/i.test(markdown)) {
    currentSection = 'researcher';
  } else if (/Verification Audit Scope/i.test(markdown)) {
    currentSection = 'factchecker';
  } else if (/Targeted Objective|Strategic Execution Plan/i.test(markdown)) {
    currentSection = 'planner';
  }

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (!line) {
      htmlParts.push('<div style="height: 8px;"></div>');
      continue;
    }

    // Check for Section Banners (=== AGENT ===)
    if (/^===+\s*PLANNER\b/i.test(line)) {
      currentSection = 'planner';
      const theme = SECTION_THEMES.planner;
      htmlParts.push(
        `<h2 style="color: ${theme.strong}; font-size: 16px; font-weight: 800; margin: 24px 0 10px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; border-bottom: 2px solid ${theme.border}; padding-bottom: 5px; letter-spacing: 0.03em;">${escapeHtml(line)}</h2>`
      );
      continue;
    }

    if (/^===+\s*RESEARCHER\b/i.test(line)) {
      currentSection = 'researcher';
      const theme = SECTION_THEMES.researcher;
      htmlParts.push(
        `<h2 style="color: ${theme.strong}; font-size: 16px; font-weight: 800; margin: 24px 0 10px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; border-bottom: 2px solid ${theme.border}; padding-bottom: 5px; letter-spacing: 0.03em;">${escapeHtml(line)}</h2>`
      );
      continue;
    }

    if (/^===+\s*FACT\s*CHECKER\b/i.test(line) || /^===+\s*FACTCHECKER\b/i.test(line)) {
      currentSection = 'factchecker';
      const theme = SECTION_THEMES.factchecker;
      htmlParts.push(
        `<h2 style="color: ${theme.strong}; font-size: 16px; font-weight: 800; margin: 24px 0 10px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; border-bottom: 2px solid ${theme.border}; padding-bottom: 5px; letter-spacing: 0.03em;">${escapeHtml(line)}</h2>`
      );
      continue;
    }

    if (/^===+\s*REVIEWER\b/i.test(line)) {
      currentSection = 'reviewer';
      const theme = SECTION_THEMES.reviewer;
      htmlParts.push(
        `<h2 style="color: ${theme.strong}; font-size: 16px; font-weight: 800; margin: 24px 0 10px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; border-bottom: 2px solid ${theme.border}; padding-bottom: 5px; letter-spacing: 0.03em;">${escapeHtml(line)}</h2>`
      );
      continue;
    }

    if (/^===+\s*FINAL SYNTHESIS\b/i.test(line)) {
      currentSection = 'synth';
      const theme = SECTION_THEMES.synth;
      htmlParts.push(
        `<h2 style="color: ${theme.strong}; font-size: 16.5px; font-weight: 800; margin: 28px 0 12px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; border-bottom: 2px solid ${theme.border}; padding-bottom: 6px; letter-spacing: 0.03em;">${escapeHtml(line)}</h2>`
      );
      continue;
    }

    if (/^===+\s*VERIFIED CITATIONS\b/i.test(line)) {
      currentSection = 'citations';
      const theme = SECTION_THEMES.citations;
      htmlParts.push(
        `<h2 style="color: ${theme.strong}; font-size: 15.5px; font-weight: 700; margin: 24px 0 10px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; border-bottom: 1.5px solid ${theme.border}; padding-bottom: 4px;">${escapeHtml(line)}</h2>`
      );
      continue;
    }

    if (/^===+\s*ADVISOR\b/i.test(line)) {
      currentSection = 'advisor';
      const theme = SECTION_THEMES.advisor;
      htmlParts.push(
        `<h2 style="color: ${theme.strong}; font-size: 16px; font-weight: 800; margin: 24px 0 10px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; border-bottom: 2px solid ${theme.border}; padding-bottom: 5px;">${escapeHtml(line)}</h2>`
      );
      continue;
    }

    if (/^===+\s*WEB FETCHER\b/i.test(line)) {
      currentSection = 'webfetcher';
      const theme = SECTION_THEMES.webfetcher;
      htmlParts.push(
        `<h2 style="color: ${theme.strong}; font-size: 16px; font-weight: 800; margin: 24px 0 10px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; border-bottom: 2px solid ${theme.border}; padding-bottom: 5px;">${escapeHtml(line)}</h2>`
      );
      continue;
    }

    // Top Report Header Title
    if (line === 'JARVIS INTELLIGENCE REPORT') {
      currentSection = 'header';
      htmlParts.push(
        `<div style="color: #475569; font-size: 17px; font-weight: 800; letter-spacing: 0.06em; margin: 8px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">JARVIS INTELLIGENCE REPORT</div>`
      );
      continue;
    }

    // Top Report Header Metadata (Query, Mode, Timestamp)
    if (currentSection === 'header') {
      const headerMetaMatch = line.match(/^(Query|Mode|Timestamp):\s*(.*)$/i);
      if (headerMetaMatch) {
        const label = headerMetaMatch[1];
        const val = headerMetaMatch[2].trim();
        htmlParts.push(
          `<div style="margin: 3px 0; font-size: 13.5px; line-height: 1.5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;"><strong style="color: #475569; font-weight: 700;">${escapeHtml(label)}:</strong> <span style="color: #64748b;">${escapeHtml(val)}</span></div>`
        );
        continue;
      }

      if (/^--- MULTI-AGENT INTERMEDIATE/i.test(line)) {
        htmlParts.push(
          `<div style="color: #475569; font-size: 13.5px; font-weight: 800; letter-spacing: 0.04em; margin: 16px 0 4px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">--- MULTI-AGENT INTERMEDIATE SPECIALIST DELIBERATIONS ---</div>`
        );
        continue;
      }
    }

    // Footer lines
    if (/^Models Used:/i.test(line)) {
      currentSection = 'footer';
      htmlParts.push(
        `<div style="margin-top: 18px; font-size: 13px; font-weight: 700; color: #475569; font-family: monospace;">Models Used:</div>`
      );
      continue;
    }

    if (currentSection === 'footer' && line.includes(':')) {
      htmlParts.push(
        `<div style="margin: 2px 0; font-size: 12px; color: #64748b; font-family: monospace;">${escapeHtml(line)}</div>`
      );
      continue;
    }

    if (/^End of Autonomous Multi-Agent/i.test(line)) {
      currentSection = 'footer';
      htmlParts.push(
        `<div style="margin-top: 8px; font-size: 12px; font-style: italic; color: #64748b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">${escapeHtml(line)}</div>`
      );
      continue;
    }

    // Delimiter rules (===...=== or ---...---)
    if (/^={10,}$/.test(line) || /^-{10,}$/.test(line) || line === '---' || line === '***' || line === '___') {
      if (currentSection === 'header' || currentSection === 'footer') {
        htmlParts.push(
          `<div style="border-top: 1px solid #cbd5e1; margin: 12px 0; opacity: 0.8;"></div>`
        );
      } else {
        htmlParts.push(
          `<hr style="border: none; border-top: 1px solid #cbd5e1; margin: 18px 0;" />`
        );
      }
      continue;
    }

    // Select the active section's color palette
    const theme = SECTION_THEMES[currentSection] || SECTION_THEMES.default;

    // Header 1: # Title
    if (line.startsWith('# ')) {
      const text = line.substring(2).trim();
      htmlParts.push(
        `<h1 style="color: ${theme.strong}; font-size: 19px; font-weight: 800; margin: 20px 0 10px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; border-bottom: 2px solid ${theme.border}; padding-bottom: 6px;">${escapeHtml(text)}</h1>`
      );
      continue;
    }

    // Header 2: ## Subtitle
    if (line.startsWith('## ')) {
      const text = line.substring(3).trim();
      htmlParts.push(
        `<h2 style="color: ${theme.strong}; font-size: 16px; font-weight: 700; margin: 18px 0 8px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; border-bottom: 1px solid ${theme.border}; padding-bottom: 4px;">${escapeHtml(text)}</h2>`
      );
      continue;
    }

    // Header 3: ### Section Header
    if (line.startsWith('### ')) {
      const text = line.substring(4).trim();
      if (/Targeted Research Scope|Verified Empirical Findings/i.test(text)) {
        currentSection = 'researcher';
      } else if (/Verification Audit Scope|Verified Empirical Claims/i.test(text)) {
        currentSection = 'factchecker';
      }
      const activeTheme = SECTION_THEMES[currentSection] || theme;
      htmlParts.push(
        `<h3 style="color: ${activeTheme.strong}; font-size: 14.5px; font-weight: 700; margin: 16px 0 8px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">${escapeHtml(text)}</h3>`
      );
      continue;
    }

    // Attribution: Source (Blue) & Confirmed By (Emerald Green) - preserved exactly as requested!
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

    const confirmedMatch = rawLine.match(/^\s*-\s*\*\*Confirmed by:\*\*\s*(.*)$/i);
    if (confirmedMatch) {
      const confContent = confirmedMatch[1].trim();
      htmlParts.push(
        `<div style="margin: 2px 0 6px 24px; font-size: 13px; line-height: 1.5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;"><strong style="color: #059669;">Confirmed by:</strong> <span style="color: #059669; font-weight: 600;">${escapeHtml(confContent)}</span></div>`
      );
      continue;
    }

    // Citation item: [1] Title - url
    const citationMatch = line.match(/^\[(\d+)\]\s+(.*?)(?:\s+-\s+(https?:\/\/[^\s]+))?$/);
    if (currentSection === 'citations' && citationMatch) {
      const num = citationMatch[1];
      const title = citationMatch[2].trim();
      const url = citationMatch[3];
      htmlParts.push(
        `<div style="margin: 4px 0 4px 16px; font-size: 13.5px; line-height: 1.5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;"><span style="color: #0284c7; font-weight: 600;">[${num}] ${escapeHtml(title)}</span>${url ? ` <a href="${escapeHtml(url)}" style="color: #0284c7; text-decoration: underline;">${escapeHtml(url)}</a>` : ''}</div>`
      );
      continue;
    }

    // Numbered Item with Bold Title: 1. **Title:** Description
    const numBoldMatch = line.match(/^(\d+)\.\s+\*\*([^*]+):\*\*\s*(.*)$/);
    if (numBoldMatch) {
      const num = numBoldMatch[1];
      const title = numBoldMatch[2].trim();
      const rest = numBoldMatch[3].trim();
      htmlParts.push(
        `<div style="margin: 10px 0 4px 0; font-size: 14px; line-height: 1.6; color: ${theme.primary}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;"><strong style="color: ${theme.strong}; font-weight: 700;">${num}. ${escapeHtml(title)}:</strong> <span style="color: ${theme.primary};">${formatInlineMarkdown(rest, theme.primary, theme.strong)}</span></div>`
      );
      continue;
    }

    // Numbered Item with Bold without colon: 1. **Title** Description
    const numBoldNoColon = line.match(/^(\d+)\.\s+\*\*([^*]+)\*\*\s*(.*)$/);
    if (numBoldNoColon) {
      const num = numBoldNoColon[1];
      const title = numBoldNoColon[2].trim();
      const rest = numBoldNoColon[3].trim();
      htmlParts.push(
        `<div style="margin: 10px 0 4px 0; font-size: 14px; line-height: 1.6; color: ${theme.primary}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;"><strong style="color: ${theme.strong}; font-weight: 700;">${num}. ${escapeHtml(title)}</strong> <span style="color: ${theme.primary};">${formatInlineMarkdown(rest, theme.primary, theme.strong)}</span></div>`
      );
      continue;
    }

    // Numbered Item without bold: e.g. 1. Phase 1: Description or 1. Description
    const numMatch = line.match(/^(\d+)\.\s+(.*)$/);
    if (numMatch) {
      const num = numMatch[1];
      const content = numMatch[2].trim();
      const colonIdx = content.indexOf(':');
      if (colonIdx > 0 && colonIdx < 30) {
        const lead = content.substring(0, colonIdx).trim();
        const body = content.substring(colonIdx + 1).trim();
        htmlParts.push(
          `<div style="margin: 8px 0 4px 0; font-size: 14px; line-height: 1.6; color: ${theme.primary}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;"><strong style="color: ${theme.strong}; font-weight: 700;">${num}. ${escapeHtml(lead)}:</strong> <span style="color: ${theme.primary};">${formatInlineMarkdown(body, theme.primary, theme.strong)}</span></div>`
        );
      } else {
        htmlParts.push(
          `<div style="margin: 8px 0 4px 0; font-size: 14px; line-height: 1.6; color: ${theme.primary}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;"><strong style="color: ${theme.strong}; font-weight: 700;">${num}.</strong> <span style="color: ${theme.primary};">${formatInlineMarkdown(content, theme.primary, theme.strong)}</span></div>`
        );
      }
      continue;
    }

    // Scope / Bold label line: e.g. **Research Focus:** Value or **Audit Scope:** Value
    const scopeMatch = line.match(/^\*\*([^*]+):\*\*\s*(.*)$/);
    if (scopeMatch) {
      const label = scopeMatch[1].trim();
      const val = scopeMatch[2].trim();
      htmlParts.push(
        `<p style="margin: 6px 0 10px 0; font-size: 14px; line-height: 1.6; color: ${theme.primary}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;"><strong style="color: ${theme.strong}; font-weight: 700;">${escapeHtml(label)}:</strong> <span style="color: ${theme.primary};">${formatInlineMarkdown(val, theme.primary, theme.strong)}</span></p>`
      );
      continue;
    }

    // Unbolded section subheaders or directive lines ending with colon, e.g.:
    // "Targeted Objective:", "Strategic Execution Plan:", "Pipeline Directives:", "Refinements & Editorial Critique:"
    const subheaderMatch = line.match(/^([A-Za-z &/,_-]+):\s*(.*)$/);
    if (subheaderMatch && !line.startsWith('http') && subheaderMatch[1].length < 40) {
      const label = subheaderMatch[1].trim();
      const val = subheaderMatch[2].trim();
      if (!val) {
        htmlParts.push(
          `<div style="margin: 12px 0 4px 0; font-size: 14px; font-weight: 700; color: ${theme.strong}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">${escapeHtml(label)}:</div>`
        );
        continue;
      } else {
        htmlParts.push(
          `<div style="margin: 6px 0; font-size: 14px; line-height: 1.6; color: ${theme.primary}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;"><strong style="color: ${theme.strong}; font-weight: 700;">${escapeHtml(label)}:</strong> <span style="color: ${theme.primary};">${formatInlineMarkdown(val, theme.primary, theme.strong)}</span></div>`
        );
        continue;
      }
    }

    // Bullet Directive: - **Label:** Value
    const bulletBoldMatch = line.match(/^[-*•]\s+\*\*([^*]+):\*\*\s*(.*)$/);
    if (bulletBoldMatch) {
      const label = bulletBoldMatch[1].trim();
      const val = bulletBoldMatch[2].trim();
      htmlParts.push(
        `<div style="margin: 4px 0 4px 16px; font-size: 13.5px; line-height: 1.5; color: ${theme.primary}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">• <strong style="color: ${theme.strong}; font-weight: 700;">${escapeHtml(label)}:</strong> <span style="color: ${theme.primary};">${formatInlineMarkdown(val, theme.primary, theme.strong)}</span></div>`
      );
      continue;
    }

    // Bullet with colon without bold: - Label: Value
    const bulletColonMatch = line.match(/^[-*•]\s+([A-Za-z0-9 _/()-]+):\s*(.*)$/);
    if (bulletColonMatch) {
      const label = bulletColonMatch[1].trim();
      const val = bulletColonMatch[2].trim();
      htmlParts.push(
        `<div style="margin: 4px 0 4px 16px; font-size: 13.5px; line-height: 1.5; color: ${theme.primary}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">• <strong style="color: ${theme.strong}; font-weight: 700;">${escapeHtml(label)}:</strong> <span style="color: ${theme.primary};">${formatInlineMarkdown(val, theme.primary, theme.strong)}</span></div>`
      );
      continue;
    }

    // Plain bullet: - Text or * Text or • Text
    const plainBulletMatch = line.match(/^[-*•]\s+(.*)$/);
    if (plainBulletMatch) {
      const val = plainBulletMatch[1].trim();
      htmlParts.push(
        `<div style="margin: 4px 0 4px 16px; font-size: 13.5px; line-height: 1.5; color: ${theme.primary}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">• <span style="color: ${theme.primary};">${formatInlineMarkdown(val, theme.primary, theme.strong)}</span></div>`
      );
      continue;
    }

    // Standard paragraph line (convert any inline markdown)
    htmlParts.push(
      `<p style="margin: 6px 0; font-size: 14px; line-height: 1.6; color: ${theme.primary}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">${formatInlineMarkdown(line, theme.primary, theme.strong)}</p>`
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
