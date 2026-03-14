# Initial Concept

WorldLens is a real-time multimodal AI assistant that sees the world through a camera and explains it conversationally through voice. It combines live camera input, real-time speech interaction, multimodal reasoning (Nova 2 Lite), real-time voice orchestration (Nova 2 Sonic), persistent environmental memory, and grounded action (Nova Act) to interpret environments, documents, objects, and situations. The hackathon MVP features multiple scenarios including a Grocery Store Assistant, Medication Safety, and Document Interpretation.

## Product Vision
WorldLens is a real-time multimodal AI assistant designed to behave as an intelligent companion that understands the real world. By combining live camera input, real-time conversational voice interaction, and persistent environmental memory, it helps users interpret environments, read documents, identify objects, and make decisions without needing to constantly look at a screen.

## Target Audience
- Visually impaired users who need assistance navigating and understanding their surroundings.
- General users facing complex visual information (e.g., medical labels, dense documents).
- Shoppers who need quick, hands-free product comparisons and guidance.

## Core Value Proposition
Unlike static visual analysis tools, WorldLens maintains a continuous context of the environment. It doesn't just answer questions about a single image; it remembers what it has seen, understands user goals, and proactively offers relevant observations—all through a low-latency, natural voice interface.

## Key Features (Hackathon MVP)
- **Multimodal Scene Understanding:** Real-time extraction of objects, text, and environmental context using Amazon Nova 2 Lite.
- **Conversational Voice Interface:** Seamless speech-to-speech interaction powered by Amazon Nova 2 Sonic.
- **Persistent World Memory:** Tracks previously observed items and user goals to enable reasoning across time.
- **Proactive Assistance:** Automatically suggests relevant information (e.g., finding a healthier product option) based on accumulated context without needing a specific prompt.
- **Grocery Store Scenario:** A focused, polished end-to-end flow demonstrating object identification, product comparison, and proactive memory-based suggestions, grounded via Nova Act.
- **Medication Safety:** Analyzes prescription labels with strict safety guardrails and blurriness refusal capabilities.
- **Document Interpreter:** Extracts text from physical documents (e.g., government letters) and proactively summarizes next steps.