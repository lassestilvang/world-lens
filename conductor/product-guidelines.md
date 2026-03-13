# Product Guidelines

## 1. Design & UX Principles
- **Accessibility First:** Prioritize clear audio feedback (earcons) and spoken responses. The UI should be minimal, requiring only the camera and microphone, with high-contrast text for debugging and settings.
- **Low Latency:** Optimize for a "snappy" voice experience (sub-1.5s latency). Provide immediate audio feedback when processing to avoid dead air.
- **Safety & Clarity:** The AI must explicitly state when it is uncertain. Refuse to guess blurry text, especially in medical or safety-critical situations.
- **Proactive but Non-Intrusive:** The assistant should offer helpful proactive observations but must not interrupt the user while they are speaking.

## 2. Voice & Tone
- **Tone:** Helpful, concise, confident but appropriately cautious. Never robotic; strive for a conversational companion feel.
- **Language:** Use clear, simple language without unnecessary jargon. Provide direct answers before explaining reasoning.

## 3. Branding & Aesthetics
- **Visual Identity:** Clean, dark-mode preferred interface to save battery and reduce glare while using the camera.
- **Feedback:** Use subtle, non-distracting audio cues (chimes, clicks) to indicate listening, processing, or ready states.