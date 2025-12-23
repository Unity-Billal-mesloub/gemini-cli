/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BrowserTools } from './browserTools.js';
import { browserManager } from './browserManager.js';

// Mock BrowserManager
vi.mock('./browserManager.js', () => ({
  browserManager: {
    getPage: vi.fn(),
  },
}));

describe('BrowserTools', () => {
  let browserTools: BrowserTools;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockPage: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockMouse: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockKeyboard: any;

  beforeEach(() => {
    browserTools = new BrowserTools();

    mockMouse = {
      click: vi.fn(),
      wheel: vi.fn(),
    };
    mockKeyboard = {
      type: vi.fn(),
      press: vi.fn(),
    };
    mockPage = {
      goto: vi.fn(),
      url: vi.fn().mockReturnValue('https://example.com'),
      viewportSize: vi.fn().mockReturnValue(null),
      evaluate: vi.fn().mockResolvedValue({ width: 1000, height: 1000 }),
      mouse: mockMouse,
      keyboard: mockKeyboard,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (browserManager.getPage as any).mockResolvedValue(mockPage);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('navigate should go to the specified URL', async () => {
    const result = await browserTools.navigate('https://google.com');

    expect(mockPage.goto).toHaveBeenCalledWith('https://google.com');
    expect(result).toEqual({
      output: 'Navigated to https://google.com',
      url: 'https://example.com',
    });
  });

  it('click_at should click at scaled coordinates', async () => {
    // x=500 (50%), y=500 (50%) of 1024x768 viewport -> 512, 384
    const result = await browserTools.clickAt(500, 500);

    // Should call evaluate for: showCursor, getElementLabel, showOverlay, animateClick (and getViewportSize if needed)
    expect(mockPage.evaluate).toHaveBeenCalledTimes(5); 
    expect(mockMouse.click).toHaveBeenCalledWith(500, 500);
    expect(result).toEqual({ output: 'Clicked', url: 'https://example.com' });
  });

  it('type_text_at should click and type', async () => {
    const result = await browserTools.typeTextAt(500, 500, 'hello', true);

    expect(mockMouse.click).toHaveBeenCalledWith(500, 500);
    expect(mockKeyboard.type).toHaveBeenCalledWith('hello');
    expect(mockKeyboard.press).toHaveBeenCalledWith('Enter');
    expect(result).toEqual({
      output: 'Typed "hello"',
      url: 'https://example.com',
    });
  });

  it('scroll_document should scroll the page', async () => {
    await browserTools.scrollDocument('down', 100);
    expect(mockPage.evaluate).toHaveBeenCalledTimes(2);
    expect(mockMouse.wheel).toHaveBeenCalledWith(0, 100);

    await browserTools.scrollDocument('up', 100);
    expect(mockMouse.wheel).toHaveBeenCalledWith(0, -100);
  });

  it('drag_and_drop should perform drag sequence', async () => {
    mockMouse.move = vi.fn();
    mockMouse.down = vi.fn();
    mockMouse.up = vi.fn();

    // 0,0 to 500,500 (scaled from 0,0 -> 500,500 on 1000x1000 viewport)
    await browserTools.dragAndDrop(0, 0, 500, 500);

    expect(mockMouse.move).toHaveBeenNthCalledWith(1, 0, 0);
    expect(mockMouse.down).toHaveBeenCalled();
    expect(mockMouse.move).toHaveBeenNthCalledWith(2, 500, 500);
    expect(mockMouse.up).toHaveBeenCalled();
  });

  it('pagedown/pageup should press keys', async () => {
    await browserTools.pagedown();
    expect(mockKeyboard.press).toHaveBeenCalledWith('PageDown');

    await browserTools.pageup();
    expect(mockKeyboard.press).toHaveBeenCalledWith('PageUp');
  });

  it('removeOverlay should evaluate script', async () => {
    mockPage.evaluate = vi.fn();
    await browserTools.removeOverlay();
    expect(mockPage.evaluate).toHaveBeenCalled();
  });

  it('updateBorderOverlay should evaluate script', async () => {
    mockPage.evaluate = vi.fn();
    await browserTools.updateBorderOverlay({ active: true, capturing: false });
    expect(mockPage.evaluate).toHaveBeenCalled();
  });
});
