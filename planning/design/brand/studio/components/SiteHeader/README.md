# SiteHeader

The one header for every public page: the frosted landing pill, fixed 16px from the top, aware of whether you are signed in.

Supersedes the per-page headers (landing `.nav`, `SitesShell`, `PublicShell`). Built on **NavBar** (`.cx-nav`, `.cx-menu`, `.cx-sheet`); this spec adds the signed-in parts.

## Anatomy
1. Lockup (horizontal ink, 120px; links to `/`).
2. Three links, centred: **Find a service** (`/#services`), **Fines** (`/#fines`), **For businesses** (`/#business`). No "How it works", no "All services", no separate find-a-service page.
3. Account area. Signed out: **Sign in** (text) and **Sign up** (primary, arrow). Signed in: **avatar button** (`.cx-avbtn`: initials in `.cx-av`, first name, chevron) that opens the **account menu** (`.cx-acctmenu`).
4. Account menu, in this order: who (name and email), **My fines** with a count, **Account**, **My business**, a rule, **Sign out** (muted).
5. At 900px and below: links and account area hide; the 44px menu button opens the sheet. Signed in, the avatar (`.cx-av.dot` when fines are open) sits beside the menu button.
6. Sheet (signed in): who, the three links, **My fines · 3**, Account and My business side by side, then Sign out as a quiet text button.

## States
- signed out · signed in (menu closed) · menu open · phone sheet signed out · phone sheet signed in
- **pinned** (`.cx-nav.pinned`): after the first 24px of scroll the pill gets a stronger frost and `--sh-2`, so text passing under it stays readable. Same size; it never shrinks or hides.
- current section: the matching link gets `aria-current` (ink text).

## Tokens used
`--frost`, `--blur-frost`, `--sh-1`/`--sh-2`/`--sh-3`, `--radius-pill`, `--radius-lg`, `--ink`, `--muted`, `--sky`, `--blue-soft`, `--blue-ink`, `--signal` (the count and the dot), `--hair`, `--canvas`.

## Do / Don't
- Do show the same header on landing, category, search, listing, sign in and up, fines and legal pages.
- Do keep Sign out apart and muted; it is never the first item.
- Don't show Sign in / Sign up to a signed-in person anywhere (the old headers did).
- Don't add a fourth link; new destinations go into the account menu or the footer.
- The menu is a disclosure (`aria-haspopup="menu"`, `aria-expanded`); Esc and an outside click close it and return focus to the button.

## Screens
`planning/design/redesign-2026-11/A1-shell/png/a1-1-signed-out-1280.png`, `a1-2-signed-in-menu-*.png`, `a1-3-mobile-sheet-signed-out-390.png`, `a1-4-mobile-sheet-signed-in-390.png`, `a1-5-scrolled-*.png`.
