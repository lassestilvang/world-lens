# Technology Stack: WorldLens

## 1. Core Architecture
- **Infrastructure:** AWS (Amazon Web Services)
- **Runtime:** Node.js (TypeScript)
- **Deployment:** AWS Lambda (Backend), AWS Amplify (Frontend Hosting)

## 2. Frontend (Mobile Web App)
- **Framework:** Next.js (React)
- **Language:** TypeScript
- **Styling:** Vanilla CSS (or Tailwind if requested later)
- **APIs:** MediaDevices API (Camera access), WebRTC/WebSockets for streaming.

## 3. Backend & Storage
- **Compute:** AWS Lambda for event-driven logic and AI orchestration.
- **Database:** Amazon DynamoDB (Session memory, object tracking, user goals).
- **Communication:** Bidirectional WebSocket/WebRTC bridge for low-latency audio.

## 4. AI & Multimodal Intelligence (Amazon Bedrock)
- **Voice Orchestrator:** Amazon Nova 2 Sonic (Speech-to-speech, native orchestration).
- **Vision & Reasoning:** Amazon Nova 2 Lite (Multimodal scene analysis, document interpretation).
- **Grounding & Action:** Amazon Nova Act (External database verification, web grounding).

## 5. Development Workflow
- **Framework:** Conductor Methodology.
- **Version Control:** Git.
- **CI/CD:** AWS Amplify built-in pipelines.
