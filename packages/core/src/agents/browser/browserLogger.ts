/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { Content } from '@google/genai';

export class BrowserLogger {
  constructor(private readonly tempDir: string) {}

  private getTimestamp(): string {
    return new Date().toISOString().replace(/[:.]/g, '-');
  }

  async logFullTurn(prompt: Content[], response: Content): Promise<void> {
    const timestamp = this.getTimestamp();
    const filename = `browser-agent-${timestamp}-full.json`;
    const filepath = path.join(this.tempDir, filename);

    const data = {
      prompt,
      response,
    };

    try {
      await fs.writeFile(filepath, JSON.stringify(data, null, 2));
    } catch (e) {
      // Ignore logging errors to not disrupt execution
      console.error('Failed to write browser log:', e);
    }
  }

  async logSummary(response: Content): Promise<void> {
    const timestamp = this.getTimestamp();
    const filename = `browser-agent-${timestamp}-summary.txt`;
    const filepath = path.join(this.tempDir, filename);

    let summary = '';
    if (response.parts) {
      for (const part of response.parts) {
        if (part.text) {
          summary += `Text: ${part.text}\n`;
        }
        if (part.functionCall) {
          summary += `Tool Call: ${part.functionCall.name}\n`;
          summary += `Args: ${JSON.stringify(part.functionCall.args, null, 2)}\n`;
        }
      }
    }

    try {
      await fs.writeFile(filepath, summary);
    } catch (e) {
      console.error('Failed to write browser summary log:', e);
    }
  }
}
