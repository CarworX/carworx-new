# Codex round 02 — verification

Date: 2026-10-27. Reviewed Claude 02 at `be028f08c9da5088391211c8cfb2a2b5d9bbf5a3`. Findings below were obtained after reading Claude 02.

## GitHub enforcement

- Local CLI read confirms organisation plan `free`. Branch protection and ruleset reads each returned HTTP 403 with the upgrade message, independently reproducing Claude's result. No settings were changed.
- [Protected-branch docs](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches) support private repository protections on paid plans including Team.
- **Correction:** [deployment-environment docs](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments) say required reviewers on Free/Pro/Team are available only for public repositories. Team does not supply the private-repo human deployment-approval gate Claude anticipates. Do not purchase it believing otherwise. Keep owner-executed production releases with credentials outside agent-accessible environments unless a separately verified alternative is approved.
- Distinct bot names do not automatically prove a valid independent approval. Verify actual app permissions, review output, branch policy and identities, including who can write checks or bypass rules. A shared-account comment is an auditable process record, not identity-enforced approval.
- The owner's global instructions require explicit merge authorisation; T-21 cannot silently grant future cross-agent merges. Current permission covers planning fast-forward publication only.

## Paystack settlement/refunds

- [Subaccount API](https://paystack.com/docs/api/subaccount/) response samples include `settlement_schedule: AUTO`. The published update parameters inspected do not establish the weekly/manual write contract claimed from wrappers, or eligibility for this South African marketplace.
- Even if schedule control is available, it does not prove that a refund is funded from that provider's pending payout or that weekly settlement covers future appointment dates/disputes. A booking can be paid more than a week before fulfilment; chargebacks can arise after settlement.
- [Refund funding](https://support.paystack.com/en/articles/2127106) is documented in terms of pending payout/balance. The precise split-provider recovery mechanism and chargeback debit remain account-specific verification items.
- [Split-payment support](https://support.paystack.com/en/articles/2132802) documents selecting the fee bearer. Provider-borne fees are a recommendation to the owner, not a claim that CarworX has zero costs/liability. No credentialled requests or support enquiries were made.

## Scheduling/verification concerns

- Proposed straight-line-distance / 40 km/h fallback is an untested scheduling assumption, not a safe driving-time estimate. Use manual time confirmation when routing fails rather than making automated capacity promises from it.
- Matrix quotas/billing units must be verified before selecting them. No routing calls, quota measurements, private address tests or provider ID checks were performed.
- Separate public exact premises location from private mobile base/customer location; remove access notes from broad staff visibility. Define legal/support retention separately from the provider-visible seven-day rule.
- A test-mode transaction proves neither production onboarding nor payment-method/settlement eligibility. Per-provider activation must include all shared production gates.

Revenue/advertising evidence and commercial hypotheses are in [revenue-streams.md](revenue-streams.md). No fee, campaign, live integration or spending has been activated.
