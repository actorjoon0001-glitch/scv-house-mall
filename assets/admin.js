// ============ 메타하우스 관리자 (1단계: 모델 표시 설정 · 2단계: 배치 지도) ============
(function () {
  const CFG = window.SeumTownConfig;
  const ZONES = ["전원주택", "세컨하우스", "체류형 쉼터", "특별모델"];
  // 지도 표시용 존 메타 (마을과 동일한 2×2 블록, 북쪽이 위)
  const MAP_ZONES = [
    { key: "전원주택", emoji: "🏡", color: "#69b25e" },   // 북서
    { key: "체류형 쉼터", emoji: "🌿", color: "#b2a15e" }, // 북동
    { key: "세컨하우스", emoji: "🏠", color: "#5e9db2" },  // 남서
    { key: "특별모델", emoji: "⛳", color: "#9a7fc0" },    // 남동
  ];
  const ROT_ARROW = { 0: "↓", 90: "→", 180: "↑", 270: "←" };
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
      try { sessionStorage.setItem("seum_admin_ok", "1"); } catch (e) {}
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

  function render() {
    rowsEl.innerHTML = "";
    catalog.forEach((m) => {
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
          ${ZONES.map((z) => `<option value="${z}" ${o.zone === z ? "selected" : ""}>${z}</option>`).join("")}
        </select></td>
        <td><select data-f="curator">
          <option value="">자동</option>
          <option value="f" ${o.curator === "f" ? "selected" : ""}>여성</option>
          <option value="m" ${o.curator === "m" ? "selected" : ""}>남성</option>
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
    if (f === "show" || f === "zone" || f === "name") renderMap(); // 지도에 영향 주는 필드
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

  function markDirty() {
    savedMsg.textContent = "변경됨 (저장 필요)";
    savedMsg.style.color = "#f0c674";
  }
  // 마을에 실제 보이는 모델(숨김 제외 + 존 오버라이드 반영) — town.js와 동일 입력
  function effModels() {
    return CFG.apply(catalog, overrides);
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
      const zoneEl = document.createElement("div");
      zoneEl.className = "map-zone";
      zoneEl.style.borderColor = mz.color;
      zoneEl.innerHTML = `<h3 style="color:${mz.color}">${mz.emoji} ${esc(mz.key)} 존 · ${inZone.length}개</h3>`;
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
          const k = inZone.find((k2) => plan[k2].index === idx);
          if (k) {
            const m = byKey[k];
            const pinned = overrides.placement && overrides.placement[k] && overrides.placement[k].index != null;
            const chip = document.createElement("div");
            chip.className = "map-chip" + (k === selKey ? " is-sel" : "") + (pinned ? " is-pin" : "");
            chip.draggable = true;
            chip.innerHTML = `<span class="rot">${ROT_ARROW[plan[k].rot || 0] || "↓"}</span><span class="nm">${esc((m && m.name) || k)}</span>`;
            chip.addEventListener("click", (e) => {
              e.stopPropagation();
              setSel(k === selKey ? null : k);
            });
            chip.addEventListener("dragstart", (e) => {
              e.dataTransfer.setData("text/plain", k);
              setSel(k);
            });
            cell.appendChild(chip);
          }
          if (selKey && selKey !== k) cell.classList.add("is-target");
          cell.addEventListener("click", () => {
            if (selKey) moveTo(selKey, mz.key, idx);
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
    render();
    renderMap();
  }

  document.getElementById("save-btn").addEventListener("click", async () => {
    savedMsg.textContent = "저장 중…";
    const src = await CFG.save(overrides);
    setStatus(src);
    savedMsg.style.color = "#8fe6b5";
    savedMsg.textContent = src === "supabase" ? "저장됨 ✓ (손님 화면 새로고침 시 반영)" : "로컬에 저장됨 ✓ (이 브라우저만)";
  });
  document.getElementById("reload-btn").addEventListener("click", boot);
})();
