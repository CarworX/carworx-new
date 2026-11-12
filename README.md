# CarworX

A South African car-care marketplace at carworx.app, covering wash and detailing, repairs, glass, tyres and vehicle administration.

Foundations and Phase 2 work are in progress. Read [current status](planning/STATUS.md) for scope and blockers; merged code does not establish production readiness.

| Reference | Purpose |
|---|---|
| [AGENTS.md](AGENTS.md) | Shared agent instructions and targeted context loading |
| [STATUS](planning/STATUS.md) | Current work, blockers and gates |
| [DECISIONS](planning/DECISIONS.md) | Binding agreements and owner directions, including amendments |
| [PROTOCOL](planning/PROTOCOL.md) | Planning turns and agreement procedure |
| [PLAN](planning/PLAN.md) | Technical plan; later owner decisions take precedence |
| [OWNER-QUESTIONS](planning/OWNER-QUESTIONS.md) | Owner answers and outstanding questions |
| [HISTORY](planning/HISTORY.md) | Append-only evidence; load when needed |

The owner's baseline stack is Supabase, Cloudflare Workers, Resend, Mapbox and Paystack; later payment-provider decisions are tracked in DECISIONS. Free tiers first; paid items require owner approval. The brand is Turbine with the Studio UI direction.

Build, test, staging, production, payments and other consequential actions retain their separate approval and evidence gates. See STATUS and the relevant decisions before acting.
