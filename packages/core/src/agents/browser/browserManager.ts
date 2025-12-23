/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Browser, BrowserContext, Page } from 'playwright';
import { chromium } from 'playwright';

export class BrowserManager {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;

  async getPage(): Promise<Page> {
    if (!this.browser || !this.browser.isConnected()) {
      this.browser = await chromium.launch({
        headless: false,
        // channel: 'chrome', // Use actual Google Chrome
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--window-size=1024,1024',
        ],
      });

      this.context = await this.browser.newContext({
        viewport: null,
      });

      this.page = await this.context.newPage();

      // Handle page close
      this.page.on('close', () => {
        this.page = null;
      });

      // Handle browser close
      this.browser.on('disconnected', () => {
        this.browser = null;
        this.context = null;
        this.page = null;
      });
    }

    if (!this.page || this.page.isClosed()) {
      if (!this.context) {
        // This case might happen if browser is open but context was closed somehow,
        // though typically they close together.
        if (this.browser) {
          this.context = await this.browser.newContext({
            viewport: null,
          });
        }
      }
      if (this.context) {
        this.page = await this.context.newPage();
      }
    }

    if (!this.page) {
      throw new Error('Failed to create page');
    }

    return this.page;
  }

  async close() {
    await this.browser?.close();
    this.browser = null;
    this.context = null;
    this.page = null;
  }
}

export const browserManager = new BrowserManager();
