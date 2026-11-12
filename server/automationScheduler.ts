import crypto from 'node:crypto';
import fs from 'node:fs';
import { resolve } from 'node:path';
import { requirePublicUrl } from './networkSafety.js';

export type AutomationNodeType =
  | 'input'
  | 'webSearch'
  | 'webFetch'
  | 'scholar'
  | 'ai'
  | 'image'
  | 'weather'
  | 'nasa'
  | 'if'
  | 'document'
  | 'email'
  | 'webhook';

export interface AutomationNode {
  id: string;
  type: AutomationNodeType;
  label: string;
  settings: Record<string, string>;
}

export interface AutomationEdge {
  id?: string;
  from: string;
  to: string;
  branch?: 'yes' | 'no';
}

export interface AutomationWorkflow {
  id: string;
  name: string;
  nodes: AutomationNode[];
  edges: AutomationEdge[];
}

export type AutomationScheduleKind = 'once' | 'daily' | 'interval';

export interface AutomationScheduleSpec {
  kind: AutomationScheduleKind;
  runAt?: string;
  time?: string;
  everyMinutes?: number;
}

export interface AutomationScheduleRecord {
  id: string;
  token: string;
  name: string;
  sourceId: string;
  goal: string;
  workflow: AutomationWorkflow;
  variables: Record<string, string>;
  spec: AutomationScheduleSpec;
  enabled: boolean;
  nextRunAt: number;
  lastRunAt?: number;
  lastStatus?: 'success' | 'error' | 'running';
  lastError?: string;
  lastDurationMs?: number;
  lastOutput?: string;
  createdAt: number;
  updatedAt: number;
}

export interface PublicAutomationSchedule {
  id: string;
  name: string;
  sourceId: string;
  goal: string;
  workflowName: string;
  nodeCount: number;
  variables: Record<string, string>;
  spec: AutomationScheduleSpec;
  enabled: boolean;
  nextRunAt: number;
  lastRunAt?: number;
  lastStatus?: 'success' | 'error' | 'running';
  lastError?: string;
  lastDurationMs?: number;
  lastOutput?: string;
  createdAt: number;
  updatedAt: number;
  webhookPath: string;
}

const ALLOWED_NODE_TYPES = new Set<AutomationNodeType>([
  'input',
  'webSearch',
  'webFetch',
  'scholar',
  'ai',
  'image',
  'weather',
  'nasa',
  'if',
  'document',
  'email',
  'webhook',
]);

const NODE_SETTING_KEYS: Record<AutomationNodeType, string[]> = {
  input: ['text'],
  webSearch: ['query'],
  webFetch: ['url'],
  scholar: ['query'],
  ai: ['role', 'prompt', 'maxTokens'],
  image: ['prompt'],
  weather: ['city'],
  nasa: [],
  if: ['value1', 'operator', 'value2'],
  document: ['url'],
  email: ['to', 'subject', 'body'],
  webhook: ['url', 'body'],
};

const MAX_NODES = 14;
const MAX_VARIABLES = 8;
const MAX_VARIABLE_VALUE = 2000;
const MAX_LAST_OUTPUT = 1200;
const DELIVERY_TYPES = new Set<AutomationNodeType>(['email', 'webhook']);

const DATA_DIR = resolve(process.cwd(), 'data');
const SCHEDULE_FILE = resolve(DATA_DIR, 'automation_schedules.json');
const schedules = new Map<string, AutomationScheduleRecord>();
const runningScheduleIds = new Set<string>();
const webhookHits = new Map<string, number[]>();

let schedulerTimer: NodeJS.Timeout | null = null;
let internalBaseUrl = process.env.AUTOMATION_INTERNAL_URL || 'http://127.0.0.1:3000';
let schedulerBusy = false;

function clampText(value: unknown, max: number): string {
  if (typeof value === 'string') return value.trim().slice(0, max);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value).slice(0, max);
  return '';
}

function safeLabel(value: unknown, fallback: string): string {
  const cleaned = clampText(value, 60).replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned || fallback;
}

function safeId(value: unknown, fallback: string): string {
  const cleaned = clampText(value, 80).replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return cleaned || fallback;
}

function normalizeVariableKey(value: unknown): string {
  return clampText(value, 40)
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32);
}

function hasWorkflowCycle(nodes: AutomationNode[], edges: AutomationEdge[]): boolean {
  const adjacency = new Map<string, string[]>();
  for (const node of nodes) adjacency.set(node.id, []);
  for (const edge of edges) adjacency.get(edge.from)?.push(edge.to);
  const state = new Map<string, number>();
  for (const node of nodes) state.set(node.id, 0);
  const visit = (id: string): boolean => {
    state.set(id, 1);
    for (const next of adjacency.get(id) || []) {
      if (state.get(next) === 1) return true;
      if (state.get(next) === 0 && visit(next)) return true;
    }
    state.set(id, 2);
    return false;
  };
  return nodes.some((node) => state.get(node.id) === 0 && visit(node.id));
}

