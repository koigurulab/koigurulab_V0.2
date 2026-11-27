import os, sys, random, math
from PIL import Image, ImageDraw, ImageFont, ImageFilter
sys.path.insert(0, os.path.dirname(__file__))
from tiktok_posts import POSTS, CTA

W, H = 1080, 1920
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "out")
MED = "/usr/share/fonts/opentype/noto/NotoSansCJK-Medium.ttc"
BOLD = "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"
BLACK = "/usr/share/fonts/opentype/noto/NotoSansCJK-Black.ttc"
SYM = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
F_BODY = ImageFont.truetype(MED, 36, index=0)
F_HEAD = ImageFont.truetype(BOLD, 39, index=0)
F_TITLE = ImageFont.truetype(BLACK, 92, index=0)
F_CHECK = ImageFont.truetype(SYM, 34)
INK = (24, 24, 27)
SAGE = Image.open(os.path.join(REPO, "assets", "senin_320.webp")).convert("RGBA")
LP = Image.open(os.path.join(HERE, "assets", "lp_hero.png")).convert("RGB")

NO_START = set("、。，．）」』】！？ー…っゃゅょァィゥェォッャュョ・")

def background(seed):
    rnd = random.Random(seed)
    palettes = [((10, 14, 30), (38, 22, 48)), ((14, 12, 22), (48, 30, 30)), ((8, 18, 28), (30, 26, 52))]
    top, bot = palettes[seed % len(palettes)]
    bg = Image.new("RGB", (W, H))
    d = ImageDraw.Draw(bg)
    for y in range(H):
        t = y / H
        d.line([(0, y), (W, y)], fill=tuple(int(top[i] * (1 - t) + bot[i] * t) for i in range(3)))
    lights = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ld = ImageDraw.Draw(lights)
    colors = [(255, 214, 150), (255, 240, 220), (255, 150, 160), (255, 190, 110), (180, 200, 255), (255, 120, 120)]
    for _ in range(170):
        band = rnd.random()
        y = int(rnd.gauss(H * 0.34, H * 0.11)) if band < 0.75 else rnd.randint(0, H)
        x = rnd.randint(-40, W + 40)
        r = rnd.choice([8, 12, 16, 22, 30, 42, 56])
        c = rnd.choice(colors)
        a = rnd.randint(60, 200)
        ld.ellipse([x - r, y - r, x + r, y + r], fill=c + (a,))
    for _ in range(6):  # 光の筋
        y = int(rnd.gauss(H * 0.42, H * 0.06))
        ld.line([(rnd.randint(-100, 300), y), (rnd.randint(700, 1200), y + rnd.randint(-60, 60))], fill=(255, 200, 150, 90), width=rnd.randint(4, 10))
    lights = lights.filter(ImageFilter.GaussianBlur(14))
    bg = Image.alpha_composite(bg.convert("RGBA"), lights)
    # 周辺減光
    vig = Image.new("L", (W, H), 0)
    vd = ImageDraw.Draw(vig)
    for i in range(60):
        vd.rectangle([i * 9, i * 16, W - i * 9, H - i * 16], fill=int(i * 3.2))
    vig = vig.filter(ImageFilter.GaussianBlur(60))
    dark = Image.new("RGBA", (W, H), (0, 0, 0, 255))
    bg = Image.composite(bg, dark, vig.point(lambda v: min(255, 120 + v)))
    return bg.convert("RGB")

def tokens(text):
    import re
    # 英数字の連なり（INFP, MBTI×ラブタイプ の MBTI など）は分割しない
    return re.findall(r"[A-Za-z0-9()（）]+|.", text)

def wrap(text, font, maxw):
    lines, cur = [], ""
    for tk in tokens(text):
        if font.getlength(cur + tk) <= maxw or (len(tk) == 1 and tk in NO_START):
            cur += tk
        else:
            if cur: lines.append(cur)
            cur = tk
    if cur: lines.append(cur)
    return lines

def layout(raw_lines, maxw):
    """(kind, text) の描画行リストを返す。kind: head/body/check/blank/sage"""
    out = []
    for s in raw_lines:
        if s == "":
            out.append(("blank", "")); continue
        if s.startswith("■"):
            for i, l in enumerate(wrap(s, F_HEAD, maxw)): out.append(("head", l))
        elif s.startswith("✔"):
            for i, l in enumerate(wrap(s[1:].strip(), F_BODY, maxw - 52)): out.append(("check" if i == 0 else "checkcont", l))
        elif s.startswith("【"):
            for l in wrap(s, F_HEAD, maxw): out.append(("title", l))
        elif s.startswith("👴"):
            for i, l in enumerate(wrap(s[1:].strip(), F_HEAD, maxw - 60)): out.append(("sage" if i == 0 else "head2", l))
        else:
            for l in wrap(s, F_BODY, maxw): out.append(("body", l))
    return out

