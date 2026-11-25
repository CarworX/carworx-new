# Frontend handoff · redesign 2026-11 (A1–A8)

For the frontend builder. Written by the Claude design session, 25 Nov 2026 (SAST), against `main` @ `45a6ff5`. Owner approved A1–A8 on 25 Nov 2026.

**Already on `main` (do not redo):** B-01/B-09 single brand intro (#167 era, `home.test.tsx`), B-05 location error row (#168), B-10 consent gating on sign-up and on sign-in's Google button (#170, #171), B-11 no redirect link, B-14 post-sign-in destination (`signedInDestination`, #167). Where a section below mentions them, it only says how they look inside the new shell.

**Read first:** `AGENTS.md` (gates: `claude/*` branch, PR, `Agent:` trailer, green exact-head CI, independent review), `planning/claude/BACKLOG.md` (B-IDs), and the mockups in this folder: each `A#/README.md` lists the states and the design reasons; `A#/*.html` is the exact markup, `A#/png/` the approved pictures (1280 and 390 wide).

**Component specs:** `planning/design/brand/studio/components/<Name>/README.md` (anatomy, states, tokens, do/don't) and the live previews in the design-system artifact. The new ones are SiteHeader, SiteFooter, LocationChip, CategoryHero, ListingCard, Rating, HomeRow, FinesCard, IdCheckStatus, AdminReview, ReviewSummary, ReviewItem, ReportDialog and ConsentGate.

---

## 0. Styles: where the CSS goes

The mockups used `_shared/redesign.css` (`rd-` prefix) on top of copies of `home/home.css` and `home/landing.css`. **That file does not move into the app.** The production CSS is the `cx-` port, already written and token-based, in `planning/design/brand/studio/components/bundle.css` (the block headed "Redesign 2026-11").

1. Create `apps/web/app/styles/shell.css` and copy that block into it, inside `@layer components { … }`. Import it from `styles/app.css` after `./site.css`.
2. Apply `studio.css`'s porting rules to the copy: controls use `--control-edge`, no text below 12px (the 11.5px badge and table-header text become 12px), and rename any modifier that is also a Tailwind utility (`block` → `wide`, and so on, as `studio.css` already does).
3. **Token change (the only one):** add `rating` to `planning/design/brand/tokens.json` (`#f5a524`, usage: "Rating stars only. Decorative: always beside the number in ink text; under 3:1 on white, so never the only carrier."). Run `pnpm --filter web tokens` and commit the regenerated `tokens.generated.css`. Then delete the temporary `:root{--rating:…}` line from your copy.
4. Status colours come from the existing tokens `--ok`/`--ok-bg`, `--warn`/`--warn-bg` and `--err`/`--err-bg`. The mockups used slightly brighter one-off hexes; build with the tokens.
5. Reuse, don't re-create:

| Mockup class | Use instead |
|---|---|
| `rd-btn` (`.light`, `.sm`, `.full`, `.is-disabled`) | `<Button>` / `.cx-btn primary/secondary/outlined`, `sm`, `wide`, `disabled` |
| `rd-note` (`.warn` `.err` `.ok` `.plain`) | `<Note>` / `.cx-note` |
| `rd-field`, `rd-input` | `<Field>` / `.cx-field`, `.cx-input` |
| `rd-check` | `.cx-check` + `.cx-box` (in `.cx-consent` on auth) |
| `rd-steps` | `<StepList>` / `.cx-steps` |
| `rd-empty` | the EmptyState pattern (`.cx-empty`, centred variant) |
| `rd-chip`, `lp-chip` | `<Chip>` / `.cx-chip` (`.on`) |
| `rd-lbl` | `.cx-badge` (new) |
| `rd-av` | `.cx-av` (new; `.coral` → `.peach`, `.amber` → `.note`) |
| `rd-menu` | `.cx-acctmenu` (new) |
| `rd-bcard` | `.cx-lcard` (new) |
| `rd-stars` | `.cx-stars` (new) |
| `rd-fine` | keep as `.cx-fine` (port the `rd-fine` block from `_shared/redesign.css`, tokenised) |
| `rd-receipt`, `rd-handoff`, `rd-fsum`, `rd-stat`, `rd-kv` | port from `_shared/redesign.css` into `shell.css` as `cx-receipt-torn`, `cx-handoff`, `cx-fsum`, `cx-stat`, `cx-kv`, tokenised (`--ok` for the stamp) |

The landing keeps `home/home.css` and `home/landing.css` as they are (generated; do not hand-edit `preview.html`). Shared shell pieces go in `shell.css`, not in those files.

---

## 1. Shared shell (A1 · B-02, B-03, B-04, B-14)

**Create** `apps/web/app/ui/site/SiteHeader.tsx`, `SiteFooter.tsx` and `AccountMenu.tsx`. **Change** `ui/public/PublicShell.tsx` and `sites/SitesShell.tsx` to render them (or replace both with one `SiteShell`). On `routes/home.tsx`, replace the header and footer cut from `preview.html` (`HEAD` minus the intro, and `FOOTER`) with the components. Auth pages (`auth/ui.tsx`) also get them.

- The header needs the session: expose `user: {firstName, fullName, email, initials} | null` and `openFines: number` from the root loader (or a `useRouteLoaderData("root")`). It must be correct on every page; today none of the headers know you're signed in.
- Classes: `.cx-nav` (+ `.pinned` once `scrollY > 24`, a passive scroll listener; without JS it stays unpinned), `.cx-avbtn`, `.cx-av`, `.cx-acctmenu`, `.cx-menu`, `.cx-sheet`, `.cx-sheet .who`.
- Copy:
  - Links: "Find a service" → `/#services` · "Fines" → `/#fines` · "For businesses" → `/#business`. On `/` they scroll; elsewhere they navigate to `/` plus the hash.
  - Signed out: "Sign in" → `/auth/sign-in`; "Sign up" → `/auth/sign-up`.
  - Signed in: button "{firstName}". Menu: who block "{fullName}" / "{email}"; "My fines" (+ count badge when `openFines > 0`) → `/fines/mine`; "Account" → `/account`; "My business" → `/provider`; rule; "Sign out" → `/auth/sign-out`.
  - Phone sheet, signed out: the three links, "Sign in", "Sign up", "List your business" → `/provider/get-listed/business`.
  - Phone sheet, signed in: who block, the three links, "My fines · {n}", "Account", "My business", "Sign out" (quiet, `.cx-link`).
- Footer copy: links "Find a service", "Fines", "For businesses", "List your business" (`/provider/get-listed/business`), "Contact support" (`/support`). Fine row: "carworx.app · South Africa" | "Contact support · Privacy · Terms of use".
- Behaviour: the menu is a disclosure (`aria-haspopup="menu"`, `aria-expanded`); Esc and an outside click close it and return focus. The sheet keeps NavBar's focus trap. **Sign-out** links use `reloadDocument` (B-01 safety net).
- **Remove:** the "All services →" link in `home.tsx` `Categories`; every `/search` nav link (`/search` stays only as the search form's results page).
- B-14 is done (`auth/after-sign-in.server.ts`): customers land on `/`, which §4 turns into the signed-in home.

## 2. Landing (A2 · B-01, B-04, B-08, B-09, B-12, B-20)

**Change** `routes/home.tsx` (and add copy constants there, not in `preview.html`).

- Hero badge: "Pilot · CarworX fee R0" → **"Free to browse · Free to list"**. Under the search: "✓ Free to browse · no account needed" | "🔒 Sign in only to send an enquiry".
- Categories section: `id="services"`, eyebrow "Find a service", heading "What does your car need?". Tile subtitles "{n} businesses". The 5th tile "Fines & Vehicle Admin" / "Check and pay fines" links to `#fines`, not `/fines`.
- Businesses section: use `.cx-lgrid` + `<ListingCard>` (§3 card), "See all {total} →" → `/search`.
- How it works: step 03 "Send an enquiry" / "The business replies to you directly. You pay them directly." / badge "Signed in".
- **Drop the app-glimpse phone carousel** (`#glimpse`): it shows bookings and payments, which the directory launch doesn't have.
- **Fines section** (`#fines`) replaces the old copy:
  - Eyebrow "Fines & Vehicle Admin". Heading "A fine on the windscreen?" / grey "Check it and pay it here.". Lede "See the traffic fines linked to your ID number and pay them in one place, with a receipt you can keep."
  - Three steps:
    1. "1 · Confirm it's you, once" / "Photograph your ID and take a quick selfie on our verification partner's secure screen. Usually done in under a minute."
    2. "2 · See every fine on your ID" / "Amount, issuer, due date and any discount, in plain words. No more hunting across municipal sites."
    3. "3 · Pay securely, get a receipt" / "You pay on our payment partner's secure checkout. We show "Paid" only once the issuer confirms it."
  - Signed out: button "Sign in to see your fines" → `/auth/sign-in?next=/fines/mine`, with "Free to check. You pay only the fine.".
  - Signed in: swap the drawing for the person's short list (max 3 rows: offence, issuer · place · date, amount, discount/due) and the heading "{n} fines on your ID." / "R {total} to settle.", button "See my fines". If not verified, the signed-out layout with "Confirm your ID" → `/fines/verify`.
- **For businesses** (`#business`):
  - Heading "Free to list." / grey "Paid directly.". Lede "Washes, workshops, glass fitters, tyre shops and mobile teams. Customers find you and send enquiries, and every payment goes straight to you."
  - Perks: "Free to list", "Checked by our team", "Enquiries to your inbox", "Add your team".
  - CTA "List your business free", small text "Free to list. Our team checks every business before it goes live."
  - Remove every "pilot", "R0" and "CarworX fee" line (B-12).
- **Dashboard glimpse** (B-08): replace the Requests/Payments dashboard markup with the static panel in `A2-landing/a2-3-for-businesses.html`: Overview/Enquiries/Team tabs; Listings (Live / In review badges); Enquiries (3 rows: initials, name, time, message); Finish setup "3 of 5" with a progress bar and the task names from `team/Hub.tsx` (Business details, Opening hours, Invite your team, Cover photo, Who gets the booking); People with access. Static, `aria-label="Business dashboard for Shine Studio: listings, enquiries, team and setup"`.

## 3. Category page (A3 · B-06)

**Change** `routes/c.$category.tsx` (and `sites/ListingCard.tsx`).

- Shell: SiteHeader/SiteFooter (§1).
- Hero: `.cx-cathero` with a breadcrumb "Home / Find a service / {Category}", `.keyobj` holding the service object, `<h1>` category label, one line per category:
  - wash: "Hand washes, valets, detailing and mobile teams that come to you."
  - repairs: "Services, brakes, diagnostics and call-out mechanics."
  - glass: "Chip repairs and windscreen replacement, at a workshop or at your door."
  - tyres: "Fitment, balancing and wheel alignment."
- LocationChip "{suburb}, {city}" with "Change" (opens `LocationPicker`).
- `.cx-filterbar`: "All" plus that category's sub-services (max 4) as chips, "Comes to you", "Open now", and the count "{n} businesses · nearest first".
- Grid `.cx-lgrid` of `ListingCard`, then "Show {n} more" (`.cx-btn secondary`).
- **ListingCard** (`sites/ListingCard.tsx`, also used by the landing, search and home rails): cover photo or the object on a tint (`t2`–`t4` by a hash of `public_id`); "Verified" badge; distance or "Comes to you"; name; Rating once B-23 ships ("★ 4.8 (126)", or "New · No reviews yet" when 0; before that, no rating row); area; services joined " · "; "Open until 18:00" / "Opens 08:00 tomorrow"; a "Mobile" badge. The whole card is one link.
- Empty state: "No {category short} businesses near {place} yet." / "We're adding businesses every week. Try a wider area, or look at a nearby town." / buttons "Search within 100 km" and "Change location".
- Remove "Cost to search R0".

## 4. Signed-in customer home (A4 · B-07, B-14)

**Change** `routes/home.tsx`: when the loader sees a signed-in customer, render a new `CustomerHome` component (create `apps/web/app/home/CustomerHome.tsx`) instead of the marketing landing. Signed-out visitors keep the landing.

- Top: LocationChip (chevron variant). Greeting "Good morning, {firstName}." (Good afternoon after 12:00, Good evening after 17:00, SAST) / steel "What does your car need?". Search pill with placeholder "Search washes, repairs, tyres or a business" and the button "Search".
- `.cx-svcrow`: Wash, Repairs, Glass, Tyres, Fines (→ `/c/...`, Fines → `/fines/mine`).
- Rows (`.cx-rowhead` + `.cx-rail`):
  - "Near you" / "Within 5 km of {suburb}" / "See all →"
  - FinesCard
  - "Comes to you" / "Mobile teams that work at your home or office"
  - "Recently viewed" / "Clear" (compact `rd-rcard` style: port as `.cx-rcard`; last 3 from `localStorage`, hidden if none)
  - A row with no results is hidden.
- FinesCard copy:
  - has fines: "{n} fines on your ID · R {total}" / "One has a discount until {date}. Checked today, {HH:mm} SAST." / "See my fines"
  - not verified: "Check your traffic fines" / "Confirm your ID once, then see and pay fines here." / "Get started"
  - in review: "We're checking your ID" / "See status"
- No location: "Where should we look?" / "Add a suburb or use your location to see businesses near you and the ones that come to you. We don't save your exact location." / "Use my location" / "Type a suburb", plus 4 `.ghost` cards under "Near you" / "Set a location to fill this row".

## 5. Sign in and sign up (A5 · B-10, B-11)

**Change** `auth/routes/sign-up.tsx`, `auth/routes/sign-in.tsx`, `auth/GoogleButton.tsx`, `auth/ui.tsx`; add a first-time Google consent step (new route `auth/google-consent` in `auth/routes.ts`, or a step inside `auth/routes/callback.tsx`).

- Layout: the shared shell, a left column (eyebrow "CarworX account", heading, 4 reasons: "Browse freely, no account needed", "Send enquiries and get replies by email", "Check and pay your traffic fines", "List your business for free"; hidden on phones) and the card on the right. Sign in / Sign up tabs at the top of the card.
- Sign up: heading "Make it yours." / "Free, in under a minute."; card title "Create your account"; fields "Full name", "Email", "Password" (placeholder "At least 10 characters"); consent "I agree to the Terms of use and have read the Privacy notice." (links `/terms`, `/privacy`).
- **ConsentGate** (logic done in B-10/B-11): restyle only. Disabled buttons use `.cx-btn[disabled]` / `.cx-gbtn[disabled]`; add the hint "Tick the box above to continue." while unticked (`aria-describedby`). Google button `.cx-gbtn`: G logo on the left, label centred.
- Sign in: heading "Welcome back." / "Pick up where you left off."; "Sign in with Google" first, then "or with email", Email, Password, "Forgot your password?", "Sign in", and "New to CarworX? Create an account".
- Google first-time consent (a Google account with no CarworX account yet, from either page): eyebrow "Step 2 of 2", title "Create your CarworX account", text "This Google account is new to CarworX. Agree to the terms to finish.", the Google account (name, email), the same consent box, "Create account", "Cancel, don't create an account", and "We use your name and email from Google. Nothing is posted to your Google account." No account is created before this step.

## 6. Fines (A6 · B-20, B-21, B-22, D-099, Didit Option A)

**Needs backend first.** Didit integration (B-21, Codex: sessions, signed webhook, storing only the result, the Didit session id and the last 4 digits), a `fines_verification` record with a tries count, and the payment partner (O-2). Build the UI against those. `routes/fines.tsx` becomes a redirect to `/#fines`; `routes/fines.mine.tsx` is rebuilt; add `routes/fines.verify.tsx` and `routes/fines.$id.tsx` (detail, pay, receipt states).

- **Verify intro** (`/fines/verify`):
  - Heading "Confirm it's you." / "Once, then your fines show here."
  - Text "Traffic fines are linked to your ID number, so we need to know it's really you before we show them. It takes about two minutes on your phone."
  - Steps:
    1. "Photograph your ID" / "Front of your smart ID card, the photo page of your green ID book, or your driver's licence card."
    2. "Take a quick selfie" / "A short video check that you're a real person, matched to the photo on your ID."
    3. "Come back here" / "Most checks finish in under a minute. Your fines appear straight after."
  - Document chips: "Smart ID card", "Green ID book", "Driver's licence".
  - Note "Your photos stay with our verification partner" / "Both steps happen on the secure screen of Didit, our verification partner. Didit checks the document, that you're really there, and that your face matches." Bullets: "CarworX never receives or stores your ID photo or selfie." · "We keep only the result (verified or not) and the last 4 digits of your ID number." · "Used only to find and pay your fines. Never shown to businesses."
  - Consent "I agree that Didit may check my ID and selfie for CarworX, and that CarworX may use the result to look up my traffic fines. Privacy notice". Button "Start verification" (disabled until ticked). Hint "Opens Didit's secure screen. On a computer, you can scan a code to continue on your phone."
- **Return/Checking** (Didit callback URL): `.cx-spin` + "Checking…" / "Thanks, {firstName}. This usually takes under a minute. You can leave this page; we'll email you when it's done." Steps: "ID photographed", "Selfie taken", "Didit is checking". Poll our own status endpoint; the webhook decides, never the redirect.
- **Approved:** "You're verified." / "Your ID ending {last4} is confirmed. We're looking up your fines now." / ok note "Done once, for good" "You won't need to do this again unless you change your ID number." / "See my fines".
- **Declined, tries left:** "We couldn't confirm your ID." / "Nothing is wrong with your account. It usually works on the next try." / err note "Why" + Didit's reason mapped to plain words (keep a mapping table in code) / `.cx-tries` "Try {used} of 3 used · {left} left" / "Try again", "Contact support".
- **No tries left:** "We couldn't confirm it after 3 tries." / "Our team will help you finish it another way." / last reason / "3 of 3 tries used" / "Contact support and we'll check it with you. Reference {VR-…}." / "Contact support", "Back to home".
- **In review:** "A person is checking it." / "Didit passed most checks but asked for a second look. Usually within one business day." Steps: "Photos taken on Didit", "Automatic checks" ("One needs a second look"), "Our team decides" ("We'll email you either way").
- **My fines:**
  - Head: badge "ID verified · ending {last4}" and "Last checked today, {HH:mm} SAST · Check again".
  - Stats: "To settle" R…, "Open fines" n, "Saving if paid by {date}" R….
  - One `.cx-fine` card per fine: offence; issuer · place · date; status badge "50% off to 2 Dec" (info) or "Due 13 Dec" (warn); amount, struck-through when discounted.
  - Group "Not payable here" / "These need you to contact the issuer", with muted cards and an err badge (e.g. "Court date set").
  - Footer "Fines come from the issuers' records through our payment partner. If something looks wrong, tell us."
- **None:** EmptyState "No fines on your ID." / "Nothing to pay right now. We check again each time you open this page, and we'll email you if a new fine appears." / "Back to home".
- **Only not payable:** warn note "{n} fine, but it can't be paid online." / "A summons has been issued, so it now goes through the court. Pay at the court or contact the issuer before the court date." plus a "What to do" card with two steps (issuer contact, court and date).
- **Detail:**
  - Rows: Issuer, Notice number, Type, When (SAST), Where, Vehicle, Speed, Demerit points.
  - Note "In plain words" (per fine type).
  - Pay box: "To pay", the amount, the struck-through amount, the discount badge, Fine / Partner fee / Total, "Pay R {amount}", hint "On our payment partner's secure checkout".
- **Pay:**
  - Heading "Pay R {amount}" / "On a secure checkout.". Handoff strip: CarworX → Payment partner ("Your fine" / "Secure checkout").
  - Fine and Total rows.
  - Note "What happens next": "We open our payment partner's checkout. You pay by card or instant EFT there; CarworX never sees your card." · "When you're done, you come back here." · "We mark the fine "Paid" only once the issuer confirms it, usually within 1 to 3 business days."
  - Buttons "Continue to secure checkout", "Cancel".
- **Awaiting issuer:** "Payment received. Waiting for {issuer}." / "Your payment went through. The issuer usually confirms within 1 to 3 business days." Steps: "You paid R …", "Payment partner confirmed" (reference), "{issuer} confirms the fine is settled". Note "Keep the partner reference until then. If {issuer} hasn't confirmed by {date}, we follow up for you." Settle only on the partner callback (B-22).
- **Receipt:** torn-edge card with a "PAID" stamp, "RECEIPT CWX-FN-… · {date, time} SAST", and rows (Paid by name · ID ending, Fine, Issuer, Notice number, Paid, Confirmed by issuer, Partner reference, Fine amount, Partner fee, Total paid). Buttons "Download PDF", "Email it to me", "Back to my fines →".
- Retire `server/fines` sandbox copy ("Staging sandbox", "Simulated checkout") from the UI (B-12).

## 7. Admin ID review (A7 · B-21)

**Create** `routes/admin.id-checks.tsx` and `routes/admin.id-checks.$id.tsx` (register in `auth/routes.ts` next to `admin/listings`), using `ui/admin/AdminShell.tsx`. Add "ID checks" (and "Reviews", §8) to the admin nav.

- Queue: heading "ID checks", text "Didit approves or declines most people automatically. These are the ones it sent to us for a second look. Oldest first.". Tabs "In review", "Approved", "Declined" with counts; "Target: within 1 business day". Table `.cx-qtable` with columns Person (initials, name, email · ID ••••{last4}), Didit result (warn badge "In review"), Why it needs a look, Document, Waiting (`.cx-age`, `.late` past the target), "Review". Footer "CarworX never holds the ID photo or selfie. To see them, open the session in Didit's console (logged there)." Phones: stacked cards.
- Detail: "Didit result" with `.cx-checkbar` rows (Document authentic, Liveness (real person), Face match to ID photo {n}%, Document readable), warn note "Warnings from Didit" (list), "Session {id} · attempt {n} of 3 · {HH:mm} SAST", "Open session in Didit ↗" (external link to Didit's console). Note "Photos and the selfie are only in Didit. Opening the session is logged there with your name." "What Didit read": Name on document, Account name, Document, ID number ••••••••• {last4}, Date of birth "Matches the ID number". Decision: "Approve" (`.cx-btn approve`), "or decline with a reason", reasons "Face doesn't match the ID photo" · "Document looks altered or not genuine" · "Name doesn't match the account" · "Other (write a note)", "Note to the person (optional)", "Decline and tell them why" (`.cx-btn danger`), "Declining uses one of their 3 tries." The decision writes an audit row (`admin.audit`).
- Empty: "Nothing waiting for review." / "Didit is handling everyone automatically right now. Cases it sends for a second look appear here; we email the team if one waits more than 4 hours." / "See approved IDs".

## 8. Reviews (A8 · B-23)

**Needs the Codex backend first (B-23)** (reviews table: one per customer per listing, eligibility = an enquiry from that customer to that listing; replies table with one per review; reports; moderation status). Then:

- `sites/ListingCard.tsx`: Rating (§3). **Until B-23 ships, leave the rating row out entirely** (no stars, no "New" chip); the A3/A4 mockups show stars only as the future state.
- `routes/p.$publicId.tsx`:
  - Header: rating under the name, "{n} reviews" linking to `#reviews`.
  - Reviews section `id="reviews"`:
    - ReviewSummary: average, stars, count, bars hidden under 3 reviews.
    - Note "Only customers who contacted this business through CarworX can review it." and "Write a review".
    - Sort chips "Most recent", "Highest", "Lowest", "With a reply".
    - ReviewItems, then "Show more reviews".
  - Empty: "No reviews yet." / "{Business} is new on CarworX. Customers who send them a message can leave the first review." / "Send a message".
- Write a review: new `routes/p.$publicId.review.tsx`.
  - Heading "How was {Business}?" / "You messaged them on {date}. Your review shows your first name and initial."
  - Fields: "Your rating" (star picker plus a word: Poor, Fair, Okay, Good, Great); "Which service? (optional)"; "Your review" ("Say what happened, not who. 20 to 1 000 characters · {n} used.").
  - Note "One review per business. You can edit it later; we show "Edited" and the date." Button "Post review".
  - Not eligible: "Message them first." / "Only customers who contacted {Business} through CarworX can review it. That keeps reviews from real customers." / "Send a message", "Back to {Business}".
- Owner reply: `routes/provider.tsx`, a new "Reviews" section (or `routes/provider.reviews.tsx`).
  - Heading "Reviews" / "One public reply per review. Keep it short and polite; customers read replies as much as reviews."
  - Tabs "Needs a reply", "All".
  - Reply box "Your public reply" / "Shows as "Reply from {Business}". You can edit it, not add a second one." / "Post reply", "Cancel"; "Edit reply" on replied ones.
- Report: `<dialog class="cx-dialog">` "Report this review" / "Our team checks every report. The reviewer isn't told who reported it." Reasons: "Not about a real visit or enquiry", "Rude, hateful or threatening", "Shares personal details", "Spam or advertising", "Something else" (note required). "Anything else? (optional)", "Send report", "Cancel".
- Admin moderation: new `routes/admin.reviews.tsx`.
  - Heading "Reported reviews" / "Hide a review only when it breaks the rules. A low rating alone is never a reason."
  - Tabs "Reported", "Hidden", "Kept".
  - List rows: "{Reviewer} → {Business}", "{reason} · reported by {Business owner|Customer}", stars, age.
  - Detail: the review, "Enquiry on record" (Yes · date / No), "Reported by", "Reason given", "Other reviews by {name}", a hint note, "Reason for your decision" (required), "Keep review", "Hide review", and "Both sides get an email with your reason. Hidden reviews don't count in the rating."

---

## Order and checks

1. The shell first (§1, B-02/B-03/B-04), then A2–A4 (B-06/B-07/B-08/B-12/B-20), then the A5 restyle. A6/A7 wait for the Didit backend (B-21) and the partner (B-22); A8 waits for the B-23 backend.
2. Keep every string above. If a string must change, list it in the PR for owner sign-off (B-12).
3. Each screen at 390 and 1280: compare with `A#/png/`. Run the existing contrast check (`pnpm --filter web contrast`) after adding `--rating`.
4. Times always in SAST. Synthetic data only in tests and fixtures.
