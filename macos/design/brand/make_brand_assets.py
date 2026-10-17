#!/usr/bin/env python3
"""Generate every product use of the Graphium mark from macos/design/brand/mark.svg.

Writes the macOS app icons (Release and Debug asset-catalog sets, plus Icon Composer
bundles for when the app builds with Xcode 26), the SwiftUI shape used on the Welcome
window, and the public site's favicon and Home Screen icon. Run from the repository root:

    python3 -I macos/design/brand/make_brand_assets.py          # write
    python3 -I macos/design/brand/make_brand_assets.py --check  # fail if text outputs are stale

Needs Pillow for the PNG files. Ported from Project Icarus's designs/brand/make_brand_assets.py
(sister app, same brand system); see README.md beside this file.
"""

import argparse
import io
import json
import math
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
BRAND = ROOT / "macos" / "design" / "brand"
SOURCE = BRAND / "mark.svg"
VIEW = 512.0

# Ink, paper and graphite are shared with Icarus's brand system; amber is Graphium's own
# (DESIGN.md `accent`). Icon direction B "Amber", chosen 2026-10-17 on the Sketch "Brand — Logo" page.
INK = "#1A1A18"        # mark on amber and on paper
PAPER = "#ECEAE4"      # mark on dark surfaces (favicon in dark mode)
AMBER = "#FFC53D"      # Release base; the mark on dark bases
GRAPHITE = "#343536"   # Release Dark base
DEV_DARK = "#070808"   # Debug Dark base (Debug Default uses INK)
MONO = "#FFFFFF"       # Tinted/Clear: the system recolours by luminance

# (base, mark) per build and appearance.
ICONS = {
    False: {"default": (AMBER, INK), "dark": (GRAPHITE, AMBER)},
    True: {"default": (INK, AMBER), "dark": (DEV_DARK, AMBER)},
}

ICON_CANVAS = 1024
# The pin is taller and narrower than Icarus's quill, so it runs a little larger than Icarus's 0.6
# to carry the same weight beside it.
ICON_MARK = 0.66
WEB_TILE_MARK = 0.66

# macOS asset-catalog icons (pre-Icon Composer): the plate is an 824 pt rounded square centred on
# a 1024 canvas with a soft drop shadow, per Apple's macOS icon template.
MAC_PLATE = 824
MAC_RADIUS = 185.4
MAC_SIZES = ((16, 1), (16, 2), (32, 1), (32, 2), (128, 1), (128, 2), (256, 1), (256, 2), (512, 1), (512, 2))
APPICON_SETS = {"AppIcon": False, "AppIconDev": True}
CATALOG = "macos/App/Graphium/Assets.xcassets"


def read_paths():
    text = SOURCE.read_text()
    ds = re.findall(r'\sd="([^"]+)"', text)
    if not ds:
        sys.exit(f"no path in {SOURCE}")
    return " ".join(" ".join(d.split()) for d in ds)


def tokenize(d):
    return re.findall(r"[MLCQAZ]|-?\d*\.?\d+", d)


def arc_to_cubics(x1, y1, rx, ry, phi, large, sweep, x2, y2):
    """SVG endpoint arc to cubic Bezier segments (SVG 1.1 F.6). Returns [(c1, c2, end)]."""
    phi = math.radians(phi)
    cp, sp = math.cos(phi), math.sin(phi)
    dx, dy = (x1 - x2) / 2, (y1 - y2) / 2
    x1p, y1p = cp * dx + sp * dy, -sp * dx + cp * dy
    lam = (x1p ** 2) / (rx ** 2) + (y1p ** 2) / (ry ** 2)
    if lam > 1:
        rx, ry = rx * math.sqrt(lam), ry * math.sqrt(lam)
    num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p
    den = rx * rx * y1p * y1p + ry * ry * x1p * x1p
    coef = math.sqrt(max(0.0, num / den)) * (-1 if large == sweep else 1)
    cxp, cyp = coef * rx * y1p / ry, -coef * ry * x1p / rx
    cx = cp * cxp - sp * cyp + (x1 + x2) / 2
    cy = sp * cxp + cp * cyp + (y1 + y2) / 2

    def angle(ux, uy, vx, vy):
        a = math.atan2(ux * vy - uy * vx, ux * vx + uy * vy)
        return a

    t1 = angle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry)
    dt = angle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry)
    if not sweep and dt > 0:
        dt -= 2 * math.pi
    elif sweep and dt < 0:
        dt += 2 * math.pi
    n = max(1, math.ceil(abs(dt) / (math.pi / 2)))
    step = dt / n
    k = 4 / 3 * math.tan(step / 4)

    def point(t):
        return (cx + rx * math.cos(t) * cp - ry * math.sin(t) * sp,
                cy + rx * math.cos(t) * sp + ry * math.sin(t) * cp)

    def deriv(t):
        return (-rx * math.sin(t) * cp - ry * math.cos(t) * sp,
                -rx * math.sin(t) * sp + ry * math.cos(t) * cp)

    out = []
    t = t1
    for i in range(n):
        a, b = t, t + step
        pa, pb, da, db = point(a), point(b), deriv(a), deriv(b)
        c1 = (pa[0] + k * da[0], pa[1] + k * da[1])
        c2 = (pb[0] - k * db[0], pb[1] - k * db[1])
        end = (x2, y2) if i == n - 1 else pb
        out.append((c1, c2, end))
        t = b
    return out


