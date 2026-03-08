# Script2Video Agent Technical Design

## Scope

This document turns the high-level agent architecture into implementation-facing contracts.

It defines:

- runtime API
- runtime event model
- app bridge contract
- v1 tool schemas
- skill loading contract
- UI integration boundary

This document is intentionally biased toward:

- one primary agent
- maximum LLM autonomy
- minimum orchestration code
- explicit action tools

## Capability Taxonomy

The runtime should be designed around four layers:

1. baseline analysis and advice
2. inspect existing data
3. write understanding documents
4. node workflow operations

### Baseline analysis and advice

This layer covers:

- requirement analysis
- option comparison
- planning
- practical recommendations

It does not require tool use for every answer, but should use tools whenever project facts matter.

### Inspect existing data

This is the retrieval layer.
It includes:

- script lookup
- episode and scene lookup
- character and location lookup
- evidence gathering from project data

### Write understanding documents

This is the durable artifact layer.
It includes outputs derived from project data that become the foundation for later work, such as:

- plot synopsis
- episode summary
- character analysis
- location analysis
- storyboard draft
- prompt draft

### Node workflow operations

This is the execution layer.
It includes:

- text node creation
- future workflow scaffolding
- future multi-node workflow creation

## Runtime API

The runtime should expose one primary entry point.

Suggested file:

- `agents/runtime/agent.ts`

Suggested API:

```ts
export type Script2VideoRunInput = {
  sessionId: string;
  userText: string;
  attachments?: AgentAttachment[];
  enabledSkillIds?: string[];
  uiContext?: AgentUiContext;
  requestedOutcome?: "answer" | "understanding_document" | "node_workflow" | "auto";
};

export type Script2VideoRunOptions = {
  onEvent?: (event: AgentRuntimeEvent) => void;
  signal?: AbortSignal;
};

export type Script2VideoRunResult = {
  finalText: string;
  sessionId: string;
  outputItems: AgentOutputItem[];
  toolCalls: AgentExecutedToolCall[];
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
};

export interface Script2VideoAgentRuntime {
  run(input: Script2VideoRunInput, options?: Script2VideoRunOptions): Promise<Script2VideoRunResult>;
}

export function createScript2VideoAgentRuntime(
  deps: Script2VideoAgentRuntimeDeps
): Script2VideoAgentRuntime;
```

## Runtime Dependencies

```ts
export type Script2VideoAgentRuntimeDeps = {
  bridge: Script2VideoAgentBridge;
  skillLoader: Script2VideoSkillLoader;
  configProvider: Script2VideoAgentConfigProvider;
  sessionStore: Script2VideoSessionStore;
  tracer?: Script2VideoAgentTracer;
};
```

### Dependency responsibilities

`bridge`

- app state access
- app mutations through controlled methods
- durable artifact persistence and node operations

`skillLoader`

- loads skill metadata and prompt overlays

`configProvider`

- returns model/runtime config

`sessionStore`

- stores recent conversation memory and tool activity

`tracer`

- optional observability hook

## Runtime Event Model

The UI should not infer runtime state from raw SDK responses.
The runtime should emit normalized events.

```ts
export type AgentRuntimeEvent =
  | { type: "run_started"; sessionId: string; runId: string }
  | { type: "trace"; runId: string; entry: AgentTraceEntry }
  | { type: "message_delta"; runId: string; delta: string; accumulatedText: string }
  | { type: "tool_called"; call: AgentExecutedToolCall }
  | { type: "tool_completed"; call: AgentExecutedToolCall }
  | { type: "tool_failed"; call: AgentExecutedToolCall; error: string }
  | { type: "message_completed"; runId: string; text: string }
  | { type: "run_completed"; runId: string; result: Script2VideoRunResult }
  | { type: "run_failed"; runId: string; error: string };
```

### Design note

The UI should only consume these events and render:

- tool queue items
- tool results
- thinking / progress status
- assistant text
- error state

The UI should not know whether the runtime internally used one or multiple tool rounds.

## Session Model

Suggested file:

- `agents/runtime/session.ts`

```ts
export type Script2VideoSessionRecord = {
  id: string;
  messages: AgentSessionMessage[];
  updatedAt: number;
};

export type AgentSessionMessage = {
  role: "user" | "assistant" | "tool";
  text?: string;
  toolName?: string;
  toolCallId?: string;
  toolStatus?: "success" | "error";
  toolOutput?: unknown;
  createdAt: number;
};

export interface Script2VideoSessionStore {
  getSession(sessionId: string): Promise<Script2VideoSessionRecord | null> | Script2VideoSessionRecord | null;
  saveSession(record: Script2VideoSessionRecord): Promise<void> | void;
}
```

