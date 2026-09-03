import type { SearchResult, WikidataEntity } from '@/types';

const WIKIDATA_USER_AGENT = 'NEXUS-Intelligence/1.0 (https://nexus.app; contact: dk959709@gmail.com)';

// In-memory cache for Wikidata responses
const entityCache = new Map<string, { timestamp: number; entity: WikidataEntity | null }>();
const searchCache = new Map<string, { timestamp: number; results: Array<{ id: string; label: string; description?: string; url: string }> }>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

// Map of common Wikidata property IDs to human-readable labels
const KNOWN_PROPERTIES: Record<string, string> = {
  P31: 'instance of',
  P279: 'subclass of',
  P36: 'capital',
  P1082: 'population',
  P569: 'date of birth',
  P570: 'date of death',
  P19: 'place of birth',
  P20: 'place of death',
  P27: 'country of citizenship',
  P17: 'country',
  P112: 'founded by',
  P571: 'inception / founded date',
  P169: 'CEO',
  P35: 'head of state',
  P6: 'head of government',
  P138: 'named after',
  P2046: 'area',
  P2044: 'elevation',
  P2047: 'duration',
  P2048: 'height',
  P108: 'employer',
  P69: 'educated at',
  P166: 'award received',
  P170: 'creator',
  P50: 'author',
  P57: 'director',
  P176: 'manufacturer',
  P178: 'developer',
  P275: 'license',
  P856: 'official website',
  P625: 'coordinate location',
  P2111: 'value',
};

/**
 * Clean and extract search candidates from natural language questions
 */
function extractSubjectCandidates(rawQuery: string): string[] {
  const trimmed = rawQuery.trim();
  const candidates: string[] = [];

  if (!trimmed) return candidates;

  candidates.push(trimmed);

  // Strip leading slash commands like /search or /web if present
  const withoutSlash = trimmed.replace(/^\/(?:search|web)\s+/i, '').trim();
  if (withoutSlash && withoutSlash !== trimmed) {
    candidates.push(withoutSlash);
  }

  // Strip common conversational question preambles
  const cleaned = withoutSlash
    .replace(/^(?:what is|what are|who is|who are|who was|who were|when was|when were|where is|where was|how many|what's|tell me about|find the)\s+/i, '')
    .replace(/[?!.]+$/, '')
    .trim();

  if (cleaned && !candidates.includes(cleaned)) {
    candidates.push(cleaned);
  }

  // Handle patterns like "capital of France" -> "France", "population of Tokyo" -> "Tokyo", "founder of Apple" -> "Apple"
  const ofMatch = cleaned.match(/(?:capital|population|founder|founders|ceo|president|currency|birthplace|author|creator|manufacturer|area|elevation|speed|height)\s+of\s+([^,]+)/i);
  if (ofMatch && ofMatch[1]?.trim()) {
    const extracted = ofMatch[1].trim();
    if (!candidates.includes(extracted)) {
      candidates.push(extracted);
    }
  }

  // Handle patterns like "France's capital" -> "France"
  const possessiveMatch = cleaned.match(/^([A-Za-z0-9\s]+)'s\s+/i);
  if (possessiveMatch && possessiveMatch[1]?.trim()) {
    const extracted = possessiveMatch[1].trim();
    if (!candidates.includes(extracted)) {
      candidates.push(extracted);
    }
  }

  return candidates;
}

/**
 * Search Wikidata entities using wbsearchentities API
 */
export async function searchWikidata(
  query: string,
  limit = 5,
): Promise<Array<{ id: string; label: string; description?: string; url: string }>> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const cacheKey = `${trimmed.toLowerCase()}_${limit}`;
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.results;
  }

  try {
    const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(
      trimmed,
    )}&language=en&format=json&limit=${limit}&origin=*`;

    const res = await fetch(url, {
      headers: {
        'Api-User-Agent': WIKIDATA_USER_AGENT,
        'User-Agent': WIKIDATA_USER_AGENT,
      },
    });

    if (!res.ok) {
      throw new Error(`Wikidata search failed with status ${res.status}`);
    }

    const data = (await res.json()) as {
      search?: Array<{
        id: string;
        label: string;
        description?: string;
        url?: string;
        concepturi?: string;
      }>;
    };

    const results = (data.search ?? []).map((item) => ({
      id: item.id,
      label: item.label,
      description: item.description,
      url: item.concepturi || (item.url ? `https:${item.url}` : `https://www.wikidata.org/wiki/${item.id}`),
    }));

    searchCache.set(cacheKey, { timestamp: Date.now(), results });
    return results;
  } catch (err) {
    console.error('[Wikidata Service] searchWikidata error:', err);
    return [];
  }
}

