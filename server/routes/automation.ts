import crypto from 'node:crypto';
import { Router, type NextFunction, type Request, type Response } from 'express';
import {
  consumeWebhookLimit,
  createAutomationSchedule,
  deleteAutomationSchedule,
  findScheduleByToken,
  listAutomationSchedules,
  normalizeVariableValues,
  runAutomationScheduleNow,
  updateAutomationSchedule,
} from '../automationScheduler.js';
import { errorResponse } from '../shared.js';

export const automationRouter = Router();

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Management endpoints are open on the local single-user server by default.
 * Set AUTOMATION_ADMIN_TOKEN to require an x-automation-token header.
 */
function requireAutomationAdmin(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.AUTOMATION_ADMIN_TOKEN || '';
  if (!expected) return next();
  const supplied = String(req.header('x-automation-token') || '');
  if (!safeEqual(supplied, expected)) {
    return errorResponse(res, 401, 'A valid automation admin token is required.');
  }
  return next();
}

automationRouter.get('/api/automation/schedules', requireAutomationAdmin, (_req, res) => {
  return res.json({ data: listAutomationSchedules() });
});

automationRouter.post('/api/automation/schedules', requireAutomationAdmin, (req, res) => {
  try {
    const schedule = createAutomationSchedule({
      name: req.body?.name,
      sourceId: req.body?.sourceId,
      goal: req.body?.goal,
      workflow: req.body?.workflow,
      variables: req.body?.variables,
      spec: req.body?.spec,
      enabled: req.body?.enabled,
    });
    return res.status(201).json({ data: schedule });
  } catch (err: unknown) {
    return errorResponse(res, 400, err instanceof Error ? err.message : 'Could not create schedule.');
  }
});

automationRouter.patch('/api/automation/schedules/:id', requireAutomationAdmin, (req, res) => {
  try {
    const schedule = updateAutomationSchedule(String(req.params.id || ''), {
      name: req.body?.name,
      sourceId: req.body?.sourceId,
      goal: req.body?.goal,
      workflow: req.body?.workflow,
      variables: req.body?.variables,
      spec: req.body?.spec,
      enabled: req.body?.enabled,
    });
    return res.json({ data: schedule });
  } catch (err: unknown) {
    const status = err instanceof Error && err.message === 'Schedule not found.' ? 404 : 400;
    return errorResponse(res, status, err instanceof Error ? err.message : 'Could not update schedule.');
  }
});

automationRouter.delete('/api/automation/schedules/:id', requireAutomationAdmin, (req, res) => {
  if (!deleteAutomationSchedule(String(req.params.id || ''))) {
    return errorResponse(res, 404, 'Schedule not found.');
  }
  return res.json({ data: { deleted: true } });
});

automationRouter.post('/api/automation/schedules/:id/run', requireAutomationAdmin, (req, res) => {
  try {
    const variables = req.body?.variables === undefined
      ? undefined
      : normalizeVariableValues(req.body.variables);
    void runAutomationScheduleNow(String(req.params.id || ''), variables).catch((err) => {
      console.error('[Automation] Manual run failed:', err);
    });
    return res.status(202).json({
      data: {
        accepted: true,
        message: 'Run started. Poll the schedule list for status.',
      },
    });
  } catch (err: unknown) {
    return errorResponse(res, 400, err instanceof Error ? err.message : 'Could not start run.');
  }
});

/**
 * Secret webhook trigger. The random path token is the credential; requests
 * are rate-limited and runs happen asynchronously.
 */
automationRouter.post('/api/automation/hooks/:token', (req, res) => {
  const record = findScheduleByToken(String(req.params.token || ''));
  if (!record) return errorResponse(res, 404, 'Webhook not found.');
  if (!record.enabled) return errorResponse(res, 409, 'This schedule is disabled.');
  if (!consumeWebhookLimit(String(req.params.token || ''))) {
    return errorResponse(res, 429, 'Too many webhook requests. Try again in a minute.');
  }
  try {
    const variables = req.body?.variables === undefined
      ? undefined
      : normalizeVariableValues(req.body.variables, record.workflow);
    void runAutomationScheduleNow(record.id, variables).catch((err) => {
      console.error('[Automation] Webhook run failed:', err);
    });
    return res.status(202).json({
      data: {
        accepted: true,
        scheduleId: record.id,
        message: 'Run started.',
      },
    });
  } catch (err: unknown) {
    return errorResponse(res, 400, err instanceof Error ? err.message : 'Could not start run.');
  }
});

export default automationRouter;
