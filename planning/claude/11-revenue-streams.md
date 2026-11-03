# Claude — 11: Revenue streams, discussed with the owner

Date: 2026-11-03. Written in a side session started by the master session. It builds on [revenue-streams.md](../research/revenue-streams.md) (Codex, 2026-10-27) and [PLAN](../PLAN.md) §7 and §17.

**Status: PROPOSAL.** This file records the owner's answers from a multiple-choice discussion on 2026-11-03, and recommends a testing order.
- It is **not a decision**. The master session records decisions and assigns the D-numbers.
- **Nothing is activated.** The pilot stays free (D-002, Q-007), and every charge still needs its own G-REVENUE approval (PLAN §18).
- No accounts, outreach, spending, billing code or tracking were created.
- Codex reviews it, as the owner asked ("codex will review").

## 1. Fixed points this builds on

| Source | What it fixes |
|---|---|
| D-002, Q-007 | Validate before charging; the pilot's platform fee is zero |
| PLAN §17, D-031 | A test order of hypotheses; rules for when a fee is earned and when it is collected; `fee_policy_version` + `fee_basis = 'none'` + `platform_fee_amount_minor = 0` in v1 |
| D-029 | Ads: at most one labelled sponsored card per results page and one public-page banner; none on sensitive flows; manual and contextual first |
| D-046 | Recruitment starts with servicing and repairs |
| D-048 | The provider pays the card fee, fully disclosed ("you receive Rx") |
| D-049 | The company is registered before live payments; until then, Paystack test mode only |
| D-050 | Refunds are funded by a reserve plus recovery from future payouts |
| D-051 | Price-list services book and pay now; other services go enquiry → price range → in-person quote → pay in the app |
| §17 "Never" | No selling of personal data, no pay-to-verify badges, no ads on sensitive flows or in transactional email, no regulated financial referrals without licensed partners |

## 2. The owner's answers (2026-11-03)

Answers chosen from the multiple-choice options are quoted by the option's label. The owner's own typed words are quoted exactly.

