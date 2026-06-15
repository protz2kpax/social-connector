# Installing & running Relay on a PC (via Claude Code)

This is for an end user who has **Claude Code** working and wants to run the
Relay web app (the UI of `social-connector`). Hand the prompt below to Claude
Code on the target machine. Relay drives a real browser (Playwright) and runs a
local Node server, so it is installed from this repo rather than a one-click
installer.

## Prerequisites (Claude Code can install these if missing)

- **Node.js ≥ 18** and **git**
- A Chromium browser for Playwright (the steps run `npx playwright install chromium`)
- Optional: an **OpenAI** or **Anthropic** API key, only for the AI Assistant
  feature. Everything else (Broadcast, Inbox, Connections) works without one.

## First install

```bash
git clone https://github.com/protz2kpax/social-connector.git
cd social-connector
npm install                      # installs deps + builds the library (prepare script)
npx playwright install chromium  # one-time browser download for automation
npm run app:install              # installs the server + web app dependencies
```

## Run it

```bash
npm run app:dev
```

Then open **http://127.0.0.1:5173** in a browser.

- Go to **Connections** and click **Connect** on each provider you use
  (Facebook / LinkedIn / WhatsApp). A real browser window opens — log in there
  once; the session is saved locally and reused.
- **Broadcast** sends one message to all connected providers at once.
- **Inbox** reads recent WhatsApp chats; **Assistant** is the natural-language
  agent (needs an API key — see below).

To run it like a finished app (built, served on one port):

```bash
npm run app:build
npm run app:start                # open http://127.0.0.1:3001
```

## API key for the Assistant (optional)

Create a file named `.env` in the project root with one of:

```
OPENAI_API_KEY=sk-...
# or
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
```

(Optional) `CACHE_PASSPHRASE=some-secret` enables the encrypted local cache of
conversations.

## Updating later (the app evolves)

```bash
cd social-connector
git pull
npm install && npm run app:install   # pick up any new dependencies
npm run app:dev                       # or app:build && app:start
```

## Notes

- **Local & private**: the server binds to `127.0.0.1` only (no network access,
  no login). It controls your logged-in social accounts — keep it on your machine.
- Sessions, the conversation cache, and the Assistant transcript are all stored
  locally (browser profiles on disk, `localStorage` for the transcript).
- If port 3001 is busy: `PORT=3002 npm run app:start`.
