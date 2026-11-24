import pg from "pg";
import { createApp } from "./app.ts";
import { loadConfig } from "./config.ts";
import { createTurnstileVerifier } from "./turnstile.ts";
import { createUsageLogger, noUsageLog } from "./usageLog.ts";

const config = loadConfig();

const logUsage = config.usageLog
  ? createUsageLogger(new pg.Pool({ connectionString: config.usageLog.databaseUrl, max: 2 }), config.usageLog.hashSecret)
  : noUsageLog;

const app = createApp({
  config,
  verifyTurnstile: createTurnstileVerifier(config.turnstileSecret),
  logUsage,
});

// Loopback only: the outside world reaches the API through Caddy.
app.listen(config.port, "127.0.0.1", () => {
  const logging = config.usageLog ? "on" : "off";
  console.log(`SafePaste API listening on http://127.0.0.1:${config.port} (model ${config.model}, usage log ${logging})`);
});
