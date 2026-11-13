# Future features

Ideas the owner wants **later**, not in the current release. Each entry says why it waits, what it depends on, and what it would take. Moving an entry into a plan needs the owner's go-ahead.

| ID | Feature | Status | Added |
|---|---|---|---|
| F-01 | Upload a price list (photo or PDF) to auto-fill a listing | Deferred until after the directory launch (D-094) | 2026-11-13 (SAST) |
| F-02 | "Pay later" (B4 deferred payment) | Deferred from the first booking build | D-031, PLAN §7 |
| F-03 | Integrated traffic-fines lookup | Waits on its own gate (G-FINES) and partner outreach | D-003, D-013 |
| F-04 | WhatsApp and SMS notifications | Out of v1: email plus in-app first | D-014, PLAN §2 |
| F-05 | Bulk import of business listings | Deferred: consent-based applications first | D-023, PLAN §2 |
| F-06 | Native iPhone and Android apps | Out of v1: the installable web app (PWA) comes first | D-006, PLAN §2 |
| F-07 | More languages (e.g. Afrikaans, isiZulu) | Out of v1: English only | PLAN §2 |
| F-08 | Provider Pro subscription (about R149–R199 a month) | Second revenue test, after 3 months of commission | D-055, PLAN §17 |
| F-09 | Sponsored provider card | Once an area's traffic is proven; needs G-REVENUE | D-029, D-056 |
| F-10 | Fleet and small-business test | After launch | D-056, PLAN §17 |
| F-11 | Brand sponsors on guides and in the newsletter | Later revenue test | D-056, PLAN §17 |
| F-12 | Insurer claims and roadside dispatch | Out of v1 scope | PLAN §2 |
| F-13 | Customer wallets or escrow | Out of v1: Paystack direct split instead | D-012, PLAN §2 |

## Not pursued (owner said no)

These are recorded so they aren't re-proposed by mistake: affiliate links ("I don't want us to milk our users"), Google or programmatic ads, customer booking fees or memberships, lead fees and credits, acquisition fees (D-056, PLAN §17). **Never:** selling personal data, pay-to-verify badges, or ads on sensitive flows or in transactional email.

## F-01 · Upload a price list to auto-fill a listing

**Idea (owner, 2026-11-13):** a business takes a photo of its price list or uploads a PDF, and CarworX pre-fills its services, prices and opening hours, so getting listed is faster.

**Why later:** at launch, provider sign-up works by hand (a few services plus the per-day hours). This feature is the first with a running cost: a paid AI call per upload, which needs the G-AUTO spending gate. Prices only matter once bookings (Phase 3) are live.

**Depends on:** per-day opening hours (being built now); Phase 3 `service_offers` for prices; an owner decision on the AI provider, its API key and a monthly spending cap (G-AUTO).

### How it would work

1. The provider uploads a photo (HEIC is converted in the browser) or a PDF: at most 10 MB, 10 pages and about 5 uploads a day per business. Signed-in providers only, with Turnstile.
2. The Worker stores the file in **private** storage with a 7-day expiry.
3. A vision AI model (e.g. Claude, which reads images and PDFs directly) fills a **fixed schema**: `services[] {name, price, price_to?, duration?}`, `hours[] {day, opens, closes}` and `notes`. Anything that doesn't match the schema is rejected.
4. Every field is validated. Service names are matched to our service list, with a confidence level shown; unknown items are flagged. Prices are stored in cents (ZAR), and "from" prices or ranges are kept as ranges and flagged. "Mon–Fri 8–5" is expanded per day.
5. A **review screen** pre-fills the onboarding form. Each field is marked "from your upload, please check" and is editable. **Nothing is published until the provider confirms.**

### Risks and controls

| Risk | Control |
|---|---|
| Misread values | No auto-publish; low-confidence fields highlighted; the provider confirms |
| Prompt injection hidden in the document | The upload is treated as data only; schema-only output; the provider still reviews |
| POPIA (faces, number plates, phone numbers in photos) | Private storage, deleted within 7 days. The AI provider acts as an operator under its DPA; a section 72 transfer assessment for a US provider; a privacy-notice update |
| Cost and abuse | Per-business daily limits, page and size caps, sign-in plus Turnstile, and a monthly spending cap |

### Effort

About 1–1.5 weeks of build and test: the upload screen, private storage, the extraction call, validation, the review screen and tests. Owner items: the AI provider choice, API key and spending cap, plus approval of the privacy-notice line and the s72 assessment.

**Suggested first version:** hours and services only. Add prices when Phase 3 bookings go live.

## F-02 to F-13 in brief

- **F-02 Pay later (B4):** when used, a CarworX "payment due" action rechecks the quote, capacity, price and status, then starts the normal hosted split payment. It's exposure reduction, not funding; the refund and chargeback reserve (D-050) is still required.
- **F-03 Fines lookup:** launch keeps labelled official referrals and never collects ID numbers. An integrated lookup needs partner terms (candidates: EasyPay, Syntell/PayCity, Fines SA), owner-approved outreach and its own gate. "No results" must never be shown as "no fines".
- **F-04 WhatsApp/SMS:** each channel adds cost, consent records and template approval. It would go through the same outbox as email.
- **F-05 Bulk import:** importing businesses without their consent would break D-023. A future import needs provenance, consent and claim flows.
- **F-06 Native apps:** the PWA covers v1; native apps only if push notifications or app-store reach prove necessary.
- **F-07 Languages:** needs translated legal texts (POPIA notices) as well as the interface.
- **F-08 to F-11 Revenue tests:** each needs its own G-REVENUE approval (payer, price, refunds, stop criteria), in the order of PLAN §17.
- **F-12 and F-13:** out of v1 scope. Revisit only with a separate plan and gate.