/**
 * Format a raw datavalue from a Wikidata claim snak into a readable string
 */
function formatClaimValue(datavalue: unknown): { text: string; entityId?: string } | null {
  if (!datavalue || typeof datavalue !== 'object') return null;

  const dv = datavalue as {
    type?: string;
    value?: unknown;
  };

  if (!dv.type || dv.value === undefined || dv.value === null) return null;

  if (dv.type === 'string') {
    return { text: String(dv.value) };
  }

  if (dv.type === 'monolingualtext') {
    const valObj = dv.value as { text?: string };
    return valObj.text ? { text: valObj.text } : null;
  }

  if (dv.type === 'wikibase-entityid') {
    const valObj = dv.value as { id?: string };
    if (valObj.id) {
      return { text: valObj.id, entityId: valObj.id };
    }
  }

  if (dv.type === 'time') {
    const valObj = dv.value as { time?: string };
    if (valObj.time) {
      // E.g. "+1879-03-14T00:00:00Z" -> "1879-03-14"
      const match = valObj.time.match(/^[+-]?(\d{1,4}-\d{2}-\d{2})/);
      if (match) {
        return { text: match[1].replace(/^0+/, '') };
      }
      const yearMatch = valObj.time.match(/^[+-]?(\d{1,4})/);
      if (yearMatch) {
        return { text: yearMatch[1] };
      }
      return { text: valObj.time };
    }
  }

  if (dv.type === 'quantity') {
    const valObj = dv.value as { amount?: string; unit?: string };
    if (valObj.amount) {
      const num = parseFloat(valObj.amount);
      if (!isNaN(num)) {
        return { text: num.toLocaleString('en-US') };
      }
      return { text: valObj.amount.replace(/^\+/, '') };
    }
  }

  if (dv.type === 'globecoordinate') {
    const valObj = dv.value as { latitude?: number; longitude?: number };
    if (typeof valObj.latitude === 'number' && typeof valObj.longitude === 'number') {
      return { text: `${valObj.latitude.toFixed(4)}°, ${valObj.longitude.toFixed(4)}°` };
    }
  }

  return null;
}

/**
 * Fetch detailed Wikidata entity information by entity ID or query
 */
