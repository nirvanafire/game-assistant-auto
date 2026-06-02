import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { findAvailablePort } from './port';
import type { Logger } from '../services/logger';

export type ManagerStatus = 'idle' | 'starting' | 'running' | 'stopped' | 'error';

export class PythonManager {
  private process: ChildProcess | null = null;
  private port: number = 0;
  private status: ManagerStatus = 'idle';
  private servicePath: string;
  private restartCount: number = 0;
  private maxRestarts: number = 3;
  private logger?: Logger;

  constructor(servicePath: string, logger?: Logger) {
    this.servicePath = servicePath;
    this.logger = logger;
  }

  getStatus(): ManagerStatus {
    return this.status;
  }

  getPort(): number {
    return this.port;
  }

  getUrl(): string {
    return `http://127.0.0.1:${this.port}`;
  }

  async start(): Promise<number> {
    if (this.status === 'running') return this.port;

    this.status = 'starting';
    this.port = await findAvailablePort(5000);
    this.logger?.info('Python', `Starting on port ${this.port}`);

    return new Promise((resolve, reject) => {
      const mainScript = path.join(this.servicePath, 'main.py');
      this.process = spawn('python', [mainScript, String(this.port)], {
        cwd: this.servicePath,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      this.process.stdout?.on('data', (data: Buffer) => {
        const msg = data.toString();
        if (msg.includes('Running on')) {
          this.status = 'running';
          resolve(this.port);
        }
      });

      this.process.stderr?.on('data', (data: Buffer) => {
        const msg = data.toString();
        if (msg.includes('Running on')) {
          this.status = 'running';
          resolve(this.port);
        }
      });

      this.process.on('spawn', () => {
        setTimeout(() => {
          if (this.status === 'starting') {
            this.status = 'running';
            resolve(this.port);
          }
        }, 2000);
      });

      this.process.on('error', (err) => {
        this.logger?.error('Python', `Process error: ${err.message}`);
        this.status = 'error';
        reject(err);
      });

      this.process.on('exit', (code) => {
        this.logger?.warn('Python', `Process exited with code ${code}`);
        if (this.status === 'running' && this.restartCount < this.maxRestarts) {
          this.restartCount++;
          this.logger?.info('Python', `Restarting (attempt ${this.restartCount})`);
          this.start();
        } else if (this.status !== 'stopped') {
          this.status = 'error';
        }
      });
    });
  }

  stop(): void {
    this.status = 'stopped';
    if (this.process && !this.process.killed) {
      this.process.kill();
    }
    this.process = null;
  }
}
