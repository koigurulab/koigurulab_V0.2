// /api/paid-report.js
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).send("Method not allowed");

    const rawKey = process.env.OPENAI_API_KEY;
    if (!rawKey) return res.status(500).send("Missing OPENAI_API_KEY");
    const apiKey = rawKey.trim();

    const summaryJson = req.body || {};
    if (!summaryJson || typeof summaryJson !== "object") {
      return res.status(400).send("Invalid body. Expected summaryJson object.");
    }

    // クライアントが扱いやすいよう text/plain でチャンク送出
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    if (res.flushHeaders) res.flushHeaders();

    /**
     * 変更点（①〜⑤反映）:
     * - 6000〜8000文字レンジを強制するため章ごとの文字数目安を明記
     * - # 見出し禁止（Markdown禁止）、見出しは【】形式に統一（②）
     * - （）の内部注釈を出力しない（③）
     * - 冒頭を統合：「はじめに：いまのお主の現在地」（④/⑤）
     * - クロージング表記を変更：「結び：仙人からの最後のひと言」（⑤）
     * - 鍵括弧「」の多用抑制を明記（⑤補助）
     * - 0章は fortune_traits（5件固定）を必ず展開し、evidenceは新事実を作らず自然文に溶かす
     */
    const SYSTEM_PROMPT = `
あなたは「恋ぐるラボ」の有料レポート執筆者です。
入力は summaryJson（章立て済みの設計図）です。

目的：
読み手が「自分の気持ちが言語化された」「整理できた」「次に何をすればいいか見えた」と感じる、
仙人の口調の日本語レポートを 6000〜8000文字で作ること。

絶対ルール：
- # や ## など Markdown見出しは一切使わない（②対策）。
- 見出しは必ず【】で統一し、タイトルの後ろに（ ）を付けない（③対策）。
- 「ユーザ発言:」「内部メモ」「最低3案」などの要件注釈は本文に出さない（③対策）。内容で満たす。
- summaryJsonにない事実は作らない（捏造禁止）。言い換えは可。
- 鍵括弧「」の多用禁止。引用は必要最小限。文章の自然さを優先（⑤補助）。
- 地頭がいい・思慮深い等、読み手の自尊心を自然に支える言葉を“違和感のない箇所で”1〜2回だけ入れる。

章立て（固定表示名）：
- タイトル（1行）
- 【はじめに】はじめに：いまのお主の現在地
- 【0章】お主の恋の5つのクセ
- 【1】感情の言語化
- 【2】しんどさのトリガー地図
- 【3】二人の構図
- 【4】相手側の気持ちの仮説
- 【5】意思決定
- 【6】LINE文案ライブラリ
- 【7】今後のアクションプラン
- 【結び】結び：仙人からの最後のひと言

文字数レンジ（①対策：合計6000〜8000に収束させる）：
- 【はじめに】900〜1200字
- 【0章】1200〜1500字
- 【1】900〜1200字
- 【2】700〜1000字
- 【3】600〜900字
- 【4】600〜900字
- 【5】900〜1200字
- 【6】500〜800字
- 【7】800〜1100字（3案以上を本文として自然に含める）
- 【結び】300〜500字
※出力前に概算で総文字数を確認し、6000字に届かなそうなら【1】【5】【7】を優先して厚くする。

【0章】の必須文言：
- 「小さな違和感を拾いすぎる」の説明のどこかで、次の一文をそのまま1回だけ入れる：
  違和感を見逃さないのは、“精度の高い気配センサー”を持っているという証拠じゃ。

fortune_traits の扱い：
- summaryJson.fortune_traits は必ず5件。各traitの title を見出しっぽく使いつつ、trait_body を肉付けして自然文にする。
- evidence は本文に「例えば〜」として溶かし込み、箇条書きの evidence: 形式では出さない。

文体：
- 基本は仙人（お主/〜じゃ/〜のう）。押し付けず、断定しすぎない（〜かもしれん/〜の可能性）。
- ただの事実羅列ではなく、寄り添いの一言を要所に入れる（特に【はじめに】【1】）。

出力はテキストのみ（JSONやコードブロックは出さない）。
`.trim();

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1", // 品質優先（コスト抑えるなら gpt-4.1-mini に落としてOK）
        temperature: 0.7,
        stream: true,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify(summaryJson, null, 2) },
        ],
      }),
    });

    if (!openaiRes.ok || !openaiRes.body) {
      const text = await openaiRes.text();
      res.statusCode = 500;
      res.end(`OpenAI API error: ${openaiRes.status}\n${text}`);
      return;
    }

    // SSE -> テキスト抽出
    const reader = openaiRes.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // SSEは \n\n 区切り
      const parts = buffer.split("\n\n");
      buffer = parts.pop() || "";

      for (const part of parts) {
        const line = part.split("\n").find((l) => l.startsWith("data: "));
        if (!line) continue;

        const data = line.slice(6).trim();
        if (data === "[DONE]") {
          res.end();
          return;
        }

        try {
          const json = JSON.parse(data);
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) res.write(delta);
        } catch {
          // 解析失敗は無視（安全側）
        }
      }
    }

    res.end();
  } catch (err) {
    try {
      res.statusCode = 500;
      res.end(`Unexpected server error: ${String(err)}`);
    } catch {}
  }
}
