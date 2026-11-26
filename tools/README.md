# 運用ツール（サイトには配信されません：.vercelignore で除外）

## TikTokカルーセル（tools/tiktok）
型：2026/3/31の「ISFJ(擁護者)の恋愛傾向」（30万再生・保存2,723）を踏襲。
夜の街のボケ背景 × 白いテキストカード × 仙人口調 × 「悲しいところを当てる」✔リスト × 最後にCTA＋LP画像。

1. `tiktok_posts.py` の `POSTS` に原稿を追加（■=見出し、✔=チェック、""=空行、`__CTA__`でCTAスライドを自動追加）
2. `python3 tools/tiktok/render_tiktok.py` → `tools/tiktok/out/<key>/` に1080x1920のPNGとcaption.txt
3. 動画版：`python3 tools/tiktok/make_video.py <key>` → `<key>_video.mp4`
※ out/ はコミットしない

## SEOページ（tools/seo）
- `mbti_data.py` を編集 → `python3 tools/seo/gen_mbti.py mbti` で /mbti/ を再生成
- `og.py`：OGP画像の再生成
