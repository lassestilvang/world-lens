# WorldLens
### AI that Understands and Explains the World Around You

## Amazon Nova Hackathon Project

---

# 1. Overview

**WorldLens** is a real-time multimodal AI assistant that sees the world through a camera and explains it conversationally through voice.

The system combines:

- **live camera input**
- **real-time speech interaction**
- **multimodal reasoning**
- **persistent environmental memory**

to create an AI that can **interpret environments, documents, objects, and situations**.

Instead of a traditional “visual assistant” that simply answers questions about an image, WorldLens **builds an understanding of the user’s surroundings over time** and proactively provides helpful explanations.

The result feels like **an intelligent companion that understands the real world.**

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

1. analyzes camera frames
2. extracts objects, text, and context
3. builds a persistent **world model**
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
````

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

# 5. Example Use Cases

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

## Document Interpreter

User scans a government letter.

AI:

> "This letter states that your tax payment is overdue and you have fourteen days to respond."

User asks:

> "What should I do next?"

AI explains next steps.

---

## Medication Safety

User points camera at pill bottle.

AI:

> "This bottle contains ibuprofen, four hundred milligrams per tablet."

User asks:

> "How many can I take?"

AI explains dosage instructions.

---

## Environmental Awareness

User points camera around a public space.

AI:

> "You are near a pedestrian crossing. The traffic light is currently red."

---

# 6. System Architecture

## High Level Architecture

```
Mobile Web App
    │
    ▼
API Gateway
    │
    ▼
Multimodal Processing Service
    │
    ├── Vision Analysis
    │
    ├── Context Builder
    │
    ├── Reasoning Engine
    │
    ▼
Voice Interaction Service
    │
    ▼
User
```

---

# 7. AWS Architecture

## Frontend

* React / Next.js mobile web app
* Camera access via MediaDevices API
* WebRTC / WebSocket audio streaming

Hosted on:

AWS Amplify or Amazon S3 + CloudFront

---

## API Layer

Amazon API Gateway

Routes requests to backend services.

---

## Backend Compute

AWS Lambda or AWS Fargate

Handles:

* frame processing
* AI model requests
* memory updates
* reasoning orchestration

---

## AI Models

Accessed through Amazon Bedrock.

Primary models:

### Vision & Reasoning

Amazon Nova 2 Lite

Used for:

* scene understanding
* document interpretation
* object identification
* reasoning about environment

---

### Real-Time Voice

Amazon Nova 2 Sonic

Used for:

* speech understanding
* real-time conversation
* spoken responses

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
Image Analysis (Nova)
      │
      ▼
Scene Summary
      │
      ▼
Context Builder
      │
      ▼
World Memory Update
      │
      ▼
Conversation Reasoning
      │
      ▼
Voice Response
```

---

# 9. Scene Understanding

Example prompt:

```
Analyze the image.

Describe:
- objects present
- visible text
- environment type
- information useful for a visually impaired user.
```

Example output:

```
Environment: grocery store cereal aisle.

Objects:
- Cheerios cereal
- Frosted Flakes cereal
- Oatmeal

Price labels visible.
```

---

# 10. World Memory System

The memory system tracks:

* environment type
* objects observed
* documents scanned
* user goals
* recent observations

Memory evolves over time.

Example:

```
Frame 1:
objects: Cheerios, Frosted Flakes

Frame 2:
objects: Cheerios, Frosted Flakes, Oatmeal
```

New object detected:

```
Oatmeal
```

This triggers reasoning about relevance.

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

---

# 12. Performance Strategy

Vision processing:

1–2 frames per second

Voice interaction:

real-time streaming

Latency target:

1–2 seconds for analysis

---

# 13. Demo Scenario

## 60-Second Demo

### Scene 1

User scans cereal shelf.

AI:

> "You are looking at several cereal options including Cheerios and Frosted Flakes."

---

### Scene 2

User asks:

> "Which one is healthiest?"

AI explains.

---

### Scene 3

Camera moves slightly.

AI sees oatmeal.

AI proactively says:

> "There is also oatmeal further down the shelf which is healthier."

---

### Scene 4

User asks:

> "Is it gluten free?"

AI answers.

---

# 14. Technical Stack

Frontend

* React
* Next.js
* WebRTC
* WebSocket streaming

Backend

* Node.js / Python
* AWS Lambda
* FastAPI or Express

AI

* Amazon Bedrock
* Nova models

Storage

* DynamoDB
* OpenSearch (optional)

Hosting

* AWS Amplify
* CloudFront

---

# 15. Why This Project Stands Out

WorldLens demonstrates **three frontier AI capabilities simultaneously**:

### Multimodal perception

AI understands images and text.

### Conversational interaction

Real-time voice dialogue.

### Situational intelligence

Persistent world memory and proactive assistance.

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