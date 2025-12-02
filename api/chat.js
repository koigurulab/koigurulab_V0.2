// /api/chat.js

export default async function handler(req, res) {
  // 1) メソッドチェック
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  // 2) ボディチェック
  const { messages } = req.body || {};
  if (!messages) {
    res.status(400).json({ error: "messages is required in body" });
    return;
  }

  // 3) APIキーチェック（Vercel の環境変数を使う）
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "OPENAI_API_KEY is not set on server" });
    return;
  }

  try {
    // 4) OpenAI API 叩く
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",           // ここは好きなモデル名に変えてOK（例: gpt-4o-mini）
        messages,
      }),
    });

    const text = await openaiRes.text();

    // OpenAI 側のエラーは中身ごと返す
    if (!openaiRes.ok) {
      res.status(500).json({
        error: "OpenAI API error",
        status: openaiRes.status,
        body: text,
      });
      return;
    }

    const data = JSON.parse(text);
    const content = data?.choices?.[0]?.message?.content ?? "";

    res.status(200).json({ content });
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({
      error: "Server error while calling OpenAI",
      detail: err.message || String(err),
    });
  }
}
