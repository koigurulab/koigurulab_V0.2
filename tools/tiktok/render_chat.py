"""実演型TikTok投稿（仙人が相談に答えるチャット画面）を 1080x1920 のPNGで書き出す。

使い方:
  python3 tools/tiktok/render_chat.py <背景画像フォルダ> [出力先]
背景画像はオーナーのPC（恋愛仙人/TikTok_恋愛仙人/背景画像）にあり、リポジトリには入れない。
"""
import os, re, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, HERE)
from chat_posts import POSTS, CTA_MAIN, CTA_SUB

BG_DIR = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "bg")
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, "out")
W, H = 1080, 1920
MED = "/usr/share/fonts/opentype/noto/NotoSansCJK-Medium.ttc"
BOLD = "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"
BLACK = "/usr/share/fonts/opentype/noto/NotoSansCJK-Black.ttc"
F = lambda path, size: ImageFont.truetype(path, size, index=0)
F_BUB, F_NAME, F_SMALL = F(MED, 37), F(BOLD, 38), F(MED, 27)
F_TITLE, F_PAIR = F(BLACK, 80), F(BOLD, 44)
INK, MUTED, ACCENT, ACCENT_DARK = (24, 24, 27), (107, 114, 128), (249, 115, 115), (228, 84, 84)
CHAT_BG, GREEN = (254, 242, 242), (16, 185, 129)
SAGE = Image.open(os.path.join(REPO, "assets", "senin_320.webp")).convert("RGBA")
START = Image.open(os.path.join(HERE, "assets", "start_top.png")).convert("RGB")
NO_START = set("、。，．）」』】！？ー…っゃゅょァィゥェォッャュョ・")

def tokens(text):
    return re.findall(r"[A-Za-z0-9()（）×]+|.", text)

def wrap(text, font, maxw):
    lines, cur = [], ""
    for tk in tokens(text):
        if font.getlength(cur + tk) <= maxw or (len(tk) == 1 and tk in NO_START):
            cur += tk
        else:
            if cur: lines.append(cur)
            cur = tk.lstrip() if tk.strip() else ""
    if cur: lines.append(cur)
    return lines

def background(name):
    im = Image.open(os.path.join(BG_DIR, name)).convert("RGB")
    s = max(W / im.width, H / im.height)
    im = im.resize((int(im.width * s) + 1, int(im.height * s) + 1), Image.LANCZOS)
    x, y = (im.width - W) // 2, (im.height - H) // 2
    im = im.crop((x, y, x + W, y + H)).filter(ImageFilter.GaussianBlur(3))
    dark = Image.new("RGB", (W, H), (0, 0, 0))
    return Image.blend(im, dark, 0.38)

