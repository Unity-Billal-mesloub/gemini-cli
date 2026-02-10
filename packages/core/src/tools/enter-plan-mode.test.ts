/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EnterPlanModeTool } from './enter-plan-mode.js';
import { createMockMessageBus } from '../test-utils/mock-message-bus.js';
import type { Config } from '../config/config.js';
import type { MessageBus } from '../confirmation-bus/message-bus.js';
import { ToolConfirmationOutcome } from './tools.js';
import { ApprovalMode, PolicyDecision } from '../policy/types.js';

describe('EnterPlanModeTool', () => {
  let tool: EnterPlanModeTool;
  let mockMessageBus: ReturnType<typeof createMockMessageBus>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockConfig: any;

  beforeEach(() => {
    mockMessageBus = createMockMessageBus();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockMessageBus as any).publish.mockResolvedValue(undefined);

    mockConfig = {
      setApprovalMode: vi.fn(),
      addPolicyRule: vi.fn(),
      validatePathAccess: vi.fn().mockReturnValue(null),
      getTargetDir: vi.fn().mockReturnValue('/app'),
      storage: {
        getProjectTempPlansDir: vi.fn().mockReturnValue('/mock/plans/dir'),
      },
    };
    tool = new EnterPlanModeTool(
      mockConfig as Config,
      mockMessageBus as unknown as MessageBus,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('shouldConfirmExecute', () => {
    it('should return info confirmation details when policy says ASK_USER', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const invocation = (tool as any).createInvocation(
        {},
        mockMessageBus as unknown as MessageBus,
        'enter_plan_mode',
        'Enter Plan Mode',
      );

      // Mock getMessageBusDecision to return ASK_USER
      vi.spyOn(
        invocation as unknown as {
          getMessageBusDecision: () => Promise<string>;
        },
        'getMessageBusDecision',
      ).mockResolvedValue('ASK_USER');

      const result = await invocation.shouldConfirmExecute(
        new AbortController().signal,
      );

      expect(result).not.toBe(false);
      if (result === false) return;

      expect(result.type).toBe('info');
      expect(result.title).toBe('Enter Plan Mode');
      if (result.type === 'info') {
        expect(result.prompt).toBe(
          'This will restrict the agent to read-only tools to allow for safe planning.',
        );
      }
    });

    it('should return false when policy decision is ALLOW', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const invocation = (tool as any).createInvocation(
        {},
        mockMessageBus as unknown as MessageBus,
        'enter_plan_mode',
        'Enter Plan Mode',
      );

      // Mock getMessageBusDecision to return ALLOW
      vi.spyOn(
        invocation as unknown as {
          getMessageBusDecision: () => Promise<string>;
        },
        'getMessageBusDecision',
      ).mockResolvedValue('ALLOW');

      const result = await invocation.shouldConfirmExecute(
        new AbortController().signal,
      );

      expect(result).toBe(false);
    });

    it('should throw error when policy decision is DENY', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const invocation = (tool as any).createInvocation(
        {},
        mockMessageBus as unknown as MessageBus,
        'enter_plan_mode',
        'Enter Plan Mode',
      );

      // Mock getMessageBusDecision to return DENY
      vi.spyOn(
        invocation as unknown as {
          getMessageBusDecision: () => Promise<string>;
        },
        'getMessageBusDecision',
      ).mockResolvedValue('DENY');

      await expect(
        invocation.shouldConfirmExecute(new AbortController().signal),
      ).rejects.toThrow(/denied by policy/);
    });
  });

  describe('execute', () => {
    it('should set approval mode to PLAN and return message', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const invocation = (tool as any).createInvocation(
        {},
        mockMessageBus as unknown as MessageBus,
        'enter_plan_mode',
        'Enter Plan Mode',
      );

      const result = await invocation.execute(new AbortController().signal);

      expect(mockConfig.setApprovalMode).toHaveBeenCalledWith(
        ApprovalMode.PLAN,
      );
      expect(result.llmContent).toBe('Switching to Plan mode.');
      expect(result.returnDisplay).toBe('Switching to Plan mode');
    });

    it('should include optional reason in output display', async () => {
      const reason = 'Design new database schema';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const invocation = (tool as any).createInvocation(
        { reason },
        mockMessageBus as unknown as MessageBus,
        'enter_plan_mode',
        'Enter Plan Mode',
      );

      const result = await invocation.execute(new AbortController().signal);

      expect(mockConfig.setApprovalMode).toHaveBeenCalledWith(
        ApprovalMode.PLAN,
      );
      expect(result.llmContent).toBe('Switching to Plan mode.');
      expect(result.returnDisplay).toContain(reason);
    });

    it('should add policy rules if path is provided', async () => {
      const path = 'conductor/plan.md';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const invocation = (tool as any).createInvocation(
        { path },
        mockMessageBus as unknown as MessageBus,
        'enter_plan_mode',
        'Enter Plan Mode',
      );

      const result = await invocation.execute(new AbortController().signal);

      expect(mockConfig.addPolicyRule).toHaveBeenCalledTimes(2); // write_file + replace
      expect(mockConfig.addPolicyRule).toHaveBeenCalledWith(
        expect.objectContaining({
          toolName: 'write_file',
          argsPattern: expect.any(RegExp),
          decision: PolicyDecision.ALLOW,
          source: 'PlanMode',
        }),
      );
      expect(result.llmContent).toContain(path);
    });

    it('should add policy rules supporting directory access', async () => {
      const dirPath = 'conductor/tracks/feature-1';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const invocation = (tool as any).createInvocation(
        { path: dirPath },
        mockMessageBus as unknown as MessageBus,
        'enter_plan_mode',
        'Enter Plan Mode',
      );

      await invocation.execute(new AbortController().signal);

      // Verify the added rule has a regex that matches a file inside the directory
      expect(mockConfig.addPolicyRule).toHaveBeenCalledWith(
        expect.objectContaining({
          toolName: 'write_file',
          argsPattern: expect.any(RegExp),
        }),
      );

      const rule = mockConfig.addPolicyRule.mock.calls.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (call: any[]) => call[0].toolName === 'write_file',
      )[0];

      const regex = rule.argsPattern;
      const childFile = `/app/${dirPath}/plan.md`;
      const exactMatch = `/app/${dirPath}`;

      // Simulate the JSON matching that PolicyEngine does
      expect(`"file_path":"${childFile}"`).toMatch(regex);
      expect(`"file_path":"${exactMatch}"`).toMatch(regex);
    });

    it('should allow relative paths in policy rules when relative path is provided', async () => {
      const relativePath = 'conductor';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const invocation = (tool as any).createInvocation(
        { path: relativePath },
        mockMessageBus as unknown as MessageBus,
        'enter_plan_mode',
        'Enter Plan Mode',
      );

      await invocation.execute(new AbortController().signal);

      const rule = mockConfig.addPolicyRule.mock.calls.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (call: any[]) => call[0].toolName === 'write_file',
      )[0];

      const regex = rule.argsPattern;
      const relativeFile = `${relativePath}/product.md`;

      expect(`"file_path":"${relativeFile}"`).toMatch(regex);
    });

    it('should fail if path validation fails', async () => {
      mockConfig.validatePathAccess.mockReturnValue('Access denied');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const invocation = (tool as any).createInvocation(
        { path: '/forbidden/path' },
        mockMessageBus as unknown as MessageBus,
        'enter_plan_mode',
        'Enter Plan Mode',
      );

      const result = await invocation.execute(new AbortController().signal);

      expect(mockConfig.setApprovalMode).not.toHaveBeenCalled();
      expect(result.returnDisplay).toBe('Error: Invalid path');
    });

    it('should not enter plan mode if cancelled', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const invocation = (tool as any).createInvocation(
        {},
        mockMessageBus as unknown as MessageBus,
        'enter_plan_mode',
        'Enter Plan Mode',
      );

      // Simulate getting confirmation details
      vi.spyOn(
        invocation as unknown as {
          getMessageBusDecision: () => Promise<string>;
        },
        'getMessageBusDecision',
      ).mockResolvedValue('ASK_USER');

      const details = await invocation.shouldConfirmExecute(
        new AbortController().signal,
      );
      expect(details).not.toBe(false);

      if (details) {
        // Simulate user cancelling
        await details.onConfirm(ToolConfirmationOutcome.Cancel);
      }

      const result = await invocation.execute(new AbortController().signal);

      expect(mockConfig.setApprovalMode).not.toHaveBeenCalled();
      expect(result.returnDisplay).toBe('Cancelled');
      expect(result.llmContent).toContain('User cancelled');
    });
  });

  describe('validateToolParams', () => {
    it('should allow empty params', () => {
      const result = tool.validateToolParams({});
      expect(result).toBeNull();
    });

    it('should allow reason param', () => {
      const result = tool.validateToolParams({ reason: 'test' });
      expect(result).toBeNull();
    });
  });
});
