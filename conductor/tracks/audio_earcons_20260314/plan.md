# Implementation Plan: Audio Earcons, Demo UI Polish, and Scenario Integration

## Phase 1: Audio Earcons Implementation [checkpoint: 66ae36f]
- [x] Task: Implement Earcons service [db4aed4]
    - [ ] Write failing test for `EarconService` sound loading and playback
    - [ ] Implement `EarconService` (soft chime, click, listening tone)
    - [ ] Verify test passes and coverage is >80%
- [x] Task: Integrate Earcons into Orchestration [a8926ff]
    - [ ] Write failing tests for triggering earcons during state changes (proactive observation, frame processed, listening)
    - [ ] Update `orchestrator.ts` and `modeSwitching.ts` to trigger earcons
    - [ ] Verify tests pass
- [x] Task: Conductor - User Manual Verification 'Phase 1: Audio Earcons Implementation' (Protocol in workflow.md) [66ae36f]

## Phase 2: Demo Flow UI Polish
- [x] Task: Debug Panel Real-time Updates [efffca5]
    - [ ] Write failing test for `DebugPanel` receiving and rendering 'World Memory' JSON
    - [ ] Implement UI updates in `DebugPanel.tsx` and bind to `memoryContext`
    - [ ] Verify test passes
- [x] Task: Proactive Assist UX [3355834]
    - [ ] Write failing test for handling AI interruptions gracefully in the UI
    - [ ] Implement visual indicator for proactive suggestions in `DocumentOverlay.tsx` or similar component
    - [ ] Verify test passes
- [ ] Task: Error States & Fallbacks UI
    - [ ] Write failing test for rendering "I cannot read this clearly" refusal state
    - [ ] Implement fallback UI components in `CameraStream` and main layout
    - [ ] Verify test passes
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Demo Flow UI Polish' (Protocol in workflow.md)

## Phase 3: Stretch Scenario Integration
- [ ] Task: Nova Act Grounding for Grocery
    - [ ] Write failing test for `groundingOrchestrator` calling external product API mock
    - [ ] Implement Nova Act integration in `groceryIntegration.ts`
    - [ ] Verify test passes
- [ ] Task: Medication Safety Guardrails
    - [ ] Write failing test for medication OCR blurriness refusal
    - [ ] Implement safety refusal logic in `medicationSafety.ts` and `medicationOCR.ts`
    - [ ] Verify test passes
- [ ] Task: Document Interpreter Workflow
    - [ ] Write failing test for document extraction and next-step summarization
    - [ ] Implement logic in `novaVisionDocument.ts`
    - [ ] Verify test passes
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Stretch Scenario Integration' (Protocol in workflow.md)