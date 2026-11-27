import sys, glob, os
from PIL import Image, ImageFilter, ImageEnhance
import numpy as np
src, out = sys.argv[1], sys.argv[2]
W, H = 1080, 1350
worst = (9999, 0)
for d in sorted(glob.glob(os.path.join(src, '*'))):
    name = os.path.basename(d)
    od = os.path.join(out, name); os.makedirs(od, exist_ok=True)
    for f in sorted(glob.glob(os.path.join(d, '*.jpg'))):
        n = os.path.basename(f)
        im = Image.open(f).convert('RGB')
        g = np.asarray(im.convert('L')).astype(int)
        rows = np.where((g > 235).mean(axis=1) > 0.3)[0]
        top, bot = (rows.min(), rows.max()) if len(rows) else (0, 1919)
        y0 = (1920 - H) // 2
        if top >= y0 + 20 and bot <= y0 + H - 20:
            res = im.crop((0, y0, W, y0 + H))
            worst = (min(worst[0], top), max(worst[1], bot))
        else:
            # fit: crop content band with margin, scale to height H, center on blurred bg
            m = 30
            a, b = max(0, top - m), min(1920, bot + m)
            band = im.crop((0, a, W, b))
            s = H / band.height
            band = band.resize((int(W * s), H), Image.LANCZOS)
            bg = im.crop((0, y0, W, y0 + H)).filter(ImageFilter.GaussianBlur(18))
            bg = ImageEnhance.Brightness(bg).enhance(0.75)
            bg.paste(band, ((W - band.width) // 2, 0))
            res = bg
            print('fit', name, n, top, bot, 'scale', round(s, 3))
        res.save(os.path.join(od, n), quality=92)
print('crop slides content range', worst)
