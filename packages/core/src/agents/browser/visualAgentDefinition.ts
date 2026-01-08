/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Visual Agent definition for coordinate-based browser interactions.
 *
 * The Visual Agent is invoked by the Semantic Browser Agent when:
 * - Coordinate-based clicks or dragging is needed
 * - Elements need to be identified by visual attributes (color, layout)
 * - The accessibility tree doesn't provide sufficient information
 *
 * Uses chrome-devtools-mcp with --experimental-vision for visual tools.
 */

import type { LocalAgentDefinition } from '../types.js';
import { z } from 'zod';
import { VISUAL_AGENT_MODEL } from './modelAvailability.js';

/**
 * Output schema for visual agent results.
 */
export const VisualAgentResultSchema = z.object({
  success: z.boolean().describe('Whether the visual task was completed'),
  output: z.string().describe('Description of actions taken'),
  actions: z.array(z.string()).describe('List of actions performed').optional(),
});

/**
 * System prompt for the visual agent.
 * Uses MCP tools from chrome-devtools-mcp --experimental-vision.
 */
export const VISUAL_SYSTEM_PROMPT = `You are a Visual Delegate Agent. You can see a screenshot of the current browser state.

You MUST perform the necessary actions using the MCP tools (click_at, type_text, scroll, press_key) to fulfill the instruction given.

COORDINATE SYSTEM:
- Coordinates are pixel-based relative to the viewport
- (0,0) is top-left of the visible area
- Use the screenshot to estimate element positions

AVAILABLE TOOLS:
- click_at(x, y) - Click at pixel coordinates
- type_text(text) - Type text at the focused element
- scroll(direction, amount) - Scroll up/down/left/right
- press_key(key) - Press a keyboard key
- take_screenshot() - Get a new screenshot for updated state

IMPORTANT:
- If the element is not visible, use scroll to find it
- Make ONE action at a time and observe the result
- Return a concise summary of your actions when done

When you have completed the instruction, call complete_task with a summary.`;

/**
 * Visual Agent Definition.
 *
 * Uses MCP tools from chrome-devtools-mcp with --experimental-vision.
 */
export const VisualAgentDefinition: LocalAgentDefinition<
  typeof VisualAgentResultSchema
> = {
  name: 'visual_agent',
  kind: 'local',
  displayName: 'Visual Agent',
  description: `Visual delegate agent for coordinate-based browser interactions.
    Handles tasks that require visual identification or precise coordinate actions
    that cannot be done via the accessibility tree.`,

  inputConfig: {
    inputSchema: {
      type: 'object',
      properties: {
        instruction: {
          type: 'string',
          description: 'The visual task instruction.',
        },
        // Note: screenshot is now injected via initialMessages as inlineData,
        // not passed as a text parameter
      },
      required: ['instruction'],
    },
  },

  outputConfig: {
    outputName: 'result',
    description: 'The result of the visual task.',
    schema: VisualAgentResultSchema,
  },

  processOutput: (output) => JSON.stringify(output, null, 2),

  modelConfig: {
    // Using computer use model for visual tasks
    model: VISUAL_AGENT_MODEL,
    generateContentConfig: {
      temperature: 0,
      topP: 0.95,
    },
  },

  runConfig: {
    maxTimeMinutes: 5,
    maxTurns: 10, // Visual tasks should be quick
  },

  // Tools are set dynamically from MCP discovery
  toolConfig: undefined,

  promptConfig: {
    query: `Your task is: \${instruction}

Look at the screenshot and perform the necessary actions.`,
    systemPrompt: VISUAL_SYSTEM_PROMPT,
  },
};
