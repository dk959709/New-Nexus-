import { api } from '@/services/api';
import { storage } from '@/lib/storage';
import type { AIProviderConfig, AutomationDraft, Workflow, WorkflowNode } from '@/types';
import {
  buildAutomationCreateMessage,
  buildAutomationEditMessage,
  buildAutomationPlannerPrompt,
  buildAutomationRepairMessage,
  buildFallbackPlan,
  parseAutomationPlan,
  type AutomationPlan,
} from '@/lib/automation';

export class AutomationPlannerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AutomationPlannerError';
  }
}

export interface AutomationPlanResponse {
  plan: AutomationPlan;
  usedFallback: boolean;
  error?: string;
}

async function callPlanner(
  message: string,
  providerConfig?: AIProviderConfig | null,
): Promise<string> {
  const effectiveProvider = providerConfig ?? storage.getActiveAIProvider();
  const response = await api.aiChat(message, [], '', effectiveProvider, false, {
    skillsText: buildAutomationPlannerPrompt(),
    maxTokens: 4000,
    timeoutMs: 120000,
    disableReasoning: true,
  });
  return (response.answer || '').trim();
}

function withRepairHint(message: string, error: string): string {
  return [
    message,
    '',
    `Your previous response could not be used: ${error}`,
    'Return ONLY a corrected, complete JSON object. Do not include markdown fences or explanations.',
  ].join('\n');
}

function ensureWorkflowId(plan: AutomationPlan, workflowId: string): AutomationPlan {
  plan.workflow.id = workflowId;
  return plan;
}

export async function createAutomationPlan(
  goal: string,
  attachmentText?: string,
  providerConfig?: AIProviderConfig | null,
): Promise<AutomationPlanResponse> {
  const cleanGoal = goal.trim();
  if (!cleanGoal) throw new AutomationPlannerError('Describe what you want to automate first.');
  const message = buildAutomationCreateMessage(cleanGoal, attachmentText);

  let lastError = '';
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const answer = await callPlanner(
        attempt === 0 ? message : withRepairHint(message, lastError),
        providerConfig,
      );
      const parsed = parseAutomationPlan(answer, cleanGoal);
      if (parsed.ok && parsed.plan) {
        return { plan: parsed.plan, usedFallback: false };
      }
      lastError = parsed.error || parsed.errors[0] || 'The generated workflow was invalid.';
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'The planner request failed.';
    }
  }

  const fallback = buildFallbackPlan(cleanGoal, lastError);
  return { plan: fallback, usedFallback: true, error: lastError };
}

export async function editAutomationPlan(
  draft: AutomationDraft,
  instruction: string,
  providerConfig?: AIProviderConfig | null,
): Promise<AutomationPlan> {
  const cleanInstruction = instruction.trim();
  if (!cleanInstruction) throw new AutomationPlannerError('Describe the change you want.');
  const message = buildAutomationEditMessage(draft, cleanInstruction);

  let lastError = '';
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const answer = await callPlanner(
        attempt === 0 ? message : withRepairHint(message, lastError),
        providerConfig,
      );
      const parsed = parseAutomationPlan(answer, draft.goal);
      if (parsed.ok && parsed.plan) {
        return ensureWorkflowId(parsed.plan, draft.workflow.id);
      }
      lastError = parsed.error || parsed.errors[0] || 'The edited workflow was invalid.';
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'The planner request failed.';
    }
  }
  throw new AutomationPlannerError(lastError || 'The automation could not be updated.');
}

export async function repairAutomationPlan(
  workflow: Workflow,
  failedNode: WorkflowNode | null,
  error: string,
  outputSummary?: string,
  providerConfig?: AIProviderConfig | null,
): Promise<AutomationPlan> {
  const message = buildAutomationRepairMessage(workflow, failedNode, error, outputSummary);
  let lastError = '';

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const answer = await callPlanner(
        attempt === 0 ? message : withRepairHint(message, lastError),
        providerConfig,
      );
      const parsed = parseAutomationPlan(answer, workflow.description || workflow.name);
      if (parsed.ok && parsed.plan) {
        return ensureWorkflowId(parsed.plan, workflow.id);
      }
      lastError = parsed.error || parsed.errors[0] || 'The repaired workflow was invalid.';
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'The repair request failed.';
    }
  }
  throw new AutomationPlannerError(lastError || 'The automation could not be repaired.');
}
