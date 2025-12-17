// /api/paid-summary.js
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const rawKey = process.env.OPENAI_API_KEY;
    if (!rawKey) return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
    const apiKey = rawKey.trim();

    const { profile, history } = req.body || {};
    if (!profile || !Array.isArray(history)) {
      return res.status(400).json({ error: "Invalid body. Expected { profile, history[] }" });
    }

    /**
     * 変更点（①〜⑤反映）:
     * - profile_snapshot と summary(30秒要約) を統合 -> opening_current_position
     * - 出力で # 見出し禁止、（）の内部注釈禁止、"ユーザ発言:" 等の内部メモ禁止を強制
     * - 文字数レンジを各章で意識させる
     * - クロージング改名 -> ending_last_words（表示名は paid-report 側で「結び：仙人からの最後のひと言」）
     * - 占い（fortune_traits）は必ず5件、evidenceは2〜4件、捏造禁止
     * - 固定3タイトルを厳密一致で要求（温度差／違和感／見通し欲）
     */
    const SYSTEM_PROMPT = `
あなたは「恋ぐるラボ」の有料レポート生成のための“設計者（アウトライン作成者）”です。
入力として profile（基本情報）と history（会話ログ：user/assistant）が与えられます。

あなたの出力は、後段の /api/paid-report が「6000〜8000文字の高品質本文」を安定して書けるように、
章ごとの中身を日本語テキストで埋めた JSON を返すことです（スキーマ厳守）。

最重要ルール（必ず守る）：
- fortune_traits は必ず5件（min=5,max=5）。増減禁止。
- fortune_traits の各要素の evidence は必ず2〜4個。捏造禁止（profile/historyに含まれる事実のみ。言い換えは可、事実追加は不可）。
- 今回は「A：恋愛の不安」を優先。相手の反応・温度差・予定未確定・返信速度などに紐づく不安に寄せる。
- fortune_traits のうち最初の3件は “固定” とし、title は下記の完全一致にする：
  1) 反応の温度差で心がぐらぐらする
  2) 小さな違和感を拾いすぎる
  3) 次が決まらないと不安が増える
- 残り2件（可変）は、下の候補6つから evidence が最も強いものを2つ選ぶ（候補以外を作らない）：
  A) 自分を責めすぎる
  B) 相手の本心を推理しすぎる
  C) 安心確認が止まらない
  D) 距離の詰め方が加速しやすい
  E) 失点を一発で取り返そうとする
  F) 不安を頭の中で反芻し続ける

表現ルール（重要）：
- すべて日本語。絵文字不要。
- “仙人の口調”の素材になるように、お主/〜じゃ/〜のう を自然に混ぜてよい（過剰に崩さない）。
- 出力に # 見出し記号は一切使わない（Markdown見出し禁止）。
- 章タイトルに（ ）を付けない。内部注釈（例：最低3案、断定しない等）は本文に出さず、内容で満たす。
- 「ユーザ発言:」等の内部メモ・参照番号・メタ文章は絶対に混ぜない。

文字量の目安（各フィールドの中身）：
- opening_current_position: 900〜1200字
- fortune_traits（5つ合計）: 900〜1200字相当（各trait_bodyは短すぎない）
- chapter1_emotion_translation: 900〜1200字
- chapter2_trigger_map: 700〜1000字
- chapter3_relationship_structure: 600〜900字
- chapter4_partner_hypothesis: 600〜900字
- chapter5_decision_paths: 900〜1200字
- chapter6_line_templates: 500〜800字
- chapter7_action_plans: 800〜1100字（最低3案分の材料を含む）
- ending_last_words: 300〜500字
`.trim();

    const SUMMARY_SCHEMA = {
      type: "object",
      additionalProperties: false,
      required: [
        "title",
        "opening_current_position",
        "fortune_traits",
        "chapter1_emotion_translation",
        "chapter2_trigger_map",
        "chapter3_relationship_structure",
        "chapter4_partner_hypothesis",
        "chapter5_decision_paths",
        "chapter6_line_templates",
        "chapter7_action_plans",
        "ending_last_words",
      ],
      properties: {
        title: { type: "string" },

        // ④：profile_snapshot + 30秒要約を統合（新名称は paid-report で「はじめに：いまのお主の現在地」として出す）
        opening_current_position: { type: "string" },

        // 0章：占い（5つ固定 + 可変2）
        fortune_traits: {
          type: "array",
          minItems: 5,
          maxItems: 5,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["title", "trait_body", "evidence"],
            properties: {
              title: { type: "string" },
              trait_body: { type: "string" },
              evidence: {
                type: "array",
                minItems: 2,
                maxItems: 4,
                items: { type: "string" },
              },
            },
          },
        },

        chapter1_emotion_translation: { type: "string" },
        chapter2_trigger_map: { type: "string" },
        chapter3_relationship_structure: { type: "string" },
        chapter4_partner_hypothesis: { type: "string" },
        chapter5_decision_paths: { type: "string" },
        chapter6_line_templates: { type: "string" },
        chapter7_action_plans: { type: "string" },

        // ⑤：クロージング改名（paid-report 側で「結び：仙人からの最後のひと言」として出す）
        ending_last_words: { type: "string" },
      },
    };

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        temperature: 0.4,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content:
              "次の入力をもとに、指定スキーマに厳密準拠した summaryJson を生成してください。\n\n" +
              JSON.stringify({ profile, history }, null, 2),
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "paid_summary_v2",
            strict: true,
            schema: SUMMARY_SCHEMA,
          },
        },
      }),
    });

    if (!openaiRes.ok) {
      const text = await openaiRes.text();
      return res.status(500).json({ error: "OpenAI API error", status: openaiRes.status, body: text });
    }

    const data = await openaiRes.json();
    const raw = data.choices?.[0]?.message?.content || "";

    let summaryJson;
    try {
      summaryJson = JSON.parse(raw);
    } catch {
      return res.status(500).json({ error: "Failed to parse model JSON", raw });
    }

    return res.status(200).json(summaryJson);
  } catch (err) {
    return res.status(500).json({ error: "Unexpected server error", detail: String(err) });
  }
}