LH = 64; BLANK = 30

def card(img, raw_lines, top=None, extra_img=None):
    cx0, cx1 = 76, 964
    pad = 52
    maxw = cx1 - cx0 - pad * 2
    rows = layout(raw_lines, maxw)
    h = sum(BLANK if k == "blank" else LH for k, _ in rows) + pad * 2 - 10
    ex_h = 0
    if extra_img is not None:
        ex_w = cx1 - cx0 - 60
        ex = extra_img.resize((ex_w, int(extra_img.height * ex_w / extra_img.width)), Image.LANCZOS)
        ex_h = ex.height + 30
    total = h + ex_h
    y0 = top if top is not None else max(150, int(H * 0.44 - total / 2))
    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rectangle([cx0 + 6, y0 + 10, cx1 + 6, y0 + total + 10], fill=(0, 0, 0, 110))
    shadow = shadow.filter(ImageFilter.GaussianBlur(14))
    img.paste(Image.alpha_composite(img.convert("RGBA"), shadow).convert("RGB"))
    d = ImageDraw.Draw(img)
    d.rectangle([cx0, y0, cx1, y0 + total], fill=(253, 253, 253))
    y = y0 + pad - 6
    x = cx0 + pad
    for k, t in rows:
        if k == "blank": y += BLANK; continue
        if k == "head":
            if t.startswith("■"):
                d.rectangle([x, y + 14, x + 30, y + 44], fill=INK)
                d.text((x + 44, y), t[1:].strip(), font=F_HEAD, fill=INK)
            else:
                d.text((x + 44, y), t, font=F_HEAD, fill=INK)
        elif k == "check":
            d.text((x, y + 6), "✔", font=F_CHECK, fill=INK)
            d.text((x + 52, y), t, font=F_BODY, fill=INK)
        elif k == "checkcont":
            d.text((x + 52, y), t, font=F_BODY, fill=INK)
        elif k == "sage":
            s = SAGE.resize((46, 52), Image.LANCZOS)
            img.paste(s, (x, y + 4), s)
            d.text((x + 60, y), t, font=F_HEAD, fill=INK)
        elif k == "head2":
            d.text((x + 60, y), t, font=F_HEAD, fill=INK)
        elif k == "title":
            d.text((x, y), t, font=F_HEAD, fill=INK)
        else:
            d.text((x, y), t, font=F_BODY, fill=INK)
        y += LH
    if extra_img is not None:
        img.paste(ex, (cx0 + 30, y0 + h + 4))
    return img

def title_slide(bg, title):
    img = bg.copy()
    d = ImageDraw.Draw(img)
    lines = title.split("\n")
    pad_x, pad_y, gap = 34, 18, 14
    # 文字の実際の高さ（全行で共通の上端・下端）を測る
    tops, bottoms = [], []
    for l in lines:
        b = d.textbbox((0, 0), l, font=F_TITLE)
        tops.append(b[1]); bottoms.append(b[3])
    t_top, t_bot = min(tops), max(bottoms)
    box_h = (t_bot - t_top) + pad_y * 2
    total = len(lines) * box_h + (len(lines) - 1) * gap
    y = int(H * 0.47 - total / 2)
    boxes = []
    for l in lines:
        tw = d.textlength(l, font=F_TITLE)
        x = (W - tw) / 2
        boxes.append((x, y, tw))
        y += box_h + gap
    for x, y, tw in boxes:
        d.rounded_rectangle([x - pad_x, y, x + tw + pad_x, y + box_h], radius=26, fill=(255, 255, 255))
    for (x, y, tw), l in zip(boxes, lines):
        d.text((x, y + pad_y - t_top), l, font=F_TITLE, fill=(10, 10, 10))
    return img

def render_post(p, seed):
    bg = background(seed)
    folder = os.path.join(OUT, p["key"])
    os.makedirs(folder, exist_ok=True)
    slides = [title_slide(bg, p["title"])]
    for s in p["slides"]:
        if "__CTA__" in s:
            i = s.index("__CTA__")
            slides.append(card(bg.copy(), s[:i]))
            cta_lines = ["■ お主の恋の癖、わしが当ててやろう", "", CTA]
            slides.append(card(bg.copy(), cta_lines, extra_img=LP))
        else:
            slides.append(card(bg.copy(), s))
    paths = []
    for i, im in enumerate(slides, 1):
        pth = os.path.join(folder, f"{p['key']}_{i:02d}.png")
        im.save(pth, optimize=True); paths.append(pth)
    with open(os.path.join(folder, "caption.txt"), "w", encoding="utf-8") as f:
        f.write(p["caption"] + "\n")
    return paths

if __name__ == "__main__":
    for n, p in enumerate(POSTS):
        ps = render_post(p, seed=n + 3)
        print(p["key"], len(ps), "slides")
