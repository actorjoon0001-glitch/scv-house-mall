// ============ 메타하우스 관리자 (1단계: 모델 표시 설정 · 2단계: 배치 지도) ============
(function () {
  const CFG = window.SeumTownConfig;
  const ZONES = ["전원주택", "세컨하우스", "체류형 쉼터", "특별모델", "LG가전 이벤트", "가구", "건축 자재"];
  // 지도 표시용 존 메타 (마을과 동일한 블록 배치, 북쪽이 위 / 아래 3개는 바깥 파트너 블록)
  const MAP_ZONES = [
    { key: "전원주택", emoji: "🏡", color: "#7d9471" },   // 북서
    { key: "체류형 쉼터", emoji: "🌿", color: "#b3a284" }, // 북동
    { key: "세컨하우스", emoji: "🏠", color: "#87a0ad" },  // 남서
    { key: "특별모델", emoji: "⛳", color: "#9a8fa6" },    // 남동
    { key: "건축 자재", emoji: "🧱", color: "#8b959c" },   // 북서 바깥
    { key: "LG가전 이벤트", emoji: "📺", color: "#9c5a63" }, // 북동 바깥
    { key: "가구", emoji: "🛋️", color: "#b08a66" },       // 남동 바깥
  ];
  const ROT_ARROW = { 0: "↓", 90: "→", 180: "↑", 270: "←" };
  // 파트너 존 부스 기본 이름 (town.js PARTNER_BOOTHS와 동일)
  const DEFAULT_BOOTHS = {
    "LG가전 이벤트": ["📺 LG 가전 체험관", "🎉 이벤트 특가관", "🏠 스마트홈관"],
    "가구": ["🛋️ 리빙 가구관", "🌤️ 아웃도어 가구관", "🤝 입점 문의"],
    "건축 자재": ["🪟 단열·창호관", "🧱 마감재관", "🤝 입점 문의"],
  };
  // 관리자 비밀번호(SHA-256). 변경하려면 새 비밀번호의 sha256 hex로 교체.
  const PASS_HASH = "55d1e430cb1d46e334d643153b69ba7b996ce912a0c6f2d54d4c1769b9dea609";

  const gate = document.getElementById("gate");
  const app = document.getElementById("app");
  const gatePass = document.getElementById("gate-pass");
  const gateBtn = document.getElementById("gate-btn");
  const gateErr = document.getElementById("gate-err");
  const rowsEl = document.getElementById("rows");
  const statusEl = document.getElementById("store-status");
  const savedMsg = document.getElementById("saved-msg");
  const sqlbox = document.getElementById("sqlbox");

  let catalog = [];
  let overrides = { models: {} };
  let storeSource = "local";

  async function sha256(s) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  async function tryLogin() {
    const h = await sha256(gatePass.value || "");
    if (h === PASS_HASH) {
      try {
        sessionStorage.setItem("seum_admin_ok", "1");
        sessionStorage.setItem("seum_admin_pw", gatePass.value); // 리드 조회 RPC 인증에 사용
      } catch (e) {}
      gate.hidden = true;
      app.hidden = false;
      boot();
    } else {
      gateErr.textContent = "비밀번호가 올바르지 않습니다.";
    }
  }
  gateBtn.addEventListener("click", tryLogin);
  gatePass.addEventListener("keydown", (e) => { if (e.key === "Enter") tryLogin(); });
  try {
    if (sessionStorage.getItem("seum_admin_ok") === "1") {
      gate.hidden = true;
      app.hidden = false;
      boot();
    }
  } catch (e) {}

  function setStatus(src) {
    storeSource = src;
    if (src === "supabase") {
      statusEl.textContent = "Supabase 연동됨 (모든 기기 반영)";
      statusEl.className = "status status--sb";
      sqlbox.style.display = "none";
    } else {
      statusEl.textContent = "로컬 저장 (이 브라우저만)";
      statusEl.className = "status status--local";
      sqlbox.style.display = "block";
      sqlbox.textContent =
        "-- 모든 기기/손님에게 반영하려면 Supabase SQL Editor에서 아래를 한 번 실행하세요:\n" +
        "create table if not exists town_settings (\n" +
        "  id text primary key,\n" +
        "  data jsonb not null default '{}'::jsonb,\n" +
        "  updated_at timestamptz default now()\n" +
        ");\n" +
        "alter table town_settings enable row level security;\n" +
        "create policy \"town settings read\" on town_settings for select using (true);\n" +
        "create policy \"town settings insert\" on town_settings for insert with check (true);\n" +
        "create policy \"town settings update\" on town_settings for update using (true);";
    }
  }

  function ov(slug) {
    if (!overrides.models[slug]) overrides.models[slug] = {};
    return overrides.models[slug];
  }
  function cleanOv(slug) {
    const o = overrides.models[slug];
    if (o && Object.keys(o).every((k) => o[k] === "" || o[k] == null || o[k] === false)) {
      delete overrides.models[slug];
    }
  }

  // 존 표시 이름 (존 관리에서 바꾼 이름을 관리자 UI 전체에 반영; 키는 내부 식별자로 유지)
  function zoneLabelOf(key) {
    const o = overrides.zones && overrides.zones[key];
    return (o && o.label) || `${key} 존`;
  }
  function zoneShort(key) {
    return zoneLabelOf(key).replace(/\s*존$/, "");
  }

  // ---- 존 탭 필터: 목록을 존별로 나눠서 보기 ----
  let zoneFilter = "all";
  // 모델의 실제 소속 존 (관리자 존 오버라이드 반영, 미지정 카테고리는 특별모델)
  function effZone(m) {
    const o = overrides.models[m.slug];
    const z = (o && o.zone) || m.category;
    return ZONES.includes(z) ? z : "특별모델";
  }
  function renderTabs() {
    const tabsEl = document.getElementById("zone-tabs");
    if (!tabsEl) return;
    const counts = {};
    catalog.forEach((m) => { const z = effZone(m); counts[z] = (counts[z] || 0) + 1; });
    const mk = (key, label) =>
      `<button type="button" class="tab${zoneFilter === key ? " is-active" : ""}" data-zf="${esc(key)}">${esc(label)}</button>`;
    tabsEl.innerHTML =
      mk("all", `전체 ${catalog.length}`) +
      ZONES.map((z) => mk(z, `${zoneShort(z)} ${counts[z] || 0}`)).join("");
    tabsEl.querySelectorAll(".tab").forEach((b) =>
      b.addEventListener("click", () => {
        zoneFilter = b.dataset.zf;
        renderTabs();
        render();
      })
    );
  }

  function render() {
    rowsEl.innerHTML = "";
    catalog.forEach((m) => {
      if (zoneFilter !== "all" && effZone(m) !== zoneFilter) return;
      const o = overrides.models[m.slug] || {};
      const tr = document.createElement("tr");
      if (o.hidden) tr.classList.add("is-hidden-row");
      tr.innerHTML = `
        <td><input type="checkbox" ${o.hidden ? "" : "checked"} data-f="show" /></td>
        <td><img class="thumb" src="${o.image || m.main_image || ""}" alt="" loading="lazy" /></td>
        <td><input type="text" data-f="name" placeholder="${esc(m.name)}" value="${esc(o.name || "")}" /></td>
        <td><input type="number" class="num" data-f="price" placeholder="${m.base_price ? Math.round(m.base_price / 1e4) : ""}" value="${o.price != null ? o.price : ""}" /></td>
        <td><input type="text" class="num" data-f="size" placeholder="${esc(m.size || "")}" value="${esc(o.size || "")}" /></td>
        <td><select data-f="zone">
          <option value="">원본 (${esc(m.category || "미지정")})</option>
          ${ZONES.map((z) => `<option value="${z}" ${o.zone === z ? "selected" : ""}>${zoneShort(z)}</option>`).join("")}
        </select></td>
        <td><select data-f="curator">
          <option value="">자동 (여/남 교차)</option>
          <option value="f" ${o.curator === "f" ? "selected" : ""}>수아 큐레이터 (여)</option>
          <option value="m" ${o.curator === "m" ? "selected" : ""}>준 큐레이터 (남)</option>
          <option value="bot" ${o.curator === "bot" ? "selected" : ""}>메타봇 (로봇)</option>
        </select></td>
        <td><input type="text" data-f="desc" placeholder="${esc((m.short_description || "").slice(0, 30))}" value="${esc(o.desc || "")}" /></td>
        <td><input type="text" data-f="image" placeholder="원본 사진 사용" value="${esc(o.image || "")}" /></td>`;
      tr.querySelectorAll("[data-f]").forEach((el) => {
        el.addEventListener("input", () => onEdit(m.slug, el, tr));
        el.addEventListener("change", () => onEdit(m.slug, el, tr));
      });
      rowsEl.appendChild(tr);
    });
  }

  function onEdit(slug, el, tr) {
    const f = el.dataset.f;
    const o = ov(slug);
    if (f === "show") {
      if (el.checked) delete o.hidden;
      else o.hidden = true;
      tr.classList.toggle("is-hidden-row", !!o.hidden);
    } else {
      const v = el.value.trim();
      if (v === "") delete o[f];
      else o[f] = f === "price" ? Number(v) : v;
    }
    cleanOv(slug);
    savedMsg.textContent = "변경됨 (저장 필요)";
    savedMsg.style.color = "#f0c674";
    if (f === "show" || f === "zone" || f === "name") { renderMap(); renderTabs(); } // 지도·탭에 영향 주는 필드
  }

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // ---------- 2단계: 배치 지도 (마을과 동일한 computePlacement 규칙 공유) ----------
  const mapEl = document.getElementById("mapwrap");
  const mapSelMsg = document.getElementById("map-sel");
  const rotBtn = document.getElementById("rot-btn");
  const unpinBtn = document.getElementById("unpin-btn");
  const resetPlaceBtn = document.getElementById("resetplace-btn");
  let selKey = null;

  // ---------- 부스 관리 모드 (박람회식 부스 분양: 빈 칸 → 모집중/계약) ----------
  let boothMode = false;
  let selBooth = null; // { zone, idx }
  const bkey = (zone, idx) => `${zone}|${idx}`;
  function boothOf(zone, idx) {
    return overrides.boothSlots ? overrides.boothSlots[bkey(zone, idx)] : null;
  }
  function setBooth(zone, idx, val) {
    if (!overrides.boothSlots) overrides.boothSlots = {};
    if (val) overrides.boothSlots[bkey(zone, idx)] = val;
    else delete overrides.boothSlots[bkey(zone, idx)];
    if (!Object.keys(overrides.boothSlots).length) delete overrides.boothSlots;
    markDirty();
  }
  function setSelBooth(sb) {
    selBooth = sb;
    const has = !!sb;
    ["booth-open-btn", "booth-company-btn", "booth-clear-btn"].forEach((id) => {
      const b = document.getElementById(id);
      if (b) b.disabled = !has;
    });
    renderMap();
  }

  function markDirty() {
    savedMsg.textContent = "변경됨 (저장 필요)";
    savedMsg.style.color = "#f0c674";
  }
  // 마을에 실제 보이는 모델(숨김 제외 + 존 오버라이드 + 중복 외형 제거) — town.js와 동일 입력
  function effModels() {
    const applied = CFG.apply(catalog, overrides);
    return CFG.dedupeForTown ? CFG.dedupeForTown(applied) : applied;
  }
  function currentPlan() {
    return CFG.computePlacement(effModels(), overrides);
  }
  function pin(k, patch) {
    if (!overrides.placement) overrides.placement = {};
    overrides.placement[k] = Object.assign({}, overrides.placement[k], patch);
    markDirty();
  }
  function planEntries(plan) {
    const models = effModels();
    const byKey = {};
    models.forEach((m) => (byKey[CFG.keyOf(m)] = m));
    return { plan, byKey };
  }
  function setSel(k) {
    selKey = k;
    rotBtn.disabled = !k;
    unpinBtn.disabled = !k;
    mapSelMsg.textContent = k ? `선택: ${dispName(k)} — 이동할 칸을 클릭하세요` : "선택된 집 없음";
    renderMap();
  }
  function dispName(k) {
    const m = effModels().find((x) => CFG.keyOf(x) === k);
    return m ? m.name : k;
  }
  function moveTo(k, zone, index) {
    const plan = currentPlan();
    const cur = plan[k];
    if (!cur) return;
    if (cur.zone === zone && cur.index === index) return setSel(null);
    // 대상 칸에 이미 집이 있으면 서로 자리 교체
    const occ = Object.keys(plan).find((k2) => k2 !== k && plan[k2].zone === zone && plan[k2].index === index);
    if (occ) pin(occ, { zone: cur.zone, index: cur.index, rot: plan[occ].rot || 0 });
    pin(k, { zone, index, rot: cur.rot || 0 });
    setSel(null);
  }

  function renderMap() {
    if (!mapEl || !CFG.computePlacement) return;
    const { plan, byKey } = planEntries(currentPlan());
    mapEl.innerHTML = "";
    MAP_ZONES.forEach((mz) => {
      const inZone = Object.keys(plan).filter((k) => plan[k].zone === mz.key);
      const maxIdx = inZone.reduce((a, k) => Math.max(a, plan[k].index), -1);
      const rows = Math.max(3, Math.ceil((maxIdx + 2) / 3) + 1); // 여유 한 줄 (북쪽 확장)
      const zc = (overrides.zones && overrides.zones[mz.key] && overrides.zones[mz.key].color) || mz.color;
      const zoneEl = document.createElement("div");
      zoneEl.className = "map-zone";
      // 실제 마을 지형과 같은 자리에 배치 (게임 화면과 1:1 일치)
      const AREA = { "건축 자재": "za", "전원주택": "nw", "체류형 쉼터": "ne", "LG가전 이벤트": "zb", "세컨하우스": "sw", "특별모델": "se", "가구": "zc" };
      zoneEl.style.gridArea = AREA[mz.key] || "auto";
      zoneEl.style.borderColor = zc;
      zoneEl.innerHTML = `<h3 style="color:${zc}">${mz.emoji} ${esc(zoneLabelOf(mz.key))} · ${inZone.length}개</h3>`;
      const gridEl = document.createElement("div");
      gridEl.className = "map-grid";
      // 줄은 북쪽(위)부터: index가 큰 줄이 위, 0~2번 줄(통로 쪽)이 아래
      for (let r = rows - 1; r >= 0; r--) {
        for (let c = 0; c < 3; c++) {
          const idx = r * 3 + c;
          const cell = document.createElement("div");
          cell.className = "map-cell";
          cell.dataset.zone = mz.key;
          cell.dataset.index = idx;
          // 파트너 부스 예약 칸: 모델 배치 불가
          const reserved = (CFG.RESERVED_SLOTS && CFG.RESERVED_SLOTS[mz.key] || []).includes(idx);
          if (reserved) {
            cell.style.cursor = "default";
            const chip = document.createElement("div");
            chip.className = "map-chip";
            chip.style.opacity = "0.55";
            chip.innerHTML = `<span class="rot">🤝</span><span class="nm">파트너 부스</span>`;
            cell.appendChild(chip);
            gridEl.appendChild(cell);
            continue;
          }
          // 관리자 지정 부스 칸 (모집중/계약 업체) — 모든 존에서 가능
          const booth = boothOf(mz.key, idx);
          if (booth) {
            const chip = document.createElement("div");
            const isSelB = selBooth && selBooth.zone === mz.key && selBooth.idx === idx;
            chip.className = "map-chip is-booth" + (booth.company ? " is-booked" : "") + (isSelB ? " is-sel" : "");
            chip.innerHTML = booth.company
              ? `<span class="rot">🏢</span><span class="nm">${esc(booth.company)}</span>`
              : `<span class="rot">🟡</span><span class="nm">입점 모집</span>`;
            chip.addEventListener("click", (e) => {
              e.stopPropagation();
              if (boothMode) setSelBooth(isSelB ? null : { zone: mz.key, idx });
            });
            cell.appendChild(chip);
            gridEl.appendChild(cell);
            continue;
          }
          const k = inZone.find((k2) => plan[k2].index === idx);
          if (k) {
            const m = byKey[k];
            const pinned = overrides.placement && overrides.placement[k] && overrides.placement[k].index != null;
            const chip = document.createElement("div");
            chip.className = "map-chip" + (k === selKey ? " is-sel" : "") + (pinned ? " is-pin" : "");
            chip.draggable = !boothMode;
            chip.innerHTML = `<span class="rot">${ROT_ARROW[plan[k].rot || 0] || "↓"}</span><span class="nm">${esc((m && m.name) || k)}</span>`;
            chip.addEventListener("click", (e) => {
              e.stopPropagation();
              if (!boothMode) setSel(k === selKey ? null : k);
            });
            chip.addEventListener("dragstart", (e) => {
              e.dataTransfer.setData("text/plain", k);
              setSel(k);
            });
            cell.appendChild(chip);
          }
          if (!boothMode && selKey && selKey !== k) cell.classList.add("is-target");
          if (boothMode && !k && selBooth && selBooth.zone === mz.key && selBooth.idx === idx) cell.classList.add("is-boothsel");
          cell.addEventListener("click", () => {
            if (boothMode) {
              if (!k) setSelBooth({ zone: mz.key, idx }); // 빈 칸만 부스 지정 가능
            } else if (selKey) moveTo(selKey, mz.key, idx);
          });
          cell.addEventListener("dragover", (e) => e.preventDefault());
          cell.addEventListener("drop", (e) => {
            e.preventDefault();
            const dk = e.dataTransfer.getData("text/plain");
            if (dk) moveTo(dk, mz.key, idx);
          });
          gridEl.appendChild(cell);
        }
      }
      zoneEl.appendChild(gridEl);
      mapEl.appendChild(zoneEl);
    });
  }

  // ---------- 3단계: 존 관리 (표시 이름·색상·부스명) ----------
  function renderZones() {
    const panel = document.getElementById("zones-panel");
    if (!panel) return;
    const zov = overrides.zones || {};
    const bov = overrides.booths || {};
    panel.innerHTML = "";
    MAP_ZONES.forEach((mz) => {
      const o = zov[mz.key] || {};
      const color = o.color || mz.color;
      const card = document.createElement("div");
      card.className = "zone-card";
      card.style.borderLeftColor = color;
      const boothRows = DEFAULT_BOOTHS[mz.key]
        ? DEFAULT_BOOTHS[mz.key]
            .map((def, i) => {
              const v = (bov[mz.key] && bov[mz.key][i]) || "";
              return `<div class="row"><label>부스 ${i + 1}</label><input type="text" data-booth="${i}" maxlength="20" placeholder="${esc(def)}" value="${esc(v)}" /></div>`;
            })
            .join("")
        : "";
      card.innerHTML = `
        <h3 style="color:${color}">${mz.emoji} ${esc(zoneLabelOf(mz.key))}${o.label ? ` <small style="color:#889">(원래: ${esc(mz.key)})</small>` : ""}</h3>
        <div class="row"><label>표시 이름</label><input type="text" data-zf="label" maxlength="20" placeholder="${esc(mz.key)} 존" value="${esc(o.label || "")}" /></div>
        <div class="row"><label>존 색상</label><input type="color" data-zf="color" value="${color}" />
          <button type="button" class="btn btn--ghost" data-zf="reset" style="padding:6px 12px;font-size:12px">기본색</button></div>
        ${boothRows}`;
      const setZ = (patch) => {
        if (!overrides.zones) overrides.zones = {};
        overrides.zones[mz.key] = Object.assign({}, overrides.zones[mz.key], patch);
        Object.keys(overrides.zones[mz.key]).forEach((k) => {
          if (!overrides.zones[mz.key][k]) delete overrides.zones[mz.key][k];
        });
        if (!Object.keys(overrides.zones[mz.key]).length) delete overrides.zones[mz.key];
        markDirty();
      };
      card.querySelector('[data-zf="label"]').addEventListener("change", (e) => {
        setZ({ label: e.target.value.trim() });
        renderZones();
        renderTabs();
        renderMap();
      });
      card.querySelector('[data-zf="label"]').addEventListener("input", (e) => setZ({ label: e.target.value.trim() }));
      card.querySelector('[data-zf="color"]').addEventListener("change", (e) => {
        setZ({ color: e.target.value });
        renderZones();
        renderMap();
      });
      card.querySelector('[data-zf="reset"]').addEventListener("click", () => {
        setZ({ color: "" });
        renderZones();
        renderMap();
      });
      card.querySelectorAll("[data-booth]").forEach((inp) =>
        inp.addEventListener("input", () => {
          if (!overrides.booths) overrides.booths = {};
          const arr = overrides.booths[mz.key] || ["", "", ""];
          arr[Number(inp.dataset.booth)] = inp.value.trim();
          overrides.booths[mz.key] = arr;
          if (arr.every((v) => !v)) delete overrides.booths[mz.key];
          markDirty();
        })
      );
      panel.appendChild(card);
    });
  }

  // 부스 관리 모드 토글 + 상태 버튼
  {
    const modeBtn = document.getElementById("booth-mode-btn");
    const boothBar = document.getElementById("booth-bar");
    if (modeBtn && boothBar) {
      modeBtn.addEventListener("click", () => {
        boothMode = !boothMode;
        boothBar.hidden = !boothMode;
        modeBtn.textContent = boothMode ? "✅ 부스 관리 종료" : "🏢 부스 관리 모드";
        setSel(null);
        setSelBooth(null);
        mapSelMsg.textContent = boothMode ? "부스 관리 중 — 아래 지도에서 빈 칸을 클릭하세요" : "선택된 집 없음";
      });
      document.getElementById("booth-open-btn").addEventListener("click", () => {
        if (!selBooth) return;
        setBooth(selBooth.zone, selBooth.idx, { status: "open" });
        setSelBooth(null);
      });
      document.getElementById("booth-company-btn").addEventListener("click", () => {
        if (!selBooth) return;
        const cur = boothOf(selBooth.zone, selBooth.idx);
        const name = prompt("계약 업체명을 입력하세요 (16자 이내)", (cur && cur.company) || "");
        if (name === null) return;
        setBooth(selBooth.zone, selBooth.idx, name.trim() ? { status: "booked", company: name.trim().slice(0, 16) } : { status: "open" });
        setSelBooth(null);
      });
      document.getElementById("booth-clear-btn").addEventListener("click", () => {
        if (!selBooth) return;
        setBooth(selBooth.zone, selBooth.idx, null);
        setSelBooth(null);
      });
    }
  }

  if (rotBtn) {
    rotBtn.addEventListener("click", () => {
      if (!selKey) return;
      const plan = currentPlan();
      const cur = plan[selKey] || { rot: 0 };
      pin(selKey, { rot: ((cur.rot || 0) + 90) % 360 });
      renderMap();
      mapSelMsg.textContent = `선택: ${dispName(selKey)} — 정면 ${ROT_ARROW[(((currentPlan()[selKey] || {}).rot) || 0)]}`;
    });
    unpinBtn.addEventListener("click", () => {
      if (!selKey) return;
      if (overrides.placement) delete overrides.placement[selKey];
      markDirty();
      setSel(null);
    });
    resetPlaceBtn.addEventListener("click", () => {
      overrides.placement = {};
      markDirty();
      setSel(null);
    });
  }

  async function boot() {
    // 카탈로그 원본 (숨김 여부와 무관하게 전체)
    try {
      const r = await fetch(
        `${CFG.SB_URL}/rest/v1/models?select=slug,name,category,size,base_price,main_image,short_description&order=created_at.asc`,
        { headers: { apikey: CFG.SB_KEY, Authorization: `Bearer ${CFG.SB_KEY}` } }
      );
      catalog = (await r.json()).filter((m) => m.slug && m.name);
    } catch (e) {
      catalog = [];
    }
    const loaded = await CFG.load();
    overrides = Object.assign({ models: {} }, loaded.data);
    if (!overrides.models) overrides.models = {};
    setStatus(loaded.source);
    renderTabs();
    render();
    renderMap();
    renderZones();
    renderPartners();
    renderSummary();
    loadDash();
  }

  // ---------- 방문 통계 · 상담 리드 대시보드 ----------
  const DASH_SQL =
    "-- 리드·통계 저장용. Supabase(scv-3Dhouse) SQL Editor에서 한 번 실행하세요:\n" +
    "create table if not exists town_leads (\n" +
    "  id bigint generated always as identity primary key,\n" +
    "  created_at timestamptz default now(),\n" +
    "  name text, phone text, interest text, memo text, source text\n" +
    ");\n" +
    "alter table town_leads enable row level security;\n" +
    "create policy \"leads insert\" on town_leads for insert with check (true);\n\n" +
    "create table if not exists town_events (\n" +
    "  id bigint generated always as identity primary key,\n" +
    "  created_at timestamptz default now(),\n" +
    "  type text, name text\n" +
    ");\n" +
    "alter table town_events enable row level security;\n" +
    "create policy \"events insert\" on town_events for insert with check (true);\n" +
    "create policy \"events read\" on town_events for select using (true);\n\n" +
    "create or replace function get_leads(pass text)\n" +
    "returns setof town_leads language plpgsql security definer set search_path = public as $$\n" +
    "begin\n" +
    "  if pass is distinct from '931122' then raise exception 'unauthorized'; end if;\n" +
    "  return query select * from town_leads order by created_at desc limit 500;\n" +
    "end $$;\n\n" +
    "-- 회원 (게임식 가입: 아이디/비밀번호)\n" +
    "create extension if not exists pgcrypto;\n" +
    "create table if not exists town_users (\n" +
    "  id bigint generated always as identity primary key,\n" +
    "  created_at timestamptz default now(),\n" +
    "  username text unique not null,\n" +
    "  pass_hash text not null,\n" +
    "  name text not null, phone text not null, nick text not null\n" +
    ");\n" +
    "alter table town_users enable row level security;\n\n" +
    "create or replace function town_register(p_username text, p_pass text, p_name text, p_phone text, p_nick text)\n" +
    "returns json language plpgsql security definer set search_path = public, extensions as $$\n" +
    "declare u town_users;\n" +
    "begin\n" +
    "  if length(trim(p_username)) < 4 then raise exception 'bad_username'; end if;\n" +
    "  if length(p_pass) < 4 then raise exception 'bad_password'; end if;\n" +
    "  insert into town_users (username, pass_hash, name, phone, nick)\n" +
    "  values (lower(trim(p_username)), crypt(p_pass, gen_salt('bf')), trim(p_name), trim(p_phone), trim(p_nick))\n" +
    "  returning * into u;\n" +
    "  return json_build_object('username', u.username, 'name', u.name, 'nick', u.nick);\n" +
    "exception when unique_violation then\n" +
    "  raise exception 'username_taken';\n" +
    "end $$;\n\n" +
    "create or replace function town_login(p_username text, p_pass text)\n" +
    "returns json language plpgsql security definer set search_path = public, extensions as $$\n" +
    "declare u town_users;\n" +
    "begin\n" +
    "  select * into u from town_users where username = lower(trim(p_username));\n" +
    "  if u.id is null or u.pass_hash <> crypt(p_pass, u.pass_hash) then\n" +
    "    raise exception 'invalid_login';\n" +
    "  end if;\n" +
    "  return json_build_object('username', u.username, 'name', u.name, 'nick', u.nick);\n" +
    "end $$;\n\n" +
    "create or replace function town_reset_pass(p_username text, p_name text, p_phone text, p_new_pass text)\n" +
    "returns json language plpgsql security definer set search_path = public, extensions as $$\n" +
    "declare u town_users;\n" +
    "begin\n" +
    "  if length(p_new_pass) < 4 then raise exception 'bad_password'; end if;\n" +
    "  select * into u from town_users where username = lower(trim(p_username));\n" +
    "  if u.id is null or trim(u.name) <> trim(p_name)\n" +
    "     or regexp_replace(u.phone,'[^0-9]','','g') <> regexp_replace(p_phone,'[^0-9]','','g') then\n" +
    "    raise exception 'no_match';\n" +
    "  end if;\n" +
    "  update town_users set pass_hash = crypt(p_new_pass, gen_salt('bf')) where id = u.id;\n" +
    "  return json_build_object('ok', true);\n" +
    "end $$;\n\n" +
    "create or replace function town_kakao_upsert(p_kid text, p_name text, p_nick text)\n" +
    "returns json language plpgsql security definer set search_path = public, extensions as $$\n" +
    "declare u town_users; uname text;\n" +
    "begin\n" +
    "  uname := 'kakao_' || left(regexp_replace(p_kid, '[^a-zA-Z0-9]', '', 'g'), 12);\n" +
    "  select * into u from town_users where username = uname;\n" +
    "  if u.id is null then\n" +
    "    insert into town_users (username, pass_hash, name, phone, nick)\n" +
    "    values (uname, crypt(gen_random_uuid()::text, gen_salt('bf')),\n" +
    "            coalesce(nullif(trim(p_name),''),'카카오 회원'), '카카오', coalesce(nullif(trim(p_nick),''),'카카오 회원'))\n" +
    "    returning * into u;\n" +
    "  end if;\n" +
    "  return json_build_object('username', u.username, 'name', u.name, 'nick', u.nick);\n" +
    "end $$;\n\n" +
    "create or replace function get_users(pass text)\n" +
    "returns table(created_at timestamptz, username text, name text, phone text, nick text)\n" +
    "language plpgsql security definer set search_path = public as $$\n" +
    "begin\n" +
    "  if pass is distinct from '931122' then raise exception 'unauthorized'; end if;\n" +
    "  return query select u.created_at, u.username, u.name, u.phone, u.nick from town_users u order by u.created_at desc limit 1000;\n" +
    "end $$;";

  async function loadDash() {
    const chips = document.getElementById("stat-chips");
    const sql2 = document.getElementById("sqlbox2");
    const table = document.getElementById("leads-table");
    const rows = document.getElementById("leads-rows");
    const empty = document.getElementById("leads-empty");
    if (!chips) return;
    chips.innerHTML = `<span class="note">불러오는 중…</span>`;
    let needSql = false;
    // 방문 통계
    try {
      const evs = await CFG.getEvents();
      const now = Date.now();
      const dayMs = 86400e3;
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const visits = evs.filter((e) => e.type === "visit");
      const vToday = visits.filter((e) => new Date(e.created_at) >= today).length;
      const v7 = visits.filter((e) => now - new Date(e.created_at).getTime() < 7 * dayMs).length;
      const top = (type, n) => {
        const cnt = {};
        evs.filter((e) => e.type === type && now - new Date(e.created_at).getTime() < 7 * dayMs)
          .forEach((e) => { cnt[e.name] = (cnt[e.name] || 0) + 1; });
        return Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, n);
      };
      const topZones = top("zone", 3).map(([n, c]) => `${n} ${c}`).join(" · ") || "-";
      const topModels = top("model", 3).map(([n, c]) => `${n} ${c}`).join(" · ") || "-";
      chips.innerHTML =
        `<span class="statchip">오늘 방문 <b>${vToday}</b></span>` +
        `<span class="statchip">7일 방문 <b>${v7}</b></span>` +
        `<span class="statchip">인기 존(7일) <b>${esc(topZones)}</b></span>` +
        `<span class="statchip">관심 모델(7일) <b>${esc(topModels)}</b></span>`;
    } catch (e) {
      chips.innerHTML = `<span class="note">통계 테이블이 아직 없습니다 (아래 SQL 실행 필요)</span>`;
      needSql = true;
    }
    // 회원 목록
    try {
      const pw = sessionStorage.getItem("seum_admin_pw") || "";
      const users = await CFG.getUsers(pw);
      const uTable = document.getElementById("users-table");
      const uRows = document.getElementById("users-rows");
      if (uTable && uRows) {
        uRows.innerHTML = users.map((u) => `
          <tr>
            <td style="white-space:nowrap">${esc(new Date(u.created_at).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }))}</td>
            <td>${esc(u.username)}</td>
            <td>${esc(u.name)}</td>
            <td style="white-space:nowrap">${esc(u.phone)}</td>
            <td>${esc(u.nick)}</td>
          </tr>`).join("");
        uTable.hidden = users.length === 0;
      }
      chips.insertAdjacentHTML("beforeend", `<span class="statchip">회원 <b>${users.length}</b>명</span>`);
    } catch (e) {}
    // 상담 리드
    try {
      const pw = sessionStorage.getItem("seum_admin_pw") || "";
      const leads = await CFG.getLeads(pw);
      rows.innerHTML = leads.map((l) => `
        <tr>
          <td style="white-space:nowrap">${esc(new Date(l.created_at).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }))}</td>
          <td>${esc(l.name || "")}</td>
          <td style="white-space:nowrap">${esc(l.phone || "")}</td>
          <td>${esc(l.interest || "")}</td>
          <td>${esc(l.memo || "")}</td>
          <td>${esc(l.source || "")}</td>
        </tr>`).join("");
      table.hidden = leads.length === 0;
      empty.hidden = leads.length !== 0;
    } catch (e) {
      table.hidden = true;
      empty.hidden = false;
      empty.textContent = "리드 테이블이 아직 없거나 인증에 실패했습니다. (아래 SQL 실행 후, 로그아웃했다면 다시 로그인)";
      needSql = true;
    }
    if (sql2) {
      sql2.style.display = needSql ? "block" : "none";
      sql2.textContent = DASH_SQL;
    }
  }
  const dashBtn = document.getElementById("dash-refresh");
  if (dashBtn) dashBtn.addEventListener("click", loadDash);

  document.getElementById("save-btn").addEventListener("click", async () => {
    savedMsg.textContent = "저장 중…";
    const src = await CFG.save(overrides);
    setStatus(src);
    savedMsg.style.color = "#8fe6b5";
    savedMsg.textContent = src === "supabase" ? "저장됨 ✓ (손님 화면 새로고침 시 반영)" : "로컬에 저장됨 ✓ (이 브라우저만)";
  });
  document.getElementById("reload-btn").addEventListener("click", boot);

  // ---------- 모델 취합 (최종 표시 정보 요약 + CSV) ----------
  function summaryData() {
    // 손님에게 보이는 최종 값 기준: apply(이름/가격/존 반영) + 배치 칸. 숨김 모델도 포함해 표시.
    const visible = CFG.apply(catalog, overrides);
    const townList = CFG.dedupeForTown ? CFG.dedupeForTown(visible) : visible;
    const townSet = new Set(townList.map((m) => m.slug));
    const plan = CFG.computePlacement(townList, overrides);
    const visMap = {};
    visible.forEach((m) => (visMap[m.slug] = m));
    return catalog.map((raw) => {
      const o = overrides.models[raw.slug] || {};
      const m = visMap[raw.slug];
      const p = m ? plan[CFG.keyOf(m)] : null;
      const won = m ? (m.event_on && m.event_price ? m.event_price : m.base_price) : raw.base_price;
      const price = won ? Math.round(won / 1e4).toLocaleString() + "만원" : "가격 상담";
      const curator = o.curator === "f" ? "수아" : o.curator === "m" ? "준" : o.curator === "bot" ? "메타봇" : "자동";
      return {
        img: o.image || raw.main_image || "",
        name: (m && m.name) || o.name || raw.name,
        zone: zoneShort(p ? p.zone : effZone(raw)),
        cell: p ? `${p.index + 1}번 칸${p.rot ? ` (${p.rot}°)` : ""}` : (m && !townSet.has(raw.slug) ? "마을 미표시 (중복 외형)" : "-"),
        size: (m && m.size) || raw.size || "",
        price,
        curator,
        shown: !o.hidden,
        memo: o.desc || raw.short_description || "",
      };
    });
  }
  function renderSummary() {
    const rows = document.getElementById("summary-rows");
    const chips = document.getElementById("summary-chips");
    if (!rows) return;
    const data = summaryData();
    const zoneCnt = {};
    data.filter((d) => d.shown).forEach((d) => (zoneCnt[d.zone] = (zoneCnt[d.zone] || 0) + 1));
    chips.innerHTML =
      `<span class="statchip">전체 <b>${data.length}</b></span>` +
      `<span class="statchip">노출 <b>${data.filter((d) => d.shown).length}</b> · 숨김 <b>${data.filter((d) => !d.shown).length}</b></span>` +
      Object.entries(zoneCnt).map(([z, n]) => `<span class="statchip">${esc(z)} <b>${n}</b></span>`).join("");
    rows.innerHTML = data
      .map((d, i) => `
      <tr${d.shown ? "" : ' class="is-hidden-row"'}>
        <td>${i + 1}</td>
        <td>${d.img ? `<img class="thumb" src="${esc(d.img)}" alt="" loading="lazy" />` : ""}</td>
        <td><b>${esc(d.name)}</b></td>
        <td>${esc(d.zone)}</td>
        <td>${esc(d.cell)}</td>
        <td>${esc(d.size)}</td>
        <td>${esc(d.price)}</td>
        <td>${esc(d.curator)}</td>
        <td>${d.shown ? "✅" : "숨김"}</td>
        <td style="max-width:220px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap">${esc(d.memo)}</td>
      </tr>`)
      .join("");
  }
  {
    const csvBtn = document.getElementById("summary-csv-btn");
    if (csvBtn) csvBtn.addEventListener("click", () => {
      const data = summaryData();
      const q = (s) => `"${String(s).replace(/"/g, '""')}"`;
      const csv = "﻿" + [
        ["번호", "모델명", "존", "배치 칸", "평수", "가격", "큐레이터", "노출", "비고"].join(","),
        ...data.map((d, i) => [i + 1, d.name, d.zone, d.cell, d.size, d.price, d.curator, d.shown ? "노출" : "숨김", d.memo].map(q).join(",")),
      ].join("\n");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      a.download = `메타하우스_모델취합_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    });
  }

  // ---------- 입점 업체 관리 (B2B: 회사 정보·담당자·계약·부스 배정) ----------
  const P_STATUS = ["상담중", "계약", "입점완료", "종료"];
  function partnersList() {
    if (!Array.isArray(overrides.partners)) overrides.partners = [];
    return overrides.partners;
  }
  // 부스 배정 → 지도·3D 마을 부스 간판에 회사명 동기화
  function syncPartnerBooth(p, prevBooth) {
    if (!overrides.boothSlots) overrides.boothSlots = {};
    if (prevBooth && prevBooth !== p.booth && overrides.boothSlots[prevBooth]) {
      overrides.boothSlots[prevBooth] = { status: "open" }; // 이전 부스는 모집 재개
    }
    if (p.booth) {
      const active = p.status === "계약" || p.status === "입점완료";
      overrides.boothSlots[p.booth] = active && p.company
        ? { status: "booked", company: p.company.slice(0, 16) }
        : { status: "open" };
    }
  }
  function renderPartners() {
    const rows = document.getElementById("partners-rows");
    const empty = document.getElementById("partners-empty");
    if (!rows) return;
    const list = partnersList();
    empty.hidden = list.length > 0;
    const boothKeys = Object.keys(overrides.boothSlots || {});
    rows.innerHTML = "";
    list.forEach((p, i) => {
      const tr = document.createElement("tr");
      const boothOpts = [...new Set(boothKeys.concat(p.booth || []))];
      tr.innerHTML = `
        <td><input type="text" data-p="company" maxlength="16" placeholder="회사명" value="${esc(p.company || "")}" /></td>
        <td><input type="text" data-p="manager" maxlength="20" placeholder="담당자" value="${esc(p.manager || "")}" /></td>
        <td><input type="tel" data-p="phone" maxlength="20" placeholder="010-0000-0000" value="${esc(p.phone || "")}" /></td>
        <td><input type="email" data-p="email" maxlength="40" placeholder="이메일" value="${esc(p.email || "")}" /></td>
        <td><select data-p="category">
          <option value="">미지정</option>
          ${ZONES.map((z) => `<option value="${z}" ${p.category === z ? "selected" : ""}>${z}</option>`).join("")}
          <option value="기타" ${p.category === "기타" ? "selected" : ""}>기타</option>
        </select></td>
        <td><select data-p="status" class="p-status--${esc(p.status || "상담중")}">
          ${P_STATUS.map((s) => `<option value="${s}" ${(p.status || "상담중") === s ? "selected" : ""}>${s}</option>`).join("")}
        </select></td>
        <td><input type="date" data-p="start" value="${esc(p.start || "")}" /></td>
        <td><input type="date" data-p="end" value="${esc(p.end || "")}" /></td>
        <td><select data-p="booth">
          <option value="">미배정</option>
          ${boothOpts.map((k) => `<option value="${esc(k)}" ${p.booth === k ? "selected" : ""}>${esc(k.replace("|", " "))}번</option>`).join("")}
        </select></td>
        <td><input type="text" data-p="memo" maxlength="60" placeholder="메모" value="${esc(p.memo || "")}" /></td>
        <td><button type="button" class="partner-del">삭제</button></td>`;
      tr.querySelectorAll("[data-p]").forEach((elm) => {
        elm.addEventListener("change", () => {
          const f = elm.dataset.p;
          const prevBooth = p.booth;
          p[f] = elm.value.trim();
          if (f === "booth" || f === "status" || f === "company") syncPartnerBooth(p, f === "booth" ? prevBooth : null);
          markDirty();
          if (f === "booth" || f === "status" || f === "company") { renderMap(); renderPartners(); }
        });
        if (elm.tagName === "INPUT") elm.addEventListener("input", () => { p[elm.dataset.p] = elm.value.trim(); markDirty(); });
      });
      tr.querySelector(".partner-del").addEventListener("click", () => {
        if (!confirm(`'${p.company || "이 업체"}'를 삭제할까요?`)) return;
        if (p.booth && overrides.boothSlots && overrides.boothSlots[p.booth]) {
          overrides.boothSlots[p.booth] = { status: "open" }; // 부스는 모집 재개
        }
        list.splice(i, 1);
        if (!list.length) delete overrides.partners;
        markDirty();
        renderPartners();
        renderMap();
      });
      rows.appendChild(tr);
    });
  }
  {
    const addBtn = document.getElementById("partner-add-btn");
    if (addBtn) addBtn.addEventListener("click", () => {
      partnersList().push({ id: Date.now().toString(36), status: "상담중" });
      markDirty();
      renderPartners();
    });
  }

  // ---------- 사이드바 섹션 전환 ----------
  document.querySelectorAll(".side__nav").forEach((b) =>
    b.addEventListener("click", () => {
      document.querySelectorAll(".side__nav").forEach((x) => x.classList.toggle("is-active", x === b));
      document.querySelectorAll(".apanel").forEach((p) => p.classList.toggle("is-active", p.id === "panel-" + b.dataset.panel));
      // 최신 편집 내용 반영해서 다시 그리기
      if (b.dataset.panel === "summary") renderSummary();
      if (b.dataset.panel === "partners") renderPartners();
    })
  );
})();
