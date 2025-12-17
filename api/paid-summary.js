// /api/paid-summary.js
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const rawKey = process.env.OPENAI_API_KEY;
    if (!rawKey) {
      return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
    }
    const apiKey = rawKey.trim();

    const { profile, history } = req.body || {};
    if (!profile || !Array.isArray(history)) {
      return res.status(400).json({ error: "Invalid body. Expected { profile, history[] }" });
    }

    const DEBUG_EVIDENCE_POOL =
      String(process.env.DEBUG_EVIDENCE_POOL || "").toLowerCase() === "true";

    function safeStr(v) {
      return typeof v === "string" ? v.trim() : "";
    }

    function extractUserUtteranceFromHistoryContent(content) {
      if (typeof content !== "string") return "";
      const marker = "【今回のユーザ発言】";
      if (content.includes(marker)) {
        const after = content.split(marker)[1] || "";
        return after.trim();
      }
      // メタ混入がない場合はそのまま
      return content.trim();
    }

    function normalizeOneLine(text, maxLen = 220) {
      const t = String(text || "")
        .replace(/\r/g, "")
        .replace(/\n+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (!t) return "";
      return t.length > maxLen ? t.slice(0, maxLen) : t;
    }

    function uniq(arr) {
      const seen = new Set();
      const out = [];
      for (const x of arr) {
        const k = String(x || "").trim();
        if (!k) continue;
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(k);
      }
      return out;
    }

    function buildEvidencePool(profileObj, historyArr) {
      const p = profileObj || {};
      const pool = [];

      const name = safeStr(p.name);
      const ageRange = safeStr(p.ageRange);
      const status = safeStr(p.status);
      const relation = safeStr(p.relation);
      const meeting = safeStr(p.meeting);
      const known = safeStr(p.known);
      const contact = safeStr(p.contact);
      const worry = safeStr(p.worry);
      const mental = safeStr(p.mental);

      const selfMBTI = safeStr(p.selfMBTI);
      const selfLove = safeStr(p.selfLove);
      const targetGender = safeStr(p.targetGender);
      const targetMBTI = safeStr(p.targetMBTI);
      const targetLove = safeStr(p.targetLove);

      if (name) pool.push(`名前: ${name}`);
      if (ageRange) pool.push(`年齢レンジ: ${ageRange}`);
      if (status) pool.push(`状態: ${status}`);
      if (relation) pool.push(`関係性: ${relation}`);
      if (meeting) pool.push(`出会い方: ${meeting}`);
      if (known) pool.push(`知り合って: ${known}`);
      if (contact) pool.push(`連絡頻度: ${contact}`);
      if (worry) pool.push(`悩み: ${worry}`);
      if (mental) pool.push(`心の状態: ${mental}`);

      if (selfMBTI) pool.push(`お主のMBTI: ${selfMBTI}`);
      if (selfLove) pool.push(`お主の恋愛16タイプ: ${selfLove}`);
      if (targetGender) pool.push(`相手の性別: ${targetGender}`);
      if (targetMBTI) pool.push(`相手のMBTI: ${targetMBTI}`);
      if (targetLove) pool.push(`相手の恋愛16タイプ: ${targetLove}`);

      // history から user 発言を抽出（メタを除去しつつ）
      const userUtterances = [];
      for (const m of historyArr) {
        if (!m || m.role !== "user") continue;
        const raw = extractUserUtteranceFromHistoryContent(m.content);
        const one = normalizeOneLine(raw, 240);
        if (one) userUtterances.push(`会話ログ: ${one}`);
      }

      // 長すぎるとプロンプトが重くなるので上限
      const merged = uniq([...pool, ...userUtterances]);

      // 先頭から多め＋末尾から少し（最新っぽさ）を残す
      const head = merged.slice(0, 22);
      const tail = merged.slice(Math.max(merged.length - 10, 0));
      return uniq([...head, ...tail]).slice(0, 30);
    }

    function sanitizeTitle(title) {
      let t = String(title || "").trim();
      if (!t) return t;
      // 後ろの括弧を削除（全角・半角）
      t = t.replace(/\s*[（(][^）)]*[）)]\s*$/g, "").trim();
      return t;
    }

    const evidence_pool = buildEvidencePool(profile, history);

    if (DEBUG_EVIDENCE_POOL) {
      // 品質チェック用（本番では環境変数でOFF推奨）
      console.log("=== evidence_pool (paid-summary) ===");
      console.log(JSON.stringify(evidence_pool, null, 2));
    }

    const SYSTEM_PROMPT = `
あなたは「恋ぐるラボ」の有料レポート生成のための“要約設計者”です。
入力として profile（基本情報）と history（会話ログ）と evidence_pool（事実の候補）が与えられます。

あなたの出力は「後段の /api/paid-report が 6000〜8000字級の高品質本文を書ける」ように、
情報を整理・抽象化し、章立てに沿って“日本語テキスト”を埋めた summaryJson を返すことです。

最重要ルール（安定出力のため）：
- 今回は A：恋愛の不安 を最優先にする（不安・焦り・温度差・既読/返信・予定未確定・見通し欲など）。
- fortune_traits は必ず5件（min=5,max=5）。絶対に増減しない。
- fortune_traits の各要素には evidence（会話からの“事実”）を必ず2〜4個入れる。捏造は禁止。
- evidence は必ず evidence_pool に含まれる内容だけを使う（軽い言い換えは可、事実追加は不可）。
- 「ユーザ発言: 1」など内部ラベルやメタ引用は禁止。画面の裏側の話は出さない。

文体ルール（AIっぽさ対策）：
- 三人称の硬い要約ではなく、仙人口調の“寄り添い”を混ぜる（ただし押し付けない）。
- 不自然なカギ括弧（「」）の多用は禁止。必要最小限にする。
- タイトルの末尾に（）を付けない。

fortune_traits の構成ルール：
- 最初の3件は固定（このタイトルで固定）：
  1) 反応の温度差で心がぐらぐらする
  2) 小さな違和感を拾いすぎる
  3) 次が決まらないと不安が増える
- 2) の one_liner は必ず次の文にする（完全一致）：
  「違和感を見逃さないのは、“精度の高い気配センサー”を持っているという証拠じゃ。」
- 残り2件は可変（下の候補6つから“根拠が多い順”に2つ選ぶ）。ただし evidence が2件以上取れない候補は選ばない。
  候補6つ：
  A) 自分を責めすぎる
  B) 白黒を急ぎたくなる
  C) 相手の本心を推理しすぎる
  D) 取り戻そうとして焦る
  E) 距離を詰める速度が上がる
  F) 気持ちが急に加速しやすい

summaryJson の各フィールドの役割：
- profile_snapshot: 読者が「自分の話だ」と感じる、短い導入（寄り添い＋事実）
- summary_30sec: 30秒で要点が掴める結論（寄り添い＋構図）
- fortune_traits: 0章の素材（タイトル/one_liner/description/evidence）
- chapter1_emotion_translation: 感情の翻訳（寄り添い章）
- chapter2_trigger_map: しんどさのトリガー地図
- chapter3_relationship_structure: 二人の構図
- chapter4_partner_hypothesis: 相手側の仮説（断定しない）
- chapter5_decision_room: 意思決定章（少なくとも2ルート提示：復縁寄せ／距離を置く・諦める寄せ）
- chapter6_line_library: LINE文案ライブラリ（複数パターン）
- chapter7_action_plans: 今後のアクションプラン（最低3案。目的/期間/ステップ/if-then分岐を含む）
- closing_message: 優しい締め（説教しない）

出力は JSON のみ。コードフェンス禁止。`.trim();

    // summaryJson スキーマ
    const SUMMARY_SCHEMA = {
      type: "object",
      additionalProperties: false,
      required: [
        "title",
        "profile_snapshot",
        "summary_30sec",
        "fortune_traits",
        "chapter1_emotion_translation",
        "chapter2_trigger_map",
        "chapter3_relationship_structure",
        "chapter4_partner_hypothesis",
        "chapter5_decision_room",
        "chapter6_line_library",
        "chapter7_action_plans",
        "closing_message",
      ],
      properties: {
        title: { type: "string" },
        profile_snapshot: { type: "string" },
        summary_30sec: { type: "string" },

        fortune_traits: {
          type: "array",
          minItems: 5,
          maxItems: 5,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["title", "one_liner", "description", "evidence"],
            properties: {
              title: { type: "string" },
              one_liner: { type: "string" },
              description: { type: "string" },
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
        chapter5_decision_room: { type: "string" },
        chapter6_line_library: { type: "string" },
        chapter7_action_plans: { type: "string" },
        closing_message: { type: "string" },
      },
    };

    const payload = {
      profile,
      history,
      evidence_pool,
    };

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
              "次の入力をもとに、指定スキーマに厳密準拠した summaryJson を生成してください。\n" +
              "必ず evidence_pool の範囲内で根拠を作り、捏造はしないでください。\n\n" +
              JSON.stringify(payload, null, 2),
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
      return res.status(500).json({
        error: "OpenAI API error",
        status: openaiRes.status,
        body: text,
      });
    }

    const data = await openaiRes.json();
    const raw = data.choices?.[0]?.message?.content || "";

    let summaryJson;
    try {
      summaryJson = JSON.parse(raw);
    } catch {
      return res.status(500).json({ error: "Failed to parse model JSON", raw });
    }

    // タイトル末尾の（）除去（最終保険）
    summaryJson.title = sanitizeTitle(summaryJson.title);

    return res.status(200).json(summaryJson);
  } catch (err) {
    return res.status(500).json({ error: "Unexpected server error", detail: String(err) });
  }
}
