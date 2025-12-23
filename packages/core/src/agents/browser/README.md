# Browser Control Sub-Agent

This module implements a specialized sub-agent for controlling a web browser
using the `gemini-2.5-computer-use-preview-10-2025` model.

## Capabilities

- **Navigation:** Go to URLs.
- **Interaction:** Click elements, type text, scroll.
- **Visual Context:** Sends screenshots and accessibility tree snapshots to the
  model for visual grounding.

## Architecture

- **`BrowserManager`:** Wraps Playwright to manage the browser instance.
  Currently launches in **headed** mode for visibility and safety.
- **`BrowserTools`:** Defines the low-level actions available to the model
  (`navigate`, `click_at`, etc.).
- **`BrowserAgent`:** Implements the agent loop. It overrides the standard
  `GeminiClient` model to use the specialized Computer Use model. It handles the
  turn-taking loop, capturing state (screenshots/DOM) after every tool execution
  and feeding it back to the model.

* **`BrowserTool`:** The entry point for the main Gemini CLI agent. It exposes a
  `computer_use_browser` tool that the main agent can call to delegate a task to
  this sub-agent.
* **Location:** `packages/core/src/agents/browser/`

## Security

- **Headed Mode:** The browser is launched in headed mode so the user can
  observe all actions.
- **Safety Loop:** The agent loop runs for a maximum of 20 turns to prevent
  infinite loops.
- **Sandboxing:** Playwright is run with `--no-sandbox` and
  `--disable-setuid-sandbox` currently, which is standard for CI/docker
  environments but should be reviewed for local security.

## Usage

To use this feature, the `BrowserTool` must be registered with the
`GeminiClient`. Once registered, you can prompt the CLI:

> "Go to google.com and search for Gemini CLI"

The main agent will invoke `computer_use_browser`, which triggers the sub-agent
loop.
