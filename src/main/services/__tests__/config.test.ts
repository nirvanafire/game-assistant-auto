// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConfigService } from '../config';
import fs from 'fs';

vi.mock('fs');

describe('ConfigService', () => {
  beforeEach(() => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.readFileSync).mockReturnValue('{}');
    vi.mocked(fs.writeFileSync).mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns default values when no config file exists', () => {
    const config = new ConfigService('/test/config.json');
    expect(config.get('autoPruneDays')).toBe(30);
    expect(config.get('pythonPort')).toBe(5000);
    expect(config.get('debugMode')).toBe(false);
  });

  it('sets and gets values', () => {
    const config = new ConfigService('/test/config.json');
    config.set('autoPruneDays', 60);
    expect(config.get('autoPruneDays')).toBe(60);
  });

  it('persists to file on set', () => {
    const config = new ConfigService('/test/config.json');
    config.set('autoPruneDays', 60);
    expect(fs.writeFileSync).toHaveBeenCalled();
  });

  it('loads existing config file', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ autoPruneDays: 14 }));
    const config = new ConfigService('/test/config.json');
    expect(config.get('autoPruneDays')).toBe(14);
  });

  it('returns all config', () => {
    const config = new ConfigService('/test/config.json');
    const all = config.getAll();
    expect(all).toHaveProperty('autoPruneDays');
    expect(all).toHaveProperty('pythonPort');
    expect(all).toHaveProperty('debugMode');
  });
});
