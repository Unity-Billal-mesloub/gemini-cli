/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BrowserLogger } from './browserLogger.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

vi.mock('fs/promises');

describe('BrowserLogger', () => {
  const mockTempDir = '/tmp/gemini-cli-tests';
  let logger: BrowserLogger;

  beforeEach(() => {
    vi.resetAllMocks();
    logger = new BrowserLogger(mockTempDir);
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-12-22T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should log full turn to a file', async () => {
    const prompt = [{ role: 'user', parts: [{ text: 'hello' }] }];
    const response = { role: 'model', parts: [{ text: 'world' }] };

    await logger.logFullTurn(prompt, response);

    const expectedFilename = path.join(
      mockTempDir,
      'browser-agent-2025-12-22T10-00-00-000Z-full.json',
    );

    expect(fs.writeFile).toHaveBeenCalledWith(
      expectedFilename,
      expect.stringContaining('"role": "user"'),
    );
    expect(fs.writeFile).toHaveBeenCalledWith(
      expectedFilename,
      expect.stringContaining('"text": "hello"'),
    );
  });

  it('should log summary to a file', async () => {
    const response = {
      role: 'model',
      parts: [
        { text: 'I am doing something' },
        { functionCall: { name: 'click', args: { x: 1, y: 2 } } },
      ],
    };

    await logger.logSummary(response);

    const expectedFilename = path.join(
      mockTempDir,
      'browser-agent-2025-12-22T10-00-00-000Z-summary.txt',
    );

    expect(fs.writeFile).toHaveBeenCalledWith(
      expectedFilename,
      expect.stringContaining('I am doing something'),
    );
    expect(fs.writeFile).toHaveBeenCalledWith(
      expectedFilename,
      expect.stringContaining('Tool Call: click'),
    );
  });
});
