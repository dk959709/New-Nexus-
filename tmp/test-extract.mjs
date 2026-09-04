function extractTagContents(html, tagName) {
  const results = [];
  const openTagRegex = new RegExp(`<${tagName}\\b[^>]*>`, 'gi');
  let match;
  while ((match = openTagRegex.exec(html)) !== null) {
    const startIndex = match.index + match[0].length;
    let depth = 1;
    let searchIdx = startIndex;
    let endIndex = -1;

    while (depth > 0) {
      const nextOpen = html.toLowerCase().indexOf(`<${tagName}`, searchIdx);
      const nextClose = html.toLowerCase().indexOf(`</${tagName}>`, searchIdx);

      if (nextClose === -1) {
        endIndex = html.length;
        break;
      }

      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth++;
        searchIdx = nextOpen + `<${tagName}`.length;
      } else {
        depth--;
        if (depth === 0) {
          endIndex = nextClose;
          break;
        }
        searchIdx = nextClose + `</${tagName}>`.length;
      }
    }

    if (endIndex !== -1) {
      results.push(html.slice(startIndex, endIndex));
      openTagRegex.lastIndex = endIndex + `</${tagName}>`.length;
    }
  }

  return results;
}

function cleanHtmlToText(html) {
  let cleaned = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, ' ')
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, ' ')
    .replace(/<canvas\b[^<]*(?:(?!<\/canvas>)<[^<]*)*<\/canvas>/gi, ' ')
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, ' ')
    .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, ' ')
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, ' ')
    .replace(/<aside\b[^<]*(?:(?!<\/aside>)<[^<]*)*<\/aside>/gi, ' ')
    .replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, ' ');

  cleaned = cleaned
    .replace(/<\/(h[1-6]|p|div|section|article|li|tr|blockquote)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ');

  cleaned = cleaned.replace(/<[^>]+>/g, ' ');

  cleaned = cleaned
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&mdash;/gi, '—')
    .replace(/&ndash;/gi, '–')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

  const lines = cleaned
    .split('\n')
    .map((l) => l.replace(/[ \t]+/g, ' ').trim())
    .filter((l) => l.length > 0 && l !== '•' && l !== '• ');

  return lines.join('\n\n');
}

function extractPrioritizedContent(html) {
  // Try <article>
  const articleSnippets = extractTagContents(html, 'article');
  if (articleSnippets.length > 0) {
    const combinedArticle = articleSnippets.join('\n\n');
    const articleText = cleanHtmlToText(combinedArticle);
    if (articleText.trim().length >= 80) {
      return { text: articleText, source: 'article', snippet: combinedArticle };
    }
  }

  // Try <main>
  const mainSnippets = extractTagContents(html, 'main');
  if (mainSnippets.length > 0) {
    const combinedMain = mainSnippets.join('\n\n');
    const mainText = cleanHtmlToText(combinedMain);
    if (mainText.trim().length >= 80) {
      return { text: mainText, source: 'main', snippet: combinedMain };
    }
  }

  // Fallback to full page as-is
  const fullText = cleanHtmlToText(html);
  return { text: fullText, source: 'full-page', snippet: html };
}

const samplePage = `
<!DOCTYPE html>
<html>
<head><title>Sample Article</title></head>
<body>
<nav>
  <ul>
    <li>AI</li><li>Computing</li><li>Phones</li><li>Gaming</li>
    <li>Trending Topics: GPT-5, Copilot, Grok, DeepSeek, Perplexity</li>
  </ul>
</nav>
<header><h1>Site Banner</h1></header>
<main>
  <article>
    <h1>Claude Fable 5.1 and Mythos 5.1 Arrive</h1>
    <h2>Major Improvements</h2>
    <p>Anthropic launched Claude Fable 5.1 and Mythos 5.1 with higher performance and lower costs for developers.</p>
    <p>Developers get a 75 percent discount on cache reads, significantly speeding up long-context workloads.</p>
  </article>
  <aside>
    <h3>Related Stories</h3>
    <p>Check out our previous article about AI PC trends.</p>
  </aside>
</main>
<footer><p>&copy; 2026 Digital Trends. All rights reserved.</p></footer>
</body>
</html>
`;

const res = extractPrioritizedContent(samplePage);
console.log('SOURCE:', res.source);
console.log('TEXT:\n' + res.text);
