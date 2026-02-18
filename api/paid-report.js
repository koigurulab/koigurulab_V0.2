// /api/paid-report.js
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).send("Method not allowed");

    const rawKey = process.env.OPENAI_API_KEY;
    if (!rawKey) return res.status(500).send("Missing OPENAI_API_KEY");
    const apiKey = rawKey.trim();

    // tier対応: body が { summaryJson, tier } の場合と、直接 summaryJson の場合の両方に対応
    let summaryJson = req.body || {};
    let tier = "480";
    if (summaryJson.summaryJson && typeof summaryJson.summaryJson === "object") {
      tier = String(summaryJson.tier || "480");
      summaryJson = summaryJson.summaryJson;
    }
    if (!summaryJson || typeof summaryJson !== "object") {
      return res.status(400).send("Invalid body. Expected summaryJson object.");
    }

    // クライアントが扱いやすいよう text/plain でチャンク送出
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    if (res.flushHeaders) res.flushHeaders();

   
    const SYSTEM_PROMPT = `
あなたは「恋ぐるラボ」の有料レポート執筆者です。
入力は summaryJson（章立て済みの設計図）です。

目的：
読み手が「恋愛仙人は自分の性格を理解してくれている」「自分の気持ちが言語化された」「整理できた」「次に何をすればいいか見えた」と感じる、
仙人の口調の日本語レポートを 10000〜13000文字で作ること。

絶対ルール：
- # や ## など Markdown見出しは一切使わない（②対策）。
- 見出しは必ず【】で統一し、タイトルの後ろに（ ）を付けない（③対策）。
- 「ユーザ発言:」「内部メモ」「最低3案」などの要件注釈は本文に出さない（③対策）。内容で満たす。
- summaryJsonにない事実は作らない（捏造禁止）。言い換えは可。
- 鍵括弧「」の多用禁止。引用は必要最小限。文章の自然さを優先（⑤補助）。
- 地頭がいい・思慮深い等、読み手の自尊心を自然に支える言葉を“違和感のない箇所で”1〜2回だけ入れる。
- ただの事実羅列ではなく、ユーザーの気持ちを理解している文体で寄り添いの一言を要所に必ず入れる（特に【はじめに】と｀【1】）。
- ユーザーの性格を述べるときは、占い師的な口調でほとんど断定して良い。例「お主は観察眼があって色々考えることのできる性格じゃからな。」

章立て（固定表示名）：
- タイトル（1行）
- 【はじめに】いまのお主の現在地
- 【0章】お主の恋の5つのクセ
- 【1】感情の言語化
- 【2】しんどさのトリガー
- 【3】二人の構図
- 【4】相手側の気持ちの仮説
- 【5】お主専用の自分ルール
- 【6】LINE文案ライブラリ
- 【7】今後のアクションプラン
- 【結び】仙人からの最後のひと言

文字数レンジ（①対策：合計10000〜13000に収束させる）：
- 【はじめに】900〜1200字
- 【0章】1800〜2000字
- 【1】1800〜2000字
- 【2】1200〜1500字
- 【3】1200〜1500字
- 【4】1200〜1200字
- 【5】1200〜1500字
- 【6】800〜1000字
- 【7】1200〜1600字（3案以上を本文として自然に含める）
- 【結び】300〜500字
※出力前に概算で総文字数を確認し、6000字に届かなそうなら【1】【5】【7】を優先して厚くする。

【0章】の必須文言：
- 「小さな違和感を拾いすぎる」の説明のどこかで、次の一文をそのまま1回だけ入れる：
  違和感を見逃さないのは、“精度の高い気配センサー”を持っているという証拠じゃ。
  
  ０章では上記の文言を必ず入れること。また、「地頭がいい」「分析力が高い」などの、ユーザの自尊心をくすぐるような言葉を積極的に出力すること。

fortune_traits の扱い：
- summaryJson.fortune_traits は必ず5件。各traitの title を見出しっぽく使いつつ、trait_body を肉付けして自然文にする。
- evidence は本文に「例えば〜」として溶かし込み、箇条書きの evidence: 形式では出さない。

５章のお主専用の自分ルールの書き方
 - 目的：お主の「恋のクセ（fortune_traits）」と「今の状況（summaryJson全体）」から、心が揺れにくくなる“運用ルール”を作る。
   - 出力形式：必ず「ルール」を4~5個、番号付きで提示する。
   - 各ルールは次の型で書く：
    ①ルール名（短い）→ ②守る行動（具体）→ ③守る理由（クセ/状況に紐づけ）→ ④破った時のリカバリ（1手）
  - ルールの中に必ず含めるテーマ（最低1つずつ）：
   ・連絡（返信/追撃/既読スルー時の動き）
   ・会う約束（次の予定の決め方）
   ・不安が出た時の対処（その場で判断しない等）
   ・相手への踏み込み方（確認・質問の仕方）
- 重複禁止：【7】今後のアクションプランと内容が被りすぎないよう、【5】は「日々のマイルール（運用）」に寄せる。

【7】今後のアクションプランの書き方

この章は「A案／B案／C案」の3つの進め方（運用プラン）として書く。
ToDo（3日・1週・1ヶ月）は各案の中に自然に吸収してよい。

出力はテキストのみ（JSONやコードブロックは出さない）。
`.trim();

    // tier別の追加プロンプト
    let tierAddendum = "";
    if (tier === "980") {
      tierAddendum = `

追加章（攻略レポート専用）：
上記の章立てに加え、【結び】の直前に以下の章を追加する：

- 【8】相手の心理スイッチ
  相手のMBTI・恋愛タイプ・partner_key_traitsから推測される心理スイッチ（嬉しいポイント・地雷ポイント）を解説する。
  「こう言われると心を開く」「これをやると一気に冷める」を具体的に。800〜1200字。

合計文字数を12000〜16000字に拡張する。各章を少し厚めに書いてよい。
`;
    } else if (tier === "1980") {
      tierAddendum = `

追加章（個別戦略書専用）：
上記の章立てに加え、【結び】の直前に以下の章を追加する：

- 【8】相手の心理スイッチ
  相手のMBTI・恋愛タイプ・partner_key_traitsから推測される心理スイッチ（嬉しいポイント・地雷ポイント）を具体的に解説。800〜1200字。

- 【9】リスクシナリオと回避策
  今の状況で起きうる最悪のパターンを2〜3個提示し、それぞれの回避策・リカバリ手順を書く。800〜1200字。

- 【10】仙人の総括：お主だけの攻略マップ
  全体を俯瞰した上で、この恋愛の「勝ち筋」と「撤退ライン」を明示する。500〜800字。

合計文字数を15000〜20000字に拡張する。各章を厚めに書き、具体性を最大化する。
`;
    }

    const fullSystemPrompt = SYSTEM_PROMPT + tierAddendum;

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
          { role: "system", content: fullSystemPrompt },
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
