# ECLIPSE NEXUS

An independent holographic AI command center for the ECLIPSE Messenger bot. It lives in its own repository and Render service; it does not edit or replace `messenger-bot-admin` or `mess-bot`.

## Current implementation

- Holographic AI-inspired interface with animated rings, scan line, status core, dark glass panels, responsive navigation, event feed, analytics and command tiles.
- Separate NEXUS password and signed HttpOnly session cookie.
- Server-side proxy keeps `ECLIPSE_BOT_API_KEY` out of the browser.
- Live reads from the bot's existing `/api/dashboard/status`, `snapshot`, `groups`, `events`, `analytics`, and `delivery-analytics` APIs.
- Group selector uses the bot's live `/api/dashboard/groups` response.
- Live chat opens a selected group and polls the bot's existing live-chat API; messages are sent only after the user presses Send. The bot's own live-chat guardrails and send pacing remain in effect.
- Command tiles prepare text in the chat composer; they do not silently execute actions. The user can review or edit a command before sending it.
- Telemetry auto-refreshes every 30 seconds.

## Setup

1. Copy `.env.example` to `.env` and fill in all four values.
2. Run `npm install`.
3. Run `npm run check`.
4. Run `npm start` and open `http://localhost:3000`.

Required environment variables:

- `ECLIPSE_BOT_API_URL`: base URL of the existing bot service (for example, the Render service URL without a trailing slash).
- `ECLIPSE_BOT_API_KEY`: value matching the bot's configured dashboard API key.
- `NEXUS_LOGIN_PASSWORD`: a new, unique password for NEXUS.
- `NEXUS_COOKIE_SECRET`: random secret with at least 32 characters.

Never commit real secrets. NEXUS cannot authenticate to the bot API until the bot service is configured to accept the matching dashboard key. This implementation does not add or change bot-side API routes.

## Render

Create a separate Node web service from this repository:

- Build command: `npm install`
- Start command: `npm start`
- Node: 20 or newer
- Set all four environment variables in Render's secret environment settings.

Do not replace, merge with, or redeploy the existing bot/dashboard services as part of NEXUS setup. Test the new service and the upstream API contract before sharing the URL.

## Scope and safety notes

This is a feature branch for review, not a deployment. The interface includes a command console and a selection of command shortcuts; a shortcut only fills the composer. Bot settings, moderation panels, and other dashboard-only configuration forms are not all wired as dedicated NEXUS controls yet. No claim is made that unsupported endpoints or fields are live. Existing bot and dashboard repositories remain untouched.
