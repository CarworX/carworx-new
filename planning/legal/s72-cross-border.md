# POPIA section 72 cross-border transfer assessment

> **Draft for owner approval.** 2026-11-10 (SAST). Not legal advice (D-045). Required by G-PROD (PLAN §18) and PLAN §4 ("a POPIA section 72 assessment"). Covers the free site (Phase 2). Redo it before G-LIVEPAY, or when an operator or region changes.

## 1. The law

POPIA s72(1): a responsible party "may not transfer personal information about a data subject to a third party who is in a foreign country unless" one of these applies:

| Ground | Short form |
|---|---|
| (a) | The recipient "is subject to a law, binding corporate rules or binding agreement which provide an adequate level of protection" that (i) "effectively upholds principles … substantially similar to the conditions for the lawful processing" and (ii) has "substantially similar" rules on onward transfers |
| (b) | "the data subject consents to the transfer" |
| (c) | the transfer "is necessary for the performance of a contract between the data subject and the responsible party", or pre-contract steps the person asked for |
| (d) | necessary for a contract "concluded in the interest of the data subject" with a third party |
| (e) | for the person's benefit, where consent isn't practicable and they'd likely give it |

Related duties:
- **s18(1)(g):** tell people about the transfer and "the level of protection afforded".
- **s21(1):** a **written contract** must make each operator keep the s19 security measures.
- **s57(1)(d):** prior authorisation is needed to transfer **special personal information or children's information** to a country without adequate protection. CarworX collects neither (sections 3 and 11 of the privacy notice), so s57(1)(d) doesn't apply.
- **s73(b):** breaching s72 is an "interference with the protection of the personal information".

POPIA doesn't publish a list of "adequate" countries. **This draft doesn't assume** that UK or EU law is automatically adequate under s72(1)(a). It relies on the operators' binding agreements, backed by s72(1)(c) where a contract exists.

## 2. The transfers, each mapped to a ground

Only a ground listed in s72(1) can justify a transfer. **Encryption, data minimisation and a vendor's DPA are safeguards or evidence, not grounds.** Accepting a DPA doesn't by itself show that its terms meet s72(1)(a)(i) ("substantially similar" principles) and (ii) ("substantially similar" onward-transfer rules). That has to be checked against the DPA's actual terms.

**Status key:**
- **CONDITIONAL** = a candidate s72(1) ground has been identified, but it isn't yet proven for the actual operational flow. The listed prerequisites must be met and recorded before the ground can be relied on. Until then the transfer is **not cleared for production**.
- **UNASSESSED** = no candidate ground is established, so the transfer is **blocked for production**.

No row is cleared today. **Applying a candidate ground isn't the same as proving it**: s72(1)(c) needs the specific foreign processing to be *necessary* for the contract, not merely connected to it. s72(1)(b) needs consent that is "voluntary, specific and informed" (s1). A sign-in button alone doesn't show that.

