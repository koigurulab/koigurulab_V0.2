// api/chat.js

export default async function handler(req, res) {
  // POST 以外は拒否
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // フロントから送られてきた messages を取得
    const { messages } = req.body || {};
    if (!Array.isArray(messages)) {
      return res.status(400).json({ error: "messages is required and must be an array" });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error("OPENAI_API_KEY is not set");
      return res.status(500).json({ error: "OPENAI_API_KEY is not set" });
    }

    // OpenAI Chat Completions を素の fetch で呼ぶ
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",   // ここは使いたいモデルに合わせて変更可
        messages,
        temperature: 0.7,
      }),
    });

    const data = await openaiRes.json();

    // エラー時は内容をそのまま返しておく（デバッグ用）
    if (!openaiRes.ok) {
      console.error("OpenAI API error:", openaiRes.status, data);
      return res.status(500).json({
        error: "OpenAI API error",
        detail: data,
      });
    }

    const content =
      (data.choices &&
        data.choices[0] &&
        data.choices[0].message &&
        data.choices[0].message.content) ||
      "";

    return res.status(200).json({ content });
  } catch (err) {
    console.error("Unexpected error in /api/chat:", err);
    return res.status(500).json({
      error: "Server error while calling OpenAI (wrapper)",
      detail: String(err && err.message ? err.message : err),
    });
  }
}
