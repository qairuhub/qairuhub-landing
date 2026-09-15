"""
Build the deployed WOFF2 subsets in public/fonts/ from the OFL source TTFs in fonts-src/.

    python fonts-src/build-fonts.py        (needs: pip install --user fonttools brotli)

fonts-src/ lives at the repo root on purpose: it is NOT under public/, so Vite never copies the
source TTFs into dist. The unicode ranges below are the single source of truth: they are printed
at the end in CSS syntax and must match the @font-face `unicode-range` values in
src/styles/global.css (scripts/check-fonts.mjs verifies coverage against the CSS).

Subsets keep every OpenType layout feature, the variation axes and the TrueType hinting, so
English text renders exactly as it did with the full TTFs.
"""
import os
import subprocess
import sys
import tempfile

from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "fonts-src")
OUT = os.path.join(ROOT, "public", "fonts")

# Latin: Google Fonts "latin" + Latin Extended-A (names), arrows and the few math signs the copy uses.
LATIN = (
    "U+0000-00FF,U+0100-017F,U+0192,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,"
    "U+2000-206F,U+20AC,U+2122,U+2190-2199,U+2212,U+2215,U+2248,U+2260,U+2264-2265,U+FEFF,U+FFFD"
)
# Cyrillic: the whole block (Russian + every Kazakh letter), numero sign and the tenge sign.
CYRILLIC = "U+0400-04FF,U+2116,U+20B8"
# Lowercase Latin + space: the DOM wordmark face (see the Courgette job below).
WORDMARK = "U+0020,U+0061-007A"

JOBS = [
    # (source, output, unicodes, static instance or None)
    ("Inter-Variable.ttf", "Inter-latin.woff2", LATIN, None),
    ("Inter-Variable.ttf", "Inter-cyrillic.woff2", CYRILLIC, None),
    ("Anton-Regular.ttf", "Anton-latin.woff2", LATIN, None),
    ("Oswald-Variable.ttf", "Oswald-600-cyrillic.woff2", CYRILLIC, {"wght": 600}),
    ("Caveat-Variable.ttf", "Caveat-latin.woff2", LATIN, None),
    ("Caveat-Variable.ttf", "Caveat-cyrillic.woff2", CYRILLIC, None),
    # The DOM wordmark ("qairuhub", Latin in every locale) only needs lowercase letters. The full
    # Courgette-Regular.ttf stays in public/fonts/ for the 3D sculpture (src/lib/ttf.ts parses glyf),
    # so sub-pages, which have no sculpture, never download it (V3-BUILD-PLAN WP1 C).
    ("Courgette-Regular.ttf", "Courgette-wordmark.woff2", WORDMARK, None),
]


def main() -> int:
    os.makedirs(OUT, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        for src, out, unicodes, location in JOBS:
            path = os.path.join(SRC, src)
            if not os.path.exists(path):  # Courgette's source TTF is itself deployed (3D parser)
                path = os.path.join(OUT, src)
            if location:
                font = TTFont(path)
                static = instancer.instantiateVariableFont(font, location, updateFontNames=False)
                path = os.path.join(tmp, out.replace(".woff2", ".ttf"))
                static.save(path)
            cmd = [
                sys.executable, "-m", "fontTools.subset", path,
                "--unicodes=" + unicodes,
                "--layout-features=*",
                "--flavor=woff2",
                "--output-file=" + os.path.join(OUT, out),
            ]
            subprocess.run(cmd, check=True)
            print(f"{out:28s} {os.path.getsize(os.path.join(OUT, out)) / 1024:7.1f} KB")
    print("\nunicode-range (latin):   ", LATIN.replace(",", ", "))
    print("unicode-range (cyrillic):", CYRILLIC.replace(",", ", "))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
