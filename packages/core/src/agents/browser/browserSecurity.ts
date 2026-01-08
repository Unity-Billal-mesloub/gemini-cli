/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Security utilities for the browser agent.
 *
 * Provides URL validation and navigation restrictions to ensure
 * the browser agent only accesses allowed domains.
 */

import type { Config } from '../../config/config.js';
import { debugLogger } from '../../utils/debugLogger.js';

/**
 * Default allowed URL patterns.
 * These are always allowed even if not in user config.
 */
const DEFAULT_ALLOWED_PATTERNS = [
  'https://*.google.com',
  'https://www.google.com',
  'https://*.github.com',
  'https://github.com',
  'about:blank',
  'chrome://newtab',
];

/**
 * Blocked URL patterns for security.
 * These are never allowed.
 */
const BLOCKED_PATTERNS = [
  'file://',
  'javascript:',
  'data:text/html',
  'chrome://extensions',
  'chrome://settings/passwords',
];

/**
 * Checks if a URL starts with any blocked pattern.
 */
function isBlockedUrl(url: string): boolean {
  return BLOCKED_PATTERNS.some((pattern) =>
    url.toLowerCase().startsWith(pattern.toLowerCase()),
  );
}

/**
 * Converts a URL pattern with wildcards to a regex.
 * Supports * for any characters within a segment.
 */
function patternToRegex(pattern: string): RegExp {
  // Escape regex special chars except *
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  // Replace * with .* for wildcards
  const regexStr = escaped.replace(/\*/g, '.*');
  return new RegExp(`^${regexStr}`, 'i'); // Use prefix match, not full match
}

/**
 * Checks if a URL matches any pattern in a list.
 */
function matchesAnyPattern(url: string, patterns: string[]): boolean {
  return patterns.some((pattern) => {
    const regex = patternToRegex(pattern);
    return regex.test(url);
  });
}

/**
 * Checks if a URL is allowed based on configuration.
 *
 * @param url The URL to check
 * @param config The runtime configuration
 * @returns Whether the URL is allowed for navigation
 */
export function isUrlAllowed(url: string, config: Config): boolean {
  // Check blocked patterns first - use prefix matching
  if (isBlockedUrl(url)) {
    debugLogger.log(`URL blocked by security pattern: ${url}`);
    return false;
  }

  // Get allowed domains from config
  const browserConfig = config.getBrowserAgentConfig();
  const userAllowedDomains = browserConfig.customConfig.allowedDomains ?? [];

  // If no user-defined patterns, allow all non-blocked URLs
  if (userAllowedDomains.length === 0) {
    return true;
  }

  // Combine default and user patterns
  const allAllowedPatterns = [
    ...DEFAULT_ALLOWED_PATTERNS,
    ...userAllowedDomains,
  ];

  // Check if URL matches any allowed pattern
  const isAllowed = matchesAnyPattern(url, allAllowedPatterns);

  if (!isAllowed) {
    debugLogger.log(
      `URL not in allowed list: ${url}. Allowed patterns: ${allAllowedPatterns.join(', ')}`,
    );
  }

  return isAllowed;
}

/**
 * Gets the navigation restrictions message for the system prompt.
 */
export function getNavigationRestrictionsMessage(config: Config): string {
  const browserConfig = config.getBrowserAgentConfig();
  const allowedDomains = browserConfig.customConfig.allowedDomains ?? [];

  if (allowedDomains.length === 0) {
    return '';
  }

  return `
NAVIGATION RESTRICTIONS:
You may only navigate to URLs matching these patterns:
${allowedDomains.map((u) => `- ${u}`).join('\n')}
Attempts to navigate elsewhere will be blocked.`;
}

/**
 * Actions considered sensitive that may require confirmation.
 */
export const SENSITIVE_ACTIONS = [
  'fill', // Filling forms (may contain credentials)
  'submit', // Form submission
  'upload_file', // File uploads
];

/**
 * Checks if an action is considered sensitive.
 */
export function isSensitiveAction(actionName: string): boolean {
  return SENSITIVE_ACTIONS.some(
    (sensitive) =>
      actionName.toLowerCase().includes(sensitive) ||
      sensitive.includes(actionName.toLowerCase()),
  );
}

/**
 * Rate limiting configuration for browser agent.
 */
export interface RateLimitConfig {
  maxActionsPerMinute: number;
  maxNavigationsPerMinute: number;
}

/**
 * Default rate limits.
 */
export const DEFAULT_RATE_LIMITS: RateLimitConfig = {
  maxActionsPerMinute: 60,
  maxNavigationsPerMinute: 10,
};

/**
 * Simple rate limiter for browser actions.
 */
export class ActionRateLimiter {
  private actionTimestamps: number[] = [];
  private navigationTimestamps: number[] = [];
  private readonly limits: RateLimitConfig;

  constructor(limits: RateLimitConfig = DEFAULT_RATE_LIMITS) {
    this.limits = limits;
  }

  /**
   * Records an action and checks if rate limited.
   * @returns true if action is allowed, false if rate limited
   */
  recordAction(): boolean {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Remove old timestamps
    this.actionTimestamps = this.actionTimestamps.filter(
      (t) => t > oneMinuteAgo,
    );

    // Check limit
    if (this.actionTimestamps.length >= this.limits.maxActionsPerMinute) {
      debugLogger.log('Rate limit exceeded for actions');
      return false;
    }

    this.actionTimestamps.push(now);
    return true;
  }

  /**
   * Records a navigation and checks if rate limited.
   * @returns true if navigation is allowed, false if rate limited
   */
  recordNavigation(): boolean {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Remove old timestamps
    this.navigationTimestamps = this.navigationTimestamps.filter(
      (t) => t > oneMinuteAgo,
    );

    // Check limit
    if (
      this.navigationTimestamps.length >= this.limits.maxNavigationsPerMinute
    ) {
      debugLogger.log('Rate limit exceeded for navigations');
      return false;
    }

    this.navigationTimestamps.push(now);
    return true;
  }

  /**
   * Resets all rate limit counters.
   */
  reset(): void {
    this.actionTimestamps = [];
    this.navigationTimestamps = [];
  }
}
