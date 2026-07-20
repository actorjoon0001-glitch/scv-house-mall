// ============ 마을 표시 설정 (관리자 오버라이드) ============
// 카탈로그 원본은 건드리지 않고, 마을/랜딩 "표시용" 설정만 별도 저장한다.
// 저장소: Supabase town_settings 테이블 (없으면 localStorage 폴백).
(function () {
  // 카탈로그(모델 원본) 읽기용 — 기존 카탈로그 프로젝트
  const SB_URL = "https://aypugjvzvwinnmpquguj.supabase.co";
  const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5cHVnanZ6dndpbm5tcHF1Z3VqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1NjQ0ODIsImV4cCI6MjA4OTE0MDQ4Mn0.yLBG31-8VGWai9Rpv9RtVxZwwWMsKI_syGs0QN7PkUU";
  // 마을 표시 설정 저장용 — 전용 프로젝트 (scv-3Dhouse)
  const SETTINGS_URL = "https://zjbaeoqvzbkdctwcrgfd.supabase.co";
  const SETTINGS_KEY = "sb_publishable_k_gQuXbUVRwmFnfCzNGmMg_UvLhesnZ";
  const LS_KEY = "seum_town_overrides";
  const HEADERS = { apikey: SETTINGS_KEY, Authorization: `Bearer ${SETTINGS_KEY}` };

  async function load() {
    try {
      const r = await fetch(`${SETTINGS_URL}/rest/v1/town_settings?id=eq.main&select=data`, { headers: HEADERS });
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
      const r = await fetch(`${SETTINGS_URL}/rest/v1/town_settings`, {
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

  // ---------- 배치 계산 (관리자 지도와 3D 마을이 공유하는 단일 규칙) ----------
  const ZONE_ORDER = ["전원주택", "세컨하우스", "체류형 쉼터", "특별모델"];
  const keyOf = (m) => m.slug || m.name;
  // 명시 배치(overrides.placement[slug] = {zone,index,rot})를 먼저 고정하고,
  // 나머지는 (존 이동 반영된) 카탈로그 순서대로 빈 칸을 채운다.
  function computePlacement(models, ov) {
    const pov = (ov && ov.placement) || {};
    const zoneOf = (m) => {
      const p = pov[keyOf(m)];
      if (p && ZONE_ORDER.includes(p.zone)) return p.zone;
      return ZONE_ORDER.includes(m.category) ? m.category : "특별모델";
    };
    const used = {};
    const out = {};
    models.forEach((m) => {
      const p = pov[keyOf(m)];
      if (!p || p.index == null) return;
      const z = zoneOf(m);
      used[z] = used[z] || new Set();
      if (!used[z].has(p.index)) {
        used[z].add(p.index);
        out[keyOf(m)] = { zone: z, index: p.index, rot: p.rot || 0 };
      }
    });
    models.forEach((m) => {
      const k = keyOf(m);
      if (out[k]) return;
      const z = zoneOf(m);
      used[z] = used[z] || new Set();
      let i = 0;
      while (used[z].has(i)) i++;
      used[z].add(i);
      out[k] = { zone: z, index: i, rot: (pov[k] && pov[k].rot) || 0 };
    });
    return out;
  }

  window.SeumTownConfig = { load, save, apply, computePlacement, keyOf, ZONE_ORDER, SB_URL, SB_KEY };
})();
