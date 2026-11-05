# Codex 13 — Foundation closeout and K2 handoff

Date: 2026-11-05, Africa/Johannesburg. Main at closeout: `888bc5dfa7bf822fb1144f7a659988ea5b0440eb`. This supersedes Codex 12's pending review/Docker status while preserving its historical evidence.

## Completed reviews and merges

| Work | Reviewed head / evidence | Outcome |
| --- | --- | --- |
| T2 #15 | `95476d5fe18fab463752e7ab6763c9755f0e0cc2`; run 41906828177; fresh local 154 pgTAP assertions and 24 REST probes | Codex APPROVE, review 5776318216; merged as `38f1852e50c761b0ca4b70947fa1db74f92d4410` |
| T4 #17 | `f6f82cb66a92543ef136f4f1dcf3400ebd6da35a`; run 41919865269 passed 78 unit tests plus 154 required RLS assertions | Codex APPROVE, review 5776827115; merged as `888bc5dfa7bf822fb1144f7a659988ea5b0440eb` |
| K1 Auth fixture #22 | `994d09d67a7fc51f7ec77b08c88da582ea3c02d1`; run 41914021818 green; 10 Node CI tests including four new real-Git scenarios | Claude APPROVE; Claude merged as `80667007eb2035dfc3b07e438ac8ca5d81b23dc9` |
| K2 inventory #23 | Initial `6feb59ec03faa5c41a2732a97dacbf4f49692c70`; Claude approved as preflight, not A2 | Updated with Claude's staging-project confirmation and a documented Auth email configuration clarification; refreshed head requires review |

The PR reviews are on [T2](https://github.com/CarworX/carworx-new/pull/15#pullrequestreview-5776318216) and [T4](https://github.com/CarworX/carworx-new/pull/17#pullrequestreview-5776827115). All downloaded check/secret/gate artifacts were checked for their exact head. No unresolved material application finding remains in these reviewed foundation changes.

## Independent workstation evidence

- **T2:** clean synthetic local reset; 3 real pgTAP files / 154 assertions / zero failed, skipped or TODO; 24 direct PostgREST probes passed. They cover anonymous/cross-tenant denial, membership update/upsert reassignment, admin fixture AAL, forged metadata, same-token revocation and audit mutations. Signed AAL claims are not real login/TOTP. [Sanitized summary](evidence/13-t2-local-summary.json).
- **Windows setup:** initial CLI 2.122.1 startup failed at temporary-directory creation. A bounded retry with process-local TMP/TEMP set to the existing task directory `C:/Temp/carworx-supabase` succeeded. Pinned Node 24.22.2/pnpm 12.16.1 remained unchanged. The runner used its documented private `RLS_DB_URL` override; the temporary REST probe used a Windows CLI-launcher adapter only. No secrets were printed or committed.
- **Resource scope:** Docker 29.9.2 has about 4 GB RAM, so studio, postgres-meta, realtime, imgproxy, logflare, vector, supavisor and edge-runtime were excluded. Database, Auth, PostgREST, gateway, Storage and local mail sink were healthy. Full-stack CI is separate evidence. C: ended around 6 GB free; K4 needs capacity preflight. No images, unrelated files or WSL installations were deleted. Stop returned 0; no test containers remain.
- **T4:** pinned frozen install and local lint/format/types/78 tests/build passed at `eac75b9`. Independently reviewed the NavBar close-on-activation change and its three DOM regressions. Chromium 153/Playwright 1.63.0 at 390×844 passed 3 focused checks: link activation closes/releases Tab, sheet action closes, padding preserves open state and Escape restores menu focus. [Sanitized result](evidence/13-t4-nav-browser.json).
- **Reconciliation:** Claude concurrently merged T2/main into T4 at `f6f82cb`; my push was rejected and preserved the newer remote. The unpushed local integration candidate is superseded. Its app/manifests/lock/schema match Claude's actual head, which has no app changes from the locally tested `eac75b9`. Current-head CI covered the combined app/schema. Earlier 27-check browser results and saved capture hashes remain scoped to unchanged design/state code; no duplicate capture package was generated.

## Current contracts and limitations

**K1/T3: AGREE.** `integration` becomes required with T3/T5 implementation. Claude supplies the real integration command and machine-readable evidence. The fixed fault injector works with an absent, empty or existing Auth directory and already-required Auth/security flags; it temporarily disables integration only in its scratch contract, preserves RLS, and restores files/index. Required-suite detection and report validation are unchanged.

**K2/T3 behavioral requirements: AGREE.** Claude accepted local mail-sink tests, no real delivery-failure sends, owner-held approved recipients, server-side application restrictions, direct Auth delivery restrictions, and staging-only dev pages. Concrete delivery enforcement is still open. [Claude's acceptance and project confirmation](https://github.com/CarworX/carworx-new/pull/23#issuecomment-6643530553).

**Configuration clarification:** confirmations off does not stop password-reset emails; custom SMTP unset can still use Supabase's default sender for organisation team addresses. Neither proves all Auth mail is disabled or matches the owner's approved set. The preflight now states this explicitly and requests Claude's acknowledgement. Require demonstrated fail-closed controls before staging sign-in/email. Sources: [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [default-provider notice](https://supabase.com/changelog/29370-supabase-auth-changes-to-default-email-provider).

Claude verified the intended staging project exists and is healthy (Postgres 17) through the owner's connection. Codex's inspected connections lack organisation access. The mapping is not being changed. No CarworX zone/Worker or sending domain was visible in the inspected Cloudflare/Resend connections; repository secret/variable name lists were empty. No hosted settings were changed.

## Receiving-agent steps

1. Claude reviews the refreshed #21 head and its fresh CI, then merges as reviewer under Q-021. Both task histories are preserved; original planning documents are not replaced.
2. Claude reviews updated #23, acknowledges the email configuration clarification, and keeps #24's staging email boundary open until K2 proves both delivery paths. T3/T5 remains Claude-owned; this turn did not review #24's implementation.
3. Owner grants Codex connector access to the existing staging organisation and confirms the intended Cloudflare account/route and sending subdomain. Configure staging-only secrets/approved recipients privately; no values go in chat, Git or agent-readable records.
4. Codex implements K2 on `codex/k2-environments`: names-only configuration, explicit local/staging separation, manually triggered owner-run workflow, reviewed-SHA/check evidence and the agreed recipient-control mechanism. Claude reviews the final head. No automatic push deployment.
5. K3 follows accepted T4 locally, then K2 for hosted measurements. K4 starts with synthetic database/object recovery after capacity preflight; hosted destination, separate copy, operator and retention/capacity approval remain owner prerequisites.

Verification-only #19/#20 are closed without merging. PR #16's additional loading page remains separate. A1/A4 have local/CI evidence; A2 and full A3/A5/A6/A7 still need their required implementation/staging evidence. Nothing here completes Phase 1, real Google/TOTP, hosted recovery/performance, WCAG compliance or D-060.
