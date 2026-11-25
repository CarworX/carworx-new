# ReviewItem

One review: who, when, which service, the stars, the words, the business's single public reply, and Helpful / Report.

## Anatomy
1. Top row: initials avatar, first name and initial ("Lerato M."), date and optional service in muted text, stars on the right.
2. Text, 15px, no truncation under 600 characters ("Read more" above that).
3. **OwnerReply** (`.cx-reply`): canvas panel with a 3px ink rule on the left, "Reply from Shine Studio" with the business initials, the reply text. One per review; the owner can edit it, never add a second.
4. Footer: "Helpful (12)" · *Report*. An edited review adds "Edited 20 Nov".

## Owner side (in /provider)
Tabs *Needs a reply* / *All*; a review without a reply shows a reply box (`.cx-field` textarea, "Shows as "Reply from Shine Studio". You can edit it, not add a second one.", *Post reply*, *Cancel*). A replied one shows *Edit reply*.

## Write form (customer)
Stars picker (Rating `.xl`) with a word, "Which service? (optional)", "Your review" (20 to 1 000 characters, counter), a note "One review per business. You can edit it later; we show "Edited" and the date.", *Post review*. Only for signed-in customers who sent an enquiry to that business.

## States
plain · with owner reply · edited · reported by you ("Reported. Our team will look at it.") · hidden by moderation (not shown publicly)

## Tokens used
`--surface`, `--hair`, `--sh-1`, `--canvas`, `--ink` (reply rule), `--graphite`, `--muted`, `--rating`.

## Do / Don't
- Do show first name and initial only.
- Don't let the reply look like a second review; the inset panel and the rule mark the business speaking.
- Don't allow photos in reviews at launch.

## Screens
`planning/design/redesign-2026-11/A8-reviews/png/a8-2-business-page-reviews-1280.png`, `a8-3-write-review-1280.png`, `a8-5-owner-reply-1280.png`.
