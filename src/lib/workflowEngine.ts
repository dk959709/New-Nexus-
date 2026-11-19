import type {
  Workflow,
  WorkflowNode,
  WorkflowEdge,
  WorkflowOutput,
  WorkflowStepStatus,
  WorkflowRunOptions,
  WorkflowValidationIssue,
  WeatherData,
} from '@/types';
import { api, BASE } from '@/services/api';
import { storage } from '@/lib/storage';
import { getSkillTextById, estimateTokens } from '@/lib/skills';
import { generateStudioImage } from '@/services/imageGenerationService';

export interface WorkflowRunCallbacks {
  onStatus: (
    nodeId: string,
    status: WorkflowStepStatus,
    output?: WorkflowOutput,
    errorText?: string,
  ) => void;
  shouldStop: () => boolean;
  onWarning?: (warning: string) => void;
  onLog?: (message: string) => void;
}

/**
 * Summarize a step output for compact UI badges:
 * text -> "N words" (or "N lines" for long multiline text),
 * image -> "1 image",
 * json -> "N chars".
 */
export function getOutputSummary(output?: WorkflowOutput | null): string {
  if (!output) return '';
  if (output.type === 'image') {
    return '1 image';
  }
  if (output.type === 'json') {
    return `${(output.value || '').length} chars`;
  }
  const text = (output.value || '').trim();
  if (!text) return '0 words';
  const lines = text.split(/\r?\n/).length;
  const words = text.split(/\s+/).filter(Boolean).length;
  if (lines > 50) {
    return `${lines} lines`;
  }
  return `${words} ${words === 1 ? 'word' : 'words'}`;
}

/**
 * Find all ancestor node IDs that can reach targetNodeId via directed edges.
 */
export function getAncestorNodeIds(
  targetNodeId: string,
  edges: WorkflowEdge[],
): Set<string> {
  const ancestors = new Set<string>();
  const queue = [targetNodeId];
  while (queue.length > 0) {
    const curr = queue.shift()!;
    for (const edge of edges) {
      if (edge.to === curr && edge.from !== targetNodeId && !ancestors.has(edge.from)) {
        ancestors.add(edge.from);
        queue.push(edge.from);
      }
    }
  }
  return ancestors;
}

/**
 * Build a flat key -> value map from workflow variables + optional runtime overrides.
 */
export function buildWorkflowVariableMap(
  workflow?: Workflow | null,
  overrides?: Record<string, string>,
): Record<string, string> {
  const vars: Record<string, string> = {};
  const list = [
    ...(workflow?.automation?.variables || []),
    ...(workflow?.variables || []),
  ];
  for (const item of list) {
    const key = (item.key || '').trim();
    if (!key) continue;
    vars[key] = item.defaultValue ?? item.example ?? '';
  }
  if (overrides) {
    for (const [k, v] of Object.entries(overrides)) {
      const key = k.trim();
      if (key) vars[key] = v;
    }
  }
  return vars;
}

/**
 * Resolves all placeholders for a node's settings using the provided outputs and workflow variables.
 */
export function resolveNodeSettings(
  node: WorkflowNode,
  allNodes: WorkflowNode[],
  currentOutputs: Record<string, WorkflowOutput>,
  variables?: Record<string, string>,
): Record<string, string> {
  const outputsByLabel = new Map<string, string>();
  const outputsById = new Map<string, string>();
  for (const n of allNodes) {
    const out = currentOutputs[n.id];
    if (out) {
      outputsById.set(n.id, out.value);
      outputsByLabel.set(n.label, out.value);
    }
  }

  const resolvedSettings: Record<string, string> = {};
  for (const [k, v] of Object.entries(node.settings || {})) {
    resolvedSettings[k] = resolvePlaceholders(v, outputsByLabel, outputsById, undefined, variables);
  }
  return resolvedSettings;
}

/**
 * Execute a single node in isolation given the current outputs of previous nodes.
 * Used by the Step Debugger to test individual nodes instantly.
 */
export async function executeSingleNodeStep(
  node: WorkflowNode,
  allNodes: WorkflowNode[],
  currentOutputs: Record<string, WorkflowOutput>,
  edges: WorkflowEdge[] = [],
  variables?: Record<string, string>,
): Promise<{ output: WorkflowOutput; conditionPassed?: boolean }> {
  const isFrozen = node.settings?.frozen === 'true' || Boolean(node.frozen);
  if (isFrozen) {
    if (node.mockOutput && node.mockOutput.value !== undefined) {
      return { output: node.mockOutput };
    }
    if (node.settings?.mockValue !== undefined && node.settings.mockValue !== '') {
      return {
        output: {
          type: (node.settings.mockType as 'text' | 'json' | 'image') || 'text',
          value: node.settings.mockValue,
        },
      };
    }
    if (currentOutputs[node.id]) {
      return { output: currentOutputs[node.id] };
    }
  }

  const resolved = resolveNodeSettings(node, allNodes, currentOutputs, variables);
  const upstreamItems = collectUpstreamOutputs(node, allNodes, edges, currentOutputs);
  return await executeStepWithPolicy(node, resolved, upstreamItems);
}

/**
 * Find all downstream node IDs reachable from startNodeId (including startNodeId itself).
 */
export function getDownstreamNodeIds(
  startNodeId: string,
  edges: WorkflowEdge[],
): Set<string> {
  const downstream = new Set<string>([startNodeId]);
  const queue = [startNodeId];
  while (queue.length > 0) {
    const curr = queue.shift()!;
    for (const edge of edges) {
      if (edge.from === curr && !downstream.has(edge.to)) {
        downstream.add(edge.to);
        queue.push(edge.to);
      }
    }
  }
  return downstream;
}

/**
 * Detect cycles in the directed graph formed by nodes and edges.
 * Uses DFS with recursion-stack state tracking.
 */
export function hasWorkflowCycle(nodes: WorkflowNode[], edges: WorkflowEdge[]): boolean {
  const adj = new Map<string, string[]>();
  for (const n of nodes) {
    adj.set(n.id, []);
  }
  for (const e of edges) {
    if (adj.has(e.from)) {
      adj.get(e.from)!.push(e.to);
    }
  }

  // 0 = unvisited, 1 = visiting, 2 = visited
  const state = new Map<string, number>();
  for (const n of nodes) {
    state.set(n.id, 0);
  }

  function dfs(u: string): boolean {
    state.set(u, 1);
    const neighbors = adj.get(u) || [];
    for (const v of neighbors) {
      const s = state.get(v) ?? 0;
      if (s === 1) return true; // cycle detected
      if (s === 0) {
        if (dfs(v)) return true;
      }
    }
    state.set(u, 2);
    return false;
  }

  for (const n of nodes) {
    if ((state.get(n.id) ?? 0) === 0) {
      if (dfs(n.id)) return true;
    }
  }
  return false;
}

