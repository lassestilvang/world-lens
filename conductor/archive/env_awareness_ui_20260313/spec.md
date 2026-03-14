# Specification: Environmental Awareness & Multi-Mode UI Refinement

## Overview
This track completes the core situational intelligence vision of WorldLens by implementing the **Environmental Awareness** mode and refining the user interface to support seamless switching between all primary scenarios (Grocery, Document, Medication, Environment). It introduces a multi-modal interaction model where users can switch modes via UI, voice, or AI recommendation, and ensures safety-critical environmental data is prioritized.

## Functional Requirements
- **Environmental Scene Analysis:**
    - **Safety-Critical Objects:** Identify traffic lights, pedestrian crossings, and potential obstacles.
    - **Scene Context:** Provide high-level descriptions of the user's setting (e.g., "At a busy intersection").
    - **Spatial Reasoning:** Use Nova 2 Lite reasoning to describe relative positions of important landmarks.
- **Multi-Mode UI Refinement:**
    - **Mode Selector:** A prominent UI element to switch between the four modes.
    - **Voice Mode Switching:** Enable the orchestrator to process "Switch to [Mode]" commands.
    - **AI Mode Recommendation:** Display a suggestion if the visual analysis indicates a different mode would be more helpful (e.g., "I see a document, switch to Document mode?").
- **Prioritized Audio Feedback:**
    - Maintain natural conversational flow for general descriptions.
    - Implement a "Safety Interrupt" mechanism to immediately announce dangerous situations (e.g., a red light or approaching vehicle).

## Safety & Guardrails
- **Environment Accuracy:** Explicitly state uncertainty for fast-moving objects or distance estimations.
- **Safety Overlays:** Use high-contrast visual cues for safety-critical objects in the camera view.

## Non-Functional Requirements
- **Responsiveness:** UI mode switching should be instantaneous (< 100ms).
- **Latency:** Safety-critical environment alerts must be processed and spoken within 1.0s.

## Acceptance Criteria
- [ ] Users can switch between all 4 modes via a UI bar and voice commands.
- [ ] Environmental mode correctly identifies and speaks about street-level safety objects.
- [ ] Safety alerts interrupt ongoing speech if a danger is detected.
- [ ] The system suggests mode switches based on scene content (Auto-detection light).

## Out of Scope
- Detailed map integration or GPS-based navigation.
- Multi-user environmental sharing.