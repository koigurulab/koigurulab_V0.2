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

    // クライアントが扱いやすいよう text/plain でチャンク送出
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    if (res.flushHeaders) res.flushHeaders();

    const SYSTEM_PROMPT = `
あなたは「恋ぐるラボ」の無料レポート執筆者（恋愛仙人）です。
入力は summaryJson（章立て済みの設計図）です。

目的：
読み手が「自分の気持ちが言語化された」「整理できた」と感じ、
有料版の価値（深掘り）を自然に理解できる、“有料版の切り取り”を 1200〜1800文字で作る。

絶対ルール（有料版と同系統）：
- # や ## など Markdown見出しは一切使わない。
- 見出しは必ず【】で統一し、タイトルの後ろに（ ）を付けない。
- 「ユーザ発言:」「内部メモ」などの要件注釈は本文に出さない。
- summaryJsonにない事実は作らない（捏造禁止）。言い換えは可。
- 鍵括弧「」の多用禁止。引用は最小限。
- 文体は仙人（お主/〜じゃ/〜のう）。押し付けず、断定しすぎない（〜かもしれん）。

章立て（固定表示名・無料版）：
- タイトル（1行）
- 【はじめに】いまのお主の現在地（250〜350字）
- 【切り取り1】お主の恋のクセ（fortune_traits から 2件だけ。各200〜260字）
- 【切り取り2】二人の構図（220〜320字）
- 【切り取り3】次の一手（命令は禁止。選べる方向性として2案。260〜420字）
- 【有料版で分かること】（150〜250字：深掘り観点を3つ、説明として提示）
- 【結び】（120〜200字）

fortune_traits の扱い：
- summaryJson.fortune_traits は5件ある前提だが、無料版では2件だけ採用する。
- title は見出しっぽく溶かし込み、trait_body を肉付けして自然文にする。
- evidence は「例えば〜」として溶かし込み、evidence: の箇条書き形式は出さない。

出力前に概算で総文字数を確認し、1200字に届かなければ
【切り取り1】と【切り取り3】を優先して厚くする。

出力はテキストのみ（JSONやコードブロックは出さない）。
`.trim();

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini", // 無料はコスト優先。品質優先なら gpt-4.1
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

    // SSE -> テキスト抽出（paid-report.js と同型）
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
        // data: 行が複数来ることもあるので全行見る
        const lines = part.split("\n").filter((l) => l.startsWith("data: "));
        for (const line of lines) {
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
            // 解析失敗は無視
          }
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
