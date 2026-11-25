# A7 · Admin ID review queue

**Purpose:** static mockup for owner approval before anything is built. Synthetic data only; uses the live `home.css` and `landing.css` (copied into `../_shared/`) plus new `rd-` pieces in `../_shared/redesign.css`.

**Backlog IDs served:** B-21 (see `planning/claude/BACKLOG.md` on `claude/backlog`, PR #163).

## States

| State | Source | Screenshots |
|---|---|---|
| Admin ID review queue | [`a7-1-queue.html`](a7-1-queue.html) | [1280](png/a7-1-queue-1280.png) · [390](png/a7-1-queue-390.png) |
| Admin ID review detail | [`a7-2-detail.html`](a7-2-detail.html) | [1280](png/a7-2-detail-1280.png) · [390](png/a7-2-detail-390.png) |
| Admin ID review queue, empty | [`a7-3-empty.html`](a7-3-empty.html) | [1280](png/a7-3-empty-1280.png) · [390](png/a7-3-empty-390.png) |

## Design notes (why)

- **Queue (a7-1):** oldest first, with the waiting time (red past the target), document type and **masked ID** (last 4 only). Phones get stacked cards.
- **Detail (a7-2):** photo on the left (zoom, rotate), facts and checks on the right. The ID number stays masked behind **Reveal**, which shows it for 30 seconds and is logged with the reviewer's name. Automatic checks (checksum, date of birth) are ticked; the two human checks are marked *check by eye*.
- **Decision:** one green *Approve ID*; reject needs a **reason from a fixed list** (plus an optional note), so the person always learns why (A6-3).
- **Empty (a7-3):** *The queue is clear*, with a note that the team is emailed if an ID waits more than 4 hours.
