import type { Step, TaskSettings } from '@shared/types/task';
import type { MatchResult } from '@shared/types/match-result';
import type { StorageService } from './storage';
import type { CaptureService } from './capture';
import type { MatcherClient } from './matcher-client';
import type { Logger } from './logger';

export type TaskRunStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed' | 'stopped';

interface StepContext {
  variables: Map<string, MatchResult>;
  lastScreenshot: string | null;
  currentStepId: string | null;
}

export class TaskEngine {
  private statuses = new Map<string, TaskRunStatus>();
  private abortControllers = new Map<string, AbortController>();
  private storage: StorageService;
  private capture: CaptureService;
  private matcher: MatcherClient;
  private logger?: Logger;

  constructor(storage: StorageService, capture: CaptureService, matcher: MatcherClient, logger?: Logger) {
    this.storage = storage;
    this.capture = capture;
    this.matcher = matcher;
    this.logger = logger;
  }

  getStatus(taskId: string): TaskRunStatus {
    return this.statuses.get(taskId) || 'idle';
  }

  async start(taskId: string): Promise<void> {
    const task = this.storage.getTask(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);

    const steps = this.storage.listSteps(taskId);
    if (steps.length === 0) {
      this.statuses.set(taskId, 'completed');
      return;
    }

    this.statuses.set(taskId, 'running');
    const abort = new AbortController();
    this.abortControllers.set(taskId, abort);

    const ctx: StepContext = {
      variables: new Map(),
      lastScreenshot: null,
      currentStepId: null,
    };

    try {
      await this.executeSteps(taskId, steps, task.settings, ctx, abort.signal);
    } catch (err: any) {
      if (err.message === 'STOPPED') {
        this.statuses.set(taskId, 'stopped');
      } else {
        this.statuses.set(taskId, 'failed');
        this.logger?.error('TaskEngine', `Task ${taskId} failed: ${err.message}`);
      }
    } finally {
      this.abortControllers.delete(taskId);
    }
  }

  stop(taskId: string): void {
    this.statuses.set(taskId, 'stopped');
    this.abortControllers.get(taskId)?.abort();
  }

  private async executeSteps(
    taskId: string,
    steps: Step[],
    settings: TaskSettings,
    ctx: StepContext,
    signal: AbortSignal,
  ): Promise<void> {
    const stepsById = new Map(steps.map(s => [s.id, s]));
    let currentStep = steps[0];
    const startTime = Date.now();

    while (currentStep) {
      if (signal.aborted) throw new Error('STOPPED');
      if (Date.now() - startTime > settings.globalTimeoutMs) {
        this.statuses.set(taskId, 'failed');
        return;
      }

      ctx.currentStepId = currentStep.id;

      // Screenshot
      if (currentStep.screenshotBeforeMatch || !ctx.lastScreenshot) {
        ctx.lastScreenshot = await this.capture.capture();
      }

      // Execute step with timeout
      const result = await this.executeStepWithTimeout(currentStep, ctx, settings.stepTimeoutMs, signal);
      const transition = result ? currentStep.onMatch : currentStep.onMiss;

      if (transition.action === 'END_TASK') {
        this.statuses.set(taskId, 'completed');
        return;
      }

      if (transition.nextStepId) {
        currentStep = stepsById.get(transition.nextStepId)!;
      } else {
        const idx = steps.indexOf(currentStep);
        if (idx < steps.length - 1) {
          currentStep = steps[idx + 1];
        } else {
          this.statuses.set(taskId, 'completed');
          return;
        }
      }
    }
  }

  private async executeStepWithTimeout(
    step: Step,
    ctx: StepContext,
    timeoutMs: number,
    signal: AbortSignal,
  ): Promise<boolean> {
    if (signal.aborted) throw new Error('STOPPED');

    const timeoutPromise = new Promise<boolean>((_, reject) => {
      const timer = setTimeout(() => reject(new Error('STEP_TIMEOUT')), timeoutMs);
      signal.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('STOPPED')); });
    });

    try {
      return await Promise.race([this.executeStepInner(step, ctx), timeoutPromise]);
    } catch (err: any) {
      if (err.message === 'STEP_TIMEOUT') return false;
      throw err;
    }
  }

  private async executeStepInner(step: Step, ctx: StepContext): Promise<boolean> {
    switch (step.type) {
      case 'IMAGE_MATCH': {
        const config = step.config as any;
        const result = await this.matcher.match({
          screenshot: ctx.lastScreenshot!,
          template: config.templatePath,
          threshold: config.threshold,
          scaleRange: config.scaleRange,
          region: config.captureRegion,
        });
        if (result.matched) {
          ctx.variables.set(step.id, result);
        }
        return result.matched;
      }
      case 'IMAGE_GROUP': {
        const config = step.config as any;
        const result = await this.matcher.matchGroup({
          screenshot: ctx.lastScreenshot!,
          templates: config.templates,
          logic: config.logic,
          scaleRange: config.scaleRange,
        });
        return config.logic === 'ALL'
          ? result.results.every((r: any) => r.matched)
          : result.results.some((r: any) => r.matched);
      }
      case 'CLICK': {
        const config = step.config as any;
        if (config.source === 'from_step' && config.stepId) {
          const matchResult = ctx.variables.get(config.stepId);
          if (!matchResult) return false;
        }
        return true;
      }
      default:
        return false;
    }
  }
}
