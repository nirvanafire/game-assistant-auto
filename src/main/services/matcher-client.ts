import type { MatchResult, GroupMatchResult } from '@shared/types/match-result';
import type { Logger } from './logger';

interface MatchRequest {
  screenshot: string;
  template: string;
  threshold: number;
  scaleRange: [number, number];
  region?: { x: number; y: number; width: number; height: number };
}

interface MatchGroupRequest {
  screenshot: string;
  templates: Array<{ label: string; image: string; threshold: number }>;
  logic: 'ALL' | 'ANY';
  scaleRange: [number, number];
}

interface ClickRequest {
  x: number;
  y: number;
  button?: 'left' | 'right';
  count?: number;
  interval?: number;
  duration?: number;
}

interface ClickResponse {
  success: boolean;
  x?: number;
  y?: number;
  error?: string;
}

interface HealthResponse {
  status: string;
  version: string;
  opencv_version: string;
}

export class MatcherClient {
  private baseUrl: string;
  private logger?: Logger;

  constructor(baseUrl: string, logger?: Logger) {
    this.baseUrl = baseUrl;
    this.logger = logger;
  }

  async match(req: MatchRequest): Promise<MatchResult> {
    const body = {
      screenshot: req.screenshot,
      template: req.template,
      threshold: req.threshold,
      scale_range: req.scaleRange,
      region: req.region,
    };
    return this.post<MatchResult>('/match', body);
  }

  async matchGroup(req: MatchGroupRequest): Promise<GroupMatchResult> {
    const body = {
      screenshot: req.screenshot,
      templates: req.templates.map(t => ({
        label: t.label,
        image: t.image,
        threshold: t.threshold,
      })),
      logic: req.logic,
      scale_range: req.scaleRange,
    };
    return this.post<GroupMatchResult>('/match-group', body);
  }

  async click(req: ClickRequest): Promise<ClickResponse> {
    return this.post<ClickResponse>('/click', req);
  }

  async clickAbort(): Promise<{ success: boolean }> {
    return this.post<{ success: boolean }>('/click-abort', {});
  }

  async move(req: { x: number; y: number; duration?: number }): Promise<{ success: boolean; x?: number; y?: number; error?: string }> {
    return this.post('/move', req);
  }

  async health(): Promise<HealthResponse> {
    return this.get<HealthResponse>('/health');
  }

  private async get<T>(path: string): Promise<T> {
    try {
      const res = await fetch(`${this.baseUrl}${path}`);
      if (!res.ok) {
        this.logger?.error('Matcher', `HTTP ${res.status}: ${res.statusText}`);
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      return res.json();
    } catch (err: any) {
      if (err.message?.startsWith('HTTP ')) throw err;
      this.logger?.error('Matcher', `Request failed: ${err.message}`);
      throw err;
    }
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        this.logger?.error('Matcher', `HTTP ${res.status}: ${res.statusText}`);
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      return res.json();
    } catch (err: any) {
      if (err.message?.startsWith('HTTP ')) throw err;
      this.logger?.error('Matcher', `Request failed: ${err.message}`);
      throw err;
    }
  }
}
