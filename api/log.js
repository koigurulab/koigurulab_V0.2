// api/log.js
// インテーク完了時に呼ばれるログ収集エンドポイント
// ─ Vercel Functionsのログ（console.log）に常に書き出す
// ─ 環境変数 LOG_WEBHOOK_URL が設定されていれば Google Apps Script にも送信する

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { event, profile } = req.body || {};

  if (!profile || typeof profile !== "object") {
    return res.status(400).json({ error: "profile is required" });
  }

  // ── Vercel Functionsのログに書き出す（Vercelダッシュボードで確認可能）──
  const logEntry = {
    event: event || "intake_complete",
    ts: new Date().toISOString(),
    selfMBTI:     profile.selfMBTI     || "",
    selfLove:     profile.selfLove     || "",
    targetMBTI:   profile.targetMBTI   || "",
    targetLove:   profile.targetLove   || "",
    gender:       profile.gender       || "",
    targetGender: profile.targetGender || "",
    ageRange:     profile.ageRange     || "",
    status:       profile.status       || "",
    relation:     profile.relation     || "",
    meeting:      profile.meeting      || "",
    worry:        profile.worry        || "",
    mental:       profile.mental       || "",
    style:        profile.style        || "",
  };
  console.log("[KOI_LOG]", JSON.stringify(logEntry));

  // ── Google Apps Script Webhook への送信（任意）──
  const webhookUrl = process.env.LOG_WEBHOOK_URL;
  if (webhookUrl) {
    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(logEntry),
      });
    } catch (e) {
      // Webhookが失敗してもユーザー体験には影響させない
      console.warn("[KOI_LOG] webhook failed:", String(e));
    }
  }

  return res.status(200).json({ ok: true });
}
