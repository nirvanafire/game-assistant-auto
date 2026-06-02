import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { findAvailablePort } from './port';

export type ManagerStatus = 'idle' | 'starting' | 'running' | 'stopped' | 'error';

export class PythonManager {
  private process: ChildProcess | null = null;
  private port: number = 0;
  private status: ManagerStatus = 'idle';
  private servicePath: string;
  private restartCount: number = 0;
  private maxRestarts: number = 3;

  constructor(servicePath: string) {
    this.servicePath = servicePath;
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
        this.status = 'error';
        reject(err);
      });

      this.process.on('exit', (code) => {
        if (this.status === 'running' && this.restartCount < this.maxRestarts) {
          this.restartCount++;
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
