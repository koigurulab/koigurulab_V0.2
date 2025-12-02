// api/chat.js

export default async function handler(req, res) {
  // POST 以外は弾く
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    // フロントから送ってもらう JSON （例：{ messages: [...] }）
    const { messages } = req.body || {};

    if (!messages || !Array.isArray(messages)) {
      res.status(400).json({ error: "messages is required" });
      return;
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: "OPENAI_API_KEY is not set" });
      return;
    }

    // OpenAI API を叩く
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o", // 好きなモデルに変更可
        messages,         // フロント側の messages をそのまま投げる
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI error:", errorText);
      res.status(500).json({ error: "OpenAI API error" });
      return;
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content ?? "";

    res.status(200).json({ content: answer });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
}
