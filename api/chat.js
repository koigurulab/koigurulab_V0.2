// api/chat.js

export default async function handler(req, res) {
  // 1) メソッドチェック
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;

  // 2) APIキー未設定
  if (!apiKey) {
    res.status(500).json({ error: "Missing OPENAI_API_KEY" });
    return;
  }

  // 3) APIキーに非ASCII文字が混ざっていないかチェック
  const badPositions = [];
  for (let i = 0; i < apiKey.length; i++) {
    const code = apiKey.charCodeAt(i);
    if (code > 127) {
      badPositions.push({ index: i, code });
    }
  }
  if (badPositions.length > 0) {
    // ここで一度止める：ByteString エラーの元凶を可視化
    res.status(500).json({
      error: "OPENAI_API_KEY has non-ASCII characters",
      badPositions,
      length: apiKey.length,
    });
    return;
  }

  // 4) リクエストボディ検証
  const body = req.body || {};
  const messages = body.messages;
  if (!Array.isArray(messages)) {
    res
      .status(400)
      .json({ error: "Invalid body", detail: "messages must be an array" });
    return;
  }

  try {
    // 5) OpenAI を fetch で直叩き
    const openaiRes = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4.1-mini", // 必要ならここは別モデルに変更
          messages,
        }),
      }
    );

    const data = await openaiRes.json();

    if (!openaiRes.ok) {
      // OpenAI 側のエラーをそのままラップして返す
      res.status(500).json({
        error: "OpenAI API error",
        status: openaiRes.status,
        detail: data,
      });
      return;
    }

    const content = data.choices?.[0]?.message?.content ?? "";
    res.status(200).json({ content });
  } catch (err) {
    // 予期せぬサーバエラー
    res.status(500).json({
      error: "Server error while calling OpenAI",
      detail: String(err),
    });
  }
}