export async function getWikidataEntity(titleOrQuery: string): Promise<WikidataEntity | null> {
  const trimmed = titleOrQuery.trim();
  if (!trimmed) return null;

  const cacheKey = trimmed.toLowerCase();
  const cached = entityCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.entity;
  }

  try {
    let targetEntityId: string | null = null;
    let initialLabel = '';
    let initialDescription = '';

    // Direct Q-number ID (e.g. Q937)
    if (/^Q\d+$/i.test(trimmed)) {
      targetEntityId = trimmed.toUpperCase();
    } else {
      // Search for candidate entity
      const candidateQueries = extractSubjectCandidates(trimmed);

      for (const query of candidateQueries) {
        const results = await searchWikidata(query, 3);
        if (results.length > 0 && results[0]?.id) {
          targetEntityId = results[0].id;
          initialLabel = results[0].label;
          initialDescription = results[0].description || '';
          break;
        }
      }
    }

    if (!targetEntityId) {
      entityCache.set(cacheKey, { timestamp: Date.now(), entity: null });
      return null;
    }

    // Fetch entity props from Wikidata
    const detailsUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${targetEntityId}&props=labels|descriptions|aliases|claims|sitelinks&languages=en&sitefilter=enwiki&format=json&origin=*`;

    const res = await fetch(detailsUrl, {
      headers: {
        'Api-User-Agent': WIKIDATA_USER_AGENT,
        'User-Agent': WIKIDATA_USER_AGENT,
      },
    });

    if (!res.ok) {
      throw new Error(`Wikidata wbgetentities failed with status ${res.status}`);
    }

    const data = (await res.json()) as {
      entities?: Record<
        string,
        {
          id: string;
          labels?: { en?: { value: string } };
          descriptions?: { en?: { value: string } };
          aliases?: { en?: Array<{ value: string }> };
          sitelinks?: { enwiki?: { title: string } };
          claims?: Record<
            string,
            Array<{
              mainsnak?: {
                snaktype?: string;
                property?: string;
                datavalue?: unknown;
              };
            }>
          >;
        }
      >;
    };

    const rawEntity = data.entities?.[targetEntityId];
    if (!rawEntity) {
      entityCache.set(cacheKey, { timestamp: Date.now(), entity: null });
      return null;
    }

    const label = rawEntity.labels?.en?.value || initialLabel || targetEntityId;
    const description = rawEntity.descriptions?.en?.value || initialDescription || undefined;
    const aliases = (rawEntity.aliases?.en ?? []).map((a) => a.value).filter(Boolean);
    const wikipediaTitle = rawEntity.sitelinks?.enwiki?.title;
    const wikipediaUrl = wikipediaTitle
      ? `https://en.wikipedia.org/wiki/${encodeURIComponent(wikipediaTitle.replace(/ /g, '_'))}`
      : undefined;

    // Parse and group key claims
    const rawClaims = rawEntity.claims || {};
    const extractedClaims: Record<string, string[]> = {};
    const entityIdsToResolve = new Set<string>();

    // Scan prioritized properties
    const propertyEntries = Object.entries(rawClaims);
    for (const [propId, statements] of propertyEntries) {
      const propLabel = KNOWN_PROPERTIES[propId] || propId;
      const values: string[] = [];

      // Sort statements: preferred first, then normal, skip deprecated
      const validStatements = (statements || []).filter(
        (s) => s.rank !== 'deprecated' && s.mainsnak?.snaktype === 'value' && s.mainsnak.datavalue
      );

      validStatements.sort((a, b) => {
        if (a.rank === 'preferred' && b.rank !== 'preferred') return -1;
        if (b.rank === 'preferred' && a.rank !== 'preferred') return 1;
        return 0;
      });

      // Keep top 1 or 2 values per property to keep output crisp and factual
      const maxVals = (propId === 'P36' || propId === 'P1082' || propId === 'P569' || propId === 'P570' || propId === 'P19' || propId === 'P112') ? 2 : 3;

      for (const stmt of validStatements.slice(0, maxVals)) {
        if (stmt.mainsnak?.datavalue) {
          const parsed = formatClaimValue(stmt.mainsnak.datavalue);
          if (parsed && !values.includes(parsed.text)) {
            values.push(parsed.text);
            if (parsed.entityId) {
              entityIdsToResolve.add(parsed.entityId);
            }
          }
        }
      }

      if (values.length > 0) {
        extractedClaims[propLabel] = values;
      }
    }

    // Batch resolve entity IDs (e.g. Q90 -> Paris) to human-readable names
    if (entityIdsToResolve.size > 0) {
      const idsToFetch = Array.from(entityIdsToResolve).slice(0, 20).join('|');
      try {
        const resolveUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${idsToFetch}&props=labels&languages=en&format=json&origin=*`;
        const resolveRes = await fetch(resolveUrl, {
          headers: {
            'Api-User-Agent': WIKIDATA_USER_AGENT,
            'User-Agent': WIKIDATA_USER_AGENT,
          },
        });

        if (resolveRes.ok) {
          const resolveData = (await resolveRes.json()) as {
            entities?: Record<string, { labels?: { en?: { value: string } } }>;
          };

          const labelMap: Record<string, string> = {};
          if (resolveData.entities) {
            for (const [eId, eData] of Object.entries(resolveData.entities)) {
              if (eData.labels?.en?.value) {
                labelMap[eId] = eData.labels.en.value;
              }
            }
          }

          // Replace entity IDs with their resolved English names
          for (const [propName, vals] of Object.entries(extractedClaims)) {
            extractedClaims[propName] = vals.map((val) => {
              if (labelMap[val]) {
                return `${labelMap[val]} (${val})`;
              }
              return val;
            });
          }
        }
      } catch (resErr) {
        console.warn('[Wikidata Service] Failed to batch resolve entity labels:', resErr);
      }
    }

    const entity: WikidataEntity = {
      id: targetEntityId,
      label,
      description,
      aliases: aliases.length > 0 ? aliases : undefined,
      url: `https://www.wikidata.org/wiki/${targetEntityId}`,
      wikipediaTitle,
      wikipediaUrl,
      claims: Object.keys(extractedClaims).length > 0 ? extractedClaims : undefined,
    };

    entityCache.set(cacheKey, { timestamp: Date.now(), entity });
    return entity;
  } catch (err) {
    console.error('[Wikidata Service] getWikidataEntity error:', err);
    return null;
  }
}

