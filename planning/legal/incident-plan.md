# Incident plan (PLAN §9.4, G-PROD)

> **Draft for owner approval.** 2026-11-10 (SAST). Not legal advice (D-045). Covers the free site. All times in SAST.

## 1. Roles

| Role | Who | Does |
|---|---|---|
| **Incident lead** | The owner, as Information Officer (D-043) | Decides, notifies the Regulator and the people affected, holds all production access |
| **Deputy** | [a cofounder, if registered as Deputy Information Officer or Admin Officer, see guide 13] | Acts when the owner can't be reached |
| **Agents** (Claude, Codex) | Repository only | Read code and logs the owner shares, write fixes as PRs, draft notices. **No production access** (PLAN §12) |

## 2. What counts as an incident

| Severity | Examples | First response |
|---|---|---|
| **S1: personal information exposed** | A mobile base location appears in public output; a database login or key leaks; someone signs in as another person; a backup copy is exposed | Within **1 hour** of discovery |
| **S2: service down** | The project is paused; search returns "unavailable"; sign-in fails for everyone | Same day |
| **S3: quality** | A wrong listing, a misleading label, a broken page | Next business day |

**Rule:** if in doubt, treat it as S1. POPIA s22 needs only "reasonable grounds to believe" that information was "accessed or acquired by any unauthorised person"; the Regulator says the compromise "does not have to be confirmed before it is reported" and there is "no threshold" (Breach fact sheet).

## 3. The S1 steps

```
discover ─► 1 contain ─► 2 log ─► 3 assess ─► 4 notify Regulator ─► 5 notify people ─► 6 fix ─► 7 review
                                                  (eServices portal)      (in writing)
```

| Step | What | Who | Basis |
|---|---|---|---|
| 1. **Contain** | Revoke or rotate the exposed secret (section 5); take the affected route off by deploying the last good version; pause a listing | Owner | s19(1) |
| 2. **Log** | Start an incident record: time found, who found it, what's affected. Keep it private; no secret values | Owner | s17 (documentation) |
| 3. **Assess** | Which people, what data, from when to when, who accessed it if known | Owner, with agents on code and logs | s22(5) needs these facts |
| 4. **Notify the Regulator** | On the **eServices portal**, *Services → Security Compromises → Submit New Report*. It's mandatory to use the portal since 1 April 2025. Report "as soon as reasonably practicable based on the information at hand", then update it | Owner (only registered officers can submit) | s22(1)(a), (2); Breach portal notice; Breach steps guide |
| 5. **Notify people** | **In writing**, by email to their last known address, and on the website if many are affected. Keep the website notice up for 30–90 days | Owner; agents draft | s22(1)(b), (4)(b), (c); fact sheet "Thirty to ninety days is a general rule of thumb" |
| 6. **Fix** | A reviewed PR; exact-head CI; owner-run release | Agents, owner | — |
| 7. **Review** | Within 2 weeks: what failed, what changes, update this plan | Owner, agents | s19(2)(d): safeguards "continually updated" |

**Delay** in telling people is allowed **only** if a public body investigating offences, or the Regulator, decides notification "will impede a criminal investigation" (s22(3)). Record any delay and its reason, because the Regulator asks for it (fact sheet).

**The portal report needs:** the industry, where it happened, a description, **how people were told, with samples of the notice** (mandatory upload), the impact, whether the data was retrieved and the remedial steps (Breach steps guide, sections 5.1–5.5). So step 5's notice must be ready before the report is finished.

**If an operator has the breach** (Supabase, Cloudflare, Mapbox, Google, the email provider), the operator "must notify the responsible party immediately" (s21(2)). CarworX then notifies the Regulator and the people. The operator's notice doesn't replace CarworX's.

## 4. Notice to people: template

> **Subject: Important: a security incident affecting your CarworX information**
>
> On [date] we found that [what happened, in one sentence]. It affected [what information] between [dates].
> **What this could mean for you:** [possible consequences].
> **What we've done:** [steps taken].
> **What you can do:** [for example: change your password; watch for emails pretending to be us; if you're a mobile provider, consider changing your base point].
> [If known: who accessed it.]
> Questions: [privacy@ address]. You can also complain to the Information Regulator (inforegulator.org.za).

*Basis: s22(5)(a)–(d): consequences, measures taken, recommended steps, and "if known … the identity of the unauthorised person".*

## 5. Secrets: what to rotate and where

| Exposed | Rotate | Where |
|---|---|---|
| `SEARCH_CURSOR_KEY` | New random value | Worker secret. Safe at any time; open cursors and map links stop working |
| `SEARCH_LIMITER_SALT` | New random value | Worker secret. Counters reset |
| `MAPBOX_SERVER_TOKEN` | Revoke in Mapbox, create a new one | Mapbox account, then Worker secret |
| `catalogue_server` password | `alter role … password … valid until …` | Supabase SQL editor, then the Hyperdrive config |
| `SUPABASE_PUBLISHABLE_KEY` | Rotate in Supabase API settings | Then Worker secret |
| Turnstile secret | Rotate in the Turnstile widget | Then Worker secret |
| Database password, Cloudflare or Supabase login | Change; check for unknown sessions and tokens | Each dashboard |
| Backup private key | Re-encrypt every backup to a new key; destroy old copies | Owner offline |

## 6. S2: the site is down

1. Check the Supabase project state. If **paused**, restore it ([backup-and-pause.md](../runbooks/backup-and-pause.md) §3).
2. Check Cloudflare for errors on the Worker. Roll back to the last good version if a deploy caused it.
3. Check the daily Mapbox and Hyperdrive limits: search fails closed when a quota is used up (D-082, D-081). That's by design; it recovers the next day.
4. Post a short notice on the home page if it lasts more than an hour.

## 7. Practice

Run a **tabletop drill** before G-PROD: walk through one S1 case (a leaked `catalogue_server` password) with this plan, time each step and record the result in the G-PROD checklist.

**Approved by:** ________ (owner) on ________ (SAST)
