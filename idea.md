# WorldLens
### AI that Understands and Explains the World Around You

## Amazon Nova Hackathon Project

## Submission Strategy (Judge-Optimized)

- **Primary Category:** Voice AI
- **Secondary Category:** Multimodal Understanding

**Core differentiator to emphasize:** persistent world memory + proactive assistance in a live voice session.

**Hackathon MVP scope lock:** deliver one polished, reliable end-to-end scenario (Grocery Store Assistant) instead of multiple partially complete scenarios.

**Stretch goals (only if stable):** Document Interpreter, Medication Safety flow, and Nova Act-based grounding.

---

# 1. Overview

**WorldLens** is a real-time multimodal AI assistant that sees the world through a camera and explains it conversationally through voice.

The system combines:

- **live camera input**
- **real-time speech interaction**
- **multimodal reasoning** (Nova 2 Lite)
- **real-time voice orchestration** (Nova 2 Sonic with async tool use)
- **persistent environmental memory** (Multi-Agent architecture)
- **grounded action** (Nova Act integration)

to create an AI that can **interpret environments, documents, objects, and situations**.

Instead of a traditional “visual assistant” that simply answers questions about an image, WorldLens **builds an understanding of the user’s surroundings over time** and proactively provides helpful explanations.

The result feels like **an intelligent companion that understands the real world.**

For hackathon judging, the implementation is intentionally scoped to one high-quality live demo path with clear reliability and safety guardrails.

---

# 2. Problem

Many situations require interpreting visual information quickly:

- visually impaired users navigating environments
- understanding complicated documents (medical bills, government letters)
- identifying medication instructions
- comparing products in stores
- understanding unfamiliar environments

In stressful or time-sensitive situations, people often struggle to:

- read complex text
- identify relevant objects
- understand context
- make decisions quickly

Most existing AI tools only provide **static analysis of images**.

They lack:

- **continuous situational awareness**
- **memory of previously observed information**
- **natural conversational interaction**
- **proactive assistance**

---

# 3. Solution

WorldLens provides **real-time environmental interpretation** through a conversational AI interface.

Users simply:

1. Open the camera
2. Talk naturally
3. Ask questions about what they see

The system:

1. smartly samples camera frames based on motion and speech
2. extracts objects, text, and context using multimodal AI
3. builds a persistent, optimized **world model**
4. answers questions conversationally
5. proactively offers useful observations

The result is a system that behaves more like **a knowledgeable companion** than a traditional AI tool.

---

# 4. Key Capabilities

## 4.1 Multimodal Scene Understanding

The system continuously analyzes camera frames and extracts:

- objects
- text
- environment type
- potential hazards
- relevant contextual information

Examples:

- grocery store shelves
- medication bottles
- street environments
- documents and letters
- product packaging

---

## 4.2 Real-Time Conversational Voice

Users interact with the system through natural speech.

They can ask questions like:

> "Which cereal here is healthiest?"

> "What does this document say?"

> "Is this medication safe to take with food?"

The AI responds **in real time through speech**.

---

## 4.3 Persistent World Memory

WorldLens builds a **memory of the environment over time**.

Instead of analyzing each image independently, the system tracks:

- objects previously observed
- documents already scanned
- user goals
- environmental context

Example memory:

```json
{
  "environment": "grocery store cereal aisle",
  "objects_seen": [
    "Cheerios",
    "Frosted Flakes",
    "Oatmeal"
  ],
  "user_goal": "find healthy cereal"
}
```

This enables reasoning across time.

---

## 4.4 Proactive AI Assistance

The system does not only answer questions.

It can **proactively provide useful observations** when something important appears.

Example:

User previously asked:

> "Is there anything gluten free?"

Later the camera sees gluten-free oats.

AI says:

> "Earlier you asked about gluten-free options. These oats are labeled gluten free."

This makes the AI feel **situationally aware and helpful**.

---

## 4.5 Non-Visual State Feedback (Earcons)

To ensure usability for visually impaired users, the system uses audio cues (earcons) to communicate state without overwhelming the user with spoken text:
- **Soft Chime:** A proactive observation is ready.
- **Subtle Click:** A new frame/scene has been successfully processed.
- **Listening Tone:** The AI has detected speech and is listening.

