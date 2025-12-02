// api/chat.js

export default async function handler(req, res) {
  // POST 以外は拒否
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  // リクエストボディを読み取り
  let rawBody = "";
  for await (const chunk of req) {
    rawBody += chunk;
  }

  let messages;
  try {
    const parsed = JSON.parse(rawBody || "{}");
    messages = parsed.messages;
    if (!Array.isArray(messages)) {
      throw new Error("messages must be an array");
    }
  } catch (e) {
    console.error("Invalid JSON:", e);
    res.status(400).json({ error: "Invalid JSON" });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("OPENAI_API_KEY is not set");
    res.status(500).json({ error: "Missing OPENAI_API_KEY" });
    return;
  }

  try {
    // OpenAI REST を生で叩く
    const payload = {
      model: "gpt-4.1-mini", // or gpt-4.1 / gpt-4.1-mini など
      messages,
      max_tokens: 800,
      temperature: 0.8,
    };

    const oaRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const text = await oaRes.text();

    if (!oaRes.ok) {
      console.error("OpenAI API error:", oaRes.status, text);
      res.status(500).json({
        error: "Server error while calling OpenAI",
        detail: text,
      });
      return;
    }

    const data = JSON.parse(text);
    const content =
      data.choices?.[0]?.message?.content != null
        ? data.choices[0].message.content
        : "";

    res.status(200).json({ content });
  } catch (err) {
    console.error("Unexpected server error:", err);
    res.status(500).json({
      error: "Unexpected server error",
      detail: String(err),
    });
  }
}
