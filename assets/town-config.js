// ============ 마을 표시 설정 (관리자 오버라이드) ============
// 카탈로그 원본은 건드리지 않고, 마을/랜딩 "표시용" 설정만 별도 저장한다.
// 저장소: Supabase town_settings 테이블 (없으면 localStorage 폴백).
(function () {
  const SB_URL = "https://aypugjvzvwinnmpquguj.supabase.co";
  const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5cHVnanZ6dndpbm5tcHF1Z3VqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1NjQ0ODIsImV4cCI6MjA4OTE0MDQ4Mn0.yLBG31-8VGWai9Rpv9RtVxZwwWMsKI_syGs0QN7PkUU";
  const LS_KEY = "seum_town_overrides";
  const HEADERS = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` };

  async function load() {
    try {
      const r = await fetch(`${SB_URL}/rest/v1/town_settings?id=eq.main&select=data`, { headers: HEADERS });
      if (!r.ok) throw new Error("no table");
      const rows = await r.json();
      return { source: "supabase", data: (rows[0] && rows[0].data) || {} };
    } catch (e) {
      try {
        return { source: "local", data: JSON.parse(localStorage.getItem(LS_KEY) || "{}") };
      } catch (e2) {
        return { source: "local", data: {} };
      }
    }
  }

  async function save(data) {
    try {
      const r = await fetch(`${SB_URL}/rest/v1/town_settings`, {
        method: "POST",
        headers: Object.assign({ "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" }, HEADERS),
        body: JSON.stringify({ id: "main", data }),
      });
      if (!r.ok) throw new Error("write failed");
      try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch (e) {}
      return "supabase";
    } catch (e) {
      try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch (e2) {}
      return "local";
    }
  }

  // 카탈로그 모델 목록에 표시 설정을 병합 (숨김 제외, 필드 오버라이드)
  function apply(models, ov) {
    const mo = (ov && ov.models) || {};
    return models
      .filter((m) => !(mo[m.slug] && mo[m.slug].hidden))
      .map((m) => {
        const o = mo[m.slug];
        if (!o) return m;
        const c = Object.assign({}, m);
        if (o.name) c.name = o.name;
        if (o.price != null && o.price !== "") c.base_price = Math.round(Number(o.price) * 1e4); // 만원 단위
        if (o.size) c.size = o.size;
        if (o.desc) c.short_description = o.desc;
        if (o.image) c.main_image = o.image;
        if (o.zone) c.category = o.zone;
        if (o.curator === "m" || o.curator === "f") c.curator = o.curator;
        return c;
      });
  }

  window.SeumTownConfig = { load, save, apply, SB_URL, SB_KEY };
})();
