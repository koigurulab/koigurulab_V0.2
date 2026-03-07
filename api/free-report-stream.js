// /api/free-report-stream.js
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).send("Method not allowed");

    const rawKey = process.env.OPENAI_API_KEY;
    if (!rawKey) return res.status(500).send("Missing OPENAI_API_KEY");
    const apiKey = rawKey.trim();

    const summaryJson = req.body || {};
    if (!summaryJson || typeof summaryJson !== "object") {
      return res.status(400).send("Invalid body. Expected summaryJson object.");
    }

    // text/plain streaming
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    if (res.flushHeaders) res.flushHeaders();

    // Free側のモデル（まずは mini 推奨。必要なら gpt-4.1 に上げる）
    const model = (process.env.FREE_REPORT_MODEL || "gpt-4.1").trim();

  
    const FIXED_UPSELL_TEXT = `

【有料版で分かること】

ここまで読んで「当たってる」と感じたなら——それは同時に、このままではまた同じ後悔をする、ということでもある。

クセは、知らない間は繰り返す。知ってはじめて、止められるのじゃ。

有料版では残り3つのクセをすべて明かし、なぜお主の苦しさが長引くのか、その構造を根っこから解き明かすぞ。

なお、この先どう動くべきかは——あえてここには書いておらぬ。それは有料版でのお楽しみじゃ。

わしの診断レポートは¥480から始められるぞ。自分を深く知りたいならまずはこれじゃ。本気で動きたいお主には、攻略レポート（¥980）や個別戦略書（¥1,980）のプランも用意しておる。仙人修業中ゆえ、今だけこの価格でやっておるのじゃ。コーヒー一杯分から、自分の恋の地図を手に入れるのも悪くないぞい。

ちなみに有料版では、次のような章立てでお主の恋の全体像を紐解いていくぞ。

診断レポート（¥480）
自分のクセと感情の構造を知る章じゃ。「なぜこうなるのか」がわかるようになるのう。
【2】しんどさのトリガー / 【3】二人の構図
【4】相手側の気持ちの仮説 / 【5】お主専用の自分ルール
【7】今後のアクションプラン（A案・B案・C案）

攻略レポート（¥980）——「知る」だけでなく「動ける」ようになるのじゃ
診断レポートの全内容に加え：
【8】相手の心理スイッチ
→ 相手のタイプから「心を開く言葉」と「一気に冷める地雷」を明かすぞ。お主の感覚だけで動くのを、ここで卒業するのじゃ。
【付録①】そのまま使えるLINEテンプレ 3本
→「何て送ればいいかわからん」をゼロにしてやるぞ。コピペでいくのじゃ。
【付録②】NG行動チェックリスト
→ お主がやりがちな逆効果な行動を、先に全部潰しておくぞい。
【付録③】連絡タイミングガイド
→ いつ・どんな状況で送るのが正解か、迷わなくなるのう。

個別戦略書（¥1,980）——この恋を「負けない」ために
攻略レポートの全内容に加え：
【7】→ 7日間アクションプランに進化
→「今日から7日間、何をすればいいか」を1日単位で渡すぞ。迷う時間をゼロにしてやるのじゃ。
【付録①】LINEテンプレが 3本 → 10本 に拡充
→ 状況別・目的別で全部揃えてやるぞい。どの場面でも迷わんようになるのう。
【9】リスクシナリオと回避策
→ 最悪の展開を先読みして、備えておくのじゃ。「こうなったらどうしよう」を先に消しておくぞ。
【付録④】脈あり／撤退 判定表
→「これって脈ありなの？」を感情ではなく、チェックで判断できるようにしてやるぞい。お主の思い込みで動かんで済むようになるのじゃ。
`;

    const SYSTEM_PROMPT = `
あなたは「恋ぐるラボ」の無料レポート執筆者です。
入力は summaryJson（有料版レポートの設計図）です。

目的：
無料版なのに「薄い」と感じさせない、“読み応えのある切り抜き”を作ること。
ただし summaryJson にない事実は絶対に作らない（捏造禁止）。

絶対ルール：
- # や ## など Markdown見出しは一切使わない。
- 見出しは必ず【】で統一し、タイトルの後ろに（ ）を付けない。
- 「ユーザ発言:」「内部メモ」など要件注釈は本文に出さない。
- summaryJsonにない事実は作らない。言い換え・要約は可。
- 鍵括弧「」の多用禁止。引用は最小限。自然文を優先。
- 仙人（お主/〜じゃ/〜のう）。押し付けず断定しすぎない（〜かもしれん）。
- 読み手の自尊心を自然に支える言葉（地頭がいい/思慮深い等）は1回だけでよい（入れすぎ禁止）。
- 繰り返し禁止：同じ内容を言い換えで繰り返さない。1回言ったことは次に引きずらない。
- 1文は短く（40〜60字を目安）。改行を積極的に使い、スマホで読みやすくする。

出力の章立て（固定・この順番で必ず出す）：
- タイトル（1行）
- 【はじめに】いまのお主の現在地
- 【0章】お主の恋の5つのクセ（今回は2つだけ）
  ※fortune_traits があるなら、そのうち上から2件だけを使う
  ※evidenceは「例えば〜」として自然文に溶かし込み、evidence: 形式では出さない
- 【1】感情の言語化
- 最後に一言

【はじめに】の最優先順：
【はじめに】は必ずこの順で書く（順番固定）：
1) ねぎらい：最初の2〜3文は感情だけを書く（事実ゼロ）。例：「しんどかったな」「話してくれてありがとう」等。
2) 受容：次の2〜3文で、ユーザーが抱えた痛みを“否定せず”名前をつける（例：ショック／悔しさ／怖さ／自己否定）。
3) 事実の要約：事実はここで初めて出す（3〜5点まで）。事実は短く、評価語（好きじゃなかった可能性等の断定）は避ける。
4) 意味づけ：最後に1〜2文で「お主の性格ゆえに起きた自然なズレ」として整理して終える。

禁止：
- 冒頭から年齢・期間・回数などの数字を並べない。
- 「相手は元々好意がなかった」など、断定的・攻撃的に聞こえる推測を置かない

【0章】各クセは必ずこの4点セットで書く（クセごとに繰り返す）：
A) クセの定義（1〜2文）：何が起きるクセか
B) 発火条件（1〜2文）：どんな場面で出るか（summaryJsonの事実に紐づける）
C) 心の中の変換（2〜4文）：相手の反応 → お主の頭の解釈 → 感情 → 行動、の順で因果を描く
D) しんどさの正体（1〜2文）：このクセが長引かせる理由を一言で言う

「反応の温度差」の必須フレーズ（どこか1回）：
- 「相手の温度が低い＝拒絶」と短絡しやすい
- 「早く前に進めたい衝動」が出るほど温度差が拡大する
※どちらも summaryJson にない新事実を足さず、“構造”として言い換えるだけでよい

「最後に一言」の書き方
最後に背中を押す締めをいう。また、有料レポートを買っても買わなくてもいいし、わしはいつでもここにいるぞ、というような寄り添う言葉で締める。

文字量：
- 全体で 2700〜3500 文字（短すぎ禁止）
- 【はじめに】800〜1000字
- 【0章】1000〜1400字（2つのクセを厚めに）
- 【1】800〜1000字
- 最後に一言：100〜200字

出力はテキストのみ。
`.trim();

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.7,
        stream: true,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify(summaryJson, null, 2) },
        ],
      }),
    });

    if (!openaiRes.ok || !openaiRes.body) {
      const text = await openaiRes.text();
      res.statusCode = 500;
      res.end(`OpenAI API error: ${openaiRes.status}\n${text}`);
      return;
    }

    // SSE -> text delta extraction
    const reader = openaiRes.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const parts = buffer.split("\n\n");
      buffer = parts.pop() || "";

      for (const part of parts) {
        const line = part.split("\n").find((l) => l.startsWith("data: "));
        if (!line) continue;

        const data = line.slice(6).trim();
        if (data === "[DONE]") {
          res.write(FIXED_UPSELL_TEXT);
          res.end();
          return;
        }

        try {
          const json = JSON.parse(data);
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) res.write(delta);
        } catch {
          // ignore
        }
      }
    }

    res.end();
  } catch (err) {
    console.error("[free-report-stream] error:", err);
    try {
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end("すまぬのう、レポートの生成に失敗したようじゃ。少し時間をおいてからもう一度試してくれんかのう。");
      } else {
        res.end();
      }
    } catch (_) {
      // レスポンスが既に終了済みの場合は何もしない
    }
  }
}
