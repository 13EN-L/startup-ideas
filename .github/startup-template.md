# Startup N: <Name>

## Criteria Checklist

### 1. Solves one problem extremely well

- The single problem: <1-2 sentences>

### 2. Target customers / direct access

- Who they are: <1-2 sentences>
- How you know them or can reach them (job, community, existing contacts, forums): <1-2 sentences>

### 3. Familiar infrastructure

- What infrastructure is familiar: <1-2 sentences>

### 4. Reimagines the problem space

- Status quo: <1-2 sentences>
- Reimagined approach: <1-2 sentences>

### 5. LLM is core (not a sidebar chatbot)

- What the LLM generates/transforms that is the product itself: <1-2 sentences>
- Why the product can't exist without it: <1-2 sentences>

### 6. Validation guardrail

- Artifact(s) the LLM produces: <1-2 sentences>
- Validator(s): JSON Schema / Pydantic, linters, compilers, rule engines, tests, policy checks
- Rule: nothing reaches the user unless it passes. Show the gate in the flow.

### 7. Self-correction loop

- On failure, the validator's error messages are sent back to the LLM with the original prompt
- Max retries: N, then fallback behavior (fail safely, never ship unvalidated output)

### 8. Deployability

- Deployment target: <1-2 sentences>
- IaC / CI/CD: <1-2 sentences>
- Confirmation you can deploy it end to end: <1-2 sentences>
