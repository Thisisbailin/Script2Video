# Mission Brief — Projector Audio Lab UI + Model Routing
Objective:
- Fix audio lab errors by aligning model selection with fetched Qwen audio models and surfacing errors inline.
- Align Projector (Voice Lab) UI with Agent Settings + Assets panel visual style.

Out-of-scope:
- Backend API changes or new audio synthesis features.
- Model fetch flow outside Agent Settings or Projector UI.

Inputs / Outputs (contracts):
- Inputs: config.textConfig.qwenModels (cached Qwen model list), user prompts/parameters.
- Outputs: TTS request uses selected design/dubbing model; UI state displays results or errors.

Acceptance Criteria (AC):
- AC1: After models are fetched in Agent Settings, Projector shows audio model selectors with the fetched list.
- AC2: Audio generation uses the selected model and shows inline error messaging instead of alerts.
- AC3: Projector UI uses the same panel styling/typography cues as Agent Settings and Assets panels.

Constraints (perf/i18n/a11y/privacy):
- No new dependencies; reuse existing design tokens and components.
- Do not persist API keys outside existing config behavior.

Dependencies & Risks:
- Depends on Qwen API key and model fetch success; provide empty-state guidance when models are unavailable.

Platform Differences via Platform Layer:
- N/A (single web UI).
