# Specification: Build core grocery store assistant scenario

## Overview
Implement the primary hackathon MVP scenario for WorldLens: a grocery store voice assistant. The user points their camera at a shelf, asks questions about products, and receives real-time spoken answers. The AI will also proactively offer suggestions based on accumulated memory (e.g., finding a healthier or gluten-free option).

## Requirements
- **Frontend:** Next.js mobile web app with WebRTC/WebSocket streaming for audio and MediaDevices for camera access. Smart frame sampling based on Voice Activity Detection (VAD) and motion stabilization.
- **Backend:** Node.js/AWS Lambda handlers to route requests.
- **AI Integration:** 
  - Amazon Nova 2 Sonic for real-time speech orchestration and async tool calling.
  - Amazon Nova 2 Lite for multimodal scene extraction and memory summarization.
- **State Storage:** DynamoDB for persistent environment memory and user goal tracking.
- **UX/Latency:** Target <=1.5s p95 latency for voice response. Use earcons for non-visual feedback.

## Out of Scope (for this track)
- Complex document reading.
- Medication instruction with strict grounding.
- Web-based browser automation.