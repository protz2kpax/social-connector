# social-connector

**Multi-provider** TypeScript library (Facebook, WhatsApp, LinkedIn) to post/send a message via an automated browser ([Playwright](https://playwright.dev)).

Same principle for all providers: login is **manual** (they block automated login). A window opens, you log in yourself **once** (or scan the QR for WhatsApp), then the session (cookies) is saved **per provider** and reused.

| Provider | `post()` action | `target` required |
|---|---|---|
| `facebook` | Posts to the wall | no |
| `linkedin` | Posts to the feed | no |
| `whatsapp` | Sends a message to a contact | **yes** (international number) |

> ⚠️ Automating these platforms **violates their Terms of Service**. Risk: captcha/2FA, blocking, ban. Use only on **your own accounts**, at your own risk. No verification is bypassed.

## Installation

```bash
npm install
npx playwright install chromium
```

## Usage — CLI

```bash
# 1) MANUAL login (once per provider). Window forced visible.
npm run login:fb          # Facebook  (= login --provider facebook)
npm run login:wa          # WhatsApp  (scan the QR)
npm run login:li          # LinkedIn

# 2) Post / send (reuses the session). Chromium hidden by default.
npm run post -- facebook "Hello my wall"
npm run post -- linkedin "Hello my feed"
npm run post -- whatsapp --to 33612345678 "Hi!"

# Show Chromium for a run (debug): --show / --headed / -s
npm run post -- whatsapp --to 33612345678 "Hi!" --show

# Session status
npm run status -- facebook
```

> `npm run post -- <provider> ...` passes `--provider <provider>` to the CLI.
> Direct form: `npx tsx src/cli.ts post --provider whatsapp --to 33612345678 "Hi"`.

## Usage — API

```typescript
import { SocialConnector } from "social-connector";

// Facebook (wall)
const fb = new SocialConnector("facebook");
try {
  await fb.login();                       // manual if no session
  await fb.post("Hello world 👋");
} finally {
  await fb.close();
}

// WhatsApp (message to a contact)
const wa = new SocialConnector("whatsapp");
try {
  await wa.login();                       // scan the QR
  await wa.post("Hi!", { target: "33612345678" });
} finally {
  await wa.close();
}
```

### Public API

| Method | Description |
|---|---|
| `new SocialConnector(providerId, opts?)` | `providerId`: `facebook`\|`whatsapp`\|`linkedin`. `opts`: `userDataDir`, `headless` (default `true` = hidden), `slowMo`, `locale`, `verbose` |
| `login(opts?)` | **Manual** login. Reuses the session if valid. `opts.timeoutMs` |
| `isLoggedIn()` | `true` if a saved session is valid |
| `post(content, options?)` | Posts/sends. `options.target` (WhatsApp), `options.screenshotPath` |
| `close()` | Closes the browser |

### Typed errors

`NotLoggedInError`, `CheckpointError`, `SelectorError`, `PostFailedError`, `UnknownProviderError` — derive from `SocialConnectorError`.

## Architecture

```
SocialConnector (facade, picks the provider)
├── BrowserSession   → Playwright lifecycle + persistent profile (cookies/IndexedDB/cache, per provider)
├── AuthManager      → session detection + waiting for manual login (driven by ProviderAuthConfig)
└── provider.post()  → provider-specific action
providers/
  facebook.ts        → wall   | whatsapp.ts → contact message | linkedin.ts → feed
  index.ts           → registry { facebook, whatsapp, linkedin }
types.ts             → SocialProvider, ProviderAuthConfig, PostOptions, PostContext
dom.ts               → tolerant helpers (firstVisible walks ALL matches)
```

### Adding a provider

Create `src/providers/<name>.ts` exporting a `SocialProvider` (`auth` + `post`), then register it in `src/providers/index.ts`. Nothing else to touch.

## Limits & maintenance

- **Fragile selectors**: each provider changes its DOM. A `SelectorError` lists the selectors tried → patch the relevant provider file.
- **Not verified without a real login**: WhatsApp/LinkedIn `post` selectors and LinkedIn logged-out markers. Adjust at the first real login.
- **WhatsApp**: `target` = international number without `+` or spaces (e.g. `33612345678`).

## Scripts

```bash
npm run build       # compile TS -> dist/
npm run typecheck   # types without emitting
```
