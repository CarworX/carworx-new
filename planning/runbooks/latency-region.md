# Latency and region: London or Frankfurt (PLAN §4, G-PROD)

**Status:** method and script ready, 2026-11-10 (SAST). **Not run.** Agents don't run it against any hosted target; the owner runs it.

**Why:** PLAN §4 says London is provisional and that G-PROD needs "measured latency (London vs Frankfurt, from JNB and CPT)". Supabase can't move a project to another region, so this decides the production region once. The staging project is in Frankfurt (`eu-central-1`, K2 README), so this also tells us whether staging is a fair stand-in.

## 1. What actually adds delay

```
visitor (JNB or CPT) ─► Cloudflare edge in SA ─► Worker runs there ─► Hyperdrive ─► Supabase (London or Frankfurt)
         a few ms                                              └────── one round trip to Europe per query ──────┘
```

Pages are rendered at the South African edge, so the visitor's own trip is short. The cost that changes with the region is the **round trip from South Africa to the database region**, paid once or twice per search page. So the useful measurement is the network round trip from a South African connection to each AWS region.

## 2. Method

| Choice | What | Why |
|---|---|---|
| Targets | `ec2.eu-west-2.amazonaws.com:443` (London) and `ec2.eu-central-1.amazonaws.com:443` (Frankfurt) | Public AWS regional endpoints in the same regions Supabase uses ([Regions](https://supabase.com/docs/guides/platform/regions), read 2026-11-10). Not a CarworX resource |
| Measure | TCP connect time (about one round trip) and the TLS handshake time | Closest no-account proxy for a database round trip |
| Samples | 30 per target, alternating, 200 ms apart | Enough for a stable median and p95 |
| Where | Once from a **Johannesburg** connection and once from a **Cape Town** connection | PLAN §4 |
| Proof of city | The script records Cloudflare's edge code (`JNB`, `CPT`) from Cloudflare's public trace page. **It drops the IP address** that the page also shows | The receipt shows the city without personal data |
| Time | Each run at a normal busy time, for example 12:00–14:00 SAST on a weekday, and a second run in the evening | Shows congestion, not just a quiet line |
| Verdict rule | A region "wins" only if its TCP median is at least **10 ms** lower in **both** cities, and each target failed **at most 10%** of samples with **at least 5** successes. Otherwise the run says `no-result` | Small gaps are noise; then other factors decide (section 4) |

**Limits, stated honestly:** this measures network round trips, not the full page. It doesn't include Hyperdrive's own overhead or query time, which are the same for both regions. The Cape Town run needs someone on a Cape Town connection; a mobile hotspot while travelling is fine.

## 3. Steps for the owner

You need Node 24 (already used for this repo) and a checkout of `main`.

1. On a Johannesburg connection, run:
   ```
   node scripts/ops/latency/measure.js --label jnb --out latency-jnb.json
   ```
   It takes about 30 seconds and prints a JSON summary.
2. Check that `edge.colo` says `JNB`. If it says something else (for example `CPT` or a European code), note it; your provider routes you elsewhere.
3. On a Cape Town connection, run the same with `--label cpt --out latency-cpt.json`. Check that `edge.colo` says `CPT`.
4. Optional, second sample: repeat both in the evening, with labels `jnb-evening` and `cpt-evening`.
5. **Optional, staging database:** to time the real staging host too, add `--target staging-db=<staging database host>:5432`. The host name isn't secret. Only do this if you're happy for the script to open a connection to your staging project (it opens and closes a socket; it doesn't log in).

**Send back:** the JSON files. They contain no IP address, no password and no token.

## 4. Deciding

| Result | Decision |
|---|---|
| One region wins in both cities (section 2 rule) | Choose it, unless the section 72 assessment rules it out |
| "within-margin" in either city | Latency doesn't decide. Prefer **Frankfurt**, to match staging (the same region gives the same timings in tests), unless the section 72 assessment prefers London |
| `tcp_verdict` is `no-result`: a target failed more than 10% of its samples, or had fewer than 5 successes | Re-run on another connection; don't decide on that run |

The owner records the choice in DECISIONS (a new D- entry) with the receipt files' SHA-256. The section 72 assessment then names the region.

## 5. What this doesn't cover

Hosted application timing (BLOCKER in STATUS) is a separate test on staging after the first app deployment. It's still required. This check only picks the region.