/**
 * Replace {{Label.output}}, {{id.output}}, and {{vars.key}} in string with previous outputs / variables.
 * Labels can contain any characters except "}".
 * Matching is supported by id and by label (case-insensitive, trimmed).
 * Unknown placeholders stay as they are and emit a warning.
 */
export function resolvePlaceholders(
  text: string,
  outputsByLabel: Map<string, string>,
  outputsById: Map<string, string>,
  onWarning?: (warning: string) => void,
  variables?: Record<string, string>,
): string {
  if (!text || typeof text !== 'string') return text || '';

  // 1. Resolve {{vars.key}} global workflow variables
  let result = text.replace(/\{\{\s*vars\.([^}\s]+)\s*\}\}/gi, (match, rawVarKey) => {
    const target = rawVarKey.trim().toLowerCase();
    if (variables) {
      for (const [k, v] of Object.entries(variables)) {
        if (k.trim().toLowerCase() === target) {
          return v ?? '';
        }
      }
    }
    const warn = `Unknown variable: {{vars.${rawVarKey.trim()}}}`;
    if (onWarning) onWarning(warn);
    return match;
  });

  // 2. Resolve {{Label.output}} or {{id.output}}
  result = result.replace(/\{\{\s*([^}]+?)\.output\s*\}\}/gi, (match, rawKey) => {
    const key = rawKey.trim();
    // Direct match by node ID (exact or case-insensitive)
    if (outputsById.has(key)) {
      return outputsById.get(key)!;
    }
    for (const [id, val] of outputsById.entries()) {
      if (id.trim().toLowerCase() === key.toLowerCase()) {
        return val;
      }
    }
    // Direct match by node Label (case-insensitive, trimmed)
    for (const [lbl, val] of outputsByLabel.entries()) {
      if (lbl.trim().toLowerCase() === key.toLowerCase()) {
        return val;
      }
    }
    // Unknown placeholder
    const warn = `Unknown placeholder: {{${key}.output}}`;
    if (onWarning) onWarning(warn);
    return match;
  });

  return result;
}

function collectUpstreamOutputs(
  node: WorkflowNode,
  allNodes: WorkflowNode[],
  edges: WorkflowEdge[],
  outputs: Record<string, WorkflowOutput>,
): Array<{ id: string; label: string; value: string }> {
  const incomingIds = Array.from(
    new Set(edges.filter((e) => e.to === node.id).map((e) => e.from)),
  );
  const nodeMap = new Map(allNodes.map((n) => [n.id, n]));
  const items: Array<{ id: string; label: string; value: string }> = [];

  if (incomingIds.length > 0) {
    for (const pid of incomingIds) {
      const pNode = nodeMap.get(pid);
      const out = outputs[pid];
      if (pNode && out && out.value !== undefined) {
        items.push({ id: pNode.id, label: pNode.label, value: out.value });
      }
    }
  } else {
    // Fallback for linear pipelines without explicit edges
    const idx = allNodes.findIndex((n) => n.id === node.id);
    if (idx > 0) {
      const prev = allNodes[idx - 1];
      const out = outputs[prev.id];
      if (out && out.value !== undefined) {
        items.push({ id: prev.id, label: prev.label, value: out.value });
      }
    }
  }
  return items;
}

function extractJsonByPath(raw: string, pathStr: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    throw new Error('Transform input is not valid JSON.');
  }
  const path = pathStr.trim();
  if (!path || path === '$' || path === '.') {
    return typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2);
  }
  const tokens = path
    .replace(/^\$\.?/, '')
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter(Boolean);
  let cur: unknown = parsed;
  for (const token of tokens) {
    if (cur === null || cur === undefined) {
      return '';
    }
    if (Array.isArray(cur)) {
      const index = Number(token);
      cur = Number.isInteger(index) ? cur[index] : undefined;
    } else if (typeof cur === 'object') {
      cur = (cur as Record<string, unknown>)[token];
    } else {
      return '';
    }
  }
  if (cur === null || cur === undefined) return '';
  return typeof cur === 'string' ? cur : JSON.stringify(cur, null, 2);
}

async function executeStepWithPolicy(
  node: WorkflowNode,
  resolvedSettings: Record<string, string>,
  upstreamItems: Array<{ id: string; label: string; value: string }>,
  onLog?: (msg: string) => void,
): Promise<{ output: WorkflowOutput; conditionPassed?: boolean }> {
  const extraRetries = Math.max(0, Math.min(3, parseInt(resolvedSettings.retries || '0', 10) || 0));
  let attempt = 0;
  let lastError: unknown = null;

  while (attempt <= extraRetries) {
    try {
      return await executeStep(node, resolvedSettings, upstreamItems);
    } catch (err) {
      lastError = err;
      if (attempt < extraRetries) {
        attempt++;
        const delayMs = 1000 * attempt;
        if (onLog) {
          onLog(`Step "${node.label}" failed — retrying (${attempt}/${extraRetries}) in ${delayMs}ms...`);
        }
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      } else {
        break;
      }
    }
  }
  throw lastError;
}

/**
 * Executes a step with retry on HTTP 429 or network timeout.
 * Waits 2 seconds and retries once.
 */
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err: unknown) {
    const errObj = err as { message?: string; status?: number; statusCode?: number };
    const msg = String(errObj?.message || err);
    const is429 = msg.includes('429') || errObj?.status === 429 || errObj?.statusCode === 429;
    const isTimeout =
      msg.toLowerCase().includes('timeout') ||
      msg.toLowerCase().includes('aborted') ||
      msg.toLowerCase().includes('network');
    if (is429 || isTimeout) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return await fn();
    }
    throw err;
  }
}

/**
 * Execute an individual node step based on its type.
 */
