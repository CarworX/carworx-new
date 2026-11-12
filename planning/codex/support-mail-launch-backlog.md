# Planned support mailbox and launch backlog

## Current decision — 2026-11-12 (SAST)

The owner confirmed that no email inboxes exist and asked Codex to select an
exact name, assume it will be created, and defer setup until just before launch.

**Selected address: `support@carworx.app`.** This is planned, not a live mailbox.
The domain follows existing repository examples; ownership/control has not been
verified. If the owner cannot control it, revise this decision before publication.

Use lowercase, role-based addresses on the business domain. This one monitored
inbox covers general help, account/listing problems and privacy requests. It also
provides the non-JavaScript/non-Turnstile contact on `/support#support-contact`.
A future `privacy@carworx.app` alias may point to the same inbox; a separate
privacy mailbox is not required for this slice. Automated Auth/notification
sending remains separate under its existing sending-domain configuration.

The application continues to read `SUPPORT_CONTACT_EMAIL`. Do not silently supply
a live default or install the planned value on a hosted Worker now. Synthetic
tests demonstrate the link behaviour; they do not prove mailbox operation.

**Gate placement:** mailbox creation/verification is a pre-launch G-PROD
requirement, not an immediate Bundle B software implementation/review blocker.
This owner decision supersedes the immediate operational holds in the earlier
#71/#73 review records. Source approval, exact-head CI, bot review and the owner's
explicit merge permission still apply. No merge is authorised by this document.

## Backlog — G-PROD G3 / issue #74

Tracking: <https://github.com/CarworX/carworx-new/issues/74>.
Owner accountable; Codex assists when the owner authorises setup.

- [ ] Confirm control of `carworx.app`, or explicitly revise the selected address.
- [ ] Choose a mail provider, create `support@carworx.app`, and configure its
      required domain/mail records. No subscription or spending is approved now.
- [ ] Assign the primary operator and backup, protect access, and route privacy
      requests to the Information Officer using the approved handling process.
- [ ] Install the address as `SUPPORT_CONTACT_EMAIL` in the authorised launch
      environment. Do not publish a synthetic fixture address.
- [ ] Before launch, verify inbound messages and replies using an owner-authorised
      test; check spam-folder handling. Keep evidence redacted.
- [ ] On the launch candidate, verify the contact with JavaScript disabled,
      Turnstile blocked and form keys unavailable.
- [ ] Align approved public contact/legal documents and mailbox handling/retention
      with this address; record owner sign-off and close G3/#74 only on evidence.

No account/mailbox creation, DNS or hosted-setting changes, deployments, real
mail or spending takes place as part of this documentation task.

## Append-only history

- 2026-11-12 (SAST): owner deferred mailbox setup to just before launch. Codex
  selected `support@carworx.app`, created issue #74 and linked G-PROD G3. Mailbox
  operation/domain control remain unverified; no service was provisioned.
