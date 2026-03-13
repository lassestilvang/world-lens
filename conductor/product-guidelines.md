# Product Guidelines: WorldLens

## 1. Interaction Design (Voice & Audio)
- **Concise Responses:** Prioritize brevity in spoken responses to reduce cognitive load, especially in high-stress or time-sensitive situations.
- **Hands-Free Priority:** Assume the user's hands are occupied (e.g., holding a white cane or groceries). Minimize the need for physical screen interaction.
- **Audio Feedback (Earcons):**
    - **Soft Chime:** Indicates a proactive observation is ready.
    - **Subtle Click:** Confirms a frame has been successfully processed.
    - **Listening Tone:** Signals the system is active and ready for user speech.
- **Natural Turn-Taking:** Implement intelligent Voice Activity Detection (VAD) to handle interruptions gracefully and avoid talking over the user.

## 2. Visual Strategy & Interpretation
- **Smart Sampling:** Only capture and process frames when motion stabilizes or when triggered by user speech (VAD).
- **Scene Descriptions:** Focus on the most relevant information first (e.g., "A step is ahead" vs. "There's a blue car parked on the street").
- **Safety-Critical Refusal:** If a scene or text is blurry, the AI must explicitly state its inability to read it clearly rather than guessing.

## 3. Reliability & Trust
- **Confidence Thresholds:** Do not speak about objects or text with a confidence score below 85% for general info and 95% for safety-critical info.
- **Uncertainty Language:** Use phrases like "I think," "It appears to be," or "I'm not entirely sure, but..." when confidence is between 85-90%.
- **Source Grounding:** When using external tools (e.g., Nova Act), explicitly state if a fact was verified against a real-world database.

## 4. Proactive Behavior
- **Goal-Relevance:** Only provide proactive observations if they directly support the current user goal (e.g., finding healthy food).
- **Cooldown Periods:** Enforce a minimum 15-second gap between proactive interruptions to avoid being overwhelming.

## 5. Privacy & Ethics
- **Transient Processing:** Raw camera frames and audio should be processed in memory and deleted immediately after reasoning is complete.
- **Minimal PII:** Avoid extracting or storing personally identifiable information (PII) unless essential for the requested task.
- **User Agency:** Allow the user to "Silence" or "Clear Memory" at any time through simple voice commands.
