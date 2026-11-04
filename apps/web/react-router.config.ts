import type { Config } from "@react-router/dev/config";

export default {
  ssr: true,
  future: {
    // Required by @cloudflare/vite-plugin (Cloudflare's React Router template).
    v8_viteEnvironmentApi: true,
  },
} satisfies Config;
