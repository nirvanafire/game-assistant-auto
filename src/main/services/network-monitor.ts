import fs from 'fs';
import path from 'path';
import type { WebContents } from 'electron';
import type { Logger } from './logger';

interface NetworkLogEntry {
  id?: number;
  timestamp: string;
  method?: string;
  url: string;
  statusCode?: number;
  requestHeaders?: Record<string, string>;
  requestBody?: string;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
  durationMs?: number;
  resourceType?: string;
  size?: number;
}

export class NetworkMonitor {
  private db: any;
  private webContents: WebContents;
  private logger: Logger;
  private logDir: string;
  private capturing = false;
  private pendingRequests = new Map<string, any>();

  constructor(db: any, webContents: WebContents, logger: Logger, logDir: string) {
    this.db = db;
    this.webContents = webContents;
    this.logger = logger;
    this.logDir = logDir;
  }

  isCapturing(): boolean {
    return this.capturing;
  }

  async start(): Promise<void> {
    if (this.capturing) return;
    try {
      this.webContents.debugger.attach('1.3');
    } catch (err: any) {
      this.logger.error('Network', `Failed to attach debugger: ${err.message}`);
      return;
    }

    this.webContents.debugger.on('message', (_event: any, method: string, params: any) => {
      this.handleCDPEvent(method, params);
    });

    this.webContents.debugger.on('detach', () => {
      this.capturing = false;
      this.logger.warn('Network', 'Debugger detached');
    });

    await this.webContents.debugger.sendCommand('Network.enable');
    this.capturing = true;
    this.logger.info('Network', 'Network monitoring started');
  }

  stop(): void {
    if (!this.capturing) return;
    try { this.webContents.debugger.detach(); } catch {}
    this.capturing = false;
    this.logger.info('Network', 'Network monitoring stopped');
  }

  exportLogs(filters?: { method?: string; url?: string }): string {
    const logs = this.getLogs(filters);
    return JSON.stringify(logs, null, 2);
  }

  getLogs(filters?: { method?: string; url?: string; limit?: number }): NetworkLogEntry[] {
    let sql = 'SELECT id, timestamp, method, url, status_code AS statusCode, request_headers AS requestHeaders, request_body AS requestBody, response_headers AS responseHeaders, response_body AS responseBody, duration_ms AS durationMs, resource_type AS resourceType, size FROM network_logs WHERE 1=1';
    const params: any[] = [];
    if (filters?.method) { sql += ' AND method = ?'; params.push(filters.method); }
    if (filters?.url) { sql += ' AND url LIKE ?'; params.push(`%${filters.url}%`); }
    sql += ' ORDER BY timestamp DESC';
    if (filters?.limit) { sql += ' LIMIT ?'; params.push(filters.limit); }
    return this.db.prepare(sql).all(...params);
  }

  private handleCDPEvent(method: string, params: any): void {
    switch (method) {
      case 'Network.requestWillBeSent': this.onRequestWillBeSent(params); break;
      case 'Network.responseReceived': this.onResponseReceived(params); break;
      case 'Network.loadingFinished': this.onLoadingFinished(params); break;
    }
  }

  private onRequestWillBeSent(params: any): void {
    const { requestId, request, timestamp } = params;
    this.pendingRequests.set(requestId, {
      timestamp: new Date(timestamp * 1000).toISOString(),
      method: request.method,
      url: request.url,
      requestHeaders: request.headers,
      requestBody: request.postData,
      resourceType: params.type,
    });
  }

  private onResponseReceived(params: any): void {
    const { requestId, response } = params;
    const pending = this.pendingRequests.get(requestId);
    if (!pending) return;
    pending.statusCode = response.status;
    pending.responseHeaders = response.headers;
    pending.durationMs = Math.round((response.timing?.receiveHeadersEnd || 0) * 1000);
  }

  private onLoadingFinished(params: any): void {
    const { requestId } = params;
    const pending = this.pendingRequests.get(requestId);
    if (!pending) return;
    this.pendingRequests.delete(requestId);
    this.webContents.debugger.sendCommand('Network.getResponseBody', { requestId }).then((result: any) => {
      this.persistLog({ ...pending, responseBody: result.body, size: result.body?.length || 0 });
    }).catch(() => { this.persistLog(pending); });
  }

  private persistLog(entry: NetworkLogEntry): void {
    try {
      let responseBody = entry.responseBody;
      let responseBodyPath: string | null = null;

      // Store large bodies (>1MB) as files
      if (responseBody && responseBody.length > 1024 * 1024) {
        const bodiesDir = path.join(this.logDir, 'network-bodies');
        fs.mkdirSync(bodiesDir, { recursive: true });
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.txt`;
        responseBodyPath = path.join(bodiesDir, fileName);
        fs.writeFileSync(responseBodyPath, responseBody);
        responseBody = null;
      }

      this.db.prepare(
        'INSERT INTO network_logs (timestamp, method, url, status_code, request_headers, request_body, response_headers, response_body, response_body_path, duration_ms, resource_type, size) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(
        entry.timestamp, entry.method, entry.url, entry.statusCode,
        JSON.stringify(entry.requestHeaders), entry.requestBody,
        JSON.stringify(entry.responseHeaders), responseBody, responseBodyPath,
        entry.durationMs, entry.resourceType, entry.size,
      );
    } catch (err: any) {
      this.logger.error('Network', `Failed to persist log: ${err.message}`);
    }
  }
}
