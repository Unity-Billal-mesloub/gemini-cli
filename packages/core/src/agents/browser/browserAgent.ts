/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ContentGenerator } from '../../core/contentGenerator.js';
import { browserTools } from './browserTools.js';
import { browserManager } from './browserManager.js';
import type { Content, Part, Tool } from '@google/genai';
import { Environment } from '@google/genai';

import { BrowserLogger } from './browserLogger.js';

// Tool Definitions for Computer Use
const tools: Tool[] = [
  {
    computerUse: {
      environment: Environment.ENVIRONMENT_BROWSER,
    },
  },
];

export class BrowserAgent {
  private logger: BrowserLogger;

  constructor(
    private generator: ContentGenerator,
    tempDir: string = '/tmp', // Default fallback
  ) {
    this.logger = new BrowserLogger(tempDir);
  }

  async runTask(prompt: string, log?: (message: string) => void) {
    const model = 'gemini-2.5-computer-use-preview-10-2025'; // Fixed model for now

    const systemInstruction =
      "You are an expert browser automation agent. Your goal is to fully complete the user's task. Do not stop until the task is completely finished. If you need to perform multiple steps, continue calling tools until the objective is met.\n\nTask: ";
    let currentPrompt: string | Part[] = systemInstruction + prompt;

    const contents: Content[] = [];
    const MAX_ITERATIONS = 20;

    await browserTools.updateBorderOverlay({ active: true, capturing: false });

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      // Capture State
      let screenshotBase64 = '';
      let domSnapshot = '';
      try {
        await browserTools.removeOverlay();
        await browserTools.updateBorderOverlay({
          active: true,
          capturing: true,
        });
        const page = await browserManager.getPage();
        const buffer = await page.screenshot();
        screenshotBase64 = buffer.toString('base64');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const snapshot = await (page as any).accessibility.snapshot();
        if (snapshot) {
          domSnapshot = JSON.stringify(snapshot, null, 2).slice(0, 1000000);
        }
      } catch (_e) {
        // Browser might not be ready
      } finally {
        await browserTools.updateBorderOverlay({
          active: true,
          capturing: false,
        });
      }

      const newContent: Content = { role: 'user', parts: [] };

      if (typeof currentPrompt === 'string') {
        newContent.parts!.push({ text: currentPrompt });
      } else {
        // It's an array of parts (likely function responses)
        newContent.parts!.push(...currentPrompt);
      }

      // Add Visual Grounding
      const isFunctionResponse =
        Array.isArray(currentPrompt) &&
        currentPrompt.length > 0 &&
        'functionResponse' in currentPrompt[0];

      if (!isFunctionResponse) {
        if (domSnapshot) {
          newContent.parts!.push({
            text: `Current Accessibility Tree:
${domSnapshot}`,
          });
        }
        if (screenshotBase64) {
          newContent.parts!.push({
            inlineData: {
              mimeType: 'image/png',
              data: screenshotBase64,
            },
          });
        }
      }

      contents.push(newContent);

      // Call Model
      const result = await this.generator.generateContent(
        {
          model,
          contents,
          config: {
            tools,
          },
        },
        'browser-agent-session',
      );

      const response = result.candidates?.[0]?.content;
      if (!response) break;

      // Log the turn
      void this.logger.logFullTurn(contents, response);
      void this.logger.logSummary(response);

      contents.push(response); // Add model response to history

      const parts = response.parts || [];
      const functionCalls = parts.filter((p) => 'functionCall' in p);

      if (functionCalls.length === 0) {
        await browserTools.removeOverlay();
        return parts.map((p) => p.text).join(''); // Finished
      }

      // Execute Tools
      const functionResponses: Part[] = [];
      for (const part of functionCalls) {
        const call = part.functionCall!;

        if (log) {
          let logMessage = `Executing: ${call.name}`;
          try {
            switch (call.name) {
              case 'navigate':
                logMessage = `Navigating to ${call.args!['url']}`;
                break;
              case 'click_at':
                logMessage = `Clicking at ${call.args!['x']}, ${call.args!['y']}`;
                break;
              case 'type_text_at':
                logMessage = `Typing "${call.args!['text']}" at ${call.args!['x']}, ${call.args!['y']}`;
                break;
              case 'scroll_document':
                logMessage = `Scrolling ${call.args!['direction']} by ${call.args!['amount']}`;
                break;
              case 'drag_and_drop':
                logMessage = `Dragging from ${call.args!['x']}, ${call.args!['y']} to ${call.args!['dest_x']}, ${call.args!['dest_y']}`;
                break;
              case 'pagedown':
                logMessage = 'Pressing PageDown';
                break;
              case 'pageup':
                logMessage = 'Pressing PageUp';
                break;
              default:
                // No specific log message for other tools
                break;
            }
          } catch (_e) {
            // Fallback to generic message if args access fails
          }
          log(logMessage);
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let funcResult: any = {};

        // Check for safety decision
        const args = call.args as {
          safety_decision?: { decision: string; explanation: string };
          [key: string]: unknown;
        };
        if (args?.safety_decision?.decision === 'require_confirmation') {
          return `Action Required: The model requested a safety confirmation for the action "${call.name}". Please confirm if you want to proceed with: ${args.safety_decision.explanation}`;
        }

        try {
          switch (call.name) {
            case 'navigate':
              funcResult = await browserTools.navigate(
                call.args!['url'] as string,
              );
              break;
            case 'click_at':
              funcResult = await browserTools.clickAt(
                call.args!['x'] as number,
                call.args!['y'] as number,
              );
              break;
            case 'type_text_at':
              funcResult = await browserTools.typeTextAt(
                call.args!['x'] as number,
                call.args!['y'] as number,
                call.args!['text'] as string,
                call.args!['press_enter'] as boolean,
                call.args!['clear_before_typing'] as boolean,
              );
              break;
            case 'scroll_document':
              funcResult = await browserTools.scrollDocument(
                call.args!['direction'] as 'up' | 'down' | 'left' | 'right',
                call.args!['amount'] as number,
              );
              break;
            case 'drag_and_drop':
              funcResult = await browserTools.dragAndDrop(
                call.args!['x'] as number,
                call.args!['y'] as number,
                call.args!['dest_x'] as number,
                call.args!['dest_y'] as number,
              );
              break;
            case 'pagedown':
              funcResult = await browserTools.pagedown();
              break;
            case 'pageup':
              funcResult = await browserTools.pageup();
              break;
            case 'key_combination':
              funcResult = await browserTools.keyCombination(
                call.args!['keys'] as string,
              );
              break;
            case 'open_web_browser':
              funcResult = await browserTools.openWebBrowser();
              break;
            default:
              funcResult = { error: `Unknown tool: ${call.name}` };
          }
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          funcResult = { error: message };
        }

        // Ensure URL is included in the response as required by the model
        if (!funcResult.url) {
          try {
            const page = await browserManager.getPage();
            funcResult.url = page.url();
          } catch (_e) {
            funcResult.url = 'about:blank';
          }
        }

        if (log) {
          log(
            `Function result for ${call.name}: ${JSON.stringify(funcResult)}`,
          );
        }

        // Capture state AFTER execution
        let newScreenshot = '';
        let newDom = '';
        try {
          await browserTools.removeOverlay();
          await browserTools.updateBorderOverlay({
            active: true,
            capturing: true,
          });
          const page = await browserManager.getPage();
          const buffer = await page.screenshot();
          newScreenshot = buffer.toString('base64');
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const snapshot = await (page as any).accessibility.snapshot();
          if (snapshot) {
            newDom = JSON.stringify(snapshot, null, 2).slice(0, 1000000);
          }
        } catch (_e) {
          // ignore
        } finally {
          await browserTools.updateBorderOverlay({
            active: true,
            capturing: false,
          });
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const responsePart: any = {
          functionResponse: {
            name: call.name,
            response: funcResult,
            parts: [],
          },
        };

        if (newScreenshot) {
          responsePart.functionResponse.parts.push({
            inlineData: { mimeType: 'image/png', data: newScreenshot },
          });
        }
        if (newDom) {
          responsePart.functionResponse.parts.push({
            text: `current_accessibility_tree:
${newDom}`,
          });
        }

        functionResponses.push(responsePart);
      }

      currentPrompt = functionResponses;
    }
    await browserTools.removeOverlay();
    await browserTools.updateBorderOverlay({ active: false, capturing: false });
    return `The browser agent reached the maximum number of steps (${MAX_ITERATIONS}) without completing the task. Please try refining your prompt or breaking the task into smaller steps.`;
  }
}
