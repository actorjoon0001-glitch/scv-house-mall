// 발송 서버(Netlify Function)의 실제 외부 IP 확인용 — 알리고 발송 IP 등록 진단
exports.handler = async () => {
  try {
    const r = await fetch("https://api.ipify.org?format=json");
    const d = await r.json();
    return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ip: d.ip }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: String(e) }) };
  }
};
