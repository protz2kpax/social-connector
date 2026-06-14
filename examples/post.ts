/**
 * Multi-provider example.
 *   npx tsx examples/post.ts facebook "Hello wall"
 *   npx tsx examples/post.ts linkedin "Hello feed"
 *   npx tsx examples/post.ts whatsapp "Hi" 33612345678
 *
 * Manual login: if there is no valid session, a window opens and you log
 * in by hand (or scan the QR for WhatsApp). The session is reused.
 */
import { SocialConnector, type ProviderId } from "../src/index.js";

const [providerArg, message, target] = process.argv.slice(2);
const provider = (providerArg ?? "facebook") as ProviderId;

const fb = new SocialConnector(provider, { headless: false });

try {
  await fb.login();
  await fb.post(message ?? "Hello from social-connector!", { target });
  console.log(`Posted on ${provider}.`);
} finally {
  await fb.close();
}
