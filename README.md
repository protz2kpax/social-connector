# facebook-connector

Librairie TypeScript pour se connecter à un compte Facebook et **publier un message sur son propre mur**, via un navigateur automatisé ([Playwright](https://playwright.dev)).

La connexion est **manuelle** (Facebook bloque le login automatisé) : une fenêtre s'ouvre, tu te connectes toi-même **une seule fois**, puis la session (cookies) est sauvegardée sur disque et réutilisée — plus besoin de te reconnecter ni de repasser les vérifications de sécurité ensuite.

> ⚠️ **À lire avant d'utiliser**
> Automatiser Facebook **viole les Conditions d'utilisation de Meta**. Risques réels : déclenchement de captcha/2FA, blocage temporaire ou bannissement du compte. À n'utiliser que sur **ton propre compte**, à tes risques. Cette lib ne contourne aucune vérification : tout checkpoint t'est rendu pour résolution manuelle.

## Installation

```bash
npm install
npx playwright install chromium   # télécharge le navigateur
```

## Configuration

Copie `.env.example` en `.env` (optionnel — aucun identifiant n'y figure) :

```ini
FB_STATE_PATH=./fb-state.json   # optionnel
FB_HEADLESS=0                   # 0 = navigateur visible, 1 = headless
```

`.env` et `fb-state.json` sont git-ignorés.

## Utilisation — CLI

```bash
# 1) Connexion MANUELLE (une fois). Une fenêtre Chromium s'ouvre :
#    tu te connectes toi-même (email + mot de passe + 2FA si demandé).
#    Dès que tu es loggé, la session est sauvegardée.
npm run login

# 2) Publier sur le mur (réutilise la session)
npm run post -- "Mon premier message automatisé"

# Vérifier l'état de la session
npx tsx src/cli.ts status
```

## Utilisation — API

```typescript
import { FacebookConnector } from "facebook-connector";

const fb = new FacebookConnector({ statePath: "./fb-state.json" });

try {
  // Réutilise la session sauvée si valide, sinon ouvre la fenêtre
  // et attend que tu te connectes à la main.
  await fb.login();
  await fb.postToWall("Hello world 👋");
} finally {
  await fb.close();
}
```

### API publique

| Méthode | Description |
|---|---|
| `new FacebookConnector(opts?)` | `statePath`, `headless`, `slowMo`, `locale`, `verbose` (logs de progression, défaut `true`) |
| `login(opts?)` | Connexion **manuelle**. Réutilise la session si valide, sinon ouvre la fenêtre et attend. `opts.timeoutMs`. |
| `isLoggedIn()` | `true` si une session sauvée est valide. |
| `postToWall(text, opts?)` | Publie `text` sur le mur. `opts.screenshotPath` pour debug. |
| `close()` | Ferme le navigateur. |

### Erreurs typées

`NotLoggedInError`, `CheckpointError`, `SelectorError`, `PostFailedError` — toutes dérivent de `FacebookConnectorError`.

## Architecture

```
FacebookConnector (façade)
├── BrowserSession   → cycle de vie Playwright + persistance storageState
├── AuthManager      → détection session + attente du login manuel
└── WallPoster       → ouvre le composer, tape le texte, publie
selectors.ts         → tous les sélecteurs DOM (POINT FRAGILE — à patcher si l'UI change)
dom.ts               → helpers tolérants (essaie plusieurs sélecteurs candidats)
```

## Limites & maintenance

- **Sélecteurs fragiles** : Facebook change son DOM souvent. Si une action casse → `SelectorError` avec la liste des sélecteurs essayés. Corrige `src/selectors.ts`.
- **Localisation** : les `aria-label` dépendent de la langue du compte. Les sélecteurs couvrent FR + EN ; ajoute ta langue au besoin.
- **Pas de contournement** : captcha/2FA restent manuels (par design).

## Scripts

```bash
npm run build       # compile TS -> dist/
npm run typecheck   # vérifie les types sans émettre
npm run dev         # lance la CLI via tsx
```
