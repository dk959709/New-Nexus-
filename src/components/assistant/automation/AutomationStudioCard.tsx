import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronUp,
  CloudSun,
  Download,
  ExternalLink,
  FileText,
  GitBranch,
  Globe,
  GraduationCap,
  History,
  Image as ImageIcon,
  LayoutTemplate,
  Loader2,
  Play,
  Rocket,
  Mail,
  Webhook,
  RotateCcw,
  Save,
  Search,
  Sparkles,
  Square,
  Upload,
  Wand2,
  X,
} from 'lucide-react';
import type {
  AutomationDraft,
  AutomationTemplate,
  WorkflowNodeType,
  WorkflowOutput,
  WorkflowRunRecord,
  WorkflowRunStepRecord,
  WorkflowStepStatus,
} from '@/types';
import {
  AUTOMATION_MAX_TOKENS,
  applyAutomationVariables,
  diffWorkflows,
  getMissingVariables,
  getTemplateDraft,
  normalizeVariables,
  normalizeWorkflow,
  updateAutomationDraft,
  validateWorkflow,
} from '@/lib/automation';
import { getOutputSummary, runWorkflow } from '@/lib/workflowEngine';
import { storage } from '@/lib/storage';
import { editAutomationPlan, repairAutomationPlan } from '@/services/automationPlanner';
import { AUTOMATION_TEMPLATES } from '@/data/automationTemplates';
import { AutomationSchedulePanel } from './AutomationSchedulePanel';

type AutomationStudioCardProps = {
  theme: 'minimal' | 'classic' | 'fulldark';
  sessionId: string;
  draft: AutomationDraft | null;
  generating?: boolean;
  onGenerate: (goal: string) => void;
  onDraftChange: (draft: AutomationDraft) => void;
  onDiscard: () => void;
  onDisable: () => void;
  onOpenWorkflows: (workflowId: string) => void;
};

type RunLog = {
  id: string;
  message: string;
  kind: 'info' | 'warning' | 'error';
};

type BatchResult = {
  label: string;
  status: 'success' | 'error' | 'stopped';
  finalOutput: string;
};

const NODE_ICONS: Record<WorkflowNodeType, typeof Bot> = {
  input: FileText,
  webSearch: Search,
  webFetch: Globe,
  scholar: GraduationCap,
  ai: Bot,
  image: ImageIcon,
  weather: CloudSun,
  nasa: Rocket,
  if: GitBranch,
  document: FileText,
  email: Mail,
  webhook: Webhook,
};

const NODE_LABELS: Record<WorkflowNodeType, string> = {
  input: 'Input',
  webSearch: 'Web Search',
  webFetch: 'Web Fetch',
  scholar: 'Scholar',
  ai: 'AI',
  image: 'Image',
  weather: 'Weather',
  nasa: 'NASA',
  if: 'Condition',
  document: 'Document',
  email: 'Email',
  webhook: 'Webhook',
};

const STATUS_STYLES: Record<WorkflowStepStatus, string> = {
  idle: 'border-zinc-700/70 bg-zinc-900/40 text-zinc-500',
  running: 'border-cyan-400/50 bg-cyan-500/10 text-cyan-200',
  done: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-300',
  error: 'border-red-400/40 bg-red-500/10 text-red-300',
  skipped: 'border-amber-400/30 bg-amber-500/10 text-amber-300',
};

function formatDuration(ms: number): string {
  if (!ms) return '';
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function formatTime(timestamp: number): string {
  try {
    return new Date(timestamp).toLocaleString();
  } catch {
    return '';
  }
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'automation';
}

function parseBatchInput(
  text: string,
  variables: AutomationDraft['variables'],
): Array<{ label: string; values: Record<string, string> }> {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 5)
    .map((line, index) => {
      const values: Record<string, string> = {};
      const parts = line.split(';').map((part) => part.trim()).filter(Boolean);
      for (const part of parts) {
        const separator = part.indexOf('=');
        if (separator > 0) {
          const rawKey = part.slice(0, separator).trim();
          const value = part.slice(separator + 1).trim().slice(0, 2000);
          const normalizedKey = rawKey.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
          const matched = variables.find((variable) =>
            variable.key === rawKey ||
            variable.key === normalizedKey ||
            variable.label.toLowerCase() === rawKey.toLowerCase()
          );
          if (rawKey && value) values[matched?.key || normalizedKey || rawKey] = value;
        } else if (variables.length === 1) {
          values[variables[0].key] = part.slice(0, 2000);
        }
      }
      return { label: line.slice(0, 80) || `Run ${index + 1}`, values };
    });
}

function isDataImage(value: string): boolean {
  return value.startsWith('data:image/');
}

