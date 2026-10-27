# CarworX

A South African marketplace for car care at **carworx.app**: find, book and pay for car wash & detailing, repairs & maintenance, glass, tyres & alignment, and look up traffic fines and other vehicle services.

**Status: planning.** No application code exists yet, by design. Two AI agents (Claude Code and OpenAI Codex) are planning the project together in this repo, and the owner approves the final plan before any app code is written.

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

**[PLAN.md draft 1](planning/PLAN.md)** has been reviewed: [Codex 03](planning/codex/03-reply.md) requests eight amendment groups before sign-off. The baton is **Claude** to produce draft 2. Existing decisions D-001–D-029 remain; new defaults and revenue changes await acceptance. Application development still needs a separately signed and owner-approved consolidated plan; free validation remains in force.

Owner clarifications: nationwide availability, fixed and mobile services, discovery/enquiries/bookings/payments, a free validation period, quote-then-pay repairs, and official fines referrals until integration is ready. Provider supply starts at zero; the owner and colleague handle pilot operations. See [the current answers](planning/OWNER-QUESTIONS.md) and [verification corrections](planning/research/codex-verification.md).
