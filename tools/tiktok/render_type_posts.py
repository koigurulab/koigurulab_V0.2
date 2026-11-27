"""1タイプずつのカルーセル投稿を描く（写真背景＋白カード、最後は10秒診断への案内）。

  python3 tools/tiktok/render_type_posts.py <背景画像フォルダ> [出力先] [key...]

背景画像はオーナーのPC（恋愛仙人/TikTok_恋愛仙人/背景画像）にあり、リポジトリには入れない。
出力：<出力先>/<key>/<key>_01.png〜06.png、caption.txt、確認用の一覧画像 <key>_sheet.jpg
"""
import os, sys
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import render_tiktok as rt          # カード・タイトルの描画を共用する
from type_posts import POSTS
try:
    from week1_posts import WEEK1
    POSTS = POSTS + WEEK1
except ImportError:
    pass

W, H = rt.W, rt.H
BG_DIR = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "bg")
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, "out_type")
ONLY = set(sys.argv[3:])
START = Image.open(os.path.join(HERE, "assets", "start_top.png")).convert("RGB")


def photo_bg(name):
    """写真を縦長に切り抜き、少しぼかして暗くする（白カードの文字を読みやすくするため）"""
    im = Image.open(os.path.join(BG_DIR, name)).convert("RGB")
    s = max(W / im.width, H / im.height)
    im = im.resize((int(im.width * s) + 1, int(im.height * s) + 1), Image.LANCZOS)
    x, y = (im.width - W) // 2, (im.height - H) // 2
    im = im.crop((x, y, x + W, y + H)).filter(ImageFilter.GaussianBlur(2))
    return Image.blend(im, Image.new("RGB", (W, H), (0, 0, 0)), 0.22)


def start_shot():
    """10秒診断の画面：お主のMBTIの16個と「わからない」まで（元画像で上から975px）"""
    w = 828
    shot = START.resize((w, int(START.height * w / START.width)), Image.LANCZOS)
    return shot.crop((0, 0, w, min(shot.height, int(975 * w / START.width))))


def render(p):
    bg = photo_bg(p["bg"])
    folder = os.path.join(OUT, p["key"])
    os.makedirs(folder, exist_ok=True)
    slides = [rt.title_slide(bg, p["title"])]
    for s in p["slides"]:
        slides.append(rt.card(bg.copy(), s))
    slides.append(rt.card(bg.copy(), p["cta"], top=260, extra_img=start_shot()))
    paths = []
    for i, im in enumerate(slides, 1):
        pth = os.path.join(folder, f"{p['key']}_{i:02d}.png")
        im.save(pth, optimize=True)
        paths.append(pth)
    with open(os.path.join(folder, "caption.txt"), "w", encoding="utf-8") as f:
        f.write(p["caption"] + "\n")
    # 確認用：6枚を横に並べた一覧
    tw, th, gap = 300, 533, 16
    sheet = Image.new("RGB", (len(slides) * (tw + gap) + gap, th + 2 * gap + 50), (245, 245, 245))
    d = ImageDraw.Draw(sheet)
    d.text((gap, 10), p.get("label", p["key"]), font=rt.F_HEAD.font_variant(size=30), fill=(20, 20, 20))
    for i, im in enumerate(slides):
        sheet.paste(im.resize((tw, th), Image.LANCZOS), (gap + i * (tw + gap), 50 + gap))
    sheet.save(os.path.join(OUT, f"{p['key']}_sheet.jpg"), quality=88)
    return paths


if __name__ == "__main__":
    for p in POSTS:
        if ONLY and p["key"] not in ONLY:
            continue
        print(p["key"], len(render(p)), "slides")