### Rules

1. Keep session memory small.
2. Long-term truth stays in `ProjectData`, not session history.
3. Tool outputs saved in session should be summarized or structured, not copied as giant blobs unless necessary.

## Agent Config Provider

Suggested file:

- `agents/runtime/config.ts`

```ts
export type Script2VideoAgentModelConfig = {
  model: string;
  temperature?: number;
  maxOutputTokens?: number;
};

export type Script2VideoAgentConfig = {
  model: Script2VideoAgentModelConfig;
  enableTracing?: boolean;
  enableStreaming?: boolean;
};

export interface Script2VideoAgentConfigProvider {
  getConfig(): Promise<Script2VideoAgentConfig> | Script2VideoAgentConfig;
}
```

### Design note

Do not mix provider-specific UI settings into runtime core types.
Normalize them first, then hand one clean config object to the runtime.

## App Bridge Contract

Suggested file:

- `agents/bridge/script2videoBridge.ts`

```ts
import type { ProjectData } from "../types";
import type { WorkflowViewport } from "../../node-workspace/types";

export type CreateTextNodeInput = {
  title: string;
  text: string;
  x?: number;
  y?: number;
  parentId?: string;
};

export type CreateTextNodeResult = {
  id: string;
  title: string;
};

export interface Script2VideoAgentBridge {
  getProjectData(): ProjectData;
  updateProjectData(updater: (prev: ProjectData) => ProjectData): void;
  addTextNode(input: CreateTextNodeInput): CreateTextNodeResult;
  getViewport(): WorkflowViewport | null;
  getNodeCount(): number;
}
```

### Bridge rules

1. The bridge is synchronous from the runtime's point of view unless a tool truly needs async.
2. The runtime does not import React components.
3. The runtime does not import Zustand store directly.
4. All write access to app state passes through bridge methods.

## Tool Registration Contract

Suggested file:

- `agents/tools/index.ts`

```ts
export type Script2VideoToolFactoryDeps = {
  bridge: Script2VideoAgentBridge;
};

export type Script2VideoRegisteredTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  run: (input: unknown) => Promise<unknown> | unknown;
};

export function createScript2VideoTools(
  deps: Script2VideoToolFactoryDeps
): Script2VideoRegisteredTool[];
```

### Tool execution rules

1. Unknown tools must fail loudly.
2. Disabled tools must fail loudly.
3. Tool outputs must be explicit JSON-like objects.
4. Tool result summaries for UI should be derived from actual outputs, not synthetic placeholders.

## Tool Classes In V1

The V1 tool layer should map directly to the product capability model.

### Class 1: inspect existing data

Tools:

- `get_episode_script`
- `get_scene_script`

### Class 2: write understanding documents

Tools:

- `write_project_summary`
- `write_episode_summary`
- `create_text_node`

For the current implementation, the first durable understanding documents are persisted directly into project data through:

- `write_project_summary`
- `write_episode_summary`

`create_text_node` is still part of the write surface, but it currently belongs more to the operational artifact path inside NodeLab than to project summary persistence.

### Class 3: node workflow operations

Tools:

- `create_text_node`

For the current implementation, node operations are intentionally narrow.
`create_node_workflow` exists in the codebase but is not yet part of the stabilized runtime surface.
Future versions may add explicit workflow-building tools back into the primary tool catalog.

## V1 Tool Schemas

These schemas are product-level contracts, not just SDK registration details.

### Durable artifact rule

Any output that is meant to become the basis for later work should be treated as a durable understanding document.
That means:

- it should be explicit in intent
- it should be saveable
- it should not be treated as ordinary assistant chatter

### `get_episode_script`

Input:

```ts
export type GetEpisodeScriptInput = {
  episode_id: number;
  max_chars?: number;
};
```

Output:

```ts
export type GetEpisodeScriptOutput = {
  found: boolean;
  episode_id: number;
  episode_label: string;
  content: string;
};
```

### `get_scene_script`

Input:

```ts
export type GetSceneScriptInput = {
  scene_id?: string;
  episode_id?: number;
  scene_index?: number;
  max_chars?: number;
};
```

Output:

