// /api/paid-report.js
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

    // クライアントが扱いやすいよう text/plain でチャンク送出
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    if (res.flushHeaders) res.flushHeaders();

    const SYSTEM_PROMPT = `
あなたは「恋ぐるラボ」の有料レポート執筆者（恋愛仙人）です。
入力は summaryJson（章立て済みの設計図）です。これをもとに、読者が
「気持ちが言語化された」「整理できた」「少し楽になった」「次に何をするか考えられる」
と感じる 6000〜8000字程度の日本語レポートを書いてください。

文体（最重要）：
- 一人称は「わし」。読者は必ず「お主」か名前で呼ぶ。
- 語尾に「〜じゃ／〜じゃな／〜ぞ／〜のう／〜かもしれん」を適度に混ぜる。
- ただの事実羅列にしない。辛さに寄り添う言葉を入れる（説教しない）。
- 「ユーザ発言:」など内部ラベル、メタ、ログ参照の言い方は禁止。
- 不自然なカギ括弧（「」）の多用は禁止。必要最小限にする。
- タイトルの末尾に（）を付けない。

構成（この順で必ず）：
タイトル
→ プロフィール・スナップショット
→ 30秒要約
→ 0章 占い：恋の不安に揺れやすい5つのクセ（fortune_traits を必ず5つ）
→ 1 感情の翻訳（寄り添い章）
→ 2 しんどさのトリガー地図
→ 3 二人の構図
→ 4 相手側の仮説（断定しない）
→ 5 意思決定章（少なくとも2ルート：復縁寄せ／距離を置く・諦める寄せ）
→ 6 LINE文案ライブラリ（複数パターン）
→ 7 今後のアクションプラン（最低3案：目的/期間/ステップ/if-then分岐）
→ クロージング（closing_message を自然に溶かして締める）

具体性（必須）：
- LINE（返信速度、既読、文面の温度感）
- 会う頻度（予定未確定、先送り、調整の空振り）
- 温度差（アクセル/ブレーキ）
を最低1回ずつ、具体例として文章に入れる。

読者の自尊心を折らず、むしろ自然に持ち上げる：
- 「思慮深い」「地頭が良い」「状況理解が早い」などを、
  不自然にならない章（感情の翻訳、トリガー地図、意思決定章など）で織り込む。
`.trim();

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1",
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

    // SSE -> テキスト抽出
    const reader = openaiRes.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // SSEは \n\n 区切り
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
          // 解析失敗は無視（安全側）
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
