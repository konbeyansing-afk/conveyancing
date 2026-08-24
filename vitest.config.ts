import { defineConfig } from "vitest/config";
import path from "node:path";

// The app's runtime config lives in .env (Next loads it automatically; Vitest does not).
try {
  process.loadEnvFile(".env");
} catch {
  // .env absent — integration tests will skip themselves.
}

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    globals: false,
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    // Test files run in parallel. The database-backed suites can share one
    // Neon database safely because every fixture is namespaced with a per-file
    // run id and each suite only ever deletes ids it created — and the remote
    // database's latency, not CPU, is what makes them slow, so overlapping
    // them is most of the win.
    fileParallelism: true,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
