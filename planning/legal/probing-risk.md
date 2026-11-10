# Probing residual-risk assessment (PLAN §6.2, G-PROD)

> **Draft for owner approval and written acceptance.** 2026-11-10 (SAST). PLAN §6.2: "repeated coarse probes can still narrow down where a base is. Record it in the pre-production privacy assessment and obtain approval of the mitigation before G-PROD; do not claim anonymity or assume the owner's/providers' risk acceptance."

## 1. What's at risk

A **mobile provider** (a mobile mechanic, a mobile car wash) gives CarworX a private **base point** and a **radius**. For a sole trader, the base is often their **home**. POPIA treats it as personal information: "location information" (s1, "personal information" (c)), and the definition also covers an "identifiable, existing juristic person". POPIA s19(1) requires "appropriate, reasonable technical and organisational measures" to prevent "unlawful access to or processing of personal information".

## 2. What's already built (P2-1, P2-2; checked in code at `b899190`)

| Control | Where | Effect |
|---|---|---|
| The base and radius live only in the private `service_areas` table; only the `listing_eligibility` role reads them | P2-1, Claude 17 §2.3 | Not in any public view, page, map or log (A10) |
| The eligibility function returns only `public_id` values | `private.mobile_eligible_ids` | No distance, geometry or order hint leaves the database |
| Mobile results are ordered by a random, stable public ID, never by distance | Claude 17 §2.1 | Position in the list reveals nothing |
| The search point for mobile matching is **rounded to 2 decimal places** (about 1.1 km north–south, about 1 km east–west in South Africa) | `p2_2_search.sql` lines 112–113 | A probe can't be finer than the grid |
| Only four radii (5, 10, 25, 50 km) and bounded page sizes | `handler.ts` `RADII` | No free-form inputs |
| Rate limits: **30 searches a minute per IP** and **60 per 10 minutes per search cookie**, both fail closed | `limiter.ts` | Slows a single source |
| No anonymous RPC; the database login can only run the search wrapper | D-081 | No direct database probing |
| Moving a base while the point stays inside the radius leaves the response byte-identical | Claude 17 §2.1 tests | No side channel through response bytes |

## 3. The remaining attack, stated plainly

The only signal an attacker gets is **in or out**: "does provider X appear for point P?". The set of points where X appears is a disc of the provider's radius around the base, blurred by the 1 km grid.

```
     probe grid (1 km)          what the attacker learns
   · · · · · · · · · ·
   · · · ● ● ● · · · ·          ● = provider appears
   · · ● ● ● ● ● · · ·          the disc's centre ≈ the base,
   · · ● ● ● ● ● · · ·          more precisely with every extra row
   · · · ● ● ● · · · ·
   · · · · · · · · · ·
```

| Question | Honest answer |
|---|---|
| How many probes? | A first estimate takes a binary search of about 5–6 probes per edge; four edges give a rough centre. **About 20 to 40 searches.** Each further row of probes adds more in/out boundary points |
| Does the rate limit stop it? | **No.** 40 searches fit inside two minutes from one IP. The limit stops **bulk** mapping of every provider from one source, not a targeted look at one provider |
| How precise is the result? | **No floor is proven.** The grid rounds the *search point*, but the database compares it against the **exact** stored centre and radius. Combining in/out answers from many different grid rows can locate the centre **more precisely than the grid spacing**, possibly to a few hundred metres or better, given enough searches. **Assume a determined person can find the home** |
| Who might do it? | A competitor, an ex-partner or someone with a grudge against a named provider. Mass scraping is slowed by the limits |
| Can CarworX tell it's happening? | Not today: no monitoring looks for grid-shaped search patterns |

**Conclusion:** the controls stop casual and bulk inference. A **determined person targeting one provider can locate the base, and the precision improves with the number of searches.** Rounding and rate limits only slow this down. The only reliable fix is what the base point is (M1).

**Not yet measured (action V-1):** an agent simulation, run locally against the real eligibility predicate, of how precision improves with the number of searches for each radius. It's for information only: the advice in M1 doesn't depend on its result, and no figure from it may be presented as a safe limit.

## 4. Mitigation proposed for approval

| # | Mitigation | Strength | State |
|---|---|---|---|
| M1 | **At onboarding, tell mobile providers plainly** that **someone determined could work out where their base is**, and **advise them to use a base point that isn't their home**, for example a public landmark or business address inside their area. Their radius then still covers their real area | Strongest. Removes the home from the data | **Wording in the terms (section 7)**; Bundle A's application form must show it and record that it was shown |
| M2 | Keep the controls in section 2, and keep tests A9–A11 required in CI | Medium | Built |
| M3 | Never publish a mobile provider's suburb or anything derived from the base | Medium | Built (A10) |
| M4 | **Later:** an admin report of search sources that sweep a grid around a single listing | Detection only | Not built. Proposed after launch |
| M5 | **Later:** let mobile providers describe their area as a **list of suburbs** instead of a disc | Removes the centre entirely | Not built. Phase 3 candidate |

**Not proposed:** a coarser grid (for example 5 km). It would wrongly show or hide providers near their edge, and it still only blurs the centre.

## 5. What the owner is asked to accept

1. The residual risk in section 3, with mitigations M1 to M3 at launch.
2. That CarworX **never claims** a base is "anonymous" or "can't be found". The wording is "kept private and never shown".
3. That each provider makes their **own** choice of base point after reading M1's notice. CarworX doesn't accept the risk on a provider's behalf.

**Accepted by:** ________ (owner) on ________ (SAST)