async function executeStep(
  node: WorkflowNode,
  resolvedSettings: Record<string, string>,
  upstreamItems: Array<{ id: string; label: string; value: string }> = [],
): Promise<{ output: WorkflowOutput; conditionPassed?: boolean }> {
  switch (node.type) {
    case 'input': {
      const text = resolvedSettings.text ?? '';
      return { output: { type: 'text', value: text } };
    }

    case 'webSearch': {
      const query = resolvedSettings.query ?? '';
      const results = await withRetry(async () => {
        return await api.search(query, undefined, 1, 5);
      });
      const top5 = (results || []).slice(0, 5);
      const text =
        top5.length > 0
          ? top5
              .map(
                (r, idx) =>
                  `[${idx + 1}] ${r.title}\n${r.description || ''}\n${r.url}`,
              )
              .join('\n\n')
          : 'No search results found.';
      return { output: { type: 'text', value: text } };
    }

    case 'webFetch': {
      const url = resolvedSettings.url ?? '';
      const res = await withRetry(async () => {
        return await api.webFetch(url);
      });
      if (!res.ok || !res.data) {
        throw new Error(res.error || `Failed to fetch web content from ${url}`);
      }
      const raw = (res.data.textContent || res.data.description || '').trim();
      const text = raw.slice(0, 6000);
      return { output: { type: 'text', value: text } };
    }

    case 'scholar': {
      const query = resolvedSettings.query ?? '';
      const res = await withRetry(async () => {
        return await api.searchScholar(query);
      });
      if (!res.papers || res.papers.length === 0) {
        return { output: { type: 'text', value: 'No papers found.' } };
      }
      const text = res.papers
        .map((p, idx) => {
          const authors = (p.authors || []).slice(0, 3).join(', ') || 'Unknown authors';
          const year = p.year ? ` (${p.year})` : '';
          let abs = (p.abstract || '').trim();
          if (abs.length > 400) abs = abs.slice(0, 400) + '...';
          return `[${idx + 1}] "${p.title}" - ${authors}${year}.\n${abs}`;
        })
        .join('\n\n');
      return { output: { type: 'text', value: text } };
    }

    case 'ai': {
      const role = resolvedSettings.role || 'general';
      let roleLine = '';
      if (role === 'coder') {
        roleLine = 'You are an expert software engineer. Give working, clean code with short explanations.\n\n';
      } else if (role === 'architect') {
        roleLine = 'You are a senior system architect. Give clear structure, components and trade-offs.\n\n';
      } else if (role === 'dataAnalyst') {
        roleLine = 'You are a careful data analyst. Show steps and numbers clearly.\n\n';
      }
      const fullPrompt = `${roleLine}${resolvedSettings.prompt ?? ''}`.trim();

      // Setting maxTokens: default 1500, allowed 200 to 4000
      let parsedTokens = parseInt(resolvedSettings.maxTokens || '1500', 10);
      if (isNaN(parsedTokens)) parsedTokens = 1500;
      parsedTokens = Math.max(200, Math.min(4000, parsedTokens));

      const providerId =
        resolvedSettings.providerId && resolvedSettings.providerId.trim()
          ? resolvedSettings.providerId.trim()
          : undefined;
      const modelId =
        resolvedSettings.modelId && resolvedSettings.modelId.trim()
          ? resolvedSettings.modelId.trim()
          : undefined;

      const provider = providerId
        ? storage.getProviderForSession(providerId, modelId)
        : storage.getActiveAIProvider();

      const providerCopy = provider
        ? { ...provider, maxTokens: parsedTokens }
        : null;

      const skillId = (resolvedSettings.skillId ?? '').trim();
      const matchedSkill = skillId ? getSkillTextById(skillId) : null;

      const res = await withRetry(async () => {
        return await api.aiChat(fullPrompt, [], '', providerCopy, false, {
          maxTokens: parsedTokens,
          ...(matchedSkill ? { skillsText: matchedSkill.text } : {}),
        });
      });
      return { output: { type: 'text', value: res.answer || '' } };
    }

    case 'image': {
      const prompt = resolvedSettings.prompt ?? '';
      const item = await withRetry(async () => {
        return await generateStudioImage(prompt);
      });
      const val = item.imageData || item.url || '';
      return { output: { type: 'image', value: val } };
    }

    case 'weather': {
      const city = (resolvedSettings.city ?? '').trim();
      let weatherData: WeatherData;
      const geo = await api.geocode(city).catch(() => []);
      if (geo && geo.length > 0) {
        weatherData = await withRetry(async () => {
          return await api.weather(`latitude=${geo[0].latitude}&longitude=${geo[0].longitude}`);
        });
      } else {
        weatherData = await withRetry(async () => {
          return await api.weather(`city=${encodeURIComponent(city)}`);
        });
      }
      const cur = weatherData?.current;
      if (!cur) throw new Error('No weather data received');
      const today = weatherData.daily?.[0];
      const highLow = today ? ` | High: ${today.high}° / Low: ${today.low}°` : '';
      const summary = `${cur.location || city}: ${cur.temperature}°C, ${cur.conditionLabel || cur.condition}. Wind: ${cur.wind} km/h, Humidity: ${cur.humidity}%${highLow}.`;
      return { output: { type: 'text', value: summary } };
    }

    case 'nasa': {
      const apod = await withRetry(async () => {
        const res = await fetch(BASE + '/api/nasa/apod');
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(json.error || 'NASA APOD data is temporarily unavailable.');
        }
        return json.data || json;
      });
      const text = `Title: ${apod.title || 'APOD'}\nDate: ${apod.date || ''}\nExplanation: ${apod.explanation || ''}\nImage: ${apod.hdurl || apod.url || ''}`.trim();
      return { output: { type: 'text', value: text } };
    }

    case 'document': {
      const url = (resolvedSettings.url ?? '').trim();
      if (!url) throw new Error('Document URL is empty');
      const data = await withRetry(async () => {
        const res = await fetch(BASE + '/api/documents/extract-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || json.ok === false) {
          throw new Error(json.error || 'Document extraction failed.');
        }
        return json.data || {};
      });
      const text = String(data.text || '').trim().slice(0, 8000);
      if (!text) throw new Error('Document contained no readable text.');
      return { output: { type: 'text', value: text } };
    }

    case 'email': {
      const to = (resolvedSettings.to ?? '').trim();
      const subject = (resolvedSettings.subject ?? '').trim() || 'NEXUS Automation result';
      const body = (resolvedSettings.body ?? '').trim();
      if (!to) throw new Error('Email recipient is empty.');
      if (!body) throw new Error('Email body is empty.');
      const data = await withRetry(async () => {
        const res = await fetch(BASE + '/api/integrations/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to, subject, body }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || json.ok === false) {
          throw new Error(json.error || 'Email delivery failed.');
        }
        return json.data || {};
      });
      const recipients = Array.isArray(data.recipients) ? data.recipients.join(', ') : to;
      return { output: { type: 'text', value: `Email sent to ${recipients}.` } };
    }

    case 'webhook': {
      const url = (resolvedSettings.url ?? '').trim();
      const body = (resolvedSettings.body ?? '').trim();
      if (!url) throw new Error('Webhook URL is empty.');
      const data = await withRetry(async () => {
        const res = await fetch(BASE + '/api/integrations/webhook', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, body }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || json.ok === false) {
          throw new Error(json.error || 'Webhook delivery failed.');
        }
        return json.data || {};
      });
      return { output: { type: 'text', value: `Webhook delivered (HTTP ${data.status || 200}).` } };
    }

    case 'if': {
      const v1 = resolvedSettings.value1 ?? '';
      const v2 = resolvedSettings.value2 ?? '';
      const op = resolvedSettings.operator || 'contains';
      let passed = false;
      if (op === 'contains') passed = v1.toLowerCase().includes(v2.toLowerCase());
      else if (op === 'notContains') passed = !v1.toLowerCase().includes(v2.toLowerCase());
      else if (op === 'equals') passed = v1.trim() === v2.trim();
      else if (op === 'isEmpty') passed = v1.trim().length === 0;
      else if (op === 'isNotEmpty') passed = v1.trim().length > 0;
      else if (op === 'lengthGreaterThan') passed = v1.length > (Number(v2) || 0);
      else if (op === 'lengthLessThan') passed = v1.length < (Number(v2) || 0);
      return { output: { type: 'text', value: v1 }, conditionPassed: passed };
    }

    case 'transform': {
      const mode = resolvedSettings.mode || 'template';
      const fallbackUpstream = upstreamItems.map((u) => u.value).join('\n\n');
      const inputVal = (resolvedSettings.input ?? '') !== '' ? resolvedSettings.input : fallbackUpstream;

      if (mode === 'jsonPath') {
        const extracted = extractJsonByPath(inputVal, resolvedSettings.pattern || '');
        return { output: { type: 'text', value: extracted } };
      }
      if (mode === 'regexExtract') {
        const pattern = resolvedSettings.pattern || '';
        if (!pattern) return { output: { type: 'text', value: inputVal } };
        const rx = new RegExp(pattern, 'gm');
        const matches = Array.from(inputVal.matchAll(rx), (m) => m[1] ?? m[0]);
        return { output: { type: 'text', value: matches.join('\n') } };
      }
      if (mode === 'regexReplace') {
        const pattern = resolvedSettings.pattern || '';
        const replacement = resolvedSettings.replacement ?? '';
        if (!pattern) return { output: { type: 'text', value: inputVal } };
        const rx = new RegExp(pattern, 'gm');
        return { output: { type: 'text', value: inputVal.replace(rx, replacement) } };
      }
      if (mode === 'bullets') {
        const lines = inputVal
          .split(/\r?\n/)
          .map((line) => line.replace(/^[-*•\d.)\s]+/, '').trim())
          .filter(Boolean);
        return { output: { type: 'text', value: lines.map((l) => `- ${l}`).join('\n') } };
      }
      if (mode === 'uppercase') {
        return { output: { type: 'text', value: inputVal.toUpperCase() } };
      }
      if (mode === 'lowercase') {
        return { output: { type: 'text', value: inputVal.toLowerCase() } };
      }
      if (mode === 'trim') {
        return {
          output: {
            type: 'text',
            value: inputVal.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim(),
          },
        };
      }
      if (mode === 'truncate') {
        const maxWords = Math.max(5, parseInt(resolvedSettings.maxWords || '120', 10) || 120);
        const words = inputVal.trim().split(/\s+/).filter(Boolean);
        const truncated = words.length > maxWords ? `${words.slice(0, maxWords).join(' ')}…` : words.join(' ');
        return { output: { type: 'text', value: truncated } };
      }
      if (mode === 'stats') {
        const trimmed = inputVal.trim();
        const words = trimmed ? trimmed.split(/\s+/).length : 0;
        const lines = trimmed ? trimmed.split(/\r?\n/).length : 0;
        const chars = inputVal.length;
        const readMins = Math.max(1, Math.ceil(words / 220));
        return {
          output: {
            type: 'text',
            value: `Words: ${words}\nLines: ${lines}\nCharacters: ${chars}\nEst. Reading Time: ~${readMins} min`,
          },
        };
      }
      return { output: { type: 'text', value: inputVal } };
    }

    case 'merge': {
      const mode = resolvedSettings.mode || 'sections';
      const rawSep = (resolvedSettings.separator ?? '\\n\\n---\\n\\n')
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t');

      if (mode === 'template') {
        return { output: { type: 'text', value: resolvedSettings.template || '' } };
      }
      if (upstreamItems.length === 0) {
        return { output: { type: 'text', value: '' } };
      }
      if (mode === 'json') {
        const obj: Record<string, string> = {};
        for (const item of upstreamItems) {
          obj[item.label] = item.value;
        }
        return { output: { type: 'json', value: JSON.stringify(obj, null, 2) } };
      }
      if (mode === 'numbered') {
        const text = upstreamItems
          .map((item, idx) => `${idx + 1}. ${item.label}\n${item.value}`)
          .join(rawSep || '\n\n');
        return { output: { type: 'text', value: text } };
      }
      if (mode === 'join') {
        const text = upstreamItems.map((item) => item.value).join(rawSep || '\n\n');
        return { output: { type: 'text', value: text } };
      }
      // Default: 'sections'
      const text = upstreamItems
        .map((item) => `### ${item.label}\n${item.value}`)
        .join(rawSep || '\n\n---\n\n');
      return { output: { type: 'text', value: text } };
    }

    default: {
      return { output: { type: 'text', value: '' } };
    }
  }
}

