# ServiceKey

The five service shortcuts, the product's front door: soft-3D key-caps on desktop, compact key rows on phones.

**Rules (from PLAN D-001 and the brief)**
- Always all **five**, always **equal** in size and style, always in this order with the full wording: Wash & Detailing; Repairs & Maintenance; Glass Repair & Replacement; Tyres & Wheel Alignment; Fines & Vehicle Admin.
- On a 360 × 640 phone all five key rows are visible without scrolling.
- Keep "&" with the word before it (`Wash&nbsp;&amp; Detailing`) so a line never starts with "&".

**Anatomy:** the service object (asset group *Objects*, 68px on keys, 46px in rows), a mono number top-right (keys only), the label in `label` weight 500, and an optional one-line hint in muted.

**States:** hover and focus lift 8px on a spring and fade sh-3 in; pressed sinks 4px; focus adds the 2px ink ring. Under reduced motion the key changes shadow only, no movement.

**Layout:** 5 columns from 1061px; 3 + 2 below that; 2 columns under 600px; phone screens use `cx-keyrow` in one column (60px rows).

**Consumer provides:** the five links, in order. Nothing else may sit inside the key row; promotions or sponsored labels never go on a key.