| # | Question (short) | Owner's answer, 2026-11-03 |
|---|---|---|
| A1 | How CarworX earns from a paid booking | "% of every booking" |
| A2 | Rate for the first test | "10%" |
| A3 | Fee on big repair quotes | "Cap per job" |
| A4 | Cap amount | "R500" |
| A5 | How providers see the fee | "Separate lines" ("Customer pays R1,200 · Card fee R41 · CarworX fee R120 · You receive R1,039") |
| A6 | Enquiries that may end in cash, outside the app | "Charge only on in-app payment" (no lead fees) |
| A7 | Provider Pro | "Yes, around R149–R199/month" |
| A8 | Pro next to the commission | "Separate; same 10%" |
| A9 | Pro tools and free tools | Picked all four (bay and staff calendar, service reminders, quotes and job cards, business reports) and wrote: "users should be able to have some of these features that won't cost us too much at first, then after we establish the subscription some features that were free, not all, will move to the subscription to create that sense of them missing what thewerng [sic] and we add new features and more analytics" |
| A10 | How providers are told about the move to Pro | "Label them from day one" ("Pro preview: free during the pilot", and 30 days' notice before the switch) |
| A11 | Free forever | "Basic quote and invoice", "This month's earnings summary", "A few reminders per month" (not chosen: "Basic bay and staff setup"; see §6.3) |
| A12 | Sponsored provider card | "Test once traffic is proven" |
| A13 | Fleet and small-business accounts | "Small test after launch" |
| A14 | Affiliates | First answer: "just curious who would be paying us here, I don't want us to milk our users" and "None". Asked again once it was explained that the partner pays, not the user: "Keep none" |
| A15 | Advertising kept for later | "Brand sponsors on guides", "Sponsored newsletter slots" (not chosen: Google ads on guide pages) |
| A16 | Should customers pay CarworX? | "No, providers pay" |
| A17 | What must be true before the first paid test | "this: Proof plus company plus G-PAY" (company registered, G-PAY passed, plus pilot proof such as 100+ completed jobs, providers interviewed about the fee, and repeat customers), and added: "but to clarify, by G-pay you mean google pay, and what if people or businesses use iPhones instead? let's stick with paystack as our live and test payment method as discussed" |
| A18 | A deal for founding providers | "3 months free after charging" |
| A19 | Stop rules | "Clear numbers" |
| A20 | Extra ideas (parts deals, booking button, paid set-up help) | "not sure, you decide, codex will review" |

**Answer given in the discussion to A17:** G-PAY is not Google Pay. It is this plan's name for the go-live checkpoint for real payments (PLAN §18). **Paystack stays the payment method for both test and live** (D-012). Its hosted checkout is a web page, so it works the same on iPhone, Android and desktop. Nobody needs Google Pay or Apple Pay. *Suggestion for the master session:* add a plain-language name next to the gate code (for example "G-PAY, the live-payments gate") wherever owners read it.

## 3. Prices found (South Africa, researched 2026-11-03)

Prices labelled **UNVERIFIED** come from third parties, are undated or old, or are my own arithmetic. None of them is a CarworX price or a forecast.

| Item | Price point | Source | Confidence |
|---|---|---|---|
| Paystack local card fee | 2.9% + R1, excl. VAT (R1 waived under R10); EFT 2%; international cards 3.1% + R1 | [Paystack ZA pricing](https://paystack.com/za/pricing), [support article](https://support.paystack.com/hc/en-us/articles/360009881920) | Official |
| Paystack flat split | A flat `transaction_charge` can override a subaccount's percentage split for one transaction; `bearer` sets who pays Paystack's fee | [Split payments](https://paystack.com/docs/payments/split-payments/), [Transaction API](https://paystack.com/docs/api/transaction/) | Official, but the pages disagree on which side the flat amount goes to. **Confirm in test mode** |
| Take rate: SweepSouth (cleaning) | Keeps 4–20% of the booking | [SweepSouth help centre](https://help.sweepsouth.com/hc/en-us/articles/14772014563986-SweepStar-Earnings-Explained) | Company's own page |
| Take rate: food delivery | Mr D ~22% average, Uber Eats up to 30% | [Briefly](https://briefly.co.za/101760-business-news-reports-say-restaurants-charge-30-extra-through-uber-eats-mr-d.html), [TechCentral](https://techcentral.co.za/compcom-takes-aim-at-uber-eats-mr-d-food/229187/) | Press. **UNVERIFIED** by the companies |
| Michanic (SA mechanic marketplace) | Free onboarding, commission on accepted jobs (rate not published); sells a fleet product | [Michanic](https://www.michanic.co.za/?p=13), [Michanic fleet](https://www.michanic.co.za/fleet/) | Company claims; rate unknown |
| Minor service, independent workshop | Roughly R500–R1,300 | [Michanic guide](https://www.michanic.co.za/?p=16327), [Pineapple](https://pineapple.co.za/post/mastering-car-maintenance-in-south-africa/), [Durban mobile mechanic 2026](https://mobilemechanicdurban.pages.dev/blog/car-service-cost-durban-2026) | **UNVERIFIED** (marketing blogs, mostly undated) |
| Lead fees: Bark ZA | R14.50 per credit, excl. VAT; 3 to 20+ credits per lead ≈ R43–R290 per lead | [Bark help centre (ZA)](https://help.bark.com/hc/en-za/articles/13346288068892-What-is-a-credit-and-how-much-does-it-cost) | Credit price official; per-lead range is my arithmetic |
| Booking software: Booksy ZA | R399/month + R89 per extra staff member | [Booksy ZA pricing](https://biz.booksy.com/en-za/pricing) | Official |
| Workshop software | Workshop Software from ~US$119/month; Smart Workshop US$9/month | [Capterra ZA](https://www.capterra.co.za/software/131987/workshop-software-online), [TrustRadius](https://www.trustradius.com/products/smart-workshop/reviews) | Aggregator listings, USD |
| Fleet tracking (a different product, for scale) | Government contract R99–R238 per vehicle per month (2026); market estimate R250–R1,900 | [Treasury RT46 amendment 6](https://www.treasury.gov.za/divisions/ocpo/ostb/contracts/Amendment%206%20RT46-2020%20Price%20Adjustment%20for%20period%201%20April%202026.pdf), [Procompare](https://www.procompare.co.za/prices/vehicle-tracking/fleet-management) | Treasury official; Procompare **UNVERIFIED** |
| Paid listing boosts: Gumtree | Bump-ups R699–R1,299/month (via a partner page) | [Prop Data](https://knowledge.propdata.net/prop-data-partners-with-gumtree) | **UNVERIFIED**, likely out of date |
| Google ads (AdSense) in SA | ~US$0.50–2 per 1,000 page views | [Ranktracker](https://ranktracker.com/blog/comparing-adsense-rpm-in-high-income-vs-low-income-regions) | **UNVERIFIED** third-party estimate |
| VAT registration | Compulsory threshold R2.3m of taxable supplies in 12 months from 1 April 2026 (was R1m); voluntary R120,000 | [SARS FAQ](https://www.sars.gov.za/faq/what-is-the-new-threshold-for-vat-registration/), [KPMG](https://kpmg.com/us/en/taxnewsflash/news/2026/02/south-africa-increases-vat-registration-thresholds-carbon-taxes.html) | Official. Check the final amending Act |

## 4. Worked examples (owner's choices: 10%, R500 cap, provider pays the card fee)

Card fee = (2.9% + R1) + 15% VAT. CarworX's fee is shown before any VAT on it (see §8).

| Job | Customer pays | Card fee (incl. VAT) | CarworX fee | Provider receives | All fees as % of job |
|---|---|---|---|---|---|
| Wash (price list) | R150 | R6.15 | R15.00 | R128.85 | 14.1% |
| Minor service | R1,200 | R41.17 | R120.00 | R1,038.83 | 13.4% |
| Repair at the cap | R5,000 | R167.90 | R500.00 | R4,332.10 | 13.4% |
| Big repair | R8,000 | R267.95 | R500.00 (cap; 10% would be R800) | R7,232.05 | 9.6% |

What the provider sees (A5): "Customer pays R1,200 · Card fee R41.17 · CarworX fee R120.00 · You receive R1,038.83".

## 5. Stream by stream

Each stream covers what it is, who pays, SA price points, what it needs built, the earliest start and the risks.

### 5.1 Commission on paid bookings: **CHOSEN for the first test**
- **What it is:** CarworX keeps 10% of each booking paid in the app, capped at R500 per job (A1–A4).
- **Who pays:** the provider, through the Paystack split. Customers never pay CarworX (A16).
- **SA price points:** SweepSouth 4–20%; food delivery 22–30% (UNVERIFIED); Michanic charges commission at an unpublished rate. At 10% with a cap, CarworX sits at the low end.
- **What it needs built:**
  - The server works out `min(10% × amount, R500)` at checkout and passes it as the flat split (Paystack `transaction_charge`), with `bearer` on the provider (D-048). Which side the flat amount goes to must be proven in test mode.
  - Quote and payment snapshots record the fee policy version and basis (the v1 fields in D-031), plus the CarworX fee and the card fee as separate lines (A5).
  - Rules for when a fee is earned, collected and reversed (PLAN §17). **Proposal:** a full refund reverses the CarworX fee; a partial refund reverses it pro rata. Under D-050, a provider's recovery covers only the provider's share. Whether Paystack returns its own fee on a refund is **UNVERIFIED**; confirm at G-PAY.
  - Reporting that keeps booked value, completed net value, fees billed, fees reversed and collected revenue apart (PLAN §17).
- **Earliest start:** after the entry criteria in §7. Founding providers then get 3 more months free (A18).
- **Risks:**
  - Providers take repair jobs offline after the in-person assessment (leakage). Answered by A6: no lead fee; make paying in the app worth it (refund handling, payment records, reviews from paid jobs) and measure how many enquiries never return.
  - The cap gives up income on big jobs; that was the trade the owner chose.
  - The fee only becomes real after company registration and G-PAY.

### 5.2 Card fee paid by the provider (D-048): **already decided**
- **What it is:** Paystack's fee of 2.9% + R1 plus VAT, borne by the provider and disclosed.
- **Who pays:** the provider.
- **SA price points:** official Paystack ZA pricing, listed above.
- **What it needs built:** `bearer` set on the subaccount, and the display line from A5.
- **Earliest start:** from G-PAY. It applies in the free pilot too, because it is Paystack's charge and not CarworX revenue.
- **Risks:** the card fee is not CarworX income and must never be reported as revenue. On small washes, fees take a larger share (14.1% in §4).

### 5.3 Provider Pro subscription: **CHOSEN, second test**
- **What it is:** optional paid tools at **R149–R199/month** (A7), separate from the commission, so everyone pays the same 10% (A8). It buys software, never ranking, verification or immunity from reviews.
- **Who pays:** the provider, monthly.
- **SA price points:** Booksy R399/month + R89 per extra staff member (official); workshop software from ~US$119/month; Smart Workshop US$9/month. R149–R199 sits below Booksy.
- **Owner's model (A9, A10, A11):** tools start free; once the subscription is established, some of them (not all) move to Pro, and new features and analytics are added. Tools that will move carry a **"Pro preview: free during the pilot"** label from day one, with 30 days' notice before the switch.

  | Stays free forever (A11) | Moves to Pro (proposal, Codex to review) |
  |---|---|
  | Basic quote and invoice (the quote-then-pay flow in D-051 depends on it) | Saved quote templates, branded job cards |
  | This month's earnings summary | Trends, repeat-customer and service analytics, exports |
  | A few service reminders per month (proposal: 20) | Unlimited reminders |
  | **One default bay or diary** (see §6.3) | Multi-bay planning, staff rosters |

- **What it needs built:** the tools themselves, and the "Pro preview" labels. Billing comes later: monthly charging needs a recurring payment (Paystack subscriptions or invoicing), and subscriptions are out of v1 scope (PLAN §2), so billing waits for its own G-REVENUE approval.
- **Earliest start for charging:** after the commission test has run for 3 months without tripping a stop rule (proposal), and once providers actually use the preview tools.
- **Risks:**
  - Moving free tools behind a paywall feels like bait-and-switch unless labelled. The owner chose labelling. Many small workshops may count as consumers under the CPA (juristic persons below its turnover threshold), so changing terms needs notice; the agents check the exact CPA sections under D-045.
  - Reminder emails use Resend's shared free quota (3,000/month, 100/day), so a free cap protects sign-in email.

### 5.4 Sponsored provider card (D-029): **CHOSEN, once traffic is proven**
- **What it is:** one card labelled "Sponsored" per results page. It shows only if the provider matches the area and service searched.
- **Who pays:** the provider, a monthly fee per area and category, invoiced by hand at first.
- **SA price points:** hypothesis R300–R1,000/month; Gumtree bump-ups were R699–R1,299/month (UNVERIFIED, old).
- **What it needs built:** inside its own experiment, not before (D-031): eligibility, scope, label, dates, suspension and reporting from first-party counts only.
- **Earliest start:** once an area and category has steady search traffic. **Proposal:** about 300+ searches a month for that area and category, measured over two months (a number for Codex to challenge).
- **Risks:** a paid card must never outrank relevance rules or touch ratings or verification; delivery reports must not overstate value (no CPM sold on render counts, per D-029).

### 5.5 Fleet and small-business accounts: **CHOSEN, small test after launch**
- **What it is:** one account for many vehicles, with service reminders, records, approvals and one monthly statement (A13).
- **Who pays:** the business pays normal bookings (the provider still pays the 10%). A per-vehicle tools fee comes only if fleets value the tools.
- **SA price points:** hypothesis R49–R99 per vehicle per month for tools. For scale, government tracking contracts run R99–R238 per vehicle per month (a different product). Michanic already sells fleet maintenance.
- **What it needs built:** multi-user business accounts (tenant permissions), vehicle lists, a statement view. There is no fines dependency (D-031).
- **Earliest start:** after the public launch, once servicing works; approach 3–5 small fleets (owner-authorised outreach only).
- **Risks:** invoicing and reconciliation work; pressure to offer credit terms or SLAs, which must not be implied; a competitor already exists.

### 5.6 Brand sponsors on guides and sponsored newsletter slots: **KEPT FOR LATER**
- **What it is:** a car-care or tyre brand sponsors a useful guide or section (A15), clearly labelled; or a sponsor line in an opt-in newsletter.
- **Who pays:** the brand.
- **SA price points:** none found; no audience exists yet to price against.
- **What it needs built:** static approved creative on public guide pages only. The newsletter needs marketing consent and unsubscribe (POPIA s69; Information Regulator guidance) and never mixes with transactional email (§17).
- **Earliest start:** once guides have real readers, and a newsletter has opted-in subscribers.
- **Risks:** editorial independence, substantiated claims (ARB Code) and direct-marketing consent.

### 5.7 Not pursued (owner's answers)

| Stream | Why it's out | Answer |
|---|---|---|
| Affiliates (car-care products, admin services, towing) | The partner pays from its own margin, so the user's price doesn't change; the owner still declined: "I don't want us to milk our users" | A14 |
| Google ads on guide pages | Not chosen. SA earnings are thin: ~US$0.50–2 per 1,000 views (UNVERIFIED) | A15 |
| Customer booking fee or membership | "No, providers pay" | A16 |
| Lead fees per enquiry | "Charge only on in-app payment" | A6 |
| First-booking (acquisition) fee | Commission chosen instead; never stacked with it (PLAN §17) | A1 |

### 5.8 Extra ideas, decided by Claude for Codex review (A20)
- **Booking button for providers' own sites or WhatsApp: KEEP**, free. It is a growth tool more than revenue: it brings bookings into the app (and so under the 10%) and reduces leakage. Pro could later add customisation.
- **Parts-supplier deals: KEEP AS A LATE HYPOTHESIS.** A supplier pays for introductions to CarworX providers, with discounts going to providers. It is provider-side only and must not raise drivers' prices, affect ranking or use customer data. It sits close to the affiliate model the owner declined, so it needs the owner's explicit approval before any test.
- **Paid listing set-up help: DROP.** It looks too close to paying to be listed or verified (§17 "Never"), and earns little.

## 6. Points to settle

1. **Paystack flat split.** Prove in test mode that `transaction_charge` sends the capped fee to CarworX's main account while `bearer` keeps the card fee on the provider. The docs disagree.
2. **Refunds and the fee.** Proposal: reverse the CarworX fee in full on a full refund and pro rata on a partial one. Find out what Paystack does with its own fee on refunds (UNVERIFIED).
3. **Bay and staff setup.** The owner did not pick "Basic bay and staff setup" as free forever. Booking capacity runs on resources (PLAN §6.3), so a provider needs at least one bay or diary to take bookings at all. **Proposal:** one default resource stays free; multi-bay planning and staff rosters become Pro. The owner confirms.
4. **Founding providers and the test.** If most providers are founding providers, the commission is first paid 3 months after charging starts. Read the test in two parts: new providers from day one, and founding providers when their free months end.
5. **Gate naming.** Owners can misread "G-PAY" as Google Pay (A17); see §2.

## 7. Recommended testing order

Each step needs its own G-REVENUE approval: payer, price, terms and stop criteria (PLAN §18).

| Step | Test | Entry criteria | Stop or rethink if |
|---|---|---|---|
| 0 | **Free pilot with live payments at 0%** | Company registered (D-049) and G-PAY passed | — (this is where the proof is collected) |
| 1 | **Commission: 10%, capped at R500**; founding providers free for 3 more months | The owner's A17 criteria: company and G-PAY, plus proof from step 0. **Proposed numbers:** 100+ completed paid jobs from 10+ providers; 10+ providers interviewed about the fee; repeat bookings seen (for example 15%+ of customers booking twice) | Within 3 months (A19): more than 20% of active providers leave; or jobs paid in the app fall by more than 25% against the step-0 baseline; or fee complaints climb (proposal: more than 10% of support tickets) |
| 2 | **Provider Pro charging, R149–R199/month** ("Pro preview" labels since launch) | Step 1 ran 3 months without a stop; preview tools in regular use (proposal: 20%+ of active providers use one weekly) | Fewer than 5% of active providers subscribe within 2 months, or providers leave over it |
| 3 | **Sponsored provider card**, R300–R1,000/month hypothesis | An area and category with steady searches (proposal: 300+ a month for 2 months) | Search completion or bookings in that area fall, or complaints about ranking |
| 4 | **Fleet small test** (3–5 fleets) | Public launch, servicing works, owner authorises outreach | Support load per fleet outweighs its bookings; nobody values the tools |
| 5 | **Brand sponsors on guides, newsletter slots** | Guides have real readers; opted-in newsletter list | Reader complaints; claims that can't be substantiated |
| Later | Parts-supplier deals (needs explicit owner approval) | Steps 1–3 stable | — |

Steps 3 and 4 can run alongside step 2. The order reflects the owner's answers; Codex reviews the proposed numbers.

## 8. For the accounting review (D-047)

The agents research these and the owner's accountant colleague reviews them:
1. **VAT on CarworX's fee.** Registration is compulsory once taxable supplies pass R2.3m in 12 months (from 1 April 2026), and voluntary from R120,000. Should CarworX register voluntarily, and are the fees in §4 then VAT-inclusive or VAT on top?
2. **Principal or agent.** CarworX's revenue should be the fee only, not the booking value (PLAN §17). Confirm the treatment for the Paystack split.
3. **Fee reversals, founding free months and the reserve** (D-050): how each is recorded.
4. **The Pro subscription**: VAT and the timing of recognition for monthly fees.

## 9. What this file does not do

It assigns no D-numbers and edits no other file. It approves no price, charge, account, outreach or spending. It changes nothing in v1 scope: PLAN §2 still excludes subscriptions, sponsorship data, affiliate tracking and lead credits until their experiments are approved.
