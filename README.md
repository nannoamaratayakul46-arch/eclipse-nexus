# ECLIPSE NEXUS

An independent holographic AI command center for the ECLIPSE Messenger bot. It lives in its own repository and Render service; it does not replace or modify `messenger-bot-admin` or `mess-bot`.

## Interface

- Reference-inspired layout: navigation rail, bot status and system-health cards, live activity, quick command entry, central hologram, chat/interaction panel, live telemetry, event log, and command shortcuts.
- The central projection loads the repository's exact `public/eclipse-hologram-enhanced-1.glb` asset in a Three.js renderer, with lighting, transparent rendering, gentle idle motion, and responsive resizing.
- The assistant panel connects to a server-side OpenAI-compatible Chat Completions endpoint. It maintains short in-page conversation context and displays actual model replies; it does not claim to have performed bot actions.
- Existing command tiles still prepare commands. A user selects a Messenger group, reviews the command, and presses Send.

## Connected bot features

- Authenticated server-side proxy; the bot API key never enters browser JavaScript.
- Live reads from the bot's existing dashboard status, snapshot, health, groups, events, analytics, delivery analytics, and live-chat stats endpoints.
- Live group selection, group member list, and chat open/poll/send/close bridge.
- Bot message-handling start/pause, Messenger reconnect/disconnect, and music pause/resume controls.
- Jaiden Target countdown settings editor, Mass SetNN completion message editor, and reaction engine configuration.
- Per-group bot/Banat/fun settings.
- Mass SetNN and nickname-removal job controls/status.
- Advanced API console for existing `/api/dashboard/*` endpoints.

NEXUS only forwards requests to routes that already exist on the bot; it does not add or modify bot-side routes. The AI companion is conversational only: it cannot directly operate the Messenger bot or inspect live telemetry unless that information is explicitly supplied to it. Bot actions remain in the existing dashboard controls and require user confirmation.

## Setup

1. Copy `.env.example` to `.env` and fill in the existing four NEXUS/bot values.
2. Set `AI_API_KEY` to your model provider API key, `AI_MODEL` to a model available to that key, and `AI_BASE_URL` to the provider's OpenAI-compatible API base URL.
3. Run `npm install`.
4. Run `npm run check`.
5. Run `npm start` and open `http://localhost:3000`.

Required environment variables:

- `ECLIPSE_BOT_API_URL`: base URL of the existing bot service.
- `ECLIPSE_BOT_API_KEY`: value matching the bot's configured dashboard API key.
- `NEXUS_LOGIN_PASSWORD`: a new, unique password for NEXUS.
- `NEXUS_COOKIE_SECRET`: random secret with at least 32 characters.
- `AI_API_KEY`: server-side API key for the configured model provider.

Optional AI variables:

- `AI_MODEL`: defaults to `gpt-4.1-mini`.
- `AI_BASE_URL`: defaults to `https://api.openai.com/v1`; use a provider endpoint that supports the OpenAI Chat Completions request format.

The AI key is only read by the server and is never sent to browser JavaScript. AI requests require an authenticated NEXUS session, are limited to 12 requests per IP per minute, have a 30-second timeout, and accept up to 4,000 characters per message. Keep all real secrets in Render's secret environment settings; never commit them.

The GLB is served from the existing repository asset path. Three.js and GLTFLoader are loaded as browser ES modules from jsDelivr, so the deployed browser needs access to that CDN.

## Render

Use the existing separate NEXUS Node web service:

- Build command: `npm install`
- Start command: `npm start`
- Node: 20 or newer

Set the bot/NEXUS variables and AI variables in Render's secret environment settings. Do not replace, merge with, or redeploy the existing bot/dashboard services as part of NEXUS setup.

## Validation and scope

Run `npm run check`. The repository checks validate server syntax, route regressions, and the inline dashboard script. Browser WebGL rendering and a live provider response still require a configured deployment/browser test. No bot-side routes are added or changed.
