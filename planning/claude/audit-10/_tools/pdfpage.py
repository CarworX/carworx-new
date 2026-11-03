# Route P: render PDF pages to PNG at 110 dpi with PyMuPDF.  python -I pdfpage.py <pdf> <outDir>
import sys, pymupdf, os
pdf, out = sys.argv[1], sys.argv[2]; os.makedirs(out, exist_ok=True)
d = pymupdf.open(pdf); print('pages', d.page_count)
for i, p in enumerate(d): p.get_pixmap(dpi=110).save(os.path.join(out, f'43-pdf-p{i+1:02d}.png'))
