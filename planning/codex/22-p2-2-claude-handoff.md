# Codex 22 — hardening review and Claude P2-2 handoff

2026-11-10 (SAST). Owner-approved execution of the Codex preparation → Claude
P2-2 handoff plan. **Claude plans and implements P2-2 now; Codex independently
reviews later when available (D-079).** This supersedes D-074's writer assignment for P2-2
only. No self-approval, hosted settings/deployment, real mail or spending.

## Verified starting point

- #45: Claude APPROVE at `8de9cf99b25984d605c73219fa2f416ab85a500a`,
  green K1/native checks, merged as `757e95434fe7c8378818303607de04c085804ccd`.
- #47: Claude APPROVE at `d15ed69408b3c628d16d66a78e25fa1df9222c18`,
  green K1/recovery, merged as `c60207ba15d0cef18524f6b4603a87b437a6eee5`.
  The merge preserved both HISTORY entries; approved implementation unchanged.
  Combined lightweight checks: 44 passed.
- P2-1 has seven RLS-protected tables and the exact-column public view. Its
  final recovery run executed 349 database assertions. Hosted A1–A7 remain open.

## First: review this hardening PR

Review the final exact head using `REVIEW: APPROVE|CHANGES @<full-sha>` and
`Agent: claude`. Leave this PR unmerged for now. Review the Codex-authored head formally; if
fixes are necessary, put Claude-authored fixes on a separate branch/PR for later
Codex review. Do not self-approve or self-merge.

- The additive migration puts revoked/future label predicates inside the view.
  Its owner, column set, security options and client grants remain unchanged.
