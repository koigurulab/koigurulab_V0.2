import sys, json, html, os
sys.path.insert(0, os.path.dirname(__file__))
from mbti_data import TYPES, ORDER

OUT = sys.argv[1]
BASE = "https://koigurulab-v0-2.vercel.app"
DATE = "2026-11-26"
OG = BASE + "/assets/og-image.png"
os.makedirs(OUT, exist_ok=True)
e = html.escape

CSS = """
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--accent:#f97373;--accent-dark:#e45454;--ink:#111827;--muted:#6b7280;--border:#ffe4e6;--bg-soft:#fff7f8;--bg-white:#fff;--good:#10b981;--warn:#f59e0b;--radius-lg:20px;--radius-md:14px;--radius-pill:999px}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Helvetica Neue","Yu Gothic UI","Yu Gothic","Meiryo",sans-serif;font-size:15px;line-height:1.85;color:var(--ink);background:var(--bg-white)}
a{color:var(--accent-dark)}
.wrap{max-width:680px;margin:0 auto;padding:0 20px}
header{border-bottom:1px solid var(--border);background:var(--bg-white)}
header .wrap{display:flex;align-items:center;justify-content:space-between;padding-top:12px;padding-bottom:12px}
.logo{font-weight:800;text-decoration:none;color:var(--ink)}
.btn-sm{background:var(--accent);color:#fff;text-decoration:none;font-size:13px;font-weight:700;padding:8px 16px;border-radius:var(--radius-pill)}
.crumb{font-size:12px;color:var(--muted);padding:14px 0 0}
.crumb a{color:var(--muted)}
h1{font-size:clamp(22px,5.6vw,30px);line-height:1.4;margin:14px 0 6px}
.catch{color:var(--accent-dark);font-weight:700;margin-bottom:18px}
h2{font-size:20px;line-height:1.45;margin:36px 0 14px;padding-left:12px;border-left:4px solid var(--accent)}
h3{font-size:16px;margin:18px 0 4px}
p{margin:6px 0}
.sage{display:flex;gap:12px;align-items:flex-start;background:var(--bg-soft);border:1px solid var(--border);border-radius:var(--radius-md);padding:14px;margin:18px 0}
.sage img{width:56px;height:auto;flex-shrink:0}
.sage p{font-weight:600;margin:0}
ul.list{padding-left:0;list-style:none}
ul.list li{padding:8px 0 8px 26px;position:relative;border-bottom:1px dashed var(--border)}
ul.list li::before{content:"♡";position:absolute;left:4px;color:var(--accent)}
.match{display:grid;grid-template-columns:1fr 1fr;gap:12px}
@media(max-width:520px){.match{grid-template-columns:1fr}}
.match div{border:1px solid var(--border);border-radius:var(--radius-md);padding:12px 14px}
.match h3{margin-top:0}
.cta{background:linear-gradient(170deg,#fff0f2,#ffe4e6 60%,var(--bg-soft));border-radius:var(--radius-lg);padding:26px 20px;text-align:center;margin:36px 0}
.cta p{font-weight:700}
.btn{display:inline-block;margin-top:12px;background:linear-gradient(135deg,var(--accent),#fb7185);color:#fff;text-decoration:none;font-weight:800;font-size:16px;padding:15px 30px;border-radius:var(--radius-pill);box-shadow:0 12px 28px rgba(249,115,115,.4)}
.cta small{display:block;margin-top:10px;color:var(--muted);font-size:12px}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
@media(max-width:520px){.grid{grid-template-columns:repeat(4,1fr)}}
.grid a{display:block;text-align:center;border:1px solid var(--border);border-radius:10px;padding:10px 0;text-decoration:none;font-weight:700;color:var(--ink);background:var(--bg-white)}
.grid a.on{background:var(--accent);color:#fff;border-color:var(--accent)}
.note{font-size:12px;color:var(--muted);margin:28px 0 8px}
footer{border-top:1px solid var(--border);margin-top:40px;padding:24px 0;text-align:center;font-size:12px;color:var(--muted)}
.card{border:1px solid var(--border);border-radius:var(--radius-md);padding:14px 16px;margin:10px 0;text-decoration:none;color:var(--ink);display:block}
.card b{color:var(--accent-dark)}
"""

GA = """<script async src="https://www.googletagmanager.com/gtag/js?id=G-PMRW6LK7YG"></script>
<script>
window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
gtag('js',new Date());gtag('config','G-PMRW6LK7YG');
function track(n,p){try{gtag('event',n,p||{});}catch(e){}}
track('view_seo_page',%s);
</script>"""

