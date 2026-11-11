# Legal drafts for the free site (D-045, G-PROD)

> **Draft for owner approval.** Written by Claude on 2026-11-10 (SAST). **Not legal advice** (D-045: no attorney; the owner accepts that risk). Codex's D-045 cross-check (2026-11-11) asked for three corrections at `84d6a5a`; they are made in the revision after it. Nothing here is published until the owner approves it.

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

Read on **2026-11-10**, except the rows marked 2026-11-11, which were added after Codex's D-045 cross-check. Gazette scans of older Acts don't show later amendments; where that matters, an owner question says so.

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
| ECTA amendments | Checked 2026-11-11 against two amending Acts: **POPIA s110 and its Schedule** ("The repeal of sections 45, 50 and 51" of Act 25 of 2002; s110 in force 30 June 2021) and **CPA Schedule 1 Part B** (amends only ECTA s1 and s49: complaints go to the National Consumer Commission). The drafts cite ECTA s43 and s48 only, which neither Act changes. **Cybercrimes Act 19 of 2020, s58 Schedule** (read 2026-11-11, after Codex supplied the working DoJ link): its ECTA entry is "(a) The deletion of sections 85, 86, 87 and 88" and "(b) The substitution for section 89". It doesn't touch s43 or s48 | POPIA and CPA texts above; <https://www.justice.gov.za/legislation/acts/2020-019-Cybercrimes.pdf> |
| POPIA commencement | Proclamation R.21 of 2020, GG 43461, 22 June 2020: ss2–38, 55–109, 111 and 114(1)–(3) from 1 July 2020; **ss110 and 114(4) from 30 June 2021** | <https://inforegulator.org.za/wp-content/uploads/2020/07/20200622-gg43461-rg11136-pr21-POPIAsections.pdf> |
| Regulations 2018 | Regulations relating to the Protection of Personal Information, GN R.1383, GG 42110, 14 December 2018 (base text for regulation 4) | <https://www.justice.gov.za/legislation/notices/2018/20181214-gg42110-rg10897-gon1383-POPIregister.pdf> |
| Regulations 2025 amendment | GN 6126, GG 52523, 17 April 2025: amended Regulations published "for implementation with immediate effect" | <https://www.justice.gov.za/legislation/notices/2025/20250417-gg52523gon6126-POPIA-Regulations-Amendment.pdf> |
| Regulations 2025 text | The amended final text the notice links to | <https://inforegulator.org.za/wp-content/uploads/2025/04/POPIA-2021-Regulations-FINAL-21-Jan-2025.pdf> |
| TAA | Tax Administration Act 28 of 2011, Government Gazette 35491, 4 July 2012 | <https://www.gov.za/sites/default/files/gcis_document/201409/a282011.pdf> |
| Prescription Act | Prescription Act 68 of 1969 (Department of Justice consolidated text) | <https://justice.gov.za/legislation/acts/1969-068.pdf> |