def parse(d):
    """Absolute M/L/C/Q/A/Z path to subpaths of ('M'|'L'|'C'|'Q', points...)."""
    tok = tokenize(d)
    i, cur, subs = 0, (0.0, 0.0), []

    def nums(n):
        nonlocal i
        vals = [float(v) for v in tok[i:i + n]]
        i += n
        return vals

    while i < len(tok):
        cmd = tok[i]
        i += 1
        if cmd == "M":
            x, y = nums(2)
            subs.append([("M", (x, y))])
            cur = (x, y)
        elif cmd == "L":
            x, y = nums(2)
            subs[-1].append(("L", (x, y)))
            cur = (x, y)
        elif cmd == "C":
            v = nums(6)
            subs[-1].append(("C", (v[0], v[1]), (v[2], v[3]), (v[4], v[5])))
            cur = (v[4], v[5])
        elif cmd == "Q":
            v = nums(4)
            subs[-1].append(("Q", (v[0], v[1]), (v[2], v[3])))
            cur = (v[2], v[3])
        elif cmd == "A":
            rx, ry, phi, large, sweep, x, y = nums(7)
            for c1, c2, end in arc_to_cubics(cur[0], cur[1], rx, ry, phi, int(large), int(sweep), x, y):
                subs[-1].append(("C", c1, c2, end))
            cur = (x, y)
        elif cmd == "Z":
            pass
        else:
            sys.exit(f"unsupported path command {cmd}")
    return subs


def flatten(subs, steps=24):
    polys = []
    for sub in subs:
        pts, cur = [], None
        for seg in sub:
            if seg[0] in ("M", "L"):
                cur = seg[1]
                pts.append(cur)
            elif seg[0] == "Q":
                (qx, qy), (ex, ey) = seg[1], seg[2]
                for s in range(1, steps + 1):
                    t = s / steps
                    pts.append(((1 - t) ** 2 * cur[0] + 2 * (1 - t) * t * qx + t * t * ex,
                                (1 - t) ** 2 * cur[1] + 2 * (1 - t) * t * qy + t * t * ey))
                cur = (ex, ey)
            else:
                (ax, ay), (bx, by), (ex, ey) = seg[1], seg[2], seg[3]
                for s in range(1, steps + 1):
                    t = s / steps
                    u = 1 - t
                    pts.append((u ** 3 * cur[0] + 3 * u * u * t * ax + 3 * u * t * t * bx + t ** 3 * ex,
                                u ** 3 * cur[1] + 3 * u * u * t * ay + 3 * u * t * t * by + t ** 3 * ey))
                cur = (ex, ey)
        polys.append(pts)
    return polys


def rgb(hex_):
    h = hex_.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def icon_colour(hex_):
    r, g, b = (c / 255 for c in rgb(hex_))
    return f"extended-srgb:{r:.5f},{g:.5f},{b:.5f},1.00000"


def mark_svg(d, colour, canvas, fraction):
    size = canvas * fraction
    scale = size / VIEW
    offset = (canvas - size) / 2
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{canvas}" height="{canvas}" '
            f'viewBox="0 0 {canvas} {canvas}">\n'
            f'  <path transform="translate({offset:g} {offset:g}) scale({scale:g})" fill="{colour}" d="{d}"/>\n'
            f'</svg>\n')


