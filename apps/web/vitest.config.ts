import { defineConfig } from "vitest/config";

// Unit tests run in Node without the Cloudflare or React Router Vite plugins,
// so they need no Worker runtime, network or secrets.
export default defineConfig({
  test: {
    include: ["app/**/*.test.ts", "app/**/*.test.tsx", "workers/**/*.test.ts"],
    environment: "node",
    passWithNoTests: false,
  },
});
