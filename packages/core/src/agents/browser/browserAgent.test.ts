/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BrowserAgent } from './browserAgent.js';
import { browserTools } from './browserTools.js';
import { browserManager } from './browserManager.js';

// Mock BrowserManager and BrowserTools
vi.mock('./browserManager.js', () => ({
  browserManager: {
    getPage: vi.fn(),
  },
}));

vi.mock('./browserTools.js', () => ({
  browserTools: {
    navigate: vi.fn(),
    clickAt: vi.fn(),
    typeTextAt: vi.fn(),
    scrollDocument: vi.fn(),
    dragAndDrop: vi.fn(),
    pagedown: vi.fn(),
    pageup: vi.fn(),
    keyCombination: vi.fn(),
    removeOverlay: vi.fn(),
    updateBorderOverlay: vi.fn(),
  },
}));

describe('BrowserAgent', () => {
  let browserAgent: BrowserAgent;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockClient: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockPage: any;

  beforeEach(() => {
    // Mock GeminiClient
    mockClient = {
      generateContent: vi.fn(),
    };

    browserAgent = new BrowserAgent(mockClient);

    mockPage = {
      screenshot: vi.fn().mockResolvedValue(Buffer.from('fake-screenshot')),
      accessibility: {
        snapshot: vi.fn().mockResolvedValue({ name: 'Root' }),
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (browserManager.getPage as any).mockResolvedValue(mockPage);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should execute a simple task', async () => {
    // Mock model response: Call 'navigate' tool
    mockClient.generateContent
      .mockResolvedValueOnce({
        candidates: [
          {
            content: {
              parts: [
                {
                  functionCall: {
                    name: 'navigate',
                    args: { url: 'https://example.com' },
                  },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        candidates: [
          {
            content: {
              parts: [{ text: 'Done' }],
            },
          },
        ],
      });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (browserTools.navigate as any).mockResolvedValue({ output: 'Navigated' });

    await browserAgent.runTask('Go to example.com');

    expect(browserTools.navigate).toHaveBeenCalledWith('https://example.com');
  });

  it('should log descriptive messages for tools', async () => {
    // Mock model responses for a sequence of tool calls
    mockClient.generateContent
      .mockResolvedValueOnce({
        candidates: [
          {
            content: {
              parts: [
                {
                  functionCall: {
                    name: 'navigate',
                    args: { url: 'https://google.com' },
                  },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        candidates: [
          {
            content: {
              parts: [
                {
                  functionCall: {
                    name: 'type_text_at',
                    args: { x: 100, y: 200, text: 'hello' },
                  },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        candidates: [
          {
            content: {
              parts: [{ text: 'Done' }],
            },
          },
        ],
      });

    // Mock tool implementations
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (browserTools.navigate as any).mockResolvedValue({ output: 'Navigated' });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (browserTools.typeTextAt as any).mockResolvedValue({ output: 'Typed' });

    const logSpy = vi.fn();
    await browserAgent.runTask('Do something', logSpy);

    expect(logSpy).toHaveBeenCalledTimes(4);
    expect(logSpy).toHaveBeenNthCalledWith(
      1,
      'Navigating to https://google.com',
    );
    // Call 2 is the result log
    expect(logSpy).toHaveBeenNthCalledWith(3, 'Typing "hello" at 100, 200');
    // Call 4 is the result log
  });
});