def icon_bundle(dev):
    colours = ICONS[dev]
    marks = {"default": "mark-default.svg", "dark": "mark-dark.svg", "tinted": "mark-mono.svg"}
    return {
        "fill-specializations": [
            {"value": {"solid": icon_colour(colours["default"][0])}},
            {"appearance": "dark", "value": {"solid": icon_colour(colours["dark"][0])}},
        ],
        "groups": [{
            "layers": [{
                "glass-specializations": [{"value": False}, {"appearance": "tinted", "value": True}],
                "image-name-specializations": [
                    {"value": marks["default"]},
                    {"appearance": "dark", "value": marks["dark"]},
                    {"appearance": "tinted", "value": marks["tinted"]},
                ],
                "name": "mark",
            }],
            "name": "mark",
            "shadow": {"kind": "neutral", "opacity": 0.5},
            "specular": False,
            "translucency": {"enabled": False, "value": 0.3},
        }],
        "supported-platforms": {"squares": "shared"},
    }


def appiconset_contents():
    images = [{"idiom": "mac", "scale": f"{s}x", "size": f"{p}x{p}", "filename": appicon_name(p, s)} for p, s in MAC_SIZES]
    return json.dumps({"images": images, "info": {"author": "xcode", "version": 1}}, indent=2) + "\n"


def appicon_name(points, scale):
    return f"icon_{points}x{points}{'@2x' if scale == 2 else ''}.png"


def swift_shape(subs):
    lines = []
    for sub in subs:
        for seg in sub:
            if seg[0] == "M":
                lines.append(f"        path.move(to: p({seg[1][0]:.2f}, {seg[1][1]:.2f}))")
            elif seg[0] == "L":
                lines.append(f"        path.addLine(to: p({seg[1][0]:.2f}, {seg[1][1]:.2f}))")
            elif seg[0] == "Q":
                lines.append(f"        path.addQuadCurve(to: p({seg[2][0]:.2f}, {seg[2][1]:.2f}), "
                             f"control: p({seg[1][0]:.2f}, {seg[1][1]:.2f}))")
            else:
                lines.append(f"        path.addCurve(to: p({seg[3][0]:.2f}, {seg[3][1]:.2f}), "
                             f"control1: p({seg[1][0]:.2f}, {seg[1][1]:.2f}), "
                             f"control2: p({seg[2][0]:.2f}, {seg[2][1]:.2f}))")
        lines.append("        path.closeSubpath()")
    body = "\n".join(lines)
    return f"""// Generated by macos/design/brand/make_brand_assets.py from macos/design/brand/mark.svg. Do not edit.
import SwiftUI

/// The Graphium mark (a map pin whose stem is a pen nib) as a shape, so it takes `foregroundStyle`
/// and scales without an image asset. Square: drawn in a {int(VIEW)}-point source square scaled to the
/// smaller side of `rect`.
struct BrandMark: Shape {{
    func path(in rect: CGRect) -> Path {{
        let side = min(rect.width, rect.height)
        let origin = CGPoint(x: rect.midX - side / 2, y: rect.midY - side / 2)
        let scale = side / {VIEW}
        func p(_ x: CGFloat, _ y: CGFloat) -> CGPoint {{ CGPoint(x: origin.x + x * scale, y: origin.y + y * scale) }}
        var path = Path()
{body}
        return path
    }}
}}
"""


def favicon_svg(d):
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">\n'
            f'  <style>path{{fill:{INK}}}@media (prefers-color-scheme:dark){{path{{fill:{PAPER}}}}}</style>\n'
            f'  <path d="{d}"/>\n'
            '</svg>\n')


def mark_mask(polys, big, fraction):
    from PIL import Image, ImageDraw
    mask = Image.new("L", (big, big), 0)
    draw = ImageDraw.Draw(mask)
    s = big * fraction / VIEW
    off = big * (1 - fraction) / 2
    for poly in polys:
        draw.polygon([(off + x * s, off + y * s) for x, y in poly], fill=255)
    return mask


