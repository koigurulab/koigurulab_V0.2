# CLAUDE.md — 恋ぐるラボ（Koigurulab）V0.2

> AI アシスタント向けのコードベース解説・開発規約・プロダクト戦略ドキュメント

---

## 1. プロダクト概要

**恋ぐるラボ（恋愛仙人チャット）** は、MBTI × 独自「恋愛16タイプ」を掛け合わせた恋愛相談AIサービス。
"恋愛仙人"というキャラクターがチャットで悩みを聞き、パーソナライズされた「恋ぐるレポート」を生成する。

- **ターゲット**: 18〜28歳、スマホ中心の恋愛悩み層（現状フォロワー 63% 男性・37% 女性）
- **収益モデル**: フリーミアム（無料チャット6ターン + 無料レポート → 有料フルレポート ¥480 買い切り）
- **集客チャネル**: TikTok → Web LP → チャット → 課金

---

## 2. リポジトリ構成

```
koigurulab_V0.2/
├── index.html              # LP（ランディングページ）
├── chat.html               # メインのチャット画面（インテーク → 対話 → ペイウォール）
├── paid-success.html        # Stripe 決済後のフルレポート生成画面
├── paid-cancel.html         # 決済キャンセル画面
├── dev-report.html          # 開発用レポートテスト画面
├── sennin-icon.png          # 仙人アイコン（1.3MB）
├── assets/
│   └── senin_320.webp       # 仙人キャラクター画像（軽量版）
└── api/
    ├── chat.js              # チャット応答 API（gpt-4.1-mini）
    ├── paid-summary.js      # レポート設計図 JSON 生成（gpt-4.1-mini, strict schema）
    ├── paid-report.js       # 有料フルレポート生成（gpt-4.1, streaming）
    ├── free-report-stream.js # 無料レポート生成（gpt-4.1, streaming）
    ├── create-checkout-session.js  # Stripe Checkout Session 作成
    ├── verify-paid.js       # Stripe 支払い検証
    └── dev-paid-report.js   # 開発用レポート生成（Edge Runtime）
```

---

## 3. 技術スタック

| レイヤー | 技術 | 備考 |
|---------|------|------|
| **フロントエンド** | Vanilla HTML/CSS/JS | フレームワークなし、モバイルファースト |
| **バックエンド** | Vercel Functions (Node.js) | api/ ディレクトリが Vercel にデプロイされる |
| **LLM** | OpenAI API | gpt-4.1（レポート）/ gpt-4.1-mini（チャット・設計図） |
| **決済** | Stripe Checkout (REST, SDK不使用) | ¥480 固定、一回払い |
| **アナリティクス** | GA4 (`G-PMRW6LK7YG`) | カスタムイベント多数 |
| **データ永続化** | ブラウザ localStorage のみ | サーバー側 DB なし（重大な制約） |
| **ホスティング** | Vercel | 静的 HTML + Serverless Functions |

### 環境変数（Vercel に設定が必要）

```
OPENAI_API_KEY          # OpenAI API キー
STRIPE_SECRET_KEY       # Stripe シークレットキー
STRIPE_PRICE_ID         # Stripe 価格オブジェクト ID（¥480）
NEXT_PUBLIC_APP_URL     # 本番 URL（例: https://koigurulab.vercel.app）
FREE_REPORT_MODEL       # 無料レポート用モデル（デフォルト: gpt-4.1）
```

---

## 4. ユーザーフロー（現行）

```
TikTok 動画
  ↓ プロフ欄リンク
index.html（LP）
  ↓ 「無料で相談してみる」
chat.html（インテーク：16ステップの質問）
  ↓ インテーク完了
チャット（仙人との対話：最大 6 ターン）
  ├── フェーズ F（Feeling）: ターン 1-3 → 感情の言語化
  ├── フェーズ P（Partner）: ターン 4 → 相手の行動パターン分析
  └── フェーズ D（Direction）: ターン 5-6 → 方向性
  ↓ 6 ターン完了
/api/paid-summary → summaryJson 生成（設計図）
/api/free-report-stream → 無料レポート（3,000〜4,000 字）
  ↓ ペイウォール表示
「購入する」→ /api/create-checkout-session → Stripe Checkout
  ↓ 支払い完了
paid-success.html
  ├── /api/verify-paid → 支払い検証
  └── /api/paid-report → フルレポート（10,000〜13,000 字, streaming）
  ↓
レポート表示（TXT/PDF 保存・コピー可能）
```

---

## 5. コア機能の詳細

### 5.1 インテーク（chat.html: steps 配列）

16 ステップで以下の情報を収集：

