# Retention schedule (PLAN §9.3, D-053)

> **Draft for owner approval.** 2026-11-10 (SAST). Not legal advice (D-045). Fills PLAN §9.3's TBD periods from South African law, with citations. The owner's accountant colleague reviews the financial row (D-047, D-053). The owner approves before G-PROD.

## 1. The rules the periods come from

| Rule | Text | Effect here |
|---|---|---|
| POPIA s14(1) | Records "must not be retained any longer than is necessary for achieving the purpose", unless (a) required or authorised by law, (b) "the responsible party reasonably requires the record for lawful purposes related to its functions or activities", (c) a contract requires it, or (d) the person consents | The default is **short**. Every longer period below names its exception |
| POPIA s14(3) | A record used "to make a decision about the data subject" is kept as law prescribes or, if none, long enough to give a "reasonable opportunity … to request access" | Application and claim decisions |
| POPIA s14(4), (5) | Destroy, delete or de-identify "as soon as reasonably practicable", in a way "that prevents its reconstruction" | Deletion jobs, and backups ageing out |
| POPIA s14(6)(b) | Restrict processing if no longer needed "but it has to be maintained for purposes of proof" | Legal hold |
| POPIA s11(2)(a) | The responsible party "bears the burden of proof" for consent | Consent records outlive the consent |
| CPA s116(1) | A complaint "may not be referred … more than three years after" the act or omission | 3 years covers consumer complaints |
| Prescription Act s11(d) | "three years in respect of any other debt", from when the debt is due (s12(1)) | 3 years covers ordinary civil claims |
| TAA s29(3)(a) | Tax records "need not be retained … after a period of five years from the date of the submission of the return" | Financial records, once money moves |

**The 3-year anchor.** Where a record is kept "for proof" (s14(1)(b), s14(6)(b)), the period is **3 years**, because CPA s116(1) and Prescription Act s11(d) both close the usual claims after 3 years. Longer periods need a specific law.

## 2. The schedule

**Legend:** PLAN = the period was already proposed in PLAN §9.3 and is confirmed here. NEW = a row PLAN didn't have. Phase = when the data first exists.

| Data | Phase | Purpose | Access | Trigger → period | Basis |
|---|---|---|---|---|---|
| Profiles (name, email, avatar) and Auth records (sign-in identities, sessions, MFA factors) | 1 | Account | Self, admin | Account closure → **delete within 30 days** | s14(1): purpose ends at closure; 30 days to process the request and let backups age out |
| Customer addresses and access notes | 3 | Fulfilment | Customer, assigned staff (7 days), admin (audited) | Job completion → **90 days**, longer only while a dispute is open | s14(1): needed only to do the job and handle early complaints; the booking keeps the suburb for proof. **Confirm before Phase 3** |
| Mobile base location and radius | 2 | Matching | Provider owner, admin | Listing removal → **30 days** (PLAN) | s14(1) |
| Enquiries, demand requests | 2 | Service, recruitment | Parties, admin | Last activity → **12 months** (PLAN) | s14(1)(b): one year shows seasonal demand |
| Verification evidence (raw) | 2 | Trust labels | Admin | Decision → **raw evidence deleted ≤ 30 days** (PLAN) | s10 (minimality), s14(1) |
| Verification method record (who checked what, how, when) | 2 | Proof of a label | Admin | Label removed → **3 years** NEW | s14(3) (decision record), s14(1)(b) |
| Claims and transfer-of-control records | 2 | Prevent hijacks | Admin | Decision → **3 years** NEW | s14(3), CPA s116(1) |
| Consent records | 2 | Prove consent | Admin | Consent withdrawn, or the processing ends → **3 years** NEW | s11(2)(a) burden of proof; CPA s116(1) |
| Support cases | 2 | Service | Per RLS | Case closed → **3 years** | s14(1)(b); CPA s116(1); Prescription Act s11(d) |
| Audit log | 1 | Accountability | Admin | Entry created → **3 years**, then delete or de-identify NEW | s14(1)(b), s19(2)(c) (verify safeguards) |
| Search place text and geocodes | 2 | One search | Nobody | **Never stored** (A17, D-082) | s10 |
| Search limiter counters (keyed by a salted hash of IP or of a random cookie) | 2 | Abuse control | System | Window end → **24 hours** NEW, **gap R-1** | s14(1); an IP is "personal information" ("online identifier", s1) |
| Search cookie `__Host-cx-search` | 2 | Abuse control | Browser | **24 hours** (cookie lifetime) | Already 86,400 s in `handler.ts` |
| Logs (redacted) | 1 | Operations | Operators | **30 days** (PLAN) | s14(1) |
| Outbox, notifications | 3 | Delivery | System, admin | **90 days** (PLAN) | s14(1) |
| Integration events (raw) | 3 | Reconciliation | System, admin | Reconciled → **90 days** (PLAN) | s14(1) |
| Reviews | 3 | Trust | Public (text), admin | While the listing is live; on account closure the author's name is removed and the text kept **de-identified** | s14(4) de-identify; confirm before Phase 3 |
| Financial records | G-LIVEPAY | Tax and accounting | Admin | Return submitted → **at least 5 years**, plus while any audit, objection or appeal is open | TAA s29(3)(a). **None exist in Phase 2.** Accountant review (D-047). OQ-R2 |
| Backups | 2 | Recovery | Owner | **7 daily + 4 weekly sets (about 5 weeks)**, then overwritten | s14(4)–(5); deleted data leaves backups within 5 weeks. [backup-and-pause.md](../runbooks/backup-and-pause.md) |

**Legal hold.** If a complaint, claim or Regulator request is open, records it needs are kept and **restricted** until it ends (s14(6)(b), (7)). The hold, its reason, who set it and when it ends are recorded in the audit log.

## 3. Gaps the schedule exposes

| ID | Gap | Fix | Owner of the fix |
|---|---|---|---|
| **R-1** | The `SearchLimiter` Durable Object keeps its counter with **no expiry** (`apps/web/app/server/search/limiter.ts` at `b899190` has no alarm and no delete). One object exists per hashed IP and per search cookie | Add a storage alarm that deletes the counter when its window ends; test it. Until then, the privacy notice must not claim 24 hours | Agent PR (search owner) before G-PROD |
| **R-2** | No deletion jobs exist for any row in section 2 | A scheduled job per row, each with tests | Agents, before G-PROD for Phase 2 rows |
| **R-3** | The audit log is append-only by design (T2) | A narrow, audited purge of entries older than 3 years, run by the system only | Agents, before the first entry turns 3 |

## 4. Owner questions

- **OQ-R1.** Approve the 3-year anchor for proof records (section 1)?
- **OQ-R2.** For the accountant colleague: is 5 years from return submission (TAA s29(3)(a)) the right floor for CarworX's financial records? The Companies Act 71 of 2008 wasn't read for this draft; please check whether it sets a longer period once the company exists (D-049).
