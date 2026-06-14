/**
 * Exemple d'utilisation programmatique.
 * Lance avec :  npx tsx examples/post.ts "Mon message"
 *
 * La connexion est manuelle : si aucune session valide n'existe, une fenetre
 * s'ouvre et tu te connectes a la main. La session est ensuite reutilisee.
 */
import { FacebookConnector } from "../src/index.js";

const message = process.argv.slice(2).join(" ") || "Hello depuis facebook-connector !";

const fb = new FacebookConnector({ statePath: "./fb-state.json", headless: false });

try {
  // login() : ne fait rien si la session est valide, sinon attend la
  // connexion manuelle dans la fenetre.
  await fb.login();
  await fb.postToWall(message);
  console.log("Publie:", message);
} finally {
  await fb.close();
}