/**
 * Format Wikidata response into the required report section format
 */
export function formatWikidataForReport(entity: WikidataEntity | null): string {
  if (!entity) {
    return `=== WIKIDATA ===\nno entry found`;
  }

  const lines: string[] = ['=== WIKIDATA ==='];
  lines.push(`Entity: ${entity.label} (${entity.id})`);
  if (entity.description) {
    lines.push(`Description: ${entity.description}`);
  }
  if (entity.aliases && entity.aliases.length > 0) {
    lines.push(`Aliases: ${entity.aliases.slice(0, 5).join(', ')}`);
  }

  if (entity.claims && Object.keys(entity.claims).length > 0) {
    lines.push('Key Facts / Statements:');
    // Prioritize prominent properties
    const priorityKeys = [
      'instance of',
      'capital',
      'population',
      'date of birth',
      'date of death',
      'place of birth',
      'country',
      'head of state',
      'head of government',
      'founded by',
      'inception / founded date',
      'CEO',
      'author',
      'creator',
      'official website',
    ];

    const sortedProps = Object.keys(entity.claims).sort((a, b) => {
      const idxA = priorityKeys.indexOf(a);
      const idxB = priorityKeys.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });

    for (const prop of sortedProps.slice(0, 10)) {
      const vals = entity.claims[prop];
      if (vals && vals.length > 0) {
        lines.push(`- ${prop}: ${vals.join(', ')}`);
      }
    }
  }

  lines.push(`URL: ${entity.url}`);
  if (entity.wikipediaUrl) {
    lines.push(`Wikipedia: ${entity.wikipediaUrl}`);
  }

  return lines.join('\n');
}

/**
 * Convert Wikidata entity into the NEXUS unified SearchResult type
 */
export function wikidataToSearchResult(entity: WikidataEntity): SearchResult {
  const statementHighlights = entity.claims
    ? Object.entries(entity.claims)
        .slice(0, 4)
        .map(([k, v]) => `${k}: ${v.join(', ')}`)
        .join('; ')
    : '';

  const description = [entity.description, statementHighlights].filter(Boolean).join(' • ');

  return {
    title: `${entity.label} (${entity.id}) - Wikidata`,
    url: entity.url,
    domain: 'wikidata.org',
    description: description || `Wikidata structured knowledge item for ${entity.label}`,
    type: 'wikidata' as 'wikipedia',
  };
}
