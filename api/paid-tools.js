// /api/paid-tools.js
// 付録ツール生成API（¥980/¥1,980専用）
// summaryJson + tier を受け取り、LINEテンプレ・NGチェックリスト等の構造化JSONを返す

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const rawKey = process.env.OPENAI_API_KEY;
    if (!rawKey) return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
    const apiKey = rawKey.trim();

    const { summaryJson, tier } = req.body || {};
    if (!summaryJson || typeof summaryJson !== "object") {
      return res.status(400).json({ error: "Invalid body. Expected { summaryJson, tier }" });
    }

    const tierStr = String(tier || "980");
    if (tierStr !== "980" && tierStr !== "1980") {
      return res.status(400).json({ error: "tier must be 980 or 1980" });
    }

    const is1980 = tierStr === "1980";

    const SYSTEM_PROMPT = `
あなたは「恋ぐるラボ」の付録ツール生成AIです。
入力は summaryJson（レポート設計図）です。

仙人の口調（お主/〜じゃ/〜のう）は使わない。付録はツール形式なので、簡潔で実用的なトーンで書く。
ただし温かみのある日本語で、冷たくならないように。

summaryJsonにない事実は作らない（捏造禁止）。言い換えは可。
`.trim();

    // ¥980用スキーマ
    const schema980 = {
      type: "object",
      additionalProperties: false,
      required: ["line_templates", "ng_checklist", "timing_guide", "next_action"],
      properties: {
        line_templates: {
          type: "array",
          minItems: 3,
          maxItems: 3,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["situation", "message", "timing", "avoid"],
            properties: {
              situation: { type: "string" },
              message: { type: "string" },
              timing: { type: "string" },
              avoid: { type: "string" },
            },
          },
        },
        ng_checklist: {
          type: "array",
          minItems: 8,
          maxItems: 10,
          items: { type: "string" },
        },
        timing_guide: { type: "string" },
        next_action: { type: "string" },
      },
    };

    // ¥1,980用スキーマ（980の全内容 + 拡張）
    const schema1980 = {
      type: "object",
      additionalProperties: false,
      required: [
        "line_templates",
        "ng_checklist",
        "timing_guide",
        "next_action",
        "pursuit_judgment",
        "branch_scenario",
        "week_plan",
      ],
      properties: {
        line_templates: {
          type: "array",
          minItems: 8,
          maxItems: 10,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["situation", "message", "timing", "avoid"],
            properties: {
              situation: { type: "string" },
              message: { type: "string" },
              timing: { type: "string" },
              avoid: { type: "string" },
            },
          },
        },
        ng_checklist: {
          type: "array",
          minItems: 12,
          maxItems: 15,
          items: { type: "string" },
        },
        timing_guide: { type: "string" },
        next_action: { type: "string" },
        pursuit_judgment: {
          type: "object",
          additionalProperties: false,
          required: ["go_signals", "stop_signals"],
          properties: {
            go_signals: {
              type: "array",
              minItems: 3,
              maxItems: 5,
              items: { type: "string" },
            },
            stop_signals: {
              type: "array",
              minItems: 3,
              maxItems: 5,
              items: { type: "string" },
            },
          },
        },
        branch_scenario: {
          type: "object",
          additionalProperties: false,
          required: ["if_reply", "if_no_reply"],
          properties: {
            if_reply: {
              type: "array",
              minItems: 2,
              maxItems: 4,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["signal", "next_action"],
                properties: {
                  signal: { type: "string" },
                  next_action: { type: "string" },
                },
              },
            },
            if_no_reply: {
              type: "object",
              additionalProperties: false,
              required: ["wait_days", "next_message", "retreat_sign"],
              properties: {
                wait_days: { type: "string" },
                next_message: { type: "string" },
                retreat_sign: { type: "string" },
              },
            },
          },
        },
        week_plan: {
          type: "array",
          minItems: 7,
          maxItems: 7,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["day", "action", "avoid", "checkpoint"],
            properties: {
              day: { type: "string" },
              action: { type: "string" },
              avoid: { type: "string" },
              checkpoint: { type: "string" },
            },
          },
        },
      },
    };

    const schema = is1980 ? schema1980 : schema980;

    const userPrompt = is1980
      ? `次の summaryJson をもとに、個別戦略書（¥1,980）の付録ツールを生成してください。

生成内容：
1. line_templates（8〜10本）: 状況別LINEテンプレート。situation（どんな時に使う）、message（送る文面）、timing（いつ送るべきか）、avoid（この文面のNG使い方）
2. ng_checklist（12〜15項目）: この人が絶対やってはいけないNG行動リスト。具体的に。
3. timing_guide: 相手のタイプに合わせた連絡タイミングガイド（200〜400字）
4. next_action: 今週中にやるべきこと（100〜200字）
5. pursuit_judgment: 脈ありサイン（go_signals）と撤退サイン（stop_signals）の判定表
6. branch_scenario: 返信が来た場合（if_reply: パターン別の次の一手）と来なかった場合（if_no_reply: 待つ日数・次のメッセージ・撤退の目安）
7. week_plan: 7日間の行動プラン。各日に action（やること）、avoid（やらないこと）、checkpoint（確認ポイント）

summaryJson:
` + JSON.stringify(summaryJson, null, 2)
      : `次の summaryJson をもとに、攻略レポート（¥980）の付録ツールを生成してください。

生成内容：
1. line_templates（3本）: 状況別LINEテンプレート。situation（どんな時に使う）、message（送る文面）、timing（いつ送るべきか）、avoid（この文面のNG使い方）
2. ng_checklist（8〜10項目）: この人が絶対やってはいけないNG行動リスト。具体的に。
3. timing_guide: 相手のタイプに合わせた連絡タイミングガイド（200〜400字）
4. next_action: 今週中にやるべきこと（100〜200字）

summaryJson:
` + JSON.stringify(summaryJson, null, 2);

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
          { role: "user", content: userPrompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: is1980 ? "paid_tools_1980" : "paid_tools_980",
            strict: true,
            schema,
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

    let toolsJson;
    try {
      toolsJson = JSON.parse(raw);
    } catch {
      return res.status(500).json({ error: "Failed to parse model JSON", raw });
    }

    return res.status(200).json(toolsJson);
  } catch (err) {
    return res.status(500).json({ error: "Unexpected server error", detail: String(err) });
  }
}
