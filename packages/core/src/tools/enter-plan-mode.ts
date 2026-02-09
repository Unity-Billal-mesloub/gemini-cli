/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BaseDeclarativeTool,
  BaseToolInvocation,
  type ToolResult,
  Kind,
  type ToolInfoConfirmationDetails,
  ToolConfirmationOutcome,
} from './tools.js';
import type { MessageBus } from '../confirmation-bus/message-bus.js';
import type { Config } from '../config/config.js';
import { ENTER_PLAN_MODE_TOOL_NAME } from './tool-names.js';
import { ApprovalMode, PolicyDecision } from '../policy/types.js';
import path from 'node:path';

export interface EnterPlanModeParams {
  reason?: string;
  /**
   * Optional file path to allow write access to while in Plan Mode.
   */
  path?: string;
  /**
   * Optional list of tools to allow for the specified path.
   * Defaults to ['write_file', 'replace'].
   */
  allowed_tools?: string[];
}

export class EnterPlanModeTool extends BaseDeclarativeTool<
  EnterPlanModeParams,
  ToolResult
> {
  constructor(
    private config: Config,
    messageBus: MessageBus,
  ) {
    super(
      ENTER_PLAN_MODE_TOOL_NAME,
      'Enter Plan Mode',
      'Switch to Plan Mode to safely research, design, and plan complex changes using read-only tools.',
      Kind.Plan,
      {
        type: 'object',
        properties: {
          reason: {
            type: 'string',
            description:
              'Short reason explaining why you are entering plan mode.',
          },
          path: {
            type: 'string',
            description:
              'Optional file path to allow write access to while in Plan Mode. This is useful for planning directly in a file (e.g., a Conductor track plan).',
          },
          allowed_tools: {
            type: 'array',
            items: { type: 'string' },
            description:
              "Optional list of tools to allow for the specified path. Defaults to ['write_file', 'replace'].",
          },
        },
      },
      messageBus,
    );
  }

  protected createInvocation(
    params: EnterPlanModeParams,
    messageBus: MessageBus,
    toolName: string,
    toolDisplayName: string,
  ): EnterPlanModeInvocation {
    return new EnterPlanModeInvocation(
      params,
      messageBus,
      toolName,
      toolDisplayName,
      this.config,
    );
  }
}

export class EnterPlanModeInvocation extends BaseToolInvocation<
  EnterPlanModeParams,
  ToolResult
> {
  private confirmationOutcome: ToolConfirmationOutcome | null = null;

  constructor(
    params: EnterPlanModeParams,
    messageBus: MessageBus,
    toolName: string,
    toolDisplayName: string,
    private config: Config,
  ) {
    super(params, messageBus, toolName, toolDisplayName);
  }

  getDescription(): string {
    return this.params.reason || 'Initiating Plan Mode';
  }

  override async shouldConfirmExecute(
    abortSignal: AbortSignal,
  ): Promise<ToolInfoConfirmationDetails | false> {
    const decision = await this.getMessageBusDecision(abortSignal);
    if (decision === 'ALLOW') {
      return false;
    }

    if (decision === 'DENY') {
      throw new Error(
        `Tool execution for "${
          this._toolDisplayName || this._toolName
        }" denied by policy.`,
      );
    }

    // ASK_USER
    return {
      type: 'info',
      title: 'Enter Plan Mode',
      prompt:
        'This will restrict the agent to read-only tools to allow for safe planning.',
      onConfirm: async (outcome: ToolConfirmationOutcome) => {
        this.confirmationOutcome = outcome;
        await this.publishPolicyUpdate(outcome);
      },
    };
  }

  async execute(_signal: AbortSignal): Promise<ToolResult> {
    if (this.confirmationOutcome === ToolConfirmationOutcome.Cancel) {
      return {
        llmContent: 'User cancelled entering Plan Mode.',
        returnDisplay: 'Cancelled',
      };
    }

    if (this.params.path) {
      const absolutePath = path.resolve(
        this.config.getTargetDir(),
        this.params.path,
      );

      const validationError = this.config.validatePathAccess(absolutePath);
      if (validationError) {
        return {
          llmContent: `Error: ${validationError}`,
          returnDisplay: 'Error: Invalid path',
        };
      }

      // Escape the path for use in a regex. We double-escape backslashes for JSON matching.
      const escapedPath = absolutePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      const allowedTools = this.params.allowed_tools || [
        'write_file',
        'replace',
      ];

      for (const toolName of allowedTools) {
        this.config.addPolicyRule({
          toolName,
          // Allow the exact path OR any subpath (directory support)
          argsPattern: new RegExp(`"file_path":"${escapedPath}(?:/.*)?"`),
          decision: PolicyDecision.ALLOW,
          priority: 80, // Higher than plan.toml defaults (70)
          modes: [ApprovalMode.PLAN],
          source: 'PlanMode',
        });
      }
    }

    this.config.setApprovalMode(ApprovalMode.PLAN);

    let displayMessage = this.params.reason
      ? `Switching to Plan mode: ${this.params.reason}`
      : 'Switching to Plan mode';
    if (this.params.path) {
      displayMessage += ` (Allowed path: ${this.params.path})`;
    }

    return {
      llmContent: this.params.path
        ? `Switching to Plan mode. Write access enabled for: ${this.params.path}`
        : 'Switching to Plan mode.',
      returnDisplay: displayMessage,
    };
  }
}