function validateUrlSetting(type: AutomationNodeType, url: string, label: string): void {
  if (!url || url.includes('{{')) return;
  try {
    requirePublicUrl(url, { httpsOnly: type === 'webhook' });
  } catch (err) {
    throw new Error(`${label}: ${err instanceof Error ? err.message : 'Invalid URL.'}`);
  }
}

/**
 * Sanitize a workflow submitted through the schedule API. Rejects unsafe URLs,
 * unknown node types, invalid graphs, and oversized settings.
 */
export function normalizeAutomationWorkflow(raw: unknown): AutomationWorkflow {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};
  const rawNodes = Array.isArray(source.nodes) ? source.nodes : [];
  if (rawNodes.length < 2) throw new Error('A workflow needs at least two steps.');
  if (rawNodes.length > MAX_NODES) throw new Error(`Workflows are limited to ${MAX_NODES} steps.`);

  const usedIds = new Set<string>();
  const usedLabels = new Set<string>();
  const nodes: AutomationNode[] = [];
  for (let index = 0; index < rawNodes.length; index += 1) {
    const item = rawNodes[index];
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Invalid workflow step.');
    const candidate = item as Record<string, unknown>;
    const type = ALLOWED_NODE_TYPES.has(candidate.type as AutomationNodeType)
      ? (candidate.type as AutomationNodeType)
      : null;
    if (!type) throw new Error(`Unsupported step type: ${String(candidate.type || 'unknown')}.`);

    let id = safeId(candidate.id, `node-${index + 1}`);
    if (usedIds.has(id)) id = `${id}-${index + 1}`;
    while (usedIds.has(id)) id = `${id}-${nodes.length + 1}`;
    usedIds.add(id);

    let label = safeLabel(candidate.label, type === 'input' ? 'Input' : type);
    if (usedLabels.has(label.toLowerCase())) {
      const base = label;
      let suffix = 2;
      while (usedLabels.has(`${base} ${suffix}`.toLowerCase())) suffix += 1;
      label = `${base} ${suffix}`;
    }
    usedLabels.add(label.toLowerCase());

    const rawSettings = candidate.settings && typeof candidate.settings === 'object' && !Array.isArray(candidate.settings)
      ? (candidate.settings as Record<string, unknown>)
      : {};
    const settings: Record<string, string> = {};
    for (const key of NODE_SETTING_KEYS[type]) {
      settings[key] = clampText(rawSettings[key], key === 'prompt' || key === 'text' || key === 'body' ? 6000 : key === 'url' ? 1200 : 500);
    }
    if (type === 'input' && !settings.text) throw new Error(`${label}: input text is empty.`);
    if (type === 'webSearch' && !settings.query) throw new Error(`${label}: search query is empty.`);
    if (type === 'scholar' && !settings.query) throw new Error(`${label}: scholar query is empty.`);
    if (type === 'webFetch') {
      if (!settings.url) throw new Error(`${label}: web fetch URL is empty.`);
      validateUrlSetting(type, settings.url, label);
    }
    if (type === 'ai' && !settings.prompt) throw new Error(`${label}: AI prompt is empty.`);
    if (type === 'image' && !settings.prompt) throw new Error(`${label}: image prompt is empty.`);
    if (type === 'weather' && !settings.city) throw new Error(`${label}: weather city is empty.`);
    if (type === 'document') {
      if (!settings.url) throw new Error(`${label}: document URL is empty.`);
      validateUrlSetting(type, settings.url, label);
    }
    if (type === 'email') {
      if (!settings.to) throw new Error(`${label}: email recipient is empty.`);
      if (!settings.body) throw new Error(`${label}: email body is empty.`);
    }
    if (type === 'webhook') {
      if (!settings.url) throw new Error(`${label}: webhook URL is empty.`);
      validateUrlSetting(type, settings.url, label);
    }
    if (type === 'if' && !settings.operator) settings.operator = 'contains';
    if (type === 'ai') {
      const tokens = parseInt(settings.maxTokens || '1500', 10);
      settings.maxTokens = String(Math.max(200, Math.min(4000, Number.isNaN(tokens) ? 1500 : tokens)));
    }
    nodes.push({ id, type, label, settings });
  }

  const inputs = nodes.filter((node) => node.type === 'input');
  if (inputs.length !== 1) throw new Error('A workflow must have exactly one Input step.');
  const nodeIds = new Set(nodes.map((node) => node.id));
  const ifIds = new Set(nodes.filter((node) => node.type === 'if').map((node) => node.id));

  const rawEdges = Array.isArray(source.edges) ? source.edges : [];
  if (rawEdges.length > 40) throw new Error('Too many workflow connections.');
  const edges: AutomationEdge[] = [];
  const edgeKeys = new Set<string>();
  const edgeIds = new Set<string>();
  for (let index = 0; index < rawEdges.length; index += 1) {
    const item = rawEdges[index];
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Invalid workflow connection.');
    const candidate = item as Record<string, unknown>;
    const from = clampText(candidate.from, 80);
    const to = clampText(candidate.to, 80);
    if (!nodeIds.has(from) || !nodeIds.has(to) || from === to) throw new Error('Invalid workflow connection.');
    const branch = candidate.branch === 'yes' || candidate.branch === 'no' ? candidate.branch : undefined;
    if (ifIds.has(from) && !branch) throw new Error('Conditional steps must use yes or no branches.');
    const key = `${from}|${to}|${branch || ''}`;
    if (edgeKeys.has(key)) continue;
    edgeKeys.add(key);
    let id = safeId(candidate.id, `edge-${index + 1}`);
    if (edgeIds.has(id)) id = `${id}-${index + 1}`;
    while (edgeIds.has(id)) id = `${id}-${edges.length + 1}`;
    edgeIds.add(id);
    edges.push({ id, from, to, ...(branch ? { branch } : {}) });
  }

  if (hasWorkflowCycle(nodes, edges)) throw new Error('Workflow loops are not allowed.');
  const aiCount = nodes.filter((node) => node.type === 'ai').length;
  const imageCount = nodes.filter((node) => node.type === 'image').length;
  const searchCount = nodes.filter((node) => node.type === 'webSearch').length;
  const fetchCount = nodes.filter((node) => node.type === 'webFetch').length;
  const scholarCount = nodes.filter((node) => node.type === 'scholar').length;
  const deliveryCount = nodes.filter((node) => DELIVERY_TYPES.has(node.type)).length;
  if (aiCount > 8) throw new Error('Workflows are limited to 8 AI steps.');
  if (searchCount > 8) throw new Error('Workflows are limited to 8 web searches.');
  if (fetchCount > 8) throw new Error('Workflows are limited to 8 web fetches.');
  if (imageCount > 2) throw new Error('Workflows are limited to 2 image steps.');
  if (scholarCount > 4) throw new Error('Workflows are limited to 4 Scholar steps.');
  if (deliveryCount > 4) throw new Error('Workflows are limited to 4 delivery steps.');

  return {
    id: safeId(source.id, `workflow-${Date.now()}`),
    name: safeLabel(source.name, 'Scheduled Automation'),
    nodes,
    edges,
  };
}