def head(title, desc, url, ld, ga_params):
    return f"""<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>{e(title)}</title>
<meta name="description" content="{e(desc)}" />
<link rel="canonical" href="{url}" />
<meta name="theme-color" content="#f97373" />
<link rel="icon" type="image/png" sizes="48x48" href="/assets/favicon-48.png" />
<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png" />
<meta property="og:type" content="article" />
<meta property="og:site_name" content="恋ぐるラボ" />
<meta property="og:locale" content="ja_JP" />
<meta property="og:title" content="{e(title)}" />
<meta property="og:description" content="{e(desc)}" />
<meta property="og:url" content="{url}" />
<meta property="og:image" content="{OG}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:site" content="@koigurulab" />
<meta name="twitter:image" content="{OG}" />
<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>
<style>{CSS}</style>
{GA % json.dumps(ga_params)}
</head>
<body>
<header><div class="wrap"><a class="logo" href="/">恋ぐるラボ</a><a class="btn-sm" href="/chat.html" onclick="track('click_start_free',{{location:'{ga_params.get('location','seo')}_header'}})">無料で相談する →</a></div></header>
<main class="wrap">
"""

def foot():
    return """
<p class="note">※ MBTIは The Myers-Briggs Company の登録商標です。このページは16タイプの一般的な傾向をもとにした恋愛の読み物で、公式の診断や専門家のカウンセリングを代替するものではありません。どのタイプの組み合わせでも、うまくいく恋はあります。</p>
</main>
<footer><div class="wrap"><a href="/">恋ぐるラボ トップ</a>　|　<a href="/mbti/">MBTI別 恋愛の取扱説明書</a>　|　<a href="/chat.html">恋愛仙人に無料相談</a><p style="margin-top:8px">© 2025-2026 恋ぐるラボ</p></div></footer>
</body>
</html>
"""

def grid(active=None):
    cells = "".join(f'<a href="/mbti/{t.lower()}.html"{" class=\"on\"" if t==active else ""}>{t}</a>' for t in ORDER)
    return f'<div class="grid">{cells}</div>'

def cta(loc, lead):
    return f"""<section class="cta">
<p>{lead}</p>
<a class="btn" href="/chat.html" onclick="track('click_start_free',{{location:'{loc}'}})">✨ 恋愛仙人に無料で相談する</a>
<small>ログイン不要・ニックネームだけ・6ターンの無料チャット＋無料レポート</small>
</section>"""

