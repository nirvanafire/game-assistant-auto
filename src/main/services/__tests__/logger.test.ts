// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { Logger } from '../logger';

describe('Logger', () => {
  const testLogDir = path.join(__dirname, '__test_logs__');

  beforeEach(() => {
    if (fs.existsSync(testLogDir)) {
      fs.rmSync(testLogDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testLogDir)) {
      fs.rmSync(testLogDir, { recursive: true });
    }
  });

  it('creates log file on first write', () => {
    const logger = new Logger(testLogDir, false);
    logger.info('App', 'test message');

    const files = fs.readdirSync(testLogDir);
    expect(files.length).toBe(1);
    expect(files[0]).toMatch(/game-assistant-.*\.log/);
  });

  it('writes INFO log in correct format', () => {
    const logger = new Logger(testLogDir, false);
    logger.info('TaskEngine', 'task started');

    const content = fs.readdirSync(testLogDir);
    const logFile = path.join(testLogDir, content[0]);
    const lines = fs.readFileSync(logFile, 'utf-8').trim().split('\n');

    expect(lines[0]).toMatch(/\[.*\] \[INFO\] \[TaskEngine\] task started/);
  });

  it('does not write DEBUG logs when debug is off', () => {
    const logger = new Logger(testLogDir, false);
    logger.debug('Matcher', 'scale=1.25');

    const files = fs.readdirSync(testLogDir);
    if (files.length === 0) return; // No file created = correct behavior
    const logFile = path.join(testLogDir, files[0]);
    const content = fs.readFileSync(logFile, 'utf-8');
    expect(content).not.toContain('DEBUG');
  });

  it('writes DEBUG logs when debug is on', () => {
    const logger = new Logger(testLogDir, true);
    logger.debug('Matcher', 'scale=1.25');

    const files = fs.readdirSync(testLogDir);
    expect(files.length).toBe(1);
    const logFile = path.join(testLogDir, files[0]);
    const content = fs.readFileSync(logFile, 'utf-8');
    expect(content).toContain('[DEBUG]');
    expect(content).toContain('[Matcher]');
  });

  it('rotates file when size exceeds 10MB', () => {
    const logger = new Logger(testLogDir, false, 1024); // 1KB for testing
    logger.info('App', 'x'.repeat(2000)); // Exceed 1KB

    const files = fs.readdirSync(testLogDir);
    expect(files.length).toBeGreaterThanOrEqual(2);
  });

  it('toggles debug mode', () => {
    const logger = new Logger(testLogDir, false);
    logger.setDebug(true);
    logger.debug('App', 'debug message');

    const files = fs.readdirSync(testLogDir);
    const logFile = path.join(testLogDir, files[0]);
    const content = fs.readFileSync(logFile, 'utf-8');
    expect(content).toContain('debug message');
  });

  it('returns debug state', () => {
    const logger = new Logger(testLogDir, false);
    expect(logger.isDebugEnabled()).toBe(false);
    logger.setDebug(true);
    expect(logger.isDebugEnabled()).toBe(true);
  });
});
