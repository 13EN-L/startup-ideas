# Startup 5: Clicky (on-screen concept illustration edition)

## Criteria Checklist

### 1. Solves one problem extremely well
- The single problem: People get stuck when what's on their screen is hard to follow, whether that's unfamiliar software or dense text, and searching or asking a chatbot pulls them away from the screen. Clicky is an AI teacher that lives next to your cursor, sees your screen, talks to you and points at things. 

### 2. Target customers / direct access
- Who they are: Learners: students reading textbooks, papers and course material, self-learners working through docs and tutorials, and people learning new software. Clicky launched on Product Hunt in April 2026, is backed by Y Combinator (Spring 2026), and is free to download on Mac with a current Windows waitlist.
- How you know them or can reach them (job, community, existing contacts, forums): Reach them through study communities (campus groups and Discord servers), productivity communities, and learners who follow AI tooling creators, since Clicky grew from a viral demo tweet. 

### 3. Familiar infrastructure
- What infrastructure is familiar: A Swift macOS menu bar app using ScreenCaptureKit for snapshots and a full-screen transparent overlay window for the cursor buddy, with a Cloudflare Worker proxy that holds the API keys for Claude (reasoning and vision), AssemblyAI (speech-to-text) and ElevenLabs (text-to-speech). The original codebase is open source under MIT (farzaa/clicky), so the existing pipeline can be studied and extended directly.

### 4. Reimagines the problem space
- Status quo: To understand something on screen, people copy it into a chatbot or search engine and read a text answer in another window, then map it back to what they were looking at. Clicky already answers by voice and points the cursor at the right UI element, but explanations of the content itself are still only spoken.
- Reimagined approach: Hold the hotkey, ask "show me what this means," and Clicky draws the concept over the screen: a labeled diagram, a flowchart of a process, an annotated breakdown of an equation or a highlighted link between terms in a paragraph, anchored to the exact text it explains and narrated by voice.

### 5. LLM is core (not a sidebar chatbot)
- What the LLM generates/transforms that is the product itself: It turns the user's spoken question plus a screen snapshot into a voice explanation with cursor-pointing tags (as today), and in our version into an illustration: a structured overlay spec (shapes, arrows, labels and SVG drawing) anchored to screen coordinates of the text being explained.
- Why the product can't exist without it: Reading arbitrary on-screen content, working out what the user doesn't understand, and drawing a custom visual for that exact passage cannot be done with templates or a fixed library of diagrams.

### 6. Validation guardrail
- Artifact(s) the LLM produces: The spoken explanation with `[POINT:x,y:label:screenN]` tags, and in our version a JSON overlay spec (anchors, shapes, labels, SVG layers, screen ID) plus a short caption for the illustration.
- Validator(s): Pydantic/JSON Schema for the overlay spec and point tags; a bounds check that every coordinate is on a real screen; an anchor check that each anchor lands on the text it claims to explain (matched against OCR or accessibility text from the snapshot); a grounding check that labels quoting the screen actually appear in the snapshot, with a second LLM pass that flags claims contradicting the source text; an SVG element allowlist (no scripts or external references) with size limits; a render test that rejects blank or broken drawings; a readability check (minimum font size, contrast, and no fully covering the text being explained); and a content-policy check.
- Rule: nothing reaches the user unless it passes. Flow: hotkey + question → snapshot → LLM → schema check → bounds check → anchor check → grounding check → SVG safety check → render check → readability check → policy check → PASS: draw overlay and speak | FAIL: errors → step 7.

### 7. Self-correction loop
- On failure, the validator's error messages are sent back to the LLM with the original prompt
- Max retries: 3, then fail safely by skipping the illustration and giving the voice explanation with validated pointing only, telling the user "I couldn't draw this one." Retries run in the background while the voice answer starts, so the user isn't left waiting, and an unvalidated drawing is never shown on screen.

### 8. Deployability
- Deployment target: A signed and notarized macOS app distributed as a DMG with automatic updates (Sparkle), plus the Cloudflare Worker proxy that holds the API keys and runs the server-side validators (schema, grounding and policy checks), while the client runs the bounds, anchor, render and readability checks against the local snapshot.
- IaC / CI/CD: Worker configuration in `wrangler.toml`, and GitHub Actions on a macOS runner to run tests (including a set of sample snapshots with expected anchors for the overlay validators), build with `xcodebuild`, sign and notarize the app, and deploy the Worker with `wrangler deploy`.
- Confirmation you can deploy it end to end: Not yet confirmed; deploy one minimal slice (a snapshot of a textbook paragraph plus "illustrate this" in, a validated overlay drawn on screen out) through the full pipeline on a Mac to verify.
