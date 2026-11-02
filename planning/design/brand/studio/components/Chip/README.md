# Chip

Small pills: **filter chips** people toggle, **labels** that state a fact, **slots** for times, and **actor chips** for who acts in a journey.

- `cx-chip` toggles a filter; set `aria-pressed`. `.on` is ink with white text.
- `cx-label` states what was checked or what state something is in: default ok (done, paid, checked), `.info` (sky), `.warn` (waiting, expiring), `.err` (problem). **Every label is a word**; colour is never the only signal. Labels can't be bought: never use them for promotion.
- `cx-demo` marks fictional businesses in concepts and demos.
- `cx-slot` shows a time in mono: `.on` chosen, `.off` taken (struck through, canvas-2).
- `cx-actor` names who acts in a step: the driver (ink), the business (`.business`), CarworX (`.carworx`).

**Contrast:** ok 5.7:1, warn 5.8:1, err 6.6:1 on their grounds; blue-ink on sky 5.3:1.
