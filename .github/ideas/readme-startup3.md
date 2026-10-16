# Startup 3: Melty

## Criteria Checklist

### 1. Solves one problem extremely well

- The single problem: Playing mods and cross-game mashups normally takes manual installs, configuration and expert modding skill, especially with friends. Melty lets you press Play and it installs what's needed and launches a mashup of games you already own.

### 2. Target customers / direct access

- Who they are: PC gamers who own several games and want fresh ways to play them with friends, plus modding-curious players who want to create without deep technical skill. The site says Melty is free and currently available for Windows.
- How you know them or can reach them (job, community, existing contacts, forums): Reach them through Discord (Melty runs its own server), gaming subreddits, Steam communities and friend groups, since multiplayer by invite link spreads through play. Add your own gaming network here.

### 3. Familiar infrastructure

- What infrastructure is familiar: A Windows desktop launcher that reads your installed game library, a web catalog with shareable invite links for multiplayer, and a store link when you're missing a required game. Creators use coding agents they already know, such as Claude Code or Codex.

### 4. Reimagines the problem space

- Status quo: Mods are hunted down, installed by hand, and often break across game versions, and combining two different games takes expert-level work.
- Reimagined approach: One-click install and launch with clean uninstall, invite-link multiplayer, and a creation path where anyone describes a mashup to their AI coding agent and it builds and publishes it.

### 5. LLM is core (not a sidebar chatbot)

- What the LLM generates/transforms that is the product itself: A coding agent turns a plain-language idea (for example "play Skyrim as a Minecraft player") into a working mashup package, using Melty's instructions.
- Why the product can't exist without it: Hand-building a mashup for every pair of games takes specialist skill and time, so the catalog would be tiny. The LLM lets non-experts create new mashups at scale.

### 6. Validation guardrail

- Artifact(s) the LLM produces: A mashup package (mod code, assets and a manifest listing required games and files).
- Validator(s): The site says every upload is checked for dangerous files. We would add a manifest schema check, a build/compile step, a malware scan and an automated launch smoke test, plus user reports for anything that slips through.
- Rule: nothing reaches the user unless it passes. Flow: idea → coding agent → package → manifest check → build → malware/dangerous-file scan → launch test → PASS: publish to catalog | FAIL: errors → step 7.

### 7. Self-correction loop

- On failure, the validator's error messages are sent back to the LLM with the original prompt
- Max retries: 3, then fail safely by keeping the mashup as an unpublished draft with the errors shown to the creator, never publishing unvalidated output.

### 8. Deployability

- Deployment target: A Windows installer for the launcher plus a cloud backend for the catalog, lobbies and invite links, with object storage and a CDN for mashup packages.
- IaC / CI/CD: Terraform for the backend, and GitHub Actions to run the validators, build and sign the installer, and deploy on merge.
- Confirmation you can deploy it end to end: Not yet confirmed; deploy one minimal slice (a single sample mashup package passing validation and installing through a basic launcher on a Windows machine) to verify.
