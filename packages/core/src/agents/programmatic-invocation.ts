/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Config } from '../config/config.js';
import { BaseToolInvocation, type ToolResult } from '../tools/tools.js';
import type {
  ProgrammaticAgentDefinition,
  AgentInputs,
} from './types.js';
import type { MessageBus } from '../confirmation-bus/message-bus.js';
import type { AnsiOutput } from '../utils/terminalSerializer.js';

export class ProgrammaticAgentInvocation extends BaseToolInvocation<
  AgentInputs,
  ToolResult
> {
  constructor(
    private readonly definition: ProgrammaticAgentDefinition,
    private readonly config: Config,
    params: AgentInputs,
    messageBus?: MessageBus,
  ) {
    super(params, messageBus, definition.name, definition.displayName);
  }

  getDescription(): string {
    return `Running programmatic subagent '${this.definition.name}' via tool '${this.definition.toolName}'`;
  }

  async execute(
    signal: AbortSignal,
    updateOutput?: (output: string | AnsiOutput) => void,
  ): Promise<ToolResult> {
    const registry = this.config.getToolRegistry();
    const tool = registry.getTool(this.definition.toolName);

    if (!tool) {
      throw new Error(
        `Tool '${this.definition.toolName}' not found for agent '${this.definition.name}'`,
      );
    }

    // Assume the tool accepts the same parameters as the agent
    // We create the invocation manually
    const invocation = (tool as any).createInvocation(
      this.params,
      this.messageBus,
    );

    return invocation.execute(signal, updateOutput);
  }
}