def avatar(size):
    a = SAGE.copy()
    a.thumbnail((size, size * 1.2), Image.LANCZOS)
    circle = Image.new("RGBA", (size, size), (255, 241, 242, 255))
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, size - 1, size - 1], fill=255)
    circle.paste(a, ((size - a.width) // 2, max(0, (size - a.height) // 2 + 4)), a)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(circle, (0, 0), mask)
    return out

def shadow_card(img, box, radius=40):
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle([box[0] + 6, box[1] + 12, box[2] + 6, box[3] + 12], radius, fill=(0, 0, 0, 120))
    img.paste(Image.alpha_composite(img.convert("RGBA"), sh.filter(ImageFilter.GaussianBlur(16))).convert("RGB"))

def title_slide(bg, post):
    img = bg.copy(); d = ImageDraw.Draw(img)
    y = 700
    for line in post["title"]:
        tw = d.textlength(line, font=F_TITLE); x = (W - tw) / 2
        d.rounded_rectangle([x - 34, y - 10, x + tw + 34, y + 112], 26, fill=(255, 255, 255))
        d.text((x, y - 4), line, font=F_TITLE, fill=(10, 10, 10))
        y += 128
    pw = d.textlength(post["pair"], font=F_PAIR); x = (W - pw) / 2
    d.rounded_rectangle([x - 28, y + 20, x + pw + 28, y + 96], 38, fill=ACCENT)
    d.text((x, y + 26), post["pair"], font=F_PAIR, fill=(255, 255, 255))
    note = "※よくある相談をもとにした例じゃ"
    nw = d.textlength(note, font=F_SMALL)
    d.text(((W - nw) / 2, 1430), note, font=F_SMALL, fill=(255, 255, 255))
    return img

def chat_slide(bg, bubbles, note=False):
    img = bg.copy()
    x0, x1, y0 = 56, 1024, 190
    pad, maxw, lh, gap = 34, 600, 56, 26
    av_big, av = avatar(84), avatar(64)
    # 吹き出しの寸法を先に計算
    rows, last = [], None
    for who, text in bubbles:
        lines = wrap(text, F_BUB, maxw)
        bw = max(F_BUB.getlength(l) for l in lines) + 56
        bh = len(lines) * lh + 40
        rows.append((who, lines, bw, bh, who == "s" and last != "s"))
        last = who
    body_h = sum(r[3] for r in rows) + gap * (len(rows) - 1) + pad * 2 + (44 if note else 0)
    head_h = 124
    y1 = y0 + head_h + body_h
    shadow_card(img, (x0, y0, x1, y1))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([x0, y0, x1, y1], 40, fill=(255, 255, 255))
    d.rounded_rectangle([x0, y0 + head_h, x1, y1], 40, fill=CHAT_BG)
    d.rectangle([x0, y0 + head_h, x1, y0 + head_h + 40], fill=CHAT_BG)
    d.line([x0, y0 + head_h, x1, y0 + head_h], fill=(255, 228, 230), width=2)
    img.paste(av_big, (x0 + 30, y0 + 20), av_big)
    d.text((x0 + 132, y0 + 22), "恋愛仙人", font=F_NAME, fill=INK)
    d.ellipse([x0 + 134, y0 + 84, x0 + 148, y0 + 98], fill=GREEN)
    d.text((x0 + 158, y0 + 72), "オンライン", font=F_SMALL, fill=GREEN)
    y = y0 + head_h + pad
    for who, lines, bw, bh, show_av in rows:
        if who == "u":
            bx1 = x1 - pad; bx0 = bx1 - bw
            d.rounded_rectangle([bx0, y, bx1, y + bh], 30, fill=ACCENT)
            color = (255, 255, 255)
        else:
            if show_av: img.paste(av, (x0 + 26, y), av)
            bx0 = x0 + 26 + 64 + 16; bx1 = bx0 + bw
            d.rounded_rectangle([bx0, y, bx1, y + bh], 30, fill=(255, 255, 255))
            color = INK
        ty = y + 18
        for l in lines:
            d.text((bx0 + 28, ty), l, font=F_BUB, fill=color); ty += lh
        y += bh + gap
    if note:
        d.text((x0 + pad, y1 - pad - 30), "※よくある相談をもとにした例じゃ", font=F_SMALL, fill=MUTED)
    return img

def teaser_slide(bg, traits):
    img = bg.copy()
    x0, x1, y0 = 56, 1024, 300
    rows_y0, row_h = y0 + 190, 112
    lock_y = rows_y0 + 5 * row_h + 16
    text_y = lock_y + 110
    y1 = text_y + 150
    shadow_card(img, (x0, y0, x1, y1))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([x0, y0, x1, y1], 40, fill=(255, 255, 255))
    av = avatar(84); img.paste(av, (x0 + 40, y0 + 40), av)
    d.text((x0 + 144, y0 + 44), "仙人がまとめた、お主の恋の癖", font=F(BOLD, 42), fill=INK)
    d.text((x0 + 144, y0 + 100), "無料レポートより（5つのうち2つ）", font=F_SMALL, fill=MUTED)
    hidden = ["自分を責めすぎるところがある", "安心の確認が止まらなくなる", "不安を頭の中でくり返す"]
    for i, t in enumerate(traits + hidden, 1):
        cy = rows_y0 + (i - 1) * row_h + 46
        d.ellipse([x0 + 44, cy - 26, x0 + 96, cy + 26], fill=ACCENT if i <= 2 else (229, 231, 235))
        num = str(i); nw = d.textlength(num, font=F(BOLD, 32))
        d.text((x0 + 70 - nw / 2, cy - 22), num, font=F(BOLD, 32), fill=(255, 255, 255))
        d.text((x0 + 122, cy - 26), t, font=F(BOLD, 38) if i <= 2 else F_BUB, fill=INK)
        if i > 2:
            region = (x0 + 116, cy - 34, x1 - 40, cy + 34)
            img.paste(img.crop(region).filter(ImageFilter.GaussianBlur(11)), region[:2])
            d = ImageDraw.Draw(img)
    lock = "続きは、お主専用のレポートで"
    lw = d.textlength(lock, font=F(BOLD, 34))
    d.rounded_rectangle([(W - lw) / 2 - 26, lock_y, (W + lw) / 2 + 26, lock_y + 66], 33, fill=(17, 24, 39))
    d.text(((W - lw) / 2, lock_y + 10), lock, font=F(BOLD, 34), fill=(255, 255, 255))
    d.text((x0 + 44, text_y), "このほか、二人の構図と、", font=F_BUB, fill=INK)
    d.text((x0 + 44, text_y + 56), "次の一手まで書いてあるぞ。", font=F_BUB, fill=INK)
    return img

def cta_slide(bg):
    img = bg.copy()
    x0, x1, y0, y1 = 56, 1024, 230, 1500
    shadow_card(img, (x0, y0, x1, y1))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([x0, y0, x1, y1], 40, fill=(255, 255, 255))
    f_main = F(BLACK, 58)
    tw = d.textlength(CTA_MAIN, font=f_main)
    d.text(((W - tw) / 2, y0 + 56), CTA_MAIN, font=f_main, fill=ACCENT_DARK)
    for i, l in enumerate(CTA_SUB.split("\n")):
        lw = d.textlength(l, font=F(BOLD, 38))
        d.text(((W - lw) / 2, y0 + 150 + i * 56), l, font=F(BOLD, 38), fill=INK)
    shot = START.copy()
    sw = 640; shot = shot.resize((sw, int(shot.height * sw / shot.width)), Image.LANCZOS)
    shot = shot.crop((0, 0, sw, min(shot.height, 860)))
    sx, sy = (W - sw) // 2, y0 + 300
    mask = Image.new("L", shot.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, shot.width - 1, shot.height - 1], 28, fill=255)
    d.rounded_rectangle([sx - 4, sy - 4, sx + shot.width + 4, sy + shot.height + 4], 32, fill=(255, 228, 230))
    img.paste(shot, (sx, sy), mask)
    d = ImageDraw.Draw(img)
    foot = "無料・登録なし・10秒"
    fw = d.textlength(foot, font=F_SMALL)
    d.text(((W - fw) / 2, sy + shot.height + 24), foot, font=F_SMALL, fill=MUTED)
    return img

def render(post):
    bg = background(post["bg"])
    folder = os.path.join(OUT, post["key"]); os.makedirs(folder, exist_ok=True)
    slides = [title_slide(bg, post)]
    for i, s in enumerate(post["slides"]):
        slides.append(chat_slide(bg, s, note=(i == 0)))
    slides += [teaser_slide(bg, post["traits"]), cta_slide(bg)]
    for i, im in enumerate(slides, 1):
        im.save(os.path.join(folder, f"{post['key']}_{i:02d}.png"), optimize=True)
    with open(os.path.join(folder, "caption.txt"), "w", encoding="utf-8") as f:
        f.write(post["caption"] + "\n")
    return len(slides)

if __name__ == "__main__":
    for p in POSTS:
        print(p["key"], render(p), "slides")
