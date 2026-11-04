# 9. Your design checks before launch (D-060)

**Why:** four checks need a person, real devices or your sign-in, so the agents can't do them. They stay **open** until you do them before the public launch (G-PROD). They are never counted as passes from screenshots.

**When:** before G-PROD. They are best done on the staging app once the screens exist in code, so you test the real thing rather than the pictures. Claude will say when staging is ready for each one.

**Where to save:** `planning/claude/audit-10/owner/` (or the folder Claude names then). To take a screenshot on Windows: press **Win + Shift + S**, drag over the area, then click the notification and **Save**.

## Check 1: the live design system (rows 13 and 14)

1. Open the CarworX Design System project in Claude, signed in.
2. Screenshot each component card and the four state cards: NotFound, NotFoundPhone, PageLoader and Loaders.
3. Save them as `13-<card>-live.png` and `14-<card>-live.png`.

## Check 2: real 200 % zoom (row 15)

1. In Chrome on a laptop or desktop, open the page Claude names, at full window width.
2. Press **Ctrl** and **+** until the zoom shows **200 %**.
3. Scroll through. Note anything cut off, overlapping, or needing a sideways scroll to read.
4. Screenshot two or three places. Save them as `15-zoom-200-<n>.png`.

## Check 3: a phone screen reader (row 19)

- **iPhone:** **Settings → Accessibility → VoiceOver → On**. Swipe right to move from item to item; double-tap to activate.
- **Android:** **Settings → Accessibility → TalkBack → On**, with the same gestures.

Go through home, search, a listing and checkout. Note whether every button is read out with a sensible name, and whether the hold timer says how much time is left. Write your notes in `19-notes.md`, and add screenshots if useful. Turn the screen reader off afterwards with the same switch.

## Check 4: real phones and browsers (row 20)

Open the same pages on:
- an iPhone, in Safari
- an Android phone, in Chrome
- a computer, in Firefox

Note anything that looks different from the others: fonts, layout, motion. Save photos or screenshots as `20-<device>-<n>.png`.

## Tell Claude

"Owner checks done, files in `owner/`". Claude opens every file, records the result, and turns any problem into a finding for a fix before launch.
