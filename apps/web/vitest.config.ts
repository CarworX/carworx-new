import { defineConfig } from "vitest/config";

// Unit tests run in Node without the Cloudflare or React Router Vite plugins,
// so they need no Worker runtime, network or secrets. Components are checked
// as server-rendered markup; the token generator and contrast check are pure.
export default defineConfig({
  test: {
    include: [
      "app/**/*.test.ts",
      "app/**/*.test.tsx",
      "workers/**/*.test.ts",
      "scripts/**/*.test.ts",
    ],
    environment: "node",
    passWithNoTests: false,
  },
});
