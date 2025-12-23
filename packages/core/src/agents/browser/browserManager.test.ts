/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BrowserManager } from './browserManager.js';
import { chromium } from 'playwright';

// Mock playwright
vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn(),
  },
}));

describe('BrowserManager', () => {
  let browserManager: BrowserManager;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockBrowser: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockContext: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockPage: any;

  beforeEach(() => {
    browserManager = new BrowserManager();

    mockPage = {
      on: vi.fn(),
      isClosed: vi.fn().mockReturnValue(false),
      close: vi.fn(),
    };
    mockContext = {
      newPage: vi.fn().mockResolvedValue(mockPage),
      close: vi.fn(),
    };
    mockBrowser = {
      newContext: vi.fn().mockResolvedValue(mockContext),
      close: vi.fn(),
      isConnected: vi.fn().mockReturnValue(true),
      on: vi.fn(),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (chromium.launch as any).mockResolvedValue(mockBrowser);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should launch a browser instance when getPage is called for the first time', async () => {
    const page = await browserManager.getPage();

    expect(chromium.launch).toHaveBeenCalledWith(
      expect.objectContaining({
        headless: false,
      }),
    );
    expect(mockBrowser.newContext).toHaveBeenCalled();
    expect(mockContext.newPage).toHaveBeenCalled();
    expect(page).toBe(mockPage);
  });

  it('should reuse the existing browser instance on subsequent calls', async () => {
    await browserManager.getPage();
    await browserManager.getPage();

    expect(chromium.launch).toHaveBeenCalledTimes(1);
  });

  it('should relaunch if the browser is disconnected', async () => {
    await browserManager.getPage();

    // Simulate disconnect (mock state)
    mockBrowser.isConnected.mockReturnValue(false);

    await browserManager.getPage();
    expect(chromium.launch).toHaveBeenCalledTimes(2);
  });

  it('should close the browser and cleanup resources', async () => {
    await browserManager.getPage();
    await browserManager.close();

    expect(mockBrowser.close).toHaveBeenCalled();
  });
});
