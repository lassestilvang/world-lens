# Specification: End-to-End Orchestration Integration

## Overview
This track focuses on closing the loop between the frontend camera stream and the backend AI services. It implements the main application capture loop, integrating smart frame sampling, multimodal analysis, and persistent world memory. The goal is to enable the "Aha!" moment described in the project vision, where the system proactively assists the user based on previously identified goals and newly detected environment context.

## Functional Requirements
- **Automated Capture Loop:** Implement a canvas-based mechanism to sample frames from the live video stream.
- **Smart Sampling Integration:** Integrate the `FrameSampler` utility to trigger frame analysis based on Voice Activity Detection (VAD) and camera stabilization.
- **Goal-Directed Reasoning:** Enable users to set a "User Goal" (e.g., "find healthy cereal") that the orchestrator uses to evaluate incoming frames.
- **Proactive 'Aha!' Moments:**
    - Trigger a "soft chime" earcon when a relevant proactive observation is made.
    - Display the observation in a visual UI overlay.
    - Automatically trigger Nova 2 Sonic to speak the observation.
- **Memory Optimization:** Implement the "Memory Optimizer" logic to summarize the world model after 20 objects have been detected to prevent prompt bloat and latency spikes.

## Non-Functional Requirements
- **Latency Performance:** Target an end-to-end latency (frame trigger to spoken response) of <= 1.5s p95.
- **Battery Efficiency:** Minimize unnecessary LLM calls by strictly adhering to smart sampling triggers.

## Acceptance Criteria
- [ ] Camera frames are captured and sent for analysis only when sampling triggers fire.
- [ ] Proactive observations are correctly triggered when a new object matches a pre-set user goal.
- [ ] Memory context is summarized automatically after reaching the object threshold.
- [ ] Users receive synchronized audio (earcon + speech) and visual feedback for proactive assistance.

## Out of Scope
- Support for multiple cameras.
- Persistent memory across different browsing sessions (memory is session-scoped).