# Legal drafts for the free site (D-045, G-PROD)

> **Draft for owner approval.** Written by Claude on 2026-11-10 (SAST). **Not legal advice** (D-045: no attorney; the owner accepts that risk). Codex reviews later. Nothing here is published until the owner approves it.

| # | Draft | Closes (G-PROD) | Owner action |
|---|---|---|---|
| 1 | [Privacy notice](privacy-notice.md) | "privacy notice … for the free site" | Approve; fill the bracketed details |
| 2 | [Terms of use](terms-free-site.md) | "terms for the free site" | Approve |
| 3 | [Retention schedule](retention-schedule.md) | "retention schedule approved (§9.3)" (D-053) | Approve; accountant colleague notes the financial row |
| 4 | [Section 72 cross-border assessment](s72-cross-border.md) | "section 72 assessment" | Approve |
| 5 | [Probing residual-risk assessment](probing-risk.md) | PLAN §6.2 "obtain approval of the mitigation before G-PROD" | Accept in writing |
| 6 | [Incident plan](incident-plan.md) | "incident plan" (PLAN §9.4) | Approve |

## How these were written

- Every legal statement cites a **section** of the primary text, read on the date shown below. Nothing is cited from memory.
- Where the law or the facts weren't clear, the draft says so and raises an **owner question** (OQ-L…) instead of guessing. They're collected at the end of this file.
- Plain language, as CPA section 22 asks for consumer-facing notices.

## Primary sources read

All read on **2026-11-10**. Gazette scans of older Acts don't show later amendments; where that matters, an owner question says so.

| Short name | Text | URL |
|---|---|---|
| POPIA | Protection of Personal Information Act 4 of 2013, Government Gazette 37067, 26 November 2013 | <https://www.gov.za/sites/default/files/gcis_document/201409/3706726-11act4of2013protectionofpersonalinforcorrect.pdf> |
| IO guidance | Information Regulator, *Guidance Note on Information Officers and Deputy Information Officers*, 1 April 2021 | <https://inforegulator.org.za/wp-content/uploads/2020/07/InfoRegSA-GuidanceNote-IO-DIO-20210401.pdf> |
| eServices | Information Regulator eServices, Information Officers page | <https://eservices.inforegulator.org.za/officers/default.aspx> |
| Breach fact sheet | Information Regulator, *Fact Sheet on handling of Security Compromises* (August 2025) | <https://inforegulator.org.za/wp-content/uploads/2025/08/Fact-Sheet-on-security-compromises-2.pdf> |
| Breach portal notice | Information Regulator media statement, 7 April 2025: portal reporting mandatory from 1 April 2025 | <https://inforegulator.org.za/wp-content/uploads/2025/04/MEDIA-STATEMENT-INVITATION-TO-REPORT-SECURITY-COMPROMISES-THROUGH-THE-eSERVICES-PORTAL-.pdf> |
| Breach steps | Information Regulator, *Reporting of Security Compromises: Step-by-Step Guide* | <https://www.inforegulator.org.za/wp-content/uploads/2025/05/stepbystepguide.pdf> |
| Regulator update | Information Regulator media briefing, November 2025 (amended POPIA Regulations in force 17 April 2025) | <https://inforegulator.org.za/wp-content/uploads/2025/11/MEDIA-STATEMENT_INFORMATION-REGULATORS-LATEST-UPDATE-Journalist-ver.pdf> |
| CPA | Consumer Protection Act 68 of 2008, Government Gazette 32186 | <https://www.gov.za/sites/default/files/32186_467.pdf> |
| ECTA | Electronic Communications and Transactions Act 25 of 2002, Government Gazette 23708, 2 August 2002 | <https://www.gov.za/sites/default/files/gcis_document/201409/a25-02.pdf> |
| ECTA amendment note | gov.za page for ECTA: "Amended by Cybercrimes Act 19 of 2020" and "Amended by Consumer Protection Act 68 of 2008"; consolidated text on SAFLII "[Updated to 1 December 2021]" (not read) | <https://www.gov.za/documents/electronic-communications-and-transactions-act> |
| TAA | Tax Administration Act 28 of 2011, Government Gazette 35491, 4 July 2012 | <https://www.gov.za/sites/default/files/gcis_document/201409/a282011.pdf> |
| Prescription Act | Prescription Act 68 of 1969 (Department of Justice consolidated text) | <https://justice.gov.za/legislation/acts/1969-068.pdf> |

Vendor facts used in the section 72 assessment and the privacy notice, also read 2026-11-10: [Supabase regions](https://supabase.com/docs/guides/platform/regions), [Supabase DPA](https://supabase.com/legal/dpa), [Cloudflare customer DPA](https://www.cloudflare.com/cloudflare-customer-dpa/), [Resend regions](https://resend.com/docs/dashboard/domains/regions), [Resend sub-processors](https://resend.com/legal/subprocessors), [Mapbox DPA](https://www.mapbox.com/legal/dpa), [Turnstile get started](https://developers.cloudflare.com/turnstile/get-started/).

## Owner questions

| ID | Question | Why it matters | Drafts affected |
|---|---|---|---|
| **OQ-L1** | **Who is the responsible party before the company is registered (D-049)?** POPIA defines a private body as including "a natural person who carries or has carried on any trade, business or profession" (s1, "private body"). Until CIPC registration that's probably you personally, trading as CarworX, with your cofounders. The eServices form asks for an organisation's "registered name, registration number". Please confirm how you'll register. | Names the responsible party in the notice and on the Information Officer registration | 1, 2, 6, guide 13 |
| **OQ-L2** | The business **physical address, phone and email** to publish. ECTA s43(1)(b), (c) and (g) require them on the website for anything offered by electronic transaction; POPIA s18(1)(b) requires the "name and address of the responsible party" | Can't publish without them | 1, 2 |
| **OQ-L3** | **The amended POPIA Regulations (in force 17 April 2025)** weren't available as text from the sources read. The Regulator says they add duties on objections and direct marketing. Agents should read the gazetted text before the notice is published. Can you approve that the notice ships only after that check? | The 2018 forms and procedures may have changed | 1, 6 |
| **OQ-L4** | **Are the vendor DPAs binding on CarworX?** Supabase's DPA applies standard contractual clauses where the exporter's law "prohibit[s] the transfer … in the absence of a transfer mechanism" (DPA cl. 12.1(b)). Please check in each dashboard whether a DPA must be accepted or signed, and do so | Basis for the section 72(1)(a) route | 4 |
| **OQ-L5** | **Is the free site an "electronic transaction" under ECTA Chapter VII?** No goods or services are sold for money in Phase 2. The draft takes the cautious view and gives the s43 information anyway | Low cost either way; the draft errs towards disclosure | 2 |
| **OQ-L6** | **Children.** The draft says the site is for people aged 18 and over (POPIA s1 "child" is under 18; s34 prohibits processing children's information without a s35 authorisation). Is that acceptable? | Sign-up needs an age statement | 1, 2 |
| **OQ-L7** | **PAIA manual.** The IO guidance (para 6.2.3) lists a manual "as prescribed in sections 14 and 51 of PAIA" among the Information Officer's regulation 4 duties. The PAIA text and any small-business exemption weren't read for this draft. Should agents draft one next? | Possibly required for a private body | 6 |
