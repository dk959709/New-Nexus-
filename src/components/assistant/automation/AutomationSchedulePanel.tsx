import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  Check,
  Copy,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import type {
  AutomationScheduleKind,
  PublicAutomationSchedule,
  Workflow,
  WorkflowVariable,
} from '@/types';
import { api, AUTOMATION_ADMIN_TOKEN_KEY, BASE } from '@/services/api';

type AutomationSchedulePanelProps = {
  workflow: Workflow;
  goal: string;
  variables: WorkflowVariable[];
  sourceId?: string;
  onClose: () => void;
  onNotice?: (message: string) => void;
};

function formatWhen(timestamp?: number): string {
  if (!timestamp) return '—';
  try {
    return new Date(timestamp).toLocaleString();
  } catch {
    return '—';
  }
}

function describeSpec(schedule: PublicAutomationSchedule): string {
  if (schedule.spec.kind === 'once') return `Once at ${formatWhen(schedule.spec.runAt ? Date.parse(schedule.spec.runAt) : undefined)}`;
  if (schedule.spec.kind === 'interval') return `Every ${schedule.spec.everyMinutes} minutes`;
  return `Daily at ${schedule.spec.time || '09:00'}`;
}

function statusTone(status?: PublicAutomationSchedule['lastStatus']): string {
  if (status === 'success') return 'text-emerald-300';
  if (status === 'error') return 'text-red-300';
  if (status === 'running') return 'text-cyan-300';
  return 'text-zinc-400';
}