| # | key | 種類 | 内容 |
|---|-----|------|------|
| 1 | name | input | ニックネーム |
| 2 | gender | choice | 性別（女性/男性/その他） |
| 3 | selfMBTI | choice | 自分の MBTI（16型 + わからない） |
| 4 | selfLove | choice | 自分の恋愛16タイプ（16型 + わからない） |
| 5 | targetGender | choice | 恋愛対象の性別 |
| 6 | targetMBTI | choice | 相手の MBTI |
| 7 | targetLove | choice | 相手の恋愛16タイプ |
| 8 | ageRange | input | 年齢レンジ |
| 9 | status | input | 学生/社会人 |
| 10 | relation | input | 関係性（片思い/交際中/元カレなど） |
| 11 | meeting | choice | 出会い方 |
| 12 | known | input | 知り合った期間 |
| 13 | contact | input | 連絡頻度 |
| 14 | worry | input | 一番の悩み（3行） |
| 15 | mental | input | 今の心の状態 |
| 16 | style | choice | 相談スタイル（もやもや整理/作戦会議） |

MBTI/Love16 選択時に **quickAcknowledge()** が LLM を呼び、占い風にタイプ解説する（350〜550字）。

### 5.2 恋愛16タイプ（独自フレームワーク）

```
ボス猫, 隠れベイビー, 主役体質, ツンデレヤンキー,
憧れの先輩, カリスマバランサー, パーフェクトカメレオン, キャプテンライオン,
ロマンスマジシャン, ちゃっかりうさぎ, 恋愛モンスター, 忠犬ハチ公,
不思議生命体, 敏腕マネージャー, デビル天使, 最後の恋人
```

各タイプは 4 文字コード（LCRO, FCPE 等）と恋愛傾向の summary を持つ。

### 5.3 チャットフェーズ（F → P → D）

| フェーズ | ターン | 焦点 | 禁止事項 |
|---------|--------|------|---------|
| **F** (Feeling) | 1-3 | ユーザー自身の感情 | 相手の行動推理、行動提案 |
| **P** (Partner) | 4 | 相手の行動パターン | 行動提案、進め方の質問 |
| **D** (Direction) | 5-6 | 今後の方向性 | 正解の決めつけ |

毎ターンの必須要素（COMMON_SYS_TEMPLATE）:
1. やわらかい共感とほめ
2. 性格当てを絡めた気持ちの言語化ブロック（6〜10 文）
3. タイプの掛け算で「二人の構図」を描写
4. 心の声セリフ + 番号付き選択肢で締め（final_turn 以外）

### 5.4 レポート生成パイプライン

```
profile + history
  ↓
/api/paid-summary（gpt-4.1-mini, temp=0.4, JSON Schema strict）
  → summaryJson = {
      title, opening_current_position,
      fortune_traits[5],   // 固定3 + 可変2
      chapter1〜7, ending_last_words
    }
  ↓
/api/paid-report（gpt-4.1, temp=0.7, streaming）
  → 10,000〜13,000 字のフルレポート

/api/free-report-stream（gpt-4.1, temp=0.7, streaming）
  → 3,000〜4,000 字の無料レポート（2/5 のクセのみ公開）
```

**fortune_traits の固定3タイトル（厳密一致必須）:**
1. 反応の温度差で心がぐらぐらする
2. 小さな違和感を拾いすぎる
3. 次が決まらないと不安が増える

**可変2タイトル（6候補から選択）:**
A) 自分を責めすぎる / B) 相手の本心を推理しすぎる / C) 安心確認が止まらない
D) 距離の詰め方が加速しやすい / E) 失点を一発で取り返そうとする / F) 不安を頭の中で反芻し続ける

### 5.5 キャラクター仕様（恋愛仙人）

- **一人称**: わし
- **ユーザー呼称**: お主 / ニックネーム
- **語尾**: 〜じゃ / 〜じゃな / 〜ぞ / 〜のう / 〜かもしれん
- **禁止**: 敬語、ビジネス口調、メタ用語（セクション、フェーズ等）
- **文体**: 中学生でも分かる日本語、専門用語・四字熟語・ファンタジー比喩は回避
- **姿勢**: 否定しない、ジャッジしない、命令しない。占い師的に断定してよい場面あり

---

## 6. データ永続化（現行の重大な制約）

すべて **ブラウザ localStorage** に保存。サーバー側 DB は一切なし。

