// ============ SMS 인증번호 발송 (Netlify Function) ============
// 인증번호는 서버에서 생성해 해시로만 저장 — 클라이언트에 정답 노출 금지.
// 발송 업체: 알리고(Aligo) 우선, 솔라피(Solapi) 키가 있으면 그걸로도 동작.
// 필요한 환경변수(Netlify 대시보드 > Site settings > Environment variables):
//   ALIGO_API_KEY, ALIGO_USER_ID  — 알리고(smartsms.aligo.in) API 키·아이디
//   SMS_FROM                       — 알리고에 사전 등록·승인된 발신번호 (예: 01012345678)
//   SUPABASE_SERVICE_KEY           — Supabase(scv-3Dhouse) service_role 키 (OTP 테이블 접근)
//   (대안) SOLAPI_API_KEY, SOLAPI_API_SECRET — 솔라피를 쓸 경우
// 미설정 시 503(not_configured)을 반환하고, 프론트는 인증 없이 입장하는 폴백으로 동작한다.
const crypto = require("crypto");

const SB_URL = process.env.SUPABASE_URL || "https://zjbaeoqvzbkdctwcrgfd.supabase.co";
const SRK = process.env.SUPABASE_SERVICE_KEY || "";
const ALIGO_KEY = process.env.ALIGO_API_KEY || "";
const ALIGO_ID = process.env.ALIGO_USER_ID || "";
const SOL_KEY = process.env.SOLAPI_API_KEY || "";
const SOL_SEC = process.env.SOLAPI_API_SECRET || "";
const SMS_FROM = process.env.SMS_FROM || "";
const PROVIDER = ALIGO_KEY && ALIGO_ID ? "aligo" : SOL_KEY && SOL_SEC ? "solapi" : "";

const sbHeaders = { apikey: SRK, Authorization: `Bearer ${SRK}`, "Content-Type": "application/json" };
const hash = (code, phone) => crypto.createHash("sha256").update(`${code}|${phone}|metahouse`).digest("hex");
const json = (status, body) => ({ statusCode: status, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "method" });
  if (!SRK || !PROVIDER || !SMS_FROM) return json(503, { error: "not_configured" });

  let phone = "";
  try { phone = String(JSON.parse(event.body || "{}").phone || "").replace(/[^0-9]/g, ""); } catch (e) {}
  if (!/^01[016789][0-9]{7,8}$/.test(phone)) return json(400, { error: "bad_phone" });

  // 재발송 제한: 60초 쿨다운 + 1시간 내 최대 5회 (스팸·비용 방지)
  const rowRes = await fetch(`${SB_URL}/rest/v1/town_otp?phone=eq.${phone}`, { headers: sbHeaders });
  const rows = rowRes.ok ? await rowRes.json() : [];
  const row = rows[0];
  const now = Date.now();
  let sentCount = 1;
  if (row) {
    const winStart = new Date(row.window_start).getTime();
    const last = new Date(row.updated_at).getTime();
    if (now - last < 60e3) return json(429, { error: "cooldown", wait: Math.ceil((60e3 - (now - last)) / 1000) });
    if (now - winStart < 3600e3) {
      if (row.sent_count >= 5) return json(429, { error: "too_many" });
      sentCount = row.sent_count + 1;
    }
  }

  const code = String(crypto.randomInt(100000, 1000000));
  const up = await fetch(`${SB_URL}/rest/v1/town_otp`, {
    method: "POST",
    headers: Object.assign({ Prefer: "resolution=merge-duplicates" }, sbHeaders),
    body: JSON.stringify({
      phone,
      code_hash: hash(code, phone),
      expires_at: new Date(now + 5 * 60e3).toISOString(),
      attempts: 0,
      sent_count: sentCount,
      window_start: sentCount === 1 ? new Date(now).toISOString() : row.window_start,
      updated_at: new Date(now).toISOString(),
    }),
  });
  if (!up.ok) return json(500, { error: "store_failed" });

  const text = `[메타하우스] 인증번호 [${code}]를 입력해주세요. (5분 이내)`;
  if (PROVIDER === "aligo") {
    // 알리고 발송 (form-urlencoded, result_code가 양수면 성공)
    const form = new URLSearchParams({
      key: ALIGO_KEY,
      user_id: ALIGO_ID,
      sender: SMS_FROM.replace(/[^0-9]/g, ""),
      receiver: phone,
      msg: text,
      msg_type: "SMS",
    });
    const smsRes = await fetch("https://apis.aligo.in/send/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    const d = await smsRes.json().catch(() => ({}));
    if (!smsRes.ok || Number(d.result_code) <= 0) {
      console.error("aligo send failed:", d.result_code, d.message);
      // 설정 문제(미등록 발신번호·IP 제한 등)를 진단할 수 있게 알리고 응답 코드를 함께 반환
      return json(502, { error: "sms_failed", provider: "aligo", code: d.result_code, detail: d.message });
    }
  } else {
    // 솔라피 발송 (HMAC-SHA256 인증)
    const date = new Date().toISOString();
    const salt = crypto.randomBytes(16).toString("hex");
    const sig = crypto.createHmac("sha256", SOL_SEC).update(date + salt).digest("hex");
    const smsRes = await fetch("https://api.solapi.com/messages/v4/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `HMAC-SHA256 apiKey=${SOL_KEY}, date=${date}, salt=${salt}, signature=${sig}`,
      },
      body: JSON.stringify({ message: { to: phone, from: SMS_FROM, text } }),
    });
    if (!smsRes.ok) return json(502, { error: "sms_failed" });
  }
  return json(200, { ok: true });
};