Vendor facts used in the section 72 assessment and the privacy notice, also read 2026-11-10: [Supabase regions](https://supabase.com/docs/guides/platform/regions), [Supabase DPA](https://supabase.com/legal/dpa), [Cloudflare customer DPA](https://www.cloudflare.com/cloudflare-customer-dpa/), [Resend regions](https://resend.com/docs/dashboard/domains/regions), [Resend sub-processors](https://resend.com/legal/subprocessors), [Mapbox DPA](https://www.mapbox.com/legal/dpa), [Turnstile get started](https://developers.cloudflare.com/turnstile/get-started/).

## Owner questions

| ID | Question | Why it matters | Drafts affected |
|---|---|---|---|
| **OQ-L1** | **Who is the responsible party before the company is registered (D-049)?** POPIA defines a private body as including "a natural person who carries or has carried on any trade, business or profession" (s1, "private body"). Until CIPC registration that's probably you personally, trading as CarworX, with your cofounders. The eServices form asks for an organisation's "registered name, registration number". Please confirm how you'll register. | Names the responsible party in the notice and on the Information Officer registration | 1, 2, 6, guide 13 |
| **OQ-L2** | The business **physical address, phone and email** to publish. ECTA s43(1)(b), (c) and (g) require them on the website for anything offered by electronic transaction; POPIA s18(1)(b) requires the "name and address of the responsible party" | Can't publish without them | 1, 2 |
| ~~OQ-L3~~ | **Resolved 2026-11-11.** The amended Regulations were read; see "Regulations cross-check" below | — | 1, 6 |
| **OQ-L4** | **Are the vendor DPAs binding on CarworX?** Supabase's DPA applies standard contractual clauses where the exporter's law "prohibit[s] the transfer … in the absence of a transfer mechanism" (DPA cl. 12.1(b)). Please check in each dashboard whether a DPA must be accepted or signed, and do so. **Accepting is necessary but not sufficient:** an agent must still check each DPA's terms against s72(1)(a)(i) and (ii), including onward transfers | Needed before rows T1c, T2b and T3 of the s72 assessment can close | 4 |
| **OQ-L5** | **ECTA Chapter VII scope, and the Cybercrimes Act.** Is the free site an "electronic transaction"? No goods or services are sold for money in Phase 2; the draft gives the s43 information anyway. The amendment check is closed (see "ECTA amendments": no amending Act changes s43 or s48); only this applicability question remains | Low cost either way | 2 |
| **OQ-L6** | **Children.** The draft says the site is for people aged 18 and over (POPIA s1 "child" is under 18; s34 prohibits processing children's information without a s35 authorisation). Is that acceptable? | Sign-up needs an age statement | 1, 2 |
| **OQ-L7** | **PAIA manual.** The 2025 amendment **deletes** regulation 4(1)(c) (the duty to ensure a PAIA manual under PAIA ss14 and 51) and 4(2) (copies of it) from the POPIA Regulations, so the 2021 IO Guidance Note paras 6.2.3 and 6.2.6 are out of date on this point. Whether PAIA s51 itself still requires a manual from a private body like CarworX wasn't checked: PAIA wasn't read. Should agents read PAIA and draft one if needed? | May still be required under PAIA itself | 6 |

## Regulations cross-check (2026-11-11)

The Regulations relating to the Protection of Personal Information, 2018, as amended by GN 6126 (GG 52523, 17 April 2025, "with immediate effect"). Each amended regulation and where the drafts deal with it:

| Regulation (as amended) | What it now says | Where handled |
|---|---|---|
| 1 | New definitions, including "day" (calendar day) and "writing" (ECTA s12) | Read; the drafts' periods are in calendar days |
| 2.1–2.3 | Objections are free, during office hours, on a form "substantially similar to Form 1", and "reasonably accessible … by hand, fax, post, email, SMS, or WhatsApp and or in any manner expedient" | Privacy notice §9 "How to ask" |
| 2.4 | Tell people of their right to object when collecting (s18(1)(h)(iv)) | Privacy notice §9 |
| 2.5, 3.5 | A telephone objection or correction request must be "electronically recorded" and made available, including a transcription, free | Privacy notice §9; incident plan unaffected |
| 3.2–3.4 | Correction, deletion and destruction requests are free, on a form like Form 2, by the same channels | Privacy notice §9 |
| 3.6 | Tell the person **in writing** what was done, "within thirty (30) days of receipt of the outcome of the request" | Privacy notice §9 gives a stricter service commitment: within 30 days of the request |
| 4 | Regulation 4(1)(a) adds "continually improved"; **4(1)(c) (PAIA manual) and 4(2) (manual copies) deleted** | README OQ-L7. Owner guide 13 (merged in #59) listed the PAIA manual among regulation 4 duties; Codex's #67 corrects it |
| 5 | "relevant body/bodies" wording; Form 3 amended | Not relevant to the free site |
| 6.1–6.4 | Marketing consent must be **written**, on a form like Form 4 or another free, accessible way; phone and automated-call requests recorded; **"opt-out shall not constitute consent"** | Privacy notice §3 marketing row and reviewer note |
| 7 | Who may complain, and how: in writing on Form 5 (online, at the Regulator's offices, or by fax, post, courier or email); acknowledged within 14 days | Privacy notice §10. Could add "Form 5 on the Regulator's website" when publishing |
| 12, new 13 | Forms 17–19 deleted; administrative fines may be paid in instalments | Read; no drafting change |
| 10, 11 | Things done under the 2018 Regulations count under the new ones. The text's own short title says it commences "on a date to be determined", but GN 6126 publishes it "for implementation with immediate effect" (17 April 2025); the drafts treat it as in force | Read; no drafting change |

**Also checked:** the Regulations relating to the Processing of Data Subjects' Health Information by Certain Responsible Parties, 2026 (GN 7198, GG 54268, 6 March 2026). These apply to insurers, medical schemes, pension funds, employers and similar bodies processing **health** information. CarworX processes none, so they don't apply. Only the gazette's title and scope were seen, in search results; gov.za was unreachable on 2026-11-11, so the full text wasn't read.
