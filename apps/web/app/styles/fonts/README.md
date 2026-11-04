# Self-hosted fonts (G13)

The app serves its three faces itself. Nothing is loaded from a font service or CDN. Vite copies these files into `build/client/assets/` with hashed names, and `tokens.generated.css` declares them from `tokens.json` (`type.fonts`).

| File | Face | Official source (fetched 2026-11-04) | Source file and SHA-256 | Cut |
|---|---|---|---|---|
| `Geist-latin.woff2` | Geist, wght 200–700 | npm [`geist@1.9.0`](https://www.npmjs.com/package/geist/v/1.9.0) (Vercel; tarball sha1 `92d2fb4e428355b195973bc69ccf10b53a9ae877`, matches the registry's `dist.shasum`) | `dist/fonts/geist-sans/Geist-Variable.woff2` · `5c5588027e59e74e205b9d6c7fd877b261091cee367f6bb3a8d505da14cae512` | `72b30aae7368b5215c7974be5251782de02beb1c3ab692a659560de4fd465f96` |
| `GeistMono-latin.woff2` | Geist Mono, wght 400–500 | same package | `dist/fonts/geist-mono/GeistMono-Variable.woff2` · `cf5bf55f69e043b1ecf04b0719119b7298e94add67ebcaa709a925b945b46b25` | `04680d1beca4044a7ec9b7b23c465dae4a11cd32514ff6a201b34b51a183b75c` |
| `Caveat-latin.woff2` | Caveat, wght 500–600 | [google/fonts](https://github.com/google/fonts/tree/8c3ea249848f15b7ff6092b3e16d44ef91771cad/ofl/caveat) at commit `8c3ea249848f15b7ff6092b3e16d44ef91771cad` | `ofl/caveat/Caveat[wght].ttf` · `0bdb6b660482d31531b3945849fba5916b3ef8695da7024a9e6b9ee3c4157988` | `062f7cc6995488e3b3484a31417a19a9fce95df524c49f40d46ea62e7c525d31` |

**Licences:** SIL Open Font License 1.1. `OFL-Geist.txt` is the package's `LICENSE.txt` (it covers Geist and Geist Mono); `OFL-Caveat.txt` is `ofl/caveat/OFL.txt`. Neither declares a Reserved Font Name, so the subset keeps the family names.

**How the files were cut** (fontTools 4.68.0 and brotli 1.2.1 from PyPI, in a throwaway virtualenv): limit the weight axis to the range `tokens.json` uses, then subset to the Latin range Google Fonts serves as `latin`, keeping all layout features. The same range is the `unicode-range` in the generated `@font-face` rules.

```bash
U="U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD"
cut() { fonttools varLib.instancer "$1" "wght=$3" -o tmp.ttf && pyftsubset tmp.ttf --unicodes="$U" --layout-features='*' --flavor=woff2 --output-file="$2"; }
cut Geist-Variable.woff2      Geist-latin.woff2     200:700
cut GeistMono-Variable.woff2  GeistMono-latin.woff2 400:500
cut 'Caveat[wght].ttf'        Caveat-latin.woff2    500:600
```

Characters outside the range (for example ✓) fall back to the system face in the stack.
