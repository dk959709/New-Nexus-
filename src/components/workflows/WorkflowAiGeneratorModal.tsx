import React, { useState } from 'react';
import { Sparkles, X, Loader2, Wand2, Layers, CheckCircle2, AlertCircle } from 'lucide-react';
import type { Workflow, WorkflowEdge, WorkflowNode, WorkflowNodeType, WorkflowVariable } from '@/types';
import { api } from '@/services/api';
import { storage } from '@/lib/storage';

interface WorkflowAiGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyWorkflow: (workflow: Workflow) => void;
}

const VALID_TYPES = new Set<WorkflowNodeType>([
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
  'transform',
  'merge',
]);

const QUICK_IDEAS = [
  {
    title: 'Competitor Research Brief',
    prompt: 'Take a company name, run web search + academic search, merge both findings, and write an executive SWOT summary.',
  },
  {
    title: 'Daily City Travel Briefing',
    prompt: 'Take a city name, fetch live weather and latest local news, then write a concise morning briefing with packing tips.',
  },
  {
    title: 'Article to Social Pack',
    prompt: 'Fetch a webpage URL, summarize key takeaways with AI, transform key points into clean bullets, and draft a LinkedIn + X post.',
  },
  {
    title: 'Space Visual Storyteller',
    prompt: 'Fetch NASA Astronomy Picture of the Day, explain the science in simple English, and generate a companion artwork prompt + image.',
  },
];

function extractJsonObject(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  try {
    const parsed = JSON.parse(candidate);
    if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>;
  } catch {
    // Fallback: locate outermost braces
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        const parsed = JSON.parse(candidate.slice(start, end + 1));
        if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>;
      } catch {
        return null;
      }
    }
  }
  return null;
}

