# CarworX privacy notice (free site)

> **Draft for owner approval.** 2026-11-10 (SAST). Not legal advice (D-045). The right-hand "Basis" notes are for the reviewer and are removed before publishing. Bracketed items wait on owner questions in the [README](README.md). Publish only after OQ-L3 (the 2025 amended Regulations) is checked.

**Version:** draft 1 · **Applies from:** [launch date]

## 1. Who we are

| | |
|---|---|
| Responsible party | [CarworX: legal name and status, OQ-L1] |
| Address | [physical address, OQ-L2] |
| Email | [privacy@ address, OQ-L2] |
| Information Officer | [owner's name], registered with the Information Regulator on [date] |

*Basis: POPIA s18(1)(b) (name and address); s55(2) (officers act only after registration).*

## 2. What this covers

This notice covers carworx.app: searching for car-service providers, reading listings and guidance, creating an account, applying to list a business, and contacting us. During the free pilot **no payments are taken** on CarworX.

## 3. What we collect, why, and on what basis

| What | When | Why | Basis (POPIA s11(1)) | Must you give it? |
|---|---|---|---|---|
| Name, email address, profile picture | You sign up with email or with Google | To run your account | (b) contract: our terms of use | Yes, to have an account. Without it you can still search |
| Password | You sign up with email | To sign you in. Stored by our database provider as a one-way hash; we never see it | (b) contract | Yes, for email sign-in |
| Two-step sign-in code setup | Admins only | Admin security | (f) our legitimate interest in protecting the site | Yes, for admins |
| The place you search for (a suburb, town or postcode you type) | You search | To find providers near you. We send it to our map provider once to find the point, then **discard** it. We don't store it | (f) legitimate interest: to answer your search | No. Without it, you can browse categories |
| Search point and radius | You search | Rounded to about 1 km for mobile providers. Used for that search only; not stored with your account | (f) | No |
| A random search cookie and a scrambled form of your IP address | You search | To stop abuse (too many searches). The scrambled IP can't be read back without our secret key | (f) legitimate interest: keeping the service available and providers' locations safe | No; the site needs it to search |
| Business details, contact person, service area, and for mobile businesses a **private base location and radius** | You apply to list a business | To review and publish the listing. **The base location is never shown publicly** | (b) contract with the provider | Yes, to be listed |
| Verification evidence | You apply | To grant honest trust labels. Raw evidence is deleted after review (see section 7) | (b) and (f) | Only for the label it supports |
| Your enquiry: your name, email address, the message, and the service and area you ask about | You send an enquiry to a provider (when the enquiry form launches) | To pass it to **the provider you chose**, so they can reply, and to handle any complaint | (b) actions towards a contract you asked for; (f) | Yes, to send an enquiry |
| Your messages to us | You contact support | To answer you | (f), or (b) if about your account | No |
| Marketing email permission | Only if you tick the box | To send news. The box is **never** ticked for you | (a) consent; s69(1)(a) | No |
| Security logs, with addresses and coordinates removed | Every request | To keep the site working and safe | (f) | — |

We **don't** collect ID numbers, card details or bank details during the free pilot. We don't ask **customers** for a home or street address. **Mobile providers** do give us a private base location: if a provider uses their home, that is an exact home location, which is why we advise against it (terms of use, section 7). *Basis: PLAN §9.2 "No ID numbers in v1"; POPIA s10 (minimality).*

## 4. Cookies

| Cookie | Why | How long |
|---|---|---|
| `__Host-cx-auth…` (sign-in) | Keeps you signed in. Secure and not readable by page scripts | Until you sign out, or up to about 13 months |
| `__Host-cx-search` | A random value used only to limit searches | 24 hours |
| A security cookie for forms | Stops forged form posts | The session |

No advertising or tracking cookies. *Basis: cookie names and lifetimes from `apps/web/app` at `b899190`.*

## 5. Who we share it with

We share information in two ways, and only what each recipient needs:

- **With the provider you choose.** When you send an enquiry, we pass your name, email address and message to that provider so they can reply. The provider then uses it as its own responsible party, under its own obligations.
- **With companies that run parts of the service for us (operators)**, under their data processing terms:

| Operator | What it does | Where |
|---|---|---|
| Supabase | Database, sign-in and file storage | Database in [London, UK / Frankfurt, Germany], chosen at launch. Supabase may process data "anywhere that Supabase or its Sub-processors maintain facilities" subject to its transfer terms |
| Cloudflare | Hosting, security, abuse limits, and the form check (Turnstile) | Its global network, including South Africa |
| Mapbox | Turns the place you type into a map point, and draws the optional map | United States |
| Google | "Sign in with Google", if you choose it | United States and elsewhere |
| [Email provider, gap P-4] | Sign-in and account emails | [e.g. Resend: account data stored in the United States] |

When a provider is listed, **the public listing** (business name, services, area served and, for fixed premises, the address) is public by design. A mobile provider's base is never public.

We don't sell personal information. *Basis: POPIA s18(1)(h)(i) (recipients); s20 and s21 (operators, written contract).*

## 6. Information sent outside South Africa

Our database and most of our operators are outside South Africa. We send information abroad only as POPIA section 72 allows. The main ground is that each operator is bound by written terms giving protection substantially similar to POPIA, including for onward transfers (s72(1)(a)). For your account and listing, the transfer is also needed to perform our agreement with you (s72(1)(c)). Our assessment is available on request.

*Basis: POPIA s18(1)(g); s72(1)(a), (c). See [s72-cross-border.md](s72-cross-border.md).*

## 7. How long we keep it

| Information | Kept for |
|---|---|
| Your account | Until you close it, then deleted within 30 days |
| Search place text | Not kept |
| Search abuse counters | Up to 24 hours [after gap R-1 is fixed] |
| A mobile provider's base location | Until the listing is removed, then 30 days |
| Raw verification evidence | Deleted within 30 days of the decision |
| Support messages | 3 years after the case closes |
| Redacted logs | 30 days |
| Backups | Up to 5 weeks, then overwritten |

Full schedule: [retention-schedule.md](retention-schedule.md). *Basis: POPIA s14(1) and (4).*

## 8. How we protect it

Encrypted connections, private storage, database rules that limit each person to their own records, two-step sign-in for admins, redacted logs and encrypted backups. If we believe your information has been accessed by someone unauthorised, we'll tell you and the Information Regulator as soon as reasonably possible. *Basis: POPIA s19 (safeguards); s22 (notification).*

## 9. Your rights

You can:
- ask whether we hold information about you and get a copy (free to ask whether we hold it);
- ask us to correct or delete it;
- object to processing based on our legitimate interests, and object to direct marketing at any time;
- withdraw consent you gave, without affecting earlier processing;
- complain to the Information Regulator.

Email [privacy@ address]. We'll ask for proof of identity before releasing anything.

*Basis: POPIA s5 (rights); s11(2)(b), (3), (4) (withdrawal and objection); s23(1) (access, "free of charge" confirmation, "adequate proof of identity"); s24 (correction and deletion); s18(1)(h)(iii)–(v).*

## 10. The Information Regulator

Information Regulator (South Africa), Woodmead North Office Park, 54 Maxwell Drive, Woodmead, Johannesburg 2191. Phone 010 023 5200. enquiries@inforegulator.org.za. Website inforegulator.org.za.

*Basis: POPIA s18(1)(h)(v); contact details from the Regulator's eServices "About" page and breach fact sheet, read 2026-11-10. Recheck before publishing.*

## 11. Age

CarworX is for people aged 18 and over. [OQ-L6] *Basis: POPIA s1 "child"; s34.*

## 12. Changes

We'll post any change here with a new version number and date, and email account holders about material changes.

---

### Reviewer notes (remove before publishing)

- **Enquiries:** the provider is a recipient (s18(1)(h)(i)), named in sections 3 and 5. The form itself is Bundle B (P2-5); keep this row in step with it.
- **s18 checklist:** (a) section 3; (b) section 1; (c) section 3; (d), (e) section 3 "Must you give it?"; (f) none: no law requires the collection; (g) section 6; (h)(i) section 5; (h)(ii) section 3; (h)(iii), (iv), (v) sections 9 and 10.
- **s69:** marketing needs an opt-in box, off by default (Claude 17 §3). Each marketing email must carry the sender's identity and an opt-out (s69(4)). ECTA s45(1) also requires an opt-out option. Marketing isn't planned for launch.
- **Google (PLAN §9.1):** scopes `openid email profile` only; Google named as a sign-in provider. Done in sections 3 and 5.
- **Search data:** matches PLAN §6.2 and D-082 (geocodes never stored). The privacy claim "discard" relies on A17.
- **Gap R-1:** the limiter Durable Objects currently keep their counter rows with no expiry (`limiter.ts` at `b899190` has no alarm or delete). The 24-hour claim in section 7 is **false until that's fixed**. See the retention schedule.
