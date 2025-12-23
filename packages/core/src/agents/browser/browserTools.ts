/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { browserManager } from './browserManager.js';

export interface ToolResult {
  output?: string;
  error?: string;
  url?: string;
}

export class BrowserTools {
  private async showOverlay(page: any, message: string): Promise<void> {
    await page.evaluate((msg: string) => {
      let overlay = document.getElementById('gemini-overlay');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'gemini-overlay';
        overlay.style.position = 'fixed';
        overlay.style.bottom = '50px';
        overlay.style.left = '50%';
        overlay.style.transform = 'translateX(-50%)';
        overlay.style.background = 'rgba(32, 33, 36, 0.9)';
        overlay.style.color = 'white';
        overlay.style.padding = '12px 24px';
        overlay.style.zIndex = '2147483647';
        overlay.style.borderRadius = '24px';
        overlay.style.fontSize = '16px';
        overlay.style.fontFamily = 'Google Sans, Roboto, sans-serif';
        overlay.style.fontWeight = '500';
        overlay.style.pointerEvents = 'none';
        overlay.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
        overlay.style.transition = 'opacity 0.3s ease-in-out';
        document.body.appendChild(overlay);
      }
      overlay.innerText = msg;
    }, message);
  }

  async updateBorderOverlay(options: { active: boolean; capturing: boolean }): Promise<void> {
    try {
      const page = await browserManager.getPage();
      await page.evaluate(({ active, capturing }) => {
        // 1. Inject CSS if not present
        if (!document.getElementById('gemini-border-style')) {
          const style = document.createElement('style');
          style.id = 'gemini-border-style';
          style.textContent = `
            :root {
              --color-blue: rgb(0, 102, 255);
              --color-blue-glow: rgba(0, 102, 255, 0.9);
            }
            #preact-border-container {
              pointer-events: none;
              z-index: 2147483647;
              position: fixed;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              border: 2px solid var(--color-blue);
              box-shadow: inset 0 0 10px 0px var(--color-blue-glow);
              opacity: 1;
              transition: opacity 300ms ease-in-out;
              box-sizing: border-box;
            }
            #preact-border-container.hidden {
              opacity: 0;
            }
            @keyframes breathe {
              0%, 100% {
                box-shadow: inset 0 0 20px 0px var(--color-blue-glow);
              }
              50% {
                box-shadow: inset 0 0 30px 10px var(--color-blue-glow);
              }
            }
            #preact-border-container.animate-breathing {
              animation: breathe 3s ease-in-out infinite;
            }
          `;
          document.head.appendChild(style);
        }

        // 2. Manage Container
        let container = document.getElementById('preact-border-container');
        if (!container) {
          container = document.createElement('div');
          container.id = 'preact-border-container';
          document.body.appendChild(container);
        }

        // 3. Update State
        if (active) {
          container.classList.remove('hidden');
          if (!capturing) {
            container.classList.add('animate-breathing');
          } else {
            container.classList.remove('animate-breathing');
          }
        } else {
          container.classList.add('hidden');
          container.classList.remove('animate-breathing');
        }
      }, options);
    } catch (e) {
      // Ignore errors (e.g. page closed)
    }
  }

  async removeOverlay(): Promise<void> {
    try {
      const page = await browserManager.getPage();
      await page.evaluate(() => {
        const overlay = document.getElementById('gemini-overlay');
        if (overlay) {
          overlay.remove();
        }
      });
    } catch (e) {
      // Ignore errors if page is closed or not available
    }
  }

  private async moveMouse(page: any, x: number, y: number): Promise<void> {
    await page.evaluate(
      ({ x, y }: { x: number; y: number }) => {
        let cursor = document.getElementById('gemini-cursor');
        if (!cursor) {
          cursor = document.createElement('div');
          cursor.id = 'gemini-cursor';
          cursor.style.position = 'fixed';
          cursor.style.zIndex = '2147483648';
          cursor.style.pointerEvents = 'none';
          cursor.style.transition =
            'top 0.2s ease-out, left 0.2s ease-out, opacity 0.2s ease-in-out, transform 0.1s ease-in-out, background-color 0.1s ease-in-out, width 0.2s, height 0.2s, border-radius 0.2s';
          cursor.style.transform = 'translate(-50%, -50%)';
          // Initialize at center to animate arrival
          cursor.style.left = '50vw';
          cursor.style.top = '50vh';
          document.body.appendChild(cursor);
          // Force layout to ensure transition triggers
          cursor.getBoundingClientRect();
        }
        // Ensure mouse shape
        cursor.style.width = '20px';
        cursor.style.height = '20px';
        cursor.style.borderRadius = '50%';
        cursor.style.boxShadow =
          '0 0 10px 2px rgba(0, 102, 255, 0.8), inset 0 0 5px rgba(0, 102, 255, 0.5)';
        
        cursor.style.opacity = '1';
        cursor.style.left = `${x}px`;
        cursor.style.top = `${y}px`;
        cursor.style.transform = 'translate(-50%, -50%) scale(1)';
        cursor.style.backgroundColor = 'rgba(0, 102, 255, 0.3)';
      },
      { x, y },
    );
    // Wait for the movement animation to visually complete before performing action
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  private async showScrollIndicator(page: any, direction: string): Promise<void> {
    await page.evaluate((dir: string) => {
      let cursor = document.getElementById('gemini-cursor');
      if (!cursor) {
        cursor = document.createElement('div');
        cursor.id = 'gemini-cursor';
        cursor.style.position = 'fixed';
        cursor.style.zIndex = '2147483648';
        cursor.style.pointerEvents = 'none';
        cursor.style.transition =
          'top 0.2s ease-out, left 0.2s ease-out, opacity 0.2s ease-in-out, transform 0.1s ease-in-out, background-color 0.1s ease-in-out, width 0.2s, height 0.2s, border-radius 0.2s';
        cursor.style.transform = 'translate(-50%, -50%)';
        document.body.appendChild(cursor);
      }
      
      // Scroll indicator shape
      cursor.style.width = '20px';
      cursor.style.height = '30px';
      cursor.style.borderRadius = '8px';
      cursor.style.left = '50vw';
      cursor.style.top = '50vh';
      cursor.style.opacity = '1';
      cursor.style.transform = 'translate(-50%, -50%)';
      
      const blue = 'rgba(0, 102, 255, 1)';
      const transparentBlue = 'rgba(0, 102, 255, 0.2)';
      
      if (dir === 'up') {
         cursor.style.background = `linear-gradient(to top, ${transparentBlue}, ${blue})`;
         cursor.style.boxShadow = `0 -5px 10px ${transparentBlue}`;
      } else if (dir === 'down') {
         cursor.style.background = `linear-gradient(to bottom, ${transparentBlue}, ${blue})`;
         cursor.style.boxShadow = `0 5px 10px ${transparentBlue}`;
      } else {
         cursor.style.background = transparentBlue;
         cursor.style.boxShadow = `0 0 10px ${transparentBlue}`;
      }

      // Animate movement slightly
      setTimeout(() => {
         const offset = dir === 'up' ? -20 : (dir === 'down' ? 20 : 0);
         cursor.style.transform = `translate(-50%, calc(-50% + ${offset}px))`;
         cursor.style.opacity = '0';
      }, 300);
    }, direction);
    // Wait for visual effect
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  private async animateClick(page: any): Promise<void> {
    await page.evaluate(() => {
      const cursor = document.getElementById('gemini-cursor');
      if (cursor) {
        // Visual click down - larger and darker
        cursor.style.transform = 'translate(-50%, -50%) scale(1.2)';
        cursor.style.backgroundColor = 'rgba(0, 102, 255, 1)'; // Solid blue
        cursor.style.boxShadow =
          '0 0 15px 4px rgba(0, 102, 255, 1), inset 0 0 5px rgba(255, 255, 255, 0.5)';
        setTimeout(() => {
          // Release and fade out
          cursor.style.transform = 'translate(-50%, -50%) scale(1)';
          cursor.style.backgroundColor = 'rgba(0, 102, 255, 0.3)';
          cursor.style.boxShadow =
            '0 0 10px 2px rgba(0, 102, 255, 0.8), inset 0 0 5px rgba(0, 102, 255, 0.5)';
          cursor.style.opacity = '0';
        }, 150);
      }
    });
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  async navigate(url: string): Promise<ToolResult> {
    const page = await browserManager.getPage();
    await this.showOverlay(page, `Navigating to ${url}`);
    await page.goto(url);
    return { output: `Navigated to ${url}`, url: page.url() };
  }

  private async getViewportSize(page: any): Promise<{ width: number; height: number } | null> {
    const viewport = page.viewportSize();
    if (viewport) {
      return viewport;
    }
    return page.evaluate(() => ({
      width: window.innerWidth,
      height: window.innerHeight,
    }));
  }

  private async getElementLabel(page: any, x: number, y: number): Promise<string | null> {
    return page.evaluate(({ x, y }: { x: number; y: number }) => {
      const el = document.elementFromPoint(x, y);
      if (!el) return null;
      const text =
        (el as HTMLElement).innerText?.trim() ||
        el.getAttribute('aria-label') ||
        el.getAttribute('placeholder') ||
        el.getAttribute('title') ||
        el.getAttribute('alt');
      if (text) {
        return text.slice(0, 30) + (text.length > 30 ? '...' : '');
      }
      return el.tagName.toLowerCase();
    }, { x, y });
  }

  async clickAt(x: number, y: number): Promise<ToolResult> {
    const page = await browserManager.getPage();
    const viewport = await this.getViewportSize(page);
    if (viewport) {
      const actualX = (x / 1000) * viewport.width;
      const actualY = (y / 1000) * viewport.height;

      await this.moveMouse(page, actualX, actualY);

      const label = await this.getElementLabel(page, actualX, actualY);
      const msg = label ? `Clicking "${label}"` : `Clicking at ${x}, ${y}`;
      await this.showOverlay(page, msg);

      await page.mouse.click(actualX, actualY);
      await this.animateClick(page);
      // Wait for visual effect to finish/be seen before returning
      await new Promise((resolve) => setTimeout(resolve, 500));
      return { output: 'Clicked', url: page.url() };
    }
    return { error: 'Viewport not available', url: page.url() };
  }

  async typeTextAt(
    x: number,
    y: number,
    text: string,
    pressEnter: boolean = false,
    clearBeforeTyping: boolean = false,
  ): Promise<ToolResult> {
    const page = await browserManager.getPage();
    const viewport = await this.getViewportSize(page);
    if (viewport) {
      const actualX = (x / 1000) * viewport.width;
      const actualY = (y / 1000) * viewport.height;

      await this.moveMouse(page, actualX, actualY);

      const label = await this.getElementLabel(page, actualX, actualY);
      const msg = label
        ? `Typing "${text}" into ${label}`
        : `Typing "${text}" at ${x}, ${y}`;
      await this.showOverlay(page, msg);

      await page.mouse.click(actualX, actualY);
      await this.animateClick(page); // Click to focus

      if (clearBeforeTyping) {
        // Select all text using keyboard shortcut and delete it
        // Note: 'Control' is commonly used on Linux/Windows. For Mac, 'Meta' might be needed
        // but 'Control' is often safer as a default for browser contexts in some envs.
        // However, Playwright usually handles 'Control' vs 'Meta' if we use 'ControlOrMeta'.
        // But let's stick to 'Control+A' and 'Backspace' for standard clearing behavior.
        await page.keyboard.press('Control+A');
        await page.keyboard.press('Backspace');
      }

      await page.keyboard.type(text);
      if (pressEnter) {
        await page.keyboard.press('Enter');
      }
      // Wait for visual effect to finish/be seen before returning
      await new Promise((resolve) => setTimeout(resolve, 500));
      return { output: `Typed "${text}"`, url: page.url() };
    }
    return { error: 'Viewport not available', url: page.url() };
  }

  async scrollDocument(
    direction: 'up' | 'down' | 'left' | 'right',
    amount: number = 500,
  ): Promise<ToolResult> {
    const page = await browserManager.getPage();
    await this.showScrollIndicator(page, direction);
    await this.showOverlay(page, `Scrolling ${direction}`);
    let deltaX = 0;
    let deltaY = 0;
    
    if (direction === 'up') deltaY = -amount;
    if (direction === 'down') deltaY = amount;
    if (direction === 'left') deltaX = -amount;
    if (direction === 'right') deltaX = amount;

    await page.mouse.wheel(deltaX, deltaY);
    return { output: `Scrolled ${direction} by ${amount}`, url: page.url() };
  }

  async dragAndDrop(
    x: number,
    y: number,
    destX: number,
    destY: number,
  ): Promise<ToolResult> {
    const page = await browserManager.getPage();
    await this.showOverlay(page, `Dragging from ${x},${y} to ${destX},${destY}`);
    const viewport = await this.getViewportSize(page);
    if (viewport) {
      const actualX = (x / 1000) * viewport.width;
      const actualY = (y / 1000) * viewport.height;
      const actualDestX = (destX / 1000) * viewport.width;
      const actualDestY = (destY / 1000) * viewport.height;

      await this.moveMouse(page, actualX, actualY);
      await page.mouse.move(actualX, actualY);
      await this.animateClick(page); // Visual down
      await page.mouse.down();
      
      // Animate move to dest? 
      // For now, just jump cursor to dest before releasing?
      // Or show it at dest.
      await this.moveMouse(page, actualDestX, actualDestY);
      
      await page.mouse.move(actualDestX, actualDestY);
      await page.mouse.up();
      await this.animateClick(page); // Visual release? Or fade out
      
      return { output: `Dragged from ${x},${y} to ${destX},${destY}`, url: page.url() };
    }
    return { error: 'Viewport not available', url: page.url() };
  }

  async pagedown(): Promise<ToolResult> {
    const page = await browserManager.getPage();
    await this.showOverlay(page, 'Pressing PageDown');
    await page.keyboard.press('PageDown');
    return { output: 'Pressed PageDown', url: page.url() };
  }

  async pageup(): Promise<ToolResult> {
    const page = await browserManager.getPage();
    await this.showOverlay(page, 'Pressing PageUp');
    await page.keyboard.press('PageUp');
    return { output: 'Pressed PageUp', url: page.url() };
  }

  async keyCombination(keys: string): Promise<ToolResult> {
    const page = await browserManager.getPage();
    await this.showOverlay(page, `Pressing ${keys}`);
    await page.keyboard.press(keys);
    return { output: `Pressed ${keys}`, url: page.url() };
  }

  async openWebBrowser(): Promise<ToolResult> {
    const page = await browserManager.getPage();
    return { output: 'Browser opened', url: page.url() };
  }
}

export const browserTools = new BrowserTools();
