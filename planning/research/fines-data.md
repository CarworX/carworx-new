# Traffic fines lookup in South Africa

Researched by Claude, 2026-10-27. **This is the highest-risk feature in the product,** because it depends on data CarworX doesn't control.

## Findings

- **There is no official public developer API** for AARTO, eNaTIS or municipal fines that I could find. Official consumer lookup is at `online.aarto.gov.za` and through eNaTIS online services ([citizenhelp guide](https://www.citizenhelp.co.za/traffic/how-to-check-traffic-fines), [eNaTIS guide](https://www.citizenhelp.co.za/traffic/natis-online-services)).
- **The fine system is split:** AARTO (national, administrative, with demerit points) is being phased in across municipalities, while many areas still use criminal-procedure fines handled by each municipality. Sources disagree on the rollout dates: one says phase 1 starts 1 July 2026 with 69 municipalities, Daily Maverick describes a phased start from 1 December 2025 ([Daily Maverick, Oct 2025](https://www.dailymaverick.co.za/article/2025-10-21-aarto-changes-how-sa-pays-road-fines-while-scammers-score/); [Fines SA FAQ](https://finessa.co.za/aarto/)). **UNVERIFIED** which is current.
- **Data quality is poor.** Daily Maverick reports that a polluted eNaTIS database caused fines to be wrongly issued in pilots.
- **Scams are common:** fake fine SMSes and fake payment sites. A trustworthy, clearly sourced lookup is a real selling point, and also a reputational risk if CarworX gets the data wrong.

## Existing commercial aggregators (possible partners)

| Provider | What they say they offer | API? |
|---|---|---|
| [Fines SA](https://finessa.co.za/) | Consumer and fleet lookup and payment. Its founder told Daily Maverick its APIs connect to fine systems across South Africa in real time. Lookup takes an ID, business registration number or notice number; it says it doesn't search by number plate. [Fleet page](https://finessa.co.za/fleets/) | Implied, not published. **Contact them** |
| [Paythat](https://paythat.co.za/) | City of Cape Town fines and by-law fines, with a fleet flow | Unknown, Cape Town only |
| [EasyPay fine search](https://www.easypay.co.za/SearchFine/index) | Search and pay by ID number | Unknown |
| Paycity, Fines4U | Known South African fine-payment brands | Not found in this search. **Contact them** |

## Implications for CarworX

1. **Fine lookups need a South African ID number.** That's a "unique identifier" under POPIA, which brings stricter rules (see `compliance-popia.md`, including possible prior authorisation under section 57).
2. **Don't scrape government portals.** It's fragile, probably breaches their terms, and is legally risky.
3. **Realistic options, in order of preference:**
   - **(a) Partner API:** a commercial deal with an aggregator. Probably a per-lookup or revenue-share fee, which is a cost item.
   - **(b) Referral / deep link:** CarworX explains fines, links to official or partner lookup, and earns referral fees. No sensitive data handled. **Recommended for the MVP.**
   - **(c) Official partnership** with RTIA/RTMC. Slow and uncertain, so treat it as a long-term option.
4. **"Other vehicle services"** in the owner's brief (licence disc renewal, roadworthy certificates, towing, vehicle registration, driving licence renewal) fit naturally into this vertical. Most are booked with a provider (roadworthy test centres, towing) or are admin (licence renewal at a DLTC or online), so they work as marketplace listings even without fine data.
