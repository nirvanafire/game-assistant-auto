import type { MatchResult, GroupMatchResult } from '@shared/types/match-result';

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

interface HealthResponse {
  status: string;
  version: string;
  opencv_version: string;
}

export class MatcherClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
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

  async health(): Promise<HealthResponse> {
    return this.get<HealthResponse>('/health');
  }

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return res.json();
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return res.json();
  }
}
