# ReceiptQuote

Written quotes and payments as a receipt: mono lines, dashed rules, a zig-zag torn edge.

- **Quote:** the version in the header, every line with its price, the CarworX fee (R0 in the pilot), the total incl. VAT, what it replaces (struck through) and the expiry (7 days by default).
- A sent quote can't be edited: a revision is a new version and the old one can no longer be paid. Extra work found later is a separate **change quote** (C1, C2…).
- The APPROVED stamp sits in its own space under the total, never over a number.
- **Paid receipt:** who was paid, by which route, and that CarworX never holds the money.
- Prices in `price` style with a space as thousands separator: R2 430.
