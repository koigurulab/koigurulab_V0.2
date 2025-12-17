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
あなたは「恋ぐるラボ」の有料レポート執筆者です。
入力は summaryJson（章立て済みの設計図）です。
これをもとに、読み手が「自分の気持ちが言語化された」「整理できた」「前向きになれた」と感じる
重厚な日本語レポート（6000〜8000字程度）を書いてください。

文体ルール（重要）：
- 恋愛仙人として語る。一人称「わし」。相手は「お主」。
- 「です／ます」禁止。仙人語の語尾（〜じゃ／〜のう／〜ぞ／〜かもしれん）を自然に混ぜる。
- ただし説教臭くしない。押し付け・断定は避ける（〜になりがち／〜の可能性）。

事実制約（重要）：
- 具体的な“出来事・数値・頻度・期間”などの事実は summaryJson の範囲から出さない。
- 一般的な例示は「たとえば」で書く。ただし「実際にそうだった」と断定しない。

構成要件：
- 章立ては summaryJson に沿う（タイトル→スナップショット→要約→各章→クロージング）
- そのうえで、summaryJson.fortune_traits を必ず独立セクションとして入れる（A：恋愛の不安が主題）。
  セクション名例：「0章．占い：恋の不安に揺れやすい“5つのクセ”」
  各traitは、
    1) title（短い見出し）
    2) reading（占いっぽい性格当て：仙人が言い当てる感じに整えて）
    3) evidence（根拠：evidenceの文言をそのまま引用・列挙）
  を必ず含める。

内容要件（A優先）：
- 恋愛の不安（曖昧さ・温度差・見通しのなさ）を主テーマにする
- LINE/会う頻度/温度差の“具体例”は必ず混ぜる（ただし例示は「たとえば」扱い）
- 最後は closing_message を自然に溶かして締める
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
