// /api/create-checkout-session.js
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const stripeSecretKey = (process.env.STRIPE_SECRET_KEY || "").trim();
    const priceId = (process.env.STRIPE_PRICE_ID || "").trim();
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").trim(); // https://xxxxx.vercel.app

    if (!stripeSecretKey) return res.status(500).json({ error: "Missing STRIPE_SECRET_KEY" });
    if (!priceId) return res.status(500).json({ error: "Missing STRIPE_PRICE_ID" });
    if (!appUrl) return res.status(500).json({ error: "Missing NEXT_PUBLIC_APP_URL" });

    const { token } = req.body || {};
    if (!token || typeof token !== "string") {
      return res.status(400).json({ error: "Invalid body. Expected { token }" });
    }

    // 成功/キャンセルの戻り先（同一ドメイン）
    const successUrl = `${appUrl}/paid-success.html?token=${encodeURIComponent(token)}`;
    const cancelUrl = `${appUrl}/paid-cancel.html?token=${encodeURIComponent(token)}`;

    // Stripe REST APIでCheckout Session作成（SDK不要）
    const params = new URLSearchParams();
    params.append("mode", "payment");
    params.append("line_items[0][price]", priceId);
    params.append("line_items[0][quantity]", "1");
    params.append("success_url", successUrl);
    params.append("cancel_url", cancelUrl);

    // 追跡用（任意）
    params.append("client_reference_id", token);
    params.append("metadata[token]", token);
    params.append("metadata[product]", "koiguru_paid_report");

    const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Bearer ${stripeSecretKey}`,
      },
      body: params.toString(),
    });

    const data = await stripeRes.json();
    if (!stripeRes.ok) {
      return res.status(500).json({ error: "Stripe API error", detail: data });
    }

    return res.status(200).json({ url: data.url });
  } catch (err) {
    return res.status(500).json({ error: "Unexpected server error", detail: String(err) });
  }
}
