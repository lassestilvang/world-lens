# Specification: Medication Safety

## Overview
The Medication Safety feature enables WorldLens to identify medications and explain dosage instructions from physical pill bottles or packaging. This feature prioritizes extreme caution, leveraging high-precision OCR from Amazon Nova 2 Lite and real-world grounding via Amazon Nova Act to ensure the AI's interpretations are consistent with professional medical data while strictly refusing to provide advice beyond the visible or verified label information.

## Functional Requirements
- **Label Identification:** Extract medication name, strength, and dosage instructions from captured frames using Nova 2 Lite.
- **Database Grounding:** Use Nova Act to verify identified medication against an external medication database to confirm safety information.
- **Usage Guidance:** Provide clear, spoken instructions on how to take the medication based strictly on the verified label text.
- **Safety Disclaimers:** Automatically append a mandatory disclaimer to all medication-related responses: "Please consult your doctor or pharmacist to be sure."

## Safety & Guardrails
- **Limited Advice Scope:** Strictly refuse to provide any medical advice or dosage instructions not explicitly stated on the verified label.
- **Strict Hallucination Mitigation:** If the label is blurry, partially obscured, or the OCR confidence is below 95%, the AI must state: "I cannot read the dosage clearly, please do not guess."
- **Grounding Fallback:** If external grounding fails or times out, the assistant must explicitly state that external verification could not be completed and fall back to visual evidence with increased uncertainty warnings.

## Non-Functional Requirements
- **Accuracy:** OCR and identification precision must be >= 98% for clear frames.
- **Latency:** End-to-end response for medication identification should target <= 2.0s.

## Out of Scope
- Identifying pills by color or shape without packaging.
- Providing drug interaction warnings (unless explicitly stated on the label).
- Autonomous medication scheduling or reminders.