---

# 5. Example Use Cases

## 5.0 Hackathon Scope Lock

**In scope for final demo (must work flawlessly):**

- grocery shelf understanding
- conversational Q&A in real time via voice
- persistent world memory across turns
- proactive suggestion tied to user goal

**Stretch scope (optional):**

- document interpretation
- medication interpretation with strict refusals
- Nova Act grounding against external sources

**Out of scope for hackathon MVP:**

- full navigation guidance in dynamic traffic
- broad medical advice beyond package-label reading
- fully autonomous multi-step web automation

---

## Grocery Store Assistant

User points camera at shelf.

AI:

> "You are looking at several cereal options including Cheerios and Frosted Flakes."

User asks:

> "Which one is healthiest?"

AI compares products and explains.

Later:

> "There is also oatmeal further down the shelf which is healthier."

---

*The remaining use cases below are roadmap/stretch scenarios and are not required for MVP completeness.*

## Document Interpreter

User scans a government letter.

AI:

> "This letter states that your tax payment is overdue and you have fourteen days to respond."

User asks:

> "What should I do next?"

AI explains next steps.

---

## Medication Safety

*Note: This use-case includes strict grounding to prevent hallucinations.*

User points camera at pill bottle.

AI:

> "This bottle contains ibuprofen, four hundred milligrams per tablet."

User asks:

> "How many can I take?"

AI explains dosage instructions, appending a mandatory safety disclaimer: *"Please consult your doctor or pharmacist to be sure."* If the label is blurry, the AI is instructed to strictly state: *"I cannot read the dosage clearly, please do not guess."*

---

## Environmental Awareness

User points camera around a public space.

AI:

> "You are near a pedestrian crossing. The traffic light is currently red."

---

# 6. System Architecture

## High Level Architecture

```
Mobile Web App (Camera + Microphone)
    │
    ├── Audio stream ──► Nova 2 Sonic (Orchestrator)
    │                        │
    │                        ├── tool call: analyze_frame ──► Nova 2 Lite (Vision)
    │                        │                                    │
    │                        │◄── scene description ◄────────────┘
    │                        │
    │                        ├── tool call: update_memory ──► Memory Curator (Nova 2 Lite)
    │                        │
    │                        ├── tool call: ground_fact ──► Grounding Agent (Nova Act)
    │                        │
    │                        └── speaks response directly to user (no Polly)
    │
    ▼
User hears AI response in real time
```

Nova 2 Sonic acts as the **central orchestrator** via its native async tool use capability.
It receives speech, invokes vision/memory/grounding tools mid-conversation, and speaks
the response directly — all within a single bidirectional streaming session.

---

# 7. AWS Architecture

## 7.0 Hackathon Build Baseline (Concrete)

To reduce execution risk, the implementation baseline is fixed as:

- **Frontend:** Next.js mobile web app
- **Transport:** bidirectional audio via WebSocket/WebRTC bridge
- **Backend runtime:** Node.js on AWS Lambda
- **State store:** DynamoDB
- **Hosting:** AWS Amplify

Production alternatives (Fargate, additional services) are treated as post-hackathon extensions.

---

## Frontend

* React / Next.js mobile web app
* Camera access via MediaDevices API
* WebRTC / WebSocket audio streaming
* Client-side motion detection and Voice Activity Detection (VAD)

Hosted on:

**Hackathon baseline:** AWS Amplify  
**Production alternative:** Amazon S3 + CloudFront

---

## API Layer

Amazon API Gateway

Routes requests to backend services via WebSockets for low latency.

---

## Backend Compute

**Hackathon baseline:** AWS Lambda (Node.js)  
**Production scale option:** AWS Fargate

Handles:

* frame processing routing
* AI model requests
* memory updates and pruning
* reasoning orchestration

---

## AI Models

Accessed through Amazon Bedrock.

Primary models:

### Central Orchestrator & Voice

**Amazon Nova 2 Sonic**

Used for:

* speech-to-speech conversational interface (replaces Polly entirely)
* central orchestrator via native async tool use
* invokes vision, memory, and grounding tools mid-conversation
* handles interruptions, turn-taking, and background noise natively

