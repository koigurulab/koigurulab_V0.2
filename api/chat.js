export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const len = Number(req.headers["content-length"] || "0");
    const MAX_BYTES = 200_000;
    if (len && len > MAX_BYTES) {
      return res.status(413).json({ error: "Payload too large" });
    }

    const rawKey = process.env.OPENAI_API_KEY;
    if (!rawKey) return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
    const apiKey = rawKey.trim();

    // ✅ messages を受け取る
    const { messages } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages is required" });
    }

    // ✅ 最低限のバリデーション
    const safeMessages = messages
      .filter(m => m && typeof m === "object")
      .map(m => ({
        role: String(m.role || "").toLowerCase(),
        content: String(m.content ?? "")
      }))
      .filter(m => ["system", "user", "assistant"].includes(m.role))
      .slice(0, 40);

    if (safeMessages.length === 0) {
      return res.status(400).json({ error: "messages is invalid" });
    }

    const MAX_TOKENS = 900;
    const TEMPERATURE = 0.7;
    const TIMEOUT_MS = 30_000;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1",
        messages: safeMessages,
        max_tokens: MAX_TOKENS,
        temperature: TEMPERATURE,
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));

    if (!openaiRes.ok) {
      const t = await openaiRes.text();
      return res.status(500).json({
        error: "OpenAI API error",
        status: openaiRes.status,
        body: t.slice(0, 2000),
      });
    }

    const data = await openaiRes.json();
    const content =
      data.choices?.[0]?.message?.content ??
      "すまぬ、仙人の声がうまく届かなかったようじゃ。";

    return res.status(200).json({ content });
  } catch (err) {
    return res.status(500).json({ error: "Unexpected server error", detail: String(err) });
  }
}