def render_png(polys, size, fraction, colour, background=None):
    from PIL import Image
    ss = 8
    big = size * ss
    img = Image.new("RGBA", (big, big), rgb(background) + (255,) if background else (0, 0, 0, 0))
    img.paste(Image.new("RGBA", (big, big), rgb(colour) + (255,)), (0, 0), mark_mask(polys, big, fraction))
    return img.resize((size, size), Image.LANCZOS)


def mac_master(polys, dev):
    """1024 px macOS icon: shadowed rounded plate with the mark centred on it."""
    from PIL import Image, ImageDraw, ImageFilter
    ss = 2
    big = ICON_CANVAS * ss
    plate, inset, radius = MAC_PLATE * ss, (ICON_CANVAS - MAC_PLATE) // 2 * ss, MAC_RADIUS * ss
    box = (inset, inset, inset + plate - 1, inset + plate - 1)
    shape = Image.new("L", (big, big), 0)
    ImageDraw.Draw(shape).rounded_rectangle(box, radius=radius, fill=255)
    shadow = Image.new("L", (big, big), 0)
    ImageDraw.Draw(shadow).rounded_rectangle((box[0], box[1] + 10 * ss, box[2], box[3] + 10 * ss), radius=radius, fill=77)
    img = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    img.putalpha(shadow.filter(ImageFilter.GaussianBlur(10 * ss)))
    plate_colour, mark_colour = ICONS[dev]["default"]
    img.paste(Image.new("RGBA", (big, big), rgb(plate_colour) + (255,)), (0, 0), shape)
    mark = mark_mask(polys, big, ICON_MARK * MAC_PLATE / ICON_CANVAS)
    img.paste(Image.new("RGBA", (big, big), rgb(mark_colour) + (255,)), (0, 0), mark)
    return img.resize((ICON_CANVAS, ICON_CANVAS), Image.LANCZOS)


def outputs(d):
    subs = parse(d)
    text = {}
    for name, dev in (("Graphium", False), ("GraphiumDev", True)):
        base = f"macos/design/brand/{name}.icon"
        text[f"{base}/icon.json"] = json.dumps(icon_bundle(dev), indent=2) + "\n"
        text[f"{base}/Assets/mark-default.svg"] = mark_svg(d, ICONS[dev]["default"][1], ICON_CANVAS, ICON_MARK)
        text[f"{base}/Assets/mark-dark.svg"] = mark_svg(d, ICONS[dev]["dark"][1], ICON_CANVAS, ICON_MARK)
        text[f"{base}/Assets/mark-mono.svg"] = mark_svg(d, MONO, ICON_CANVAS, ICON_MARK)
    for name in APPICON_SETS:
        text[f"{CATALOG}/{name}.appiconset/Contents.json"] = appiconset_contents()
    text["macos/App/Graphium/Design/BrandMark.swift"] = swift_shape(subs)
    text["site/icon.svg"] = favicon_svg(d)
    return subs, text


def binaries(subs):
    from PIL import Image
    polys = flatten(subs)
    out = {}
    for name, dev in APPICON_SETS.items():
        master = mac_master(polys, dev)
        for points, scale in MAC_SIZES:
            px = points * scale
            buf = io.BytesIO()
            master.resize((px, px), Image.LANCZOS).save(buf, format="PNG", optimize=True)
            out[f"{CATALOG}/{name}.appiconset/{appicon_name(points, scale)}"] = buf.getvalue()
    buf = io.BytesIO()
    render_png(polys, 180, WEB_TILE_MARK, INK, AMBER).convert("RGB").save(buf, format="PNG", optimize=True)
    out["site/apple-touch-icon.png"] = buf.getvalue()
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--check", action="store_true", help="fail if a generated text file differs (PNGs are not compared)")
    args = ap.parse_args()
    subs, text = outputs(read_paths())
    if args.check:
        stale = [p for p, body in text.items() if not (ROOT / p).exists() or (ROOT / p).read_text() != body]
        for p in stale:
            print(f"stale: {p}")
        return 1 if stale else 0
    for p, body in text.items():
        (ROOT / p).parent.mkdir(parents=True, exist_ok=True)
        (ROOT / p).write_text(body)
    images = binaries(subs)
    for p, body in images.items():
        (ROOT / p).parent.mkdir(parents=True, exist_ok=True)
        (ROOT / p).write_bytes(body)
    print(f"wrote {len(text)} text and {len(images)} image files")
    return 0


if __name__ == "__main__":
    sys.exit(main())
