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

    // =========================
    // evidence_pool をAPI側で作る（捏造抑止の要）
    // =========================
    const safeStr = (v) => (v == null ? "" : String(v)).trim();

    function extractUserTextFromHistoryContent(content) {
      const s = safeStr(content);
      if (!s) return "";
      const marker = "【今回のユーザ発言】";
      if (s.includes(marker)) {
        const parts = s.split(marker);
        return safeStr(parts.slice(1).join(marker));
      }
      // メタが無い形式のログもあり得るので、そのまま短く拾う
      return s;
    }

    function pushIf(list, label, value) {
      const v = safeStr(value);
      if (!v) return;
      list.push(`${label}: ${v}`);
    }

    // 1) profile 由来の事実（安定して強い根拠）
    const evidencePool = [];
    pushIf(evidencePool, "名前", profile.name);
    pushIf(evidencePool, "性別", profile.gender);
    pushIf(evidencePool, "年齢レンジ", profile.ageRange);
    pushIf(evidencePool, "状態（学生/社会人など）", profile.status);
    pushIf(evidencePool, "関係性", profile.relation);
    pushIf(evidencePool, "出会い方", profile.meeting);
    pushIf(evidencePool, "知り合ってから", profile.known);
    pushIf(evidencePool, "連絡頻度/どちらから多いか", profile.contact);
    pushIf(evidencePool, "いちばん悩んでいるポイント", profile.worry);
    pushIf(evidencePool, "今の心の状態", profile.mental);
    pushIf(evidencePool, "相談スタイル", profile.style);

    // タイプ情報（入力があれば事実として扱える）
    pushIf(evidencePool, "自分のMBTI", profile.selfMBTI);
    pushIf(evidencePool, "自分の恋愛16タイプ", profile.selfLove);
    pushIf(evidencePool, "相手のMBTI", profile.targetMBTI);
    pushIf(evidencePool, "相手の恋愛16タイプ", profile.targetLove);
    pushIf(evidencePool, "恋愛対象の性別", profile.targetGender);

    // 2) history 由来の事実（ユーザ発言のみを使う：assistant文は混ぜない）
    //    ※「ユーザ発言: ...」として入れる（文言はそのまま、捏造防止）
    const userUtterances = [];
    for (const m of history) {
      if (!m || m.role !== "user") continue;
      const text = extractUserTextFromHistoryContent(m.content);
      const t = safeStr(text).replace(/\s+/g, " ");
      if (!t) continue;
      // 長すぎるとLLMが雑に扱うので、適度にカット（事実の追加はしない）
      userUtterances.push(`ユーザ発言: ${t.slice(0, 140)}`);
    }
    // 直近優先
    userUtterances.slice(-12).forEach((x) => evidencePool.push(x));

    // 3) 重複排除 & 上限（プロンプト安定化）
    const deduped = [];
    const seen = new Set();
    for (const e of evidencePool) {
      const k = safeStr(e);
      if (!k) continue;
      if (seen.has(k)) continue;
      seen.add(k);
      deduped.push(k);
    }
    const finalEvidencePool = deduped.slice(0, 30);

    // =========================
    // summaryJson スキーマ（fortune_traits追加、厳密）
    // =========================
    const TRAIT_KEYS = [
      "sign_sensitivity",
      "temperature_gap_sensitivity",
      "self_blame_tendency",
      "uncertainty_stress",
      "future_visibility_need",
    ];

    const SUMMARY_SCHEMA = {
      type: "object",
      additionalProperties: false,
      required: [
        "title",
        "profile_snapshot",
        "summary",
        "fortune_traits",
        "chapter1_basic_personality",
        "chapter2_current_situation",
        "chapter3_emotions",
        "chapter4_patterns_with_partner",
        "chapter5_hints",
        "closing_message",
      ],
      properties: {
        title: { type: "string" },
        profile_snapshot: { type: "string" },
        summary: { type: "string" },

        fortune_traits: {
          type: "array",
          minItems: 5,
          maxItems: 5,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["trait_key", "title", "reading", "evidence"],
            properties: {
              trait_key: { type: "string", enum: TRAIT_KEYS },
              title: { type: "string" },
              reading: { type: "string" }, // 占いっぽい性格当て（本文素材）
              evidence: {
                type: "array",
                minItems: 2,
                maxItems: 4,
                items: { type: "string" }, // evidence_pool からの “文字列そのまま” を入れる
              },
            },
          },
        },

        chapter1_basic_personality: { type: "string" },
        chapter2_current_situation: { type: "string" },
        chapter3_emotions: { type: "string" },
        chapter4_patterns_with_partner: { type: "string" },
        chapter5_hints: { type: "string" },
        closing_message: { type: "string" },
      },
    };

    // =========================
    // SYSTEM_PROMPT（A優先＋evidence_poolからの選択を強制）
    // =========================
    const SYSTEM_PROMPT = `
あなたは「恋ぐるラボ」の有料レポート生成のための“要約設計者”です。
入力として profile（基本情報）と history（会話ログ：user/assistant）と evidence_pool（事実候補のプール）が与えられます。

あなたの出力は「後段の /api/paid-report が 6000〜8000字級の重厚な本文を書ける」ように、
情報を整理・抽象化し、章立てに沿って “日本語テキスト” を埋めた JSON だけを返してください。

最重要：A（恋愛の不安）を優先してください。
- 不安のトリガー（曖昧さ、温度差、予定が決まらない、返信ペースの揺れ、など）に焦点を当てる
- 押し付けない（断定しすぎない：〜の可能性、〜になりがち）

【捏造禁止ルール（絶対）】
- fortune_traits.evidence は「evidence_pool に含まれる文字列を“そのまま”」2〜4個選んで入れてください。
- evidence_pool に無い事実を evidence に書いてはいけません（言い換えも禁止）。
- evidence はプロフィール入力やユーザ発言の要約・抜粋が含まれます。そこから“選ぶ”だけにしてください。
- assistant の発言は内容に含まれていても、事実として採用しないでください（ユーザ発言・profile由来のみ）。

【fortune_traits 固定ルール（絶対）】
- fortune_traits は必ず5件（min=5,max=5）。増減禁止。
- trait_key は必ず次の5つをそれぞれ1回ずつ使う（重複禁止）：
  1) sign_sensitivity
  2) temperature_gap_sensitivity
  3) self_blame_tendency
  4) uncertainty_stress
  5) future_visibility_need
- title は日本語で分かりやすく（例：予兆検知、温度差耐性、自責化、不確実性ストレス、見通し欲 など）。
- reading は「占いっぽい性格当て」の素材として、各 280〜420文字程度で書く（です/ます禁止、ただし仙人語に寄せすぎず中立寄りでOK）。

【その他】
- history には【メタ情報】や JSON が含まれていても良い。理解に使ってよいが、出力にメタ文言は混ぜない。
- タイトルは短く惹きがあるが煽りすぎない。
- すべて日本語。絵文字は不要。
`.trim();

    // =========================
    // OpenAI へ（json_schema で強制）
    // =========================
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        temperature: 0.3,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content:
              "次の入力をもとに、指定スキーマに厳密準拠した summaryJson を生成してください。\n\n" +
              JSON.stringify({ profile, history, evidence_pool: finalEvidencePool }, null, 2),
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "paid_summary",
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

    // 最後に念のため：trait_key の5種が揃っているか軽くチェック（壊れてたら落とす）
    try {
      const keys = new Set((summaryJson.fortune_traits || []).map((x) => x.trait_key));
      const ok =
        keys.size === 5 &&
        ["sign_sensitivity", "temperature_gap_sensitivity", "self_blame_tendency", "uncertainty_stress", "future_visibility_need"].every(
          (k) => keys.has(k)
        );
      if (!ok) {
        return res.status(500).json({ error: "fortune_traits keys invalid", fortune_traits: summaryJson.fortune_traits });
      }
    } catch {}

    return res.status(200).json(summaryJson);
  } catch (err) {
    return res.status(500).json({ error: "Unexpected server error", detail: String(err) });
  }
}
