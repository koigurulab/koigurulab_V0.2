// api/log.js
// イベントログ収集エンドポイント
// 対応イベント:
//   intake_complete   : インテーク完了（profile情報）
//   free_report_shown : 無料レポート表示（profile + report本文）
//   purchase          : 購入完了（profile + tier/price/plan_name）

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = req.body || {};
  const { event, profile = {}, report = "", tier = "", price = "", plan_name = "", token = "" } = body;

  // ── Vercel Functionsのログに書き出す ──
  const logEntry = {
    event:        event      || "unknown",
    ts:           new Date().toISOString(),
    // プロフィール（全イベント共通）
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
    // 購入情報（purchase イベント時のみ）
    tier:         String(tier),
    price:        String(price),
    plan_name:    String(plan_name),
    token:        String(token),
    // 無料レポート本文（free_report_shown イベント時のみ・長文になる）
    report:       String(report),
  };

  // reportは長いので別ログにして可読性を上げる
  const { report: _r, ...logEntryShort } = logEntry;
  console.log("[KOI_LOG]", JSON.stringify(logEntryShort));
  if (report) console.log("[KOI_REPORT]", report.slice(0, 500) + (report.length > 500 ? "…" : ""));

  // ── Google Apps Script Webhook への送信（任意） ──
  const webhookUrl = process.env.LOG_WEBHOOK_URL;
  if (webhookUrl) {
    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(logEntry),
      });
    } catch (e) {
      console.warn("[KOI_LOG] webhook failed:", String(e));
    }
  }

  return res.status(200).json({ ok: true });
}
