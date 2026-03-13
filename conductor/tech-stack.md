# Tech Stack

## Frontend
- **Framework:** React / Next.js (Mobile Web App)
- **Language:** TypeScript
- **APIs:** WebRTC / WebSockets for audio streaming, MediaDevices API for camera access.
- **Hosting (Hackathon Baseline):** AWS Amplify

## Backend Compute & API
- **Runtime:** Node.js (TypeScript)
- **Framework:** Express-compatible handlers / AWS Lambda
- **API Gateway:** Amazon API Gateway (WebSockets for low latency)

## AI Models (Amazon Bedrock)
- **Voice & Orchestration:** Amazon Nova 2 Sonic (Speech-to-speech, async tool use)
- **Vision & Memory:** Amazon Nova 2 Lite (Multimodal input)
- **Grounding/Action:** Amazon Nova Act
- **Agent Orchestration:** AWS Strands Agents

## Data & Memory Layer
- **Primary Storage:** Amazon DynamoDB (Environment memory, conversation history)
- **Vector Search (Optional):** Amazon OpenSearch Serverless