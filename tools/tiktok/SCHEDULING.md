# 週次の投稿づくりと予約（TikTok / Instagram）

毎週土曜の自動実行で、翌週7本（毎日20:00 JST）を作って予約するための手順。
2026/11/27 の1週目で実際に通した手順をそのまま書いている。座標は画面サイズで変わるので、必ずスクリーンショットで位置を確かめてから押す。

## 1. 原稿をつくる
- `tools/tiktok/weekN_posts.py` に `WEEKN = [dict(...), ...]` を7本書く（形式は `week1_posts.py` と同じ）。
  - `key` / `label` / `fmt`（A=本音型、B=時系列型、C=相手目線型） / `bg`（背景画像のファイル名） / `title`（表紙、\nで改行） / `caption` / `cta`（CTA_SELF か CTA_PARTNER） / `slides`（中6枚）
  - 2枚目の見出しは【タイトル】。■=見出し、✔=チェック、""=空行。
  - 仙人の言葉（わし、お主、〜じゃ）。言葉を “ ” や " " で囲まない。
- `render_type_posts.py` は `week1_posts.py` を読む作りなので、新しい週のファイルも読むように1行足す。
- 背景画像はオーナーPCの `恋愛仙人/TikTok_恋愛仙人/背景画像/` から選ぶ（HEICは使わずJPG）。リポジトリには入れない。

## 2. 画像を書き出す（オーナーPCの device_bash で実行できる。python3 と Pillow あり）
```
python3 tools/tiktok/render_type_posts.py <背景画像フォルダ> <出力フォルダ> [key ...]
```
- 1本につき 01〜08.jpg（1080x1920）＋ caption.txt ＋ `<key>_sheet.jpg`（確認用の一覧）。
- 書き出したら必ず sheet を開いて、文字の切れ・はみ出し・“ ”の混入を目で確かめる。
- オーナーPCの `恋愛仙人/TikTok_恋愛仙人/投稿用/N週目/<D日目_TYPE>/` に 01〜08.jpg と 投稿文.txt を置く。

## 3. Instagram用（4:5）に変換
Instagramのカルーセルは縦長9:16だと上下が切れる。
```
python3 tools/tiktok/make_ig.py "<投稿用>/N週目" "<投稿用>/N週目_Instagram"
```
- 白いカードが中央1350pxに収まるスライドは中央を切り抜き、収まらないもの（最後のCTA）は縮小してぼかし背景に載せる。

## 4. オーナーのOKをもらう
- 7本の一覧（日付・タイプ・型・表紙の文言）と sheet 画像を見せて、予約してよいか聞く。OKが出るまで予約しない。

## 5. Claude in Chrome にファイルを渡す
- Chrome の file_upload は `/mnt/user-data/uploads/` 配下しか受け付けない（Macのパスや outputs は拒否）。
- `device_stage_files` で Mac の画像を取り込むと `/mnt/user-data/uploads/TikTok_恋愛仙人/投稿用/...` に入る。1回50件まで。
- file_upload は1回3.8MBまで（8枚で約1.5MBなので1回で足りる）。
- ファイル入力は read_page の interactive では見えない。JS で `aria-label` を付けてから `read_page filter=all` で ref を探す。

## 6. TikTok（TikTok Studio）
1. `https://www.tiktok.com/tiktokstudio/upload?from=upload&lang=ja-JP&tab=photo` を開く。
2. JS: `document.querySelectorAll('input[type=file]').forEach((f,i)=>f.setAttribute('aria-label','koi-upload-'+i))` → read_page(all) で ref → 8枚を file_upload。
3. タイトル：JS で `input[placeholder="キャッチーなタイトルを追加する"]` に focus して入力（表紙の文言の1文目）。
4. 説明：JS で `[contenteditable=true]` に focus して caption を入力。
5. 曲：ボタン「楽曲を追加」→ タブ「最近」→ RADWIMPS「デート」の Use。検索は結果がぶれるので「最近」を優先。
6. 予約：JS で `input[type=radio][value=schedule]` を scrollIntoView してクリック。
   - 日付：日付欄を開いて日を押す。月末の週は、翌月の1日〜も同じ画面の最終行に並ぶ。
   - 時刻：時刻欄を開き、時の列で20を押す。分の列は上にスクロールしてから00を押す。外をクリックして閉じる。
7. 押す前に JS で確認：日付の文字（2026年M月D日）、時刻（20:00）、タイトル、説明、曲（デート - RADWIMPS）、写真の数（Delete photo ボタンが8個）。
8. 「投稿予約する」を押す。`https://www.tiktok.com/tiktokstudio/content` で「M月D日 午後8:00 (GMT+9) Tokyo」と出ていれば完了。
- 予約できるのはおよそ10日先まで。

## 7. Instagram（instagram.com、Meta Business Suite は不要）
1. `https://www.instagram.com/koi_sennin/` → 左の「作成」→「投稿」。
2. ダイアログ内の `input[type=file]` に JS で aria-label → read_page で ref → 4:5版の8枚を file_upload。
3. 切り取り：左下の比率アイコン → 4:5。ダイアログの外を押すと「投稿を破棄しますか？」が出るので、出たら「キャンセル」。
4. 「次へ」→（フィルター）「次へ」→ キャプション欄に caption を入力。
5. 「コンテンツを日時指定」をオン → 少しスクロール → 日付欄（翌月は右矢印） → 時刻は Hours 欄を押して 20、Minutes 欄を押して 00 と入力。
6. JS で確認：`input[aria-label=Hours]` と `Minutes` の aria-valuenow が 20 / 0、日付の文字、キャプション。
7. 右上「投稿日時を指定」→ 15秒ほど待つ →「あなたの投稿が日時指定されました」→「完了」。
8. `https://www.instagram.com/scheduled_content/` で7本並んでいれば完了。
- Instagramには曲を付けていない。

## 8. 後片付け
- 自分で開いたタブを閉じる。
- ロードマップ（Claude Docs）の「作業ボード」と「実験ログ」を更新する。
