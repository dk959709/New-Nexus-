import { api } from '@/services/api';
import { storage, DEFAULT_AGENT_SYSTEM_PROMPTS } from '@/lib/storage';
import { searchWikipedia, getWikipediaSummary } from '@/services/wikipedia';
import { stripConversationalMetaText } from '@/lib/format';
import { logToJarvisTerminal } from '@/lib/jarvisTerminalLogger';
import { formatCandidateBullet } from '@/lib/factFormatter';
import type {
  AIProviderConfig,
  AISource,
  JarvisAgentConfig,
  JarvisAgentId,
  JarvisChartData,
  JarvisExecutionStep,
  JarvisImageResult,
  JarvisSystemConfig,
  SearchResult,
} from '@/types';

export interface JarvisExecutionResult {
  answer: string;
  steps: JarvisExecutionStep[];
  sources: AISource[];
  diagramSvg?: string;
  chartData?: JarvisChartData | null;
  images?: JarvisImageResult[];
  error?: string;
}

export interface StepUpdateCallback {
  (step: JarvisExecutionStep): void;
}

export function extractImageQueryFromText(text: string): string | null {
  if (!text || typeof text !== 'string') return null;

  let raw = text.trim();
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch && fenceMatch[1]) {
    raw = fenceMatch[1].trim();
  }

  const startIdx = raw.indexOf('{');
  const endIdx = raw.lastIndexOf('}');
  if (startIdx >= 0 && endIdx > startIdx) {
    raw = raw.slice(startIdx, endIdx + 1);
  }

  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      const q = parsed.searchQuery || parsed.query || parsed.imageQuery || parsed.search_query;
      if (q && typeof q === 'string' && q.trim().length > 0) {
        return q.trim();
      }
    }
  } catch {
    // If JSON parsing fails, continue to string match
  }

  // Fallback: Check if regex finds "searchQuery": "..."
  const regexMatch = text.match(/"searchQuery"\s*:\s*"([^"]+)"/i);
  if (regexMatch && regexMatch[1]) {
    return regexMatch[1].trim();
  }

  // Fallback: If returned a short single line query without JSON braces
  if (raw.length > 0 && raw.length < 120 && !raw.includes('{') && !raw.includes('}') && !raw.includes('\n')) {
    return raw.replace(/^["']|["']$/g, '').trim();
  }

  return null;
}

/**
 * Executes a real image search using NEXUS's existing search infrastructure
 * and official educational media APIs (Wikimedia Commons & Wikipedia) to retrieve
 * actual photos with real source URLs and attribution - NEVER fabricated.
 */
export async function fetchJarvisRealImages(
  searchQuery: string,
  limit = 4,
): Promise<JarvisImageResult[]> {
  const trimmed = searchQuery.trim();
  if (!trimmed) return [];

  const results: JarvisImageResult[] = [];
  const seenUrls = new Set<string>();

  // 1. First attempt: NEXUS search API with category "IMAGES"
  try {
    const apiResults = await api.search(trimmed, 'IMAGES');
    if (Array.isArray(apiResults) && apiResults.length > 0) {
      for (const item of apiResults) {
        const imgUrl = item.image || item.thumbnail;
        if (imgUrl && !seenUrls.has(imgUrl) && !imgUrl.endsWith('.svg') && !imgUrl.endsWith('.ico')) {
          seenUrls.add(imgUrl);
          results.push({
            title: item.title || trimmed,
            url: imgUrl,
            sourceUrl: item.url,
            domain: item.domain || 'web',
            thumbnailUrl: item.thumbnail || imgUrl,
            author: item.channel,
          });
        }
        if (results.length >= limit) break;
      }
    }
  } catch (err) {
    console.warn('[JARVIS Image Finder] Backend image search unavailable, falling back to Wikimedia/Wikipedia:', err);
  }

  // 2. Second attempt / supplement: Wikimedia Commons Search API for real photographic media
  if (results.length < limit) {
    try {
      const wikiCommonsUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
        trimmed,
      )}&gsrnamespace=6&gsrlimit=${limit * 2}&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=800&format=json&origin=*`;

      const response = await fetch(wikiCommonsUrl, {
        headers: {
          'Api-User-Agent': 'NEXUS-Intelligence/1.0 (https://nexus.app; contact: support@nexus.app)',
        },
      });

      if (response.ok) {
        const data = (await response.json()) as {
          query?: {
            pages?: Record<
              string,
              {
                title?: string;
                imageinfo?: Array<{
                  url?: string;
                  thumburl?: string;
                  descriptionshorturl?: string;
                  descriptionurl?: string;
                  mime?: string;
                  extmetadata?: {
                    ObjectName?: { value?: string };
                    ImageDescription?: { value?: string };
                    Artist?: { value?: string };
                    LicenseShortName?: { value?: string };
                  };
                }>;
              }
            >;
          };
        };

        const pages = data.query?.pages ? Object.values(data.query.pages) : [];
        for (const page of pages) {
          const info = page.imageinfo?.[0];
          const imgUrl = info?.thumburl || info?.url;
          const mime = info?.mime || '';

          // Only accept standard photographic bitmap mime types (jpeg, png, webp)
          if (
            imgUrl &&
            !seenUrls.has(imgUrl) &&
            !mime.includes('svg') &&
            !mime.includes('pdf') &&
            !mime.includes('ogg') &&
            !mime.includes('audio') &&
            !mime.includes('video')
          ) {
            seenUrls.add(imgUrl);

            // Clean title: remove "File:" prefix and file extensions
            const cleanTitle = (page.title || trimmed)
              .replace(/^File:/i, '')
              .replace(/\.(jpg|jpeg|png|webp|tiff|gif)$/i, '')
              .replace(/_/g, ' ')
              .trim();

            const artistRaw = info.extmetadata?.Artist?.value;
            const cleanArtist = artistRaw ? artistRaw.replace(/<[^>]*>/g, '').trim() : undefined;
            const license = info.extmetadata?.LicenseShortName?.value;

            results.push({
              title: cleanTitle || trimmed,
              url: imgUrl,
              sourceUrl: info.descriptionshorturl || info.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title || '')}`,
              domain: 'commons.wikimedia.org',
              thumbnailUrl: imgUrl,
              author: cleanArtist,
              license: license || 'Wikimedia Commons',
            });

            if (results.length >= limit) break;
          }
        }
      }
    } catch (wikiErr) {
      console.warn('[JARVIS Image Finder] Wikimedia Commons image fetch failed:', wikiErr);
    }
  }

  // 3. Third attempt / supplement: Wikipedia article thumbnail search
  if (results.length < limit) {
    try {
      const wikiArticles = await searchWikipedia(trimmed, limit);
      for (const article of wikiArticles) {
        if (article.thumbnail && !seenUrls.has(article.thumbnail)) {
          seenUrls.add(article.thumbnail);
          results.push({
            title: article.title,
            url: article.thumbnail,
            sourceUrl: article.url,
            domain: 'wikipedia.org',
            thumbnailUrl: article.thumbnail,
            license: 'Wikipedia',
          });
          if (results.length >= limit) break;
        }
      }
    } catch (artErr) {
      console.warn('[JARVIS Image Finder] Wikipedia article image fetch failed:', artErr);
    }
  }

  return results;
}

