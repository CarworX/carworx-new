# A8 · Business reviews

**Purpose:** static mockup for owner approval before anything is built. Synthetic data only; uses the live `home.css` and `landing.css` (copied into `../_shared/`) plus new `rd-` pieces in `../_shared/redesign.css`.

**Backlog IDs served:** New owner request, 25 Nov 2026 (reviews) (see `planning/claude/BACKLOG.md`).

## States

| State | Source | Screenshots |
|---|---|---|
| Ratings on listing cards | [`a8-1-cards.html`](a8-1-cards.html) | [1280](png/a8-1-cards-1280.png) · [390](png/a8-1-cards-390.png) |
| Business page with reviews | [`a8-2-business-page-reviews.html`](a8-2-business-page-reviews.html) | [1280](png/a8-2-business-page-reviews-1280.png) · [390](png/a8-2-business-page-reviews-390.png) |
| Write a review | [`a8-3-write-review.html`](a8-3-write-review.html) | [1280](png/a8-3-write-review-1280.png) · [390](png/a8-3-write-review-390.png) |
| Write a review, not eligible | [`a8-4-cannot-review.html`](a8-4-cannot-review.html) | [1280](png/a8-4-cannot-review-1280.png) · [390](png/a8-4-cannot-review-390.png) |
| Business owner replies (in /provider) | [`a8-5-owner-reply.html`](a8-5-owner-reply.html) | [1280](png/a8-5-owner-reply-1280.png) · [390](png/a8-5-owner-reply-390.png) |
| Report a review | [`a8-6-report-review.html`](a8-6-report-review.html) | [1280](png/a8-6-report-review-1280.png) · [390](png/a8-6-report-review-390.png) |
| Admin review moderation queue | [`a8-7-admin-moderation.html`](a8-7-admin-moderation.html) | [1280](png/a8-7-admin-moderation-1280.png) · [390](png/a8-7-admin-moderation-390.png) |
| Business page, no reviews yet | [`a8-8-no-reviews.html`](a8-8-no-reviews.html) | [1280](png/a8-8-no-reviews-1280.png) · [390](png/a8-8-no-reviews-390.png) |

## Design notes (why)

- **Cards (a8-1):** amber stars, the average and the count on every listing card; a brand-new business shows a blue *New · No reviews yet* chip instead of zero stars, so being new never looks like being bad.
- **Business page (a8-2):** the rating sits in the header under the name and links to the reviews. The reviews section has a summary card (big average, stars, a 5-to-1 bar breakdown), the rule *Only customers who contacted this business through CarworX can review it*, and *Write a review*. Sort chips: most recent, highest, lowest, with a reply. Each review shows first name and initial, date, service, stars, text, the business's reply (indented, with a dark rule so it reads as the business speaking), *Helpful* and *Report*.
- **Write (a8-3):** large tappable stars with a word (*Good*), optional service, text with a counter, and the rule *one review per business, editable, shown as Edited*.
- **Not eligible (a8-4):** signed in but never messaged the business: explains why and offers *Send a message*.
- **Owner reply (a8-5, in /provider):** *Needs a reply* tab, one public reply per review (editable, never a second one).
- **Report (a8-6):** a dialog with fixed reasons; the reviewer isn't told who reported.
- **Admin moderation (a8-7):** reported reviews with who reported and why; the detail shows whether an **enquiry is on record**, the reviewer's history, and *Keep* / *Hide* with a required reason. The page states the rule: a low rating alone is never a reason to hide.
- **No reviews yet (a8-8):** a calm empty state on the business page that turns the gap into an invitation.
