// ============ SMS 인증번호 대조 (Netlify Function) ============
// 서버에서만 해시 비교 — 유효시간 5분, 시도 5회 제한.
const crypto = require("crypto");

const SB_URL = process.env.SUPABASE_URL || "https://zjbaeoqvzbkdctwcrgfd.supabase.co";
const SRK = process.env.SUPABASE_SERVICE_KEY || "";
const sbHeaders = { apikey: SRK, Authorization: `Bearer ${SRK}`, "Content-Type": "application/json" };
const hash = (code, phone) => crypto.createHash("sha256").update(`${code}|${phone}|metahouse`).digest("hex");
const json = (status, body) => ({ statusCode: status, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "method" });
  if (!SRK) return json(503, { error: "not_configured" });

  let phone = "", code = "";
  try {
    const b = JSON.parse(event.body || "{}");
    phone = String(b.phone || "").replace(/[^0-9]/g, "");
    code = String(b.code || "").replace(/[^0-9]/g, "");
  } catch (e) {}
  if (!/^01[016789][0-9]{7,8}$/.test(phone) || code.length !== 6) return json(400, { error: "bad_input" });

  const rowRes = await fetch(`${SB_URL}/rest/v1/town_otp?phone=eq.${phone}`, { headers: sbHeaders });
  const rows = rowRes.ok ? await rowRes.json() : [];
  const row = rows[0];
  if (!row) return json(400, { error: "no_request" });
  if (new Date(row.expires_at).getTime() < Date.now()) return json(400, { error: "expired" });
  if (row.attempts >= 5) return json(429, { error: "too_many_attempts" });

  const ok = crypto.timingSafeEqual(Buffer.from(hash(code, phone)), Buffer.from(row.code_hash));
  if (!ok) {
    await fetch(`${SB_URL}/rest/v1/town_otp?phone=eq.${phone}`, {
      method: "PATCH",
      headers: sbHeaders,
      body: JSON.stringify({ attempts: row.attempts + 1 }),
    });
    return json(400, { error: "wrong_code", left: 4 - row.attempts });
  }
  await fetch(`${SB_URL}/rest/v1/town_otp?phone=eq.${phone}`, { method: "DELETE", headers: sbHeaders });
  return json(200, { ok: true });
};
