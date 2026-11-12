# CarworX "coming soon" page

This is a static holding page for `carworx.app` and `www.carworx.app`, served by an **assets-only Cloudflare Worker** (`carworx-coming-soon`). It replaces the old Netlify site (owner, 2026-11-12).

- It has no JavaScript, no forms, no cookies, no analytics and no outside requests. Fonts and the logo are served from the same site. The headers are in `public/_headers`.
- It isn't a pnpm workspace package (there's no `package.json`), so `pnpm run check` doesn't build it.
- The logo and favicon are copies of `planning/design/brand/exports/core/carworx-lockup-horizontal-ink.svg` and `carworx-mark-ink.svg`. The fonts are Geist (SIL OFL, `public/fonts/OFL-Geist.txt`).

## Preview locally

```sh
pnpm --filter @carworx/web exec wrangler dev --config ../coming-soon/wrangler.jsonc
```

## Publish (owner only)

1. In Cloudflare DNS for `carworx.app`, delete the old Netlify records: `A carworx.app` (75.2.60.5) and `CNAME www`. A Worker custom domain can't be added while they exist. **Leave every mail record alone** (Zoho MX, SPF, DKIM, `_dmarc`, and the Resend `send` / `rsend` / `resend._domainkey` records).
2. Straight away, from the repo root, signed in to the CarworX Cloudflare account:

   ```sh
   pnpm --filter @carworx/web exec wrangler deploy --config ../coming-soon/wrangler.jsonc
   ```

   Cloudflare creates the `carworx.app` and `www` records and their certificates.
3. In Netlify, remove both domains from the old site, then delete the site.

## Retire at launch

When the real app (`carworx-web`) is ready for production (G-PROD), move the two custom domains to that Worker, then delete `carworx-coming-soon`.