| # | Operator (role) | Data, and whose | Where | Ground | Status |
|---|---|---|---|---|---|
| T1a | **Supabase** (database, Auth) | Account holders' and listed providers' data | London (`eu-west-2`) or Frankfurt (`eu-central-1`), chosen at launch | Candidate: **(c)** "necessary for the performance of a contract between the data subject and the responsible party": the terms of use (account) and the provider listing | **CONDITIONAL.** Prerequisites: (1) the terms of use and provider terms are approved and accepted at sign-up; (2) a written necessity note shows why storing *this* data in the foreign region is needed to perform those contracts, field by field, and why a South African alternative isn't available on the approved plan (Supabase lists no African region); (3) any data not needed for the contract moves to T1c |
| T1b | Supabase | Enquiry senders who have no account | Same | Candidate: **(c)**, second limb: "implementation of pre-contractual measures taken in response to the data subject's request" (the visitor asks CarworX to pass on an enquiry) | **CONDITIONAL.** Prerequisites: (1) Bundle B builds the enquiry form; (2) the form shows the transfer notice before sending; (3) the necessity note covers enquiry fields |
| T1c | Supabase | Audit log, backups of the above held by Supabase, and any processing not needed for a contract | Same | **(a)** only | **UNASSESSED.** Needs the Supabase DPA's terms checked against s72(1)(a)(i) and (ii), including its onward-transfer terms for its sub-processors |
| T2a | **Cloudflare** (hosting, Workers, Hyperdrive, Durable Objects) | Account holders' requests | Global network; usually a South African edge | Candidate: **(c)** | **CONDITIONAL.** Prerequisites: the same as T1a, plus a necessity note for which request data Cloudflare processes outside South Africa for account holders |
| T2b | Cloudflare | **Every anonymous visitor's** IP address, request and cookies; the limiter's salted hashes; Turnstile signals | Global network | **(a)** only: an anonymous visitor has no contract with CarworX, and no consent is asked for | **UNASSESSED.** The Cloudflare DPA's s72(1)(a) fit must be checked; its transfer wording is written for European law (OQ-L4) |
| T3 | **Mapbox** (geocoding, static map image) | Place text typed by **any** visitor, often anonymous; fixed-premises pins | United States ("In AWS in the United States", Mapbox DPA FAQ) | **(a)** only | **UNASSESSED.** Mapbox DPA Schedule C (SCCs) must be checked against s72(1)(a). Until then, consider geocoding only for signed-in users, or accept that T3 blocks launch |
| T4 | **Google** (sign-in, only if chosen) | Name, email, avatar; the sign-in event | United States and elsewhere | Candidate: **(b)** consent, which POPIA defines as "voluntary, specific and informed" (s1). Possibly **(c)** once an account exists | **CONDITIONAL.** Prerequisites: (1) the sign-in page shows, *before* the Google button, a specific notice that Google processes the data outside South Africa; (2) email sign-up remains an equal alternative, so choosing Google is voluntary; (3) the implementation and wording are reviewed. A Google button alone isn't consent. **(a) is not relied on**: no Google agreement has been reviewed |
| T5 | **Email provider** for sign-in mail (gap P-4) | Account holders' email address and message | Resend, for example: "All account data … is stored in the United States regardless of the sending region" | Candidate: **(c)**: confirmation and reset emails are needed to run the account | **CONDITIONAL.** Prerequisites: (1) gap P-4 picks the provider; (2) a necessity note covers sending through that provider abroad. Any other mail needs a new ground |
| T6 | **Backups** (owner destinations, D-044) | Full encrypted exports of everything above | The owner's chosen places (OQ-B1). Unknown; may be outside South Africa | If the destination is **inside** South Africa (for example the owner's own computer), there is no s72 transfer. If **outside**, a ground is needed, most likely **(a)** via the storage provider's terms | **UNASSESSED** until OQ-B1 names the destinations. Encryption to an owner-held key is a strong **safeguard** (section 4) but **not** a ground |

## 3. The region choice

Both candidate regions are in Europe; neither is in South Africa (Supabase lists no African region on its regions page). From a POPIA view the two are **equivalent**: both are outside South Africa, and the same grounds and the same Supabase DPA apply to either. So the latency run decides ([latency-region.md](../runbooks/latency-region.md)). If latency is a tie, matching staging (Frankfurt) is preferred.

## 4. Safeguards that reduce the risk

| Safeguard | Effect |
|---|---|
| No ID numbers, no card or bank data, no special personal information in Phase 2 | Lowers the harm of any foreign access; keeps s57 out of play |
| Search place text never stored; geocodes never stored (A17) | Mapbox sees one short query, once |
| Mobile base location stored only in a private table; never in public output (A10) | The most sensitive provider data is reachable only through the database's own rules |
| Server-side Mapbox calls (D-084) | The visitor's IP never reaches Mapbox |
| Encrypted backups to an owner key (D-072) | The backup destination can't read the data |
| Least-privilege database login for search (D-081) | A leaked Worker can only run one search function |

## 5. Conclusion (for approval)

**Cleared now:** none.

**Conditional, candidate ground identified:**
- T1a, T1b, T2a and T5 under s72(1)(c);
- T4 under s72(1)(b), possibly with (c).

Each clears only when its prerequisites in section 2 are met and recorded. Every G-PROD blocker below stays in place.

**Unassessed, blocked for production:** T1c, T2b, T3 and T6. Each needs either an evidenced s72(1)(a) assessment of the recipient's actual terms, including onward transfers, or a design change that removes the transfer. Possible design changes:
- keep backups in South Africa;
- geocode only for signed-in users;
- a short consent step.

None is assumed here.

The privacy notice section 6 now states only the evidenced grounds, and holds a marked placeholder for the UNASSESSED rows; it can't be published until they're closed (s18(1)(g)).

**Conditions before G-PROD:**
1. Every CONDITIONAL row's prerequisites are met and recorded, including the written necessity notes for T1a, T1b, T2a and T5, and the reviewed Google consent flow for T4.
2. For each of T1c, T2b and T3, an agent reads the vendor's DPA in full and records, clause by clause, whether it meets s72(1)(a)(i) and (ii), including onward transfers. The owner confirms the DPA is in force for CarworX's account and records the date (OQ-L4). Accepting it alone isn't enough.
3. OQ-B1 names the backup destinations; T6 is then assessed or kept in South Africa.
4. The production region is recorded in DECISIONS after the latency run.
5. The email provider is decided (gap P-4) and T5 is confirmed.
6. The sign-in page shows the Google transfer notice before the button (T4).
7. Each operator's written contract covers the s19 security measures, as s21(1) requires.

**Approved by:** ________ (owner) on ________ (SAST)