export function AutomationSchedulePanel({
  workflow,
  goal,
  variables,
  sourceId,
  onClose,
  onNotice,
}: AutomationSchedulePanelProps) {
  const [schedules, setSchedules] = useState<PublicAutomationSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState(workflow.name || 'Scheduled automation');
  const [kind, setKind] = useState<AutomationScheduleKind>('daily');
  const [time, setTime] = useState('09:00');
  const [runAt, setRunAt] = useState('');
  const [everyMinutes, setEveryMinutes] = useState(60);
  const [copiedToken, setCopiedToken] = useState('');
  const [integration, setIntegration] = useState<{ email: boolean; webhook: boolean } | null>(null);
  const [adminToken, setAdminToken] = useState(() => {
    if (typeof window === 'undefined') return '';
    try {
      return window.localStorage.getItem(AUTOMATION_ADMIN_TOKEN_KEY) || '';
    } catch {
      return '';
    }
  });

  const defaultVariables = useMemo(() => {
    const values: Record<string, string> = {};
    for (const variable of variables) {
      if (variable.key) values[variable.key] = variable.defaultValue || variable.example || '';
    }
    return values;
  }, [variables]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.listAutomationSchedules();
      setSchedules(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load schedules.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    void api
      .getIntegrationStatus()
      .then((status) => setIntegration({ email: status.email, webhook: status.webhook }))
      .catch(() => setIntegration(null));
  }, [refresh]);

  useEffect(() => {
    try {
      if (adminToken) window.localStorage.setItem(AUTOMATION_ADMIN_TOKEN_KEY, adminToken);
      else window.localStorage.removeItem(AUTOMATION_ADMIN_TOKEN_KEY);
    } catch {
      // Ignore storage access errors.
    }
  }, [adminToken]);

  useEffect(() => {
    if (!schedules.some((schedule) => schedule.lastStatus === 'running')) return;
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(timer);
  }, [schedules, refresh]);

  const handleCreate = async () => {
    setCreating(true);
    setError('');
    try {
      const spec =
        kind === 'once'
          ? { kind, runAt: runAt ? new Date(runAt).toISOString() : '' }
          : kind === 'interval'
            ? { kind, everyMinutes }
            : { kind, time };
      const created = await api.createAutomationSchedule({
        name: name.trim() || workflow.name,
        goal,
        sourceId,
        workflow,
        variables: defaultVariables,
        spec,
        enabled: true,
      });
      setSchedules((prev) => [created, ...prev]);
      setCreating(false);
      onNotice?.('Schedule created.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create schedule.');
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async (schedule: PublicAutomationSchedule) => {
    setBusyId(schedule.id);
    setError('');
    try {
      const updated = await api.updateAutomationSchedule(schedule.id, { enabled: !schedule.enabled });
      setSchedules((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update schedule.');
    } finally {
      setBusyId('');
    }
  };

  const handleRun = async (schedule: PublicAutomationSchedule) => {
    setBusyId(schedule.id);
    setError('');
    try {
      await api.runAutomationSchedule(schedule.id, defaultVariables);
      onNotice?.('Run started. Status refreshes automatically.');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start run.');
    } finally {
      setBusyId('');
    }
  };

  const handleDelete = async (schedule: PublicAutomationSchedule) => {
    if (!window.confirm(`Delete schedule "${schedule.name}"?`)) return;
    setBusyId(schedule.id);
    setError('');
    try {
      await api.deleteAutomationSchedule(schedule.id);
      setSchedules((prev) => prev.filter((item) => item.id !== schedule.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete schedule.');
    } finally {
      setBusyId('');
    }
  };

  const handleCopyWebhook = async (schedule: PublicAutomationSchedule) => {
    const url = `${BASE || window.location.origin}${schedule.webhookPath}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedToken(schedule.id);
      window.setTimeout(() => setCopiedToken(''), 1500);
    } catch {
      setError('Could not copy the webhook URL.');
    }
  };

  return (
    <div className="rounded-xl border border-cyan-500/25 bg-zinc-950/50 p-3 space-y-3">
      <div className="flex items-center gap-2">
        <CalendarClock size={14} className="text-cyan-300" />
        <span className="text-[11px] font-semibold text-zinc-100">Server schedules</span>
        <button
          type="button"
          onClick={() => void refresh()}
          className="ml-auto inline-flex items-center gap-1 rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-300 hover:border-cyan-400/40"
        >
          <RefreshCw size={10} /> Refresh
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded border border-zinc-700 p-1 text-zinc-400 hover:text-zinc-200"
          aria-label="Close schedules"
        >
          <X size={11} />
        </button>
      </div>

      {integration && !integration.email && (
        <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-2 py-1.5 text-[10px] text-amber-200 flex gap-1.5">
          <AlertTriangle size={11} className="mt-0.5 shrink-0" />
          Email delivery is not configured. Add RESEND_API_KEY and EMAIL_FROM on the server.
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-400/30 bg-red-500/10 px-2 py-1.5 text-[10px] text-red-200">
          {error}
        </div>
      )}

      <details className="rounded-lg border border-zinc-800 bg-zinc-900/30 px-2 py-1.5">
        <summary className="cursor-pointer text-[10px] text-zinc-400">
          Admin token {adminToken ? '(set)' : '(optional)'}
        </summary>
        <input
          type="password"
          value={adminToken}
          onChange={(event) => setAdminToken(event.target.value)}
          placeholder="x-automation-token value"
          className="mt-1.5 w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-[11px] text-zinc-100 outline-none focus:border-cyan-400/50"
        />
        <p className="mt-1 text-[10px] text-zinc-500">
          Only needed when AUTOMATION_ADMIN_TOKEN is set on the server.
        </p>
      </details>

      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-2.5 space-y-2">
        <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">New schedule</div>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Schedule name"
          className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-[11px] text-zinc-100 outline-none focus:border-cyan-400/50"
        />
        <div className="flex flex-wrap gap-1.5">
          {(['daily', 'interval', 'once'] as AutomationScheduleKind[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setKind(option)}
              className={`rounded border px-2 py-0.5 text-[10px] capitalize ${
                kind === option
                  ? 'border-cyan-400/50 bg-cyan-500/10 text-cyan-200'
                  : 'border-zinc-700 text-zinc-400'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
        {kind === 'daily' && (
          <label className="flex items-center gap-2 text-[10px] text-zinc-400">
            Time
            <input
              type="time"
              value={time}
              onChange={(event) => setTime(event.target.value)}
              className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-[11px] text-zinc-100"
            />
            <span className="text-zinc-600">server local time</span>
          </label>
        )}
        {kind === 'interval' && (
          <label className="flex items-center gap-2 text-[10px] text-zinc-400">
            Every
            <input
              type="number"
              min={5}
              max={10080}
              value={everyMinutes}
              onChange={(event) => setEveryMinutes(Number(event.target.value))}
              className="w-20 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-[11px] text-zinc-100"
            />
            minutes
          </label>
        )}
        {kind === 'once' && (
          <label className="flex items-center gap-2 text-[10px] text-zinc-400">
            Run at
            <input
              type="datetime-local"
              value={runAt}
              onChange={(event) => setRunAt(event.target.value)}
              className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-[11px] text-zinc-100"
            />
          </label>
        )}
        <button
          type="button"
          onClick={() => void handleCreate()}
          disabled={creating}
          className="inline-flex items-center gap-1 rounded-md border border-cyan-400/40 bg-cyan-500/10 px-2 py-1 text-[11px] font-medium text-cyan-200 disabled:opacity-50"
        >
          {creating ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
          Create schedule
        </button>
      </div>

      <div className="space-y-1.5">
        <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
          {loading ? 'Loading…' : `${schedules.length} schedule${schedules.length === 1 ? '' : 's'}`}
        </div>
        {!loading && schedules.length === 0 && (
          <p className="text-[11px] text-zinc-500">No schedules yet.</p>
        )}
        {schedules.map((schedule) => (
          <div key={schedule.id} className="rounded-lg border border-zinc-800 bg-zinc-900/30 px-2 py-1.5 space-y-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-[11px] font-medium text-zinc-100">{schedule.name}</span>
              <span
                className={`rounded border px-1 text-[9px] uppercase ${
                  schedule.enabled
                    ? 'border-emerald-400/40 text-emerald-300'
                    : 'border-zinc-600 text-zinc-500'
                }`}
              >
                {schedule.enabled ? 'on' : 'off'}
              </span>
              <span className={`ml-auto text-[9px] font-mono ${statusTone(schedule.lastStatus)}`}>
                {schedule.lastStatus || 'never'}
              </span>
            </div>
            <div className="text-[10px] text-zinc-500">
              {describeSpec(schedule)} · next {formatWhen(schedule.nextRunAt)}
            </div>
            {schedule.lastError && (
              <div className="text-[10px] text-red-300 line-clamp-2">{schedule.lastError}</div>
            )}
            {schedule.lastOutput && !schedule.lastError && (
              <div className="text-[10px] text-zinc-500 line-clamp-2">{schedule.lastOutput}</div>
            )}
            <div className="flex flex-wrap items-center gap-1 pt-0.5">
              <button
                type="button"
                onClick={() => void handleRun(schedule)}
                disabled={busyId === schedule.id || !schedule.enabled}
                className="inline-flex items-center gap-1 rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-300 hover:border-cyan-400/40 disabled:opacity-40"
              >
                <Play size={9} /> Run
              </button>
              <button
                type="button"
                onClick={() => void handleToggle(schedule)}
                disabled={busyId === schedule.id}
                className="rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-300 hover:border-amber-400/40 disabled:opacity-40"
              >
                {schedule.enabled ? 'Disable' : 'Enable'}
              </button>
              <button
                type="button"
                onClick={() => void handleCopyWebhook(schedule)}
                className="inline-flex items-center gap-1 rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-300 hover:border-cyan-400/40"
              >
                {copiedToken === schedule.id ? <Check size={9} /> : <Copy size={9} />}
                Webhook
              </button>
              <button
                type="button"
                onClick={() => void handleDelete(schedule)}
                disabled={busyId === schedule.id}
                className="ml-auto inline-flex items-center gap-1 rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] text-red-300 hover:border-red-400/40 disabled:opacity-40"
              >
                <Trash2 size={9} /> Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default AutomationSchedulePanel;