```
koi_session_${token}      # フルペイロード（profile + history + summaryJson）
koi_summaryJson_${token}  # レポート設計図（バックアップ）
koi_profile_${token}      # プロフィール（バックアップ）
koi_history_${token}      # 会話履歴（バックアップ）
koi_token                 # 現在のセッショントークン
koi_paid_done_${token}    # 生成完了フラグ（多重生成防止）
koi_paid_retry_${token}   # リトライ回数
ga_purchase_sent_${sid}   # GA4 purchase イベント重複防止
```

**既知の問題（chat.html のペイウォール前に警告文あり）:**
- Safari ↔ Chrome 切替でデータ消失
- 端末切替（スマホ → PC）でデータ消失
- シークレット/プライベートモードで閉じるとデータ消失
- ブラウザのデータ削除でデータ消失

---

## 7. GA4 イベント設計

| イベント名 | 発火タイミング | パラメータ |
|-----------|---------------|-----------|
| `click_start_free` | LP の CTA クリック | `location: "header"/"hero"` |
| `chat_view` | chat.html 表示 | - |
| `intake_complete` | 16ステップ完了 | `step_count` |
| `free_report_begin` | 無料レポート生成開始 | - |
| `free_report_shown` | 無料レポート表示完了 | - |
| `paywall_shown` | ペイウォール表示 | - |
| `click_buy` | 購入ボタンクリック | `token_present` |
| `begin_checkout` | Stripe Checkout 遷移前 | - |
| `purchase` | 支払い完了 | `transaction_id, value: 480, currency: "JPY"` |

---

## 8. 実績データ（2025/01/17 〜 2025/02/17）

### TikTok（週次 2/9〜2/15）

| 指標 | 値 |
|------|-----|
| 動画再生数 | 283,000 |
| プロフィール閲覧 | 3,507 |
| いいね | 12,000 |
| コメント | 47 |
| シェア | 275 |
| フォロワー | 800 |
| 性別比 | 男性 63% / 女性 37% |
| 年齢層 | 18-24歳 55.6% / 25-34歳 33.7% |

### GA4 ファネル（1ヶ月間）

```
page_view / session_start    310   (100%)
 ↓ 56.8%
click_start_free             176
 ↓ 70.5%
chat_view                    124
 ↓ 82.3%
intake_complete              102
 ↓ 86.3%
free_report_begin             88
 ↓ 83.0%
free_report_shown             73
 ↓ 11.0%
purchase (¥480)                8

売上: ¥3,840 / 月
Visit → Purchase CVR: 2.6%
Free Report → Purchase CVR: 11.0%
```

### ファネル分析

- **LP → CTA クリック（56.8%）**: 最大のドロップ。LP のコピーまたはファーストビューの改善余地
- **CTA → チャット表示（70.5%）**: chat.html の読み込み完了率。許容範囲
- **チャット → インテーク完了（82.3%）**: 良好。16ステップにもかかわらず離脱が少ない
- **インテーク → レポート表示（83.0%）**: 6ターンの対話を経由しても離脱が少ない（プロダクトの強み）
- **レポート → 購入（11.0%）**: フリーミアムとしては優秀。無料レポートの「続きが見たい」設計が機能

### TikTok → Web 流入の課題

```
動画再生 283K → プロフ閲覧 3,507（1.24%）
プロフ閲覧 → Web 訪問（推定 310/月 vs 3,507×4/月 = 14,028）→ 約 2.2%
```

**ボトルネック**: TikTok → Web への誘導効率が極めて低い（1.24% × 2.2%）。

---

## 9. 開発規約・コーディングルール

### プロンプト変更時の注意

1. **キャラクター整合性**: 仙人の口調（〜じゃ/〜のう）が崩れないか必ず確認
2. **fortune_traits の固定3タイトル**: 完全一致で変更禁止（paid-summary.js）
3. **文字数レンジ**: 各章の文字数指定は有料レポートの品質に直結する
4. **Markdown 見出し禁止**: レポート内で `#` `##` を使うとフォーマット崩れ
5. **捏造禁止**: summaryJson にない事実は作らない（プロンプトに明記済み）

### API 変更時の注意

1. **Stripe の token 紐付け**: `client_reference_id` と `metadata.token` の両方に token をセット
2. **OpenAI リトライ**: 429/504 のみ指数バックオフ（800ms, 1600ms）、最大2回
3. **タイムアウト**: チャット 120秒、レポートはストリーミングで実質無制限
4. **環境変数**: OPENAI_API_KEY に不可視文字が混入する事故が過去にあった（chat.js に検査コードあり）

### フロントエンド変更時の注意

