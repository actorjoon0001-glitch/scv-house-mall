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
  // 대표 전화번호 — 실제 번호를 넣으면 마을 집 카드에 "📞 전화 상담" 버튼이 활성화된다 (빈 값이면 숨김)
  const CONTACT_PHONE = "";
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

  // ---------- 체험존 포털 목록 (데이터 관리 — 관리자에서 라벨 변경·숨김·추가 가능) ----------
  // 마을에 흩뿌리지 않고 체험존 한 구역에만 모아 배치한다. href가 없으면 "준비 중" 자리표시.
  const DEFAULT_PORTALS = [
    { id: "build", icon: "🔨", label: "내 집 지어보기", href: "build.html", color: "#2fe08a" },
    { id: "learn", icon: "📚", label: "집짓기 교육관", href: "learn.html", color: "#6fb1ff" },
    { id: "vr", icon: "🕶️", label: "VR룸", href: "", soon: true, color: "#b7a7d9" },
  ];
  function portalsFor(ovData, includeHidden) {
    const ov = (ovData && ovData.portals) || {};
    const list = DEFAULT_PORTALS.map((p) => {
      const o = ov[p.id] || {};
      return Object.assign({}, p, {
        label: (o.label || p.label).slice(0, 16),
        hidden: !!o.hidden,
      });
    });
    (Array.isArray(ov.extra) ? ov.extra : []).forEach((e, i) => {
      if (!e || !e.label) return;
      list.push({
        id: "extra" + i,
        icon: (e.icon || "✨").slice(0, 4),
        label: String(e.label).slice(0, 16),
        href: String(e.href || "").slice(0, 120),
        soon: !e.href,
        hidden: !!e.hidden,
        color: /^#[0-9a-fA-F]{6}$/.test(e.color || "") ? e.color : "#8fd0a8",
      });
    });
    return includeHidden ? list : list.filter((p) => !p.hidden);
  }

  // ---------- 상담 리드 + 방문 이벤트 (전용 프로젝트 town_leads/town_events) ----------
  // 리드 조회는 RLS로 막고 get_leads(pass) RPC(관리자 비밀번호 확인)로만 연다.
  async function addLead(lead) {
    try {
      const r = await fetch(`${SETTINGS_URL}/rest/v1/town_leads`, {
        method: "POST",
        headers: Object.assign({ "Content-Type": "application/json" }, HEADERS),
        body: JSON.stringify({
          name: (lead.name || "").slice(0, 40),
          phone: (lead.phone || "").slice(0, 30),
          interest: (lead.interest || "").slice(0, 60),
          memo: (lead.memo || "").slice(0, 300),
          source: (lead.source || "").slice(0, 30),
        }),
      });
      return r.ok;
    } catch (e) { return false; }
  }
  const loggedEvents = new Set(); // 세션당 같은 이벤트 1회
  function logEvent(type, name) {
    const key = `${type}|${name || ""}`;
    if (loggedEvents.has(key)) return;
    loggedEvents.add(key);
    try {
      fetch(`${SETTINGS_URL}/rest/v1/town_events`, {
        method: "POST",
        headers: Object.assign({ "Content-Type": "application/json" }, HEADERS),
        body: JSON.stringify({ type: String(type).slice(0, 20), name: String(name || "").slice(0, 60) }),
        keepalive: true,
      }).catch(() => {});
    } catch (e) {}
  }
  async function getLeads(pass) {
    const r = await fetch(`${SETTINGS_URL}/rest/v1/rpc/get_leads`, {
      method: "POST",
      headers: Object.assign({ "Content-Type": "application/json" }, HEADERS),
      body: JSON.stringify({ pass: pass || "" }),
    });
    if (!r.ok) throw new Error("leads " + r.status);
    return r.json();
  }
  // ---------- 빌드룸: 손님이 만든 집 구성 저장 (시공사 발주용 원본 데이터) ----------
  async function addBuild(b) {
    try {
      const r = await fetch(`${SETTINGS_URL}/rest/v1/town_builds`, {
        method: "POST",
        headers: Object.assign({ "Content-Type": "application/json" }, HEADERS),
        body: JSON.stringify({
          name: (b.name || "").slice(0, 40),
          phone: (b.phone || "").slice(0, 30),
          area: Number(b.area) || 0,
          price: Number(b.price) || 0,
          config: b.config || {},
        }),
      });
      return r.ok;
    } catch (e) { return false; }
  }
  const getBuilds = (pass) => rpc("get_builds", { pass });

  // ---------- 회원 (게임식 가입: 아이디/비밀번호, 해시는 서버측 RPC에서 처리) ----------
  async function rpc(name, body) {
    const r = await fetch(`${SETTINGS_URL}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: Object.assign({ "Content-Type": "application/json" }, HEADERS),
      body: JSON.stringify(body || {}),
    });
    if (!r.ok) {
      let msg = "error";
      try { msg = (await r.json()).message || msg; } catch (e) {}
      const err = new Error(msg);
      err.status = r.status;
      throw err;
    }
    const txt = await r.text();
    return txt ? JSON.parse(txt) : null;
  }
  const authRegister = (d) =>
    rpc("town_register", { p_username: d.username, p_pass: d.pass, p_name: d.name, p_phone: d.phone, p_nick: d.nick });
  const authLogin = (username, pass) => rpc("town_login", { p_username: username, p_pass: pass });
  const authResetPass = (d) =>
    rpc("town_reset_pass", { p_username: d.username, p_name: d.name, p_phone: d.phone, p_new_pass: d.newPass });
  const authKakaoUpsert = (d) => rpc("town_kakao_upsert", { p_kid: d.kid, p_name: d.name, p_nick: d.nick });
  const getUsers = (pass) => rpc("get_users", { pass });

  // ---------- 계약 고객 시공 현황 (town_projects — 손님은 본인 것만 RPC로 조회) ----------
  // 시공 7단계 (진행바·사진첩 그룹 기준)
  const BUILD_STAGES = ["토목", "기초", "골조", "지붕/외장", "내부", "마감", "준공"];
  // 손님 조회: 폰 번호 + 닉네임 대조 (닉네임 미설정 프로젝트는 폰만) — 남의 현황은 못 봄
  const getMyProject = (phone, nick) => rpc("get_my_project", { p_phone: phone, p_nick: nick || "" });
  const addProjectInquiry = (phone, nick, text) => rpc("add_project_inquiry", { p_phone: phone, p_nick: nick || "", p_text: text });
  // 관리자: 비밀번호 확인 RPC
  const getProjects = (pass) => rpc("get_projects", { pass });
  const upsertProject = (pass, p) => rpc("upsert_project", { pass, p });
  const deleteProject = (pass, phone) => rpc("delete_project", { pass, p_phone: phone });
  // 현장 사진 업로드 (Supabase Storage 공개 버킷 site-photos, 파일명은 추측 불가한 랜덤)
  async function uploadSitePhoto(blob, phoneDigits) {
    const rand = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    const path = `${(phoneDigits || "misc").slice(-4)}-${rand}.jpg`;
    const r = await fetch(`${SETTINGS_URL}/storage/v1/object/site-photos/${path}`, {
      method: "POST",
      headers: Object.assign({ "Content-Type": "image/jpeg" }, HEADERS),
      body: blob,
    });
    if (!r.ok) {
      const err = new Error("upload failed");
      err.status = r.status;
      throw err;
    }
    return `${SETTINGS_URL}/storage/v1/object/public/site-photos/${path}`;
  }

  async function getEvents() {
    const r = await fetch(
      `${SETTINGS_URL}/rest/v1/town_events?select=type,name,created_at&order=created_at.desc&limit=2000`,
      { headers: HEADERS }
    );
    if (!r.ok) throw new Error("events " + r.status);
    return r.json();
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
        if (o.curator === "m" || o.curator === "f" || o.curator === "bot") c.curator = o.curator;
        return c;
      });
  }

  // ---------- 3D 외형(아키타입) 매핑 + 중복 외형 제거 (마을·관리자 지도 공유 규칙) ----------
  // 카탈로그 모델 수 > 3D 모델 수라서 같은 외형이 반복 배치되던 것을,
  // 존(카테고리)별로 같은 외형은 첫 모델 한 채만 마을에 세우도록 정리한다.
  // 랜딩 카탈로그(사진 목록)는 전체 유지.
  const HOUSE_GLBS = {
    "stay-19rb": "assets/houses/stay-19rb.glb",
    "stay24w": "assets/houses/stay24w.glb",
    "stay20r": "assets/houses/stay20r.glb",
    "stay18-b": "assets/houses/stay18-b.glb",
    "stay14": "assets/houses/stay14.glb",
    "cube9o": "assets/houses/cube9o.glb",
    "forest10g": "assets/houses/forest10g.glb",
    "forest10bb": "assets/houses/forest10bb.glb",
    "cube-g-10w": "assets/houses/cube-g-10w.glb",
  };
  const CAT_POOL = {
    "전원주택": ["stay-19rb", "stay24w", "stay20r", "stay18-b"],
    "세컨하우스": ["stay14", "stay-19rb", "stay24w"],
    "체류형 쉼터": ["cube9o", "forest10g", "forest10bb"],
    "특별모델": ["cube-g-10w", "cube9o"],
  };
  const DEFAULT_GLB = "assets/house-3d.glb";
  function archetypeFor(m, idxInCat) {
    if (m.slug && HOUSE_GLBS[m.slug]) return HOUSE_GLBS[m.slug];
    const pool = CAT_POOL[m.category];
    if (pool && pool.length) return HOUSE_GLBS[pool[idxInCat % pool.length]];
    return DEFAULT_GLB;
  }
  function dedupeForTown(models) {
    const usedByCat = {}; // 카테고리별 사용된 외형 URL
    const keptCount = {};
    return models.filter((m) => {
      const c = m.category || "_";
      const idx = keptCount[c] || 0;
      const url = archetypeFor(m, idx);
      if (!usedByCat[c]) usedByCat[c] = new Set();
      if (usedByCat[c].has(url)) return false; // 같은 존에 같은 외형 → 제외
      usedByCat[c].add(url);
      keptCount[c] = idx + 1;
      return true;
    });
  }

  // ---------- 배치 계산 (관리자 지도와 3D 마을이 공유하는 단일 규칙) ----------
  const ZONE_ORDER = ["전원주택", "세컨하우스", "체류형 쉼터", "특별모델", "LG가전 이벤트", "가구", "건축 자재"];
  // 파트너 존 앞줄(0~2번 칸)은 전시 부스 자리 — 모델 배치 불가
  const RESERVED_SLOTS = { "LG가전 이벤트": [0, 1, 2], "가구": [0, 1, 2], "건축 자재": [0, 1, 2] };
  const keyOf = (m) => m.slug || m.name;
  // 명시 배치(overrides.placement[slug] = {zone,index,rot})를 먼저 고정하고,
  // 나머지는 (존 이동 반영된) 카탈로그 순서대로 빈 칸을 채운다.
  function computePlacement(models, ov) {
    const pov = (ov && ov.placement) || {};
    const booths = (ov && ov.boothSlots) || {}; // "존|칸번호" → {status, company} 부스 계약 칸
    const zoneOf = (m) => {
      const p = pov[keyOf(m)];
      if (p && ZONE_ORDER.includes(p.zone)) return p.zone;
      return ZONE_ORDER.includes(m.category) ? m.category : "특별모델";
    };
    const used = {};
    const reservedOf = (z) => {
      if (!used[z]) {
        used[z] = new Set(RESERVED_SLOTS[z] || []);
        // 부스로 지정된 칸(모집중·계약)은 모델 배치에서 제외
        Object.keys(booths).forEach((k) => {
          const sep = k.lastIndexOf("|");
          if (k.slice(0, sep) === z) used[z].add(Number(k.slice(sep + 1)));
        });
      }
      return used[z];
    };
    const out = {};
    models.forEach((m) => {
      const p = pov[keyOf(m)];
      if (!p || p.index == null) return;
      const z = zoneOf(m);
      reservedOf(z);
      if (!used[z].has(p.index)) {
        used[z].add(p.index);
        out[keyOf(m)] = { zone: z, index: p.index, rot: p.rot || 0 };
      }
    });
    models.forEach((m) => {
      const k = keyOf(m);
      if (out[k]) return;
      const z = zoneOf(m);
      reservedOf(z);
      let i = 0;
      while (used[z].has(i)) i++;
      used[z].add(i);
      out[k] = { zone: z, index: i, rot: (pov[k] && pov[k].rot) || 0 };
    });
    return out;
  }

  window.SeumTownConfig = {
    load, save, apply, computePlacement, keyOf, ZONE_ORDER, RESERVED_SLOTS, SB_URL, SB_KEY,
    addLead, logEvent, getLeads, getEvents,
    authRegister, authLogin, authResetPass, authKakaoUpsert, getUsers,
    addBuild, getBuilds,
    HOUSE_GLBS, CAT_POOL, DEFAULT_GLB, archetypeFor, dedupeForTown,
    DEFAULT_PORTALS, portalsFor,
    BUILD_STAGES, getMyProject, addProjectInquiry, getProjects, upsertProject, deleteProject, uploadSitePhoto,
    CONTACT_PHONE, SETTINGS_URL, SETTINGS_KEY,
  };
})();
