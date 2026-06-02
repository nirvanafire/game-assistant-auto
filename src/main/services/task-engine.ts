import type { Step, StepGroup, TaskSettings } from '@shared/types/task';
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
    const stepGroups = this.storage.listStepGroups(taskId);
    const startTime = Date.now();
    let stepIndex = 0;

    while (stepIndex < steps.length) {
      if (signal.aborted) throw new Error('STOPPED');
      if (Date.now() - startTime > settings.globalTimeoutMs) {
        this.statuses.set(taskId, 'failed');
        return;
      }

      const currentStep = steps[stepIndex];
      ctx.currentStepId = currentStep.id;

      const group = currentStep.groupId
        ? stepGroups.find(g => g.id === currentStep.groupId)
        : null;

      if (group) {
        const groupSteps = steps.filter(s => s.groupId === group.id);
        const loopCount = group.loopCount === 0 ? Infinity : group.loopCount;
        let broken = false;

        for (let loop = 0; loop < loopCount; loop++) {
          if (signal.aborted) throw new Error('STOPPED');

          for (const groupStep of groupSteps) {
            if (signal.aborted) throw new Error('STOPPED');
            if (Date.now() - startTime > settings.globalTimeoutMs) {
              this.statuses.set(taskId, 'failed');
              return;
            }

            ctx.currentStepId = groupStep.id;

            if (groupStep.screenshotBeforeMatch || !ctx.lastScreenshot) {
              ctx.lastScreenshot = await this.capture.capture();
            }

            const result = await this.executeStepWithTimeout(groupStep, ctx, settings.stepTimeoutMs, signal);
            const transition = result ? groupStep.onMatch : groupStep.onMiss;

            if (transition.action === 'END_TASK') {
              this.statuses.set(taskId, 'completed');
              return;
            }
            if (transition.action === 'END_GROUP_LOOP') {
              broken = true;
              break;
            }
          }

          if (broken) break;
        }

        stepIndex = steps.findIndex((s, i) => i >= stepIndex && s.groupId !== group.id);
        if (stepIndex === -1) {
          this.statuses.set(taskId, 'completed');
          return;
        }
      } else {
        if (currentStep.screenshotBeforeMatch || !ctx.lastScreenshot) {
          ctx.lastScreenshot = await this.capture.capture();
        }

        const result = await this.executeStepWithTimeout(currentStep, ctx, settings.stepTimeoutMs, signal);
        const transition = result ? currentStep.onMatch : currentStep.onMiss;

        if (transition.action === 'END_TASK') {
          this.statuses.set(taskId, 'completed');
          return;
        }

        if (transition.nextStepId) {
          stepIndex = steps.findIndex(s => s.id === transition.nextStepId);
          if (stepIndex === -1) {
            this.statuses.set(taskId, 'completed');
            return;
          }
        } else {
          stepIndex++;
        }
      }
    }

    this.statuses.set(taskId, 'completed');
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
