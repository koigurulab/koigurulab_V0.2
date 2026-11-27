"""占いばあやのカルーセルを書き出す。

python3 tools/tiktok/render_baya.py <背景画像フォルダ> <出力フォルダ> [key ...]

1本につき 01.jpg〜18.jpg（1080x1920）、caption.txt、<key>_sheet.jpg。
レイアウトは2026/2/9の投稿に合わせている：背景写真はそのまま全面、白い箱（左右109px、上454px、高さ296px）、
明朝体58px、行間1.53倍、文字は箱の中で上下左右中央。
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from baya_posts import BAYA_WEEK1, CAPTION  # noqa: E402

W, H = 1080, 1920
BOX = (109, 454, 1080 - 109, 454 + 296)
FONT = ImageFont.truetype("/usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc", 58, index=0)
LINE_H = int(58 * 1.53)
TEXT = (26, 26, 26)
MAX_W = BOX[2] - BOX[0] - 40


def cover_crop(img):
    img = img.convert("RGB")
    s = max(W / img.width, H / img.height)
    img = img.resize((int(img.width * s + 0.5), int(img.height * s + 0.5)), Image.LANCZOS)
    x = (img.width - W) // 2
    y = (img.height - H) // 2
    return img.crop((x, y, x + W, y + H))


def slide(bg, text):
    im = bg.copy()
    over = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(over).rectangle(BOX, fill=(255, 255, 255, 240))
    im = Image.alpha_composite(im.convert("RGBA"), over)
    d = ImageDraw.Draw(im)
    lines = text.split("\n")
    total = LINE_H * len(lines)
    y0 = (BOX[1] + BOX[3]) // 2 - total // 2
    for i, line in enumerate(lines):
        w = d.textlength(line, font=FONT)
        if w > MAX_W:
            raise ValueError(f"はみ出し: {line} ({w:.0f}px > {MAX_W}px)")
        bbox = FONT.getbbox("あ")
        y = y0 + i * LINE_H + (LINE_H - (bbox[3] - bbox[1])) // 2 - bbox[1]
        d.text(((W - w) / 2, y), line, font=FONT, fill=TEXT)
    return im.convert("RGB")


def main():
    bg_dir, out = sys.argv[1], sys.argv[2]
    only = set(sys.argv[3:])
    for p in BAYA_WEEK1:
        if only and p["key"] not in only:
            continue
        od = os.path.join(out, p["key"])
        os.makedirs(od, exist_ok=True)
        bg = cover_crop(Image.open(os.path.join(bg_dir, p["bg"])))
        thumbs = []
        for i, t in enumerate(p["slides"], 1):
            im = slide(bg, t)
            im.save(os.path.join(od, f"{i:02d}.jpg"), quality=90)
            thumbs.append(im.resize((180, 320)))
        open(os.path.join(od, "caption.txt"), "w", encoding="utf-8").write(CAPTION + "\n")
        cols = 9
        sheet = Image.new("RGB", (180 * cols, 320 * ((len(thumbs) + cols - 1) // cols)), "white")
        for i, t in enumerate(thumbs):
            sheet.paste(t, ((i % cols) * 180, (i // cols) * 320))
        sheet.save(os.path.join(out, f"{p['key']}_sheet.jpg"), quality=85)
        print(p["key"], p["date"], len(p["slides"]), "枚")


if __name__ == "__main__":
    main()
