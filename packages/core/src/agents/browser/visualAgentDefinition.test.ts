/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import {
  VisualAgentDefinition,
  VisualAgentResultSchema,
  VISUAL_SYSTEM_PROMPT,
} from './visualAgentDefinition.js';

describe('visualAgentDefinition', () => {
  describe('VisualAgentDefinition', () => {
    it('should have correct name and kind', () => {
      expect(VisualAgentDefinition.name).toBe('visual_agent');
      expect(VisualAgentDefinition.kind).toBe('local');
    });

    it('should use flash model for visual tasks', () => {
      expect(VisualAgentDefinition.modelConfig.model).toContain('flash');
    });

    it('should have correct input schema', () => {
      const inputSchema = VisualAgentDefinition.inputConfig.inputSchema as {
        properties: Record<string, unknown>;
      };
      expect(inputSchema.properties['instruction']).toBeDefined();
      // Note: screenshot is now injected via initialMessages, not as input
    });

    it('should have short max turns for quick visual tasks', () => {
      expect(VisualAgentDefinition.runConfig.maxTurns).toBeLessThanOrEqual(15);
    });
  });

  describe('VisualAgentResultSchema', () => {
    it('should validate valid output', () => {
      const validOutput = {
        success: true,
        output: 'Clicked the button',
        actions: ['click_at(500, 500)'],
      };

      const result = VisualAgentResultSchema.safeParse(validOutput);
      expect(result.success).toBe(true);
    });

    it('should allow optional actions field', () => {
      const outputWithoutActions = {
        success: true,
        output: 'Done',
      };

      const result = VisualAgentResultSchema.safeParse(outputWithoutActions);
      expect(result.success).toBe(true);
    });
  });

  describe('VISUAL_SYSTEM_PROMPT', () => {
    it('should include coordinate system explanation', () => {
      expect(VISUAL_SYSTEM_PROMPT).toContain('pixel');
    });

    it('should list available actions', () => {
      expect(VISUAL_SYSTEM_PROMPT).toContain('click_at');
      expect(VISUAL_SYSTEM_PROMPT).toContain('type_text');
      expect(VISUAL_SYSTEM_PROMPT).toContain('scroll');
    });
  });
});