---

### Vision, Reasoning & Memory

**Amazon Nova 2 Lite**

Used for:

* multimodal scene understanding (accepts image, video, and text input)
* document interpretation and logical extraction
* high-confidence object identification with extended thinking
* background memory curation and context compression
* 1M token context window enables rich environmental history

---

### Grounding & Action

**Amazon Nova Act**

Used for:

* real-world grounding (e.g., verifying price data on web)
* external API interactions
* performing browser-based workflows for user requests

---

## Memory Layer

Amazon DynamoDB

Stores:

* environment memory
* objects observed
* conversation history
* user goals

Example record:

```json
{
  "session_id": "...",
  "environment": "...",
  "objects_seen": [],
  "recent_observations": []
}
```

---

## Optional Vector Memory

Amazon OpenSearch Serverless

Stores semantic embeddings for:

* previously scanned documents
* object descriptions
* historical context

---

# 8. Multimodal Processing Pipeline

```
Camera Frame
      │
      ▼
Client-Side Smart Sampling (Motion/VAD)
      │
      ▼
Image Analysis (Nova 2 Lite via Sonic tool call)
      │
      ▼
Scene Summary
      │
      ▼
Confidence + Safety Gate (uncertainty and refusal policy)
      │
      ▼
Context Builder (Summarizes older objects)
      │
      ▼
World Memory Update
      │
      ▼
Conversation Reasoning (Nova 2 Sonic)
      │
      ▼
Voice Response (Nova 2 Sonic — native speech output)
```

---

# 9. Scene Understanding

Example prompt (with strict hallucination mitigation):

```
Analyze the image.

Describe:
- objects present
- visible text
- environment type
- information useful for a visually impaired user.

CRITICAL RULES:
1. If text is blurry or partially obscured, you MUST state "I cannot read this clearly". Do NOT guess or interpolate missing words, especially on medical or legal documents.
2. Only list objects you are highly confident exist in the frame.
3. Include confidence for each extracted field and omit low-confidence entities.
4. If confidence is low for safety-critical content, request a clearer frame instead of answering.
```

Example output:

```
Environment: grocery store cereal aisle.

Objects:
- Cheerios cereal
- Frosted Flakes cereal
- Oatmeal

Price labels visible, but text is too blurry to read exact prices.
```

Structured extraction schema (used internally for safety gating):

```json
{
  "environment": "grocery store cereal aisle",
  "objects": [
    { "name": "Cheerios", "confidence": 0.93 },
    { "name": "Frosted Flakes", "confidence": 0.91 }
  ],
  "text_spans": [
    { "text": "GLUTEN FREE", "confidence": 0.89 }
  ],
  "uncertain_regions": ["price tags on lower shelf"]
}
```

---

# 10. World Memory System

The memory system tracks:

* environment type
* objects observed
* documents scanned
* user goals
* recent observations

Memory evolves over time. To **prevent context bloat**, the system employs a summarization and spatial grouping mechanism. 

Example:

```
Frame 1:
objects: Cheerios, Frosted Flakes

Frame 2:
objects: Cheerios, Frosted Flakes, Oatmeal
```

*Memory Optimizer kicks in after 20 objects:*

```
Summarized Context: "User is in the cereal aisle. Looked at 20 different cereals including Cheerios, Frosted Flakes, and Oatmeal. None were gluten free."
```

This prevents the LLM prompt from growing infinitely large while maintaining state.

Memory records also store `confidence`, `source_frame_id`, and `timestamp` for traceability.

Short-term memory retention for demo sessions is capped (for example, 24 hours) to avoid indefinite storage of camera-derived context.

---

# 11. Proactive AI System

Rule engine detects important changes.

Example rule:

```
IF new object detected
AND relevant to user goal
THEN generate observation
```

Observation prompt:

```
User goal: find healthy cereal.

New object detected: oatmeal.

Explain why this may be relevant.
```

AI generates spoken message.

Proactive guardrails:

- do not interrupt while the user is actively speaking
- require relevance to an explicit user goal
- apply cooldown between proactive interventions
- cap proactive messages per minute to avoid cognitive overload
- include uncertainty language when confidence is below threshold

---

