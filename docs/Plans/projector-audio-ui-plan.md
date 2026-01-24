# Plan — Projector Audio Lab UI + Model Routing
Architecture Intent Block:
- Keep Qwen model fetch source-of-truth in Agent Settings and persist to config for reuse.
- Projector reads cached model list, offers design/dubbing selection, and passes selected model to TTS service.
- Styling aligns with existing app panel system via CSS variables and panel patterns.

Work Breakdown (≤1 day each):
1) Persist Qwen model list + default audio selections in config from Agent Settings fetch.
2) Add Projector audio model selectors wired to config and pass selected model to TTS.
3) Restyle Projector UI to match Agent Settings / Assets panel patterns.

Verification Plan (by AC):
- AC1: Fetch models in Agent Settings and verify selectors populate in Projector.
- AC2: Trigger TTS generation; confirm model parameter and inline error display.
- AC3: Visual review against Agent Settings / Assets panel styling.

Rollback Points:
- Revert ProjectorModule UI changes and config fields if regressions appear.
- Remove qwenModels cache fields from config if persistence causes issues.
