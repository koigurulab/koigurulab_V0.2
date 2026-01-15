// pages/api/chat.js

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const rawKey = process.env.OPENAI_API_KEY;
    if (!rawKey) return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
    const apiKey = rawKey.trim();

    // APIキーに変な文字が混ざっていないか検査（旧版踏襲）
    const badPositions = [];
    for (let i = 0; i < apiKey.length; i++) {
      const code = apiKey.charCodeAt(i);
      if (code < 0x20 || code > 0x7e) badPositions.push({ index: i, code });
    }
    if (badPositions.length > 0) {
      return res.status(500).json({
        error: "OPENAI_API_KEY has invalid characters",
        badPositions,
        length: apiKey.length,
      });
    }

    const { messages } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages is required" });
    }

    // --- HTML側の messages を尊重（system を捨てない）
    // role は system/user/assistant のみ許可。content は文字列化。
    const forwarded = messages
      .filter(
        (m) =>
          m &&
          (m.role === "system" || m.role === "user" || m.role === "assistant")
      )
      .map((m) => ({
        role: m.role,
        content: String(m.content ?? ""),
      }));

    if (forwarded.length === 0) {
      return res.status(400).json({ error: "valid messages are required" });
    }

    // --- 生成パラメータ（まず元品質復旧優先）
    // 0.7 は崩れやすいので、戻したいなら 0.5 推奨
    const MODEL = "gpt-4.1-mini";
    const MAX_TOKENS = 1800;
    const TEMPERATURE = 0.7;
    const TIMEOUT_MS = 120_000;

    // 軽いサイズガード（任意だが事故防止）
    // ※ まずは品質復旧が最優先なので、厳しすぎる制限はしない
    const approxChars = forwarded.reduce((sum, m) => sum + m.content.length, 0);
    if (approxChars > 120_000) {
      return res.status(413).json({
        error: "messages too large",
        detail: `approxChars=${approxChars}`,
      });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: forwarded,
        max_tokens: MAX_TOKENS,
        temperature: TEMPERATURE,
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));

    if (!openaiRes.ok) {
      const text = await openaiRes.text();
      return res.status(500).json({
        error: "OpenAI API error",
        status: openaiRes.status,
        body: text.slice(0, 2000),
      });
    }

    const data = await openaiRes.json();
    const content =
      data?.choices?.[0]?.message?.content ??
      "すまぬ、仙人の声がうまく届かなかったようじゃ。";

    return res.status(200).json({ content });
  } catch (err) {
    const msg = String(err);
    const isTimeout = msg.includes("AbortError") || msg.includes("aborted");
    return res.status(isTimeout ? 504 : 500).json({
      error: isTimeout ? "Upstream timeout" : "Unexpected server error",
      detail: msg,
    });
  }
}