/**
 * Find all nodes reachable from the start node following edges that are still allowed.
 * For an 'if' parent, only the edge whose branch matches the result is allowed.
 * If an 'if' parent has not run yet, both branches remain potentially allowed.
 */
function getReachableNodeIds(
  startId: string,
  edges: WorkflowEdge[],
  ifResults: Map<string, 'yes' | 'no'>,
  nodeMap: Map<string, WorkflowNode>,
): Set<string> {
  const reachable = new Set<string>();
  const queue = [startId];
  reachable.add(startId);

  while (queue.length > 0) {
    const u = queue.shift()!;
    for (const edge of edges) {
      if (edge.from === u) {
        let allowed = true;
        const fromNode = nodeMap.get(edge.from);
        if (fromNode?.type === 'if' && ifResults.has(edge.from)) {
          const chosenBranch = ifResults.get(edge.from);
          if (edge.branch && edge.branch !== chosenBranch) {
            allowed = false;
          }
        }
        if (allowed && !reachable.has(edge.to)) {
          reachable.add(edge.to);
          queue.push(edge.to);
        }
      }
    }
  }

  return reachable;
}

/**
 * Main workflow execution engine. Pure logic, NO React and NO UI code.
 */
export async function runWorkflow(
  workflow: Workflow,
  callbacks: WorkflowRunCallbacks,
  options?: WorkflowRunOptions,
): Promise<void> {
  if (!workflow || !workflow.nodes || workflow.nodes.length === 0) {
    return;
  }

  const executedNodeIds = new Set<string>();
  const failedNodeIds = new Set<string>();
  const skippedNodeIds = new Set<string>();
  const disabledCompletedIds = new Set<string>();

  /**
   * Safe status dispatcher that never changes the status of a node
   * that already ended as 'done' or 'error', and never marks a failed node as 'skipped'.
   */
  const setNodeStatus = (
    nodeId: string,
    status: WorkflowStepStatus,
    output?: WorkflowOutput,
    errorText?: string,
  ) => {
    if (executedNodeIds.has(nodeId) || failedNodeIds.has(nodeId) || skippedNodeIds.has(nodeId)) {
      return;
    }
    if (status === 'done') {
      executedNodeIds.add(nodeId);
    } else if (status === 'error') {
      failedNodeIds.add(nodeId);
    } else if (status === 'skipped') {
      skippedNodeIds.add(nodeId);
    }
    callbacks.onStatus(nodeId, status, output, errorText);
  };

  // 1. Detect loops/cycles BEFORE running
  if (hasWorkflowCycle(workflow.nodes, workflow.edges || [])) {
    const startNode = workflow.nodes.find((n) => n.type === 'input') || workflow.nodes[0];
    setNodeStatus(
      startNode.id,
      'error',
      undefined,
      'Cycle detected in workflow. Workflows must be a directed acyclic graph (DAG).',
    );
    for (const n of workflow.nodes) {
      if (!failedNodeIds.has(n.id) && !executedNodeIds.has(n.id)) {
        setNodeStatus(n.id, 'skipped');
      }
    }
    return;
  }

  // 2. Identify start node (type 'input' preferred)
  const startNode = workflow.nodes.find((n) => n.type === 'input') || workflow.nodes[0];
  if (!startNode) return;

  const nodeMap = new Map<string, WorkflowNode>();
  for (const n of workflow.nodes) {
    nodeMap.set(n.id, n);
  }

  const outputsByLabel = new Map<string, string>();
  const outputsById = new Map<string, string>();
  const fullOutputsById = new Map<string, WorkflowOutput>();
  const ifResults = new Map<string, 'yes' | 'no'>();
  const resolvedVariables = buildWorkflowVariableMap(workflow, options?.variables);

  const isPartialRun = Boolean(
    options?.startFromNodeId && nodeMap.has(options.startFromNodeId),
  );
  const initialNodeId =
    isPartialRun && options?.startFromNodeId
      ? options.startFromNodeId
      : startNode.id;

  // If starting from a specific node, treat its completed ancestors as done with their saved outputs
  if (isPartialRun && options?.startFromNodeId) {
    const ancestors = getAncestorNodeIds(options.startFromNodeId, workflow.edges || []);
    const prevOutputs = options.previousOutputs || {};
    for (const ancId of ancestors) {
      const ancNode = nodeMap.get(ancId);
      const isAncFrozen = ancNode?.settings?.frozen === 'true' || Boolean(ancNode?.frozen);
      const savedOut =
        prevOutputs[ancId] ||
        (isAncFrozen && ancNode?.mockOutput) ||
        (isAncFrozen && ancNode?.settings?.mockValue
          ? {
              type: (ancNode.settings.mockType as 'text' | 'json' | 'image') || 'text',
              value: ancNode.settings.mockValue,
            }
          : undefined);
      if (savedOut && ancNode) {
        executedNodeIds.add(ancId);
        fullOutputsById.set(ancId, savedOut);
        outputsById.set(ancId, savedOut.value);
        outputsByLabel.set(ancNode.label, savedOut.value);
      } else if (ancNode?.settings?.disabled === 'true') {
        disabledCompletedIds.add(ancId);
      }
    }
    // Second pass for any disabled ancestor that relies on its parent's output
    for (const ancId of ancestors) {
      if (!outputsById.has(ancId)) {
        const ancNode = nodeMap.get(ancId);
        const inc = (workflow.edges || []).filter((e) => e.to === ancId);
        const pEdge = inc.find((e) => outputsById.has(e.from)) || inc[0];
        const val = pEdge ? (outputsById.get(pEdge.from) ?? '') : '';
        const fullOut =
          pEdge && fullOutputsById.has(pEdge.from)
            ? fullOutputsById.get(pEdge.from)!
            : { type: 'text' as const, value: val };
        if (ancNode?.settings?.disabled === 'true') {
          fullOutputsById.set(ancId, fullOut);
          outputsById.set(ancId, val);
          if (ancNode) outputsByLabel.set(ancNode.label, val);
        }
      }
    }
  }

  // Queue of node IDs to visit
  const queue: string[] = [initialNodeId];
  const enqueued = new Set<string>([initialNodeId]);

  let stepCount = 0;
  const MAX_STEPS = 30;
  let consecutiveWaitCount = 0;

  while (queue.length > 0) {
    if (callbacks.shouldStop()) {
      if (callbacks.onLog) callbacks.onLog('Workflow stopped by user.');
      break;
    }

    const currentId = queue.shift()!;
    const currentNode = nodeMap.get(currentId);
    if (!currentNode) continue;

    if (
      executedNodeIds.has(currentId) ||
      failedNodeIds.has(currentId) ||
      disabledCompletedIds.has(currentId)
    ) {
      continue; // Each node runs only once; already finalized
    }

    // Merge node wait condition:
    // A node with 2+ incoming edges must wait until all of its "active" parents have finished.
    const incomingEdges = (workflow.edges || []).filter((e) => e.to === currentId);
    if (incomingEdges.length >= 2 && currentId !== initialNodeId) {
      const reachableNodes = getReachableNodeIds(
        initialNodeId,
        workflow.edges || [],
        ifResults,
        nodeMap,
      );
      const parentIds = Array.from(new Set(incomingEdges.map((e) => e.from)));
      const activeParents = parentIds.filter(
        (pId) => reachableNodes.has(pId) || executedNodeIds.has(pId) || disabledCompletedIds.has(pId),
      );
      const hasUnfinishedActiveParent = activeParents.some(
        (pId) => !executedNodeIds.has(pId) && !disabledCompletedIds.has(pId),
      );

      if (hasUnfinishedActiveParent) {
        // Put the node at the end of the queue and continue with other nodes
        queue.push(currentId);
        consecutiveWaitCount++;

        // If the queue only contains waiting nodes that can never be released, stop the loop
        // and mark those nodes 'skipped' with the note "waiting for a step that did not run".
        if (consecutiveWaitCount >= queue.length) {
          if (callbacks.onLog) {
            callbacks.onLog(
              'Unresolvable waiting dependency detected. Skipping remaining waiting nodes.',
            );
          }
          const waitingIds = Array.from(new Set(queue));
          for (const wId of waitingIds) {
            setNodeStatus(
              wId,
              'skipped',
              undefined,
              'waiting for a step that did not run',
            );
          }
          break;
        }

        continue;
      }
    }

    // Node is ready to run, reset consecutive wait counter
    consecutiveWaitCount = 0;

    // Check if step is disabled
    if (currentNode.settings?.disabled === 'true') {
      const parentEdge =
        incomingEdges.find((e) => outputsById.has(e.from)) || incomingEdges[0];
      const passThroughValue = parentEdge ? (outputsById.get(parentEdge.from) ?? '') : '';
      const passThroughOutput: WorkflowOutput =
        parentEdge && fullOutputsById.has(parentEdge.from)
          ? fullOutputsById.get(parentEdge.from)!
          : { type: 'text', value: passThroughValue };

      fullOutputsById.set(currentId, passThroughOutput);
      outputsById.set(currentId, passThroughValue);
      outputsByLabel.set(currentNode.label, passThroughValue);
      disabledCompletedIds.add(currentId);
      setNodeStatus(currentId, 'skipped', passThroughOutput, 'disabled');
      if (callbacks.onLog) {
        callbacks.onLog(`Step "${currentNode.label}" is disabled (skipped, passing parent output).`);
      }

      const outgoingEdges = (workflow.edges || []).filter((e) => e.from === currentId);
      if (currentNode.type === 'if') {
        ifResults.set(currentId, 'yes');
        for (const edge of outgoingEdges) {
          if (!edge.branch || edge.branch === 'yes') {
            if (
              !executedNodeIds.has(edge.to) &&
              !disabledCompletedIds.has(edge.to) &&
              !enqueued.has(edge.to)
            ) {
              queue.push(edge.to);
              enqueued.add(edge.to);
            }
          }
        }
      } else {
        for (const edge of outgoingEdges) {
          if (
            !executedNodeIds.has(edge.to) &&
            !disabledCompletedIds.has(edge.to) &&
            !enqueued.has(edge.to)
          ) {
            queue.push(edge.to);
            enqueued.add(edge.to);
          }
        }
      }
      continue;
    }

    // Check if step is frozen (mocked / cached)
    const isFrozen = currentNode.settings?.frozen === 'true' || Boolean(currentNode.frozen);
    if (isFrozen) {
      let frozenOutput: WorkflowOutput;
      if (currentNode.mockOutput && currentNode.mockOutput.value !== undefined) {
        frozenOutput = currentNode.mockOutput;
      } else if (
        currentNode.settings?.mockValue !== undefined &&
        currentNode.settings.mockValue !== ''
      ) {
        frozenOutput = {
          type: (currentNode.settings.mockType as 'text' | 'json' | 'image') || 'text',
          value: currentNode.settings.mockValue,
        };
      } else if (options?.previousOutputs?.[currentId]) {
        frozenOutput = options.previousOutputs[currentId];
      } else {
        frozenOutput = {
          type: 'text',
          value: '(Frozen Step Output)',
        };
      }

      fullOutputsById.set(currentId, frozenOutput);
      outputsById.set(currentId, frozenOutput.value);
      outputsByLabel.set(currentNode.label, frozenOutput.value);
      setNodeStatus(currentId, 'done', frozenOutput);
      if (callbacks.onLog) {
        callbacks.onLog(
          `Step "${currentNode.label}" is frozen. Using cached/mock output (${getOutputSummary(frozenOutput)}).`,
        );
      }

      const outgoingEdges = (workflow.edges || []).filter((e) => e.from === currentId);
      if (currentNode.type === 'if') {
        const val = frozenOutput.value.trim().toLowerCase();
        const branch: 'yes' | 'no' = val === 'false' || val === '0' || val === 'no' || !val ? 'no' : 'yes';
        ifResults.set(currentId, branch);
        for (const edge of outgoingEdges) {
          if (!edge.branch || edge.branch === branch) {
            if (
              !executedNodeIds.has(edge.to) &&
              !disabledCompletedIds.has(edge.to) &&
              !enqueued.has(edge.to)
            ) {
              queue.push(edge.to);
              enqueued.add(edge.to);
            }
          }
        }
      } else {
        for (const edge of outgoingEdges) {
          if (
            !executedNodeIds.has(edge.to) &&
            !disabledCompletedIds.has(edge.to) &&
            !enqueued.has(edge.to)
          ) {
            queue.push(edge.to);
            enqueued.add(edge.to);
          }
        }
      }
      continue;
    }

    if (stepCount >= MAX_STEPS) {
      setNodeStatus(
        currentId,
        'error',
        undefined,
        'Workflow execution exceeded hard limit of 30 steps.',
      );
      break;
    }

    stepCount++;
    setNodeStatus(currentId, 'running');
    if (callbacks.onLog) {
      callbacks.onLog(`Running step "${currentNode.label}" (${currentNode.type})...`);
    }

    // Resolve placeholders in settings (step outputs + global variables)
    const resolvedSettings: Record<string, string> = {};
    for (const [k, v] of Object.entries(currentNode.settings || {})) {
      resolvedSettings[k] = resolvePlaceholders(
        v,
        outputsByLabel,
        outputsById,
        callbacks.onWarning,
        resolvedVariables,
      );
    }

    const upstreamItems = collectUpstreamOutputs(
      currentNode,
      workflow.nodes,
      workflow.edges || [],
      Object.fromEntries(fullOutputsById.entries()),
    );

    let stepResult: { output: WorkflowOutput; conditionPassed?: boolean };
    try {
      stepResult = await executeStepWithPolicy(
        currentNode,
        resolvedSettings,
        upstreamItems,
        callbacks.onLog,
      );
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const continueOnError = currentNode.settings?.continueOnError === 'true';
      if (continueOnError) {
        const fallbackText =
          (resolvedSettings.fallbackValue ?? '').trim() ||
          `[Fallback] Step "${currentNode.label}" failed: ${errMsg}`;
        if (callbacks.onWarning) {
          callbacks.onWarning(`"${currentNode.label}" failed (${errMsg}) — continued with fallback.`);
        }
        if (callbacks.onLog) {
          callbacks.onLog(`Step "${currentNode.label}" failed; continue-on-error applied fallback.`);
        }
        stepResult = {
          output: { type: 'text', value: fallbackText },
          conditionPassed: false,
        };
      } else {
        setNodeStatus(currentId, 'error', undefined, errMsg);
        if (callbacks.onLog) {
          callbacks.onLog(`Error in step "${currentNode.label}": ${errMsg}`);
        }
        // Stop the workflow on step error
        break;
      }
    }

    // Mark done and save outputs
    setNodeStatus(currentId, 'done', stepResult.output);
    fullOutputsById.set(currentId, stepResult.output);
    outputsById.set(currentId, stepResult.output.value);
    outputsByLabel.set(currentNode.label, stepResult.output.value);

    // Follow outgoing edges
    const outgoingEdges = (workflow.edges || []).filter((e) => e.from === currentId);

    if (currentNode.type === 'if') {
      const branch: 'yes' | 'no' = stepResult.conditionPassed ? 'yes' : 'no';
      ifResults.set(currentId, branch);
      if (callbacks.onLog) {
        callbacks.onLog(
          `Condition evaluated to "${branch}". Following "${branch}" branch.`,
        );
      }
      for (const edge of outgoingEdges) {
        if (!edge.branch || edge.branch === branch) {
          if (
            !executedNodeIds.has(edge.to) &&
            !disabledCompletedIds.has(edge.to) &&
            !enqueued.has(edge.to)
          ) {
            queue.push(edge.to);
            enqueued.add(edge.to);
          }
        }
      }
    } else {
      for (const edge of outgoingEdges) {
        if (
          !executedNodeIds.has(edge.to) &&
          !disabledCompletedIds.has(edge.to) &&
          !enqueued.has(edge.to)
        ) {
          queue.push(edge.to);
          enqueued.add(edge.to);
        }
      }
    }
  }

  // Final pass: nodes in scope that did not finish are marked 'skipped'.
  // When running from a specific node, only nodes downstream of that node are in scope,
  // preserving unrelated parallel branches.
  const targetScopeIds = isPartialRun
    ? getDownstreamNodeIds(initialNodeId, workflow.edges || [])
    : new Set(workflow.nodes.map((n) => n.id));

  for (const n of workflow.nodes) {
    if (!targetScopeIds.has(n.id)) continue;
    if (
      !executedNodeIds.has(n.id) &&
      !failedNodeIds.has(n.id) &&
      !skippedNodeIds.has(n.id) &&
      !disabledCompletedIds.has(n.id)
    ) {
      setNodeStatus(n.id, 'skipped');
    }
  }
}

