# FocusGarden - Project Guidelines & Instructions

## Project Overview
FocusGarden is a productivity tracking desktop/web application that gamifies focus. It integrates with **ActivityWatch** to log user activity, uses the **Claude API** to classify websites/apps as on-task or off-task, and translates productive time into growing plants and animal companions in a virtual farm setting.

## Tech Stack & Architecture
- **Frontend**: React 19 + TypeScript, bundled with Vite, running in an Electron renderer (`src/renderer/`)
- **Backend / Local Server**: Electron main process on Node.js (`src/main/`); pure domain logic shared by both sides lives in `src/core/`
- **Integrations**: 
  - ActivityWatch (local watchers for apps/websites)
  - Claude API (for activity classification)

## Core Development Rules
1. **Strict Front-End Adherence**: Follow the exact layout, color schemes, state persistence, and UI flow outlined in `docs/product-spec.md` and `docs/design-tokens.md`.
2. **Asset Placeholders**: Use empty PNG placeholders for clouds, animals, and plants if final artwork is missing, ensuring they are cleanly mapped and easy for developers to swap out.
3. **State Persistence**: If the app is closed and reopened, it must restore the exact active state (e.g., returning to the task page with the home button greyed out if tasks are active).
4. **Growth & Prestige Math**: Implement plant growth and prestige wrapping strictly according to the formula defined in the specifications (6 stages, 6 minutes per stage = 36 mins per cycle, wrapping over with prestige increments).

## Common Commands
- **Install Dependencies**: `npm install` (or equivalent)
- **Run Development Server**: `npm run dev`
- **Build**: `npm run build`
- **Run Tests**: `npm test` (unit + integration + property), `npm run test:e2e` (builds, then drives Electron), `npm run test:mutation` (Stryker; needs a green suite)
- **Typecheck**: `npm run typecheck`