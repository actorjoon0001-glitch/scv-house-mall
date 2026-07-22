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

  let phone = "", code = "", nick = "", name = "";
  try {
    const b = JSON.parse(event.body || "{}");
    phone = String(b.phone || "").replace(/[^0-9]/g, "");
    code = String(b.code || "").replace(/[^0-9]/g, "");
    nick = String(b.nick || "").slice(0, 10);
    name = String(b.name || "").slice(0, 20);
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

  // 번호 인증 = 로그인: 이 번호로 가입된 회원이 있으면 복원, 없으면 회원으로 등록.
  // OTP를 실제로 통과한 요청에서만 실행되므로 남의 번호로는 회원 정보를 못 가져간다.
  let member = null;
  try {
    const dashed = phone.length >= 10 ? `${phone.slice(0, 3)}-${phone.slice(3, -4)}-${phone.slice(-4)}` : phone;
    const q = await fetch(
      `${SB_URL}/rest/v1/town_users?select=username,name,nick,phone&or=(phone.eq.${phone},phone.eq.${dashed})&limit=1`,
      { headers: sbHeaders }
    );
    const rows = q.ok ? await q.json() : [];
    if (rows[0]) {
      member = { username: rows[0].username, name: rows[0].name, nick: rows[0].nick };
    } else if (nick) {
      const ins = await fetch(`${SB_URL}/rest/v1/town_users`, {
        method: "POST",
        headers: Object.assign({ Prefer: "return=representation" }, sbHeaders),
        body: JSON.stringify({
          username: `ph_${phone}`,
          pass_hash: crypto.randomBytes(24).toString("hex"), // 번호 인증 전용 회원 — 비밀번호 로그인 없음
          name: name || nick,
          phone,
          nick,
        }),
      });
      const created = ins.ok ? await ins.json() : [];
      if (created[0]) member = { username: created[0].username, name: created[0].name, nick: created[0].nick };
    }
  } catch (e) {}
  return json(200, { ok: true, member });
};
