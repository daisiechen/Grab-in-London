"""Render the Fancy iOS app icon (SVG source + 1024x1024 PNG) from one shape list.

Original artwork for Fancy: a round table seen from above with a bite taken out of it
("Fancy a bite?"), four chairs in the brand citrus and vermilion, and an orange on the plate.
Only circles and rounded rectangles are used so the SVG and the PNG are drawn from exactly the
same geometry without needing an SVG renderer. The PNG is opaque and square; iOS applies the mask.

Usage: python3 scripts/render_app_icon.py
"""
from math import cos, radians, sin
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SVG_PATH = ROOT / 'apps/ios/assets/brand/app-icon.svg'
PNG_PATH = ROOT / 'apps/ios/assets/images/icon.png'

SIZE = 1024
FOREST = '#123f35'
IVORY = '#f5f2e8'
RIM = '#e6e0cc'
CITRUS = '#d7ee79'
VERMILION = '#e96943'
HIGHLIGHT = '#f08a69'

CENTER = 512
TABLE_R = 252
CHAIR_GAP = 334  # table centre to chair centre, leaving a sliver of forest between chair and table
CHAIR_LONG, CHAIR_SHORT = 248, 80


def on_rim(degrees: float) -> tuple[float, float]:
    """Point on the table edge, angle measured anticlockwise from 3 o'clock."""
    return round(CENTER + TABLE_R * cos(radians(degrees)), 1), round(CENTER - TABLE_R * sin(radians(degrees)), 1)


BITE_R = 54

# Painted in order. ('rect', x, y, w, h, rx, fill) or ('circle', cx, cy, r, fill).
SHAPES = [
    ('rect', 0, 0, SIZE, SIZE, 0, FOREST),
    # Table top with a plate rim.
    ('circle', CENTER, CENTER, TABLE_R, IVORY),
    ('circle', CENTER, CENTER, 162, RIM),
    ('circle', CENTER, CENTER, 144, IVORY),
    # The bite: three overlapping scallops cut from the upper-right edge of the table.
    ('circle', *on_rim(22), BITE_R, FOREST),
    ('circle', *on_rim(45), BITE_R, FOREST),
    ('circle', *on_rim(68), BITE_R, FOREST),
    # An orange on the plate.
    ('circle', CENTER, CENTER, 88, VERMILION),
    ('circle', CENTER - 30, CENTER - 30, 20, HIGHLIGHT),
    # Chairs: top and right vermilion, left and bottom citrus (as in the welcome artwork).
    ('rect', CENTER - CHAIR_LONG / 2, CENTER - CHAIR_GAP - CHAIR_SHORT / 2, CHAIR_LONG, CHAIR_SHORT, CHAIR_SHORT / 2, VERMILION),
    ('rect', CENTER + CHAIR_GAP - CHAIR_SHORT / 2, CENTER - CHAIR_LONG / 2, CHAIR_SHORT, CHAIR_LONG, CHAIR_SHORT / 2, VERMILION),
    ('rect', CENTER - CHAIR_GAP - CHAIR_SHORT / 2, CENTER - CHAIR_LONG / 2, CHAIR_SHORT, CHAIR_LONG, CHAIR_SHORT / 2, CITRUS),
    ('rect', CENTER - CHAIR_LONG / 2, CENTER + CHAIR_GAP - CHAIR_SHORT / 2, CHAIR_LONG, CHAIR_SHORT, CHAIR_SHORT / 2, CITRUS),
]


def svg() -> str:
    body = []
    for shape in SHAPES:
        if shape[0] == 'rect':
            _, x, y, w, h, rx, fill = shape
            radius = f' rx="{rx:g}"' if rx else ''
            body.append(f'  <rect x="{x:g}" y="{y:g}" width="{w:g}" height="{h:g}"{radius} fill="{fill}"/>')
        else:
            _, cx, cy, r, fill = shape
            body.append(f'  <circle cx="{cx:g}" cy="{cy:g}" r="{r:g}" fill="{fill}"/>')
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{SIZE}" height="{SIZE}" viewBox="0 0 {SIZE} {SIZE}">\n'
        '  <title>Fancy app icon: a round table with a bite taken out of it</title>\n'
        + '\n'.join(body)
        + '\n</svg>\n'
    )


def png(scale: int = 4) -> Image.Image:
    big = Image.new('RGB', (SIZE * scale, SIZE * scale), FOREST)
    draw = ImageDraw.Draw(big)
    for shape in SHAPES:
        if shape[0] == 'rect':
            _, x, y, w, h, rx, fill = shape
            box = [x * scale, y * scale, (x + w) * scale - 1, (y + h) * scale - 1]
            if rx:
                draw.rounded_rectangle(box, radius=rx * scale, fill=fill)
            else:
                draw.rectangle(box, fill=fill)
        else:
            _, cx, cy, r, fill = shape
            draw.ellipse([(cx - r) * scale, (cy - r) * scale, (cx + r) * scale - 1, (cy + r) * scale - 1], fill=fill)
    return big.resize((SIZE, SIZE), Image.Resampling.LANCZOS)


def main() -> None:
    SVG_PATH.parent.mkdir(parents=True, exist_ok=True)
    SVG_PATH.write_text(svg())
    png().save(PNG_PATH, optimize=True)
    print(f'wrote {SVG_PATH.relative_to(ROOT)} and {PNG_PATH.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
