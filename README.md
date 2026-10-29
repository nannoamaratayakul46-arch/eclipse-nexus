# ECLIPSE NEXUS

An independent, read-only dashboard for live ECLIPSE bot telemetry. It is designed to live in its own repository and its own Render service. It does not require edits to `messenger-bot-admin` or `mess-bot`.

## Features
- Dark cyan holographic interface inspired by the provided concept image
- Separate NEXUS password and signed HttpOnly session cookie
- Server-side proxy for the existing bot dashboard API; the bot API key is never sent to the browser
- Read-only status, snapshot, health, events, analytics, and delivery analytics
- Auto-refresh every 30 seconds
- No bot controls, restart actions, or settings writes

## Local setup
1. Copy `.env.example` to `.env` and fill in the values.
2. Run `npm install`.
3. Run `npm run check`.
4. Run `npm start` and open `http://localhost:3000`.

Required environment variables:
- `ECLIPSE_BOT_API_URL`: base URL of the existing bot API
- `ECLIPSE_BOT_API_KEY`: value matching the bot's configured dashboard API key
- `NEXUS_LOGIN_PASSWORD`: a new, unique password for this dashboard
- `NEXUS_COOKIE_SECRET`: a random secret with at least 32 characters

Never commit real secrets.

## New Render service
Create a separate Node web service from this repository:
- Build command: `npm install`
- Start command: `npm start`
- Region: Singapore
- Set all four environment variables securely in Render
- Keep the current dashboard service and bot service unchanged

The dashboard uses the bot's existing `/api/dashboard/*` endpoints. Actual live data depends on those endpoints accepting the configured API key and returning the expected fields. Some display fields may show a dash if the bot API does not provide them.

## Safety and deployment status
This repository is independent. No changes to the existing bot or dashboard are required. Do not use placeholder values for production secrets. Test the new service before sharing its URL.