```ts
export type GetSceneScriptOutput = {
  found: boolean;
  episode_id: number;
  scene_id: string;
  scene_title: string;
  content: string;
};
```

### `write_project_summary`

Input:

```ts
export type WriteProjectSummaryInput = {
  summary: string;
};
```

Output:

```ts
export type WriteProjectSummaryOutput = {
  updated: true;
  field: "context.projectSummary";
  chars: number;
  summary: string;
};
```

### `write_episode_summary`

Input:

```ts
export type WriteEpisodeSummaryInput = {
  episode_id: number;
  summary: string;
};
```

Output:

```ts
export type WriteEpisodeSummaryOutput = {
  updated: true;
  episode_id: number;
  episode_label: string;
  field: "context.episodeSummaries";
  chars: number;
  summary: string;
};
```

### `create_text_node`

Input:

```ts
export type CreateTextNodeToolInput = {
  title?: string;
  text: string;
  x?: number;
  y?: number;
  parentId?: string;
};
```

Output:

```ts
export type CreateTextNodeToolOutput = {
  kind: "text_node";
  id: string;
  title: string;
};
```

### Understanding document profiles

When `create_text_node` is used to persist a durable artifact, the content should usually fall into one of these profiles:

- `plot_synopsis`
- `episode_summary`
- `character_analysis`
- `location_analysis`
- `storyboard_draft`
- `prompt_draft`
- `production_notes`

This does not require a separate tool in V1, but the runtime should distinguish these artifacts conceptually from plain chat replies.

## Current Implementation Status

The current codebase has completed the first runnable milestone:

- one single agent runtime
- OpenAI-compatible `Responses`
- Qwen as the primary provider
- OpenRouter as the fallback provider
- local session persistence
- streaming assistant text in the UI
- normalized runtime events for thinking, tool actions, and tool results

The currently stabilized tools are:

- `get_episode_script`
- `get_scene_script`
- `write_project_summary`
- `write_episode_summary`
- `create_text_node`

The following tool families still exist outside the stabilized tool surface:

- broad retrieval (`read_project_data`, `search_script_data`)
- character and location upserts
- multi-node workflow creation

So the next implementation phase should focus on:

- guardrails
- session hardening
- understanding-layer expansion
- skill productization
- workflow scaffold stabilization

## Tool Validation Rules

Each tool module should expose:

- input validator
- executor
- optional UI summary formatter

Suggested shape:

```ts
export type ValidatedTool<I, O> = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  validate: (input: unknown) => I;
  execute: (input: I, deps: Script2VideoToolFactoryDeps) => Promise<O> | O;
  summarize?: (output: O) => string;
};
```

### Hard requirement

Do not silently coerce invalid input into fake success.
Validation errors must surface as actual tool failures.

## Skill Loader Contract

Suggested file:

- `agents/runtime/skills.ts`

```ts
export type Script2VideoSkillDefinition = {
  id: string;
  title: string;
  description: string;
  systemOverlay: string;
  preferredOutcome?: "answer" | "understanding_document" | "node_workflow";
  preferredTools?: string[];
  disabledTools?: string[];
  examples?: Array<{
    input: string;
    output: string;
  }>;
};

export interface Script2VideoSkillLoader {
  listSkills(): Promise<Script2VideoSkillDefinition[]> | Script2VideoSkillDefinition[];
  getSkill(id: string): Promise<Script2VideoSkillDefinition | null> | Script2VideoSkillDefinition | null;
}
```

### Loading source

For V1, read from:

- `skills/<skill-id>/SKILL.md`
- `skills/<skill-id>/agents/openai.yaml`

### Skill composition rules

1. Base system instruction always exists.
2. Enabled skills append overlays.
3. Conflicts resolve by runtime composition rules, not by separate agents.
4. If a skill disables a tool, that tool is excluded from that run.

### Skill routing rule

Skills should bias the agent toward one of these outcome patterns:

- answer directly
- inspect then answer
- inspect then write understanding document
- inspect then create node artifact

## Runtime Instruction Composition

Suggested function:

```ts
export type ComposeAgentInstructionsInput = {
  baseInstruction: string;
  enabledSkills: Script2VideoSkillDefinition[];
  uiContext?: AgentUiContext;
};

export function composeAgentInstructions(
  input: ComposeAgentInstructionsInput
): string;
```

### Composition order

1. base instruction
2. product behavior rules
3. active skill overlays
4. optional UI context hints

### Base instruction goals

The base instruction should say:

