// api/chat.js
import OpenAI from "openai";

// ここではまだ apiKey の中身は検証しない（作るだけ）
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  // POST 以外は拒否
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY || "";

  // 1) そもそも設定されてない
  if (!apiKey) {
    console.error("OPENAI_API_KEY is not set");
    res.status(500).json({ error: "Missing OPENAI_API_KEY" });
    return;
  }

  // 2) ASCII 以外の文字が混ざっていないかチェック
  //    OpenAI のキーは英数字と記号だけなので、
  //    1 文字でも全角や日本語が入っていたら NG とする
  const asciiOnly = /^[\x20-\x7E]+$/.test(apiKey);
  if (!asciiOnly) {
    console.error("OPENAI_API_KEY contains non-ASCII characters");
    res.status(500).json({
      error: "Invalid OPENAI_API_KEY",
      detail:
        "APIキーに全角文字や日本語が混ざっています。OpenAIのダッシュボードからコピペし直してください。",
    });
    return;
  }

  // --- ここから通常処理 ---
  try {
    const body = req.body || {};
    const messages = body.messages;

    if (!Array.isArray(messages)) {
      res.status(400).json({ error: "Invalid body: messages must be an array." });
      return;
    }

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages,
    });

    const content =
      completion.choices?.[0]?.message?.content ?? "";

    res.status(200).json({ content });
  } catch (err) {
    console.error("OpenAI call failed:", err);
    res.status(500).json({
      error: "Server error while calling OpenAI",
      detail: err.message ?? String(err),
    });
  }
}
