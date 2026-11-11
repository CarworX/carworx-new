# CarworX business onboarding concepts: shared brief

**Status:** exploration, 2026-11-11 (SAST). Design files only; no product code changes.

**Goal:** replace today's one long form (`/provider/apply`) and the single dashboard (`/provider`) with a proper onboarding experience: **one step per page with Next and Back**, in the existing Studio design language. Five clickable concepts explore different flows. The owner picks one (or mixes them), then writes the build plan. Admin onboarding comes later, the same way.

## What stays fixed (the brand)

Studio as shipped in `apps/web/app/styles/`: tokens, Geist and Geist Mono, pill buttons, chips, the dot-grid canvas, the frosted `NavBar` pill and the `StepList` look. **Change the flow, not the brand.** The concepts load a copy of `tokens.generated.css` and `studio.css` from `_shared/`.

## The journeys every concept covers

1. **New business:** welcome → new or claim → the steps → review → submitted → waiting → approved and live.
2. **Claiming an existing listing:** welcome → claim → pick the listing → how we check it's yours → review → submitted → waiting.
3. **"What happens next"** while the application waits: what an admin checks, what the business can do meanwhile, and how they hear back (email to their sign-in address). No invented review times.

The fields are today's (see `provider.apply.tsx` and `provider.claim.$publicId.tsx`): business name, main service (now multi-select), how you serve customers (now **pick one or both**: "They come to me" and/or "I go to them"), area or metro, a location point (premises: a public pin; mobile: a private base and travel radius; both: both), and what you do. New, all pick-only: your role, team size, opening hours and "trading since". Claim evidence stays "business email domain" or "show an admin a document"; the typed document reference becomes a document-type chip and a calendar date.

## Fixed rules

- **A10:** a mobile business's base, radius centre and any base-derived distance are **never shown** to customers. Mobile-only listings read "Comes to you" plus the metro; a business that does both shows its premises plus "also comes to you". The private base and radius appear only on the business's own screens, with a note saying so. Premises pins are for fixed businesses only.
- **Claude 17 §3 labels:** only "Identity checked", "Business details checked" and "Premises visited" (fixed premises only), shown only once an admin has ticked them. No "certified" or "verified" claims.
- **Consent:** an explicit, unticked checkbox: "These details are true, and I may list this business." (claim: "I run this business and may manage its listing.").
- **No ID numbers and no date of birth.** Where age matters, an "I'm 18 or older" toggle. Business dates use a calendar.
- **Pick, don't type:** chips, tiles, dropdowns, toggles, sliders, a calendar and a map pin. Free text only for the business name and a short "about" line (with tap-to-add starter phrases). **Target: 2 or fewer typed fields** per application.
- **Map:** a synthetic static map or the browser's own geolocation. No paid or hosted geocoding.
- Synthetic data only (fictional businesses; real place names only as map labels). Accessibility basics: labels, focus order, Studio contrast pairs (`apps/web/app/ui/contrast-pairs.ts`), keyboard Next and Back.

## Success criteria for picking a concept

| Criterion | What good looks like |
|---|---|
| Time to submit | A new fixed business can submit in about 2 minutes on a phone |
| Typing | 2 typed fields or fewer |
| Orientation | You always know where you are, what's left and how to go back |
| Trust | It is clear what is public, what is private (A10) and what an admin checks |
| Waiting | After sending, the next steps are obvious and there is something useful to do |
| Fit | Feels like Studio; reuses existing components; easy to build in React Router |
| Resumable | Leaving and coming back does not lose answers (how cheaply each concept does this) |

## Deliverables

- `onboarding/index.html`: the comparison board.
- `onboarding/<concept>/index.html`: one static clickable prototype per concept, built on `_shared/` (tokens, Studio CSS, `kit.css`, `kit.js` step engine).
- `onboarding/NOTES.md`: one paragraph and pros and cons per concept, typed-field counts, and a recommendation.
- `onboarding/<concept>/shots/`: phone screenshots (390 × 844 at 2×) of the key steps.
