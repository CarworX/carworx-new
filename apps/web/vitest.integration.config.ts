import { defineConfig } from "vitest/config";

// T3/T5 integration suite (scripts/ci/README.md, `test:integration`). Runs
// against the production Worker build and the local Supabase stack that K1
// starts and resets. One file at a time: files share that stack.
const report = process.env["CI_INTEGRATION_REPORT"];

export default defineConfig({
  test: {
    include: ["integration/**/*.test.ts"],
    environment: "node",
    globalSetup: ["integration/global-setup.ts"],
    fileParallelism: false,
    passWithNoTests: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
    reporters: report ? ["default", "json"] : ["default"],
    ...(report ? { outputFile: { json: report } } : {}),
  },
});
