/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ProgrammaticAgentDefinition } from '../types.js';

export const BrowserAgentDefinition: ProgrammaticAgentDefinition = {
  name: 'browser_agent',
  kind: 'programmatic',
  displayName: 'Browser Agent',
  description:
    'A specialized agent for browsing the web, interacting with websites, and extracting information.',
  toolName: 'computer_use_browser',
  inputConfig: {
    inputs: {
      task: {
        type: 'string',
        description: 'The natural language description of the task to perform.',
        required: true,
      },
    },
  },
};
