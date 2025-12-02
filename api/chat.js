// api/chat.js
export default async function handler(req, res) {
  // POST 以外は拒否
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY || "";

  // 1) APIキー未設定
  if (!apiKey) {
    console.error("OPENAI_API_KEY is not set");
    res.status(500).json({ error: "Missing OPENAI_API_KEY" });
    return;
  }

  // 2) APIキーに全角などが混ざっていないか（簡易チェック）
  const asciiOnly = /^[\x20-\x7E]+$/.test(apiKey);
  if (!asciiOnly) {
    console.error("OPENAI_API_KEY contains non-ASCII characters");
    res.status(500).json({
      error: "Invalid OPENAI_API_KEY",
      detail:
        "APIキーに全角文字や改行などが混ざっています。OpenAIダッシュボードから半角英数字だけをコピペし直してください。",
    });
    return;
  }

  try {
    const body = req.body || {};
    const messages = body.messages;

    if (!Array.isArray(messages)) {
      res.status(400).json({
        error: "Invalid body",
        detail: "messages must be an array.",
      });
      return;
    }

    // OpenAI に直接 fetch する
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        messages,
      }),
    });

    const data = await openaiRes.json();

    if (!openaiRes.ok) {
      console.error("OpenAI API error:", data);
      res.status(500).json({
        error: "OpenAI API error",
        detail: data,
      });
      return;
    }

    const content = data.choices?.[0]?.message?.content ?? "";
    res.status(200).json({ content });
  } catch (err) {
    console.error("Handler error:", err);
    res.status(500).json({
      error: "Server error while calling OpenAI",
      detail: String(err),
    });
  }
}
