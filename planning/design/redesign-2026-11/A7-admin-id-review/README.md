# A7 · Admin ID review queue

**Purpose:** static mockup for owner approval before anything is built. Synthetic data only; uses the live `home.css` and `landing.css` (copied into `../_shared/`) plus new `rd-` pieces in `../_shared/redesign.css`.

**Backlog IDs served:** B-21, D-099 (Didit Option A) (see `planning/claude/BACKLOG.md`).

## States

| State | Source | Screenshots |
|---|---|---|
| Admin ID review queue (Didit In review) | [`a7-1-queue.html`](a7-1-queue.html) | [1280](png/a7-1-queue-1280.png) · [390](png/a7-1-queue-390.png) |
| Admin ID review detail (Didit result) | [`a7-2-detail.html`](a7-2-detail.html) | [1280](png/a7-2-detail-1280.png) · [390](png/a7-2-detail-390.png) |
| Admin ID review queue, empty | [`a7-3-empty.html`](a7-3-empty.html) | [1280](png/a7-3-empty-1280.png) · [390](png/a7-3-empty-390.png) |

## Design notes (why)

**Revised 25 Nov 2026:** the admin sees **Didit's result**, not a raw photo, and only decides the cases Didit marks *In review*.

- **Queue (a7-1):** In review / Approved / Declined tabs; each row shows Didit's status, *why it needs a look* (Didit's warning in plain words), the document type, last 4 digits and waiting time (red past target). Phones get stacked cards.
- **Detail (a7-2):** Didit's checks as bars (document authentic, liveness, face match %, readable), Didit's warnings, the session reference and attempt number, and **Open session in Didit ↗** (the only way to see images; logged there). Beside it, what Didit read from the document next to the account name.
- **Decision:** one green *Approve*; *Decline* needs a reason from a fixed list plus an optional note, and uses one of the person's 3 tries, so the reason always reaches them (A6-4).
- **Empty (a7-3):** "Nothing waiting for review" while Didit handles everyone automatically.
