// /api/chat.js

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const rawKey = process.env.OPENAI_API_KEY;
    if (!rawKey) {
      return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
    }

    // まず前後の空白・改行を除去
    const apiKey = rawKey.trim();

    // ここで「キー文字列自体」に変な文字が混ざってないか検査する
    const badPositions = [];
    for (let i = 0; i < apiKey.length; i++) {
      const code = apiKey.charCodeAt(i);
      // 0x20〜0x7E 以外（制御文字 or 非ASCII）は全部アウトにする
      if (code < 0x20 || code > 0x7e) {
        badPositions.push({ index: i, code });
      }
    }
    if (badPositions.length > 0) {
      return res.status(500).json({
        error: "OPENAI_API_KEY has invalid characters",
        badPositions,
        length: apiKey.length,
      });
    }

    // ここまで通ったら Authorization ヘッダとしては安全
    const { messages } = req.body || {};

    const openaiRes = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4.1-mini",
          messages,
        }),
      }
    );

    if (!openaiRes.ok) {
      const text = await openaiRes.text();
      return res.status(500).json({
        error: "OpenAI API error",
        status: openaiRes.status,
        body: text,
      });
    }

    const data = await openaiRes.json();
    const content =
      data.choices?.[0]?.message?.content ??
      "すまぬ、仙人の声がうまく届かなかったようじゃ。";

    return res.status(200).json({ content });
  } catch (err) {
    return res.status(500).json({
      error: "Unexpected server error",
      detail: String(err),
    });
  }
}