- Category writes serialize on a transaction advisory lock before row locks;
  the volatile statement-level recursive check sees committed predecessors.
  Writes require READ COMMITTED; stronger stale-snapshot isolation is rejected
  explicitly instead of accepting an undetected cycle. Read queries are unchanged.
  Tests cover valid/multi-row trees, loops, real competing writers and rollback.
  Snapshot rationale: [PostgreSQL function volatility](https://www.postgresql.org/docs/17/xfunc-volatility.html).
- The ready-PR checklist requires a per-stratum p95 gap, both maxima, evidence
  reference, rationale and an acceptance/mitigation decision. No arbitrary
  automatic latency threshold is invented.
- Timing correlations are allocated before measurement and mapped to a private
  run manifest. It stores case/pair indices, group, timestamps, duration/status
  and a private input digest; no addresses, passwords, tokens, cookies or bodies.
  The CLI fails closed if the file cannot be secured or written. The public
  report keeps its version-1 fields and never prints the manifest path/run ID.

**Staging blockers:** no hosted timing measurements exist. Direct Auth timing
is required before promotion; application-path timing follows the first app
deployment and is an explicit blocker for broader staging acceptance.
`promotion.json` stays blocked. Local/fixture results do not remove those gates.

## Then: submit the P2-2 plan

**Owner override (usage limit): continue without waiting for Codex.** Use this
published hardening branch as the working baseline while it remains unmerged.
Record the exact base SHA in your plan and PR. Write the next numbered Claude
P2-2 plan and link a P2-2 issue, then implement the feasible agreed scope without
waiting for Codex's plan review. Codex reviews the plan and code later.

Create a separate `claude/p2-2-search` branch and a draft PR targeting
`codex/catalogue-review-hardening` so the search diff stays separate from the
hardening. Retarget onto main after hardening is independently accepted/merged,
refresh CI and obtain Codex's exact-head review before merging Claude's work.
Do not deploy or activate hosted credentials. Unresolved credential/pricing gates
still block the affected implementation; record them rather than silently using
broad credentials or a paid/in-memory substitute.

The plan must make these decisions explicit:

1. **HTTP/query contract:** endpoint, input validation, filters, coordinate
   rounding for mobile discovery, page sizes ≤20 and radii {5,10,25,50} km
   (default 25). No silent widening or exact-address eligibility endpoint.
2. **Two groups:** fixed premises first, ordered by 0.1 km distance bucket and
   public UUID; mobile separately by public UUID only. Independent keyset
   cursors and more controls. Sign cursors, bind them to group and normalized
   query/filter/radius parameters, and specify expiry and malformed-cursor errors.
3. **Database boundary:** `api.search_listings`, SECURITY DEFINER owned by
   `listing_projection`; private bounded eligibility helper owned by
   `listing_eligibility`. Apply mobile cursor and public-ID order before LIMIT.
   Read the actual P2-1 fields (`listing_public_id`, `centre_latitude`,
   `centre_longitude`, `radius_km`), not conceptual private IDs in the proposal.
   Return only allowed projection fields; fixed distances use public pins.
4. **Real server credentials:** demonstrate a supported scoped credential path
   for `catalogue_server`, with expiry/renewal and failure behaviour. It must
   execute only the exposed wrapper, not private helpers or raw tables; do not
   use the broad `service_role` as a fallback or put a project signing secret in
   the app. Creating the NOLOGIN role alone is not proof of a usable credential.
   Synthetic local signing material may exist only inside private test tooling.
5. **$0 limiter evidence:** verify plan availability, quotas and any charges
   from official Cloudflare sources, with dated links. The inspected
   [binding docs](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
   show approximate, per-location limits; their free/paid *user* example does
   not prove Cloudflare Free-plan pricing. Check the
   [pricing documentation](https://developers.cloudflare.com/workers/platform/pricing/).
   Select thresholds, independent IP/session checks, privacy-preserving keys,
   missing-binding/outage behaviour and 429 responses. Missing cost proof blocks
   that choice. The Claude 17 Durable Object alternative needs its own documented
   $0 proof and Codex review; no automatic paid upgrade or in-memory substitute.

## Implementation and deferred review

Use the separate stacked Claude feature PR described above. Keep application/search,
migration, configuration names and tests together; coordinate any CI interface
change with Codex. No live credentials or hosted configuration. Preserve the
existing Studio components; public page implementation remains P2-3.

Required evidence: pgTAP plus genuine local PostgREST requests using the real
scoped server role; anonymous/authenticated denial of wrapper/private calls;
minimal schema/table/function grants; fixed/mobile boundaries and rounding;
multi-page mixed results with no gaps/duplicates; helper cursor/order before
LIMIT; tampered/expired/query-swapped cursors; unchanged mobile order when its
private base moves within coverage; no private values in JSON/HTML/cursors/logs
or caches; independent IP/session limits and missing/failing limiter handling.
Tests must execute with no skips/TODOs. Keep Node harness and hosted claims
separate. Use standard included GitHub CI for heavy runs, with the $0 ceiling.

Publish exact-head run links, findings and remaining A8–A11/A17 boundaries.
Codex reviews with `REVIEW: APPROVE|CHANGES @<full-sha>`, `Agent: codex`.
Claude never self-approves or self-merges. Phase 1 staging acceptance and the
extension of K4's retained backup payload to catalogue tables remain open.

## Copy-ready prompt

Review this Codex hardening PR at its final exact head with a formal
`REVIEW: APPROVE|CHANGES @<full-sha>`, `Agent: claude`. Without waiting for a merge,
use Codex 22 to plan P2-2, resolving scoped credentials and official $0 limiter
evidence. Write the plan, implement in a separate stacked PR without waiting for Codex, then hand it back
for Codex review. Don't self-merge. No deploys, settings, real mail or spending.

Agent: codex


## Stop point and immediate continuation

Codex stopped after local lightweight verification (44 passing tests), including
Windows private-manifest ACL handling. The database migration, two-connection
race tests and full combined application checks still require GitHub CI. No
passing CI is claimed for this new hardening head. Let its workflows finish;
inspect failures, preserve raw service output privately and publish only safe
labels/counts. Do not weaken tests or turn missing reports into passing checks.

The existing operations-test contract now explicitly requires timing.test.js.
The additive migration and new pgTAP file add 10 assertions (359 total expected).
The new integration file adds three real-connection checks: competing parent
updates with commit/rollback, and rejection of repeatable-read category writes.
There are no local Supabase services to stop from this turn; heavy suites belong
in included GitHub CI. Docker was not reinstalled locally.

The private timing CLI now takes <private-config.json> <private-manifest.json>.
Keep both private, outside Git. The manifest is created exclusively and flushed;
its correlation IDs are shared with the sanitized public report. Review Windows
ACL and POSIX permission failure paths alongside the SQL security changes.

Finish by posting reviewed/implemented SHAs, CI URLs and remaining blockers, and
provide the owner a short copy-ready Codex review prompt. Never merge your own
implementation while Codex is unavailable.
