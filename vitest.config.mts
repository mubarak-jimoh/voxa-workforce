import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 20000,
    env: {
      BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-ok",
      BETTER_AUTH_URL: "http://localhost:3000",
      PGLITE_DATA_DIR: ".data/voxa-test",
      VOXA_MODEL_ADAPTER: "test",
      VOXA_RESEARCH_ADAPTER: "unconfigured",
      VOXA_WORK_EXECUTOR: "inline",
      NODE_ENV: "test",
    },
  },
});