# 12. Performance Strategy

**1. Smart Sampling:**
Instead of blindly sending 1-2 frames per second (which causes lag and high API costs), the client app uses:
- **Voice Activity Detection (VAD):** Captures and sends a frame the moment the user starts speaking.
- **Motion Detection:** Sends a new frame only when the camera stabilizes on a new scene after movement.

**2. Voice Interaction:**
Real-time bidirectional streaming directly to **Nova 2 Sonic**. No separate TTS service (Polly) needed — Sonic handles speech understanding and generation natively in a single session.

**3. Latency Target:**
Sub-1.5 seconds for analysis to spoken response, leveraging Nova 2 Sonic's native speed and async tool execution (Sonic can begin speaking while tools finish processing).

## 12.1 Latency Budget (Target p95)

| Stage | Target |
| --- | --- |
| Speech start detection + frame capture | 150 ms |
| Upload + routing | 200 ms |
| Nova 2 Lite analysis + extraction | 600 ms |
| Memory update + reasoning | 250 ms |
| Nova 2 Sonic first spoken token | 300 ms |
| **Total p95** | **<= 1.5s** |

## 12.2 Cost and Throughput Controls

- send frames only on VAD trigger or stabilized motion
- deduplicate near-identical frames before model calls
- summarize memory periodically to bound prompt growth
- impose per-session token and tool-call budgets

---

# 13. Demo Scenario

## 60-Second Demo

*Note: The demo UI will feature a debug panel visible on screen showing the real-time JSON "World Memory" updating, proving to judges that the AI is maintaining state.*

### Scene 1

User scans cereal shelf. *Debug panel shows objects entering memory.*

AI:

> "You are looking at several cereal options including Cheerios and Frosted Flakes."

---

### Scene 2

User asks:

> "Which one is healthiest?"

AI explains. *Debug panel logs the User Goal: "Find healthy cereal".*

---

### Scene 3 (The "Aha!" Moment)

Camera moves slightly to the bottom shelf.

AI sees oatmeal.

AI **proactively** interrupts to say:

> "Earlier you asked about healthier options. There is oatmeal further down the shelf which fits your goal."

---

### Scene 4 (Grounding)

User asks:

> "Is it gluten free?"

The **Grounding Agent** uses **Nova Act** to verify the visual data against a real-world product database or the manufacturer's website. AI answers with confidence, validating against the visual text on the oatmeal box and external data.

If grounding is unavailable (timeout/network/tool failure), the assistant must explicitly state that external verification could not be completed and fall back to visual evidence only.

---

## 3-Minute Submission Video Structure

1. **0:00-0:20** - Problem + one-sentence value proposition.
2. **0:20-1:40** - Live MVP demo (memory + proactive assist + voice response).
3. **1:40-2:20** - Debug panel proof (world memory, tool calls, confidence values).
4. **2:20-2:45** - Reliability/safety fallback clip (blurry text refusal).
5. **2:45-3:00** - Architecture + explicit Nova integration summary.

---

# 14. Technical Stack

Frontend

* React
* Next.js
* WebRTC
* WebSocket streaming

Backend

* Node.js (TypeScript) for hackathon runtime
* AWS Lambda
* Lightweight Express-compatible handlers

Post-hackathon options: Python/FastAPI services for specialized pipelines.

AI

* Amazon Bedrock
* Amazon Nova 2 Sonic (Voice Orchestrator — speech-to-speech, async tool use)
* Amazon Nova 2 Lite (Vision, Reasoning, Memory — multimodal input, extended thinking)
* Amazon Nova Act (Grounding/External Action)
* AWS Strands Agents (Multi-agent orchestration)

Storage

* Amazon DynamoDB
* Amazon OpenSearch (optional)

Hosting

* AWS Amplify (hackathon baseline)
* Amazon CloudFront

---

# 15. Why This Project Stands Out

WorldLens demonstrates **three frontier AI capabilities simultaneously**:

### Multimodal perception

AI understands images, text, and speech natively using Amazon Nova 2 Lite (vision/reasoning) and Nova 2 Sonic (voice). All models are GA — no gated preview access required.

### Agentic Orchestration

