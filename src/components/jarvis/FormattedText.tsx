import React from 'react';
import { ExternalLink } from 'lucide-react';

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
            background: 'rgba(97,215,201,0.15)',
            color: '#61d7c9',
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

export function FormattedText({ content }: { content: string }) {
  if (!content) return null;

  const rawLines = content.split('\n');
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

    elements.push(
      <div
        key={`table-${keyPrefix}`}
        className="my-3.5 overflow-x-auto rounded-xl border border-cyan-500/25 bg-slate-950/60 shadow-md"
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
          <div
            key={`code-box-${idx}`}
            className="my-3 rounded-2xl overflow-hidden border border-cyan-500/30 shadow-lg"
          >
            <div className="bg-slate-950 px-4 py-1.5 border-b border-cyan-500/20 flex items-center justify-between text-[11px] font-mono text-cyan-300 font-semibold">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
                <span className="ml-2">{codeLang ? codeLang.toUpperCase() : 'CODE / SYNTAX'}</span>
              </span>
            </div>
            <pre className="p-4 bg-slate-950/90 text-cyan-200 font-mono text-xs overflow-x-auto m-0 leading-relaxed">
              <code>{codeBuffer.join('\n')}</code>
            </pre>
          </div>,
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
        <div key={idx} className="flex items-center gap-2 mt-3 mb-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-teal-400 shadow-[0_0_6px_#2dd4bf]" />
          <h5 className="text-sm font-bold text-teal-300 m-0 tracking-wide">
            {renderInline(trimmed.slice(5))}
          </h5>
        </div>,
      );
      continue;
    }

    if (trimmed.startsWith('### ')) {
      elements.push(
        <div key={idx} className="flex items-center gap-2 mt-4 mb-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#61d7c9]" />
          <h4 className="text-base font-bold text-cyan-300 m-0 tracking-wide">
            {renderInline(trimmed.slice(4))}
          </h4>
        </div>,
      );
      continue;
    }

    if (trimmed.startsWith('## ')) {
      elements.push(
        <div key={idx} className="flex items-center gap-2.5 mt-5 mb-2.5 pt-2 border-t border-white/10">
          <span className="w-2.5 h-2.5 rounded-full bg-sky-400 shadow-[0_0_10px_#38bdf8]" />
          <h3 className="text-lg font-black text-white m-0 tracking-tight">
            {renderInline(trimmed.slice(3))}
          </h3>
        </div>,
      );
      continue;
    }

    if (trimmed.startsWith('# ')) {
      elements.push(
        <div key={idx} className="flex items-center gap-3 mt-6 mb-3">
          <span className="w-3 h-3 rounded-full bg-purple-400 shadow-[0_0_12px_#a855f7]" />
          <h2 className="text-xl font-black text-white m-0 tracking-tight">
            {renderInline(trimmed.slice(2))}
          </h2>
        </div>,
      );
      continue;
    }

    // Blockquote
    if (trimmed.startsWith('>')) {
      const quoteText = trimmed.replace(/^>\s*/, '');
      elements.push(
        <blockquote
          key={idx}
          className="my-2.5 pl-3.5 py-1.5 border-l-2 border-cyan-400/60 bg-cyan-950/20 rounded-r-lg text-cyan-100/90 text-sm italic"
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
          <div key={idx} className="flex items-start gap-2.5 my-2 pl-1">
            <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-md bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 font-mono text-xs font-bold shrink-0 mt-0.5 shadow-[0_0_8px_rgba(97,215,201,0.2)]">
              {num}
            </span>
            <div className="flex-1 leading-relaxed text-slate-100 text-sm sm:text-[15px]">
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
            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded bg-purple-500/20 border border-purple-400/30 text-purple-300 font-mono text-[11px] font-bold shrink-0 mt-0.5">
              {num}
            </span>
            <div className="flex-1 leading-relaxed text-slate-200 text-sm">
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
          <div key={idx} className="flex items-start gap-2.5 my-1.5 pl-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-2 shrink-0 shadow-[0_0_6px_#61d7c9]" />
            <div className="flex-1 leading-relaxed text-slate-200 text-sm sm:text-[15px]">
              {renderInline(itemText)}
            </div>
          </div>,
        );
      } else if (indentLevel === 1) {
        elements.push(
          <div key={idx} className="flex items-start gap-2.5 my-1.5 pl-6 sm:pl-8">
            <span className="w-1.5 h-1.5 rounded-full bg-pink-400 mt-2 shrink-0 shadow-[0_0_6px_#f472b6]" />
            <div className="flex-1 leading-relaxed text-slate-300 text-sm sm:text-[14.5px]">
              {renderInline(itemText)}
            </div>
          </div>,
        );
      } else {
        elements.push(
          <div key={idx} className="flex items-start gap-2 my-1 pl-10 sm:pl-12">
            <span className="w-1 h-1 rounded-full bg-sky-400 mt-2.5 shrink-0 shadow-[0_0_4px_#38bdf8]" />
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
          className={`my-1 leading-relaxed text-slate-300 text-sm ${
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
      <p key={idx} className="my-2 leading-relaxed text-slate-200 text-sm sm:text-[15px]">
        {renderInline(line)}
      </p>,
    );
  }

  if (tableBuffer.length > 0) {
    flushTable('end');
  }

  return <div className="formatted-text-content">{elements}</div>;
}
