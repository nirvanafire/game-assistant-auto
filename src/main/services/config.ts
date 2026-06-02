import fs from 'fs';

interface AppConfig {
  autoPruneDays: number;
  pythonPort: number;
  debugMode: boolean;
}

const DEFAULTS: AppConfig = {
  autoPruneDays: 30,
  pythonPort: 5000,
  debugMode: false,
};

export class ConfigService {
  private config: AppConfig;
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.config = { ...DEFAULTS };
    this.load();
  }

  get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return this.config[key];
  }

  set<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void {
    this.config[key] = value;
    this.save();
  }

  getAll(): AppConfig {
    return { ...this.config };
  }

  private load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
        this.config = { ...DEFAULTS, ...data };
      }
    } catch {
      this.config = { ...DEFAULTS };
    }
  }

  private save(): void {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.config, null, 2));
    } catch {
      // Silent fail
    }
  }
}