1. **iOS ズーム防止**: input/textarea は `font-size: 16px` 以上（chat.html で対応済み）
2. **localStorage 依存**: すべてのセッションデータは localStorage。サーバー保存なし
3. **GA4 イベント**: 新機能追加時は必ず `track()` でイベントを送信
4. **CSS 変数**: `--accent: #f97373` 等を使う。ハードコード禁止
5. **100dvh**: chat-card の高さは `100dvh` ベース（Safari のアドレスバー対応）

### デプロイ

- **Vercel にプッシュすると自動デプロイ**
- `api/` ディレクトリは Vercel Serverless Functions として自動認識
- 静的ファイル（HTML, assets）はそのまま配信
- 環境変数は Vercel ダッシュボードで管理

---

## 10. アプリ化戦略（React Native / Expo, iOS優先）

### 10.1 なぜアプリ化するのか

現行 Web の限界:
- **localStorage 依存**: ブラウザ/端末切替でデータ消失（paid-success.html に長大な復旧手順が必要になっている）
- **継続エンゲージメントの仕掛けがゼロ**: 再訪を促す手段がない
- **TikTok → Web の流入効率が低い**: プロフ閲覧率 1.24%、そこからの Web 訪問率 2.2%
- **買い切り ¥480 のみ**: LTV が 1 回で止まる

アプリで解決できること:
- Push 通知による再訪促進
- サーバーサイド保存によるデータ永続化
- IAP/サブスクによる LTV 最大化
- ASO（App Store Optimization）による検索流入
- ホーム画面アイコンによるブランド認知

### 10.2 推奨スタック

```
フロントエンド:  React Native + Expo
認証:           Supabase Auth（Apple Sign-In 必須 + Google）
DB:             Supabase (PostgreSQL)
レート制限:     Upstash Redis
バックエンド:   現行 Vercel Functions を継続利用
Push 通知:      Firebase Cloud Messaging (FCM) + expo-notifications
IAP:            expo-in-app-purchases
分析:           Mixpanel または Firebase Analytics
```

### 10.3 推奨課金モデル（フリーミアム + 月額サブスク + コイン併用）

```
【フリープラン】
  月3回まで相談セッション + 無料レポートのみ

【スタンダード】¥480/月 or ¥3,800/年
  月10回セッション + フルレポート + 履歴保存

【コイン制】100コイン = ¥120
  フルレポート = 50コイン / 追質問 = 20コイン/ターン

【プレミアム】¥980/月
  無制限 + 月次分析レポート + Push カスタマイズ
```

コスト試算（スタンダード ¥480/月）:
- LLM コスト: ¥168/ユーザー/月
- ストア手数料（30%）: ¥144
- 粗利: ¥168（粗利率 35%）

### 10.4 MVP スコープ

**Week 1:**
- Expo プロジェクト初期化
- Supabase Auth + users テーブル
- オンボーディング 3 画面
- プロフィール設定画面

**Week 2:**
- チャット UI 移植（ストリーミング対応）
- Vercel API 接続
- フリーレポート表示
- Apple IAP（コイン買い切り）
- TestFlight 配布

### 10.5 ストア審査の注意点

- 「占い」「予言」系の表現は全て NG
- 免責文言必須:「AIによる対話サービスです。専門家の診断を代替するものではありません」
- Apple Sign-In 必須
- 「購入を復元」ボタン必須
- WebView ラップは拒否される → ネイティブ UI 必須

---

## 11. KPI 設計（AARRR）

| ファネル | 指標 | MVP 初月目標 |
|---------|------|-------------|
| Acquisition | Store → Install | CVR 10〜20% |
| Activation | Install → オンボーディング完了 | 70% |
| Activation | オンボーディング → 初回相談完了 | 60% |
| Revenue | 初回相談 → 課金 | 5〜10% |
| Retention | D7 リテンション | 25%+ |
| Retention | M1 → M2 サブスク継続率 | 60%+ |
| Referral | シェアカード生成率 | 15% |

---

## 12. 注意事項・既知の問題

1. **sennin-icon.png が 1.3MB**: アプリ用に圧縮が必要
2. **chat.html に関数の重複定義**: `buildCommonSystem`, `buildPhaseSystem`, `buildSelfSummary`, `buildPartnerSummary`, `updateDialogSummary`, `buildUserMeta` が 2 回定義されている（後者で上書き）
3. **paid-success.html の GA4 ID がマスク済み**: `G-XXXXXXXXXX` になっている（本番では `G-PMRW6LK7YG` に要置換）
4. **Stripe SDK 不使用**: REST API 直接呼び出し。SDK 導入で保守性向上の余地あり
5. **エラーハンドリング**: 一部の catch ブロックが空（`catch {}` のパターン）
