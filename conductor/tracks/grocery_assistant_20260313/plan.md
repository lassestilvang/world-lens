# Implementation Plan: Build core grocery store assistant scenario

## Phase 1: Project Setup & Next.js Scaffold [checkpoint: ce45c6d]
- [x] Task: Scaffold Next.js project and UI shell [60ed056]
    - [ ] Write Tests
    - [ ] Implement Feature
- [x] Task: Setup WebRTC audio streaming and camera capture (MediaDevices) [d249a4e]
    - [ ] Write Tests
    - [ ] Implement Feature
- [x] Task: Conductor - User Manual Verification 'Phase 1: Project Setup & Next.js Scaffold' (Protocol in workflow.md) [ce45c6d]

## Phase 2: Multimodal Scene Understanding [checkpoint: 8607c83]
- [x] Task: Implement smart frame sampling (motion/VAD) [c13a179]
    - [ ] Write Tests
    - [ ] Implement Feature
- [x] Task: Integrate Amazon Nova 2 Lite for object/text extraction [28c6db3]
    - [ ] Write Tests
    - [ ] Implement Feature
- [x] Task: Conductor - User Manual Verification 'Phase 2: Multimodal Scene Understanding' (Protocol in workflow.md) [8607c83]

## Phase 3: Persistent Memory
- [x] Task: Setup DynamoDB schemas for session memory [945d902]
    - [ ] Write Tests
    - [ ] Implement Feature
- [~] Task: Implement memory context builder and summarization logic
    - [ ] Write Tests
    - [ ] Implement Feature
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Persistent Memory' (Protocol in workflow.md)

## Phase 4: Conversational Voice Orchestration
- [ ] Task: Integrate Amazon Nova 2 Sonic for real-time speech
    - [ ] Write Tests
    - [ ] Implement Feature
- [ ] Task: Implement async tool use for proactive suggestions and memory checks
    - [ ] Write Tests
    - [ ] Implement Feature
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Conversational Voice Orchestration' (Protocol in workflow.md)