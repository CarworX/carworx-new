# Business onboarding concepts: notes

**Status:** exploration, 2026-11-11 (SAST). Brief: [BRIEF.md](BRIEF.md). Board: [index.html](index.html). Design files only; no product code changed.

## How they are built

- `_shared/tokens.css` is a browser copy of `apps/web/app/styles/tokens.generated.css` (only Tailwind's `@theme static` block becomes `:root`). `_shared/studio.css` is an exact copy of `studio.css`. The fonts and the lockup are copied too.
- `_shared/kit.css` adds the onboarding pieces on top of Studio: pick chips, choice tiles, toggles, day toggles, a slider, the map pin, the listing card, review and status screens. Every colour is a Studio token, and every text and edge pair is one already in `contrast-pairs.ts`.
- `_shared/kit.js` holds one set of question definitions and a small step engine: Next, Back, branching (`data-if`), validation stubs (`data-require`), progress, the step rail and deep links (`#step-id`). Each concept is only its layout and CSS on top. `?preset=fixed|mobile|both|claim` fills synthetic answers for demos and screenshots.
- Keyboard: Tab order follows the page; **Enter** is Next (except in a text box or on a button), **Esc** is Back. Focus moves to the new step's heading. The map takes Enter (drop a pin) and the arrow keys (move it). On a single-choice question, auto-advance happens only after a tap or click, never on arrow keys.

## Typed fields (target: 2 or fewer)

| Journey | Typed fields | Everything else |
|---|---|---|
| New business (all 5 concepts) | **2**: business name, one "about" line (with 7 tap-to-add starter phrases) | Chips (role, team size, services, document type), tiles (new or claim, where you serve customers, evidence), dropdown (metro), day toggles and time pickers (hours), slider (radius), calendar (trading since, document date), map pin or "Use my location", toggle (18+), consent checkbox |
| Claim (all 5 concepts) | **0** | The typed "document reference" becomes a document-type chip plus a calendar date |

**"Where do you serve customers?" is pick one or both** (owner, 2026-11-11): "They come to me" and/or "I go to them". Both means the flow asks for the premises pin (public) and the private base and radius (never shown). The public line then reads "Saxonwold, Johannesburg · also comes to you".

**Privacy choices.** No ID numbers (banned) and **no date of birth**: CarworX has no need for it, and collecting it adds POPIA risk. The age check is an "I'm 18 or older" toggle. *The owner can overrule this.* Business dates use a calendar. A10 holds everywhere: a mobile base and radius appear only on the business's own screens, with a "Private" note, and never in the listing preview, review's public line or the live card. "Premises visited" is offered only to businesses with premises. Labels show only after an admin ticks them.

**Map.** A synthetic street map (inline SVG, "not to scale") and the browser's own geolocation. No hosted or paid geocoding. In the prototype, "Use my location" only places the pin at the map centre and sends nothing.

## The five concepts

### 1 · One thing at a time (`one-thing/`)
One question per full screen in big type, with a thin progress bar and Next/Back fixed at the bottom. Single-choice picks move on by themselves when tapped. It is the calmest on a phone and the simplest to build (one component per question), but it is the most screens (12 for fixed or mobile, 13 for both) and hides what's left beyond "7 of 12".
**Pros:** calm, mobile-first, very low cognitive load. **Cons:** most taps; weak overview.

### 2 · Guided stepper (`stepper/`)
Six named steps (Business → Service → Location → About → Check → Send) with the existing `StepList` look as the rail. Done steps turn ink; on phones the rail collapses to a segmented bar with the step name. A claim swaps Service/Location/About for one "Proof" step.
**Pros:** clearest orientation; fewest pages; strong on desktop. **Cons:** pages get long on phones; feels most like a form.

### 3 · Live preview (`live-preview/`)
Each answer builds the public listing card inside a phone frame beside the question, and the changed part flashes. On phones the preview docks at the top as a one-line summary that expands on tap. The review step shows the finished card.
**Pros:** shows why each answer matters; makes the public vs private line (A10) visible. **Cons:** most layout work; the preview competes for space on small phones.

### 4 · Conversational (`chat/`)
CarworX asks in friendly bubbles ("Where do customers find you? Pick one or both.") and your answers stack up as a thread, each with a Change link. Back is "Undo". On phones only the last two exchanges show.
**Pros:** warmest; good for first-time or less confident owners. **Cons:** slowest for confident users; chat patterns are harder to make fully accessible to screen readers.

### 5 · Setup checklist (`checklist/`)
A short welcome, then a "Get set up" hub with a progress ring and four tasks: Details, Location, Proof, Team (a claim has Your listing, Proof, Team). Each task is its own 1–3 step Next/Back flow that returns to the hub. "Review and send" unlocks when every task is done. Answers save on the device (localStorage), so you can stop and come back.
**Pros:** resumable, any order; grows into the business dashboard after approval. **Cons:** one extra level (hub, then task); a real build needs a saved-draft model on the server.

## Shared states (all five)

- **Submitted:** a tick, the time sent in SAST, and "What happens next" in the `StepList` look: Sent (you) → An admin checks it (CarworX) → You're live → Your first request (2 business hours to accept).
- **Waiting dashboard:** "Waiting for review" label, "Not in search yet", what the admin checks (each label "to do"), what you can do meanwhile, and the listing as customers will see it. No invented review time: "We'll email your sign-in address when it's reviewed."
- **Approved / live:** "You're live", the labels earned, the live card, and next tasks. Reached in the demo with "Demo: see it approved".

## Owner direction (2026-11-11, SAST)

The owner liked **2 · Guided stepper**, **3 · Live preview** and **5 · Setup checklist**, and asked to proceed with them. The grounded direction for the build plan:

| Piece | Comes from | What it does |
|---|---|---|
| Frame | 5 · Checklist | Welcome → new or claim → "Get set up" hub with tasks (Details, Location, Proof, Team). Resumable; any order; becomes the business dashboard after approval |
| Inside each task | 2 · Stepper | Named steps with the `StepList` rail on desktop and a segmented bar on phones; Next/Back on every page |
| Progress indicator | 2 · Stepper (phone view) | **Owner's pick (2026-11-12):** the segmented bar. One segment per step (done and current in ink, upcoming in `canvas-2`), the step name on the left and "3 of 6" in mono on the right. Use it at every width and inside every checklist task, in place of the thin bar from concepts 1 and 3. Screenshot: `stepper/shots/03-location-both.png` |
| Feedback | 3 · Live preview | The public listing card builds beside the questions (docked on phones) and sits on the hub; makes A10's public vs private line visible |
| Shared, unchanged | All | Pick-don't-type controls (2 typed fields, 0 for a claim), "pick one or both" for where you serve customers, the 18+ toggle (no date of birth), the submitted, waiting and live states |

Open for the build plan: server-side drafts for "stop and come back" (today's prototype uses localStorage), and whether Team invites stay "after approval".

## Recommendation (before the owner's pick)

**Use 5 as the frame, 1 inside the tasks, and 3's card on the hub.** The checklist is the only concept that is resumable by design, and its hub becomes the business dashboard after approval (team, photos, booking requests), so the build gets two screens from one. Inside each task, concept 1's one-question screens keep phones calm. Concept 3's live card on the hub shows people what they are building. If one concept must be picked unchanged, pick **2 (stepper)**: it is the cheapest to build from today's form and the clearest about where you are.

## Not done here

- No server drafts, emails or admin screens (admin concepts come next).
- Concepts 1, 2, 3 and 4 do not save between visits; only 5 shows that.
- Screenshots are synthetic (`<concept>/shots/`, 390 × 844 at 2×, plus one desktop thumbnail each).
