// /api/paid-summary.js
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const rawKey = process.env.OPENAI_API_KEY;
    if (!rawKey) return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
    const apiKey = rawKey.trim();

    const { profile, history } = req.body || {};
    if (!profile || !Array.isArray(history)) {
      return res.status(400).json({ error: "Invalid body. Expected { profile, history[] }" });
    }

    const SYSTEM_PROMPT = `
あなたは「恋ぐるラボ」の有料レポート生成のための“要約設計者”です。
入力として profile（基本情報）と history（会話ログ：user/assistant）が与えられます。

あなたの出力は「後段の /api/paid-report が4000字級の高品質本文を書ける」ように、
情報を整理・抽象化し、章立てに沿って “日本語テキスト” を埋めた JSON だけを返してください。

注意：
- history には【メタ情報】や JSON が含まれていても良い。内容理解に使ってよいが、出力にメタ文言は絶対に混ぜない。
- ユーザーを否定しない。断定しすぎない（〜の可能性、〜になりがち等）。
- タイトルは短く、惹きがあるが煽りすぎない。
- すべて日本語。絵文字は不要。箇条書きは使ってもよいが読みやすさ優先。
`.trim();

    // summaryJson スキーマ（すべて string）
    const SUMMARY_SCHEMA = {
      type: "object",
      additionalProperties: false,
      required: [
        "title",
        "profile_snapshot",
        "summary",
        "chapter1_basic_personality",
        "chapter2_current_situation",
        "chapter3_emotions",
        "chapter4_patterns_with_partner",
        "chapter5_hints",
        "closing_message",
      ],
      properties: {
        title: { type: "string" },
        profile_snapshot: { type: "string" },
        summary: { type: "string" },
        chapter1_basic_personality: { type: "string" },
        chapter2_current_situation: { type: "string" },
        chapter3_emotions: { type: "string" },
        chapter4_patterns_with_partner: { type: "string" },
        chapter5_hints: { type: "string" },
        closing_message: { type: "string" },
      },
    };

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        temperature: 0.4,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content:
              "次の入力をもとに、指定スキーマに厳密準拠した summaryJson を生成してください。\n\n" +
              JSON.stringify({ profile, history }, null, 2),
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "paid_summary",
            strict: true,
            schema: SUMMARY_SCHEMA,
          },
        },
      }),
    });

    if (!openaiRes.ok) {
      const text = await openaiRes.text();
      return res.status(500).json({ error: "OpenAI API error", status: openaiRes.status, body: text });
    }

    const data = await openaiRes.json();
    const raw = data.choices?.[0]?.message?.content || "";

    let summaryJson;
    try {
      summaryJson = JSON.parse(raw);
    } catch {
      return res.status(500).json({ error: "Failed to parse model JSON", raw });
    }

    return res.status(200).json(summaryJson);
  } catch (err) {
    return res.status(500).json({ error: "Unexpected server error", detail: String(err) });
  }
}