export function normalizeVariableValues(raw: unknown, workflow?: AutomationWorkflow): Record<string, string> {
  const output: Record<string, string> = {};
  const add = (key: unknown, value: unknown) => {
    const normalizedKey = normalizeVariableKey(key);
    if (!normalizedKey || Object.keys(output).length >= MAX_VARIABLES) return;
    output[normalizedKey] = clampText(value, MAX_VARIABLE_VALUE);
  };
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const candidate = item as Record<string, unknown>;
        add(candidate.key, candidate.value ?? candidate.defaultValue);
      }
    }
  } else if (raw && typeof raw === 'object') {
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) add(key, value);
  }
  if (workflow) {
    for (const node of workflow.nodes) {
      for (const value of Object.values(node.settings)) {
        for (const match of String(value).matchAll(/\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g)) {
          const key = normalizeVariableKey(match[1]);
          if (key && output[key] === undefined && Object.keys(output).length < MAX_VARIABLES) output[key] = '';
        }
      }
    }
  }
  return output;
}

function applyVariables(workflow: AutomationWorkflow, values: Record<string, string>): AutomationWorkflow {
  return {
    ...workflow,
    nodes: workflow.nodes.map((node) => ({
      ...node,
      settings: Object.fromEntries(
        Object.entries(node.settings).map(([key, value]) => [
          key,
          value.replace(/\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g, (match, variableKey: string) => {
            const replacement = values[variableKey];
            return replacement !== undefined && replacement !== '' ? replacement : match;
          }),
        ]),
      ),
    })),
  };
}

export function normalizeScheduleSpec(raw: unknown, options: { allowPast?: boolean } = {}): AutomationScheduleSpec {
  const candidate = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};
  const kind = candidate.kind === 'once' || candidate.kind === 'interval' ? candidate.kind : 'daily';
  if (kind === 'once') {
    const runAt = clampText(candidate.runAt, 60);
    const runAtMs = Date.parse(runAt);
    if (!runAt || Number.isNaN(runAtMs)) throw new Error('Choose a valid one-time run date.');
    if (!options.allowPast && runAtMs < Date.now() - 60_000) throw new Error('The one-time run date is in the past.');
    return { kind, runAt: new Date(runAtMs).toISOString() };
  }
  if (kind === 'interval') {
    const everyMinutes = Math.round(Number(candidate.everyMinutes));
    if (!Number.isFinite(everyMinutes) || everyMinutes < 5 || everyMinutes > 10080) {
      throw new Error('Interval schedules must run between every 5 minutes and every 7 days.');
    }
    return { kind, everyMinutes };
  }
  const time = clampText(candidate.time, 5);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('Choose a valid daily time (HH:MM).');
  return { kind, time };
}

