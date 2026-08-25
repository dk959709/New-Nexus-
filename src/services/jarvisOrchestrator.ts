import { api } from '@/services/api';
import { storage, DEFAULT_AGENT_SYSTEM_PROMPTS } from '@/lib/storage';
import type {
  AIProviderConfig,
  AISource,
  JarvisAgentConfig,
  JarvisAgentId,
  JarvisExecutionStep,
  JarvisSystemConfig,
} from '@/types';

export interface JarvisExecutionResult {
  answer: string;
  steps: JarvisExecutionStep[];
  sources: AISource[];
  diagramSvg?: string;
  error?: string;
}

export interface StepUpdateCallback {
  (step: JarvisExecutionStep): void;
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
): { provider: AIProviderConfig | null; model: string; error?: string } {
  const providerId = isFallback ? agentConfig.fallbackProviderId : agentConfig.providerId;
  const modelId = isFallback ? agentConfig.fallbackModelId : agentConfig.modelId;

  if (!providerId || providerId === 'existing') {
    return {
      provider: {
        id: 'existing',
        name: 'Built-in AI',
        url: '',
        model: modelId || 'deepseek/deepseek-chat',
        keyStrategy: 'failover',
        keys: [],
        capabilities: { text: true, tools: true, web: true, wikipedia: true, memory: true },
        maxTokens: agentConfig.maxTokens,
      },
      model: modelId || 'deepseek/deepseek-chat',
    };
  }

  const state = storage.getAIProvidersState();
  const matched = state.providers.find((p) => p.id === providerId);

  if (!matched) {
    return {
      provider: null,
      model: modelId || '',
      error: `Configured provider "${providerId}" not found in AI Providers settings.`,
    };
  }

  const customConfig: AIProviderConfig = {
    ...matched,
    model: modelId || matched.model,
    maxTokens: agentConfig.maxTokens,
  };

  return {
    provider: customConfig,
    model: customConfig.model,
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

    // Pass C: Strip trailing commas and normalize smart quotes
    const sanitized = toParse
      .replace(/,\s*([}\]])/g, '$1')
      .replace(/[\u201C\u201D]/g, '"')
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

export interface ResearcherParsedOutput {
  facts: string[];
  sources: Array<{ title: string; url: string; domain?: string }>;
  notes?: string;
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
    if (typeof item === 'string') {
      return item.trim().replace(/^["']|["']$/g, '');
    }
    if (typeof item === 'object' && item !== null) {
      const obj = item as Record<string, unknown>;
      const candidate =
        obj.fact ||
        obj.text ||
        obj.statement ||
        obj.claim ||
        obj.content ||
        obj.point ||
        obj.description ||
        obj.title ||
        obj.value;
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim();
      }
      return JSON.stringify(item);
    }
    if (typeof item === 'number' || typeof item === 'boolean') {
      return String(item);
    }
    return '';
  };

  // Helper to populate facts from array
  const populateFactsFromArray = (arr: unknown[]) => {
    if (!Array.isArray(arr)) return;
    for (const item of arr) {
      const cleaned = cleanFactItem(item);
      if (cleaned && cleaned.length > 3 && !result.facts.includes(cleaned)) {
        result.facts.push(cleaned);
      }
    }
  };

  // Helper to inspect parsed object
  const extractFromObject = (data: Record<string, unknown>) => {
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
      'items',
      'insights',
      'data',
      'verified_facts',
    ];

    for (const key of possibleFactKeys) {
      if (Array.isArray(data[key]) && (data[key] as unknown[]).length > 0) {
        populateFactsFromArray(data[key] as unknown[]);
        break;
      }
    }

