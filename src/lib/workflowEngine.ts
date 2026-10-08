import type {
  Workflow,
  WorkflowNode,
  WorkflowEdge,
  WorkflowOutput,
  WorkflowStepStatus,
  WeatherData,
} from '@/types';
import { api, BASE } from '@/services/api';
import { storage } from '@/lib/storage';
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
 * Replace {{Label.output}} or {{id.output}} in string with previous outputs.
 * Unknown placeholders are kept as is, with a warning emitted.
 */
export function resolvePlaceholders(
  text: string,
  outputsByLabel: Map<string, string>,
  outputsById: Map<string, string>,
  onWarning?: (warning: string) => void,
): string {
  if (!text || typeof text !== 'string') return text || '';
  return text.replace(/\{\{\s*([a-zA-Z0-9_\-\s.]+?)\.output\s*\}\}/gi, (match, rawKey) => {
    const key = rawKey.trim();
    // 1. Direct match by node ID
    if (outputsById.has(key)) {
      return outputsById.get(key)!;
    }
    // 2. Direct match by node Label (case-insensitive)
    for (const [lbl, val] of outputsByLabel.entries()) {
      if (lbl.trim().toLowerCase() === key.toLowerCase()) {
        return val;
      }
    }
    // 3. Unknown placeholder
    const warn = `Unknown placeholder: {{${key}.output}}`;
    if (onWarning) onWarning(warn);
    return match;
  });
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
      const activeProvider = storage.getActiveAIProvider();
      const res = await withRetry(async () => {
        return await api.aiChat(fullPrompt, [], '', activeProvider, false);
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

    default: {
      return { output: { type: 'text', value: '' } };
    }
  }
}

/**
 * Main workflow execution engine. Pure logic, NO React and NO UI code.
 */
export async function runWorkflow(
  workflow: Workflow,
  callbacks: WorkflowRunCallbacks,
): Promise<void> {
  if (!workflow || !workflow.nodes || workflow.nodes.length === 0) {
    return;
  }

  // 1. Detect loops/cycles BEFORE running
  if (hasWorkflowCycle(workflow.nodes, workflow.edges || [])) {
    const startNode = workflow.nodes.find((n) => n.type === 'input') || workflow.nodes[0];
    callbacks.onStatus(
      startNode.id,
      'error',
      undefined,
      'Cycle detected in workflow. Workflows must be a directed acyclic graph (DAG).',
    );
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
  const executedNodeIds = new Set<string>();

  // Queue of node IDs to visit
  const queue: string[] = [startNode.id];
  const enqueued = new Set<string>([startNode.id]);

  let stepCount = 0;
  const MAX_STEPS = 30;

  while (queue.length > 0) {
    if (callbacks.shouldStop()) {
      if (callbacks.onLog) callbacks.onLog('Workflow stopped by user.');
      break;
    }

    const currentId = queue.shift()!;
    const currentNode = nodeMap.get(currentId);
    if (!currentNode) continue;

    if (executedNodeIds.has(currentId)) {
      continue; // Each node runs only once
    }

    if (stepCount >= MAX_STEPS) {
      callbacks.onStatus(
        currentId,
        'error',
        undefined,
        'Workflow execution exceeded hard limit of 30 steps.',
      );
      break;
    }

    stepCount++;
    callbacks.onStatus(currentId, 'running');
    if (callbacks.onLog) {
      callbacks.onLog(`Running step "${currentNode.label}" (${currentNode.type})...`);
    }

    // Resolve placeholders in settings
    const resolvedSettings: Record<string, string> = {};
    for (const [k, v] of Object.entries(currentNode.settings || {})) {
      resolvedSettings[k] = resolvePlaceholders(
        v,
        outputsByLabel,
        outputsById,
        callbacks.onWarning,
      );
    }

    let stepResult: { output: WorkflowOutput; conditionPassed?: boolean };
    try {
      stepResult = await executeStep(currentNode, resolvedSettings);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      callbacks.onStatus(currentId, 'error', undefined, errMsg);
      if (callbacks.onLog) {
        callbacks.onLog(`Error in step "${currentNode.label}": ${errMsg}`);
      }
      // Stop the workflow on step error
      break;
    }

    // Mark done
    executedNodeIds.add(currentId);
    callbacks.onStatus(currentId, 'done', stepResult.output);
    outputsById.set(currentId, stepResult.output.value);
    outputsByLabel.set(currentNode.label, stepResult.output.value);

    // Follow outgoing edges
    const outgoingEdges = (workflow.edges || []).filter((e) => e.from === currentId);

    if (currentNode.type === 'if') {
      const branch: 'yes' | 'no' = stepResult.conditionPassed ? 'yes' : 'no';
      if (callbacks.onLog) {
        callbacks.onLog(
          `Condition evaluated to "${branch}". Following "${branch}" branch.`,
        );
      }
      for (const edge of outgoingEdges) {
        if (!edge.branch || edge.branch === branch) {
          if (!executedNodeIds.has(edge.to) && !enqueued.has(edge.to)) {
            queue.push(edge.to);
            enqueued.add(edge.to);
          }
        }
      }
    } else {
      for (const edge of outgoingEdges) {
        if (!executedNodeIds.has(edge.to) && !enqueued.has(edge.to)) {
          queue.push(edge.to);
          enqueued.add(edge.to);
        }
      }
    }
  }

  // Nodes not reachable from the start or on unchosen branches are marked 'skipped'
  for (const n of workflow.nodes) {
    if (!executedNodeIds.has(n.id)) {
      callbacks.onStatus(n.id, 'skipped');
    }
  }
}