Powered by **Strands Agents**, the system moves beyond simple pipelines to a multi-agent choreography where specialized agents manage vision, memory, and grounding.

### Situational intelligence

Persistent world memory and **proactive assistance** (the key differentiator), grounded in real-world data via **Nova Act**.

---

# 16. Future Extensions

Potential improvements:

* object tracking across frames
* indoor navigation assistance
* AR overlays
* personalized user preferences
* long-term environment memory

---

# 17. Impact

WorldLens has potential applications in:

* accessibility
* education
* healthcare
* travel assistance
* everyday decision support

It transforms AI from a passive tool into **a companion that understands the world around you.**

---

# 18. Reliability and Safety Guardrails

## 18.1 Confidence Gating

- do not speak extracted text unless OCR confidence passes threshold
- do not assert object presence unless detection confidence passes threshold
- for ambiguous frames, ask for repositioning/closer view instead of guessing

## 18.2 Safety-Critical Policy

- medical/legal/financial content always includes explicit uncertainty handling
- no dosage inference from incomplete labels
- no traffic/navigation guarantees in dynamic conditions
- every grounded factual claim should include a source reference when available

## 18.3 Failure-Mode Response Matrix

| Failure condition | System behavior | User-facing response |
| --- | --- | --- |
| Blurry or occluded text | refuse extraction | "I cannot read this clearly. Please move closer or hold steady." |
| Grounding tool timeout | skip external verification | "I could not verify this online right now. This answer is based only on visible text." |
| Conflicting evidence | surface uncertainty | "I see conflicting signals. Please show the label again for a safer answer." |
| Model latency spike | return partial guidance | "I am still analyzing. Here is what I can confirm so far..." |
| Empty/low-light frame | request recapture | "I cannot see enough detail yet. Please point the camera at the item." |

---

# 19. Privacy and Data Handling

- raw frames are processed transiently and not persisted by default
- audio is streamed for interaction and not stored unless explicitly enabled for debugging
- session memory is scoped to the active session with explicit TTL
- users can clear world memory immediately
- logs exclude unnecessary PII and store only operational metadata
- all service communication uses TLS; stored state uses AWS-managed encryption

---

# 20. Evaluation Plan (What We Will Measure)

| Metric | Target |
| --- | --- |
| End-to-end voice latency (p95) | <= 1.5s |
| Scene extraction precision (MVP dataset) | >= 85% |
| Blurry-text safe refusal rate | >= 95% |
| Goal-relevance precision for proactive messages | >= 80% |
| Memory carryover accuracy across 3 turns | >= 90% |
| Grounded-answer source traceability (when used) | 100% |

Evaluation method:

- build a small labeled benchmark set (for example, 30-50 frames)
- run scripted conversation tests for memory carryover and proactive relevance
- capture latency telemetry in logs for p50/p95 reporting
- include one safety test clip in the final video

---

# 21. Judging Criteria Mapping

| Judging Criterion | How WorldLens demonstrates it |
| --- | --- |
| Technical Implementation (60%) | Real-time voice architecture, Nova integration, tool traces, measurable latency/accuracy metrics |
| Community Impact (20%) | Accessibility-first assistance for real-world decision making |
| Creativity and Innovation (20%) | Persistent world memory + proactive conversational assistance |

---

# 22. Submission Readiness Checklist

- [ ] 3-minute video includes live working demo and `#AmazonNova`
- [ ] submission text explicitly states which Nova models/services are used and where
- [ ] repository link is accessible (or private access shared to required emails)
- [ ] testing instructions are clear and reproducible for judges
- [ ] judges can access a working test path free of charge during the judging window
- [ ] if login is required, credentials are included in the testing instructions
- [ ] one-click/low-friction demo path is available
- [ ] fallback behavior is demonstrated (at least one failure-mode clip)
- [ ] architecture diagram and memory debug panel screenshots are included

---

# 23. Go/No-Go Demo Criteria

WorldLens is demo-ready only if all are true:

1. Grocery MVP runs end-to-end without manual intervention.
2. Proactive memory moment triggers correctly in live run.
3. At least one uncertainty refusal case behaves safely.
4. p95 latency and key metrics are available for reporting.
5. Judges can reproduce core flow from provided instructions.