    // If facts is a string with newlines or bullets
    if (result.facts.length === 0) {
      for (const key of possibleFactKeys) {
        if (typeof data[key] === 'string' && (data[key] as string).trim()) {
          const lines = (data[key] as string)
            .split(/\r?\n/)
            .map((l) => l.replace(/^[\s*•\-#\d.)\]:]+/, '').trim())
            .filter((l) => l.length > 8);
          if (lines.length > 0) {
            lines.forEach((l) => {
              if (!result.facts.includes(l)) result.facts.push(l);
            });
            break;
          }
        }
      }
    }

    // Check nested objects (e.g. data.research.facts or data.researcher.facts)
    if (result.facts.length === 0) {
      const nestedContainers = ['research', 'researcher', 'output', 'response', 'result'];
      for (const containerKey of nestedContainers) {
        if (typeof data[containerKey] === 'object' && data[containerKey] !== null) {
          extractFromObject(data[containerKey] as Record<string, unknown>);
          if (result.facts.length > 0) break;
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
            const url = String(sobj.url || sobj.link || sobj.uri || '').trim();
            const domain = String(sobj.domain || '').trim();
            if (title || url) {
              result.sources.push({
                title: title || domain || url,
                url: url || (domain ? `https://${domain}` : ''),
                domain: domain || (url && url.startsWith('http') ? new URL(url).hostname.replace(/^www\./, '') : undefined),
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
      populateFactsFromArray(parsed);
    } else if (typeof parsed === 'object' && parsed !== null) {
      extractFromObject(parsed as Record<string, unknown>);
    }
  }

  // 2. Fallback text parsing if JSON returned 0 facts (e.g. model output plain text with bullets)
  if (result.facts.length === 0) {
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
          result.facts.push(candidate);
        }
      }
    }

    // If still empty and text is substantial, split into clean sentences
    if (result.facts.length === 0 && text.length > 25) {
      const stripped = text
        .replace(/```[\s\S]*?```/g, '')
        .replace(/[{}[\]"]/g, '')
        .replace(/facts?:/gi, '')
        .replace(/sources?:[\s\S]*$/gi, '');
      const sentences = stripped
        .split(/(?<=[.!?])\s+/)
        .map((s) => s.trim())
        .filter(
          (s) =>
            s.length > 15 &&
            !/^(here are|i have|in summary|based on|as an ai|below are)/i.test(s),
        );
      if (sentences.length > 0) {
        result.facts = sentences.slice(0, 7);
      }
    }
  }

  // 3. Fallback to gathered search snippets if LLM produced 0 facts
  if (result.facts.length === 0 && fallbackSources.length > 0) {
    fallbackSources.forEach((s) => {
      if (s.description && s.description.trim().length > 15) {
        const snippetFact = `${s.title ? `[${s.title}] ` : ''}${s.description.trim()}`;
        if (!result.facts.includes(snippetFact)) {
          result.facts.push(snippetFact);
        }
      }
    });
  }

  return result;
}

export async function runJarvisPipeline(
  query: string,
  config: JarvisSystemConfig,
  deepResearch = false,
  diagramMode = false,
  onStepUpdate?: StepUpdateCallback,
): Promise<JarvisExecutionResult> {
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

  const agentConfigs = config.agents;
  const customAgents = (config.customAgents || []).filter((ca) => ca && ca.id);

  const getAgentConfig = (agentId: string): JarvisAgentConfig | null => {
    if (agentConfigs[agentId as keyof typeof agentConfigs]) {
      return agentConfigs[agentId as keyof typeof agentConfigs];
    }
    const custom = customAgents.find((c) => c.id === agentId);
    return custom || null;
  };

  // Initialize step statuses for default 5 agents
  const defaultAgentOrder: JarvisAgentId[] = [
    'planner',
    'researcher',
    'factChecker',
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

    const primary = resolveProviderConfig(cfg, false);
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
      const fb = resolveProviderConfig(cfg, true);
      if (!fb.error && fb.provider) {
        fallbackConfig = fb.provider;
      }
    }

    const effectiveMaxTokens =
      agentId === 'architect'
        ? Math.max(cfg.maxTokens || 2400, 2048)
        : cfg.maxTokens;
    const effectiveTimeoutMs = agentId === 'architect' ? 65000 : 35000;

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

    const sysPrompt =
      cAgent.systemPrompt && cAgent.systemPrompt.trim()
        ? cAgent.systemPrompt.trim()
        : `You are the ${cAgent.name} agent (${cAgent.role || 'Specialized Agent'}). ${cAgent.description || ''}`;

    const contextPayload = `User Query: "${query}"
Task Context: "${plannerOutput.task || query}"
${researcherOutput.facts.length > 0 ? `Collected Research Facts:\n${researcherOutput.facts.map((f, i) => `${i + 1}. ${f}`).join('\n')}` : ''}
${factCheckOutput.verified.length > 0 ? `Verified Claims:\n${factCheckOutput.verified.map((c) => `- ${c}`).join('\n')}` : ''}

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
        outputPreview: res.text.slice(0, 180) + (res.text.length > 180 ? '...' : ''),
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

  // ==========================================
  // STEP 1: 🧭 PLANNER
  // ==========================================
  let plannerOutput = {
    task: query,
    plan: ['Synthesize accurate response directly.'],
    needsResearch: false,
    needsFactCheck: false,
    needsReview: false,
    needsDiagram: false,
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

    // Explicitly inject current Diagram Mode state so Planner's decision is context-aware
    const diagramModeNotice = diagramMode
      ? `\n\n[SYSTEM CONTEXT: Diagram Mode is currently ENABLED (ON).]
- The user has enabled Diagram Mode for this session.
- Evaluate if the inquiry has clear visual structure, processes, spatial flows, architecture, or comparisons. If yes, set "needsDiagram": true. Otherwise, set "needsDiagram": false.`
      : `\n\n[SYSTEM CONTEXT: Diagram Mode is currently DISABLED (OFF).]
- Diagram Mode is OFF for this request. Always output "needsDiagram": false.`;

    activePrompt += diagramModeNotice;

    const planRes = await callAgent('planner', [
      { role: 'system', content: 'You are the JARVIS Planner. Output only valid JSON.' },
      { role: 'user', content: activePrompt },
    ]);

    const duration = Date.now() - start;

    if (planRes.ok) {
      plannerOutput = safeJsonParse(planRes.text, plannerOutput);
      if (!diagramMode) {
        plannerOutput.needsDiagram = false;
      }
      updateStep({
        agentId: 'planner',
        name: pCfg.name,
        icon: pCfg.icon,
        status: 'completed',
        providerName: planRes.providerName,
        model: planRes.model,
        durationMs: duration,
        summary: plannerOutput.plan?.slice(0, 2).join(' • ') || 'Task analyzed and routed.',
        outputPreview: JSON.stringify(plannerOutput, null, 2),
        usedFallback: planRes.usedFallback,
      });
    } else {
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
  }

  // Heuristic detection for complex queries
  const isComplexQuery =
    query.length > 50 ||
    /\b(how|why|compare|versus|vs|explain|difference|implement|create|design|code|analyze|architecture|review|best practices|pros and cons|guide|steps|tutorial)\b/i.test(query) ||
    (query.includes('?') && query.split(' ').length > 7);

  // Determine which downstream agents are required
  const shouldResearch =
    agentConfigs.researcher.enabled &&
    (deepResearch || plannerOutput.needsResearch || query.length > 30);

  const shouldFactCheck =
    agentConfigs.factChecker.enabled &&
    (deepResearch || (shouldResearch && plannerOutput.needsFactCheck) || isComplexQuery);

  const shouldReview =
    agentConfigs.reviewer.enabled &&
    (deepResearch || plannerOutput.needsReview || isComplexQuery);

  // ==========================================
  // STEP 2: 🔎 RESEARCHER
  // ==========================================
  const researcherOutput = {
    facts: [] as string[],
    sources: [] as Array<{ title: string; url: string; domain?: string }>,
  };

  if (shouldResearch) {
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

    try {
      const [wikiResults, searchResults] = await Promise.all([
        api.searchWikipedia(query, 3).catch(() => []),
        api.search(query).catch(() => []),
      ]);

      wikiResults.slice(0, 2).forEach((w) => {
        const cleaned = w.snippet.replace(/<[^>]+>/g, '').trim();
        gatheredSnippets.push(`[Wikipedia: ${w.title}] ${cleaned}`);
        sourcesCollected.push({
          title: w.title,
          url: w.url,
          domain: 'wikipedia.org',
          description: cleaned,
          type: 'wikipedia',
        });
      });

      searchResults.slice(0, 4).forEach((s) => {
        const desc = s.description ? s.description.trim() : '';
        gatheredSnippets.push(`[${s.domain || 'Web'}: ${s.title}] ${desc}`);
        sourcesCollected.push({
          title: s.title,
          url: s.url,
          domain: s.domain,
          description: desc,
          type: 'web',
        });
      });

      searchSnippets = gatheredSnippets.slice(0, 5).join('\n\n');
    } catch (err) {
      console.warn('[JARVIS Researcher] Live search retrieval error:', err);
    }

    const defaultPromptTemplate = DEFAULT_AGENT_SYSTEM_PROMPTS.researcher;
    let activePrompt = (rCfg.systemPrompt || defaultPromptTemplate)
      .replace('{task}', plannerOutput.task || query);

    if (activePrompt.includes('{searchSnippets}')) {
      activePrompt = activePrompt.replace(
        '{searchSnippets}',
        searchSnippets || 'No external snippets available. Rely on internal high-confidence knowledge.',
      );
    } else if (searchSnippets) {
      activePrompt += `\n\nLive Context / Search Data:\n${searchSnippets}`;
    }

    console.group(`[JARVIS Researcher] Executing Research for: "${query}"`);
    console.log(`[JARVIS Researcher] Planner Task: "${plannerOutput.task || query}"`);
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
      researcherOutput.sources = parsedResearcher.sources;

      console.log(`[JARVIS Researcher] Parsed ${researcherOutput.facts.length} facts:`, researcherOutput.facts);
      console.log(`[JARVIS Researcher] Extracted ${researcherOutput.sources.length} sources:`, researcherOutput.sources);
      console.groupEnd();

      if (Array.isArray(researcherOutput.sources)) {
        researcherOutput.sources.forEach((s) => {
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
        usedFallback: researchRes.usedFallback,
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
    const claimsText =
      researcherOutput.facts.length > 0
        ? researcherOutput.facts.map((f, i) => `${i + 1}. ${f}`).join('\n')
        : 'Evaluate general knowledge truthfulness for: ' + query;

    const activePrompt = (fCfg.systemPrompt || defaultPromptTemplate)
      .replace('{task}', plannerOutput.task || query)
      .replace('{claims}', claimsText);

    const factRes = await callAgent('factChecker', [
      { role: 'system', content: 'You are the JARVIS Fact Checker. Output strictly valid JSON.' },
      { role: 'user', content: activePrompt },
    ]);

    const duration = Date.now() - start;

    if (factRes.ok) {
      factCheckOutput = safeJsonParse(factRes.text, factCheckOutput);
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
    const activePrompt = (revCfg.systemPrompt || defaultPromptTemplate)
      .replace('{task}', plannerOutput.task || query)
      .replace('{facts}', JSON.stringify(researcherOutput.facts.slice(0, 5)))
      .replace('{issues}', JSON.stringify(factCheckOutput.issues));

    const reviewRes = await callAgent('reviewer', [
      { role: 'system', content: 'You are the JARVIS Reviewer. Output strictly valid JSON.' },
      { role: 'user', content: activePrompt },
    ]);

    const duration = Date.now() - start;

    if (reviewRes.ok) {
      reviewerOutput = safeJsonParse(reviewRes.text, reviewerOutput);
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

    const customInsightsBlock =
      customAgentOutputs.length > 0
        ? `\n\nCustom Agent Insights & Analysis:\n${customAgentOutputs.map((co) => `--- [Agent: ${co.name}] ---\n${co.output}`).join('\n\n')}`
        : '';

    const synthesizerContext = `User Query: "${query}"

Planner Guidance: ${plannerOutput.plan.join(' ')}
${researcherOutput.facts.length > 0 ? `Key Verified Facts:\n${researcherOutput.facts.map((f) => `- ${f}`).join('\n')}` : ''}
${factCheckOutput.verified.length > 0 ? `Verified Claims:\n${factCheckOutput.verified.map((c) => `- ${c}`).join('\n')}` : ''}
${factCheckOutput.issues.length > 0 ? `Important Caveats/Corrections:\n${factCheckOutput.issues.map((i) => `- ${i}`).join('\n')}` : ''}
${reviewerOutput.recommendation ? `Reviewer Advice: ${reviewerOutput.recommendation}` : ''}${customInsightsBlock}`;

    const defaultSysPrompt = DEFAULT_AGENT_SYSTEM_PROMPTS.finalSynthesizer;
    const activeSysPrompt = sCfg.systemPrompt && sCfg.systemPrompt.trim() ? sCfg.systemPrompt.trim() : defaultSysPrompt;

    const synthRes = await callAgent('finalSynthesizer', [
      {
        role: 'system',
        content: activeSysPrompt,
      },
      {
        role: 'user',
        content: `Please synthesize the definitive answer based on the following verified intelligence:\n\n${synthesizerContext}`,
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
        outputPreview: finalAnswer.slice(0, 150) + (finalAnswer.length > 150 ? '...' : ''),
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
      finalAnswer =
        researcherOutput.facts.length > 0
          ? `### Summary Findings\n\n${researcherOutput.facts.map((f) => `- ${f}`).join('\n')}`
          : "Sorry, I couldn't generate a complete response right now.";
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

  const shouldArchitect =
    diagramMode &&
    Boolean(plannerOutput.needsDiagram) &&
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
    const activePrompt = (aCfg.systemPrompt || defaultPromptTemplate)
      .replace('{task}', plannerOutput.task || query)
      .replace('{answer}', finalAnswer || researcherOutput.facts.slice(0, 5).join('\n'));

    console.group(`[JARVIS Architect] Generating SVG Blueprint for: "${query}"`);
    console.log(`[JARVIS Architect] Active Prompt:`, activePrompt);

    const archRes = await callAgent('architect', [
      {
        role: 'system',
        content:
          'You are the JARVIS Architect agent. Output ONLY valid, raw, clean SVG markup (starting with <svg and ending with </svg>) illustrating the concept. Do not include markdown code blocks, backticks, or extra text.',
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
          outputPreview: diagramSvg.slice(0, 180) + '...',
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
          outputPreview: diagramSvg.slice(0, 180) + '...',
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
        outputPreview: diagramSvg.slice(0, 180) + '...',
        usedFallback: true,
      });
    }
  }

  return {
    answer: finalAnswer,
    steps,
    sources: sourcesCollected,
    diagramSvg,
  };
}
