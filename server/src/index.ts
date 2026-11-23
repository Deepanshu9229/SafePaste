import { createApp } from "./app.ts";
import { loadConfig } from "./config.ts";
import { createTurnstileVerifier } from "./turnstile.ts";

const config = loadConfig();
const app = createApp({ config, verifyTurnstile: createTurnstileVerifier(config.turnstileSecret) });

// Loopback only: the outside world reaches the API through Caddy.
app.listen(config.port, "127.0.0.1", () => {
  console.log(`SafePaste API listening on http://127.0.0.1:${config.port} (model ${config.model})`);
});