# ---- タイプ別ページ ----
for t in ORDER:
    d = TYPES[t]
    url = f"{BASE}/mbti/{t.lower()}.html"
    title = f"{t}の恋愛傾向｜好きな人への態度・脈ありサイン・相性【恋愛仙人】"
    desc = f"{t}（{d['catch']}）の恋愛の特徴、好きな人にだけ見せる態度と脈ありサイン、ハマりやすい恋のクセ、相性の傾向を恋愛仙人が解説。"
    loc = f"mbti_{t.lower()}"
    ld = {"@context":"https://schema.org","@graph":[
        {"@type":"Article","headline":f"{t}の恋愛傾向｜好きな人への態度・脈ありサイン・相性","description":desc,
         "inLanguage":"ja","datePublished":DATE,"dateModified":DATE,"image":OG,"mainEntityOfPage":url,
         "author":{"@type":"Organization","name":"恋ぐるラボ"},"publisher":{"@type":"Organization","name":"恋ぐるラボ"}},
        {"@type":"BreadcrumbList","itemListElement":[
         {"@type":"ListItem","position":1,"name":"恋ぐるラボ","item":BASE+"/"},
         {"@type":"ListItem","position":2,"name":"MBTI別 恋愛の取扱説明書","item":BASE+"/mbti/"},
         {"@type":"ListItem","position":3,"name":f"{t}の恋愛","item":url}]}]}
    out = [head(title, desc, url, ld, {"page_type":"mbti","mbti":t,"location":loc})]
    out.append(f'<nav class="crumb"><a href="/">トップ</a> › <a href="/mbti/">MBTI別 恋愛の取扱説明書</a> › {t}</nav>')
    out.append(f"<h1>{t}の恋愛｜好きな人にだけ見せる態度と、ハマりやすい恋のクセ</h1>")
    out.append(f'<p class="catch">{e(d["catch"])}</p>')
    out.append(f'<div class="sage"><img src="/assets/senin_320.webp" alt="恋愛仙人" width="56" height="63" /><p>ほう、{t}の恋が気になるとな。わしが{t}の恋のクセを、やさしくほどいてやろう。</p></div>')
    out.append(f"<h2>{t}の恋愛の特徴</h2>")
    for i,(h,b) in enumerate(d["traits"],1):
        out.append(f"<h3>{i}. {e(h)}</h3><p>{e(b)}</p>")
    out.append(f"<h2>{t}が好きな人にとる態度・脈ありサイン</h2><ul class=\"list\">")
    out += [f"<li>{e(s)}</li>" for s in d["signs"]]
    out.append(f"</ul><p>いくつか当てはまるなら、{t}のあの人はお主に心を開き始めているかもしれん。ただし、ひとつの行動だけで決めつけず、全体の流れで見るのが大事じゃ。</p>")
    out.append(f"<h2>{t}がハマりやすい恋のぐるぐる</h2>")
    for h,b in d["loops"]:
        out.append(f"<h3>{e(h)}</h3><p>{e(b)}</p>")
    out.append(f'<div class="sage"><img src="/assets/senin_320.webp" alt="恋愛仙人" width="56" height="63" /><p>{e(d["sennin"])}</p></div>')
    out.append(f"<h2>{t}の恋を進めるコツ</h2><ul class=\"list\">")
    out += [f"<li>{e(s)}</li>" for s in d["tips"]]
    out.append("</ul>")
    out.append(cta(loc+"_mid", f"自分と相手のタイプがわかれば、二人の“すれ違いの構図”が見えてくるぞ。{t}のあの人との恋、わしに話してみんか？"))
    out.append(f"<h2>{t}と相性の傾向</h2><div class=\"match\"><div><h3>噛み合いやすいタイプ</h3>")
    out += [f'<p><a href="/mbti/{x.lower()}.html"><b>{x}</b></a>：{e(r)}</p>' for x,r in d["good"]]
    out.append("</div><div><h3>すれ違いやすいタイプ</h3>")
    out += [f'<p><a href="/mbti/{x.lower()}.html"><b>{x}</b></a>：{e(r)}</p>' for x,r in d["bad"]]
    out.append("</div></div><p>相性は“傾向”にすぎん。すれ違いやすい組み合わせでも、違いを知っていれば、むしろお互いを補い合える関係になれるんじゃ。</p>")
    out.append("<h2>ほかのタイプの恋愛も見る</h2>")
    out.append(grid(t))
    out.append(foot())
    open(f"{OUT}/{t.lower()}.html","w",encoding="utf-8").write("\n".join(out))

# ---- ハブページ ----
url = BASE + "/mbti/"
title = "MBTI別 恋愛の取扱説明書｜16タイプの好きな人への態度・脈ありサイン【恋愛仙人】"
desc = "INFP・ENFP・INTJなどMBTI16タイプ別に、恋愛の特徴、好きな人への態度、脈ありサイン、相性の傾向を恋愛仙人が解説。あの人のタイプから恋のヒントを探そう。"
ld = {"@context":"https://schema.org","@type":"CollectionPage","name":title,"description":desc,"url":url,"inLanguage":"ja",
      "hasPart":[{"@type":"Article","headline":f"{t}の恋愛傾向","url":f"{BASE}/mbti/{t.lower()}.html"} for t in ORDER]}
out = [head(title, desc, url, ld, {"page_type":"mbti_hub","location":"mbti_hub"})]
out.append('<nav class="crumb"><a href="/">トップ</a> › MBTI別 恋愛の取扱説明書</nav>')
out.append("<h1>MBTI別 恋愛の取扱説明書｜16タイプの好きな人への態度と脈ありサイン</h1>")
out.append('<div class="sage"><img src="/assets/senin_320.webp" alt="恋愛仙人" width="56" height="63" /><p>あの人のタイプがわかれば、行動の意味が見えてくるぞ。気になるタイプを選んでみるのじゃ。</p></div>')
out.append(grid())
out.append("<h2>タイプ別の恋のキャッチフレーズ</h2>")
for t in ORDER:
    out.append(f'<a class="card" href="/mbti/{t.lower()}.html"><b>{t}</b>　{e(TYPES[t]["catch"])}</a>')
out.append(cta("mbti_hub_bottom", "タイプの傾向がわかったら、次はお主と相手の“二人の構図”じゃ。わしが無料で言語化してやろう。"))
out.append(foot())
open(f"{OUT}/index.html","w",encoding="utf-8").write("\n".join(out))
print("generated", len(ORDER)+1, "pages")