function computeNextRunAt(spec: AutomationScheduleSpec, after = Date.now()): number {
  if (spec.kind === 'once') {
    return spec.runAt ? Date.parse(spec.runAt) : after;
  }
  if (spec.kind === 'interval') {
    return after + Math.max(5, spec.everyMinutes || 60) * 60_000;
  }
  const [hour, minute] = (spec.time || '09:00').split(':').map((part) => parseInt(part, 10));
  const next = new Date(after);
  next.setSeconds(0, 0);
  next.setHours(hour, minute, 0, 0);
  if (next.getTime() <= after) next.setDate(next.getDate() + 1);
  return next.getTime();
}

function loadSchedules(): void {
  try {
    if (!fs.existsSync(SCHEDULE_FILE)) return;
    const raw = JSON.parse(fs.readFileSync(SCHEDULE_FILE, 'utf8')) as unknown;
    if (!Array.isArray(raw)) return;
    for (const item of raw) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
      const candidate = item as Record<string, unknown>;
      try {
        const workflow = normalizeAutomationWorkflow(candidate.workflow);
        const spec = normalizeScheduleSpec(candidate.spec, { allowPast: true });
        const id = safeId(candidate.id, `schedule-${Date.now()}`);
        const token = clampText(candidate.token, 80) || crypto.randomBytes(24).toString('hex');
        schedules.set(id, {
          id,
          token,
          name: safeLabel(candidate.name, workflow.name),
          sourceId: clampText(candidate.sourceId, 100),
          goal: clampText(candidate.goal, 1000),
          workflow,
          variables: normalizeVariableValues(candidate.variables, workflow),
          spec,
          enabled: candidate.enabled !== false,
          nextRunAt: typeof candidate.nextRunAt === 'number' && Number.isFinite(candidate.nextRunAt)
            ? candidate.nextRunAt
            : computeNextRunAt(spec),
          lastRunAt: typeof candidate.lastRunAt === 'number' ? candidate.lastRunAt : undefined,
          lastStatus: candidate.lastStatus === 'success' || candidate.lastStatus === 'error' || candidate.lastStatus === 'running'
            ? candidate.lastStatus
            : undefined,
          lastError: clampText(candidate.lastError, 800) || undefined,
          lastDurationMs: typeof candidate.lastDurationMs === 'number' ? candidate.lastDurationMs : undefined,
          lastOutput: clampText(candidate.lastOutput, MAX_LAST_OUTPUT) || undefined,
          createdAt: typeof candidate.createdAt === 'number' ? candidate.createdAt : Date.now(),
          updatedAt: typeof candidate.updatedAt === 'number' ? candidate.updatedAt : Date.now(),
        });
      } catch (err) {
        console.warn('[Automation Scheduler] Skipping invalid schedule:', err instanceof Error ? err.message : err);
      }
    }
  } catch (err) {
    console.error('[Automation Scheduler] Failed to load schedules:', err);
  }
}

