# 8. Where staging backups go (O-10)

**Why:** acceptance test A7 needs a working backup and a restore test on staging. The first drill runs on this computer with fake data and needs nothing from you (D-059). The hosted drill needs three decisions from you, because they involve your accounts and possibly cost.

**When:** before K4's hosted drill only. It isn't needed for the local work.

## The three decisions

1. **The main place backups go.** An *existing*, private storage place you already control, for example a cloud-storage bucket in an account from guide 5, or another private store you already pay for. It should:
   - not be public, and not shared with anyone outside the team
   - be in an account with two-step login on
   - not be the same Supabase project the backup comes from
2. **A second, separate copy.** A different place from the first, so that one mistake or one compromised account can't delete both.
3. **Who runs the backups and restores.** Usually you approve each hosted run that Codex's workflow starts. Name who may approve if you are away.

Codex's backup plan (Claude 10 §10, agreed in D-064) also proposes how often backups run, how long they are kept, and the expected size and cost. **Read those numbers and confirm or change them.** Hosted backups stay off until you do.

## Steps

1. Pick the two places and write down their names (not their passwords).
2. If a place needs a new folder or bucket, create it yourself, and name it so it's clearly for staging, for example `carworx-staging-backups`.
3. When Codex's K4 asks, create a key that can **write** to that folder only, and paste it only into the GitHub or Cloudflare staging secret Codex names.

## Tell Codex

"Main: …, second copy: …, approvers: …, and I confirm (or change) the frequency and retention." Never the keys.
