// /pages/api/verify-paid.js
// 目的：Stripe Checkout の session_id が「支払い完了」かをサーバ側で検証する
// 前提：create-checkout-session.js で success_url に
//   ...paid-success.html?token=...&session_id={CHECKOUT_SESSION_ID}
// を付けていること（session_id がURLに来る）

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    const stripeSecretKey = (process.env.STRIPE_SECRET_KEY || "").trim();
    if (!stripeSecretKey) {
      return res.status(500).json({ ok: false, error: "Missing STRIPE_SECRET_KEY" });
    }

    const { session_id, token } = req.body || {};
    if (!session_id || typeof session_id !== "string") {
      return res.status(400).json({ ok: false, error: "Invalid body. Expected { session_id, token? }" });
    }

    // Stripe Checkout Session を取得（REST API）
    // expand は必須ではないが、デバッグ/将来拡張用に付けておく
    const url =
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(session_id)}` +
      `?expand%5B%5D=payment_intent&expand%5B%5D=line_items`;

    const stripeRes = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
      },
    });

    const data = await stripeRes.json().catch(() => null);

    if (!stripeRes.ok || !data || typeof data !== "object") {
      // Stripeのエラーはdetailとして返す（フロントでは表示しない想定）
      return res.status(500).json({
        ok: false,
        error: "Stripe API error",
        detail: data || { message: "failed to parse stripe response" },
      });
    }

    // === ここから検証ロジック ===
    // Stripe Checkout Session オブジェクト例：
    // data.mode === "payment"
    // data.payment_status === "paid"
    // data.status === "complete" など（環境により）
    const mode = data.mode;
    const paymentStatus = data.payment_status;
    const status = data.status;

    if (mode !== "payment") {
      return res.status(200).json({
        ok: false,
        reason: "mode_is_not_payment",
        mode,
        payment_status: paymentStatus,
        status,
      });
    }

    // 支払い完了判定：payment_status が paid であること
    // （保守的に status=complete も参考値として返す）
    if (paymentStatus !== "paid") {
      return res.status(200).json({
        ok: false,
        reason: "payment_not_paid",
        mode,
        payment_status: paymentStatus,
        status,
      });
    }

    // token ひも付け検証（可能なら必ずやる）
    // create-checkout-session 側で
    //   params.append("client_reference_id", token);
    //   params.append("metadata[token]", token);
    // を設定している前提
    const metaToken = data.metadata?.token;
    const refToken = data.client_reference_id;

    if (token && typeof token === "string") {
      const match = token === metaToken || token === refToken;
      if (!match) {
        return res.status(200).json({
          ok: false,
          reason: "token_mismatch",
          payment_status: paymentStatus,
          status,
        });
      }
    }

    // （任意）商品整合性チェック：metadata.product を入れているなら照合
    // create-checkout-sessionで `metadata[product]=koiguru_paid_report` を付けている想定
    if (data.metadata?.product && data.metadata.product !== "koiguru_paid_report") {
      return res.status(200).json({
        ok: false,
        reason: "product_mismatch",
        payment_status: paymentStatus,
        status,
      });
    }

    // ここまで通ったら「支払い完了」判定
    return res.status(200).json({
      ok: true,
      payment_status: paymentStatus,
      status,
      // フロント側で必要なら参照できるように最小限返す
      session_id: data.id,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "Unexpected server error",
      detail: String(err),
    });
  }
}
