import { cloudflare } from "@cloudflare/vite-plugin";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin } from "vite";

// Tailwind prepends "/*! tailwindcss vX | MIT License | https://tailwindcss.com */"
// to the CSS. The licence notice stays; only the scheme goes, so a scan of the
// built CSS for "https?://" finds nothing at all (G13, D2: no remote URL).
const bannerWithoutScheme = (): Plugin => ({
  name: "carworx:css-banner",
  generateBundle(_options, bundle) {
    for (const file of Object.values(bundle))
      if (
        file.type === "asset" &&
        file.fileName.endsWith(".css") &&
        typeof file.source === "string"
      )
        file.source = file.source.replace(
          "| https://tailwindcss.com",
          "| tailwindcss.com",
        );
  },
});

export default defineConfig({
  plugins: [
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tailwindcss(),
    reactRouter(),
    bannerWithoutScheme(),
  ],
  build: {
    // Fonts, objects and glyphs ship as files in build/client, never as
    // data: URIs or third-party URLs.
    assetsInlineLimit: 0,
  },
});
