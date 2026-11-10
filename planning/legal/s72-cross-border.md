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

## 2. The transfers

| # | Operator (role) | Data | Where | Ground relied on | Evidence |
|---|---|---|---|---|---|
| T1 | **Supabase** (database, Auth, Storage) | All account, listing, application, enquiry and audit data | The region chosen at launch: **London (`eu-west-2`) or Frankfurt (`eu-central-1`)**. A specific region, not a "general region" | (a) binding agreement; (c) for account and listing data | Supabase DPA cl. 6.1: Supabase "shall ensure" data is stored in the region the customer directs; cl. 12.1(b): the SCCs apply where the exporter's laws "prohibit the transfer of Covered Data to Supabase under this DPA in the absence of a transfer mechanism implementing adequate safeguards" |
| T2 | **Cloudflare** (hosting, Workers, Hyperdrive, Durable Objects, Turnstile) | Every request: IP address, request content, cookies; the limiter's salted hashes | Cloudflare's global network. A South African visitor is normally served from a South African edge | (a) binding agreement; (c) | Cloudflare customer DPA (section 6.2 applies SCCs to "Restricted Transfers" under European law). **Its wording is European-law focused; see OQ-L4** |
| T3 | **Mapbox** (geocoding, static map image) | The place text a visitor types; provider pins for fixed premises | United States: "In AWS in the United States" (Mapbox DPA FAQ) | (a) binding agreement | Mapbox DPA Schedule C (2021 SCCs). The request comes from our server, so **no visitor IP** reaches Mapbox. Place text is usually a suburb or postcode, not an address |
| T4 | **Google** (sign-in, only if chosen) | Name, email, avatar; the fact of signing in | United States and elsewhere | (b) the person chooses Google; (c) | PLAN §9.1: scopes `openid email profile` only |
| T5 | **Email provider** for sign-in mail (gap P-4; for example Resend) | Email address, message content | Resend: "All account data … is stored in the United States regardless of the sending region" (Resend regions page) | (a) binding agreement; (c) | Decide with gap P-4 |
| T6 | **Backups** (owner destinations, D-044) | Encrypted full exports | The owner's chosen places (OQ-B1) | Data is **encrypted before transfer** to a key only the owner holds | [backup-and-pause.md](../runbooks/backup-and-pause.md) |

## 3. The region choice

Both candidate regions are in Europe; neither is in South Africa (Supabase lists no African region on its regions page). From a POPIA view the two are **equivalent**: each relies on the same Supabase DPA. So the latency run decides ([latency-region.md](../runbooks/latency-region.md)). If latency is a tie, matching staging (Frankfurt) is preferred.

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

Transfers T1 to T5 can rely on s72(1)(a), on condition that each operator's data processing agreement is **in force for CarworX's account** (OQ-L4). T1, T2, T4 and T5 can also rely on s72(1)(c) for people with an account or a listing. T6 is encrypted and only the owner holds the key. The privacy notice section 6 tells people this, as s18(1)(g) requires.

**Conditions before G-PROD:**
1. The owner confirms each DPA is accepted or signed in its dashboard (OQ-L4) and records the date.
2. The production region is recorded in DECISIONS after the latency run.
3. The email provider is decided (gap P-4) and added to T5.
4. Each DPA's s19-style security terms are noted, to meet s21(1).

**Approved by:** ________ (owner) on ________ (SAST)
