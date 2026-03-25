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
- 【有料版で分かること】
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

【有料版で分かること】の書き方（最重要・350〜450字）：
1) 冒頭2文：fortune_traits[0]・fortune_traits[1]のタイトルを名指しで振り返り「この2つ、当たっていたかのう」で感情フックを置く
2) 次2〜3文：残り3つのクセ（fortune_traits[2]・fortune_traits[3]・fortune_traits[4]のタイトルをそのまま使う）を全て名指しで宣言する。内容の創作・言い換え禁止。タイトルをそのまま使うこと
3) 次1〜2文：5つが揃ってはじめて「なぜお主の苦しさが長引くのか」の全体像が見える、と言う
4) 最後2〜3文：3つのプランを仙人口調で自然に紹介する。「診断レポート（¥480）」「攻略レポート（¥980）」「個別戦略書（¥1,980）」の名称を使い、押し付けず選択肢として提示する。仙人修業中ゆえ今だけこの価格、コーヒー一杯分から始められる旨を添える
※章紹介（何章に何が書いてあるか）は不要。価値の言い換えのみ

「最後に一言」の書き方
最後に背中を押す締めをいう。また、有料レポートを買っても買わなくてもいいし、わしはいつでもここにいるぞ、というような寄り添う言葉で締める。

文字量：
- 全体で 3000〜4000 文字（短すぎ禁止）
- 【はじめに】800〜1000字
- 【0章】1000〜1400字（2つのクセを厚めに）
- 【1】800〜1000字
- 【有料版で分かること】350〜450字
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
