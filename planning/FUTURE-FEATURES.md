# Future features

Ideas the owner wants **later**, not in the current release. Each entry says why it waits, what it depends on, and what it would take. Moving an entry into a plan needs the owner's go-ahead.

| ID | Feature | Status | Added |
|---|---|---|---|
| F-01 | Upload a price list (photo or PDF) to auto-fill a listing | Deferred until after the directory launch (D-094) | 2026-11-13 (SAST) |

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
