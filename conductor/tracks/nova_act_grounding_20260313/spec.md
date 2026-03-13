# Specification: Nova Act Grounding Agent

## Overview
The Nova Act Grounding Agent enables WorldLens to verify visual and conversational data against real-world external sources. This track integrates Amazon Nova Act to perform external searches and tool calls, allowing the AI to validate facts (like prices, medical terms, or official definitions) during a live session. It prioritizes reliability and transparency by explicitly attributing information to its source and handling verification failures gracefully.

## Functional Requirements
- **Nova Act Integration:** Implement the capability to invoke Amazon Nova Act for external tool use and reasoning.
- **Tool Call Orchestration:** Enable the central orchestrator (Nova 2 Sonic) to trigger search tools mid-conversation based on user queries or proactive goals.
- **Multi-Scenario Support:** 
    1. **Grocery:** Verify product details and pricing.
    2. **Medical:** Cross-reference label data with official databases.
    3. **General:** Validate official terms or legal definitions in documents.
- **Source Attribution:** The AI must explicitly state the source of grounded information (e.g., "According to the official database...") to build user trust.
- **Verification Fallbacks:** Implement robust handling for tool timeouts, rate limits, or cases where no external data is found, ensuring the user is informed of the verification status.

## Safety & Guardrails
- **Disclaimer Enforcement:** If grounding fails for safety-critical information (e.g., medication), the AI must revert to strictly reading visible text with enhanced caution warnings.
- **Data Privacy:** Ensure no personally identifiable information (PII) is included in external search queries.

## Non-Functional Requirements
- **Latency:** External grounding tool calls should complete within a 1.0s window to maintain the 1.5s p95 target for spoken responses.
- **Traceability:** Every grounded answer must be linked to its source in system logs for audibility.

## Out of Scope
- Fully autonomous multi-step web navigation (e.g., logging into a user's bank account).
- Real-time price tracking across hundreds of dynamic retail sites simultaneously.
