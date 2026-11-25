# A5 · Sign in and sign up

**Purpose:** static mockup for owner approval before anything is built. Synthetic data only; uses the live `home.css` and `landing.css` (copied into `../_shared/`) plus new `rd-` pieces in `../_shared/redesign.css`.

**Backlog IDs served:** B-10, B-11, B-03 (see `planning/claude/BACKLOG.md` on `claude/backlog`, PR #163).

## States

| State | Source | Screenshots |
|---|---|---|
| Sign up, consent not ticked | [`a5-1-sign-up-unticked.html`](a5-1-sign-up-unticked.html) | [1280](png/a5-1-sign-up-unticked-1280.png) · [390](png/a5-1-sign-up-unticked-390.png) |
| Sign up, consent ticked | [`a5-2-sign-up-ticked.html`](a5-2-sign-up-ticked.html) | [1280](png/a5-2-sign-up-ticked-1280.png) · [390](png/a5-2-sign-up-ticked-390.png) |
| Sign in | [`a5-3-sign-in.html`](a5-3-sign-in.html) | [1280](png/a5-3-sign-in-1280.png) · [390](png/a5-3-sign-in-390.png) |
| Google first-time consent step | [`a5-4-google-first-time-consent.html`](a5-4-google-first-time-consent.html) | [1280](png/a5-4-google-first-time-consent-1280.png) · [390](png/a5-4-google-first-time-consent-390.png) |

## Design notes (why)

- **Inside the shared shell:** same header and footer as every page, with a short reason-to-join on the left (hidden on phones to keep the form first).
- **Consent first (a5-1):** *Create account* and *Sign up with Google* are visibly disabled (grey, Google's G greyed too) until the box is ticked, with *Tick the box above to continue.* underneath. The server still checks it.
- **Ticked (a5-2):** both buttons turn on.
- **Google button:** the standard multicolour G on the left, label centred. No "Use Google redirect instead" link (B-11); the redirect stays only as a hidden fallback.
- **Sign in (a5-3):** Google first because most people use it; email below.
- **Google first-time consent (a5-4):** a new Google user from *Sign in with Google* gets one extra step with the account shown, the same consent box, *Create account* and an honest *Cancel, don't create an account*.
