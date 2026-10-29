# ECLIPSE NEXUS

An independent, holographic AI-inspired command center for the ECLIPSE Messenger bot. It lives in its own repository and Render service; it does not replace or modify `messenger-bot-admin` or `mess-bot`.

## Interface

- Reference-inspired layout: navigation rail, bot status and system-health cards, live activity, quick command entry, central hologram, chat/interaction panel, connection telemetry, event log, and bottom command shortcuts.
- Responsive dark glass UI with cyan neon edges, scan line, animated rings, glowing core, and holographic avatar.
- Interactive assistant panel that can refresh live telemetry, refresh groups, prepare `!help`, or put a user's message into the composer. This is a local command assistant, not an external LLM; it does not pretend to generate bot intelligence or send messages automatically.
- Command tiles prepare command text. A user selects a Messenger group, reviews the command, and presses Send.

## Connected bot features

- Authenticated server-side proxy; the bot API key never enters browser JavaScript.
- Live reads from the bot's existing dashboard status, snapshot, health, groups, events, analytics, delivery analytics, and live-chat stats endpoints.
- Live group selection, group member list, and chat open/poll/send/close bridge.
- Bot message-handling start/pause, Messenger reconnect/disconnect, and music pause/resume controls.
- Jaiden Target countdown settings editor, Mass SetNN completion message editor, and reaction engine configuration.
- Per-group bot/Banat/fun settings.
- Mass SetNN and nickname-removal job controls/status.
- Advanced API console for the existing `/api/dashboard/*` endpoints whose payloads are not yet represented as dedicated NEXUS forms. Destructive operations require explicit interaction and should be reviewed before execution.

NEXUS only forwards requests to routes that already exist on the bot; it does not add or modify bot-side routes. Some displayed values may show N/A if the current bot API does not expose those telemetry fields. The assistant UI is not a general-purpose AI model integration.

## Setup

1. Copy `.env.example` to `.env` and fill in all four values.
2. Run `npm install`.
3. Run `npm run check`.
4. Run `npm start` and open `http://localhost:3000`.

Required environment variables:

- `ECLIPSE_BOT_API_URL`: base URL of the existing bot service (for example, its Render service URL without a trailing slash).
- `ECLIPSE_BOT_API_KEY`: value matching the bot's configured dashboard API key.
- `NEXUS_LOGIN_PASSWORD`: a new, unique password for NEXUS.
- `NEXUS_COOKIE_SECRET`: random secret with at least 32 characters.

Never commit real secrets. The upstream connection is not usable until the environment variables are set and the bot accepts the matching dashboard key.

## Render

Create a separate Node web service from this repository:

- Build command: `npm install`
- Start command: `npm start`
- Node: 20 or newer
- Set all four environment variables in Render's secret environment settings.

Do not replace, merge with, or redeploy the existing bot/dashboard services as part of NEXUS setup. Validate the live upstream API contract and browser behavior before sharing the service URL.

## Validation and scope

The `NEXUS validation` GitHub Actions workflow runs `node --check server.js` and validates the inline browser script syntax. This does not replace end-to-end tests against a configured live bot.

Current work is in `feat/holographic-command-center` and the draft PR. It has not been merged or deployed.
