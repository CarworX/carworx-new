# CarworX

A South African marketplace for car care at **carworx.app**: find, book and pay for car wash & detailing, repairs & maintenance, glass, tyres & alignment, and look up traffic fines and other vehicle services.

**Status: Phase 1 approved, not started.** No application code exists yet. Two AI agents (Claude Code and OpenAI Codex) planned the project together in this repo. The owner approved [PLAN 2.1](planning/PLAN.md) for **Phase 1 only** (D-038): foundations, starting local-only with synthetic data.

## Where things are

| Path | What it is |
|---|---|
| [`planning/PROTOCOL.md`](planning/PROTOCOL.md) | How the two agents take turns, propose, object and reach agreement. **Read this first.** |
| [`planning/STATUS.md`](planning/STATUS.md) | Whose turn it is and what is open right now. |
| [`planning/DECISIONS.md`](planning/DECISIONS.md) | Decisions both agents have agreed to (the binding record). |
| [`planning/OWNER-QUESTIONS.md`](planning/OWNER-QUESTIONS.md) | Questions waiting on the owner. |
| [`planning/research/`](planning/research/) | Research notes with sources. Either agent can add to them. |
| [`planning/claude/`](planning/claude/) | Claude's proposals and replies. |
| [`planning/codex/`](planning/codex/) | Codex's proposals and replies. |

## Fixed by the owner

- Market: South Africa
- Backend: Supabase
- Hosting and server code: Cloudflare (Workers)
- Email: Resend
- Maps: Mapbox
- Payments: Paystack (customers book and pay through CarworX)
- Domain: carworx.app (purchased)
- Budget: free tiers first; paid items must be flagged with the reason and an estimated cost

## Latest planning round

**[PLAN.md 2.1](planning/PLAN.md) is technically signed by Codex (D-033) and approved by the owner for Phase 1 only (D-038).**
- **Brand and design:** the owner locked the Turbine logo and chose the Studio design direction (D-034 to D-036). The colleagues saw the presentation pack and asked for no changes (D-037).
- **Waiting for Codex review:** the Studio design system (D-040) and the approved 404 and loading screens (D-041). Both are on branch `planning/design-motion-toolkit`.
- **After that review:** the owner merges the branch to `main`, and Phase 1 starts local-only.
- **Not authorised:** any public deployment. The free pilot remains in force.

See [STATUS](planning/STATUS.md) for the current baton.

Owner clarifications: nationwide availability, fixed and mobile services, discovery/enquiries/bookings/payments, a free validation period, quote-then-pay repairs, and official fines referrals until integration is ready. Provider supply starts at zero; the owner and colleague handle pilot operations. See [the current answers](planning/OWNER-QUESTIONS.md) and [verification corrections](planning/research/codex-verification.md).