function buildAutoLayoutNodes(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[] {
  if (nodes.length === 0) return [];
  const startNode = nodes.find((n) => n.type === 'input') || nodes[0];
  const depthMap = new Map<string, number>([[startNode.id, 0]]);
  const queue = [startNode.id];

  while (queue.length > 0) {
    const cur = queue.shift()!;
    const depth = depthMap.get(cur) || 0;
    for (const edge of edges) {
      if (edge.from === cur && !depthMap.has(edge.to)) {
        depthMap.set(edge.to, depth + 1);
        queue.push(edge.to);
      }
    }
  }

  const levels = new Map<number, WorkflowNode[]>();
  for (const n of nodes) {
    const d = depthMap.get(n.id) ?? 0;
    if (!levels.has(d)) levels.set(d, []);
    levels.get(d)!.push(n);
  }

  return nodes.map((n) => {
    const d = depthMap.get(n.id) ?? 0;
    const row = levels.get(d) || [n];
    const idx = row.findIndex((x) => x.id === n.id);
    return {
      ...n,
      x: 80 + d * 280,
      y: 120 + idx * 165,
    };
  });
}

export const WorkflowAiGeneratorModal: React.FC<WorkflowAiGeneratorModalProps> = ({
  isOpen,
  onClose,
  onApplyWorkflow,
}) => {
  const [goal, setGoal] = useState('');
  const [complexity, setComplexity] = useState<'compact' | 'balanced' | 'advanced'>('balanced');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewWorkflow, setPreviewWorkflow] = useState<Workflow | null>(null);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    const cleanedGoal = goal.trim();
    if (!cleanedGoal || isGenerating) return;
    setIsGenerating(true);
    setError(null);
    setPreviewWorkflow(null);

    const stepRange =
      complexity === 'compact' ? '3 to 4 steps' : complexity === 'advanced' ? '5 to 8 steps' : '4 to 5 steps';

    const systemPrompt = `You are a workflow pipeline architect. Return ONLY valid JSON (no prose, no markdown outside JSON) matching this exact schema:
{
  "name": "Short clear pipeline title (max 5 words)",
  "description": "One-sentence description of what this pipeline automates",
  "tags": ["tag1", "tag2"],
  "variables": [
    { "key": "tone", "label": "Output Tone", "defaultValue": "clear and concise", "description": "Optional writing style" }
  ],
  "nodes": [
    { "id": "n1", "type": "input", "label": "Input", "settings": { "text": "example input value" } },
    { "id": "n2", "type": "webSearch", "label": "Web Search", "settings": { "query": "{{Input.output}} latest insights" } }
  ],
  "edges": [
    { "from": "n1", "to": "n2" }
  ]
}
Allowed node types: input, webSearch, webFetch, scholar, ai, image, weather, nasa, if, document, email, webhook, transform, merge.
Rules:
- Start with exactly one "input" node (id "n1").
- Use ${stepRange}.
- Every placeholder must reference an earlier step label using {{StepLabel.output}} or a defined variable using {{vars.key}}.
- For "ai" nodes, include settings: { "role": "general"|"coder"|"architect"|"dataAnalyst", "prompt": "...", "maxTokens": "1500" }.
- For "transform" nodes, include settings: { "mode": "template"|"bullets"|"trim"|"uppercase"|"truncate"|"stats", "input": "{{Prev.output}}" }.
- For "merge" nodes, include settings: { "mode": "sections"|"join"|"numbered"|"json", "separator": "\\n\\n---\\n\\n" }.
- For "if" nodes, include settings: { "value1": "{{Prev.output}}", "operator": "contains"|"lengthGreaterThan"|"isNotEmpty", "value2": "..." } and set edge "branch": "yes" or "no".
- Keep graph strictly acyclic (DAG).`;

    try {
      const provider = storage.getActiveAIProvider();
      const response = await api.aiChat(
        `${systemPrompt}\n\nBuild a workflow for this goal:\n${cleanedGoal}`,
        [],
        '',
        provider ? { ...provider, maxTokens: 2200 } : null,
        false,
        { maxTokens: 2200 },
      );

      const parsed = extractJsonObject(response.answer || '');
      if (!parsed || !Array.isArray(parsed.nodes) || parsed.nodes.length === 0) {
        throw new Error('AI returned an invalid pipeline blueprint. Try rephrasing your goal.');
      }

      const now = Date.now();
      const idMap = new Map<string, string>();
      const rawNodes = parsed.nodes as Array<Record<string, unknown>>;

      const nodes: WorkflowNode[] = rawNodes.slice(0, 12).map((raw, idx) => {
        const oldId = String(raw.id || `n${idx + 1}`);
        const newId = `node-${now}-${idx + 1}`;
        idMap.set(oldId, newId);
        const rawType = String(raw.type || 'ai') as WorkflowNodeType;
        const safeType: WorkflowNodeType = VALID_TYPES.has(rawType) ? rawType : 'ai';
        const rawSettings =
          raw.settings && typeof raw.settings === 'object'
            ? (raw.settings as Record<string, unknown>)
            : {};
        const settings: Record<string, string> = {};
        for (const [k, v] of Object.entries(rawSettings)) {
          settings[k] = v === null || v === undefined ? '' : String(v);
        }
        return {
          id: newId,
          type: safeType,
          label: String(raw.label || `Step ${idx + 1}`).trim() || `Step ${idx + 1}`,
          x: 80 + idx * 260,
          y: 150,
          settings,
        };
      });

      const rawEdges = Array.isArray(parsed.edges)
        ? (parsed.edges as Array<Record<string, unknown>>)
        : [];
      let edges: WorkflowEdge[] = rawEdges
        .map((raw, idx) => {
          const from = idMap.get(String(raw.from || ''));
          const to = idMap.get(String(raw.to || ''));
          if (!from || !to || from === to) return null;
          const branch = raw.branch === 'yes' || raw.branch === 'no' ? raw.branch : undefined;
          return {
            id: `e-${now}-${idx}`,
            from,
            to,
            ...(branch ? { branch } : {}),
          };
        })
        .filter((e): e is WorkflowEdge => e !== null);

      if (edges.length === 0 && nodes.length > 1) {
        edges = nodes.slice(0, -1).map((n, idx) => ({
          id: `e-${now}-auto-${idx}`,
          from: n.id,
          to: nodes[idx + 1].id,
        }));
      }

      const laidOutNodes = buildAutoLayoutNodes(nodes, edges);
      const rawVars = Array.isArray(parsed.variables)
        ? (parsed.variables as Array<Record<string, unknown>>)
        : [];
      const variables: WorkflowVariable[] = rawVars
        .map((v) => ({
          key: String(v.key || '').replace(/[^a-zA-Z0-9_]/g, '').trim(),
          label: String(v.label || v.key || '').trim(),
          defaultValue: String(v.defaultValue ?? v.example ?? ''),
          description: v.description ? String(v.description) : undefined,
        }))
        .filter((v) => Boolean(v.key));

      const rawTags = Array.isArray(parsed.tags)
        ? parsed.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 5)
        : ['ai-generated'];

      const built: Workflow = {
        id: `workflow-${now}`,
        name: String(parsed.name || 'AI Pipeline').trim().slice(0, 60),
        description: String(parsed.description || cleanedGoal).trim(),
        tags: rawTags,
        variables,
        nodes: laidOutNodes,
        edges,
        updatedAt: now,
      };

      setPreviewWorkflow(built);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate workflow.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="wf-modal-backdrop fixed inset-0 z-[1300] bg-[#080b12]/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="wf-cyber-card wf-modal-panel rounded-t-3xl sm:rounded-2xl max-w-2xl w-full max-h-[92dvh] flex flex-col overflow-hidden shadow-[0_24px_64px_rgba(0,0,0,0.85)]">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400/20 to-violet-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shrink-0">
              <Wand2 size={18} />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-extrabold text-white tracking-tight truncate">
                AI Workflow Generator
              </h3>
              <p className="text-xs sm:text-sm text-zinc-400 truncate">
                Describe what you want to automate in plain English
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[42px] min-w-[42px] flex items-center justify-center rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-300 hover:text-white transition-colors"
            aria-label="Close AI Generator"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Quick Starters */}
          <div className="space-y-2">
            <label className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-300 block">
              Quick Ideas
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {QUICK_IDEAS.map((idea) => (
                <button
                  key={idea.title}
                  type="button"
                  onClick={() => setGoal(idea.prompt)}
                  className="p-3 rounded-xl bg-[#0c101a] hover:bg-[#131a2a] border border-white/10 hover:border-cyan-400/40 text-left transition-all"
                >
                  <div className="text-sm font-bold text-cyan-200">{idea.title}</div>
                  <p className="text-xs text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
                    {idea.prompt}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Prompt Textarea */}
          <div className="space-y-2">
            <label className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-300 block">
              Workflow Goal
            </label>
            <textarea
              rows={4}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="Example: Search recent AI breakthroughs on a topic, extract key metrics, summarize into 5 executive bullets, and format as a clean Markdown briefing..."
              className="wf-field-box w-full rounded-xl p-3.5 text-base sm:text-sm text-white placeholder-zinc-500 focus:outline-none leading-relaxed resize-y"
            />
          </div>

          {/* Complexity Selector */}
          <div className="space-y-2">
            <label className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-300 block">
              Pipeline Depth
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'compact', label: 'Compact', sub: '3–4 steps' },
                  { id: 'balanced', label: 'Balanced', sub: '4–5 steps' },
                  { id: 'advanced', label: 'Advanced', sub: '5–8 steps' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setComplexity(opt.id)}
                  className={`min-h-[48px] px-3 py-2 rounded-xl border text-center transition-all ${
                    complexity === opt.id
                      ? 'bg-cyan-500/15 border-cyan-400/60 text-cyan-200'
                      : 'bg-zinc-900/80 border-white/10 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <div className="text-sm font-bold">{opt.label}</div>
                  <div className="text-xs opacity-75">{opt.sub}</div>
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/40 text-rose-200 text-sm flex items-start gap-2.5">
              <AlertCircle size={18} className="shrink-0 mt-0.5 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Generated Blueprint Preview */}
          {previewWorkflow && (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-400/40 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-emerald-300 text-xs font-mono font-bold uppercase">
                    <CheckCircle2 size={14} />
                    <span>Blueprint Ready</span>
                  </div>
                  <h4 className="text-base font-extrabold text-white mt-1">
                    {previewWorkflow.name}
                  </h4>
                  {previewWorkflow.description && (
                    <p className="text-sm text-zinc-300 mt-0.5 leading-relaxed">
                      {previewWorkflow.description}
                    </p>
                  )}
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-zinc-900/90 border border-white/10 text-xs font-mono text-cyan-300 shrink-0">
                  {previewWorkflow.nodes.length} steps
                </span>
              </div>

              <div className="space-y-1.5 pt-1">
                {previewWorkflow.nodes.map((node, idx) => (
                  <div
                    key={node.id}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-[#0a0f18] border border-white/10 text-sm"
                  >
                    <span className="text-xs font-mono font-bold text-cyan-400 w-6">
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <span className="font-semibold text-white truncate">{node.label}</span>
                    <span className="ml-auto text-xs font-mono uppercase text-violet-300 bg-violet-500/15 px-2 py-0.5 rounded-md">
                      {node.type}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sticky Footer */}
        <div className="px-5 py-4 border-t border-white/10 bg-[#090d16] flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={!goal.trim() || isGenerating}
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-indigo-400 hover:brightness-110 disabled:opacity-40 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          >
            {isGenerating ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Architecting Pipeline...</span>
              </>
            ) : (
              <>
                <Sparkles size={16} />
                <span>{previewWorkflow ? 'Regenerate' : 'Generate Pipeline'}</span>
              </>
            )}
          </button>

          {previewWorkflow && (
            <button
              type="button"
              onClick={() => {
                onApplyWorkflow(previewWorkflow);
                onClose();
              }}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            >
              <Layers size={16} />
              <span>Create & Open Workflow</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
