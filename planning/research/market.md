# South African market notes

Researched by Claude, 2026-10-27. A first pass only; deeper competitor research is an open task.

## Existing players (partial)

- **Michanic:** on-demand mobile mechanics, showcased at the Festival of Motoring 2025. Reported funding of about $400k (unverified directory figure) ([startuplist.africa](https://startuplist.africa/startup/michanic), [Eswatini Financial Times](https://eswatinifinancialtimes.africa/?p=2303)).
- **Car wash apps:** MobiWash, Mowash, Kool Wash, Clean Car Co. (Tembisa), My Washbay (aimed at operators). Most coverage is from 2018–2020, and their current traction is unknown ([Disrupt Africa 2020](https://disrupt-africa.com/2020/09/16/how-this-township-entrepreneur-turned-to-tech-to-scale-his-car-washing-startup-across-sa/), [vc4a](https://vc4a.com/ventures/clean-car-co/)).
- **Trend:** in March 2026 the Saturday Star reported drivers increasingly booking mechanics like ride-hailing because of rising costs ([The Star](https://thestar.co.za/saturday-star/news/2026-03-30-why-south-africans-are-booking-mechanics-the-same-way-they-hail-rides)).
- **Big brands customers already search for by name:** Tiger Wheel & Tyre, Supa Quick, Hi-Q and Dunlop Zone for tyres and alignment; PG Glass and Glasfit for auto glass. **The fact that tyres and glass have their own national brands matters for the feature-structure decision (T-02).**
- **Fines:** Fines SA, Paythat (Cape Town), EasyPay, Paycity.

**Gap CarworX targets:** nobody combines wash, repairs, glass, tyres and fines with booking and payment in one place. Most players do one vertical.

## Local product realities

- **Spelling and language:** South African English, so **"tyre", not "tire".** Consider isiZulu and Afrikaans later.
- **Mobile data is expensive and Android-heavy:** keep the site light, make it a PWA (installable from the browser, works with a weak signal), and avoid large map loads on first view.
- **WhatsApp is the main messaging channel.** Notifications by WhatsApp will out-perform email, but the WhatsApp Business Platform charges per conversation. That's a paid item to plan for, with email (Resend) as the free default.
- **Load-shedding and connectivity:** providers may be offline. Booking confirmation shouldn't need the provider to be online at that moment.
