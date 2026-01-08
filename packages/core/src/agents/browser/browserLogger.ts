/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Browser agent logging and UX utilities.
 *
 * Provides structured logging for browser agent activities,
 * writing logs to ~/.gemini/logs/browser/ for debugging.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { homedir } from 'node:os';
import { debugLogger } from '../../utils/debugLogger.js';

/**
 * Gets the browser log directory path.
 */
export function getBrowserLogDir(): string {
  return path.join(homedir(), '.gemini', 'logs', 'browser');
}

/**
 * Browser activity log entry.
 */
export interface BrowserLogEntry {
  timestamp: string;
  type: 'action' | 'navigation' | 'snapshot' | 'error' | 'info';
  tool?: string;
  params?: Record<string, unknown>;
  result?: string;
  error?: string;
  duration?: number;
}

/**
 * Logger for browser agent activities.
 *
 * Writes structured logs to files for debugging and analysis.
 */
export class BrowserLogger {
  private readonly logDir: string;
  private sessionId: string;
  private logPath: string;
  private entries: BrowserLogEntry[] = [];

  constructor() {
    this.logDir = getBrowserLogDir();
    this.sessionId = this.generateSessionId();
    this.logPath = path.join(this.logDir, `session-${this.sessionId}.log`);
  }

  private generateSessionId(): string {
    const now = new Date();
    return `${now.toISOString().replace(/[:.]/g, '-').slice(0, 19)}`;
  }

  private ensureLogDir(): void {
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
    } catch (error) {
      debugLogger.error(`Failed to create browser log directory: ${error}`);
    }
  }

  /**
   * Logs an action (tool call).
   */
  logAction(
    tool: string,
    params: Record<string, unknown>,
    result: string,
    duration?: number,
  ): void {
    this.log({
      timestamp: new Date().toISOString(),
      type: 'action',
      tool,
      params,
      result,
      duration,
    });
  }

  /**
   * Logs a navigation event.
   */
  logNavigation(url: string, result: string): void {
    this.log({
      timestamp: new Date().toISOString(),
      type: 'navigation',
      params: { url },
      result,
    });
  }

  /**
   * Logs a snapshot capture.
   */
  logSnapshot(snapshotLength: number): void {
    this.log({
      timestamp: new Date().toISOString(),
      type: 'snapshot',
      result: `Captured ${snapshotLength} characters`,
    });
  }

  /**
   * Logs an error.
   */
  logError(tool: string, error: string): void {
    this.log({
      timestamp: new Date().toISOString(),
      type: 'error',
      tool,
      error,
    });
  }

  /**
   * Logs informational message.
   */
  logInfo(message: string): void {
    this.log({
      timestamp: new Date().toISOString(),
      type: 'info',
      result: message,
    });
  }

  /**
   * Logs a full turn (model input/output) for debugging.
   */
  async logFullTurn(input: unknown[], output: unknown): Promise<void> {
    const entry = {
      timestamp: new Date().toISOString(),
      type: 'turn' as const,
      input: JSON.stringify(input).slice(0, 500),
      output: JSON.stringify(output).slice(0, 500),
    };
    this.entries.push(entry as unknown as BrowserLogEntry);
    await this.flush();
  }

  private log(entry: BrowserLogEntry): void {
    this.entries.push(entry);

    // Also log to debug logger for immediate visibility
    const logLine = this.formatEntry(entry);
    debugLogger.log(`[Browser] ${logLine}`);

    // Flush periodically
    if (this.entries.length % 10 === 0) {
      void this.flush();
    }
  }

  private formatEntry(entry: BrowserLogEntry): string {
    const parts = [entry.timestamp, entry.type.toUpperCase()];

    if (entry.tool) {
      parts.push(entry.tool);
    }

    if (entry.result) {
      parts.push(entry.result.slice(0, 100));
    }

    if (entry.error) {
      parts.push(`ERROR: ${entry.error}`);
    }

    if (entry.duration !== undefined) {
      parts.push(`(${entry.duration}ms)`);
    }

    return parts.join(' | ');
  }

  /**
   * Flushes logs to disk.
   */
  async flush(): Promise<void> {
    if (this.entries.length === 0) {
      return;
    }

    this.ensureLogDir();

    try {
      const lines =
        this.entries.map((e) => JSON.stringify(e)).join('\n') + '\n';
      await fs.promises.appendFile(this.logPath, lines);
      this.entries = [];
    } catch (error) {
      debugLogger.error(`Failed to write browser log: ${error}`);
    }
  }

  /**
   * Gets the path to the current log file.
   */
  getLogPath(): string {
    return this.logPath;
  }
}
