# Initial Concept

WorldLens is a real-time multimodal AI assistant that sees the world through a camera and explains it conversationally through voice. It combines live camera input, real-time speech interaction, multimodal reasoning, and persistent environmental memory to provide proactive assistance in a live voice session.

---

# Product Guide: WorldLens

## 1. Product Vision
**WorldLens** is a real-time multimodal AI assistant that understands and explains the physical world conversationally. It transcends static image analysis by providing continuous situational awareness, persistent environmental memory, and proactive assistance through a live voice interface.

## 2. Problem Statement
Many people, particularly those with visual impairments or in time-sensitive situations, struggle to quickly interpret complex visual information—such as medication instructions, store shelves, or legal documents. Current AI tools often lack situational awareness, memory of previously observed data, and a natural, hands-free conversational interface.

## 3. Target Users
- **Visually Impaired Individuals:** Navigating environments, reading labels, and identifying hazards.
- **Shoppers:** Comparing products, finding healthy options, and managing grocery lists in real-time.
- **General Users:** Quickly summarizing complex documents, verifying medication safety, and exploring unfamiliar spaces.

## 4. Key Product Goals
- **Real-Time Interaction:** Sub-1.5s latency from speech/image capture to spoken response.
- **Persistent Memory:** Maintaining an evolving "world model" of the user's surroundings.
- **Proactive Assistance:** Offering useful observations based on user goals and historical context without being prompted.
- **Safe & Reliable Reasoning:** Implementing strict guardrails for high-stakes information like medical dosage.

## 5. Core Capabilities (MVP)
- **Multimodal Scene Understanding:** Identifying objects and text in camera frames.
- **Conversational Voice Interface:** Natural speech-to-speech interaction.
- **World Memory System:** Tracking observed objects and user goals over time.
- **Proactive Observation Engine:** Notifying users of relevant information (e.g., "Earlier you asked about gluten-free; I see oats over here.").
- **Non-Visual Feedback (Earcons):** Subtle audio cues to communicate system state (e.g., processing, listening).

## 6. Success Metrics
- **p95 Latency:** <= 1.5 seconds for spoken responses.
- **Extraction Precision:** >= 85% for scene understanding.
- **Safety Compliance:** 100% adherence to safety-critical refusal policies (e.g., blurry medication labels).
