#!/usr/bin/env python3
"""Compose photo-real Troplist.com share cards (landscape + square)."""
from __future__ import annotations

from pathlib import Path
from urllib.request import urlretrieve

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
FONTS = Path(__file__).resolve().parent / "fonts"
BEACH = ROOT / "assets" / "beach-poster.jpg"
OUT_WIDE = ROOT / "icons" / "og-image.jpg"
OUT_SQ = ROOT / "icons" / "og-image-square.jpg"

IVORY = (246, 237, 216, 255)
GOLD = (203, 163, 90, 255)
GOLD_SOFT = (184, 146, 78, 230)
LAVA = (22, 29, 41, 214)
LAVA_EDGE = (255, 255, 255, 32)

FONT_URLS = {
    "Yellowtail-Regular.ttf": "https://fonts.gstatic.com/s/yellowtail/v25/OZpGg_pnoDtINPfRIlLotlw.ttf",
    "PermanentMarker-Regular.ttf": "https://fonts.gstatic.com/s/permanentmarker/v16/Fh4uPib9Iyv2ucM6pGQMWimMp004Hao.ttf",
}


def ensure_fonts() -> None:
    FONTS.mkdir(parents=True, exist_ok=True)
    for name, url in FONT_URLS.items():
        dest = FONTS / name
        if not dest.exists() or dest.stat().st_size < 1000:
            urlretrieve(url, dest)


def load_font(path: Path, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(path), size)


def cover_crop(src: Image.Image, w: int, h: int, top_bias: float) -> Image.Image:
    sw, sh = src.size
    scale = max(w / sw, h / sh)
    nw, nh = int(sw * scale + 0.5), int(sh * scale + 0.5)
    im = src.resize((nw, nh), Image.Resampling.LANCZOS)
    left = (nw - w) // 2
    top = int((nh - h) * top_bias)
    return im.crop((left, top, left + w, top + h))


def rounded_plate(size: tuple[int, int], radius: int) -> Image.Image:
    plate = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(plate)
    draw.rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius=radius, fill=LAVA)
    draw.rounded_rectangle(
        (1, 1, size[0] - 2, size[1] - 2), radius=radius - 1, outline=LAVA_EDGE, width=2
    )
    return plate


def draw_centered(draw: ImageDraw.ImageDraw, canvas_w: int, text: str, font, y: int, fill, tracking: int = 0):
    if tracking:
        glyphs = list(text)
        widths = [draw.textlength(g, font=font) for g in glyphs]
        total = sum(widths) + tracking * (len(glyphs) - 1)
        x = (canvas_w - total) / 2
        for g, gw in zip(glyphs, widths):
            draw.text((x, y), g, font=font, fill=fill)
            x += gw + tracking
        return
    box = draw.textbbox((0, 0), text, font=font)
    tw = box[2] - box[0]
    draw.text(((canvas_w - tw) / 2 - box[0], y), text, font=font, fill=fill)


def compose(cw: int, ch: int, out: tuple[int, int], top_bias: float) -> Image.Image:
    beach = cover_crop(Image.open(BEACH).convert("RGB"), cw, ch, top_bias).convert("RGBA")
    vig = Image.new("L", (cw, ch), 0)
    vd = ImageDraw.Draw(vig)
    vd.ellipse((-200, -160, cw + 200, ch + 220), fill=255)
    vig = vig.filter(ImageFilter.GaussianBlur(90))
    shade = Image.new("RGBA", (cw, ch), (8, 14, 22, 0))
    shade.putalpha(Image.eval(vig, lambda p: int((255 - p) * 0.38)))
    beach = Image.alpha_composite(beach, shade)

    plate_w = int(cw * 0.633)
    plate_h = 520 if ch < cw else 560
    plate = rounded_plate((plate_w, plate_h), 36)
    shadow = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    px, py = (cw - plate_w) // 2, (ch - plate_h) // 2
    sd.rounded_rectangle((px + 6, py + 16, px + plate_w + 6, py + plate_h + 16), 36, fill=(0, 0, 0, 80))
    shadow = shadow.filter(ImageFilter.GaussianBlur(20))
    beach = Image.alpha_composite(beach, shadow)
    beach.paste(plate, (px, py), plate)

    type_layer = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    draw = ImageDraw.Draw(type_layer)
    sans = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 32)
    yellow = load_font(FONTS / "Yellowtail-Regular.ttf", 204)
    yellow_tld = load_font(FONTS / "Yellowtail-Regular.ttf", 148)
    marker = load_font(FONTS / "PermanentMarker-Regular.ttf", 46)

    eyebrow = "WELCOME TO"
    draw_centered(draw, cw, eyebrow, sans, py + 68, GOLD, tracking=16)
    brow_w = draw.textlength(eyebrow, font=sans) + 16 * (len(eyebrow) - 1)
    rule_w, rule_h = 88, 2
    rule_y = py + 84
    rule_gap = 28
    left_x = (cw - brow_w) / 2 - rule_gap - rule_w
    right_x = (cw + brow_w) / 2 + rule_gap
    for x0, fade in ((left_x, True), (right_x, False)):
        for i in range(rule_w):
            t = i / (rule_w - 1)
            a = int(140 * (t if fade else 1 - t))
            draw.line([(x0 + i, rule_y), (x0 + i, rule_y + rule_h)], fill=(203, 163, 90, a))

    name, tld = "Troplist", ".com"
    name_w = draw.textlength(name, font=yellow)
    tld_w = draw.textlength(tld, font=yellow_tld)
    gap = 6
    total = name_w + gap + tld_w
    nx = (cw - total) / 2
    ny = py + 138
    for dx, dy, a in ((0, 6, 90), (0, 2, 120)):
        draw.text((nx + dx, ny + dy), name, font=yellow, fill=(0, 0, 0, a))
        draw.text((nx + name_w + gap + dx, ny + 22 + dy), tld, font=yellow_tld, fill=(0, 0, 0, a))
    draw.text((nx, ny), name, font=yellow, fill=IVORY)
    draw.text((nx + name_w + gap, ny + 22), tld, font=yellow_tld, fill=(246, 237, 216, 214))
    draw_centered(draw, cw, "a calm list for unhurried days", marker, py + 400, GOLD_SOFT)

    beach = Image.alpha_composite(beach, type_layer)
    return beach.convert("RGB").resize(out, Image.Resampling.LANCZOS)


def save(card: Image.Image, path: Path) -> None:
    card.save(path, "JPEG", quality=90, optimize=True, progressive=True)
    print(f"wrote {path} {path.stat().st_size} bytes {card.size}")


def main() -> None:
    ensure_fonts()
    save(compose(2400, 1260, (1200, 630), 0.42), OUT_WIDE)
    save(compose(2400, 2400, (1200, 1200), 0.28), OUT_SQ)


if __name__ == "__main__":
    main()