export function AutomationStudioCard({
  theme,
  sessionId,
  draft,
  generating = false,
  onGenerate,
  onDraftChange,
  onDiscard,
  onDisable,
  onOpenWorkflows,
}: AutomationStudioCardProps) {
  const [goalDraft, setGoalDraft] = useState('');
  const [instruction, setInstruction] = useState('');
  const [editing, setEditing] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [notice, setNotice] = useState('');
  const [diff, setDiff] = useState<string[]>([]);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const [statuses, setStatuses] = useState<Record<string, WorkflowStepStatus>>({});
  const [outputs, setOutputs] = useState<Record<string, WorkflowOutput>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [durations, setDurations] = useState<Record<string, number>>({});
  const [logs, setLogs] = useState<RunLog[]>([]);
  const [finalOutput, setFinalOutput] = useState<WorkflowOutput | null>(null);
  const [runError, setRunError] = useState('');
  const [failedNodeId, setFailedNodeId] = useState<string | null>(null);
  const [runHistory, setRunHistory] = useState<WorkflowRunRecord[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showSchedules, setShowSchedules] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showAssumptions, setShowAssumptions] = useState(false);
  const [runFromId, setRunFromId] = useState('');
  const [batchMode, setBatchMode] = useState(false);
  const [batchText, setBatchText] = useState('');
  const [batchResults, setBatchResults] = useState<BatchResult[]>([]);
  const [batchRunning, setBatchRunning] = useState(false);
  const [saved, setSaved] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const stopRef = useRef(false);
  const statusesRef = useRef<Record<string, WorkflowStepStatus>>({});
  const outputsRef = useRef<Record<string, WorkflowOutput>>({});
  const errorsRef = useRef<Record<string, string>>({});
  const durationsRef = useRef<Record<string, number>>({});
  const startTimesRef = useRef<Record<string, number>>({});
  const finalNodeIdRef = useRef<string | null>(null);
  const runErrorRef = useRef('');
  const failedNodeIdRef = useRef<string | null>(null);

  const validation = useMemo(() => (draft ? validateWorkflow(draft.workflow) : null), [draft]);
  const draftId = draft?.id;
  const draftGoal = draft?.goal;
  const draftVariables = draft?.variables;
  const draftWorkflowId = draft?.workflow.id;
  const usedVariableValues = useMemo(() => {
    if (!draft) return {};
    const merged: Record<string, string> = {};
    for (const variable of draft.variables) {
      merged[variable.key] = variableValues[variable.key] ?? variable.defaultValue ?? '';
    }
    return merged;
  }, [draft, variableValues]);

  useEffect(() => {
    setGoalDraft(draftGoal ?? '');
    setInstruction('');
    setDiff([]);
    setNotice('');
    setSaved(false);
    resetRunState();
    setBatchResults([]);
    setRunFromId('');
    setShowTemplates(!draftId);
  }, [draftId, draftGoal]);

  useEffect(() => {
    if (!draftVariables || !draftWorkflowId) return;
    setVariableValues((prev) => {
      const next = { ...prev };
      for (const variable of draftVariables) {
        if (next[variable.key] === undefined) {
          next[variable.key] = variable.defaultValue ?? '';
        }
      }
      return next;
    });
    setRunHistory(storage.getWorkflowRunHistory(draftWorkflowId));
  }, [draftVariables, draftWorkflowId]);

  function resetRunState() {
    stopRef.current = false;
    statusesRef.current = {};
    outputsRef.current = {};
    errorsRef.current = {};
    durationsRef.current = {};
    startTimesRef.current = {};
    finalNodeIdRef.current = null;
    runErrorRef.current = '';
    failedNodeIdRef.current = null;
    setStatuses({});
    setOutputs({});
    setErrors({});
    setDurations({});
    setLogs([]);
    setFinalOutput(null);
    setRunError('');
    setFailedNodeId(null);
  }

  const cardClass =
    theme === 'classic'
      ? 'bg-slate-950/80 border-cyan-500/30 text-cyan-50 shadow-[0_0_28px_rgba(34,211,238,0.10)]'
      : theme === 'fulldark'
      ? 'bg-[#15191c] border-[#2b383d] text-[#e6f4f6]'
      : 'bg-zinc-900/90 border-zinc-800 text-zinc-200';

  const softText =
    theme === 'classic' ? 'text-cyan-200/65' : theme === 'fulldark' ? 'text-[#93a4a8]' : 'text-zinc-400';

  const inputClass =
    theme === 'classic'
      ? 'bg-slate-950/70 border-cyan-500/25 text-cyan-50 placeholder:text-cyan-200/25 focus:border-cyan-400/70'
      : theme === 'fulldark'
      ? 'bg-[#1d2428] border-[#36464b] text-[#ecf7f8] placeholder:text-[#6f858a] focus:border-cyan-500/60'
      : 'bg-zinc-950/60 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus:border-cyan-500/60';

  const secondaryButton =
    theme === 'classic'
      ? 'border-cyan-500/25 bg-slate-950/50 text-cyan-200/80 hover:border-cyan-400/50 hover:text-cyan-100'
      : theme === 'fulldark'
      ? 'border-[#36464b] bg-[#1d2428] text-[#c8dadd] hover:border-cyan-500/40 hover:text-cyan-200'
      : 'border-zinc-800 bg-zinc-900/70 text-zinc-300 hover:border-cyan-500/40 hover:text-cyan-200';

  const primaryButton =
    'border-cyan-400/50 bg-gradient-to-r from-cyan-500 to-teal-500 text-[#041316] shadow-[0_0_16px_rgba(34,211,238,0.16)] hover:brightness-110';

  const handleGenerate = () => {
    const goal = goalDraft.trim();
    if (!goal || generating) return;
    setNotice('');
    onGenerate(goal);
  };

  const handleEdit = async () => {
    if (!draft || !instruction.trim() || editing) return;
    setEditing(true);
    setNotice('');
    try {
      const plan = await editAutomationPlan(draft, instruction.trim());
      const next = updateAutomationDraft(draft, plan, 'Chat edit');
      const changes = diffWorkflows(draft.workflow, next.workflow);
      setDiff(changes);
      setInstruction('');
      setSaved(false);
      setNotice(changes.length > 0 ? 'Plan updated. Review the changes, then run.' : 'The planner kept the plan unchanged.');
      runErrorRef.current = '';
      failedNodeIdRef.current = null;
      setRunError('');
      setFailedNodeId(null);
      onDraftChange(next);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'The automation could not be updated.');
    } finally {
      setEditing(false);
    }
  };

  const handleRepair = async () => {
    if (!draft || !failedNodeId || !runError || repairing) return;
    setRepairing(true);
    setNotice('');
    try {
      const node = draft.workflow.nodes.find((item) => item.id === failedNodeId) || null;
      const plan = await repairAutomationPlan(draft.workflow, node, runError, finalOutput?.value);
      const next = updateAutomationDraft(draft, plan, 'Repair');
      setDiff(diffWorkflows(draft.workflow, next.workflow));
      setSaved(false);
      setNotice('Plan repaired. Review the steps, then run again.');
      runErrorRef.current = '';
      failedNodeIdRef.current = null;
      setRunError('');
      setFailedNodeId(null);
      onDraftChange(next);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'The automation could not be repaired.');
    } finally {
      setRepairing(false);
    }
  };

  const executeRun = async (
    values: Record<string, string>,
    startFromNodeId?: string,
  ): Promise<WorkflowRunRecord | null> => {
    if (!draft) return null;
    const check = validateWorkflow(draft.workflow);
    if (!check.ok) {
      setNotice(check.errors[0] || 'Fix the workflow before running.');
      return null;
    }
    const runWorkflowDef = applyAutomationVariables(draft.workflow, values);
    const resolvedCheck = validateWorkflow(runWorkflowDef);
    if (!resolvedCheck.ok) {
      setNotice(resolvedCheck.errors[0] || 'The run inputs produced an invalid workflow.');
      return null;
    }

    if (!startFromNodeId) {
      resetRunState();
    } else {
      runErrorRef.current = '';
      failedNodeIdRef.current = null;
      setRunError('');
      setFailedNodeId(null);
      setStatuses((prev) => ({ ...prev, [startFromNodeId]: 'idle' }));
      statusesRef.current[startFromNodeId] = 'idle';
      setFinalOutput(null);
      finalNodeIdRef.current = null;
    }

    stopRef.current = false;
    setRunning(true);
    setNotice('');
    const runStart = Date.now();
    let caughtError = '';

    try {
      await runWorkflow(
        runWorkflowDef,
        {
          shouldStop: () => stopRef.current,
          onStatus: (nodeId, status, output, errorText) => {
            statusesRef.current[nodeId] = status;
            setStatuses((prev) => ({ ...prev, [nodeId]: status }));

            if (status === 'running') {
              startTimesRef.current[nodeId] = Date.now();
            }

            if (output) {
              outputsRef.current[nodeId] = output;
              setOutputs((prev) => ({ ...prev, [nodeId]: output }));
              if (status === 'done') {
                finalNodeIdRef.current = nodeId;
                setFinalOutput(output);
              }
            }

            if (errorText) {
              errorsRef.current[nodeId] = errorText;
              runErrorRef.current = errorText;
              failedNodeIdRef.current = nodeId;
              setErrors((prev) => ({ ...prev, [nodeId]: errorText }));
              setRunError(errorText);
              setFailedNodeId(nodeId);
            }

            if (status === 'done' || status === 'error' || status === 'skipped') {
              const start = startTimesRef.current[nodeId] || Date.now();
              const duration = Math.max(0, Date.now() - start);
              durationsRef.current[nodeId] = duration;
              setDurations((prev) => ({ ...prev, [nodeId]: duration }));
              const node = draft.workflow.nodes.find((item) => item.id === nodeId);
              if (node) {
                setLogs((prev) => [
                  ...prev,
                  {
                    id: `log-${Date.now()}-${nodeId}`,
                    message: `${node.label}: ${status}${duration ? ` (${formatDuration(duration)})` : ''}`,
                    kind: status === 'error' ? 'error' : 'info',
                  },
                ]);
              }
            }
          },
          onWarning: (warning) => {
            setLogs((prev) => [
              ...prev,
              { id: `log-${Date.now()}-warning`, message: warning, kind: 'warning' },
            ]);
          },
          onLog: (message) => {
            setLogs((prev) => [
              ...prev,
              { id: `log-${Date.now()}-info`, message, kind: 'info' },
            ]);
          },
        },
        startFromNodeId ? { startFromNodeId, previousOutputs: outputsRef.current } : undefined,
      );
    } catch (err) {
      caughtError = err instanceof Error ? err.message : String(err);
      runErrorRef.current = caughtError;
      setRunError(caughtError);
    } finally {
      setRunning(false);
    }

    const runStatus: WorkflowRunRecord['status'] = stopRef.current
      ? 'stopped'
      : caughtError || runErrorRef.current
      ? 'error'
      : 'success';
    const stepRecords: WorkflowRunStepRecord[] = draft.workflow.nodes.map((node) => {
      const output = outputsRef.current[node.id];
      return {
        nodeId: node.id,
        label: node.label,
        type: node.type,
        status: statusesRef.current[node.id] || 'idle',
        outputSummary: output ? getOutputSummary(output) : '',
        error: errorsRef.current[node.id]?.slice(0, 500),
        durationMs: durationsRef.current[node.id] || 0,
      };
    });
    const finalNodeId = finalNodeIdRef.current;
    const final = finalNodeId ? outputsRef.current[finalNodeId] : null;
    const record: WorkflowRunRecord = {
      id: `run-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      workflowId: draft.workflow.id,
      workflowName: draft.workflow.name,
      status: runStatus,
      startedAt: runStart,
      durationMs: Math.max(0, Date.now() - runStart),
      steps: stepRecords,
      finalOutput: final
        ? final.type === 'image'
          ? '[1 image]'
          : final.value.slice(0, 500)
        : undefined,
    };

    storage.saveWorkflowRun(record);
    setRunHistory(storage.getWorkflowRunHistory(draft.workflow.id));
    if (runStatus === 'success') setNotice('Run complete.');
    if (runStatus === 'stopped') setNotice('Run stopped.');
    return record;
  };

  const handleRun = async () => {
    if (!draft || running) return;
    if (!validation?.ok) {
      setNotice(validation?.errors[0] || 'Fix the workflow before running.');
      return;
    }
    const missing = getMissingVariables(draft, usedVariableValues);
    if (missing.length > 0) {
      setNotice(`Enter a value for: ${missing.map((item) => item.label).join(', ')}.`);
      return;
    }
    await executeRun(usedVariableValues);
  };

  const handleBatchRun = async () => {
    if (!draft || running || batchRunning) return;
    const rows = parseBatchInput(batchText, draft.variables);
    if (rows.length === 0) {
      setNotice('Add at least one line of values for a batch run.');
      return;
    }
    setBatchResults([]);
    setBatchRunning(true);
    try {
      for (const row of rows) {
        if (stopRef.current) break;
        const merged = { ...usedVariableValues, ...row.values };
        const missing = getMissingVariables(draft, merged);
        if (missing.length > 0) {
          setBatchResults((prev) => [...prev, { label: row.label, status: 'error', finalOutput: `Missing: ${missing.map((item) => item.label).join(', ')}` }]);
          continue;
        }
        const record = await executeRun(merged);
        setBatchResults((prev) => [
          ...prev,
          {
            label: row.label,
            status: record?.status || 'error',
            finalOutput: record?.finalOutput || '',
          },
        ]);
      }
    } finally {
      setBatchRunning(false);
    }
  };

  const handleRetry = async () => {
    if (!draft || !failedNodeId || running) return;
    if (!draft.workflow.nodes.some((node) => node.id === failedNodeId)) {
      setNotice('The failed step no longer exists. Run the full plan instead.');
      return;
    }
    await executeRun(usedVariableValues, failedNodeId);
  };

  const handleRunFrom = async () => {
    if (!draft || !runFromId || running) return;
    await executeRun(usedVariableValues, runFromId);
  };

  const handleOpen = () => {
    if (!draft) return;
    handleSave();
    onOpenWorkflows(draft.workflow.id);
  };

  const handleSave = () => {
    if (!draft) return;
    const workflows = storage.getWorkflows();
    const savedWorkflow = {
      ...draft.workflow,
      updatedAt: Date.now(),
      automation: {
        goal: draft.goal,
        summary: draft.summary,
        variables: draft.variables,
        assumptions: draft.assumptions,
      },
    };
    const exists = workflows.some((item) => item.id === savedWorkflow.id);
    storage.saveWorkflows(exists
      ? workflows.map((item) => (item.id === savedWorkflow.id ? savedWorkflow : item))
      : [savedWorkflow, ...workflows]);
    setSaved(true);
    setNotice('Saved to Workflows.');
  };

  const handleExport = () => {
    if (!draft) return;
    const payload = {
      name: draft.workflow.name,
      goal: draft.goal,
      summary: draft.summary,
      assumptions: draft.assumptions,
      variables: draft.variables,
      workflow: draft.workflow,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${slugify(draft.workflow.name)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (file: File) => {
    try {
      if (file.size > 1_000_000) throw new Error('Automation files must be 1 MB or smaller.');
      const raw = JSON.parse(await file.text()) as Record<string, unknown>;
      const normalized = normalizeWorkflow(raw.workflow ?? raw, typeof raw.name === 'string' ? raw.name : 'Imported Automation');
      if (!normalized.workflow) throw new Error(normalized.errors[0] || 'The file did not contain a valid workflow.');
      const importedValidation = validateWorkflow(normalized.workflow);
      if (!importedValidation.ok) throw new Error(importedValidation.errors[0] || 'The imported workflow is invalid.');
      const now = Date.now();
      const workflow = { ...normalized.workflow, id: `workflow-${now}-${Math.random().toString(36).slice(2, 8)}` };
      const variables = normalizeVariables(raw.variables, workflow);
      const summary = typeof raw.summary === 'string' ? raw.summary.slice(0, 600) : 'Imported automation';
      const goal = typeof raw.goal === 'string' ? raw.goal.slice(0, 2000) : summary;
      const assumptions = Array.isArray(raw.assumptions)
        ? raw.assumptions.map((item) => String(item).slice(0, 220)).filter(Boolean).slice(0, 5)
        : [];
      workflow.description = summary;
      workflow.automation = { goal, summary, variables, assumptions };
      workflow.updatedAt = now;
      onDraftChange({
        id: `automation-${now}-${Math.random().toString(36).slice(2, 8)}`,
        sessionId,
        goal,
        summary,
        workflow,
        variables,
        assumptions,
        createdAt: now,
        updatedAt: now,
        versions: [],
      });
      setNotice('Automation imported.');
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Could not import this file.');
    }
  };

  const handleUseTemplate = (template: AutomationTemplate) => {
    if (draft && !window.confirm('Replace the current automation with this template?')) return;
    onDraftChange(getTemplateDraft(template, sessionId));
    setShowTemplates(false);
  };

  const handleCopyFinal = async () => {
    if (!finalOutput) return;
    try {
      await navigator.clipboard.writeText(finalOutput.value);
      setNotice('Output copied.');
    } catch {
      setNotice('Could not copy output.');
    }
  };


  return (
    <div className={`px-3.5 py-3 rounded-xl border transition-all ${cardClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl grid place-items-center shrink-0 bg-cyan-500/15 text-cyan-300 border border-cyan-400/30">
            <Wand2 size={16} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-zinc-100">Automation Studio</span>
              {draft && (
                <>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/15 border border-cyan-400/30 text-cyan-300">
                    {draft.workflow.nodes.length} steps
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800/80 border border-zinc-700/60 text-zinc-400">
                    {draft.workflow.id.slice(-8)}
                  </span>
                </>
              )}
            </div>
            <p className={`text-[11px] mt-0.5 truncate ${softText}`}>
              {draft ? draft.summary : 'Describe a goal. Review the plan. Run it safely.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {draft && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Discard this automation draft?')) onDiscard();
              }}
              disabled={running || batchRunning}
              className={`text-[11px] px-2 py-1 rounded-lg border transition-all flex items-center gap-1 disabled:opacity-50 ${secondaryButton}`}
              title="Start a new automation"
            >
              <RotateCcw size={11} />
              <span className="hidden sm:inline">New</span>
            </button>
          )}
          <button
            type="button"
            onClick={onDisable}
            className={`text-[11px] px-2 py-1 rounded-lg border transition-all flex items-center gap-1 ${
              theme === 'fulldark'
                ? 'border-[#36464b] bg-[#1d2428] text-[#c8dadd] hover:border-red-500/40 hover:text-red-300'
                : 'border-zinc-700/60 bg-zinc-800/80 text-zinc-300 hover:border-red-500/40 hover:text-red-300'
            }`}
            title="Disable Automation mode"
            aria-label="Disable Automation mode"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {notice && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-400/30 bg-amber-500/10 px-2.5 py-2 text-[11px] text-amber-200">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
          <span className="break-words">{notice}</span>
        </div>
      )}

      {!draft ? (
        <div className="mt-3 space-y-3">
          <div>
            <label className={`text-[10px] font-mono uppercase tracking-wider ${softText}`}>
              What should this automation do?
            </label>
            <textarea
              value={goalDraft}
              onChange={(event) => setGoalDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  handleGenerate();
                }
              }}
              rows={3}
              placeholder="e.g. Research a competitor every Friday and produce a one-page brief with sources..."
              className={`mt-1.5 w-full resize-none rounded-lg border px-3 py-2 text-xs outline-none transition-colors ${inputClass}`}
              aria-label="Automation goal"
            />
          </div>

          <button
            type="button"
            disabled={generating || !goalDraft.trim()}
            onClick={handleGenerate}
            className={`w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold transition-all active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed ${primaryButton}`}
          >
            {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            <span>{generating ? 'Building workflow...' : 'Build Automation'}</span>
            {!generating && <ArrowRight size={14} />}
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowTemplates((prev) => !prev)}
              className={`text-[11px] px-2 py-1 rounded-lg border transition-all flex items-center gap-1 ${secondaryButton}`}
            >
              <LayoutTemplate size={11} />
              Templates
              {showTemplates ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={`text-[11px] px-2 py-1 rounded-lg border transition-all flex items-center gap-1 ${secondaryButton}`}
            >
              <Upload size={11} />
              Import
            </button>
            <span className={`text-[10px] ${softText}`}>You approve every run before it starts.</span>
          </div>

          {showTemplates && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {AUTOMATION_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => handleUseTemplate(template)}
                  className={`text-left rounded-lg border px-2.5 py-2 transition-all hover:border-cyan-400/40 ${secondaryButton}`}
                >
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-100">
                    <Sparkles size={11} className="text-cyan-300" />
                    {template.name}
                  </div>
                  <p className={`mt-0.5 text-[10px] leading-relaxed line-clamp-2 ${softText}`}>{template.description}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <div className={`rounded-lg border px-2.5 py-2 ${theme === 'fulldark' ? 'border-[#2b383d] bg-[#1a2023]' : 'border-zinc-800 bg-zinc-950/40'}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold text-zinc-100 truncate">{draft.workflow.name}</div>
                <p className={`text-[10px] mt-0.5 line-clamp-2 ${softText}`}>{draft.goal}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAssumptions((prev) => !prev)}
                className={`text-[10px] px-1.5 py-1 rounded border shrink-0 ${secondaryButton}`}
                title="Show assumptions"
              >
                <ChevronDown size={11} className={showAssumptions ? 'rotate-180 transition-transform' : 'transition-transform'} />
              </button>
            </div>
            {showAssumptions && draft.assumptions.length > 0 && (
              <ul className={`mt-1.5 space-y-1 text-[10px] list-disc list-inside ${softText}`}>
                {draft.assumptions.map((assumption, index) => (
                  <li key={`${assumption}-${index}`}>{assumption}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {validation && (
              <>
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${secondaryButton}`}>{validation.stats.nodeCount} steps</span>
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${secondaryButton}`}>{validation.stats.aiSteps} AI</span>
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${secondaryButton}`}>{validation.stats.estimatedCalls} calls</span>
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${validation.stats.estimatedTokens > AUTOMATION_MAX_TOKENS * 0.75 ? 'border-amber-400/40 text-amber-300' : ''} ${secondaryButton}`}>
                  ~{validation.stats.estimatedTokens.toLocaleString()} tokens
                </span>
              </>
            )}
            {validation && !validation.ok && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-red-400/40 bg-red-500/10 text-red-300">
                Needs review
              </span>
            )}
          </div>

          <div className="space-y-1.5 max-h-60 overflow-y-auto pr-0.5">
            {draft.workflow.nodes.map((node, index) => {
              const Icon = NODE_ICONS[node.type];
              const status = statuses[node.id] || 'idle';
              const output = outputs[node.id];
              const error = errors[node.id];
              return (
                <div
                  key={node.id}
                  className={`rounded-lg border px-2 py-1.5 transition-colors ${STATUS_STYLES[status]}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md border border-current/30 grid place-items-center shrink-0 text-[10px] font-mono">
                      {index + 1}
                    </span>
                    <Icon size={12} className="shrink-0" />
                    <span className="text-[11px] font-medium truncate flex-1 min-w-0">{node.label}</span>
                    <span className="text-[9px] font-mono uppercase tracking-wide opacity-60 shrink-0">{NODE_LABELS[node.type]}</span>
                    {status === 'running' && <Loader2 size={11} className="animate-spin shrink-0" />}
                    {status === 'done' && <Check size={11} className="shrink-0" />}
                    {status === 'error' && <AlertTriangle size={11} className="shrink-0" />}
                    {durations[node.id] > 0 && (
                      <span className="text-[9px] font-mono opacity-60 shrink-0">{formatDuration(durations[node.id])}</span>
                    )}
                  </div>
                  {output && (
                    <p className="mt-0.5 ml-7 text-[9px] font-mono opacity-60 truncate">{getOutputSummary(output)}</p>
                  )}
                  {error && <p className="mt-0.5 ml-7 text-[9px] text-red-300 break-words">{error.slice(0, 240)}</p>}
                </div>
              );
            })}
          </div>

          {draft.variables.length > 0 && (
            <div className={`rounded-lg border px-2.5 py-2 space-y-1.5 ${theme === 'fulldark' ? 'border-[#2b383d] bg-[#1a2023]' : 'border-zinc-800 bg-zinc-950/40'}`}>
              <div className={`text-[10px] font-mono uppercase tracking-wider ${softText}`}>Run inputs</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {draft.variables.map((variable) => (
                  <label key={variable.key} className="block min-w-0">
                    <span className={`text-[10px] ${softText}`}>{variable.label}</span>
                    <input
                      type="text"
                      maxLength={2000}
                      value={variableValues[variable.key] ?? ''}
                      onChange={(event) => setVariableValues((prev) => ({ ...prev, [variable.key]: event.target.value }))}
                      placeholder={variable.example || variable.defaultValue || variable.key}
                      className={`mt-0.5 w-full rounded-md border px-2 py-1.5 text-[11px] outline-none transition-colors ${inputClass}`}
                    />
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-1.5">
            {running ? (
              <button
                type="button"
                onClick={() => {
                  stopRef.current = true;
                  setNotice('Stopping after the current step...');
                }}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-400/40 bg-red-500/10 text-red-300 text-[11px] font-semibold hover:bg-red-500/20 active:scale-[0.99]"
              >
                <Square size={12} />
                Stop
              </button>
            ) : (
              <button
                type="button"
                onClick={handleRun}
                disabled={!validation?.ok || generating || batchRunning}
                className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-semibold transition-all active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed ${primaryButton}`}
              >
                <Play size={12} />
                Run
              </button>
            )}
            <button
              type="button"
              onClick={() => setBatchMode((prev) => !prev)}
              disabled={running || batchRunning || draft.variables.length === 0}
              className={`text-[11px] px-2 py-1 rounded-lg border transition-all flex items-center gap-1 disabled:opacity-40 ${secondaryButton}`}
            >
              <LayoutTemplate size={11} />
              Batch
            </button>
            <button
              type="button"
              onClick={() => setShowAdvanced((prev) => !prev)}
              className={`text-[11px] px-2 py-1 rounded-lg border transition-all flex items-center gap-1 ${secondaryButton}`}
            >
              <GitBranch size={11} />
              Advanced
              {showAdvanced ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            </button>
          </div>

          {batchMode && (
            <div className={`rounded-lg border px-2.5 py-2 space-y-1.5 ${theme === 'fulldark' ? 'border-[#2b383d] bg-[#1a2023]' : 'border-zinc-800 bg-zinc-950/40'}`}>
              <div className={`text-[10px] font-mono uppercase tracking-wider ${softText}`}>Batch inputs (one run per line)</div>
              <textarea
                value={batchText}
                onChange={(event) => setBatchText(event.target.value)}
                maxLength={4000}
                rows={3}
                placeholder={draft.variables.map((variable) => `${variable.key}=value`).join('; ')}
                className={`w-full resize-none rounded-md border px-2 py-1.5 text-[11px] outline-none transition-colors ${inputClass}`}
              />
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleBatchRun}
                  disabled={running || batchRunning || !batchText.trim()}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-semibold disabled:opacity-40 ${primaryButton}`}
                >
                  <Play size={11} />
                  Run batch
                </button>
                <span className={`text-[10px] ${softText}`}>{batchRunning ? 'Batch running…' : 'Up to 5 runs, one after another.'}</span>
              </div>
              {batchResults.length > 0 && (
                <div className="space-y-1">
                  {batchResults.map((result, index) => (
                    <div key={`${result.label}-${index}`} className={`flex items-start gap-1.5 text-[10px] ${result.status === 'error' ? 'text-red-300' : softText}`}>
                      <span className="font-mono shrink-0">{result.status === 'error' ? 'ERR' : result.status === 'stopped' ? 'STOP' : 'OK'}</span>
                      <span className="truncate flex-1">{result.label}</span>
                      <span className="opacity-70 max-w-[45%] truncate">{result.finalOutput}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {showAdvanced && (
            <div className={`rounded-lg border px-2.5 py-2 space-y-2 ${theme === 'fulldark' ? 'border-[#2b383d] bg-[#1a2023]' : 'border-zinc-800 bg-zinc-950/40'}`}>
              <div>
                <div className={`text-[10px] font-mono uppercase tracking-wider ${softText}`}>Edit with AI</div>
                <div className="mt-1 flex gap-1.5">
                  <input
                    type="text"
                    value={instruction}
                    onChange={(event) => setInstruction(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        void handleEdit();
                      }
                    }}
                    placeholder="e.g. add a source checker step, make it shorter..."
                    className={`min-w-0 flex-1 rounded-md border px-2 py-1.5 text-[11px] outline-none transition-colors ${inputClass}`}
                  />
                  <button
                    type="button"
                    onClick={() => void handleEdit()}
                    disabled={editing || !instruction.trim() || running}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-semibold disabled:opacity-40 ${primaryButton}`}
                  >
                    {editing ? <Loader2 size={11} className="animate-spin" /> : <Wand2 size={11} />}
                    Edit
                  </button>
                </div>
              </div>

              {diff.length > 0 && (
                <div className="space-y-1">
                  <div className={`text-[10px] font-mono uppercase tracking-wider ${softText}`}>Latest changes</div>
                  {diff.map((change, index) => (
                    <div key={`${change}-${index}`} className="text-[10px] text-cyan-200/80">• {change}</div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-end gap-1.5">
                <label className="block">
                  <span className={`text-[10px] ${softText}`}>Run from step</span>
                  <select
                    value={runFromId}
                    onChange={(event) => setRunFromId(event.target.value)}
                    className={`mt-0.5 block rounded-md border px-2 py-1.5 text-[11px] outline-none ${inputClass}`}
                  >
                    <option value="">Choose a step</option>
                    {draft.workflow.nodes.slice(1).map((node) => (
                      <option key={node.id} value={node.id}>{node.label}</option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => void handleRunFrom()}
                  disabled={!runFromId || running}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-semibold disabled:opacity-40 ${secondaryButton}`}
                >
                  <Play size={11} />
                  Run from here
                </button>
                {failedNodeId && !running && (
                  <>
                    <button
                      type="button"
                      onClick={() => void handleRetry()}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-semibold ${secondaryButton}`}
                    >
                      <RotateCcw size={11} />
                      Retry failed step
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleRepair()}
                      disabled={repairing}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-semibold disabled:opacity-40 ${secondaryButton}`}
                    >
                      {repairing ? <Loader2 size={11} className="animate-spin" /> : <Wand2 size={11} />}
                      Repair plan
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {runError && (
            <div className="rounded-lg border border-red-400/30 bg-red-500/10 px-2.5 py-2 text-[11px] text-red-200">
              <div className="flex items-center gap-1.5 font-semibold">
                <AlertTriangle size={12} />
                Run failed
              </div>
              <p className="mt-0.5 break-words opacity-90">{runError}</p>
              {failedNodeId && !running && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <button type="button" onClick={() => void handleRetry()} className={`px-2 py-1 rounded border text-[10px] ${secondaryButton}`}>Retry step</button>
                  <button type="button" onClick={() => void handleRepair()} disabled={repairing} className={`px-2 py-1 rounded border text-[10px] ${secondaryButton}`}>Repair plan</button>
                </div>
              )}
            </div>
          )}

          {finalOutput && (
            <div className={`rounded-lg border px-2.5 py-2 ${theme === 'fulldark' ? 'border-[#2b383d] bg-[#1a2023]' : 'border-zinc-800 bg-zinc-950/40'}`}>
              <div className="flex items-center justify-between gap-2">
                <div className={`text-[10px] font-mono uppercase tracking-wider ${softText}`}>Final output</div>
                {finalOutput.type !== 'image' && (
                  <button type="button" onClick={() => void handleCopyFinal()} className={`text-[10px] px-1.5 py-0.5 rounded border ${secondaryButton}`}>
                    Copy
                  </button>
                )}
              </div>
              {finalOutput.type === 'image' ? (
                isDataImage(finalOutput.value) || /^https?:\/\//i.test(finalOutput.value) ? (
                  <img src={finalOutput.value} alt="Automation output" className="mt-1.5 w-full rounded-md border border-zinc-700/60 object-contain max-h-72" />
                ) : (
                  <p className={`mt-1.5 text-[11px] ${softText}`}>{finalOutput.value}</p>
                )
              ) : (
                <pre className="mt-1.5 max-h-64 overflow-y-auto whitespace-pre-wrap break-words text-[11px] leading-relaxed text-zinc-200">{finalOutput.value}</pre>
              )}
            </div>
          )}

          {logs.length > 0 && (
            <details className={`rounded-lg border px-2 py-1.5 ${theme === 'fulldark' ? 'border-[#2b383d] bg-[#1a2023]' : 'border-zinc-800 bg-zinc-950/40'}`}>
              <summary className={`text-[10px] font-mono uppercase tracking-wider cursor-pointer ${softText}`}>Run log ({logs.length})</summary>
              <div className="mt-1 space-y-0.5 max-h-32 overflow-y-auto">
                {logs.map((log) => (
                  <div key={log.id} className={`text-[10px] ${log.kind === 'error' ? 'text-red-300' : log.kind === 'warning' ? 'text-amber-300' : softText}`}>
                    {log.message}
                  </div>
                ))}
              </div>
            </details>
          )}

          <div className="flex flex-wrap items-center gap-1.5">
            <button type="button" onClick={handleSave} className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-medium ${secondaryButton}`}>
              <Save size={11} />
              {saved ? 'Saved' : 'Save'}
            </button>
            <button type="button" onClick={handleOpen} className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-medium ${secondaryButton}`}>
              <ExternalLink size={11} />
              Open
            </button>
            <button type="button" onClick={handleExport} className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-medium ${secondaryButton}`}>
              <Download size={11} />
              Export
            </button>
            <button type="button" onClick={() => fileInputRef.current?.click()} className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-medium ${secondaryButton}`}>
              <Upload size={11} />
              Import
            </button>
            <button type="button" onClick={() => setShowTemplates((prev) => !prev)} className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-medium ${secondaryButton}`}>
              <LayoutTemplate size={11} />
              Templates
            </button>
            <button type="button" onClick={() => setShowHistory((prev) => !prev)} className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-medium ${secondaryButton}`}>
              <History size={11} />
              History
            </button>
            <button type="button" onClick={() => setShowSchedules((prev) => !prev)} className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-medium ${secondaryButton}`}>
              <CalendarClock size={11} />
              Schedule
            </button>
          </div>

          {showSchedules && draft && (
            <AutomationSchedulePanel
              workflow={draft.workflow}
              goal={draft.goal}
              variables={draft.variables.map((variable) => ({
                ...variable,
                defaultValue: variableValues[variable.key] ?? variable.defaultValue,
              }))}
              sourceId={draft.id}
              onClose={() => setShowSchedules(false)}
              onNotice={setNotice}
            />
          )}

          {showTemplates && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {AUTOMATION_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => handleUseTemplate(template)}
                  className={`text-left rounded-lg border px-2.5 py-2 transition-all hover:border-cyan-400/40 ${secondaryButton}`}
                >
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-100">
                    <Sparkles size={11} className="text-cyan-300" />
                    {template.name}
                  </div>
                  <p className={`mt-0.5 text-[10px] leading-relaxed line-clamp-2 ${softText}`}>{template.description}</p>
                </button>
              ))}
            </div>
          )}

          {showHistory && (
            <div className={`rounded-lg border px-2.5 py-2 ${theme === 'fulldark' ? 'border-[#2b383d] bg-[#1a2023]' : 'border-zinc-800 bg-zinc-950/40'}`}>
              <div className={`text-[10px] font-mono uppercase tracking-wider ${softText}`}>Recent runs</div>
              {runHistory.length === 0 ? (
                <p className={`mt-1 text-[11px] ${softText}`}>No runs yet.</p>
              ) : (
                <div className="mt-1 space-y-1.5">
                  {runHistory.length >= 2 && (
                    <div className={`rounded-md border border-cyan-500/20 bg-cyan-500/5 px-2 py-1 text-[10px] ${softText}`}>
                      Compare: latest {runHistory[0].status} ({formatDuration(runHistory[0].durationMs)}) vs previous {runHistory[1].status} ({formatDuration(runHistory[1].durationMs)})
                    </div>
                  )}
                  {runHistory.slice(0, 4).map((run) => (
                    <div key={run.id} className="rounded-md border border-zinc-800/70 px-2 py-1.5">
                      <div className="flex items-center gap-1.5 text-[10px]">
                        <span className={`font-mono ${run.status === 'success' ? 'text-emerald-300' : run.status === 'error' ? 'text-red-300' : 'text-amber-300'}`}>
                          {run.status.toUpperCase()}
                        </span>
                        <span className={`ml-auto font-mono ${softText}`}>{formatTime(run.startedAt)}</span>
                        <span className={`font-mono ${softText}`}>{formatDuration(run.durationMs)}</span>
                      </div>
                      {run.finalOutput && <p className={`mt-0.5 text-[10px] line-clamp-2 ${softText}`}>{run.finalOutput}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {validation && validation.errors.length > 0 && (
            <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-2.5 py-2 text-[10px] text-amber-200">
              {validation.errors.slice(0, 4).map((error) => (
                <div key={error}>• {error}</div>
              ))}
            </div>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void handleImport(file);
        }}
      />
    </div>
  );
}
