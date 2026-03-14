# Specification: Audio Earcons, Demo UI Polish, and Scenario Integration

## Overview
This track focuses on completing the implementation of the `idea.md` MVP requirements by adding non-visual state feedback (Audio Earcons), polishing the demo flow UI (Debug Panel, Proactive UX, Fallbacks), and integrating the three stretch goal scenarios (Nova Act Grounding, Medication Safety, and Document Interpreter).

## Functional Requirements
- **Audio Earcons:**
  - Play a soft chime when a proactive observation is ready.
  - Play a subtle click when a new frame/scene is successfully processed.
  - Play a listening tone when the AI detects speech and is listening.
- **Demo Flow UI Polish:**
  - Real-time updates in the Debug Panel showing the 'World Memory' JSON structure.
  - Smooth UX handling for AI proactive interruptions.
  - Robust UI presentation for fallback/error states (e.g., blurry text refusal).
- **Stretch Scenario Integration:**
  - **Nova Act Grounding:** Ground grocery comparisons with external product data.
  - **Medication Safety:** Implement medication bottle reading with strict safety refusal guardrails.
  - **Document Interpreter:** Implement government letter reading and next-step extraction.

## Non-Functional Requirements
- Ensure low-latency playback of earcons to prevent interrupting the voice stream.
- Audio should not conflict with Nova 2 Sonic real-time voice outputs.

## Acceptance Criteria
- [ ] User hears a soft chime prior to a proactive suggestion.
- [ ] Debug Panel accurately reflects objects seen and current user goal.
- [ ] Fallback messages (e.g., "I cannot read this clearly") display appropriately in the UI.
- [ ] Nova Act successfully returns verified product info in the grocery scenario.
- [ ] Medication safety scenario correctly refuses to read blurry dosage text.
- [ ] Document interpreter scenario correctly summarizes a sample letter.

## Out of Scope
- Full navigation guidance in dynamic traffic.
- Broad medical advice beyond package-label reading.
- Fully autonomous multi-step web automation.