function saveSchedules(): void {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tempPath = `${SCHEDULE_FILE}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(Array.from(schedules.values()), null, 2), {
      encoding: 'utf8',
      mode: 0o600,
    });
    fs.renameSync(tempPath, SCHEDULE_FILE);
  } catch (err) {
    console.error('[Automation Scheduler] Failed to save schedules:', err);
  }
}

loadSchedules();

function publicSchedule(record: AutomationScheduleRecord): PublicAutomationSchedule {
  return {
    id: record.id,
    name: record.name,
    sourceId: record.sourceId,
    goal: record.goal,
    workflowName: record.workflow.name,
    nodeCount: record.workflow.nodes.length,
    variables: record.variables,
    spec: record.spec,
    enabled: record.enabled,
    nextRunAt: record.nextRunAt,
    lastRunAt: record.lastRunAt,
    lastStatus: record.lastStatus,
    lastError: record.lastError,
    lastDurationMs: record.lastDurationMs,
    lastOutput: record.lastOutput,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    webhookPath: `/api/automation/hooks/${record.token}`,
  };
}

export function listAutomationSchedules(): PublicAutomationSchedule[] {
  return Array.from(schedules.values())
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map(publicSchedule);
}

export interface CreateAutomationScheduleInput {
  name?: unknown;
  sourceId?: unknown;
  goal?: unknown;
  workflow: unknown;
  variables?: unknown;
  spec: unknown;
  enabled?: unknown;
}

export function createAutomationSchedule(input: CreateAutomationScheduleInput): PublicAutomationSchedule {
  const workflow = normalizeAutomationWorkflow(input.workflow);
  const spec = normalizeScheduleSpec(input.spec);
  const now = Date.now();
  const id = `schedule-${now}-${crypto.randomBytes(4).toString('hex')}`;
  const record: AutomationScheduleRecord = {
    id,
    token: crypto.randomBytes(24).toString('hex'),
    name: safeLabel(input.name, workflow.name),
    sourceId: clampText(input.sourceId, 100),
    goal: clampText(input.goal, 1000),
    workflow,
    variables: normalizeVariableValues(input.variables, workflow),
    spec,
    enabled: input.enabled !== false,
    nextRunAt: computeNextRunAt(spec),
    createdAt: now,
    updatedAt: now,
  };
  schedules.set(id, record);
  saveSchedules();
  return publicSchedule(record);
}

export function updateAutomationSchedule(
  id: string,
  input: Partial<CreateAutomationScheduleInput> & { enabled?: unknown },
): PublicAutomationSchedule {
  const record = schedules.get(id);
  if (!record) throw new Error('Schedule not found.');
  if (input.workflow !== undefined) record.workflow = normalizeAutomationWorkflow(input.workflow);
  if (input.variables !== undefined) record.variables = normalizeVariableValues(input.variables, record.workflow);
  if (input.spec !== undefined) {
    record.spec = normalizeScheduleSpec(input.spec);
    record.nextRunAt = computeNextRunAt(record.spec);
  }
  if (input.name !== undefined) record.name = safeLabel(input.name, record.workflow.name);
  if (input.sourceId !== undefined) record.sourceId = clampText(input.sourceId, 100);
  if (input.goal !== undefined) record.goal = clampText(input.goal, 1000);
  if (input.enabled !== undefined) {
    record.enabled = input.enabled !== false;
    if (record.enabled && !record.nextRunAt) {
      record.nextRunAt = computeNextRunAt(record.spec);
    }
  }
  record.updatedAt = Date.now();
  saveSchedules();
  return publicSchedule(record);
}

export function deleteAutomationSchedule(id: string): boolean {
  const deleted = schedules.delete(id);
  if (deleted) saveSchedules();
  return deleted;
}

export function findScheduleByToken(token: string): AutomationScheduleRecord | null {
  if (!token || token.length < 20) return null;
  for (const record of schedules.values()) {
    const expected = Buffer.from(record.token);
    const supplied = Buffer.from(token);
    if (expected.length === supplied.length && crypto.timingSafeEqual(expected, supplied)) return record;
  }
  return null;
}

export function consumeWebhookLimit(token: string, limit = 10, windowMs = 60_000): boolean {
  const now = Date.now();
  const recent = (webhookHits.get(token) || []).filter((time) => now - time < windowMs);
  if (recent.length >= limit) {
    webhookHits.set(token, recent);
    return false;
  }
  recent.push(now);
  webhookHits.set(token, recent);
  return true;
}

function internalError(payload: unknown, status: number): string {
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    if (typeof record.error === 'string') return record.error;
    if (record.error && typeof record.error === 'object') {
      const nested = record.error as Record<string, unknown>;
      if (typeof nested.message === 'string') return nested.message;
    }
    if (typeof record.message === 'string') return record.message;
  }
  return `Internal service returned HTTP ${status}.`;
}

async function internalRequest(
  path: string,
  init?: { method?: 'GET' | 'POST'; body?: unknown; timeoutMs?: number },
): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), init?.timeoutMs || 120_000);
  try {
    const response = await fetch(`${internalBaseUrl}${path}`, {
      method: init?.method || (init?.body === undefined ? 'GET' : 'POST'),
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'NEXUS-AutomationRunner/1.0',
      },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
      signal: controller.signal,
    });
    const text = await response.text();
    let payload: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) payload = parsed as Record<string, unknown>;
    } catch {
      // Keep the empty payload and report the HTTP status.
    }
    if (!response.ok) throw new Error(internalError(payload, response.status));
    if (payload.ok === false) throw new Error(internalError(payload, response.status));
    return payload;
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Internal automation request timed out.');
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

function resolvePlaceholders(
  text: string,
  outputsByLabel: Map<string, string>,
  outputsById: Map<string, string>,
): string {
  return String(text || '').replace(/\{\{\s*([^}]+?)\.output\s*\}\}/gi, (match, rawKey) => {
    const key = String(rawKey).trim();
    if (outputsById.has(key)) return outputsById.get(key)!;
    for (const [id, value] of outputsById.entries()) {
      if (id.toLowerCase() === key.toLowerCase()) return value;
    }
    for (const [label, value] of outputsByLabel.entries()) {
      if (label.toLowerCase() === key.toLowerCase()) return value;
    }
    return match;
  });
}

function resolveSettings(
  node: AutomationNode,
  nodes: AutomationNode[],
  outputs: Map<string, { value: string; type: string }>,
): Record<string, string> {
  const byLabel = new Map<string, string>();
  const byId = new Map<string, string>();
  for (const item of nodes) {
    const output = outputs.get(item.id);
    if (output) {
      byId.set(item.id, output.value);
      byLabel.set(item.label, output.value);
    }
  }
  return Object.fromEntries(
    Object.entries(node.settings).map(([key, value]) => [key, resolvePlaceholders(value, byLabel, byId)]),
  );
}

function evaluateCondition(settings: Record<string, string>): boolean {
  const value1 = settings.value1 || '';
  const value2 = settings.value2 || '';
  switch (settings.operator || 'contains') {
    case 'notContains':
      return !value1.toLowerCase().includes(value2.toLowerCase());
    case 'equals':
      return value1.trim() === value2.trim();
    case 'isEmpty':
      return value1.trim().length === 0;
    case 'isNotEmpty':
      return value1.trim().length > 0;
    case 'lengthGreaterThan':
      return value1.length > (Number(value2) || 0);
    case 'lengthLessThan':
      return value1.length < (Number(value2) || 0);
    case 'contains':
    default:
      return value1.toLowerCase().includes(value2.toLowerCase());
  }
}

async function executeNode(
  node: AutomationNode,
  settings: Record<string, string>,
): Promise<{ value: string; type: 'text' | 'json' | 'image'; conditionPassed?: boolean }> {
  switch (node.type) {
    case 'input':
      return { value: settings.text || '', type: 'text' };
    case 'webSearch': {
      const payload = await internalRequest('/api/search', {
        body: { query: settings.query || '', page: 1, max_results: 5 },
      });
      const results = Array.isArray(payload.data) ? (payload.data as Array<Record<string, unknown>>) : [];
      const text = results.length > 0
        ? results.map((result, index) => `[${index + 1}] ${String(result.title || '')}\n${String(result.description || '')}\n${String(result.url || '')}`).join('\n\n')
        : 'No search results found.';
      return { value: text, type: 'text' };
    }
    case 'webFetch': {
      const payload = await internalRequest('/api/web/fetch', { body: { url: settings.url || '' } });
      const data = (payload.data || {}) as Record<string, unknown>;
      const text = String(data.textContent || data.description || '').trim().slice(0, 6000);
      if (!text) throw new Error('No readable content was returned by Web Fetch.');
      return { value: text, type: 'text' };
    }
    case 'scholar': {
      const payload = await internalRequest('/api/scholar/search', {
        body: { question: settings.query || '', query: settings.query || '' },
      });
      const papers = Array.isArray(payload.papers) ? (payload.papers as Array<Record<string, unknown>>) : [];
      if (papers.length === 0) return { value: 'No papers found.', type: 'text' };
      return {
        value: papers.slice(0, 8).map((paper, index) => {
          const authors = Array.isArray(paper.authors) ? paper.authors.slice(0, 3).join(', ') : 'Unknown authors';
          const abstract = String(paper.abstract || '').slice(0, 400);
          return `[${index + 1}] "${String(paper.title || 'Untitled')}" - ${authors}${paper.year ? ` (${paper.year})` : ''}.\n${abstract}`;
        }).join('\n\n'),
        type: 'text',
      };
    }
    case 'ai': {
      const role = settings.role || 'general';
      const roleLine =
        role === 'coder'
          ? 'You are an expert software engineer. Give working, clean code with short explanations.\n\n'
          : role === 'architect'
            ? 'You are a senior system architect. Give clear structure, components and trade-offs.\n\n'
            : role === 'dataAnalyst'
              ? 'You are a careful data analyst. Show steps and numbers clearly.\n\n'
              : '';
      const maxTokens = Math.max(200, Math.min(4000, parseInt(settings.maxTokens || '1500', 10) || 1500));
      const payload = await internalRequest('/api/ai/chat', {
        body: {
          message: `${roleLine}${settings.prompt || ''}`.trim(),
          webSearch: false,
          maxTokens,
          timeoutMs: 120000,
        },
        timeoutMs: 130_000,
      });
      const data = (payload.data || {}) as Record<string, unknown>;
      return { value: String(data.answer || ''), type: 'text' };
    }
    case 'image': {
      const payload = await internalRequest('/api/image/flux-schnell', {
        body: { prompt: settings.prompt || '' },
        timeoutMs: 120_000,
      });
      const data = (payload.data || payload) as Record<string, unknown>;
      const image = String(data.image || data.dataUrl || data.output || '');
      if (!image) throw new Error('Image generation returned no image.');
      return { value: image, type: 'image' };
    }
    case 'weather': {
      const payload = await internalRequest(`/api/weather?city=${encodeURIComponent(settings.city || '')}`);
      const data = (payload.data || {}) as Record<string, unknown>;
      const current = (data.current || {}) as Record<string, unknown>;
      const daily = Array.isArray(data.daily) ? (data.daily as Array<Record<string, unknown>>) : [];
      const today = daily[0] || {};
      return {
        value: `${String(current.location || settings.city || '')}: ${String(current.temperature ?? '?')}°C, ${String(current.conditionLabel || current.condition || '')}. Wind: ${String(current.wind ?? '?')} km/h, Humidity: ${String(current.humidity ?? '?')}%${today.high !== undefined ? ` | High: ${today.high}° / Low: ${today.low}°` : ''}.`,
        type: 'text',
      };
    }
    case 'nasa': {
      const payload = await internalRequest('/api/nasa/apod');
      const data = (payload.data || {}) as Record<string, unknown>;
      return {
        value: `Title: ${String(data.title || 'APOD')}\nDate: ${String(data.date || '')}\nExplanation: ${String(data.explanation || '')}\nImage: ${String(data.hdurl || data.url || '')}`.trim(),
        type: 'text',
      };
    }
    case 'document': {
      const payload = await internalRequest('/api/documents/extract-url', {
        body: { url: settings.url || '' },
        timeoutMs: 60_000,
      });
      const data = (payload.data || {}) as Record<string, unknown>;
      const text = String(data.text || '').trim();
      if (!text) throw new Error('Document contained no readable text.');
      return { value: text.slice(0, 8000), type: 'text' };
    }
    case 'email': {
      const payload = await internalRequest('/api/integrations/email', {
        body: {
          to: settings.to || '',
          subject: settings.subject || 'NEXUS Automation result',
          body: settings.body || '',
        },
        timeoutMs: 30_000,
      });
      const data = (payload.data || {}) as Record<string, unknown>;
      return { value: `Email sent to ${Array.isArray(data.recipients) ? data.recipients.join(', ') : settings.to}.`, type: 'text' };
    }
    case 'webhook': {
      const payload = await internalRequest('/api/integrations/webhook', {
        body: { url: settings.url || '', body: settings.body || '' },
        timeoutMs: 30_000,
      });
      const data = (payload.data || {}) as Record<string, unknown>;
      return { value: `Webhook delivered (HTTP ${String(data.status || 200)}).`, type: 'text' };
    }
    case 'if': {
      return { value: settings.value1 || '', type: 'text', conditionPassed: evaluateCondition(settings) };
    }
    default:
      throw new Error(`Unsupported node type: ${node.type}`);
  }
}

export interface AutomationRunResult {
  status: 'success' | 'error';
  finalOutput: string;
  finalOutputType: 'text' | 'json' | 'image';
  durationMs: number;
  steps: Array<{
    nodeId: string;
    label: string;
    type: AutomationNodeType;
    status: 'done' | 'error' | 'skipped';
    output?: string;
    error?: string;
  }>;
}

export async function runAutomationWorkflow(
  workflow: AutomationWorkflow,
  variables: Record<string, string> = {},
): Promise<AutomationRunResult> {
  const startedAt = Date.now();
  const applied = normalizeAutomationWorkflow(applyVariables(workflow, variables));
  const inputNode = applied.nodes.find((node) => node.type === 'input');
  if (!inputNode) throw new Error('Workflow has no input step.');

  const reachable = new Set<string>([inputNode.id]);
  const reachQueue = [inputNode.id];
  const outgoing = new Map<string, AutomationEdge[]>();
  for (const edge of applied.edges) {
    if (!outgoing.has(edge.from)) outgoing.set(edge.from, []);
    outgoing.get(edge.from)!.push(edge);
  }
  while (reachQueue.length > 0) {
    const current = reachQueue.shift()!;
    for (const edge of outgoing.get(current) || []) {
      if (!reachable.has(edge.to)) {
        reachable.add(edge.to);
        reachQueue.push(edge.to);
      }
    }
  }

  const indegree = new Map<string, number>();
  for (const node of applied.nodes) indegree.set(node.id, 0);
  for (const edge of applied.edges) {
    if (reachable.has(edge.from) && reachable.has(edge.to)) {
      indegree.set(edge.to, (indegree.get(edge.to) || 0) + 1);
    }
  }
  const topoQueue = applied.nodes
    .filter((node) => reachable.has(node.id) && (indegree.get(node.id) || 0) === 0)
    .map((node) => node.id);
  const order: string[] = [];
  while (topoQueue.length > 0) {
    const id = topoQueue.shift()!;
    order.push(id);
    for (const edge of outgoing.get(id) || []) {
      if (!reachable.has(edge.to)) continue;
      indegree.set(edge.to, (indegree.get(edge.to) || 0) - 1);
      if ((indegree.get(edge.to) || 0) === 0) topoQueue.push(edge.to);
    }
  }

  const nodeMap = new Map(applied.nodes.map((node) => [node.id, node]));
  const outputs = new Map<string, { value: string; type: 'text' | 'json' | 'image' }>();
  const executed = new Set<string>();
  const ifResults = new Map<string, 'yes' | 'no'>();
  const steps: AutomationRunResult['steps'] = [];
  let lastOutput: { value: string; type: 'text' | 'json' | 'image' } | null = null;

  for (const nodeId of order) {
    const node = nodeMap.get(nodeId);
    if (!node) continue;
    if (node.id !== inputNode.id) {
      const incoming = applied.edges.filter((edge) => edge.to === node.id && reachable.has(edge.from));
      const activeIncoming = incoming.filter((edge) => {
        if (!executed.has(edge.from)) return false;
        const parent = nodeMap.get(edge.from);
        if (parent?.type === 'if' && edge.branch) {
          return ifResults.get(parent.id) === edge.branch;
        }
        return true;
      });
      if (activeIncoming.length === 0) {
        steps.push({ nodeId: node.id, label: node.label, type: node.type, status: 'skipped' });
        continue;
      }
    }

    try {
      const settings = resolveSettings(node, applied.nodes, outputs);
      const result = await executeNode(node, settings);
      outputs.set(node.id, { value: result.value, type: result.type });
      executed.add(node.id);
      lastOutput = { value: result.value, type: result.type };
      if (node.type === 'if') ifResults.set(node.id, result.conditionPassed ? 'yes' : 'no');
      steps.push({
        nodeId: node.id,
        label: node.label,
        type: node.type,
        status: 'done',
        output: result.type === 'image' ? '[1 image]' : result.value.slice(0, 300),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      steps.push({ nodeId: node.id, label: node.label, type: node.type, status: 'error', error: message });
      return {
        status: 'error',
        finalOutput: lastOutput?.value || '',
        finalOutputType: lastOutput?.type || 'text',
        durationMs: Date.now() - startedAt,
        steps,
      };
    }
  }

  return {
    status: 'success',
    finalOutput: lastOutput?.value || '',
    finalOutputType: lastOutput?.type || 'text',
    durationMs: Date.now() - startedAt,
    steps,
  };
}

/**
 * Execute a stored schedule. Status is persisted before and after the run so
 * the UI can poll for completion.
 */
export async function runAutomationScheduleNow(
  id: string,
  variables?: Record<string, string>,
): Promise<AutomationRunResult | null> {
  const record = schedules.get(id);
  if (!record) throw new Error('Schedule not found.');
  if (runningScheduleIds.has(id)) return null;

  runningScheduleIds.add(id);
  record.lastStatus = 'running';
  record.lastError = undefined;
  record.updatedAt = Date.now();
  saveSchedules();
  const startedAt = Date.now();
  try {
    const merged = normalizeVariableValues({ ...record.variables, ...(variables || {}) }, record.workflow);
    const result = await runAutomationWorkflow(record.workflow, merged);
    record.lastRunAt = Date.now();
    record.lastDurationMs = Date.now() - startedAt;
    record.lastStatus = result.status;
    record.lastError = result.status === 'error'
      ? result.steps.find((step) => step.status === 'error')?.error || 'Run failed.'
      : undefined;
    record.lastOutput = result.finalOutputType === 'image'
      ? '[1 image]'
      : result.finalOutput.slice(0, MAX_LAST_OUTPUT);
    record.updatedAt = Date.now();
    return result;
  } catch (err: unknown) {
    record.lastRunAt = Date.now();
    record.lastDurationMs = Date.now() - startedAt;
    record.lastStatus = 'error';
    record.lastError = err instanceof Error ? err.message : String(err);
    record.updatedAt = Date.now();
    throw err;
  } finally {
    runningScheduleIds.delete(id);
    saveSchedules();
  }
}

async function schedulerTick(): Promise<void> {
  if (schedulerBusy) return;
  schedulerBusy = true;
  try {
    const now = Date.now();
    const due = Array.from(schedules.values()).filter(
      (record) => record.enabled && record.nextRunAt > 0 && record.nextRunAt <= now,
    );
    for (const record of due) {
      if (runningScheduleIds.has(record.id)) continue;
      if (record.spec.kind === 'once') {
        record.enabled = false;
        record.nextRunAt = 0;
      } else {
        record.nextRunAt = computeNextRunAt(record.spec, now);
      }
      record.updatedAt = Date.now();
      saveSchedules();
      void runAutomationScheduleNow(record.id).catch((err) => {
        console.error(`[Automation Scheduler] Run failed for ${record.name}:`, err);
      });
    }
  } finally {
    schedulerBusy = false;
  }
}

export function startAutomationScheduler(baseUrl?: string, tickMs = 30_000): void {
  if (baseUrl) internalBaseUrl = baseUrl.replace(/\/+$/, '');
  if (schedulerTimer) return;
  schedulerTimer = setInterval(() => {
    void schedulerTick();
  }, tickMs);
  schedulerTimer.unref?.();
  setTimeout(() => {
    void schedulerTick();
  }, 5_000).unref?.();
  console.log(`[Automation Scheduler] Started (${schedules.size} schedule${schedules.size === 1 ? '' : 's'}).`);
}

export function stopAutomationScheduler(): void {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
}
