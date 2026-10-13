"""Build the portfolio wordmark face from Poppins SemiBold and check it against the authored 'Wordmark' glyphs.

The authored page ships a 22-glyph Poppins subset (K A G E plus a few others). A longer word needs more letters, so
this builds the same face with the full capital alphabet and digits.

Needs `pip install fonttools brotli` and Poppins-SemiBold.ttf from Google Fonts (github.com/google/fonts, ofl/poppins).
Only needed to change which glyphs the wordmark can use; the committed portfolio-wordmark.woff2 already covers
A-Z, 0-9, space, period, hyphen and ampersand.

Usage: python scripts/build-wordmark-font.py <Poppins-SemiBold.ttf> public/landing-pages/secret-pathways-assets/fonts.css public/landing-pages/secret-pathways-assets/portfolio-wordmark.woff2
"""
import base64
import io
import re
import sys

from fontTools import subset
from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools.ttLib import TTFont

poppins_path, fonts_css_path, out_path = sys.argv[1:4]

css = open(fonts_css_path, encoding="utf-8").read()
authored = None
for family, weight, b64 in re.findall(
    r"@font-face\{font-family:'([^']+)';font-style:normal;font-weight:(\d+);.*?base64,([A-Za-z0-9+/=]+)\)", css
):
    if family == "Wordmark" and int(weight) == 600:
        authored = TTFont(io.BytesIO(base64.b64decode(b64)))


def outline(font, char):
    glyph_name = font.getBestCmap()[ord(char)]
    glyph_set = font.getGlyphSet()
    pen = DecomposingRecordingPen(glyph_set)
    glyph_set[glyph_name].draw(pen)
    return glyph_set[glyph_name].width, [(op, tuple(pts)) for op, pts in pen.value]


poppins = TTFont(poppins_path)
for char in "KAGEScegkrt0123456789":
    same = outline(authored, char) == outline(poppins, char)
    print(f"{char}: identical to authored Wordmark 600 = {same}")

options = subset.Options()
options.flavor = "woff2"
options.layout_features = ["kern"]
options.name_IDs = [1, 2, 3, 4, 6, 13, 14]
options.notdef_outline = True
options.hinting = False
subsetter = subset.Subsetter(options)
subsetter.populate(text="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .-&")
subsetter.subset(poppins)
poppins.flavor = "woff2"
poppins.save(out_path)
print("wrote", out_path, len(open(out_path, "rb").read()), "bytes")
