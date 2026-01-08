/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isUrlAllowed,
  getNavigationRestrictionsMessage,
  isSensitiveAction,
  ActionRateLimiter,
  SENSITIVE_ACTIONS,
} from './browserSecurity.js';
import { makeFakeConfig } from '../../test-utils/config.js';
import type { Config } from '../../config/config.js';

describe('browserSecurity', () => {
  describe('isUrlAllowed', () => {
    let config: Config;

    beforeEach(() => {
      config = makeFakeConfig({});
    });

    it('should allow any URL when no restrictions are set', () => {
      expect(isUrlAllowed('https://example.com', config)).toBe(true);
      expect(isUrlAllowed('https://random-site.org/page', config)).toBe(true);
    });

    it('should block file:// URLs', () => {
      expect(isUrlAllowed('file:///etc/passwd', config)).toBe(false);
    });

    it('should block javascript: URLs', () => {
      expect(isUrlAllowed('javascript:alert(1)', config)).toBe(false);
    });

    it('should block dangerous chrome:// URLs', () => {
      expect(isUrlAllowed('chrome://settings/passwords', config)).toBe(false);
    });

    it('should allow about:blank', () => {
      expect(isUrlAllowed('about:blank', config)).toBe(true);
    });

    it('should respect allowedDomains from config', () => {
      const restrictedConfig = makeFakeConfig({
        agents: {
          overrides: {
            browser_agent: {
              enabled: true,
              customConfig: {
                allowedDomains: ['https://example.com/*', 'https://*.test.org'],
              },
            },
          },
        },
      });

      expect(isUrlAllowed('https://example.com/page', restrictedConfig)).toBe(
        true,
      );
      expect(isUrlAllowed('https://sub.test.org/path', restrictedConfig)).toBe(
        true,
      );
      expect(isUrlAllowed('https://blocked.com', restrictedConfig)).toBe(false);
    });
  });

  describe('getNavigationRestrictionsMessage', () => {
    it('should return empty string when no restrictions', () => {
      const config = makeFakeConfig({});
      expect(getNavigationRestrictionsMessage(config)).toBe('');
    });

    it('should include allowed domains in message', () => {
      const config = makeFakeConfig({
        agents: {
          overrides: {
            browser_agent: {
              enabled: true,
              customConfig: {
                allowedDomains: ['https://example.com', 'https://test.org'],
              },
            },
          },
        },
      });

      const message = getNavigationRestrictionsMessage(config);
      expect(message).toContain('https://example.com');
      expect(message).toContain('https://test.org');
      expect(message).toContain('NAVIGATION RESTRICTIONS');
    });
  });

  describe('isSensitiveAction', () => {
    it('should identify fill actions as sensitive', () => {
      expect(isSensitiveAction('fill')).toBe(true);
      expect(isSensitiveAction('fill_form')).toBe(true);
    });

    it('should identify submit actions as sensitive', () => {
      expect(isSensitiveAction('submit')).toBe(true);
    });

    it('should identify file upload as sensitive', () => {
      expect(isSensitiveAction('upload_file')).toBe(true);
    });

    it('should not flag non-sensitive actions', () => {
      expect(isSensitiveAction('click')).toBe(false);
      expect(isSensitiveAction('navigate')).toBe(false);
      expect(isSensitiveAction('take_snapshot')).toBe(false);
    });
  });

  describe('ActionRateLimiter', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should allow actions within limit', () => {
      const limiter = new ActionRateLimiter({
        maxActionsPerMinute: 5,
        maxNavigationsPerMinute: 2,
      });

      expect(limiter.recordAction()).toBe(true);
      expect(limiter.recordAction()).toBe(true);
      expect(limiter.recordAction()).toBe(true);
    });

    it('should block actions exceeding limit', () => {
      const limiter = new ActionRateLimiter({
        maxActionsPerMinute: 2,
        maxNavigationsPerMinute: 1,
      });

      expect(limiter.recordAction()).toBe(true);
      expect(limiter.recordAction()).toBe(true);
      expect(limiter.recordAction()).toBe(false); // 3rd action blocked
    });

    it('should allow actions after timeout', () => {
      const limiter = new ActionRateLimiter({
        maxActionsPerMinute: 1,
        maxNavigationsPerMinute: 1,
      });

      expect(limiter.recordAction()).toBe(true);
      expect(limiter.recordAction()).toBe(false);

      // Advance time by 1 minute
      vi.advanceTimersByTime(60001);

      expect(limiter.recordAction()).toBe(true);
    });

    it('should track navigations separately from actions', () => {
      const limiter = new ActionRateLimiter({
        maxActionsPerMinute: 1,
        maxNavigationsPerMinute: 1,
      });

      expect(limiter.recordAction()).toBe(true);
      expect(limiter.recordNavigation()).toBe(true);
    });

    it('should reset counters', () => {
      const limiter = new ActionRateLimiter({
        maxActionsPerMinute: 1,
        maxNavigationsPerMinute: 1,
      });

      expect(limiter.recordAction()).toBe(true);
      expect(limiter.recordAction()).toBe(false);

      limiter.reset();

      expect(limiter.recordAction()).toBe(true);
    });
  });

  describe('SENSITIVE_ACTIONS', () => {
    it('should include expected sensitive actions', () => {
      expect(SENSITIVE_ACTIONS).toContain('fill');
      expect(SENSITIVE_ACTIONS).toContain('submit');
      expect(SENSITIVE_ACTIONS).toContain('upload_file');
    });
  });
});
