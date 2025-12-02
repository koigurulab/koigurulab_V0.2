// api/chat.js
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "OPENAI_API_KEY is not set" });
    return;
  }

  try {
    const { messages } = req.body || {};
    if (!messages || !Array.isArray(messages)) {
      res.status(400).json({ error: "messages is required" });
      return;
    }

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // コスト抑えたいなら mini 推奨
        messages,
        temperature: 0.85,
        presence_penalty: 0.1,
      }),
    });

    const data = await openaiRes.json();

    if (!openaiRes.ok) {
      console.error("OpenAI error:", data);
      res.status(500).json({ error: "OpenAI request failed" });
      return;
    }

    const content = data.choices?.[0]?.message?.content || "";
    res.status(200).json({ content });
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ error: "Server error" });
  }
}
