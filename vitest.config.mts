import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // server/ has its own tests: run them with `npm test` inside server/.
    exclude: [...configDefaults.exclude, "server/**"],
  },
  resolve: {
    // Same "@/…" import alias as tsconfig.json.
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
