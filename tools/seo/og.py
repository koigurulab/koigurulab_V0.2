import os
from PIL import Image, ImageDraw, ImageFont
W,H=1200,630
img=Image.new("RGB",(W,H),"#fff7f8")
d=ImageDraw.Draw(img)
# vertical gradient
top=(255,232,236); bot=(255,247,248)
for y in range(H):
    t=y/H
    c=tuple(int(top[i]*(1-t)+bot[i]*t) for i in range(3))
    d.line([(0,y),(W,y)],fill=c)
B="/usr/share/fonts/opentype/noto/NotoSansCJK-Black.ttc"
M="/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"
f_tag=ImageFont.truetype(M,30,index=0)
f_h1=ImageFont.truetype(B,58,index=0)
f_sub=ImageFont.truetype(M,30,index=0)
f_logo=ImageFont.truetype(B,36,index=0)
accent=(228,84,84); ink=(17,24,39); muted=(107,114,128)
# tag pill
tag="MBTI × 恋愛16タイプ ｜ 無料AI恋愛相談"
tw=d.textlength(tag,font=f_tag)
d.rounded_rectangle([70,70,70+tw+44,70+56],radius=28,fill=(255,241,242),outline=(254,202,202),width=2)
d.text((92,78),tag,font=f_tag,fill=(185,28,28))
# headline
d.text((70,170),"恋のぐるぐる、",font=f_h1,fill=ink)
d.text((70,245),"恋愛仙人が言語化する。",font=f_h1,fill=accent)
d.text((70,345),"既読スルーの不安も、脈ありかの迷いも。",font=f_sub,fill=muted)
d.text((70,390),"6ターンの無料チャットで、恋のクセがわかる。",font=f_sub,fill=muted)
# logo
d.rounded_rectangle([70,500,126,556],radius=14,fill=(249,115,115))
d.text((80,503),"恋",font=f_logo,fill="white")
d.text((140,505),"恋ぐるラボ",font=f_logo,fill=ink)
# sage
sage=Image.open(os.path.join(os.path.dirname(os.path.abspath(__file__)),"..","..","assets","senin_320.webp")).convert("RGBA")
sage=sage.resize((int(320*1.12),int(362*1.12)),Image.LANCZOS)
img.paste(sage,(W-sage.width-50,H-sage.height-20),sage)
img.save(os.path.join(os.path.dirname(os.path.abspath(__file__)),"..","..","assets","og-image.png"),optimize=True)
print("ok")
