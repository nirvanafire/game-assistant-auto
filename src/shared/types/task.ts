export type TaskStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed' | 'stopped';

export type StepType = 'IMAGE_MATCH' | 'IMAGE_GROUP' | 'CLICK';

export interface StepTransition {
  nextStepId?: string;
  action?: 'END_TASK' | 'END_STEP_GROUP';
}

export interface ImageMatchConfig {
  templatePath: string;
  threshold: number;
  delayMs: number;
  retryCount: number;
  retryIntervalMs: number;
  scaleRange: [number, number];
  captureRegion?: { x: number; y: number; width: number; height: number };
}

export interface ImageGroupMatchConfig {
  templates: Array<{ label: string; templatePath: string; threshold: number }>;
  logic: 'ALL' | 'ANY';
  delayMs: number;
  retryCount: number;
  retryIntervalMs: number;
  scaleRange: [number, number];
}

export interface ClickConfig {
  source: 'fixed' | 'from_step';
  stepId?: string;
  fixedCoords?: { x: number; y: number };
  clickCount: number;
  intervalMs: number;
  delayMs: number;
  button: 'left' | 'right';
}

export interface Step {
  id: string;
  taskId: string;
  type: StepType;
  order: number;
  groupId?: string;
  config: ImageMatchConfig | ImageGroupMatchConfig | ClickConfig;
  onMatch?: StepTransition;
  onMiss?: StepTransition;
  screenshotBeforeMatch: boolean;
  realtimeMatch: boolean;
  cacheCoordinates: boolean;
}

export interface StepGroup {
  id: string;
  taskId: string;
  name: string;
  loopCount: number;
}

export interface InterruptHandler {
  id: string;
  label: string;
  templatePath: string;
  threshold: number;
  action: 'CLICK_AT_MATCH' | 'CLICK_FIXED' | 'SKIP';
  fixedCoords?: { x: number; y: number };
  priority: number;
}

export interface TaskSettings {
  screenshotBeforeMatch: boolean;
  maxRetries: number;
  globalTimeoutMs: number;
  stepTimeoutMs: number;
}

export interface Task {
  id: string;
  name: string;
  status: TaskStatus;
  settings: TaskSettings;
  interruptHandlers: InterruptHandler[];
  createdAt: string;
  updatedAt: string;
}
