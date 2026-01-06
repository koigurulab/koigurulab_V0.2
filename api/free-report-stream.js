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

【有料版で分かること】の書き方（最重要）：
- ここは「章名の固定列挙」ではなく、“買う理由が一瞬で分かる告知”として書く。
- ただし summaryJson にない事実は作らない（捏造禁止）。具体的な登場人物・出来事の追加も禁止。
- 各章について「この章で手に入るもの（成果物）」を1つ添える。
  - 成果物は一般化された表現にする（例：トリガーの整理表／二人の構図の見取り図／意思決定の判断軸／コピペできるLINE集／3日・1週・1ヶ月の行動設計）。
  - “お主のケースでは〜”のような１例をだすとよい。ただし、完全にアドバイスをするのではなくあくまで有料版が気になるような書き方をすること。
- 文体は仙人。営業臭さは出さず、「読むと何が変わるか」を淡々と魅力的に。
- 文字数は 800〜1000字 
【有料版で分かること】の末尾に、必ず「価格と背中押しの前口上」を入れる（重要）：
- ここでの文章量は160〜240字。
- 仙人の口調（お主／〜じゃ／〜のう）を維持し、がめつさ・押し売り感は禁止。
- 価格は必ず「480円」に言及する。
- 「コーヒー１杯分で、お主の悩みが少し軽くなるなら本望じゃ。」をそのまま1回だけ必ず入れる。
- 修行中だから今はこの値段、という理由を1文で自然に添える。
- ユーザー状況に即した共感を1文だけ入れる。
  ※summaryJsonに含まれる範囲の言い換えに留め、新事実は作らない。
- 共感の直後に、ユーザー特有の有料版の価値を1〜２文添える。
- 最後は「わしはいつでもここにおる」のニュアンスで止めること。
- 最後に1行だけ、背中を押す締めを入れる：

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
