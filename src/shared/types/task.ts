export type TaskStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'stopped';

export type StepType = 'image-match' | 'image-group-match' | 'click' | 'wait' | 'custom';

export interface StepTransition {
  nextStepId: string;
  condition?: string;
}

export interface ImageMatchConfig {
  templatePath: string;
  confidence?: number;
  region?: { x: number; y: number; width: number; height: number };
}

export interface ImageGroupMatchConfig {
  templates: Array<{
    id: string;
    templatePath: string;
    confidence?: number;
  }>;
  matchMode: 'first' | 'best' | 'all';
  region?: { x: number; y: number; width: number; height: number };
}

export interface ClickConfig {
  x: number;
  y: number;
  button?: 'left' | 'right' | 'middle';
  doubleClick?: boolean;
  relativeToMatch?: boolean;
}

export interface Step {
  id: string;
  name: string;
  type: StepType;
  config: ImageMatchConfig | ImageGroupMatchConfig | ClickConfig | Record<string, unknown>;
  transitions?: StepTransition[];
  timeout?: number;
  retries?: number;
}

export interface StepGroup {
  id: string;
  name: string;
  steps: Step[];
  loopCount?: number;
  loopDelay?: number;
}

export interface InterruptHandler {
  id: string;
  name: string;
  priority: number;
  condition: ImageMatchConfig;
  action: Step;
  cooldown?: number;
}

export interface TaskSettings {
  matchInterval?: number;
  screenshotInterval?: number;
  maxRetries?: number;
  timeout?: number;
  onFail?: 'stop' | 'retry' | 'ignore';
}

export interface Task {
  id: string;
  name: string;
  description?: string;
  status: TaskStatus;
  stepGroups: StepGroup[];
  interruptHandlers?: InterruptHandler[];
  settings?: TaskSettings;
  createdAt: number;
  updatedAt: number;
}
