"""Generates favicon, social preview and hero images (Pillow). Run: python3 tools/make_assets.py"""
import os
from PIL import Image, ImageDraw, ImageFont

OUT = os.path.join(os.path.dirname(__file__), '..', 'client', 'public')
MOCHA, DEEP, PLAT, LAV = '#6F4E37', '#3E2B1D', '#E5E4E2', '#E6E0F0'
FONT_DIR = '/usr/share/fonts/opentype/inter/'
def font(weight, size): return ImageFont.truetype(f'{FONT_DIR}Inter-{weight}.otf', size)

def check_tile(size, radius_ratio=0.22):
    """Lavender check mark on a mocha rounded square (the logo)."""
    s = size * 4
    img = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((0, 0, s - 1, s - 1), radius=int(s * radius_ratio), fill=MOCHA)
    pts = [(s * 0.26, s * 0.53), (s * 0.43, s * 0.70), (s * 0.75, s * 0.32)]
    d.line(pts, fill=LAV, width=int(s * 0.12), joint='curve')
    for x, y in (pts[0], pts[2]):
        r = s * 0.06
        d.ellipse((x - r, y - r, x + r, y + r), fill=LAV)
    return img.resize((size, size), Image.LANCZOS)

# --- favicons
check_tile(32).save(f'{OUT}/favicon-32.png', optimize=True)
check_tile(180, 0.0).save(f'{OUT}/apple-touch-icon.png', optimize=True)   # iOS rounds corners itself
check_tile(192).save(f'{OUT}/icon-192.png', optimize=True)
check_tile(512).save(f'{OUT}/icon-512.png', optimize=True)
check_tile(48).save(f'{OUT}/favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)])
with open(f'{OUT}/favicon.svg', 'w') as f:
    f.write('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#6F4E37"/>'
            '<path d="M17 34l11 11 20-21" fill="none" stroke="#E6E0F0" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round"/></svg>')

# --- social preview 1200x630
W, H = 1200, 630
S = 2
img = Image.new('RGB', (W * S, H * S), MOCHA)
d = ImageDraw.Draw(img)
d.rounded_rectangle((90 * S, 120 * S, 290 * S, 320 * S), radius=44 * S, fill=LAV)
d.line([(135 * S, 225 * S), (175 * S, 266 * S), (248 * S, 172 * S)], fill=MOCHA, width=24 * S, joint='curve')
for cx, cy in ((135, 225), (248, 172)):
    d.ellipse(((cx - 12) * S, (cy - 12) * S, (cx + 12) * S, (cy + 12) * S), fill=MOCHA)
d.text((90 * S, 360 * S), 'AttendEase', font=font('Bold', 118 * S), fill=PLAT)
d.text((94 * S, 500 * S), 'Know your attendance before it becomes a problem.', font=font('Medium', 36 * S), fill=LAV)
d.rounded_rectangle((790 * S, 90 * S, 1110 * S, 160 * S), radius=35 * S, fill=LAV)
d.text((820 * S, 102 * S), 'For SRGEC students', font=font('SemiBold', 30 * S), fill=DEEP)
img = img.resize((W, H), Image.LANCZOS)
img.quantize(colors=48, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(f'{OUT}/og-image.png', optimize=True)

# --- hero illustration 960x640 (sample numbers, labelled as an illustration on the page)
W, H, S = 960, 640, 2
img = Image.new('RGB', (W * S, H * S), PLAT)
d = ImageDraw.Draw(img)
def T(x, y, text, f, fill=DEEP): d.text((x * S, y * S), text, font=f, fill=fill)
def R(box, r, fill): d.rounded_rectangle([v * S for v in box], radius=r * S, fill=fill)

T(40, 34, 'Overall attendance', font('SemiBold', 26 * S), MOCHA)
T(40, 66, '78%', font('Bold', 92 * S))
R((250, 112, 640, 150), 19, DEEP)
T(268, 118, 'SAFE: 75% or above', font('SemiBold', 22 * S), PLAT)
T(250, 164, '312 attended of 400 classes', font('Medium', 22 * S), MOCHA)
R((40, 214, 920, 234), 10, LAV); R((40, 214, 40 + int(880 * 0.78), 234), 10, MOCHA)
T(40, 262, 'Subjects', font('SemiBold', 24 * S), MOCHA)

rows = [('MA', 'Mathematics', 82), ('PH', 'Physics', 74), ('PY', 'Python', 91), ('EL', 'Electronics', 68)]
y = 296
for code, name, pct in rows:
    R((40, y, 920, y + 68), 14, LAV)
    T(60, y + 17, code, font('Bold', 24 * S), MOCHA)
    T(130, y + 16, name, font('SemiBold', 26 * S))
    R((400, y + 25, 760, y + 43), 9, PLAT); R((400, y + 25, 400 + int(360 * pct / 100), y + 43), 9, MOCHA)
    T(790, y + 14, f'{pct}%', font('Bold', 30 * S))
    y += 80
img = img.resize((W, H), Image.LANCZOS)
img.save(f'{OUT}/hero-dashboard.webp', quality=82, method=6)

for name in sorted(os.listdir(OUT)):
    print(f'{name:24s}{os.path.getsize(os.path.join(OUT, name)):>8,d} bytes')