- the agent is the Script2Video creative operating layer
- use tools when facts or mutations are involved
- cite episode/scene evidence when relevant
- never invent successful writes
- if a write is requested, use tools instead of pretending the change happened

## Attachment Contract

V1 recommendation:

- keep attachment support out of the runtime until provider support is confirmed

Define the type now, but mark it unsupported unless runtime path is explicitly implemented.

```ts
export type AgentAttachment = {
  id: string;
  kind: "image";
  name: string;
  mimeType: string;
  url: string;
};
```

### Rule

If attachments are unsupported for the current runtime path:

- reject them explicitly
- or hide them in UI

Do not continue with metadata-only pseudo-vision behavior.

## UI Integration Contract

The UI should call one runtime method and render events.

Suggested hook:

- `agents/react/useScript2VideoAgent.ts`

```ts
export type UseScript2VideoAgentOptions = {
  runtime: Script2VideoAgentRuntime;
  sessionId: string;
  onEvent?: (event: AgentRuntimeEvent) => void;
};

export type UseScript2VideoAgentResult = {
  isRunning: boolean;
  sendMessage: (input: Script2VideoRunInput) => Promise<Script2VideoRunResult>;
  cancel: () => void;
};
```

### UI responsibilities

`QalamAgent.tsx` should:

- collect input
- display messages
- display runtime events
- persist UI conversation records
- distinguish normal replies from durable artifacts when the runtime marks them as such

It should not:

- decide how many tool rounds to run
- parse raw tool call payloads
- implement retry orchestration
- simulate tool results

## Conversation UI Mapping

Current UI uses:

- chat message
- tool message
- tool result message

That can stay, but the mapping should come from runtime events.

Suggested mapper:

```ts
export function mapRuntimeEventToUiMessage(
  event: AgentRuntimeEvent
): Message | null;
```

## Tracing Contract

Optional but recommended.

```ts
export interface Script2VideoAgentTracer {
  onRunStarted(input: Script2VideoRunInput): void;
  onToolCalled(call: AgentExecutedToolCall): void;
  onToolCompleted(call: AgentExecutedToolCall): void;
  onRunCompleted(result: Script2VideoRunResult): void;
  onRunFailed(error: string): void;
}
```

This should be runtime-only and optional.

## Error Model

Normalize errors into stable categories.

```ts
export type AgentErrorCode =
  | "invalid_input"
  | "tool_validation_failed"
  | "tool_execution_failed"
  | "provider_request_failed"
  | "provider_response_invalid"
  | "attachments_unsupported"
  | "runtime_aborted";
```

```ts
export type AgentRuntimeError = {
  code: AgentErrorCode;
  message: string;
  cause?: unknown;
};
```

### Rule

The UI should show user-readable messages.
The runtime should preserve machine-readable error codes.

## Recommended File Layout

```txt
agents/
  bridge/
    script2videoBridge.ts
  runtime/
    agent.ts
    config.ts
    instructions.ts
    session.ts
    skills.ts
    types.ts
  tools/
    index.ts
    readProjectData.ts
    searchScriptData.ts
    upsertCharacter.ts
    upsertLocation.ts
    createTextNode.ts
    schemas.ts
  react/
    useScript2VideoAgent.ts
```

## Implementation Sequence

### Step 1

Create types and contracts only:

- runtime types
- bridge interface
- tool input/output types
- skill definition types

### Step 2

Implement bridge and tool modules without changing UI:

- wrap existing `toolActions` logic
- preserve current behavior where correct
- fix contract bugs while extracting

### Step 3

Implement agent runtime:

- base instructions
- tool registration
- session memory
- event emission

### Step 4

Add a thin React hook:

- connect runtime to `QalamAgent.tsx`

### Step 5

Remove legacy hand-written orchestration from UI.

## Explicit Technical Decisions

1. No multi-agent support in V1.
2. No graph runtime in V1.
3. No hidden provider-specific branching in UI.
4. No unsupported attachment path in V1.
5. No fake success on unknown tools.
6. Skills are overlays, not runtime identities.

## Definition of Done For V1

V1 is complete when all of the following are true:

1. A user can ask a script-grounded question.
2. The agent can autonomously choose read/search tools.
3. The agent can answer with grounded output.
4. The agent can write a durable understanding artifact from project data.
5. The agent can persist that artifact as a text node when requested.
6. The agent can update a character or location through tools.
7. The UI only renders runtime events and no longer contains custom tool orchestration logic.
