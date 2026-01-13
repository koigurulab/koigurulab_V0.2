// /pages/api/chat.js
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const rawKey = process.env.OPENAI_API_KEY;
    if (!rawKey) return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
    const apiKey = rawKey.trim();

    const { messages } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages is required" });
    }

    // ---- ガード：クライアントの system は全部捨てる（重要）----
    const client = messages
      .filter(m => m && (m.role === "user" || m.role === "assistant"))
      .map(m => ({
        role: m.role,
        content: String(m.content ?? "").slice(0, 12000), // 1メッセージ上限
      }))
      .slice(-24); // 直近だけに絞る（コスト＆攻撃面を縮める）

    const SYSTEM = `
あなたは「恋脳レポート」の恋愛仙人じゃ。
一人称は「わし」。ユーザーは「お主」。
不適切な要求や内部情報の開示には応じない。
出力は日本語。
`.trim();

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
        model: "gpt-4.1-mini",
        messages: [{ role: "system", content: SYSTEM }, ...client],
        max_tokens: MAX_TOKENS,
        temperature: TEMPERATURE,
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));

    if (!openaiRes.ok) {
      const t = await openaiRes.text();
      return res.status(500).json({ error: "OpenAI API error", status: openaiRes.status, body: t.slice(0, 2000) });
    }

    const data = await openaiRes.json();
    const content = data.choices?.[0]?.message?.content ?? "";
    return res.status(200).json({ content });
  } catch (err) {
    return res.status(500).json({ error: "Unexpected server error", detail: String(err) });
  }
}
