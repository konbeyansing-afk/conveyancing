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
    // Integration tests share one Neon database; running files in parallel
    // makes their fixtures race. Unit tests are pure and unaffected.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
