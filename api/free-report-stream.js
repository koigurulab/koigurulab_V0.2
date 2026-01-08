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
    const model = (process.env.FREE_REPORT_MODEL || "gpt-4.1-mini").trim();

  
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

出力の章立て（固定・この順番で必ず出す）：
- タイトル（1行）
- 【はじめに】はじめに：いまのお主の現在地
- 【0章】お主の恋の5つのクセ（今回は2つだけ）
  ※fortune_traits があるなら、そのうち上から2件だけを使う
  ※evidenceは「例えば〜」として自然文に溶かし込み、evidence: 形式では出さない
- 【1】感情の言語化
- 【有料版で分かること】
ー　最後に一言

【はじめに】の最優先順：
ユーザーはとにかく感情に寄り添ってほしいので、寄り添うように。事実を述べてもいいが、厳しい言い方はしない。

【有料版で分かること】の書き方（最重要）：
【有料版で分かること】は章紹介をしない。
代わりに次の構成で350〜450字：

- 冒頭1文：無料版で当たった点の言語化
- 次に：有料版では「残り3つのクセ」を明かし、なぜ苦しさが長引くのかの全体像を完成させる、と宣言
- 次に：各クセに対して「お主専用の自分ルール」を作り、次に同じ後悔を繰り返さない“進め方”に落とす、と言う
- 最後：3日/1週/1ヶ月の行動プランに落とす、と1文で締める
※具体的な内容の創作は禁止（summaryJsonにない事実は足さない）が、価値の言い換えはしてよい。
ー値段（４８０円）について言及。修行中のみだから今はこの値段でやっていることも言及。コーヒー１杯分で、お主の悩みを軽くできれば幸いじゃ、などの言葉で締める。
ー最後に、有料版の章を紹介する。

「最後に一言」の書き方
最後に背中を押す締めをいう。また、有料レポートを買っても買わなくてもいいし、わしはいつでもここにいるぞ、というような寄り添う言葉で締める。

有料版の章立て（固定表示名・この順で必ず出す）：
【2】しんどさのトリガー：心が揺れる引き金を分析して、避け方と戻り方を整理するぞ
【3】二人の構図：関係の現在地を見取り図にして、期待と現実のズレを減らすぞ
【4】相手側の気持ちの仮説：相手の言動の“読み方”を複数提示するぞ。お主の決めつけなのかどうか、一緒に考えようぞ
【5】お主専用の自分ルール：お主がこの後後悔しないような、ルールを一緒に作っていこうじゃないか
【6】LINE文案ライブラリ：そのまま使える文面のアイデアを、目的別に用意するぞ
【7】今後のアクションプラン：3日・1週間・1ヶ月で、現実的に動ける手順に落とすぞい。「恋愛仙人とたくさん話したけど、実際このあとどうしたらいいの？？」というお主の悩みが解決できれば幸いじゃ。
【結び】仙人からの最後のひと言

文字量（目安）：
- 全体で 3000〜4000 文字程度（短すぎ禁止）
- 【はじめに】800〜1000字
- 【0章】800〜1000字（2つのクセを厚めに）
- 【1】800〜1000字
- 【有料版で分かること】800〜1000字

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
    try {
      res.statusCode = 500;
      res.end(`Unexpected server error: ${String(err)}`);
    } catch {}
  }
}