function parseCellNumber(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return isNaN(val) ? null : val;
  const clean = String(val).replace(/[*_`~]/g, '').trim();
  if (!clean) return null;
  // Match numbers with commas, decimals, units (e.g. "3,349 mAh", "$799", "128 GB", "50 MP", "120 Hz", "25 W")
  const match = clean.match(/([+-]?\d{1,3}(?:,\d{3})*(?:\.\d+)?|[+-]?\d+(?:\.\d+)?)/);
  if (match && match[1]) {
    const num = parseFloat(match[1].replace(/,/g, ''));
    return isNaN(num) ? null : num;
  }
  return null;
}

export function extractChartDataFromMarkdownTable(
  text: string,
  titleHint?: string,
): JarvisChartData | null {
  if (!text || typeof text !== 'string') return null;

  const lines = text.split(/\r?\n/);
  let tableLines: string[] = [];
  const tables: string[][] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.includes('|')) {
      tableLines.push(trimmed);
    } else {
      if (tableLines.length >= 3) {
        tables.push([...tableLines]);
      }
      tableLines = [];
    }
  }
  if (tableLines.length >= 3) {
    tables.push([...tableLines]);
  }

  for (const table of tables) {
    if (table.length < 3) continue;

    // Line 0: Header
    const rawHeaderCells = table[0]
      .split('|')
      .map((c) => c.trim().replace(/[*_`]/g, ''))
      .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);

    // Filter out delimiter line (usually index 1)
    const dataRows = table
      .slice(1)
      .filter((row) => {
        const withoutPipes = row.replace(/[|\s]/g, '');
        return !/^[-:]+$/.test(withoutPipes);
      })
      .map((row) =>
        row
          .split('|')
          .map((c) => c.trim())
          .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1),
      )
      .filter((row) => row.length >= 2 && !row.every((c) => /^[-:]+$/.test(c.replace(/[*_`]/g, ''))));

    if (rawHeaderCells.length < 2 || dataRows.length < 1) continue;

    const col0Values = dataRows.map((r) => r[0].replace(/[*_`]/g, '').trim());
    const entityCandidatesInHeader = rawHeaderCells.slice(1);

    // Case 1: Header contains entities (e.g. ['iPhone 15', 'Galaxy S24', 'Pixel 8']), rows contain specs/metrics
    let numericRowHits = 0;
    const rowSeriesList: Array<{ name: string; values: number[] }> = [];

    dataRows.forEach((row) => {
      const rowName = row[0].replace(/[*_`]/g, '').trim();
      const cells = row.slice(1);
      const nums = cells.map(parseCellNumber);
      const validNumsCount = nums.filter((n): n is number => n !== null).length;

      if (validNumsCount >= 1) {
        numericRowHits++;
        rowSeriesList.push({
          name: rowName,
          values: nums.map((n) => (n !== null ? n : 0)),
        });
      }
    });

    // Case 2: Header contains metrics/specs (e.g. ['Battery (mAh)', 'RAM (GB)']), col 0 contains entities
    let numericColHits = 0;
    const colSeriesList: Array<{ name: string; values: number[] }> = [];

    for (let cIdx = 1; cIdx < rawHeaderCells.length; cIdx++) {
      const colName = rawHeaderCells[cIdx];
      const colVals = dataRows.map((r) => parseCellNumber(r[cIdx]));
      const validCount = colVals.filter((n): n is number => n !== null).length;
      if (validCount >= 1) {
        numericColHits++;
        colSeriesList.push({
          name: colName,
          values: colVals.map((n) => (n !== null ? n : 0)),
        });
      }
    }

    // Determine best structure:
    if (numericRowHits >= 1 && entityCandidatesInHeader.length >= 2) {
      return {
        chartType: 'bar',
        title: titleHint ? `${titleHint.replace(/^compare\s+/i, '').trim()} Specifications` : 'Comparative Specifications',
        labels: entityCandidatesInHeader,
        series: rowSeriesList,
      };
    } else if (numericColHits >= 1 && col0Values.length >= 2) {
      const isTimeSeries = col0Values.some((v) =>
        /\b(19\d\d|20\d\d|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|q[1-4]|20[2-3]\d)\b/i.test(v),
      );
      return {
        chartType: isTimeSeries ? 'line' : 'bar',
        title: titleHint ? `${titleHint.replace(/^compare\s+/i, '').trim()} Specifications` : 'Comparative Specifications',
        labels: col0Values,
        series: colSeriesList,
      };
    }
  }

  return null;
}

export function extractChartDataFromBulletPoints(
  text: string,
  titleHint?: string,
): JarvisChartData | null {
  if (!text || typeof text !== 'string') return null;

  const lines = text.split(/\r?\n/);
  const itemEntries: Array<{ entity: string; specs: Record<string, number> }> = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('-') && !trimmed.startsWith('*') && !/^\d+\./.test(trimmed)) continue;

    // Pattern: - **Entity Name**: spec 1 (val), spec 2 (val)
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;

    const rawEntity = trimmed.slice(0, colonIdx).replace(/^[-*\d.]+\s*/, '').replace(/[*_`]/g, '').trim();
    const rawContent = trimmed.slice(colonIdx + 1);

    if (!rawEntity) continue;

    // Look for spec key-values e.g. "Battery: 3,349 mAh", "48 MP camera", "6 GB RAM"
    const specs: Record<string, number> = {};
    const clauses = rawContent.split(/[,;]/);

    for (const clause of clauses) {
      const num = parseCellNumber(clause);
      if (num !== null) {
        let metricName = clause.replace(/([+-]?\d{1,3}(?:,\d{3})*(?:\.\d+)?|[+-]?\d+(?:\.\d+)?)/g, '').replace(/[*_`]/g, '').trim();
        metricName = metricName.replace(/^[-:\s]+/, '').replace(/[-:\s]+$/, '');
        if (!metricName) metricName = 'Value';
        specs[metricName] = num;
      }
    }

    if (Object.keys(specs).length > 0) {
      itemEntries.push({ entity: rawEntity, specs });
    }
  }

  if (itemEntries.length >= 2) {
    const allMetrics = Array.from(new Set(itemEntries.flatMap((e) => Object.keys(e.specs))));
    if (allMetrics.length > 0) {
      const labels = itemEntries.map((e) => e.entity);
      const series = allMetrics.map((metric) => ({
        name: metric,
        values: itemEntries.map((e) => e.specs[metric] ?? 0),
      }));

      return {
        chartType: 'bar',
        title: titleHint ? `${titleHint.replace(/^compare\s+/i, '').trim()} Comparison` : 'Comparative Data Analysis',
        labels,
        series,
      };
    }
  }

  return null;
}

export function extractChartDataFromText(
  text: string,
  fallbackContextText?: string,
  titleHint?: string,
): JarvisChartData | null {
  if (!text || typeof text !== 'string') {
    if (fallbackContextText) {
      return (
        extractChartDataFromMarkdownTable(fallbackContextText, titleHint) ||
        extractChartDataFromBulletPoints(fallbackContextText, titleHint)
      );
    }
    return null;
  }

  // 1. Strip markdown code fences if present: ```json ... ```
  let raw = text.trim();
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch && fenceMatch[1]) {
    raw = fenceMatch[1].trim();
  }

  // 2. Find outermost JSON boundary ({ ... } or [ ... ])
  const firstBrace = raw.indexOf('{');
  const lastBrace = raw.lastIndexOf('}');
  const firstBracket = raw.indexOf('[');
  const lastBracket = raw.lastIndexOf(']');

  let toParse = raw;
  if (firstBrace >= 0 && lastBrace > firstBrace && (firstBracket < 0 || firstBrace < firstBracket)) {
    toParse = raw.slice(firstBrace, lastBrace + 1);
  } else if (firstBracket >= 0 && lastBracket > firstBracket) {
    toParse = raw.slice(firstBracket, lastBracket + 1);
  }

  try {
    const parsed = JSON.parse(toParse);

    // Format A: Object with series & labels
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const obj = parsed as Record<string, unknown>;
      const rawChartType = String(obj.chartType || obj.type || '').toLowerCase();
      const chartType: 'bar' | 'line' = rawChartType === 'line' ? 'line' : 'bar';
      const title = String(obj.title || obj.name || obj.heading || (titleHint ? `${titleHint} Comparison` : 'Data Comparison'));

      // Extract labels / categories
      const rawLabels =
        obj.labels ||
        obj.categories ||
        obj.xAxis ||
        obj.x_axis ||
        obj.columns ||
        obj.keys ||
        [];
      const labels: string[] = Array.isArray(rawLabels) ? rawLabels.map((l: unknown) => String(l ?? '')) : [];

      // Extract series / datasets
      const rawSeries = obj.series || obj.datasets || obj.data || obj.metrics;
      let series: Array<{ name: string; values: number[] }> = [];

      if (Array.isArray(rawSeries)) {
        series = rawSeries
          .filter((s: unknown): s is Record<string, unknown> => Boolean(s && typeof s === 'object'))
          .map((s) => {
            const name = String(s.name || s.label || s.title || 'Series');
            const vals = Array.isArray(s.values)
              ? s.values
              : Array.isArray(s.data)
              ? s.data
              : Array.isArray(s.points)
              ? s.points
              : [];
            const values = vals.map((v: unknown) => {
              const num = parseCellNumber(v);
              return num !== null ? num : 0;
            });
            return { name, values };
          })
          .filter((s) => s.values.length > 0);
      }

      if (series.length > 0 && labels.length > 0) {
        // Equalize series values length with labels length if needed
        const normalizedSeries = series.map((s) => {
          const values = [...s.values];
          while (values.length < labels.length) values.push(0);
          return { name: s.name, values: values.slice(0, labels.length) };
        });
        return {
          chartType,
          title,
          series: normalizedSeries,
          labels,
        };
      }
    }

    // Format B: Array of row objects e.g. [{ year: '2020', itemA: 10, itemB: 20 }, ...]
    if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object' && parsed[0] !== null) {
      const rows = parsed as Array<Record<string, unknown>>;
      const keys = Object.keys(rows[0]);
      const labelKey = keys.find((k) => typeof rows[0][k] === 'string') || keys[0];
      const numericKeys = keys.filter((k) => k !== labelKey && rows.some((r) => parseCellNumber(r[k]) !== null));

      if (numericKeys.length > 0) {
        const labels = rows.map((r, i) => String(r[labelKey] ?? `Point ${i + 1}`));
        const series = numericKeys.map((k) => ({
          name: k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, ' '),
          values: rows.map((r) => {
            const num = parseCellNumber(r[k]);
            return num !== null ? num : 0;
          }),
        }));

        return {
          chartType: 'bar',
          title: titleHint ? `${titleHint} Comparison` : 'Comparative Data Analysis',
          series,
          labels,
        };
      }
    }
  } catch {
    // If JSON parsing fails, fall through to table extraction
  }

  // 3. Fallback to Markdown Table extraction on the model output itself
  const tableData = extractChartDataFromMarkdownTable(text, titleHint);
  if (tableData) return tableData;

  // 4. Fallback to Bullet Points extraction on the model output itself
  const bulletData = extractChartDataFromBulletPoints(text, titleHint);
  if (bulletData) return bulletData;

  // 5. Fallback to Markdown Table extraction on fallbackContextText (e.g. finalAnswer or facts)
  if (fallbackContextText) {
    const fallbackTableData = extractChartDataFromMarkdownTable(fallbackContextText, titleHint);
    if (fallbackTableData) return fallbackTableData;

    const fallbackBulletData = extractChartDataFromBulletPoints(fallbackContextText, titleHint);
    if (fallbackBulletData) return fallbackBulletData;
  }

  return null;
}

export function extractSvgFromText(text: string): string | undefined {
  if (!text || typeof text !== 'string') return undefined;

  let candidate = text.trim();

  // Strip xml declarations and doctypes
  candidate = candidate.replace(/<\?xml[\s\S]*?\?>/gi, '').replace(/<!DOCTYPE[\s\S]*?>/gi, '');

  // 1. Check if enclosed in markdown code fences ```xml / ```svg / ```html / ```
  const fenceMatch = candidate.match(/```(?:xml|svg|html)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch && fenceMatch[1]) {
    candidate = fenceMatch[1].trim();
  }

  // 2. Direct regex match for <svg ... </svg>
  const svgMatch = candidate.match(/<svg[\s\S]*?<\/svg>/i);
  if (svgMatch && svgMatch[0]) {
    return cleanSvg(svgMatch[0]);
  }

  // 3. Match from first <svg to last </svg>
  const startIdx = candidate.indexOf('<svg');
  const lastEndIdx = candidate.lastIndexOf('</svg>');
  if (startIdx >= 0 && lastEndIdx > startIdx) {
    const slice = candidate.slice(startIdx, lastEndIdx + 6).trim();
    return cleanSvg(slice);
  }

  // 4. Fallback: starts with <svg but truncated before closing </svg>
  if (startIdx >= 0) {
    let slice = candidate.slice(startIdx).trim();
    if (slice.lastIndexOf('<') > slice.lastIndexOf('>')) {
      slice = slice.slice(0, slice.lastIndexOf('<')).trim();
    }
    if (!slice.endsWith('</svg>')) {
      if (slice.includes('<defs>') && !slice.includes('</defs>')) {
        slice += '\n</defs>';
      }
      if (slice.includes('<g') && (slice.match(/<g\b/g) || []).length > (slice.match(/<\/g>/g) || []).length) {
        const diff = (slice.match(/<g\b/g) || []).length - (slice.match(/<\/g>/g) || []).length;
        slice += '\n' + '</g>\n'.repeat(diff);
      }
      slice += '\n</svg>';
    }
    return cleanSvg(slice);
  }

  return undefined;
}

function cleanSvg(svg: string): string {
  let cleaned = svg.trim();

  // Strip xml declarations and markdown ticks
  cleaned = cleaned
    .replace(/^```(?:svg|xml|html)?/i, '')
    .replace(/```$/, '')
    .replace(/<\?xml[\s\S]*?\?>/gi, '')
    .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
    .trim();

  // Ensure xmlns is present if missing
  if (!cleaned.includes('xmlns="http://www.w3.org/2000/svg"')) {
    cleaned = cleaned.replace(/<svg\b/i, '<svg xmlns="http://www.w3.org/2000/svg"');
  }

  // Ensure viewBox is present
  if (!cleaned.includes('viewBox=')) {
    cleaned = cleaned.replace(/<svg\b/i, '<svg viewBox="0 0 800 480"');
  }

  // Ensure width/height are responsive
  if (!cleaned.includes('width="') && !cleaned.includes("width='")) {
    cleaned = cleaned.replace(/<svg\b/i, '<svg width="100%" height="100%"');
  }

  return cleaned;
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function generateConceptBlueprintSvg(query: string, contextText: string): string {
  const cleanTitle = query.replace(/[?.,!]+$/, '').trim();
  const lines = contextText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 10 && !l.startsWith('#') && !l.startsWith('---'));

  const points: Array<{ title: string; desc: string }> = [];
  for (const line of lines) {
    const bulletMatch = line.match(/^[-*•\d.]+\s*(?:\*\*(.*?)\*\*|([A-Za-z0-9\s-]+):)\s*(.*)/);
    if (bulletMatch) {
      const stepTitle = (bulletMatch[1] || bulletMatch[2] || 'Stage').trim().slice(0, 24);
      const stepDesc = (bulletMatch[3] || line).replace(/[*_`]/g, '').trim().slice(0, 70);
      points.push({ title: stepTitle, desc: stepDesc });
    } else if (line.includes('**') && points.length < 4) {
      const strongMatch = line.match(/\*\*(.*?)\*\*(.*)/);
      if (strongMatch) {
        points.push({
          title: strongMatch[1].trim().slice(0, 24),
          desc: strongMatch[2].replace(/^[:\s-]+/, '').trim().slice(0, 70),
        });
      }
    }
    if (points.length >= 4) break;
  }

  if (points.length < 3) {
    const words = cleanTitle.split(' ').filter((w) => w.length > 3);
    points.length = 0;
    points.push({ title: 'Inception & Input', desc: `Initiating core ${words[0] || 'system'} elements` });
    points.push({ title: 'Dynamics & Flow', desc: `Active transformations for ${cleanTitle.slice(0, 30)}` });
    points.push({ title: 'Resolution & Output', desc: `Stabilization, cyclic balance & final outcomes` });
  }

  const colors = ['#00f0ff', '#38bdf8', '#818cf8', '#34d399'];
  const count = points.length;
  const nodeWidth = 200;
  const nodeHeight = 110;
  const startX = 60;
  const gap = count > 1 ? (740 - startX - nodeWidth) / (count - 1) : 0;
  const nodeY = 190;

  let nodesSvg = '';
  let arrowsSvg = '';

  points.forEach((p, idx) => {
    const x = startX + idx * gap;
    const col = colors[idx % colors.length];

    nodesSvg += `
      <g>
        <rect x="${x}" y="${nodeY}" width="${nodeWidth}" height="${nodeHeight}" rx="12" fill="#0f172a" stroke="${col}" stroke-width="1.8"/>
        <circle cx="${x + 24}" cy="${nodeY + 28}" r="12" fill="${col}" fill-opacity="0.2" stroke="${col}" stroke-width="1.5"/>
        <text x="${x + 24}" y="${nodeY + 33}" font-family="system-ui, sans-serif" font-size="12" font-weight="bold" fill="${col}" text-anchor="middle">${idx + 1}</text>
        <text x="${x + 44}" y="${nodeY + 33}" font-family="system-ui, sans-serif" font-size="13" font-weight="bold" fill="#ffffff">${escapeXml(p.title)}</text>
        <text x="${x + 16}" y="${nodeY + 62}" font-family="system-ui, sans-serif" font-size="11" fill="#94a3b8">
          <tspan x="${x + 16}" dy="0">${escapeXml(p.desc.slice(0, 30))}</tspan>
          <tspan x="${x + 16}" dy="16">${escapeXml(p.desc.slice(30, 62))}</tspan>
        </text>
      </g>
    `;

    if (idx < count - 1) {
      const arrowStartX = x + nodeWidth + 6;
      const arrowEndX = x + gap - 6;
      const arrowY = nodeY + nodeHeight / 2;
      arrowsSvg += `
        <path d="M ${arrowStartX} ${arrowY} L ${arrowEndX} ${arrowY}" stroke="#38bdf8" stroke-width="2" stroke-dasharray="4,4" marker-end="url(#arrow)" />
      `;
    }
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 480" width="100%" height="100%">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#070d19" />
      <stop offset="50%" stop-color="#0a1329" />
      <stop offset="100%" stop-color="#050814" />
    </linearGradient>
    <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#38bdf8" />
    </marker>
  </defs>
  <rect width="100%" height="100%" rx="16" fill="url(#bgGrad)" stroke="#1e293b" stroke-width="1.5"/>
  <text x="400" y="55" font-family="system-ui, -apple-system, sans-serif" font-size="18" font-weight="bold" fill="#f8fafc" text-anchor="middle" letter-spacing="0.5">
    ${escapeXml(cleanTitle.toUpperCase())}
  </text>
  <text x="400" y="80" font-family="system-ui, -apple-system, sans-serif" font-size="12" fill="#64748b" text-anchor="middle">
    ARCHITECTURAL VECTOR BLUEPRINT • JARVIS INTELLIGENCE
  </text>
  <line x1="120" y1="105" x2="680" y2="105" stroke="#334155" stroke-width="1" stroke-dasharray="6,6"/>
  ${arrowsSvg}
  ${nodesSvg}
  <rect x="250" y="380" width="300" height="34" rx="17" fill="#0b1528" stroke="#38bdf8" stroke-width="1" stroke-opacity="0.4"/>
  <text x="400" y="402" font-family="system-ui, sans-serif" font-size="11" fill="#38bdf8" text-anchor="middle">
    ⚡ Continuous Execution Flow &amp; Systemic Balance
  </text>
</svg>`;
}

function resolveProviderConfig(
  agentConfig: JarvisAgentConfig,
  isFallback = false,
  overrideMaxTokens?: number,
): { provider: AIProviderConfig | null; model: string; error?: string } {
  const providerId = isFallback ? agentConfig.fallbackProviderId : agentConfig.providerId;
  const modelId = isFallback ? agentConfig.fallbackModelId : agentConfig.modelId;
  const effectiveMaxTokens = overrideMaxTokens !== undefined ? overrideMaxTokens : agentConfig.maxTokens;

  const state = storage.getAIProvidersState();
  const activeCustom = storage.getActiveAIProvider();

  if (!providerId || providerId === 'existing') {
    if (activeCustom) {
      const liveModel =
        activeCustom.model && activeCustom.model.trim()
          ? activeCustom.model.trim()
          : modelId || 'deepseek/deepseek-chat';
      const customConfig: AIProviderConfig = {
        ...activeCustom,
        model: liveModel,
        maxTokens: effectiveMaxTokens,
      };
      return {
        provider: customConfig,
        model: liveModel,
      };
    }

    return {
      provider: {
        id: 'existing',
        name: 'Built-in AI',
        url: '',
        model: modelId || 'deepseek/deepseek-chat',
        keyStrategy: 'failover',
        keys: [],
        capabilities: { text: true, tools: true, web: true, wikipedia: true, memory: true },
        maxTokens: effectiveMaxTokens,
      },
      model: modelId || 'deepseek/deepseek-chat',
    };
  }

  const matched = state.providers.find((p) => p.id === providerId);

  if (!matched) {
    if (activeCustom) {
      const liveModel =
        activeCustom.model && activeCustom.model.trim()
          ? activeCustom.model.trim()
          : modelId || 'deepseek/deepseek-chat';
      const customConfig: AIProviderConfig = {
        ...activeCustom,
        model: liveModel,
        maxTokens: effectiveMaxTokens,
      };
      return {
        provider: customConfig,
        model: liveModel,
      };
    }

    return {
      provider: null,
      model: modelId || '',
      error: `Configured provider "${providerId}" not found in AI Providers settings.`,
    };
  }

  // When a custom provider is matched, prioritize the provider's live configured model ID
  const liveModel =
    matched.model && matched.model.trim()
      ? matched.model.trim()
      : modelId || 'deepseek/deepseek-chat';

  const customConfig: AIProviderConfig = {
    ...matched,
    model: liveModel,
    maxTokens: effectiveMaxTokens,
  };

  return {
    provider: customConfig,
    model: liveModel,
  };
}

function safeJsonParse<T>(text: string, fallback: T): T {
  if (!text || typeof text !== 'string') return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    // Pass A: Strip markdown codeblock fences
    let candidate = text.trim();
    const fenceMatch = candidate.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fenceMatch && fenceMatch[1]) {
      candidate = fenceMatch[1].trim();
    }

    // Pass B: Extract outer JSON boundary (curly braces or square brackets)
    const firstBrace = candidate.indexOf('{');
    const lastBrace = candidate.lastIndexOf('}');
    const firstBracket = candidate.indexOf('[');
    const lastBracket = candidate.lastIndexOf(']');

    let toParse = candidate;
    if (firstBrace >= 0 && lastBrace > firstBrace && (firstBracket < 0 || firstBrace < firstBracket)) {
      toParse = candidate.slice(firstBrace, lastBrace + 1);
    } else if (firstBracket >= 0 && lastBracket > firstBracket) {
      toParse = candidate.slice(firstBracket, lastBracket + 1);
    }

    // Pass C: Strip comments, trailing commas and normalize smart quotes
    const sanitized = toParse
      .replace(/\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/,\s*([}\]])/g, '$1')
      .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
      .replace(/[\u2018\u2019]/g, "'");

    try {
      return JSON.parse(sanitized) as T;
    } catch {
      try {
        return JSON.parse(toParse) as T;
      } catch {
        return fallback;
      }
    }
  }
}

export interface ResearcherCandidate {
  title?: string;
  fact: string;
  sourceIndex?: number;
  domain?: string;
  url?: string;
  eventDate?: string | null;
  publishedAt?: string | null;
  updatedAt?: string | null;
  location?: string | null;
  category?: string | null;
  confirmedBy?: string[];
}

export interface FactCheckVerifiedItem {
  claim: string;
  dateStatus: 'today' | 'published today' | 'updated today' | 'yesterday' | 'older' | 'unknown';
  eventDate?: string | null;
  publishedAt?: string | null;
  updatedAt?: string | null;
  domain?: string;
  url?: string;
  confirmedBy?: string[];
  notes?: string;
}

export interface ResearcherParsedOutput {
  facts: string[];
  candidates?: ResearcherCandidate[];
  sources: Array<{ title: string; url: string; domain?: string; publishedAt?: string | null }>;
  notes?: string;
}

export interface RawSearchResultCandidate {
  title: string;
  url: string;
  domain?: string;
  description: string;
  date?: string;
  publishedAt?: string;
  updatedAt?: string;
  location?: string;
  category?: string;
  type: 'wikipedia' | 'web' | 'news';
}

/**
 * Validates and classifies date status based on actual source dates (never assuming current time is event time)
 */
export function classifyDateStatus(
  eventDate?: string | null,
  publishedAt?: string | null,
  updatedAt?: string | null,
): 'today' | 'published today' | 'updated today' | 'yesterday' | 'older' | 'unknown' {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  const getDayStr = (dStr?: string | null): string | null => {
    if (!dStr) return null;
    try {
      const parsed = new Date(dStr);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().slice(0, 10);
      }
      const m = String(dStr).match(/\b\d{4}-\d{2}-\d{2}\b/);
      return m ? m[0] : null;
    } catch {
      return null;
    }
  };

  const eventDay = getDayStr(eventDate);
  const pubDay = getDayStr(publishedAt);
  const updDay = getDayStr(updatedAt);

  if (eventDay) {
    if (eventDay === todayStr) return 'today';
    if (eventDay === yesterdayStr) return 'yesterday';
    return 'older';
  }

  if (pubDay) {
    if (pubDay === todayStr) return 'published today';
    if (pubDay === yesterdayStr) return 'yesterday';
    return 'older';
  }

  if (updDay) {
    if (updDay === todayStr) return 'updated today';
    if (updDay === yesterdayStr) return 'yesterday';
    return 'older';
  }

  return 'unknown';
}

/**
 * Deduplicates news candidates covering the same underlying event, merging sources and confirmed outlets
 */
export function deduplicateNewsCandidates(
  candidates: ResearcherCandidate[],
  allSources: AISource[] = [],
): ResearcherCandidate[] {
  if (!candidates || candidates.length === 0) return [];

  const merged: ResearcherCandidate[] = [];

  const GENERIC_NEWS_STOPWORDS = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'about',
    'and', 'or', 'not', 'but', 'so', 'yet', 'as', 'if', 'then', 'this',
    'that', 'it', 'its', 'they', 'them', 'their', 'what', 'which', 'who',
    'news', 'world', 'today', 'breaking', 'latest', 'report', 'reports',
    'reported', 'reporting', 'update', 'updates', 'updated', 'live',
    'announces', 'announced', 'announcement', 'statement', 'says', 'said',
    'according', 'sources', 'source', 'official', 'officials', 'government',
    'minister', 'president', 'country', 'state', 'states', 'international',
    'reuters', 'apnews', 'bbc', 'cnn', 'bloomberg', 'times', 'post', 'daily',
    'august', 'september', 'october', 'november', 'december', 'january',
    'february', 'march', 'april', 'may', 'june', 'july', 'monday', 'tuesday',
    'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'year', 'month',
    'week', 'day', 'time', 'first', 'new', 'after', 'over', 'more',
  ]);

  for (const cand of candidates) {
    if (!cand || (!cand.fact && !cand.title)) continue;

    const normText = `${cand.title || ''} ${cand.fact || ''}`
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const candTokens = normText
      .split(' ')
      .filter((w) => w.length > 2 && !GENERIC_NEWS_STOPWORDS.has(w));

    let matchIdx = -1;
    for (let i = 0; i < merged.length; i++) {
      const existing = merged[i];

      // If both candidates have distinct locations/countries (e.g. Norway vs Germany), NEVER merge them
      if (
        cand.location &&
        existing.location &&
        cand.location.trim().toLowerCase() !== existing.location.trim().toLowerCase()
      ) {
        continue;
      }

      const existingNorm = `${existing.title || ''} ${existing.fact || ''}`
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      const existingTokens = existingNorm
        .split(' ')
        .filter((w) => w.length > 2 && !GENERIC_NEWS_STOPWORDS.has(w));

      if (candTokens.length >= 4 && existingTokens.length >= 4) {
        const overlap = candTokens.filter((t) => existingTokens.includes(t)).length;
        const totalUniqueTokens = new Set([...candTokens, ...existingTokens]).size;
        const jaccard = overlap / (totalUniqueTokens || 1);

        // Require at least 55% Jaccard overlap on specific content words AND at least 4 shared meaningful words
        if (jaccard >= 0.55 && overlap >= 4) {
          matchIdx = i;
          break;
        }
      }
    }

    if (matchIdx !== -1) {
      const existing = merged[matchIdx];
      const newConfirmed = new Set(existing.confirmedBy || []);
      if (cand.domain) newConfirmed.add(cand.domain);
      if (Array.isArray(cand.confirmedBy)) {
        cand.confirmedBy.forEach((c) => newConfirmed.add(c));
      }
      existing.confirmedBy = Array.from(newConfirmed);

      if ((cand.fact && cand.fact.length > (existing.fact || '').length && !existing.title) || (!existing.title && cand.title)) {
        if (cand.title) existing.title = cand.title;
      }
      if (!existing.eventDate && cand.eventDate) existing.eventDate = cand.eventDate;
      if (!existing.publishedAt && cand.publishedAt) existing.publishedAt = cand.publishedAt;
      if (!existing.location && cand.location) existing.location = cand.location;
      if (!existing.category && cand.category) existing.category = cand.category;
    } else {
      const confirmed = new Set(cand.confirmedBy || []);
      if (cand.domain) confirmed.add(cand.domain);

      let exactUrl = cand.url;
      if (!exactUrl && cand.sourceIndex && allSources[cand.sourceIndex - 1]?.url) {
        exactUrl = allSources[cand.sourceIndex - 1].url;
      } else if (!exactUrl && cand.domain) {
        const matchSrc = allSources.find((s) => s.domain === cand.domain || (s.url && s.url.includes(cand.domain!)));
        if (matchSrc) exactUrl = matchSrc.url;
      }

      merged.push({
        ...cand,
        url: exactUrl,
        confirmedBy: Array.from(confirmed),
      });
    }
  }

  return merged;
}

/**
 * Extracts essential topic terms and phrases from a user query / task.
 * Strips generic question words, command prefixes, and common stop words.
 */
export function isSearchOverrideQuery(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  return /^\/search(?:\s+|$)/i.test(text.trim());
}

export function stripSearchOverridePrefix(text: string): string {
  if (!text || typeof text !== 'string') return text;
  return text.trim().replace(/^\/search\s*/i, '').trim();
}

export function isWebFetchQuery(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  return /^\/web(?:\s+|$)/i.test(text.trim());
}

export function extractWebFetchUrl(text: string): string {
  if (!text || typeof text !== 'string') return '';
  let url = text.trim().replace(/^\/web\s*/i, '').trim();
  url = url.replace(/^["'`<]+|[>"'`]+$/g, '').trim();
  if (url && !/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  return url;
}

export function stripWebFetchPrefix(text: string): string {
  if (!text || typeof text !== 'string') return text;
  return text.trim().replace(/^\/web\s*/i, '').trim().replace(/^["'`<]+|[>"'`]+$/g, '').trim();
}

export function extractTopicKeywords(query: string, task?: string): {
  coreTerms: string[];
  keyPhrases: string[];
  cleanedSearchQuery: string;
} {
  const combined = `${query} ${task || ''}`;

  // 1. Identify specific numbers, percentages, acronyms, or quoted phrases
  const keyPhrases: string[] = [];
  const percentMatches = combined.match(/\b\d+%\b/g);
  if (percentMatches) {
    percentMatches.forEach((m) => {
      const lower = m.toLowerCase();
      if (!keyPhrases.includes(lower)) keyPhrases.push(lower);
    });
  }
  const percentWordMatches = combined.match(/\b\d+\s+(?:percent|pct)\b/gi);
  if (percentWordMatches) {
    percentWordMatches.forEach((m) => {
      const lower = m.toLowerCase();
      if (!keyPhrases.includes(lower)) keyPhrases.push(lower);
    });
  }

  // 2. Remove command & question prefix filler
  const cleanedSearchQuery = query
    .replace(/^\/search\s+/i, '')
    .replace(
      /^(?:fact-?check|investigate|debunk|verify|research|analyze|tell me about|explain|what is|how does|why is|why does|who was|who is|compare|comar|comparing|comparison between|diff between|difference between)\s+/i,
      '',
    )
    .trim();

  // 3. Stop words list
  const STOP_WORDS = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'about',
    'into', 'through', 'during', 'before', 'after', 'above', 'below',
    'and', 'or', 'not', 'but', 'nor', 'so', 'yet', 'as', 'if', 'then',
    'this', 'that', 'these', 'those', 'it', 'its',
    'i', 'me', 'my', 'myself', 'mine',
    'you', 'your', 'yours', 'yourself',
    'we', 'us', 'our', 'ours', 'ourselves',
    'he', 'him', 'his', 'himself',
    'she', 'her', 'hers', 'herself',
    'they', 'them', 'their', 'theirs', 'themselves',
    'what', 'which', 'who', 'whom', 'whose', 'when', 'where', 'why', 'how',
    'can', 'could', 'should', 'would', 'will', 'shall', 'may', 'might', 'must',
    'do', 'does', 'did', 'have', 'has', 'had', 'having',
    'fact', 'check', 'factcheck', 'fact-check', 'debunk', 'verify',
    'please', 'tell', 'explain', 'show', 'give', 'overview', 'summary',
  ]);

  const rawTokens = combined
    .toLowerCase()
    .replace(/[^\w\s%]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  const coreTerms: string[] = [];
  rawTokens.forEach((t) => {
    if (t.length >= 2 && !STOP_WORDS.has(t) && !coreTerms.includes(t)) {
      coreTerms.push(t);
    }
  });

  if (/\bmyths?\b/i.test(combined) && !coreTerms.includes('myth')) {
    coreTerms.push('myth');
  }

  return { coreTerms, keyPhrases, cleanedSearchQuery: cleanedSearchQuery || query };
}

/**
 * Scores and filters search results to ensure only high-relevance, on-topic sources reach the Researcher agent.
 * Eliminates broad list pages with unrelated snippets, false matches, and duplicates.
 */
export function scoreAndFilterSearchResults(
  candidates: RawSearchResultCandidate[],
  query: string,
  task?: string,
): RawSearchResultCandidate[] {
  if (!candidates || candidates.length === 0) return [];

  const { coreTerms, keyPhrases } = extractTopicKeywords(query, task);
  const normalizedSeenUrls = new Set<string>();

  const scoredList: Array<{ candidate: RawSearchResultCandidate; score: number }> = [];

  for (const c of candidates) {
    if (!c.url || !c.title) continue;

    // Normalize URL to prevent duplicates
    const normUrl = c.url
      .toLowerCase()
      .replace(/[?#].*$/, '')
      .replace(/\/+$/, '');

    if (normalizedSeenUrls.has(normUrl)) continue;
    normalizedSeenUrls.add(normUrl);

    const titleLower = c.title.toLowerCase();
    const snippetLower = (c.description || '').toLowerCase();
    const fullContent = `${titleLower} ${snippetLower}`;

    let score = 0;
    let snippetTermMatches = 0;
    let titleTermMatches = 0;

    // Check key phrases (e.g. "10%", "10 percent")
    for (const kp of keyPhrases) {
      if (titleLower.includes(kp)) score += 35;
      if (snippetLower.includes(kp)) {
        score += 30;
        snippetTermMatches += 2;
      }
    }

    // Check core terms
    for (const term of coreTerms) {
      if (titleLower.includes(term)) {
        score += 15;
        titleTermMatches++;
      }
      if (snippetLower.includes(term)) {
        score += 10;
        snippetTermMatches++;
      }
    }

    // Term coverage ratio
    if (coreTerms.length > 0) {
      const matchedCount = coreTerms.filter((t) => fullContent.includes(t)).length;
      const coverageRatio = matchedCount / coreTerms.length;
      score += Math.round(coverageRatio * 25);
    }

    // Penalize generic broad index / list pages if their snippet doesn't strongly hit the query terms
    const isBroadListPage = /^(?:list of|index of|outline of|glossary of|category:)/i.test(titleLower);
    if (isBroadListPage) {
      if (snippetTermMatches < 2) {
        // Snippet discusses elephants, etc. on a giant list page -> heavily penalize and discard
        score = -100;
      } else {
        // Demote list pages in favor of dedicated topic articles
        score -= 20;
      }
    }

    // Penalize completely unrelated snippet contents where snippet has 0 core topic matches
    if (snippetTermMatches === 0 && coreTerms.length >= 2) {
      score -= 30;
    }

    // Strict Relevance Threshold
    const hasKeyPhraseMatch = keyPhrases.length > 0 && keyPhrases.some((kp) => fullContent.includes(kp));
    const hasSufficientTermMatches = snippetTermMatches >= 1 || titleTermMatches >= 1;

    if (score >= 20 && (hasKeyPhraseMatch || hasSufficientTermMatches)) {
      scoredList.push({ candidate: c, score });
    }
  }

  // Sort descending by score
  scoredList.sort((a, b) => b.score - a.score);

  return scoredList.map((item) => item.candidate);
}

/**
 * Resiliently extracts facts and sources from any LLM output (JSON, malformed JSON, lists, or markdown)
 */
export function parseResearcherOutput(
  rawText: string,
  fallbackSources: AISource[] = [],
): ResearcherParsedOutput {
  const result: ResearcherParsedOutput = {
    facts: [],
    candidates: [],
    sources: [],
    notes: '',
  };

  if (!rawText || !rawText.trim()) {
    // If no output, use fallback facts from gathered sources if available
    if (fallbackSources.length > 0) {
      fallbackSources.forEach((s) => {
        if (s.description && s.description.trim().length > 15) {
          result.facts.push(`[${s.title}] ${s.description.trim()}`);
        }
      });
    }
    return result;
  }

  const text = rawText.trim();

  // Helper to extract clean string from fact item (handles strings, objects, numbers)
  const cleanFactItem = (item: unknown): string => {
    return formatCandidateBullet(item, { markdown: false }).replace(/^- /, '');
  };

  const rawCandidateList: ResearcherCandidate[] = [];

  // Helper to process candidate items (both objects and strings)
  const processCandidateItem = (item: unknown) => {
    if (!item) return;
    if (typeof item === 'object' && item !== null) {
      const obj = item as Record<string, unknown>;
      const factText = String(obj.fact || obj.claim || obj.description || obj.title || '').trim();
      if (!factText) return;

      const sourceIdx = typeof obj.sourceIndex === 'number' ? obj.sourceIndex : undefined;
      let domain = typeof obj.domain === 'string' ? obj.domain.trim() : undefined;
      let url = typeof obj.url === 'string' ? obj.url.trim() : undefined;
      const title = typeof obj.title === 'string' ? obj.title.trim() : undefined;
      const eventDate = typeof obj.eventDate === 'string' ? obj.eventDate.trim() : null;
      let publishedAt = typeof obj.publishedAt === 'string' ? obj.publishedAt.trim() : null;
      const updatedAt = typeof obj.updatedAt === 'string' ? obj.updatedAt.trim() : null;
      const location = typeof obj.location === 'string' ? obj.location.trim() : null;
      const category = typeof obj.category === 'string' ? obj.category.trim() : null;
      const confirmedBy = Array.isArray(obj.confirmedBy)
        ? (obj.confirmedBy as string[]).map((c) => String(c).trim()).filter(Boolean)
        : [];

      // If URL is missing or just a homepage, resolve against fallback sources
      if (sourceIdx && fallbackSources[sourceIdx - 1]) {
        const matched = fallbackSources[sourceIdx - 1];
        if (!url || !url.startsWith('http') || url.replace(/^https?:\/\//, '').split('/')[1]?.length === 0) {
          if (matched.url) url = matched.url;
        }
        if (!domain && matched.domain) domain = matched.domain;
        if (!publishedAt && matched.date) publishedAt = matched.date;
      } else if (domain) {
        const matched = fallbackSources.find((s) => s.domain === domain || (s.url && s.url.includes(domain!)));
        if (matched) {
          if (!url || !url.startsWith('http') || url.replace(/^https?:\/\//, '').split('/')[1]?.length === 0) {
            if (matched.url) url = matched.url;
          }
          if (!publishedAt && matched.date) publishedAt = matched.date;
        }
      }

      rawCandidateList.push({
        title,
        fact: factText,
        sourceIndex: sourceIdx,
        domain,
        url,
        eventDate,
        publishedAt,
        updatedAt,
        location,
        category,
        confirmedBy,
      });
    } else if (typeof item === 'string' && item.trim().length > 3) {
      rawCandidateList.push({
        fact: item.trim(),
      });
    }
  };

  // Helper to inspect parsed object
  const extractFromObject = (data: Record<string, unknown>) => {
    // Check candidates first
    const possibleCandidateKeys = ['candidates', 'news_candidates', 'newsCandidates', 'items', 'articles', 'stories'];
    for (const key of possibleCandidateKeys) {
      if (Array.isArray(data[key]) && (data[key] as unknown[]).length > 0) {
        (data[key] as unknown[]).forEach((item) => processCandidateItem(item));
        break;
      }
    }

    const possibleFactKeys = [
      'facts',
      'core_facts',
      'coreFacts',
      'key_facts',
      'keyFacts',
      'findings',
      'results',
      'points',
      'claims',
      'extracted_facts',
      'fact_list',
      'insights',
      'data',
      'verified_facts',
    ];

    if (rawCandidateList.length === 0) {
      for (const key of possibleFactKeys) {
        if (Array.isArray(data[key]) && (data[key] as unknown[]).length > 0) {
          (data[key] as unknown[]).forEach((item) => processCandidateItem(item));
          break;
        }
      }
    }

    // If facts is a string with newlines or bullets
    if (rawCandidateList.length === 0) {
      for (const key of possibleFactKeys) {
        if (typeof data[key] === 'string' && (data[key] as string).trim()) {
          const lines = (data[key] as string)
            .split(/\r?\n/)
            .map((l) => l.replace(/^[\s*•\-#\d.)\]:]+/, '').trim())
            .filter((l) => l.length > 8);
          if (lines.length > 0) {
            lines.forEach((l) => processCandidateItem(l));
            break;
          }
        }
      }
    }

    // Check nested objects (e.g. data.research.facts or data.researcher.facts)
    if (rawCandidateList.length === 0) {
      const nestedContainers = ['research', 'researcher', 'output', 'response', 'result'];
      for (const containerKey of nestedContainers) {
        if (typeof data[containerKey] === 'object' && data[containerKey] !== null) {
          extractFromObject(data[containerKey] as Record<string, unknown>);
          if (rawCandidateList.length > 0) break;
        }
      }
    }

    // Extract sources
    const possibleSourceKeys = ['sources', 'references', 'citations', 'links', 'source_list'];
    for (const key of possibleSourceKeys) {
      if (Array.isArray(data[key])) {
        for (const s of data[key] as unknown[]) {
          if (typeof s === 'object' && s !== null) {
            const sobj = s as Record<string, unknown>;
            const title = String(sobj.title || sobj.name || sobj.domain || 'Source').trim();
            let url = String(sobj.url || sobj.link || sobj.uri || '').trim();
            const domain = String(sobj.domain || '').trim();
            const publishedAt = typeof sobj.publishedAt === 'string' ? sobj.publishedAt.trim() : null;

            // Restore exact full URL from fallbackSources if LLM truncated it to root domain
            if (domain || title) {
              const matchedFallback = fallbackSources.find(
                (fs) => (domain && fs.domain === domain) || (fs.title && fs.title.toLowerCase().includes(title.toLowerCase())),
              );
              if (matchedFallback && matchedFallback.url) {
                if (!url || !url.startsWith('http') || url.replace(/^https?:\/\//, '').split('/')[1]?.length === 0) {
                  url = matchedFallback.url;
                }
              }
            }

            if (title || url) {
              result.sources.push({
                title: title || domain || url,
                url: url || (domain ? `https://${domain}` : ''),
                domain: domain || (url && url.startsWith('http') ? new URL(url).hostname.replace(/^www\./, '') : undefined),
                publishedAt,
              });
            }
          } else if (typeof s === 'string' && s.trim()) {
            const sText = s.trim();
            result.sources.push({
              title: sText,
              url: sText.startsWith('http') ? sText : '',
              domain: sText.startsWith('http') ? new URL(sText).hostname.replace(/^www\./, '') : undefined,
            });
          }
        }
        if (result.sources.length > 0) break;
      }
    }

    if (typeof data.notes === 'string') {
      result.notes = data.notes;
    }
  };

  // 1. Try structured JSON parsing
  const parsed = safeJsonParse<unknown>(text, null);
  if (parsed) {
    if (Array.isArray(parsed)) {
      parsed.forEach((item) => processCandidateItem(item));
    } else if (typeof parsed === 'object' && parsed !== null) {
      extractFromObject(parsed as Record<string, unknown>);
    }
  }

  // 2. Fallback text parsing if JSON returned 0 items (e.g. model output plain text with bullets)
  if (rawCandidateList.length === 0) {
    const lines = text.split(/\r?\n/);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      const bulletMatch = line.match(/^(?:(?:\d+[.)]|[*•–—-]|\s*-)\s+|fact\s*\d*\s*[:-]\s*)(.*)$/i);
      if (bulletMatch && bulletMatch[1]) {
        const candidate = bulletMatch[1].replace(/^["']|["']$/g, '').trim();
        if (
          candidate.length > 8 &&
          !/^(sources?|references?|notes?|summary|context|tasks?|guidance)\b/i.test(candidate)
        ) {
          processCandidateItem(candidate);
        }
      }
    }

    // If still empty and text is substantial, split into clean sentences
    if (rawCandidateList.length === 0 && text.length > 25) {
      const stripped = text
        .replace(/```[\s\S]*?```/g, '')
        .replace(/[{}[\]"]/g, '')
        .replace(/facts?:/gi, '')
        .replace(/sources?:[\s\S]*$/gi, '');
      const sentences = stripped
        .split(/(?<=[.!?])\s+/)
        .map((s) => cleanFactItem(s))
        .filter(
          (s) =>
            s.length > 15 &&
            !/^(here are|i have|in summary|based on|as an ai|below are)/i.test(s),
        );
      if (sentences.length > 0) {
        sentences.slice(0, 7).forEach((s) => processCandidateItem(s));
      }
    }
  }

  // 3. Fallback to gathered search snippets if LLM produced 0 facts
  if (rawCandidateList.length === 0 && fallbackSources.length > 0) {
    fallbackSources.forEach((s, idx) => {
      if (s.description && s.description.trim().length > 15) {
        rawCandidateList.push({
          title: s.title,
          fact: s.description.trim(),
          sourceIndex: idx + 1,
          domain: s.domain,
          url: s.url,
          publishedAt: s.date || null,
        });
      }
    });
  }

  // Deduplicate candidates covering the same story
  const deduplicatedCandidates = deduplicateNewsCandidates(rawCandidateList, fallbackSources);
  result.candidates = deduplicatedCandidates;

  // Populate formatted facts
  for (const cand of deduplicatedCandidates) {
    const cleaned = cleanFactItem(cand);
    if (cleaned && cleaned.length > 3 && !result.facts.includes(cleaned)) {
      result.facts.push(cleaned);
    }
  }

  // Ensure fallback sources are preserved if result.sources was empty
  if (result.sources.length === 0 && fallbackSources.length > 0) {
    fallbackSources.forEach((fs) => {
      result.sources.push({
        title: fs.title || fs.domain || 'Source',
        url: fs.url || '',
        domain: fs.domain,
        publishedAt: fs.date || null,
      });
    });
  }

  return result;
}

export async function runJarvisPipeline(
  query: string,
  config: JarvisSystemConfig,
  deepResearch = false,
  diagramMode = false,
  chartMode = false,
  imageMode = false,
  onStepUpdate?: StepUpdateCallback,
  userTimeZone?: string,
): Promise<JarvisExecutionResult> {
  // Safely resolve and validate user's local timezone with fallback to Europe/London
  let effectiveTimeZone = 'Europe/London';
  const candidateTz =
    userTimeZone && typeof userTimeZone === 'string' && userTimeZone.trim()
      ? userTimeZone.trim()
      : undefined;

  if (candidateTz) {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: candidateTz });
      effectiveTimeZone = candidateTz;
    } catch {
      effectiveTimeZone = 'Europe/London';
    }
  } else {
    try {
      const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (resolved) {
        Intl.DateTimeFormat(undefined, { timeZone: resolved });
        effectiveTimeZone = resolved;
      }
    } catch {
      effectiveTimeZone = 'Europe/London';
    }
  }

  // Generate real-time date and time fresh on every single request using user's timezone
  let currentDateTime: string;
  try {
    currentDateTime = new Date().toLocaleString('en-US', {
      timeZone: effectiveTimeZone,
      dateStyle: 'full',
      timeStyle: 'long',
    });
  } catch {
    try {
      currentDateTime = new Date().toLocaleString('en-US', {
        timeZone: 'Europe/London',
        dateStyle: 'full',
        timeStyle: 'long',
      });
    } catch {
      currentDateTime = new Date().toLocaleString();
    }
  }

  const steps: JarvisExecutionStep[] = [];
  const sourcesCollected: AISource[] = [];
  const customAgentOutputs: Array<{ id: string; name: string; output: string }> = [];

  const updateStep = (step: JarvisExecutionStep) => {
    const existingIdx = steps.findIndex((s) => s.agentId === step.agentId);
    if (existingIdx >= 0) {
      steps[existingIdx] = step;
    } else {
      steps.push(step);
    }
    onStepUpdate?.(step);
  };

  // Always load the live stored configuration at the moment of execution to prevent stale React state/closure snapshots
  const liveStoredConfig = storage.getJarvisConfig();
  const effectiveConfig: JarvisSystemConfig = {
    ...liveStoredConfig,
    ...(config || {}),
    agents: {
      ...liveStoredConfig.agents,
    },
    customAgents:
      Array.isArray(liveStoredConfig.customAgents) && liveStoredConfig.customAgents.length > 0
        ? liveStoredConfig.customAgents
        : config?.customAgents || [],
  };

  const agentConfigs = effectiveConfig.agents;
  const customAgents = (effectiveConfig.customAgents || []).filter((ca) => ca && ca.id);

  const getAgentConfig = (agentId: string): JarvisAgentConfig | null => {
    const liveFresh = storage.getJarvisConfig();
    if (liveFresh.agents && liveFresh.agents[agentId as keyof typeof liveFresh.agents]) {
      return liveFresh.agents[agentId as keyof typeof liveFresh.agents];
    }
    if (agentConfigs[agentId as keyof typeof agentConfigs]) {
      return agentConfigs[agentId as keyof typeof agentConfigs];
    }
    const custom = (liveFresh.customAgents || customAgents).find((c) => c.id === agentId);
    return custom || null;
  };

  // Initialize step statuses for default 6 agents
  const defaultAgentOrder: JarvisAgentId[] = [
    'planner',
    'researcher',
    'factChecker',
    'advisor',
    'reviewer',
    'finalSynthesizer',
  ];

  defaultAgentOrder.forEach((agentId) => {
    const cfg = agentConfigs[agentId as keyof typeof agentConfigs];
    if (cfg) {
      const provInfo = resolveProviderConfig(cfg);
      steps.push({
        agentId,
        name: cfg.name,
        icon: cfg.icon,
        status: cfg.enabled ? 'pending' : 'skipped',
        providerName: provInfo.provider?.name || 'Unconfigured',
        model: provInfo.model || cfg.modelId,
      });
    }
  });

  // Initialize step statuses for custom agents
  customAgents.forEach((cAgent) => {
    const provInfo = resolveProviderConfig(cAgent);
    steps.push({
      agentId: cAgent.id,
      name: cAgent.name,
      icon: cAgent.icon || '🤖',
      status: cAgent.enabled ? 'pending' : 'skipped',
      providerName: provInfo.provider?.name || 'Unconfigured',
      model: provInfo.model || cAgent.modelId,
    });
  });

  // Helper to execute single agent (default or custom)
  const callAgent = async (
    agentId: string,
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    overrideMaxTokens?: number,
  ): Promise<{
    ok: boolean;
    text: string;
    error?: string;
    providerName: string;
    model: string;
    usedFallback?: boolean;
  }> => {
    const cfg = getAgentConfig(agentId);
    if (!cfg) {
      return { ok: false, text: '', error: `Agent ${agentId} not found in configuration`, providerName: '', model: '' };
    }
    if (!cfg.enabled) {
      return { ok: false, text: '', error: 'Agent disabled in configuration', providerName: '', model: '' };
    }

    const effectiveMaxTokens =
      overrideMaxTokens !== undefined
        ? overrideMaxTokens
        : agentId === 'architect'
        ? Math.max(cfg.maxTokens || 4500, 4500)
        : agentId === 'advisor'
        ? (deepResearch ? 800 : 400)
        : cfg.maxTokens;
    const effectiveTimeoutMs = agentId === 'architect' ? 75000 : 35000;

    const primary = resolveProviderConfig(cfg, false, effectiveMaxTokens);
    if (primary.error) {
      return {
        ok: false,
        text: '',
        error: `❌ ${cfg.name} provider unavailable: ${primary.error}`,
        providerName: cfg.providerId,
        model: cfg.modelId,
      };
    }

    let fallbackConfig: AIProviderConfig | null = null;
    if (cfg.enableFailover && cfg.fallbackProviderId) {
      const fb = resolveProviderConfig(cfg, true, effectiveMaxTokens);
      if (!fb.error && fb.provider) {
        fallbackConfig = fb.provider;
      }
    }

    try {
      const res = await api.jarvisAgentCall({
        agentId,
        messages,
        providerConfig: primary.provider,
        fallbackConfig,
        enableFailover: cfg.enableFailover,
        temperature: agentId === 'architect' ? 0.1 : 0.2,
        maxTokens: effectiveMaxTokens,
        timeoutMs: effectiveTimeoutMs,
      });

      return {
        ok: res.ok,
        text: res.text || '',
        error: res.error,
        providerName: res.providerName || primary.provider?.name || 'Configured AI',
        model: res.model || primary.model,
        usedFallback: res.usedFallback,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        text: '',
        error: errorMsg,
        providerName: primary.provider?.name || 'Configured AI',
        model: primary.model,
      };
    }
  };

  // Helper to extract JSON data fields from agent text
  const extractDataFieldsFromAgentOutput = (output: string): Record<string, string> => {
    const fields: Record<string, string> = {};
    if (!output || typeof output !== 'string') return fields;

    try {
      const jsonMatch = output.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, output];
      const rawCandidate = (jsonMatch[1] || output).trim();

      let parsed: Record<string, unknown> | unknown[] | null = null;
      try {
        parsed = JSON.parse(rawCandidate);
      } catch {
        const objMatch = rawCandidate.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
        if (objMatch) {
          try {
            parsed = JSON.parse(objMatch[1]);
          } catch {
            parsed = null;
          }
        }
      }

      if (parsed && typeof parsed === 'object') {
        if (Array.isArray(parsed)) {
          fields['data'] = JSON.stringify(parsed, null, 2);
        } else {
          for (const [key, val] of Object.entries(parsed)) {
            const valFormatted = typeof val === 'string' ? val : JSON.stringify(val, null, 2);
            fields[key] = valFormatted;
          }
        }
      }
    } catch {
      // Ignore JSON parse errors
    }
    return fields;
  };

  // Helper to apply dynamic template variables to system and user prompts
  const applyTemplateVariables = (template: string, mapping: Record<string, string>): string => {
    if (!template || typeof template !== 'string') return '';
    let result = template;
    for (const [key, value] of Object.entries(mapping)) {
      if (!value) continue;
      const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\{\\s*${escapedKey}\\s*\\}`, 'gi');
      result = result.replace(regex, value);
    }
    return result;
  };

  // Helper to execute custom agent
  const executeCustomAgent = async (cAgent: typeof customAgents[0]) => {
    if (!cAgent.enabled) return;

    const provInfo = resolveProviderConfig(cAgent);
    const start = Date.now();

    updateStep({
      agentId: cAgent.id,
      name: cAgent.name,
      icon: cAgent.icon || '🤖',
      status: 'running',
      providerName: provInfo.provider?.name || 'Primary',
      model: provInfo.model,
    });

    const rawSysPrompt =
      cAgent.systemPrompt && cAgent.systemPrompt.trim()
        ? cAgent.systemPrompt.trim()
        : `You are the ${cAgent.name} agent (${cAgent.role || 'Specialized Agent'}). ${cAgent.description || ''}`;

    const factsList = Array.isArray(researcherOutput?.facts) ? researcherOutput.facts : [];
    const verifiedList = Array.isArray(factCheckOutput?.verified) ? factCheckOutput.verified : [];
    const issuesList = Array.isArray(factCheckOutput?.issues) ? factCheckOutput.issues : [];

    const promptContextMapping: Record<string, string> = {
      task: plannerOutput.task || query,
      query: query,
      facts: factsList.map((f, i) => `${i + 1}. ${f}`).join('\n'),
      research: factsList.map((f, i) => `${i + 1}. ${f}`).join('\n'),
      claims: factsList.map((f, i) => `${i + 1}. ${f}`).join('\n'),
      verified: verifiedList.map((c) => `- ${c}`).join('\n'),
      issues: issuesList.map((i) => `- ${i}`).join('\n'),
    };

    const sysPrompt = `Current date and time: ${currentDateTime}\n\n${applyTemplateVariables(rawSysPrompt, promptContextMapping)}`;

    const contextPayload = `User Query: "${query}"
Task Context: "${plannerOutput.task || query}"
${factsList.length > 0 ? `Collected Research Facts:\n${factsList.map((f, i) => `${i + 1}. ${f}`).join('\n')}` : ''}
${verifiedList.length > 0 ? `Verified Claims:\n${verifiedList.map((c) => `- ${c}`).join('\n')}` : ''}

Please perform your specialized processing for this inquiry. Provide clear, concise insights or outputs.`;

    const res = await callAgent(cAgent.id, [
      { role: 'system', content: sysPrompt },
      { role: 'user', content: contextPayload },
    ]);

    const duration = Date.now() - start;

    if (res.ok && res.text) {
      customAgentOutputs.push({
        id: cAgent.id,
        name: cAgent.name,
        output: res.text,
      });

      updateStep({
        agentId: cAgent.id,
        name: cAgent.name,
        icon: cAgent.icon || '🤖',
        status: 'completed',
        providerName: res.providerName,
        model: res.model,
        durationMs: duration,
        summary: `${cAgent.name} completed successfully.`,
        outputPreview: res.text,
        rawOutput: res.text,
        usedFallback: res.usedFallback,
      });
    } else {
      updateStep({
        agentId: cAgent.id,
        name: cAgent.name,
        icon: cAgent.icon || '🤖',
        status: 'failed',
        providerName: res.providerName,
        model: res.model,
        durationMs: duration,
        error: res.error || `${cAgent.name} execution failed.`,
      });
    }
  };

  // Helper to detect comparison inquiries involving the user ("me", "myself", "you and me", "us", "I") vs AI or asking personal questions about the user
  const isPersonalOrHumanAiComparison = (text: string): boolean => {
    if (!text || typeof text !== 'string') return false;
    if (isWebFetchQuery(text)) return false;
    if (isSearchOverrideQuery(text)) return false;
    const lower = text.toLowerCase().trim().replace(/[?!.,]+$/g, '');
    return (
      /\b(?:compare|comar|comparing|comparison between|diff|difference between)\s+(?:me|myself|i|us|you and me|me and you)\b/i.test(lower) ||
      /\b(?:compare|comar|comparing|comparison between|diff|difference between)\s+.*?\s+(?:and|with|to|vs|versus)\s+(?:me|myself|i|us)\b/i.test(lower) ||
      /\b(?:me|myself|i|us)\s+(?:and|with|vs|versus)\s+(?:deepseek|chatgpt|openai|claude|gemini|jarvis|ai|llm|robot|machine|bot|technology)\b/i.test(lower) ||
      /\b(?:deepseek|chatgpt|openai|claude|gemini|jarvis|ai|llm|robot|machine|bot|technology)\s+(?:and|with|vs|versus)\s+(?:me|myself|i|us)\b/i.test(lower) ||
      /\b(?:how do i compare to|how do i stack up against|how am i different from|how do you compare to me)\b/i.test(lower) ||
      /\b(?:what do you think of me|how do you see me|tell me about me|who am i|rate me)\b/i.test(lower) ||
      (/\byou and me\b/i.test(lower) && /\b(?:compare|difference|better|vs|versus|similar)\b/i.test(lower))
    );
  };

  // Helper to detect self-referential / meta / greeting inquiries about JARVIS itself
  const isSelfReferentialInquiry = (text: string): boolean => {
    if (!text || typeof text !== 'string') return false;
    if (isWebFetchQuery(text)) return false;
    if (isSearchOverrideQuery(text)) return false;
    const lower = text.toLowerCase().trim().replace(/[?!.,]+$/g, '');
    return (
      /^(hi|hello|hey|greetings|howdy|good (morning|afternoon|evening))\b/i.test(lower) ||
      /\b(what (can|do) you do|what are your capabilities|who are you|what is your name|how do you work|tell me about yourself|what is jarvis|what can jarvis do|who made you|are you an ai|help me|how many agents|what agents|what are your agents|list (your )?agents|who are your agents|your architecture|how does jarvis work|how does your system work|explain your agents|how many ai agents|agent architecture)\b/i.test(lower) ||
      /\b(?:how many|what|list|explain|describe|who are)\s+(?:the\s+)?agents\b/i.test(lower) ||
      /\b(?:agent|agents|architecture)\s+(?:breakdown|overview|pipeline|capabilities)\b/i.test(lower) ||
      isPersonalOrHumanAiComparison(text)
    );
  };

  // ==========================================
  // STEP 1: 🧭 PLANNER
  // ==========================================
  let plannerOutput: {
    task: string;
    plan: string[];
    needsResearch: boolean;
    needsKnowledgeAgent?: boolean;
    needsFactCheck: boolean;
    needsReview: boolean;
    needsDiagram: boolean;
    needsChart?: boolean;
    needsImage?: boolean;
    needsWikipedia?: boolean;
  } = {
    task: query,
    plan: ['Synthesize accurate response directly.'],
    needsResearch: false,
    needsKnowledgeAgent: false,
    needsFactCheck: false,
    needsReview: false,
    needsDiagram: false,
    needsChart: false,
    needsImage: false,
    needsWikipedia: false,
  };

  if (agentConfigs.planner.enabled) {
    const pCfg = agentConfigs.planner;
    const provInfo = resolveProviderConfig(pCfg);
    const start = Date.now();

    updateStep({
      agentId: 'planner',
      name: pCfg.name,
      icon: pCfg.icon,
      status: 'running',
      providerName: provInfo.provider?.name || 'Primary',
      model: provInfo.model,
    });

    const defaultPromptTemplate = DEFAULT_AGENT_SYSTEM_PROMPTS.planner;
    let activePrompt = (pCfg.systemPrompt || defaultPromptTemplate).replace('{query}', query);

    // Prepend real-time current date and time
    activePrompt = `Current date and time: ${currentDateTime}\n\n${activePrompt}`;

    // Explicitly inject current Diagram Mode state so Planner's decision is context-aware
    const diagramModeNotice = diagramMode
      ? `\n\n[SYSTEM CONTEXT: Diagram Mode is currently ENABLED (ON).]
- The user has enabled Diagram Mode for this session.
- Evaluate if the inquiry involves technical systems, hardware/device architecture, system workflows, comparisons (e.g. phone/hardware specs, camera sensor mechanisms, software architecture), processes, or concepts that benefit from a visual blueprint. If yes, set "needsDiagram": true. Otherwise, set "needsDiagram": false.`
      : `\n\n[SYSTEM CONTEXT: Diagram Mode is currently DISABLED (OFF).]
- Diagram Mode is OFF for this request. Always output "needsDiagram": false.`;

    activePrompt += diagramModeNotice;

    // Explicitly inject current Chart Mode state so Planner's decision is context-aware
    const chartModeNotice = chartMode
      ? `\n\n[SYSTEM CONTEXT: Chart Mode is currently ENABLED (ON).]
- The user has enabled Chart Mode for this session.
- Evaluate if the inquiry involves comparative numbers, specs, battery mAh, RAM, storage, camera megapixels, prices, dimensions, statistics, timelines, or quantitative metrics across products, categories, or items. If yes, set "needsChart": true. Otherwise, set "needsChart": false.`
      : `\n\n[SYSTEM CONTEXT: Chart Mode is currently DISABLED (OFF).]
- Chart Mode is OFF for this request. Always output "needsChart": false.`;

    activePrompt += chartModeNotice;

    // Explicitly inject current Image Mode state so Planner's decision is context-aware
    const imageModeNotice = imageMode
      ? `\n\n[SYSTEM CONTEXT: Image Mode is currently ENABLED (ON).]
- The user has enabled Image Mode for this session.
- Evaluate if the inquiry mentions physical products (e.g. smartphones, laptops, cars, hardware), real-world objects, places, landmarks, animals, space imagery, or tangible subjects. If yes, set "needsImage": true. Otherwise, set "needsImage": false.`
      : `\n\n[SYSTEM CONTEXT: Image Mode is currently DISABLED (OFF).]
- Image Mode is OFF for this request. Always output "needsImage": false.`;

    activePrompt += imageModeNotice;

    const rawLang = pCfg.responseLanguage;
    const responseLang = (typeof rawLang === 'string' && rawLang.trim()) ? rawLang.trim() : 'English';
    const responseLangDirective = `\n\n[SYSTEM RESPONSE LANGUAGE DIRECTIVE: RESPONSE LANGUAGE = "${responseLang}"]
- You must instruct all downstream execution agents (Researcher, Fact Checker, Reviewer, Final Synthesizer, and any custom agents) in your plan and task description to perform their work and generate their output entirely in **${responseLang}**.
- The final synthesized answer returned to the user must be written in **${responseLang}**.`;
    activePrompt += responseLangDirective;

    const planRes = await callAgent('planner', [
      { role: 'system', content: `Current date and time: ${currentDateTime}\nYou are the JARVIS Planner. Output only valid JSON.` },
      { role: 'user', content: activePrompt },
    ]);

    const duration = Date.now() - start;

    if (planRes.ok) {
      plannerOutput = safeJsonParse(planRes.text, plannerOutput);
      if (!plannerOutput || typeof plannerOutput !== 'object') {
        plannerOutput = {
          task: query,
          plan: ['Analyze and route inquiry.'],
          needsResearch: false,
          needsFactCheck: false,
          needsReview: false,
          needsDiagram: false,
          needsChart: false,
          needsImage: false,
          needsWikipedia: false,
        };
      }
      if (!Array.isArray(plannerOutput.plan)) {
        const rawPlan = (plannerOutput as Record<string, unknown>).plan || (plannerOutput as Record<string, unknown>).steps || (plannerOutput as Record<string, unknown>).tasks;
        plannerOutput.plan = Array.isArray(rawPlan) ? rawPlan.map(String) : typeof rawPlan === 'string' ? [rawPlan] : ['Task analyzed and routed.'];
      }
      plannerOutput.task = String(plannerOutput.task || query);
      plannerOutput.needsKnowledgeAgent = Boolean(plannerOutput.needsKnowledgeAgent);

      if (isWebFetchQuery(query)) {
        const targetUrl = extractWebFetchUrl(query);
        plannerOutput.needsResearch = false;
        plannerOutput.needsWikipedia = false;
        plannerOutput.needsKnowledgeAgent = false;
        plannerOutput.needsReview = false;
        plannerOutput.needsFactCheck = true;
        plannerOutput.needsDiagram = false;
        plannerOutput.needsChart = false;
        plannerOutput.needsImage = false;
        plannerOutput.task = `Fetch and analyze webpage content from ${targetUrl}`;
        plannerOutput.plan = [
          `Directly fetch raw webpage content from ${targetUrl}`,
          'Verify extracted text integrity and structure',
          'Synthesize comprehensive summary and analysis',
        ];
      } else if (isSearchOverrideQuery(query)) {
        plannerOutput.needsResearch = true;
        plannerOutput.needsWikipedia = false;
        plannerOutput.needsKnowledgeAgent = false;
        plannerOutput.needsReview = false;
        plannerOutput.needsFactCheck = true;
        if (!plannerOutput.task || plannerOutput.task === query || isSearchOverrideQuery(plannerOutput.task)) {
          plannerOutput.task = stripSearchOverridePrefix(plannerOutput.task || query) || 'Web search';
        }
      } else if (isPersonalOrHumanAiComparison(query)) {
        plannerOutput.needsResearch = false;
        plannerOutput.needsKnowledgeAgent = true; // Advisor runs to provide conceptual Human vs AI breakdown
        plannerOutput.needsFactCheck = false;
        plannerOutput.needsReview = false;
        plannerOutput.needsWikipedia = false;
        plannerOutput.needsDiagram = false;
        plannerOutput.needsChart = false;
        plannerOutput.needsImage = false;
      } else if (isSelfReferentialInquiry(query)) {
        plannerOutput.needsResearch = false;
        plannerOutput.needsKnowledgeAgent = false;
        plannerOutput.needsFactCheck = false;
        plannerOutput.needsReview = false;
        plannerOutput.needsWikipedia = false;
        plannerOutput.needsDiagram = false;
        plannerOutput.needsChart = false;
        plannerOutput.needsImage = false;
      }
      if (!diagramMode) {
        plannerOutput.needsDiagram = false;
      }
      if (!chartMode) {
        plannerOutput.needsChart = false;
      }
      if (!imageMode) {
        plannerOutput.needsImage = false;
      }
      updateStep({
        agentId: 'planner',
        name: pCfg.name,
        icon: pCfg.icon,
        status: 'completed',
        providerName: planRes.providerName,
        model: planRes.model,
        durationMs: duration,
        summary: Array.isArray(plannerOutput.plan) && plannerOutput.plan.length > 0 ? plannerOutput.plan.slice(0, 2).join(' • ') : 'Task analyzed and routed.',
        outputPreview: JSON.stringify(plannerOutput, null, 2),
        rawOutput: planRes.text || JSON.stringify(plannerOutput, null, 2),
        usedFallback: planRes.usedFallback,
      });
    } else {
      if (isWebFetchQuery(query)) {
        const targetUrl = extractWebFetchUrl(query);
        plannerOutput.needsResearch = false;
        plannerOutput.needsWikipedia = false;
        plannerOutput.needsKnowledgeAgent = false;
        plannerOutput.needsReview = false;
        plannerOutput.needsFactCheck = true;
        plannerOutput.needsDiagram = false;
        plannerOutput.needsChart = false;
        plannerOutput.needsImage = false;
        plannerOutput.task = `Fetch and analyze webpage content from ${targetUrl}`;
        plannerOutput.plan = [
          `Directly fetch raw webpage content from ${targetUrl}`,
          'Verify extracted text integrity and structure',
          'Synthesize comprehensive summary and analysis',
        ];
      } else if (isSearchOverrideQuery(query)) {
        plannerOutput.needsResearch = true;
        plannerOutput.needsWikipedia = false;
        plannerOutput.needsKnowledgeAgent = false;
        plannerOutput.needsReview = false;
        plannerOutput.needsFactCheck = true;
        plannerOutput.task = stripSearchOverridePrefix(query) || 'Web search';
      }
      updateStep({
        agentId: 'planner',
        name: pCfg.name,
        icon: pCfg.icon,
        status: 'failed',
        providerName: planRes.providerName,
        model: planRes.model,
        durationMs: duration,
        error: planRes.error || 'Planner execution failed.',
      });
    }
  } else if (isWebFetchQuery(query)) {
    const targetUrl = extractWebFetchUrl(query);
    plannerOutput.needsResearch = false;
    plannerOutput.needsWikipedia = false;
    plannerOutput.needsKnowledgeAgent = false;
    plannerOutput.needsReview = false;
    plannerOutput.needsFactCheck = true;
    plannerOutput.needsDiagram = false;
    plannerOutput.needsChart = false;
    plannerOutput.needsImage = false;
    plannerOutput.task = `Fetch and analyze webpage content from ${targetUrl}`;
    plannerOutput.plan = [
      `Directly fetch raw webpage content from ${targetUrl}`,
      'Verify extracted text integrity and structure',
      'Synthesize comprehensive summary and analysis',
    ];
  } else if (isSearchOverrideQuery(query)) {
    plannerOutput.needsResearch = true;
    plannerOutput.needsWikipedia = false;
    plannerOutput.needsKnowledgeAgent = false;
    plannerOutput.needsReview = false;
    plannerOutput.needsFactCheck = true;
    plannerOutput.task = stripSearchOverridePrefix(query) || 'Web search';
  }

  // Standalone whole-word matching for news inquiries (excludes technical terms like 'electrical current')
  const isNewsInquiry = (text: string): boolean => {
    const lower = text.toLowerCase();
    // Exclude technical/scientific phrases with "current" (e.g. electrical current, alternating current, direct current, ocean currents)
    if (/\b(electric|electrical|alternating|direct|ocean|water|eddy|fluid|flow|air|convection)\s+current\b/i.test(lower) || /\bcurrents\b/i.test(lower)) {
      return false;
    }
    // Match standalone whole words only
    return /\b(news|today|current|latest|breaking|headlines)\b/i.test(lower);
  };

  const isWorldNewsInquiry = (text: string): boolean => {
    const lower = text.toLowerCase();
    return (
      /\b(world|global|international)\b.*\b(news|headlines|breaking|stories)\b/i.test(lower) ||
      /\b(news|headlines|breaking)\b.*\b(world|global|international)\b/i.test(lower) ||
      /\btop\s*\d*\s*news\b/i.test(lower) ||
      /\btop\s*\d*\s*world\s*news\b/i.test(lower) ||
      /^(what are the )?(top \d+ |latest |breaking )?(world|global|international) news/i.test(lower.trim())
    );
  };

  const isWebFetch = isWebFetchQuery(query);
  const targetWebUrl = isWebFetch ? extractWebFetchUrl(query) : '';
  const isSearchOverride = isSearchOverrideQuery(query);
  const strippedQuery = isWebFetch ? targetWebUrl : isSearchOverride ? stripSearchOverridePrefix(query) : query;
  const combinedQueryText = `${strippedQuery} ${plannerOutput.task || ''}`;
  const isNewsQuery = !isWebFetch && isNewsInquiry(combinedQueryText);
  const isWorldNews = !isWebFetch && isWorldNewsInquiry(combinedQueryText);
  const isWeatherQuery = !isWebFetch && !isSearchOverride && /\b(weather|temperature|forecast|rain|snow|wind|humidity|degrees)\b/i.test(combinedQueryText);
  const isPersonalQuery = !isWebFetch && !isSearchOverride && (isPersonalOrHumanAiComparison(query) || isPersonalOrHumanAiComparison(combinedQueryText));
  const isSelfQuery = !isWebFetch && !isSearchOverride && (isSelfReferentialInquiry(query) || isSelfReferentialInquiry(combinedQueryText));

  // Determine which downstream agents are required.
  // When isWebFetch is true, Researcher, Wikipedia, Advisor, and Reviewer are skipped.
  // Researcher ONLY runs if enabled AND (deepResearch toggle is active OR plannerOutput.needsResearch is true).
  const shouldResearch =
    !isWebFetch &&
    !isPersonalQuery &&
    !isSelfQuery &&
    agentConfigs.researcher.enabled &&
    (isSearchOverride || deepResearch || Boolean(plannerOutput.needsResearch));

  const shouldFactCheck =
    agentConfigs.factChecker.enabled &&
    (isWebFetch || deepResearch || (shouldResearch && Boolean(plannerOutput.needsFactCheck)));

  const shouldReview =
    !isWebFetch &&
    !isSearchOverride &&
    agentConfigs.reviewer.enabled &&
    (deepResearch || Boolean(plannerOutput.needsReview));

  // ==========================================
  // STEP 1.5: 🌐 WEB FETCHER (for /web [URL])
  // ==========================================
  let webFetchData: {
    url: string;
    finalUrl?: string;
    title: string;
    length: number;
    description?: string;
    headings?: string[];
    preview: string;
    textContent: string;
  } | null = null;
  let webFetchError = '';

  if (isWebFetch && targetWebUrl) {
    const webFetchStart = Date.now();
    updateStep({
      agentId: 'webFetcher',
      name: 'Web Fetcher',
      icon: 'Globe',
      status: 'running',
      providerName: 'Direct HTTP Fetch',
      model: 'Direct Web Reader',
      summary: `Fetching webpage content directly from ${targetWebUrl}...`,
    });

    const webRes = await api.webFetch(targetWebUrl);
    const webFetchDuration = Date.now() - webFetchStart;

    if (webRes.ok && webRes.data) {
      webFetchData = {
        url: webRes.data.url || targetWebUrl,
        finalUrl: webRes.data.finalUrl || targetWebUrl,
        title: webRes.data.title || targetWebUrl,
        length: webRes.data.length || (webRes.data.textContent ? webRes.data.textContent.length : 0),
        description: webRes.data.description || '',
        headings: webRes.data.headings || [],
        preview: (webRes.data.textContent || '').slice(0, 1500),
        textContent: webRes.data.textContent || '',
      };

      sourcesCollected.push({
        title: webRes.data.title || targetWebUrl,
        url: webRes.data.finalUrl || targetWebUrl,
        domain: (() => {
          try {
            return new URL(webRes.data.finalUrl || targetWebUrl).hostname;
          } catch {
            return 'web';
          }
        })(),
        snippet: webRes.data.description || (webRes.data.textContent || '').slice(0, 200),
      });

      updateStep({
        agentId: 'webFetcher',
        name: 'Web Fetcher',
        icon: 'Globe',
        status: 'completed',
        providerName: 'Direct HTTP Fetch',
        model: 'Direct Web Reader',
        durationMs: webFetchDuration,
        summary: `Successfully fetched ${webFetchData.length.toLocaleString()} characters from ${webFetchData.title}.`,
        outputPreview: JSON.stringify(webFetchData, null, 2),
        rawOutput: JSON.stringify(webFetchData, null, 2),
      });
    } else {
      webFetchError = webRes.error || `Could not fetch content from ${targetWebUrl}`;
      updateStep({
        agentId: 'webFetcher',
        name: 'Web Fetcher',
        icon: 'Globe',
        status: 'failed',
        providerName: 'Direct HTTP Fetch',
        model: 'Direct Web Reader',
        durationMs: webFetchDuration,
        summary: `Failed to fetch webpage: ${webFetchError}`,
        error: webFetchError,
        outputPreview: JSON.stringify({ error: webFetchError, url: targetWebUrl }, null, 2),
        rawOutput: JSON.stringify({ error: webFetchError, url: targetWebUrl }, null, 2),
      });
    }
  }

  // ==========================================
  // STEP 2: 🔎 RESEARCHER
  // ==========================================
  const researcherOutput = {
    facts: [] as string[],
    sources: [] as Array<{ title: string; url: string; domain?: string }>,
  };

  if (shouldResearch) {
    console.log('[JARVIS Researcher] QUERY TYPE DEBUG - Query:', strippedQuery, '| isSearchOverride:', isSearchOverride, '| isNewsQuery:', isNewsQuery, '| isWorldNews:', isWorldNews, '| isWeatherQuery:', isWeatherQuery, '| needsWikipedia:', plannerOutput.needsWikipedia);
    const rCfg = agentConfigs.researcher;
    const provInfo = resolveProviderConfig(rCfg);
    const start = Date.now();

    updateStep({
      agentId: 'researcher',
      name: rCfg.name,
      icon: rCfg.icon,
      status: 'running',
      providerName: provInfo.provider?.name || 'Primary',
      model: provInfo.model,
    });

    let searchSnippets = '';
    const gatheredSnippets: string[] = [];
    let searchSource = 'Live News API';

    try {
      const { cleanedSearchQuery } = extractTopicKeywords(strippedQuery, plannerOutput.task);

      let searchResults: SearchResult[] = [];
      let wikiSummaryCandidate: RawSearchResultCandidate | null = null;

      // 1. Weather Query handling using api.weather()
      if (isWeatherQuery) {
        try {
          const matchCity = strippedQuery.match(/(?:in|for|at)\s+([a-zA-Z\s]+)(?:\?|$)/i);
          const cityName = matchCity ? matchCity[1].trim() : 'London';
          console.log('[JARVIS Researcher] Calling api.weather() for weather query, city:', cityName);
          const weatherRes = await api.weather(`city=${encodeURIComponent(cityName)}`);
          console.log('[JARVIS Researcher] RAW DATA USED (DEBUG) - Weather API Response:', JSON.stringify(weatherRes, null, 2));
          if (weatherRes && weatherRes.current) {
            const wSummary = `Location: ${weatherRes.current.location} | Temperature: ${weatherRes.current.temperature}°C (Feels like: ${weatherRes.current.feelsLike}°C) | Condition: ${weatherRes.current.conditionLabel} | Humidity: ${weatherRes.current.humidity}% | Wind: ${weatherRes.current.wind} km/h`;
            searchResults = [{
              title: `Live Weather for ${weatherRes.current.location}: ${weatherRes.current.temperature}°C, ${weatherRes.current.conditionLabel}`,
              url: `/weather?city=${encodeURIComponent(weatherRes.current.location)}`,
              description: wSummary,
              domain: 'open-meteo.com',
            }];
            searchSource = 'Live Weather API';
            logToJarvisTerminal(`Using Live Weather API (${searchResults.length} result${searchResults.length === 1 ? '' : 's'})`);
          }
        } catch (err) {
          console.warn('[JARVIS Researcher] api.weather() failed, falling back to general search:', err);
          logToJarvisTerminal('Live Weather API failed, falling back to general search', 'warning');
        }
      }

      // 2. When Planner detects a news/current-events query, Researcher attempts GNews API first, then falls back to Google News RSS
      else if (isNewsQuery) {
        let gnewsSucceeded = false;
        try {
          console.log('[JARVIS Researcher] Attempting primary GNews API for news query:', strippedQuery, 'isWorldNews:', isWorldNews);
          const gnewsRes = await api.news({
            query: isWorldNews ? undefined : (cleanedSearchQuery || strippedQuery),
            category: isWorldNews ? 'world' : 'general',
          });
          console.log('[JARVIS Researcher] RAW DATA USED (DEBUG) - GNews Response:', JSON.stringify(gnewsRes, null, 2));

          if (
            gnewsRes &&
            Array.isArray(gnewsRes.data) &&
            gnewsRes.data.length > 0 &&
            !gnewsRes.isFallback &&
            gnewsRes.provider !== 'google_rss'
          ) {
            searchResults = gnewsRes.data;
            searchSource = 'GNews API';
            gnewsSucceeded = true;
            console.log('[JARVIS Researcher] News source used: GNews');
            logToJarvisTerminal(`Using GNews API (${searchResults.length} result${searchResults.length === 1 ? '' : 's'})`);
          } else {
            const specificError =
              gnewsRes?.error ||
              (gnewsRes?.isFallback ? 'GNews fallback triggered (missing key or API limit)' : '') ||
              (!gnewsRes?.data || gnewsRes.data.length === 0 ? 'Zero articles returned by GNews' : 'GNews request failed');
            console.log(`[JARVIS Researcher] GNews API error: ${specificError}`);
          }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          console.log(`[JARVIS Researcher] GNews API error: ${errMsg}`);
          console.warn('[JARVIS Researcher] GNews API attempt encountered an error:', err);
        }

        // Automatic fallback to Google News RSS if GNews failed, hit rate limits, had no API key, or returned 0 results
        if (!gnewsSucceeded) {
          logToJarvisTerminal('GNews failed, falling back to Google News RSS', 'warning');
          try {
            const rssQuery = isWorldNews ? 'latest world news' : (cleanedSearchQuery || strippedQuery);
            console.log('[JARVIS Researcher] Falling back to Google News RSS for news query:', rssQuery);
            const liveNewsRes = await api.newsRss(rssQuery);
            console.log('[JARVIS Researcher] RAW DATA USED (DEBUG) - News RSS Response:', JSON.stringify(liveNewsRes, null, 2));
            if (Array.isArray(liveNewsRes) && liveNewsRes.length > 0) {
              searchResults = liveNewsRes;
              searchSource = 'Google News RSS (fallback)';
              console.log('[JARVIS Researcher] News source used: Google RSS (fallback)');
              logToJarvisTerminal(`Using Google News RSS (${searchResults.length} result${searchResults.length === 1 ? '' : 's'})`);
            } else {
              logToJarvisTerminal('Google News RSS returned 0 results, falling back to general search', 'warning');
            }
          } catch (err) {
            console.warn('[JARVIS Researcher] Google News RSS fallback failed, falling back to general search:', err);
            logToJarvisTerminal('Google News RSS failed, falling back to general search', 'warning');
          }
        }
      }

      // 3. General / Factual Search (Tavily with DuckDuckGo fallback in backend)
      if (searchResults.length === 0) {
        const currentDateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        const effectiveSearchQuery = isNewsQuery
          ? (isWorldNews ? `top world breaking news headlines today ${currentDateStr}` : `world news today ${currentDateStr} ${cleanedSearchQuery || strippedQuery}`)
          : (isSearchOverride ? (cleanedSearchQuery || strippedQuery) : query);

        try {
          const searchRes = await api.search(effectiveSearchQuery);
          let rawResults: SearchResult[] = [];
          let sourceLabel = 'Tavily API';
          let fallbackOccurred = false;

          if (Array.isArray(searchRes)) {
            rawResults = searchRes;
            const resMeta = searchRes as SearchResult[] & { searchSource?: string; fallbackOccurred?: boolean };
            if (resMeta.searchSource) sourceLabel = resMeta.searchSource;
            if (resMeta.fallbackOccurred) fallbackOccurred = true;
          } else if (searchRes && Array.isArray((searchRes as { results?: SearchResult[] }).results)) {
            rawResults = (searchRes as { results?: SearchResult[] }).results || [];
            sourceLabel = (searchRes as { searchSource?: string }).searchSource || 'Tavily API';
            if ((searchRes as { fallbackOccurred?: boolean }).fallbackOccurred) fallbackOccurred = true;
          }

          searchResults = rawResults;
          searchSource = sourceLabel;
          console.log('[JARVIS Researcher] RAW DATA USED (DEBUG) - Search Results:', JSON.stringify(searchResults, null, 2));

          if (fallbackOccurred || sourceLabel.toLowerCase().includes('duckduckgo')) {
            logToJarvisTerminal('Tavily failed, falling back to DuckDuckGo', 'warning');
            logToJarvisTerminal(`Using DuckDuckGo fallback (${searchResults.length} result${searchResults.length === 1 ? '' : 's'})`);
          } else if (sourceLabel.toLowerCase().includes('tavily')) {
            logToJarvisTerminal(`Using Tavily API (${searchResults.length} result${searchResults.length === 1 ? '' : 's'})`);
          } else {
            logToJarvisTerminal(`Using ${sourceLabel} (${searchResults.length} result${searchResults.length === 1 ? '' : 's'})`);
          }
        } catch (err) {
          console.warn('[JARVIS Researcher] Search API error:', err);
          logToJarvisTerminal('Search API failed, falling back to DuckDuckGo', 'warning');
        }
      }

      // 4. AI-Decided Wikipedia Lookup for factual/encyclopedic queries (Works in both Deep Research ON and OFF)
      if (plannerOutput.needsWikipedia && !isWeatherQuery && !isNewsQuery) {
        console.log(`[JARVIS Researcher] AI Planner indicated needsWikipedia: true for query: "${strippedQuery}". Executing 2-step lookup...`);
        try {
          // Step 1: Call fetchWikipediaSearch with limit=1 to find the single best-matching page title/ID
          const wikiPages = await searchWikipedia(strippedQuery, 1);
          if (wikiPages && wikiPages.length > 0 && wikiPages[0]?.title) {
            const topPage = wikiPages[0];
            console.log(`[JARVIS Researcher] Wikipedia Step 1 matched page: "${topPage.title}". Fetching full lead summary (Step 2)...`);
            // Step 2: Call fetchWikipediaSummary using that page's title to get the full lead-paragraph summary
            const summary = await getWikipediaSummary(topPage.title);
            const extract = summary?.extract || topPage.snippet || topPage.description || '';
            const pageUrl = summary?.url || topPage.url || `https://en.wikipedia.org/wiki/${encodeURIComponent(topPage.title.replace(/ /g, '_'))}`;

            wikiSummaryCandidate = {
              title: summary?.title || topPage.title,
              url: pageUrl,
              domain: 'wikipedia.org',
              description: extract,
              type: 'wikipedia',
            };
            console.log(`[JARVIS Researcher] Wikipedia Step 2 retrieved summary (${extract.length} chars) for "${topPage.title}".`);
            logToJarvisTerminal(`Wikipedia lookup triggered - found "${topPage.title}" page`);
          } else {
            // Safety check: 0 results returned, skip summary step and proceed with Tavily results only
            console.log(`[JARVIS Researcher] Wikipedia Step 1 returned 0 results for query: "${strippedQuery}". Skipping summary step.`);
            logToJarvisTerminal('Wikipedia lookup triggered - no matching page found, skipped', 'warning');
          }
        } catch (wikiErr) {
          console.warn('[JARVIS Researcher] Wikipedia 2-step lookup error (continuing with search results):', wikiErr);
          logToJarvisTerminal('Wikipedia lookup triggered - lookup error, skipped', 'warning');
        }
      } else if (!plannerOutput.needsWikipedia) {
        console.log('[JARVIS Researcher] needsWikipedia is false. Skipping Wikipedia lookup to save tokens.');
      }

      const rawCandidates: RawSearchResultCandidate[] = [];

      // Step 3: Add Wikipedia summary alongside existing search results (don't replace them)
      if (wikiSummaryCandidate) {
        rawCandidates.push(wikiSummaryCandidate);
      }

      // Combine Web Search results
      (searchResults || []).forEach((s) => {
        if (s && s.title && s.url) {
          const desc = s.description ? s.description.trim() : '';
          rawCandidates.push({
            title: s.title,
            url: s.url,
            domain: s.domain || (s.url.startsWith('http') ? new URL(s.url).hostname.replace(/^www\./, '') : 'web'),
            description: desc,
            type: s.type || 'web',
          });
        }
      });

      // Score and strictly filter candidates before passing them to the Researcher AI agent (bypass for live weather/news APIs and any news query)
      const isDirectNewsOrWeather =
        isNewsQuery ||
        isWorldNews ||
        isWeatherQuery ||
        searchSource === 'GNews API' ||
        searchSource === 'Google News RSS (fallback)' ||
        searchSource === 'Google News RSS' ||
        searchSource === 'Live News API' ||
        searchSource === 'Live Weather API' ||
        searchSource.toLowerCase().includes('news');

      let filteredSources = isDirectNewsOrWeather
        ? rawCandidates
        : scoreAndFilterSearchResults(rawCandidates, strippedQuery, plannerOutput.task);

      // Fallback: If relevance filter pruned too aggressively (< 3 sources), recover original candidates
      if (filteredSources.length < 3 && rawCandidates.length >= 3) {
        console.log(
          `[JARVIS Researcher] Relevance filter kept only ${filteredSources.length} sources; falling back to all ${rawCandidates.length} raw search candidates.`,
        );
        filteredSources = rawCandidates;
      }

      console.log(
        `[JARVIS Researcher] Candidate pool evaluated ${rawCandidates.length} raw search results -> passing ${filteredSources.length} sources to Researcher.`,
      );

      const candidatePoolLimit = isNewsQuery ? 12 : 10;

      filteredSources.slice(0, candidatePoolLimit).forEach((src, idx) => {
        const pubDateStr = src.publishedAt || src.date ? ` (Published: ${src.publishedAt || src.date})` : '';
        gatheredSnippets.push(`[Source ${idx + 1} | ${src.domain || 'Source'}: ${src.title}]${pubDateStr} ${src.description} [URL: ${src.url}]`);
        sourcesCollected.push({
          title: src.title,
          url: src.url,
          domain: src.domain,
          description: src.description,
          date: src.publishedAt || src.date,
          type: src.type,
        });
      });

      searchSnippets = gatheredSnippets.join('\n\n');
    } catch (err) {
      console.warn('[JARVIS Researcher] Live search retrieval error:', err);
    }

    const defaultPromptTemplate = DEFAULT_AGENT_SYSTEM_PROMPTS.researcher;
    let activePrompt = (rCfg.systemPrompt || defaultPromptTemplate)
      .replace('{task}', plannerOutput.task || strippedQuery);

    if (activePrompt.includes('{searchSnippets}')) {
      activePrompt = activePrompt.replace(
        '{searchSnippets}',
        searchSnippets || 'No external snippets available. Rely on internal high-confidence knowledge.',
      );
    } else if (searchSnippets) {
      activePrompt += `\n\nLive Context / Search Data:\n${searchSnippets}`;
    }

    console.group(`[JARVIS Researcher] Executing Research for: "${strippedQuery}"`);
    console.log(`[JARVIS Researcher] Planner Task: "${plannerOutput.task || strippedQuery}"`);
    console.log(`[JARVIS Researcher] Gathered ${gatheredSnippets.length} snippets:`, gatheredSnippets);
    console.log(`[JARVIS Researcher] Active Prompt:`, activePrompt);

    const researchRes = await callAgent('researcher', [
      {
        role: 'system',
        content:
          'You are the JARVIS Researcher. Extract specific factual points and output valid JSON with facts and sources.',
      },
      { role: 'user', content: activePrompt },
    ]);

    const duration = Date.now() - start;

    console.log(`[JARVIS Researcher] Raw Model Output (${researchRes.model || 'AI'}):`, researchRes.text);

    if (researchRes.ok && researchRes.text) {
      const parsedResearcher = parseResearcherOutput(researchRes.text, sourcesCollected);
      researcherOutput.facts = parsedResearcher.facts;
      researcherOutput.candidates = parsedResearcher.candidates;
      researcherOutput.sources = parsedResearcher.sources;

      console.log(`[JARVIS Researcher] Parsed ${researcherOutput.facts.length} facts:`, researcherOutput.facts);
      console.log(`[JARVIS Researcher] Extracted ${researcherOutput.sources.length} sources:`, researcherOutput.sources);
      console.groupEnd();

      if (Array.isArray(researcherOutput.sources)) {
        const candidateModelSources: RawSearchResultCandidate[] = researcherOutput.sources.map((s) => ({
          title: s.title || '',
          url: s.url || '',
          domain: s.domain,
          description: s.title || '',
          type: 'web' as const,
        }));
        const validatedModelSources = scoreAndFilterSearchResults(candidateModelSources, query, plannerOutput.task);
        validatedModelSources.forEach((s) => {
          if (s.title && s.url && !sourcesCollected.some((existing) => existing.url === s.url)) {
            sourcesCollected.push({
              title: s.title,
              url: s.url,
              domain: s.domain,
              type: 'web',
            });
          }
        });
      }

      updateStep({
        agentId: 'researcher',
        name: rCfg.name,
        icon: rCfg.icon,
        status: 'completed',
        providerName: researchRes.providerName,
        model: researchRes.model,
        durationMs: duration,
        summary: `Gathered ${researcherOutput.facts.length} core facts and ${sourcesCollected.length} references.`,
        outputPreview: JSON.stringify(researcherOutput, null, 2),
        rawOutput: researchRes.text || JSON.stringify(researcherOutput, null, 2),
        usedFallback: researchRes.usedFallback,
        searchSource,
      });
    } else {
      console.error(`[JARVIS Researcher] Agent execution failed:`, researchRes.error);
      console.groupEnd();

      // Gracefully recover facts from collected search snippets if LLM call failed
      if (sourcesCollected.length > 0) {
        const fallbackFacts = sourcesCollected
          .filter((s) => s.description && s.description.length > 15)
          .map((s) => `[${s.title}] ${s.description}`);
        if (fallbackFacts.length > 0) {
          researcherOutput.facts = fallbackFacts;
        }
      }

      updateStep({
        agentId: 'researcher',
        name: rCfg.name,
        icon: rCfg.icon,
        status: researcherOutput.facts.length > 0 ? 'completed' : 'failed',
        providerName: researchRes.providerName,
        model: researchRes.model,
        durationMs: duration,
        summary:
          researcherOutput.facts.length > 0
            ? `Recovered ${researcherOutput.facts.length} core facts from live search sources.`
            : 'Researcher failed.',
        error: researchRes.error || 'Researcher failed.',
        searchSource,
      });
    }
  } else {
    updateStep({
      agentId: 'researcher',
      name: agentConfigs.researcher.name,
      icon: agentConfigs.researcher.icon,
      status: 'skipped',
      providerName: agentConfigs.researcher.providerId,
      model: agentConfigs.researcher.modelId,
      summary: 'Research skipped based on task profile.',
    });
  }

  // Execute Parallel Research Custom Agents
  const parallelResearchAgents = customAgents.filter(
    (ca) => ca.enabled && ca.pipelinePosition === 'parallel_research',
  );
  for (const cAgent of parallelResearchAgents) {
    await executeCustomAgent(cAgent);
  }

  // ==========================================
  // STEP 3: 🛡️ FACT CHECKER
  // ==========================================
  let factCheckOutput = {
    verified: [] as string[],
    issues: [] as string[],
  };

  if (shouldFactCheck) {
    const fCfg = agentConfigs.factChecker;
    const provInfo = resolveProviderConfig(fCfg);
    const start = Date.now();

    updateStep({
      agentId: 'factChecker',
      name: fCfg.name,
      icon: fCfg.icon,
      status: 'running',
      providerName: provInfo.provider?.name || 'Primary',
      model: provInfo.model,
    });

    const defaultPromptTemplate = DEFAULT_AGENT_SYSTEM_PROMPTS.factChecker;

    let claimsText = '';
    if (isWebFetch && webFetchData) {
      claimsText = JSON.stringify(
        {
          mode: 'direct_web_fetch_audit',
          targetUrl: webFetchData.url,
          finalUrl: webFetchData.finalUrl,
          pageTitle: webFetchData.title,
          metaDescription: webFetchData.description,
          headings: webFetchData.headings,
          contentExcerpt: webFetchData.textContent.slice(0, 5000),
        },
        null,
        2,
      );
    } else if (isWebFetch && webFetchError) {
      claimsText = JSON.stringify(
        {
          mode: 'direct_web_fetch_audit',
          targetUrl: targetWebUrl,
          error: webFetchError,
          status: 'fetch_failed',
        },
        null,
        2,
      );
    } else if (researcherOutput.candidates && researcherOutput.candidates.length > 0) {
      const candidateClaims = researcherOutput.candidates.map((c, i) => ({
        id: i + 1,
        title: c.title || null,
        fact: c.fact,
        sourceIndex: c.sourceIndex || null,
        domain: c.domain || null,
        eventDate: c.eventDate || null,
        publishedAt: c.publishedAt || null,
        updatedAt: c.updatedAt || null,
        location: c.location || null,
        category: c.category || null,
        confirmedBy: c.confirmedBy || [],
      }));
      claimsText = JSON.stringify(candidateClaims, null, 2);
    } else if (researcherOutput.facts.length > 0) {
      claimsText = JSON.stringify(
        researcherOutput.facts.map((f, i) => ({ id: i + 1, fact: f })),
        null,
        2,
      );
    } else {
      claimsText = 'Evaluate general knowledge truthfulness for: ' + query;
    }

    let sourcesText = '';
    if (sourcesCollected.length > 0) {
      const compactSources = sourcesCollected.slice(0, 12).map((s, i) => ({
        index: i + 1,
        title: s.title,
        domain: s.domain || 'web',
        url: s.url,
        publishedAt: s.date || null,
      }));
      sourcesText = JSON.stringify(compactSources, null, 2);
    } else {
      sourcesText = 'No sources collected.';
    }

    const activePrompt = (fCfg.systemPrompt || defaultPromptTemplate)
      .replace('{task}', plannerOutput.task || query)
      .replace('{claims}', claimsText)
      .replace('{sources}', sourcesText);

    const factRes = await callAgent('factChecker', [
      { role: 'system', content: 'You are the JARVIS Fact Checker. Output strictly valid JSON.' },
      { role: 'user', content: activePrompt },
    ]);

    const duration = Date.now() - start;

    if (factRes.ok) {
      factCheckOutput = safeJsonParse(factRes.text, factCheckOutput);
      if (!factCheckOutput || typeof factCheckOutput !== 'object') {
        factCheckOutput = { verified: [], issues: [] };
      }
      if (!Array.isArray(factCheckOutput.verified)) {
        factCheckOutput.verified = [];
      }
      if (!Array.isArray(factCheckOutput.issues)) {
        factCheckOutput.issues = [];
      }

      // Normalize verified claims into clean, rich representations
      const normalizedVerified: string[] = [];
      factCheckOutput.verified.forEach((vItem) => {
        if (typeof vItem === 'object' && vItem !== null) {
          const vObj = vItem as Record<string, unknown>;
          const claimText = String(vObj.claim || vObj.fact || vObj.statement || vObj.title || '').trim();
          if (!claimText) return;

          let dateStatus = String(vObj.dateStatus || '').toLowerCase();
          const calculatedStatus = classifyDateStatus(
            vObj.eventDate as string | null,
            vObj.publishedAt as string | null,
            vObj.updatedAt as string | null,
          );
          if (!dateStatus || dateStatus === 'undefined' || dateStatus === 'null') {
            dateStatus = calculatedStatus;
          }

          const confirmedBy = Array.isArray(vObj.confirmedBy) && vObj.confirmedBy.length > 0
            ? ` (Confirmed by: ${vObj.confirmedBy.join(', ')})`
            : '';
          const domainInfo = vObj.domain ? ` [${vObj.domain}]` : '';
          const statusLabel = dateStatus && dateStatus !== 'unknown' ? ` [${dateStatus}]` : '';

          normalizedVerified.push(`${statusLabel}${domainInfo} ${claimText}${confirmedBy}`.trim());
        } else if (typeof vItem === 'string' && vItem.trim()) {
          normalizedVerified.push(vItem.trim());
        }
      });

      if (normalizedVerified.length > 0) {
        factCheckOutput.verified = normalizedVerified;
      }

      updateStep({
        agentId: 'factChecker',
        name: fCfg.name,
        icon: fCfg.icon,
        status: 'completed',
        providerName: factRes.providerName,
        model: factRes.model,
        durationMs: duration,
        summary: `Validated ${factCheckOutput.verified?.length || 0} claims (${factCheckOutput.issues?.length || 0} corrections).`,
        outputPreview: JSON.stringify(factCheckOutput, null, 2),
        rawOutput: factRes.text || JSON.stringify(factCheckOutput, null, 2),
        usedFallback: factRes.usedFallback,
      });
    } else {
      updateStep({
        agentId: 'factChecker',
        name: fCfg.name,
        icon: fCfg.icon,
        status: 'failed',
        providerName: factRes.providerName,
        model: factRes.model,
        durationMs: duration,
        error: factRes.error || 'Fact Checker failed.',
      });
    }
  } else {
    updateStep({
      agentId: 'factChecker',
      name: agentConfigs.factChecker.name,
      icon: agentConfigs.factChecker.icon,
      status: 'skipped',
      providerName: agentConfigs.factChecker.providerId,
      model: agentConfigs.factChecker.modelId,
      summary: 'Fact checking not required for this query.',
    });
  }

  // ==========================================
  // STEP 3.5: 💡 ADVISOR (COMPARATIVE & CONCEPTUAL KNOWLEDGE)
  // ==========================================
  let advisorOutput = '';
  const shouldRunAdvisor =
    agentConfigs.advisor &&
    agentConfigs.advisor.enabled !== false &&
    Boolean(plannerOutput.needsKnowledgeAgent);

  if (shouldRunAdvisor) {
    const advCfg = agentConfigs.advisor;
    const provInfo = resolveProviderConfig(advCfg);
    const start = Date.now();

    storage.addJarvisQueryLog('Advisor agent activated - generating comparative analysis from verified facts', 'ai');

    updateStep({
      agentId: 'advisor',
      name: advCfg.name,
      icon: advCfg.icon,
      status: 'running',
      providerName: provInfo.provider?.name || 'Primary',
      model: provInfo.model,
    });

    const defaultPromptTemplate = DEFAULT_AGENT_SYSTEM_PROMPTS.advisor;
    const verifiedList = Array.isArray(factCheckOutput?.verified) ? factCheckOutput.verified : [];
    const issuesList = Array.isArray(factCheckOutput?.issues) ? factCheckOutput.issues : [];
    const factsList = Array.isArray(researcherOutput?.facts) ? researcherOutput.facts : [];

    const activePrompt = (advCfg.systemPrompt || defaultPromptTemplate)
      .replace('{task}', plannerOutput.task || query)
      .replace('{query}', query)
      .replace('{verified}', verifiedList.map((c) => `- ${c}`).join('\n'))
      .replace('{issues}', issuesList.map((i) => `- ${i}`).join('\n'))
      .replace('{facts}', factsList.map((f, i) => `${i + 1}. ${f}`).join('\n'));

    let advisorUserContent = `User Inquiry: "${query}"\nTask Scope: "${plannerOutput.task || query}"\n\n`;

    if (isPersonalOrHumanAiComparison(query)) {
      advisorUserContent += `[CRITICAL IDENTITY INTEGRITY DIRECTIVE: This is a Human vs AI comparative inquiry involving the user ("me" / "you and me"). Do NOT guess, search for, or fabricate the user's specific real-world identity, name, or personal background. Compare Human capabilities (biological cognition, creativity, intuition, consciousness, subjective experience, physical agency, contextual judgment) with Artificial Intelligence capabilities conceptually and respectfully.]\n\n`;
    }

    if (verifiedList.length > 0) {
      advisorUserContent += `Fact Checker Verified Claims:\n${verifiedList.map((c) => `- ${c}`).join('\n')}\n\n`;
    }
    if (issuesList.length > 0) {
      advisorUserContent += `Fact Checker Flagged Issues / Inaccuracies to AVOID:\n${issuesList.map((i) => `- ${i}`).join('\n')}\n\n`;
    }
    if (factsList.length > 0) {
      advisorUserContent += `Researcher Sourced Findings:\n${factsList.map((f, i) => `${i + 1}. ${f}`).join('\n')}\n\n`;
    }

    const advisorMaxTokens = deepResearch ? 800 : 400;

    if (deepResearch) {
      advisorUserContent += `Deep Research Mode: ON (Budget: 800 tokens max).\nPlease provide a rich, comprehensive comparative analysis including:\n- Structured comparison table\n- Text-based ASCII architecture/workflow/system diagram if comparing processes, workflows, or structural relationships\n- Detailed multi-dimensional trade-off analysis\n- Clear reasoned recommendation/verdict if a choice or preference was requested.`;
    } else {
      advisorUserContent += `Deep Research Mode: OFF (Quick Mode - Strict Budget: ~350-400 tokens max).\nPlease provide a concise, direct comparative summary and a clear, reasoned verdict/recommendation.\nIMPORTANT: Do NOT output ASCII diagrams. Keep comparison to brief bullet points rather than large tables so your entire response stays tightly within the ~400-token budget.`;
    }

    const advisorRes = await callAgent(
      'advisor',
      [
        { role: 'system', content: activePrompt },
        { role: 'user', content: advisorUserContent },
      ],
      advisorMaxTokens,
    );

    const duration = Date.now() - start;

    if (advisorRes.ok) {
      advisorOutput = advisorRes.text.trim();
      updateStep({
        agentId: 'advisor',
        name: advCfg.name,
        icon: advCfg.icon,
        status: 'completed',
        providerName: advisorRes.providerName,
        model: advisorRes.model,
        durationMs: duration,
        summary: 'Generated reasoned conceptual trade-offs & comparative analysis.',
        outputPreview: advisorOutput.slice(0, 400) + (advisorOutput.length > 400 ? '...' : ''),
        rawOutput: advisorOutput,
        usedFallback: advisorRes.usedFallback,
      });
    } else {
      updateStep({
        agentId: 'advisor',
        name: advCfg.name,
        icon: advCfg.icon,
        status: 'failed',
        providerName: advisorRes.providerName,
        model: advisorRes.model,
        durationMs: duration,
        error: advisorRes.error || 'Advisor failed.',
      });
    }
  } else {
    updateStep({
      agentId: 'advisor',
      name: agentConfigs.advisor?.name || 'Advisor',
      icon: agentConfigs.advisor?.icon || '💡',
      status: 'skipped',
      providerName: agentConfigs.advisor?.providerId || 'existing',
      model: agentConfigs.advisor?.modelId || 'deepseek/deepseek-chat',
      summary: 'Comparative knowledge analysis not required for this query.',
    });
  }

  // ==========================================
  // STEP 4: 🔬 REVIEWER
  // ==========================================
  let reviewerOutput = {
    missing: [] as string[],
    issues: [] as string[],
    recommendation: 'Present concise, well-structured synthesis.',
  };

  if (shouldReview) {
    const revCfg = agentConfigs.reviewer;
    const provInfo = resolveProviderConfig(revCfg);
    const start = Date.now();

    updateStep({
      agentId: 'reviewer',
      name: revCfg.name,
      icon: revCfg.icon,
      status: 'running',
      providerName: provInfo.provider?.name || 'Primary',
      model: provInfo.model,
    });

    const defaultPromptTemplate = DEFAULT_AGENT_SYSTEM_PROMPTS.reviewer;

    // For news queries, provide the full candidate pool with structured metadata so Reviewer can actively compare and rank all candidates
    let factsForReviewer = '';
    if (isNewsQuery && Array.isArray(researcherOutput?.candidates) && researcherOutput.candidates.length > 0) {
      const candidatesPayload = researcherOutput.candidates.slice(0, 12).map((c, idx) => ({
        candidateIndex: idx + 1,
        title: c.title || null,
        fact: c.fact,
        domain: c.domain || null,
        eventDate: c.eventDate || null,
        publishedAt: c.publishedAt || null,
        location: c.location || null,
        category: c.category || null,
        confirmedBy: c.confirmedBy || [],
        sourceIndex: c.sourceIndex || null,
      }));
      factsForReviewer = JSON.stringify(candidatesPayload, null, 2);
    } else if (Array.isArray(researcherOutput?.facts) && researcherOutput.facts.length > 0) {
      factsForReviewer = researcherOutput.facts.slice(0, 10).map((f, i) => `${i + 1}. ${f}`).join('\n');
    } else {
      factsForReviewer = 'No facts gathered.';
    }

    const issuesSubset = Array.isArray(factCheckOutput?.issues) ? factCheckOutput.issues : [];

    const activePrompt = (revCfg.systemPrompt || defaultPromptTemplate)
      .replace('{task}', plannerOutput.task || query)
      .replace('{facts}', factsForReviewer)
      .replace('{issues}', JSON.stringify(issuesSubset, null, 2));

    const reviewRes = await callAgent('reviewer', [
      { role: 'system', content: 'You are the JARVIS Reviewer. Output strictly valid JSON.' },
      { role: 'user', content: activePrompt },
    ]);

    const duration = Date.now() - start;

    if (reviewRes.ok) {
      reviewerOutput = safeJsonParse(reviewRes.text, reviewerOutput);
      if (!reviewerOutput || typeof reviewerOutput !== 'object') {
        reviewerOutput = {
          missing: [],
          issues: [],
          recommendation: 'Present concise, well-structured synthesis.',
        };
      }
      if (!Array.isArray(reviewerOutput.missing)) reviewerOutput.missing = [];
      if (!Array.isArray(reviewerOutput.issues)) reviewerOutput.issues = [];
      reviewerOutput.recommendation = String(reviewerOutput.recommendation || 'Quality review complete.');

      updateStep({
        agentId: 'reviewer',
        name: revCfg.name,
        icon: revCfg.icon,
        status: 'completed',
        providerName: reviewRes.providerName,
        model: reviewRes.model,
        durationMs: duration,
        summary: reviewerOutput.recommendation || 'Quality review complete.',
        outputPreview: JSON.stringify(reviewerOutput, null, 2),
        rawOutput: reviewRes.text || JSON.stringify(reviewerOutput, null, 2),
        usedFallback: reviewRes.usedFallback,
      });
    } else {
      updateStep({
        agentId: 'reviewer',
        name: revCfg.name,
        icon: revCfg.icon,
        status: 'failed',
        providerName: reviewRes.providerName,
        model: reviewRes.model,
        durationMs: duration,
        error: reviewRes.error || 'Reviewer failed.',
      });
    }
  } else {
    updateStep({
      agentId: 'reviewer',
      name: agentConfigs.reviewer.name,
      icon: agentConfigs.reviewer.icon,
      status: 'skipped',
      providerName: agentConfigs.reviewer.providerId,
      model: agentConfigs.reviewer.modelId,
      summary: 'Deep critique review bypassed for speed.',
    });
  }

  // ==========================================
  // STEP 4.5: 🤖 CUSTOM AGENTS (before_synthesizer / extra_step)
  // ==========================================
  const preSynthCustomAgents = customAgents.filter(
    (ca) =>
      ca.enabled &&
      (ca.pipelinePosition === 'before_synthesizer' ||
        ca.pipelinePosition === 'extra_step' ||
        !ca.pipelinePosition),
  );
  for (const cAgent of preSynthCustomAgents) {
    await executeCustomAgent(cAgent);
  }

  // ==========================================
  // STEP 5: ✨ FINAL SYNTHESIZER
  // ==========================================
  let finalAnswer = '';

  if (agentConfigs.finalSynthesizer.enabled) {
    const sCfg = agentConfigs.finalSynthesizer;
    const provInfo = resolveProviderConfig(sCfg);
    const start = Date.now();

    updateStep({
      agentId: 'finalSynthesizer',
      name: sCfg.name,
      icon: sCfg.icon,
      status: 'running',
      providerName: provInfo.provider?.name || 'Primary',
      model: provInfo.model,
    });

    const plannerPlanText = Array.isArray(plannerOutput?.plan)
      ? plannerOutput.plan.join(' ')
      : String(plannerOutput?.plan || '');
    const factsList = Array.isArray(researcherOutput?.facts) ? researcherOutput.facts : [];
    const verifiedList = Array.isArray(factCheckOutput?.verified) ? factCheckOutput.verified : [];
    const issuesList = Array.isArray(factCheckOutput?.issues) ? factCheckOutput.issues : [];

    // Build rich variable substitution dictionary for Synthesizer prompts
    const synthReplacements: Record<string, string> = {
      task: plannerOutput.task || query,
      query: query,
      plan: plannerPlanText,
      advisor: advisorOutput,
      advisorOutput: advisorOutput,
      advisorAnalysis: advisorOutput,
      advisorTradeoffs: advisorOutput,
      facts: factsList.map((f, i) => `${i + 1}. ${f}`).join('\n'),
      research: factsList.map((f, i) => `${i + 1}. ${f}`).join('\n'),
      claims: factsList.map((f, i) => `${i + 1}. ${f}`).join('\n'),
      verified: verifiedList.map((c) => `- ${c}`).join('\n'),
      issues: issuesList.map((i) => `- ${i}`).join('\n'),
      reviewer: [
        reviewerOutput?.recommendation || '',
        ...(Array.isArray(reviewerOutput?.issues) ? reviewerOutput.issues.map((iss) => `Scope/Issue: ${iss}`) : []),
        ...(Array.isArray(reviewerOutput?.missing) ? reviewerOutput.missing.map((m) => `Missing Context: ${m}`) : []),
      ]
        .filter(Boolean)
        .join('\n'),
      recommendation: reviewerOutput?.recommendation || '',
      reviewerRecommendation: reviewerOutput?.recommendation || '',
      reviewerIssues: Array.isArray(reviewerOutput?.issues) ? reviewerOutput.issues.join('\n') : '',
      reviewerMissing: Array.isArray(reviewerOutput?.missing) ? reviewerOutput.missing.join('\n') : '',
    };

    let allCustomInsightsText = '';
    const visualDescList: string[] = [];

    customAgentOutputs.forEach((co) => {
      allCustomInsightsText += `--- [Agent: ${co.name}] ---\n${co.output}\n\n`;

      // Map raw agent ID and name
      synthReplacements[co.id] = co.output;
      synthReplacements[co.name] = co.output;

      // Normalized name variations
      const camelName = co.name
        .replace(/[^a-zA-Z0-9]+(.)/g, (_, chr) => chr.toUpperCase())
        .replace(/^[A-Z]/, (c) => c.toLowerCase());
      const snakeName = co.name.toLowerCase().replace(/[^a-zA-Z0-9]+/g, '_');
      const pascalName = co.name
        .replace(/(?:^\w|[A-Z]|\b\w)/g, (word) => word.toUpperCase())
        .replace(/\s+/g, '');

      synthReplacements[camelName] = co.output;
      synthReplacements[snakeName] = co.output;
      synthReplacements[pascalName] = co.output;
      synthReplacements[`${camelName}s`] = co.output;
      synthReplacements[`${snakeName}s`] = co.output;

      // If this agent is related to visual descriptions / alt text
      const lowerName = co.name.toLowerCase();
      const lowerId = co.id.toLowerCase();
      if (
        lowerName.includes('visual') ||
        lowerName.includes('describer') ||
        lowerName.includes('image') ||
        lowerName.includes('alt') ||
        lowerId.includes('visual') ||
        lowerId.includes('describer')
      ) {
        visualDescList.push(co.output);
      }

      // Extract and map any structured JSON fields from the agent's output
      const jsonFields = extractDataFieldsFromAgentOutput(co.output);
      for (const [fKey, fVal] of Object.entries(jsonFields)) {
        synthReplacements[fKey] = fVal;
        synthReplacements[fKey.toLowerCase()] = fVal;
        const fSnake = fKey.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
        const fCamel = fKey.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        synthReplacements[fSnake] = fVal;
        synthReplacements[fCamel] = fVal;

        if (
          fKey.toLowerCase().includes('visual') ||
          fKey.toLowerCase().includes('descrip') ||
          fKey.toLowerCase().includes('alt')
        ) {
          visualDescList.push(fVal);
        }
      }
    });

    // Provide robust bindings for {visualDescriptions}, {visual_descriptions}, and alt text
    if (visualDescList.length > 0) {
      const combinedVisual = visualDescList.join('\n\n');
      synthReplacements['visualDescriptions'] = combinedVisual;
      synthReplacements['visual_descriptions'] = combinedVisual;
      synthReplacements['visualDescription'] = combinedVisual;
      synthReplacements['visual_description'] = combinedVisual;
      synthReplacements['visualDescriber'] = combinedVisual;
      synthReplacements['visual_describer'] = combinedVisual;
      synthReplacements['VisualDescriber'] = combinedVisual;
      synthReplacements['altText'] = combinedVisual;
      synthReplacements['alt_text'] = combinedVisual;
    }

    synthReplacements['customAgents'] = allCustomInsightsText.trim();
    synthReplacements['customAgentOutputs'] = allCustomInsightsText.trim();
    synthReplacements['customInsights'] = allCustomInsightsText.trim();

    let customInsightsBlock = '';
    if (customAgentOutputs.length > 0) {
      customInsightsBlock = `\n\nCustom Agent Insights & Specialized Outputs:\n${customAgentOutputs
        .map((co) => `--- [Agent: ${co.name}] ---\n${co.output}`)
        .join('\n\n')}`;
    }
    if (visualDescList.length > 0) {
      customInsightsBlock += `\n\n[Visual Descriptions / Alt-Text for Images]:\n${visualDescList.join('\n\n')}`;
    }

    const sourcesListText = Array.isArray(researcherOutput?.sources) && researcherOutput.sources.length > 0
      ? researcherOutput.sources.map((s) => `- [${s.title}](${s.url}) (${s.domain || 'web'})`).join('\n')
      : 'No external sources retrieved.';

    const reviewerMissingList = Array.isArray(reviewerOutput?.missing) ? reviewerOutput.missing : [];
    const reviewerIssuesList = Array.isArray(reviewerOutput?.issues) ? reviewerOutput.issues : [];
    const reviewerRecommendation = reviewerOutput?.recommendation ? reviewerOutput.recommendation.trim() : '';

    const personalIdentityDirective = isPersonalOrHumanAiComparison(query)
      ? `\n\n[CRITICAL USER IDENTITY & ANTI-MISATTRIBUTION RULE]: The user asked a human vs AI / personal comparison ("${query}"). You must NEVER attribute any third-party stranger's identity, real name, LinkedIn profile, or personal background to the user. Present the synthesis as Human Intelligence vs Artificial Intelligence conceptually, objectively, and respectfully.`
      : '';

    const isSelfOrArchitectureQuery =
      isSelfQuery ||
      /\b(agents?|architecture|capabilities|what can you do|how many agents|who made you|how do you work)\b/i.test(query);

    const architectureReferenceDirective = isSelfOrArchitectureQuery && !isPersonalOrHumanAiComparison(query)
      ? `\n\n[JARVIS MULTI-AGENT ARCHITECTURE REFERENCE]:
JARVIS is a multi-agent AI intelligence platform composed of 9 specialized agents:
• 6 Core Pipeline Agents:
  1. Planner (Query analysis, task scoping, and dynamic agent orchestration)
  2. Researcher (Multi-engine live web search, news aggregation, and source retrieval)
  3. Fact Checker (Claim validation, date/number verification, and hallucination elimination)
  4. Advisor (Multi-perspective conceptual analysis, trade-off comparisons, and deep technical evaluation)
  5. Reviewer (Synthesis quality evaluation, source ranking, and scope enforcement)
  6. Final Synthesizer (Publication-grade intelligence integration and definitive response delivery)
• 3 Specialized Toggle-Based Visual & Analytical Agents:
  7. Architect (Interactive SVG diagram, workflow pipeline, and architecture blueprint generation via Diagram Mode)
  8. Data Analyst (Quantitative metric extraction and interactive Bar/Line chart generation via Chart Mode)
  9. Image Finder (Real-world product, landmark, and photographic image retrieval via Image Mode)
• Custom Agents: Support for user-defined custom specialized agents.
When answering questions about JARVIS's architecture, agent count, or capabilities, describe all 9 agents comprehensively.`
      : '';

    const webFetchContextBlock = isWebFetch
      ? (webFetchData
        ? `\n\n[DIRECT WEBPAGE EXTRACTION - ${webFetchData.url}]:
Title: ${webFetchData.title}
URL: ${webFetchData.finalUrl || webFetchData.url}
${webFetchData.description ? `Meta Description: ${webFetchData.description}\n` : ''}${webFetchData.headings && webFetchData.headings.length > 0 ? `Key Page Headings: ${webFetchData.headings.join(' • ')}\n` : ''}
Full Page Content Extracted (Read directly from target URL):
${webFetchData.textContent.slice(0, 18000)}

DIRECT WEBPAGE ANALYSIS DIRECTIVES:
- Provide a clear, thorough, and well-structured summary and analysis of this specific webpage's real content.
- Present the main thesis/purpose, key features, announcements, articles, documentation sections, or specifications found on the page.
- Do NOT search for other topics; ground your answer exclusively in the fetched page content above.
- Cite the source URL [${webFetchData.title}](${webFetchData.finalUrl || webFetchData.url}).`
        : `\n\n[DIRECT WEBPAGE FETCH FAILED]:
Target URL: ${targetWebUrl}
Fetch Error: ${webFetchError || 'Webpage could not be reached or parsed.'}

DIRECT WEBPAGE ERROR DIRECTIVES:
- Clearly and honestly state that the webpage at "${targetWebUrl}" could not be retrieved.
- Provide the failure reason (${webFetchError || 'unreachable or returned an error'}).
- Do NOT invent, speculate, or fabricate any contents about what might be on this page.`)
      : '';

    const rawSynthesizerContext = `Current date and time: ${currentDateTime}
User Query: "${strippedQuery}"
${webFetchContextBlock}
Planner Guidance: ${plannerPlanText}
${advisorOutput ? `Advisor Conceptual Analysis & Technical Comparison (General Knowledge):\n${advisorOutput}\n` : ''}
${factsList.length > 0 ? `Key Verified Facts:\n${factsList.map((f) => `- ${f}`).join('\n')}` : ''}
${verifiedList.length > 0 ? `Verified Claims:\n${verifiedList.map((c) => `- ${c}`).join('\n')}` : ''}
${issuesList.length > 0 ? `CRITICAL FACT-CHECKER CORRECTIONS / FLAGGED ISSUES (YOU MUST EXCLUDE AND REMOVE ANY CLAIM MENTIONED HERE FROM THE FINAL SYNTHESIS):\n${issuesList.map((i) => `- ${i}`).join('\n')}` : ''}
${reviewerMissingList.length > 0 ? `Reviewer Missing Context Suggestions:\n${reviewerMissingList.map((m) => `- ${m}`).join('\n')}` : ''}
${reviewerIssuesList.length > 0 ? `Reviewer Flagged Content/Scope Issues (EXCLUDE OR REPLACE ITEMS FLAGGED HERE):\n${reviewerIssuesList.map((iss) => `- ${iss}`).join('\n')}` : ''}
${reviewerRecommendation ? `Reviewer Actionable Guidance & Content Selection (HONOR THESE SELECTION & EXCLUSION INSTRUCTIONS):\n${reviewerRecommendation}` : ''}
Retrieved Ground-Truth Sources (CRITICAL RULE: Only cite sources from this exact list. Never invent or cite any other sources):
${sourcesListText}${customInsightsBlock}${personalIdentityDirective}${architectureReferenceDirective}`;

    const defaultSysPrompt = DEFAULT_AGENT_SYSTEM_PROMPTS.finalSynthesizer;
    let activeSysPrompt =
      sCfg.systemPrompt && sCfg.systemPrompt.trim()
        ? sCfg.systemPrompt.trim()
        : defaultSysPrompt;

    // Apply template variable substitution to system prompt & user context
    activeSysPrompt = applyTemplateVariables(activeSysPrompt, synthReplacements);

    // Clean up any remaining unreplaced {visualDescriptions} or similar placeholders cleanly
    activeSysPrompt = activeSysPrompt
      .replace(/\{\s*visualDescriptions\s*\}/gi, '')
      .replace(/\{\s*visual_descriptions\s*\}/gi, '')
      .replace(/\{\s*visualDescriber\s*\}/gi, '')
      .replace(/\{\s*visual_describer\s*\}/gi, '')
      .replace(/\{\s*customAgents\s*\}/gi, '')
      .replace(/\{\s*customAgentOutputs\s*\}/gi, '');

    const synthResponseLang = (typeof agentConfigs.planner?.responseLanguage === 'string' && agentConfigs.planner.responseLanguage.trim())
      ? agentConfigs.planner.responseLanguage.trim()
      : 'English';
    const synthLanguageInstruction = synthResponseLang.toLowerCase() !== 'english'
      ? `\n\nCRITICAL LANGUAGE REQUIREMENT: You MUST write and deliver your ENTIRE final response to the user in **${synthResponseLang}**. Do not reply in English unless ${synthResponseLang} is English.`
      : '';

    const fullSynthesizerSysPrompt = `Current date and time: ${currentDateTime}\n\n${activeSysPrompt}${synthLanguageInstruction}`;
    const finalizedSynthesizerContext = applyTemplateVariables(
      rawSynthesizerContext,
      synthReplacements,
    );

    const synthRes = await callAgent('finalSynthesizer', [
      {
        role: 'system',
        content: fullSynthesizerSysPrompt,
      },
      {
        role: 'user',
        content: `Please synthesize the definitive answer based on the following verified intelligence and agent outputs (including any visual descriptions, custom agent findings, or alt-texts):\n\n${finalizedSynthesizerContext}`,
      },
    ]);

    const duration = Date.now() - start;

    if (synthRes.ok && synthRes.text) {
      finalAnswer = synthRes.text;
      updateStep({
        agentId: 'finalSynthesizer',
        name: sCfg.name,
        icon: sCfg.icon,
        status: 'completed',
        providerName: synthRes.providerName,
        model: synthRes.model,
        durationMs: duration,
        summary: 'Final synthesis compiled and formatted.',
        outputPreview: finalAnswer,
        rawOutput: finalAnswer,
        usedFallback: synthRes.usedFallback,
      });
    } else {
      updateStep({
        agentId: 'finalSynthesizer',
        name: sCfg.name,
        icon: sCfg.icon,
        status: 'failed',
        providerName: synthRes.providerName,
        model: synthRes.model,
        durationMs: duration,
        error: synthRes.error || 'Final Synthesizer failed.',
      });
      if (researcherOutput.facts.length > 0) {
        finalAnswer = `### Key Intelligence & Findings\n\n${researcherOutput.facts.map((f) => `- ${f}`).join('\n')}`;
      } else if (factCheckOutput.verified.length > 0) {
        finalAnswer = `### Verified Claims\n\n${factCheckOutput.verified.map((v) => `- ${v}`).join('\n')}`;
      } else if (customAgentOutputs.length > 0) {
        finalAnswer = customAgentOutputs.map((c) => `### ${c.name}\n\n${c.output}`).join('\n\n');
      } else {
        finalAnswer = `### Intelligence Summary: ${query}\n\nProcessed query through the multi-agent pipeline. Provider failover completed across configured channels.`;
      }
    }
  }

  // Execute post-synthesizer custom agents if any (e.g. after_synthesizer)
  const postSynthCustomAgents = customAgents.filter(
    (ca) => ca.enabled && ca.pipelinePosition === 'after_synthesizer',
  );
  for (const cAgent of postSynthCustomAgents) {
    await executeCustomAgent(cAgent);
  }

  // ==========================================
  // STEP 6: 🏗️ ARCHITECT (SVG Diagram Generation)
  // ==========================================
  let diagramSvg: string | undefined = undefined;

  const hasDiagramIntent =
    Boolean(plannerOutput.needsDiagram) ||
    /\b(how|why|compare|versus|vs|architecture|system|process|flow|work|works|mechanism|sensor|circuit|pipeline|cycle|lifecycle|structure|component|hardware|engine|model|design|spec|specs|difference)\b/i.test(
      query,
    ) ||
    query.length > 20;

  const shouldArchitect =
    diagramMode &&
    hasDiagramIntent &&
    agentConfigs.architect &&
    agentConfigs.architect.enabled !== false;

  if (shouldArchitect) {
    const aCfg = agentConfigs.architect;
    const provInfo = resolveProviderConfig(aCfg);
    const start = Date.now();

    updateStep({
      agentId: 'architect',
      name: aCfg.name || 'Architect',
      icon: aCfg.icon || '🏗️',
      status: 'running',
      providerName: provInfo.provider?.name || 'Primary',
      model: provInfo.model,
    });

    const defaultPromptTemplate = DEFAULT_AGENT_SYSTEM_PROMPTS.architect;
    const factsList = Array.isArray(researcherOutput?.facts) ? researcherOutput.facts : [];
    const activePrompt = (aCfg.systemPrompt || defaultPromptTemplate)
      .replace('{task}', plannerOutput.task || query)
      .replace('{answer}', finalAnswer || factsList.slice(0, 5).join('\n'));

    console.group(`[JARVIS Architect] Generating SVG Blueprint for: "${query}"`);
    console.log(`[JARVIS Architect] Active Prompt:`, activePrompt);

    const archRes = await callAgent('architect', [
      {
        role: 'system',
        content:
          'You are the JARVIS Architect agent. You MUST finish the diagram completely, including a proper closing </svg> tag, within your token budget. If running low on space, immediately simplify remaining elements (fewer decorative details, shorter labels) rather than leaving any section unfinished or cut off. An unfinished diagram is a failure - always prioritize completing all planned sections over adding visual detail to early sections. Output ONLY valid, raw, clean SVG markup (starting with <svg and ending with </svg>) illustrating the concept. Do not include markdown code blocks, backticks, or extra text.',
      },
      { role: 'user', content: activePrompt },
    ]);

    const duration = Date.now() - start;
    console.log(`[JARVIS Architect] Raw Output (${archRes.model || 'AI'}):`, archRes.text || archRes.error);

    if (archRes.ok && archRes.text) {
      const extracted = extractSvgFromText(archRes.text);
      if (extracted) {
        diagramSvg = extracted;
        console.log(`[JARVIS Architect] Successfully extracted SVG diagram (${diagramSvg.length} bytes).`);
        console.groupEnd();

        updateStep({
          agentId: 'architect',
          name: aCfg.name || 'Architect',
          icon: aCfg.icon || '🏗️',
          status: 'completed',
          providerName: archRes.providerName,
          model: archRes.model,
          durationMs: duration,
          summary: 'Custom SVG architectural blueprint generated.',
          outputPreview: diagramSvg,
          rawOutput: diagramSvg,
          usedFallback: archRes.usedFallback,
        });
      } else {
        console.warn(`[JARVIS Architect] Model returned text without valid SVG tags. Generating concept blueprint fallback...`);
        diagramSvg = generateConceptBlueprintSvg(query, finalAnswer || researcherOutput.facts.join('\n'));
        console.groupEnd();

        updateStep({
          agentId: 'architect',
          name: aCfg.name || 'Architect',
          icon: aCfg.icon || '🏗️',
          status: 'completed',
          providerName: archRes.providerName,
          model: archRes.model,
          durationMs: duration,
          summary: 'Architectural blueprint synthesized via concept generator.',
          outputPreview: diagramSvg,
          rawOutput: diagramSvg,
          usedFallback: true,
        });
      }
    } else {
      console.warn(`[JARVIS Architect] Provider call encountered issue: "${archRes.error}". Generating resilient concept blueprint...`);
      console.groupEnd();

      // Ensure user always gets a diagram when Diagram Mode is requested, even if the external LLM is slow
      diagramSvg = generateConceptBlueprintSvg(query, finalAnswer || researcherOutput.facts.join('\n'));

      updateStep({
        agentId: 'architect',
        name: aCfg.name || 'Architect',
        icon: aCfg.icon || '🏗️',
        status: 'completed',
        providerName: archRes.providerName || 'Local Synthesizer',
        model: archRes.model || 'blueprint-engine',
        durationMs: duration,
        summary: `Architectural blueprint synthesized (${archRes.error ? `Provider notice: ${archRes.error}` : 'Synthesizer fallback'}).`,
        outputPreview: diagramSvg,
        rawOutput: diagramSvg,
        usedFallback: true,
      });
    }
  }

  // ==========================================
  // STEP 7: 📊 DATA ANALYST (Chart & Statistical Extraction)
  // ==========================================
  let chartData: JarvisChartData | null = null;

  const hasNumericIntent =
    Boolean(plannerOutput.needsChart) ||
    /\b(compare|versus|vs|spec|specs|specification|battery|mah|ram|gb|tb|storage|camera|mp|megapixels?|price|cost|\$|dollar|euro|weight|dimension|speed|ghz|mhz|hz|fps|benchmark|score|sales|revenue|growth|gdp|rate|percent|%|capacity|numbers?|statistics?|metrics?|trends?|table)\b/i.test(
      query,
    ) ||
    query.length > 20;

  const shouldDataAnalyst =
    chartMode &&
    hasNumericIntent &&
    agentConfigs.dataAnalyst &&
    agentConfigs.dataAnalyst.enabled !== false;

  if (shouldDataAnalyst) {
    const daCfg = agentConfigs.dataAnalyst;
    const provInfo = resolveProviderConfig(daCfg);
    const start = Date.now();

    updateStep({
      agentId: 'dataAnalyst',
      name: daCfg.name || 'Data Analyst',
      icon: daCfg.icon || '📊',
      status: 'running',
      providerName: provInfo.provider?.name || 'Primary',
      model: provInfo.model,
    });

    const defaultPromptTemplate = DEFAULT_AGENT_SYSTEM_PROMPTS.dataAnalyst;
    const factsList = Array.isArray(researcherOutput?.facts) ? researcherOutput.facts : [];
    const fallbackContext = finalAnswer || factsList.slice(0, 8).join('\n');
    const activePrompt = (daCfg.systemPrompt || defaultPromptTemplate)
      .replace('{task}', plannerOutput.task || query)
      .replace('{content}', fallbackContext);

    console.group(`[JARVIS Data Analyst] Extracting Chart Data for: "${query}"`);
    console.log(`[JARVIS Data Analyst] Active Prompt:`, activePrompt);

    const daRes = await callAgent('dataAnalyst', [
      {
        role: 'system',
        content:
          'You are the JARVIS Data Analyst agent. Inspect markdown tables, specifications, and bullet comparisons. Extract quantitative comparative statistics and metrics into valid chart JSON with chartType ("bar" or "line"), title, series (array of {name, values}), and labels (array of string category/item names). Output ONLY valid, parseable JSON. Do not include extra text.',
      },
      { role: 'user', content: activePrompt },
    ]);

    const duration = Date.now() - start;
    console.log(`[JARVIS Data Analyst] Raw Output (${daRes.model || 'AI'}):`, daRes.text || daRes.error);

    const contextForTableFallback = finalAnswer || factsList.join('\n');

    if (daRes.ok && daRes.text) {
      const extracted = extractChartDataFromText(daRes.text, contextForTableFallback, plannerOutput.task || query);
      if (extracted && Array.isArray(extracted.series) && extracted.series.length > 0 && Array.isArray(extracted.labels) && extracted.labels.length > 0) {
        chartData = extracted;
        console.log(`[JARVIS Data Analyst] Successfully extracted chart data:`, chartData);
        console.groupEnd();

        updateStep({
          agentId: 'dataAnalyst',
          name: daCfg.name || 'Data Analyst',
          icon: daCfg.icon || '📊',
          status: 'completed',
          providerName: daRes.providerName,
          model: daRes.model,
          durationMs: duration,
          summary: `Quantitative chart extracted: "${chartData.title || 'Data Analysis'}" (${chartData.series?.length || 0} series, ${chartData.labels?.length || 0} points).`,
          outputPreview: JSON.stringify(chartData, null, 2),
          rawOutput: daRes.text || JSON.stringify(chartData, null, 2),
          usedFallback: daRes.usedFallback,
        });
      } else {
        // Direct markdown table parsing fallback
        const tableFallback = extractChartDataFromMarkdownTable(contextForTableFallback, plannerOutput.task || query) ||
                              extractChartDataFromBulletPoints(contextForTableFallback, plannerOutput.task || query);
        if (tableFallback && Array.isArray(tableFallback.series) && tableFallback.series.length > 0) {
          chartData = tableFallback;
          console.log(`[JARVIS Data Analyst] Extracted chart from markdown table fallback:`, chartData);
          console.groupEnd();

          updateStep({
            agentId: 'dataAnalyst',
            name: daCfg.name || 'Data Analyst',
            icon: daCfg.icon || '📊',
            status: 'completed',
            providerName: daRes.providerName || 'Local Table Parser',
            model: daRes.model || 'markdown-table-engine',
            durationMs: duration,
            summary: `Comparative chart parsed from specifications table: "${chartData.title || 'Data Analysis'}" (${chartData.series?.length || 0} series, ${chartData.labels?.length || 0} points).`,
            outputPreview: JSON.stringify(chartData, null, 2),
            rawOutput: JSON.stringify(chartData, null, 2),
            usedFallback: true,
          });
        } else {
          console.warn(`[JARVIS Data Analyst] No numeric series detected.`);
          console.groupEnd();

          updateStep({
            agentId: 'dataAnalyst',
            name: daCfg.name || 'Data Analyst',
            icon: daCfg.icon || '📊',
            status: 'skipped',
            providerName: daRes.providerName,
            model: daRes.model,
            durationMs: duration,
            summary: 'No distinct comparative numeric series detected in synthesized content.',
          });
        }
      }
    } else {
      // If provider call failed, attempt resilient markdown table fallback
      const tableFallback = extractChartDataFromMarkdownTable(contextForTableFallback, plannerOutput.task || query) ||
                            extractChartDataFromBulletPoints(contextForTableFallback, plannerOutput.task || query);
      if (tableFallback && Array.isArray(tableFallback.series) && tableFallback.series.length > 0) {
        chartData = tableFallback;
        console.log(`[JARVIS Data Analyst] Extracted chart from markdown table fallback after provider notice:`, chartData);
        console.groupEnd();

        updateStep({
          agentId: 'dataAnalyst',
          name: daCfg.name || 'Data Analyst',
          icon: daCfg.icon || '📊',
          status: 'completed',
          providerName: daRes.providerName || 'Local Table Parser',
          model: daRes.model || 'markdown-table-engine',
          durationMs: duration,
          summary: `Comparative chart parsed from specifications: "${chartData.title || 'Data Analysis'}" (${chartData.series?.length || 0} series, ${chartData.labels?.length || 0} points).`,
          outputPreview: JSON.stringify(chartData, null, 2),
          rawOutput: JSON.stringify(chartData, null, 2),
          usedFallback: true,
        });
      } else {
        console.warn(`[JARVIS Data Analyst] Provider call notice: ${daRes.error}`);
        console.groupEnd();

        updateStep({
          agentId: 'dataAnalyst',
          name: daCfg.name || 'Data Analyst',
          icon: daCfg.icon || '📊',
          status: 'skipped',
          providerName: daRes.providerName,
          model: daRes.model,
          durationMs: duration,
          summary: `Data analysis skipped (${daRes.error || 'Provider unavailable'}).`,
        });
      }
    }
  }

  // ==========================================
  // STEP 8: 🖼️ IMAGE FINDER (Real Photo Sourcing)
  // ==========================================
  let retrievedImages: JarvisImageResult[] = [];

  const hasImageIntent =
    Boolean(plannerOutput.needsImage) ||
    /\b(iphone|galaxy|samsung|pixel|apple|google|phone|smartphone|laptop|macbook|gpu|cpu|camera|sensor|car|ev|tesla|vehicle|telescope|building|architecture|animal|space|galaxy|nebula|planet|star|device|hardware|product|look|photo|image|picture|what does|show me)\b/i.test(
      query,
    ) ||
    query.length > 20;

  const shouldImageFinder =
    imageMode &&
    hasImageIntent &&
    agentConfigs.imageFinder &&
    agentConfigs.imageFinder.enabled !== false;

  if (shouldImageFinder) {
    const ifCfg = agentConfigs.imageFinder;
    const provInfo = resolveProviderConfig(ifCfg);
    const start = Date.now();

    updateStep({
      agentId: 'imageFinder',
      name: ifCfg.name || 'Image Finder',
      icon: ifCfg.icon || '🖼️',
      status: 'running',
      providerName: provInfo.provider?.name || 'Primary',
      model: provInfo.model,
    });

    const defaultPromptTemplate = DEFAULT_AGENT_SYSTEM_PROMPTS.imageFinder;
    const activePrompt = (ifCfg.systemPrompt || defaultPromptTemplate)
      .replace('{task}', plannerOutput.task || query);

    console.group(`[JARVIS Image Finder] Formulating Image Search Query for: "${query}"`);
    console.log(`[JARVIS Image Finder] Active Prompt:`, activePrompt);

    const ifRes = await callAgent('imageFinder', [
      {
        role: 'system',
        content:
          'You are the JARVIS Image Finder agent. Output ONLY a valid JSON object with {"searchQuery": "short specific search query"}. Do not include markdown or explanations.',
      },
      { role: 'user', content: activePrompt },
    ]);

    const duration = Date.now() - start;
    console.log(`[JARVIS Image Finder] Raw Output (${ifRes.model || 'AI'}):`, ifRes.text || ifRes.error);

    let searchQuery = '';
    if (ifRes.ok && ifRes.text) {
      searchQuery = extractImageQueryFromText(ifRes.text) || '';
    }
    if (!searchQuery) {
      // Fallback: clean the query of question/command phrases
      searchQuery = (plannerOutput.task || query)
        .replace(/^(what is|what does|show me|photos of|pictures of|images of|a photo of|an image of|compare)\s+/i, '')
        .replace(/\b(look like|look|specs|specifications)\b/i, '')
        .trim();
    }

    console.log(`[JARVIS Image Finder] Executing NEXUS image search for: "${searchQuery}"`);
    try {
      retrievedImages = await fetchJarvisRealImages(searchQuery);
    } catch (fetchErr) {
      console.warn('[JARVIS Image Finder] Image retrieval failed:', fetchErr);
    }

    console.log(`[JARVIS Image Finder] Retrieved ${retrievedImages.length} real photo(s).`);
    console.groupEnd();

    if (retrievedImages.length > 0) {
      updateStep({
        agentId: 'imageFinder',
        name: ifCfg.name || 'Image Finder',
        icon: ifCfg.icon || '🖼️',
        status: 'completed',
        providerName: ifRes.providerName,
        model: ifRes.model,
        durationMs: duration,
        summary: `Retrieved ${retrievedImages.length} real photo${retrievedImages.length > 1 ? 's' : ''} for "${searchQuery}".`,
        outputPreview: JSON.stringify(
          retrievedImages.map((img) => ({
            title: img.title,
            domain: img.domain,
            url: img.url,
            author: img.author,
          })),
          null,
          2,
        ),
        rawOutput: JSON.stringify(
          retrievedImages.map((img) => ({
            title: img.title,
            domain: img.domain,
            url: img.url,
            author: img.author,
          })),
          null,
          2,
        ),
        usedFallback: ifRes.usedFallback,
      });
    } else {
      updateStep({
        agentId: 'imageFinder',
        name: ifCfg.name || 'Image Finder',
        icon: ifCfg.icon || '🖼️',
        status: 'skipped',
        providerName: ifRes.providerName,
        model: ifRes.model,
        durationMs: duration,
        summary: `No high-confidence real photos found for "${searchQuery}".`,
      });
    }
  }

  const cleanedFinalAnswer = stripConversationalMetaText(finalAnswer);

  return {
    answer: cleanedFinalAnswer,
    steps,
    sources: sourcesCollected,
    diagramSvg,
    chartData,
    images: retrievedImages,
  };
}
