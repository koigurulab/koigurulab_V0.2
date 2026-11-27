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
- ダブルクォーテーション（“ ” や " "）で言葉を囲まない。強調したい言葉もそのまま書く。
- 一人称は「わし」。「仙人は」「仙人から見ても」のように自分を三人称で呼ばない。
- 中学生でも分かる言葉で書く。湖面・渦・旅・舵取りのような大げさな比喩や四字熟語は使わない。
- 同じ説明を章をまたいで繰り返さない。前の章で言ったことは、次の章では一言で触れるだけにする。
- 地頭がいい・思慮深い等、読み手の自尊心を自然に支える言葉を、違和感のない箇所で1〜2回だけ入れる。
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
- 【6】今後のアクションプラン
- 【結び】仙人からの最後のひと言
※章番号は【5】の次を【6】にする（番号を飛ばさない）。

各章の最低文字数（必ず守る）：
- 【はじめに】800字以上
- 【0章】1,600字以上
- 【1】1,500字以上
- 【2】1,000字以上
- 【3】900字以上
- 【4】900字以上
- 【5】1,000字以上
- 【6】1,000字以上（A案／B案／C案の3案を本文として自然に含める）
- 【結び】300字以上
※合計9,000字以上を必ず達成すること。各章が最低文字数を下回っている場合は必ず書き足すこと。

【0章】の必須文言：
- 「小さな違和感を拾いすぎる」の説明のどこかで、次の一文をそのまま1回だけ入れる：
  違和感を見逃さないのは、精度の高い気配センサーを持っているという証拠じゃ。
  
  ０章では上記の文言を必ず入れること。また、「地頭がいい」「分析力が高い」などの、ユーザの自尊心をくすぐるような言葉を積極的に出力すること。

fortune_traits の扱い：
- summaryJson.fortune_traits は必ず5件。各traitの title を見出しっぽく使いつつ、trait_body を肉付けして自然文にする。
- evidence は本文に「例えば〜」として溶かし込み、箇条書きの evidence: 形式では出さない。

５章のお主専用の自分ルールの書き方
 - 目的：お主の恋のクセ（fortune_traits）と今の状況（summaryJson全体）から、心が揺れにくくなる運用ルールを作る。
   - 出力形式：必ず「ルール」を4~5個、番号付きで提示する。
   - 各ルールは次の型で書く：
    ①ルール名（短い）→ ②守る行動（具体）→ ③守る理由（クセ/状況に紐づけ）→ ④破った時のリカバリ（1手）
  - ルールの中に必ず含めるテーマ（最低1つずつ）：
   ・連絡（返信/追撃/既読スルー時の動き）
   ・会う約束（次の予定の決め方）
   ・不安が出た時の対処（その場で判断しない等）
   ・相手への踏み込み方（確認・質問の仕方）
- 重複禁止：【6】今後のアクションプランと内容が被りすぎないよう、【5】は日々のマイルール（運用）に寄せる。

【6】今後のアクションプランの書き方

この章は「A案／B案／C案」の3つの進め方（運用プラン）として書く。
ToDo（3日・1週・1ヶ月）は各案の中に自然に吸収してよい。

出力はテキストのみ（JSONやコードブロックは出さない）。
`.trim();

    // tier別の追加プロンプト
    // ※LINEテンプレ・NG行動・連絡タイミング・脈あり判定・7日間プランは /api/paid-tools が付録として別に作る。
    //   本文に同じものを書くと二重になり、内容も食い違うので、本文には書かせない。
    const PSYCH_SWITCH = `
【7】相手の心理スイッチ（800字以上）
summaryJsonのpartner_key_traits・相手のMBTI・恋愛タイプをもとに、相手が心を開くポイント（嬉しい言葉や行動）と、相手の地雷ポイント（冷める言葉や行動）を具体的に解説する。
断定口調でよい。おそらく・かもしれない は最小限に。`;

    const NO_APPENDIX = `
本文の後ろに付録（LINEテンプレ、NG行動チェックリスト、連絡タイミング、判定表、日別プランなど）は書かない。付録は別に用意してある。
LINEの具体的な文面も本文には書かない。`;

    let tierAddendum = "";
    if (tier === "980") {
      tierAddendum = `

追加指示（攻略レポート ¥980専用）：
【結び】の直前に【7】を追加する。
${PSYCH_SWITCH}
${NO_APPENDIX}

※合計10,000字以上を必ず達成すること。
`;
    } else if (tier === "1980") {
      tierAddendum = `

追加指示（個別戦略書 ¥1,980専用）：
【結び】の直前に【7】【8】を追加する。
${PSYCH_SWITCH}

【8】リスクシナリオと回避策（1,000字以上）
今の状況で起きうる悪いパターンを3つ提示し、それぞれについて、起きる前に防ぐ方法と、起きてしまった時の立て直し方を書く。
こうなったらこうする、という形で、すぐ使える具体さにする。待つ日数などの数字を出す場合は【5】【6】で書いたものと揃える。
${NO_APPENDIX}

※合計11,000字以上を必ず達成すること。
`;
    } else {
      tierAddendum = `
${NO_APPENDIX}
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