/**
 * Pre-flight static analyzer returning actionable errors and warnings for a workflow.
 */
export function analyzeWorkflowHealth(workflow: Workflow | null | undefined): WorkflowValidationIssue[] {
  if (!workflow) return [];
  const issues: WorkflowValidationIssue[] = [];
  const nodes = workflow.nodes || [];
  const edges = workflow.edges || [];

  if (nodes.length === 0) {
    issues.push({
      id: 'empty-workflow',
      severity: 'error',
      title: 'Workflow has no steps',
      detail: 'Add at least an Input step and one action step before running.',
    });
    return issues;
  }

  // 1. Cycle detection
  if (hasWorkflowCycle(nodes, edges)) {
    issues.push({
      id: 'cycle-detected',
      severity: 'error',
      title: 'Circular loop detected',
      detail: 'One or more connections loop back to an earlier step. Remove the loop in Canvas mode.',
    });
  }

  // 2. Duplicate labels
  const seenLabels = new Map<string, WorkflowNode>();
  for (const node of nodes) {
    const key = (node.label || '').trim().toLowerCase();
    if (!key) {
      issues.push({
        id: `empty-label-${node.id}`,
        severity: 'error',
        nodeId: node.id,
        nodeLabel: node.label || node.type,
        title: 'Step has an empty name',
        detail: 'Give every step a clear name so downstream variables can reference it.',
      });
    } else if (seenLabels.has(key)) {
      issues.push({
        id: `dup-label-${node.id}`,
        severity: 'warning',
        nodeId: node.id,
        nodeLabel: node.label,
        title: `Duplicate step name "${node.label}"`,
        detail: 'Rename one of the steps so {{Step.output}} references stay unambiguous.',
      });
    } else {
      seenLabels.set(key, node);
    }
  }

  // 3. Reachability / disconnected nodes
  const startNode = nodes.find((n) => n.type === 'input') || nodes[0];
  if (nodes.length > 1 && startNode) {
    const reachable = new Set<string>([startNode.id]);
    const q = [startNode.id];
    while (q.length > 0) {
      const u = q.shift()!;
      for (const e of edges) {
        if (e.from === u && !reachable.has(e.to)) {
          reachable.add(e.to);
          q.push(e.to);
        }
      }
    }
    for (const node of nodes) {
      if (node.id !== startNode.id && !reachable.has(node.id)) {
        issues.push({
          id: `orphan-${node.id}`,
          severity: 'warning',
          nodeId: node.id,
          nodeLabel: node.label,
          title: `Unreachable step "${node.label}"`,
          detail: 'This step is not connected from the start step and will be skipped during a full run.',
        });
      }
    }
  }

  // 4. Available variable keys & node names
  const definedVars = new Set(
    [...(workflow.automation?.variables || []), ...(workflow.variables || [])]
      .map((v) => (v.key || '').trim().toLowerCase())
      .filter(Boolean),
  );
  const validNodeKeys = new Set<string>();
  for (const n of nodes) {
    validNodeKeys.add(n.id.trim().toLowerCase());
    validNodeKeys.add(n.label.trim().toLowerCase());
  }

  let estimatedPromptTokens = 0;

  // 5. Per-node required field checks & placeholder validation
  for (const node of nodes) {
    const s = node.settings || {};
    const isDisabled = s.disabled === 'true';
    const isFrozen = s.frozen === 'true' || Boolean(node.frozen);
    if (isDisabled || isFrozen) continue;

    if (node.type === 'webSearch' && !(s.query || '').trim()) {
      issues.push({
        id: `missing-query-${node.id}`,
        severity: 'error',
        nodeId: node.id,
        nodeLabel: node.label,
        title: `Empty search query in "${node.label}"`,
        detail: 'Enter a search query or insert {{Input.output}}.',
      });
    }
    if (node.type === 'scholar' && !(s.query || '').trim()) {
      issues.push({
        id: `missing-scholar-${node.id}`,
        severity: 'error',
        nodeId: node.id,
        nodeLabel: node.label,
        title: `Empty academic query in "${node.label}"`,
        detail: 'Enter a research topic to search academic papers.',
      });
    }
    if ((node.type === 'webFetch' || node.type === 'document') && !(s.url || '').trim()) {
      issues.push({
        id: `missing-url-${node.id}`,
        severity: 'error',
        nodeId: node.id,
        nodeLabel: node.label,
        title: `Missing URL in "${node.label}"`,
        detail: 'Provide a public HTTP/HTTPS URL or variable reference.',
      });
    }
    if (node.type === 'ai') {
      const prompt = (s.prompt || '').trim();
      if (!prompt) {
        issues.push({
          id: `missing-prompt-${node.id}`,
          severity: 'error',
          nodeId: node.id,
          nodeLabel: node.label,
          title: `Empty AI prompt in "${node.label}"`,
          detail: 'Write instructions for the AI agent before running.',
        });
      }
      estimatedPromptTokens += estimateTokens(prompt.length) + (parseInt(s.maxTokens || '1500', 10) || 1500);
    }
    if (node.type === 'image' && !(s.prompt || '').trim()) {
      issues.push({
        id: `missing-img-prompt-${node.id}`,
        severity: 'error',
        nodeId: node.id,
        nodeLabel: node.label,
        title: `Empty image prompt in "${node.label}"`,
        detail: 'Add a description or {{Step.output}} for image generation.',
      });
    }
    if (node.type === 'weather' && !(s.city || '').trim()) {
      issues.push({
        id: `missing-city-${node.id}`,
        severity: 'error',
        nodeId: node.id,
        nodeLabel: node.label,
        title: `Missing city in "${node.label}"`,
        detail: 'Specify a city name or variable reference for weather lookup.',
      });
    }
    if (node.type === 'email') {
      if (!(s.to || '').trim() || !(s.body || '').trim()) {
        issues.push({
          id: `missing-email-${node.id}`,
          severity: 'error',
          nodeId: node.id,
          nodeLabel: node.label,
          title: `Incomplete email step "${node.label}"`,
          detail: 'Both Recipients and Email Body are required.',
        });
      }
    }
    if (node.type === 'webhook' && !(s.url || '').trim()) {
      issues.push({
        id: `missing-webhook-${node.id}`,
        severity: 'error',
        nodeId: node.id,
        nodeLabel: node.label,
        title: `Missing webhook URL in "${node.label}"`,
        detail: 'Provide an HTTPS webhook endpoint URL.',
      });
    }
    if (node.type === 'if') {
      const outEdges = edges.filter((e) => e.from === node.id);
      const hasYes = outEdges.some((e) => !e.branch || e.branch === 'yes');
      const hasNo = outEdges.some((e) => e.branch === 'no');
      if (!hasYes && !hasNo) {
        issues.push({
          id: `if-no-branches-${node.id}`,
          severity: 'warning',
          nodeId: node.id,
          nodeLabel: node.label,
          title: `Condition "${node.label}" has no outgoing branches`,
          detail: 'Connect YES and/or NO branches in Canvas view so branching has an effect.',
        });
      }
    }

    // Check placeholder references in every setting field
    for (const val of Object.values(s)) {
      if (typeof val !== 'string' || !val.includes('{{')) continue;
      const stepMatches = val.matchAll(/\{\{\s*([^}]+?)\.output\s*\}\}/gi);
      for (const m of stepMatches) {
        const ref = m[1].trim().toLowerCase();
        if (!validNodeKeys.has(ref)) {
          issues.push({
            id: `bad-ref-${node.id}-${ref}`,
            severity: 'error',
            nodeId: node.id,
            nodeLabel: node.label,
            title: `Broken reference {{${m[1].trim()}.output}}`,
            detail: `Step "${node.label}" references a step that does not exist in this pipeline.`,
          });
        }
      }
      const varMatches = val.matchAll(/\{\{\s*vars\.([^}\s]+)\s*\}\}/gi);
      for (const m of varMatches) {
        const ref = m[1].trim().toLowerCase();
        if (!definedVars.has(ref)) {
          issues.push({
            id: `bad-var-${node.id}-${ref}`,
            severity: 'warning',
            nodeId: node.id,
            nodeLabel: node.label,
            title: `Undefined variable {{vars.${m[1].trim()}}}`,
            detail: `Add "${m[1].trim()}" in Workflow Variables so it resolves cleanly at runtime.`,
          });
        }
      }
    }
  }

  if (estimatedPromptTokens > 16000) {
    issues.push({
      id: 'high-token-budget',
      severity: 'warning',
      title: `High token budget (~${(estimatedPromptTokens / 1000).toFixed(1)}k tokens)`,
      detail: 'Consider lowering Max Tokens on intermediate AI steps or freezing tested steps.',
    });
  }

  return issues;
}
