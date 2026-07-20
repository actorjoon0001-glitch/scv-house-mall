// ============ 메타하우스 관리자 (1단계: 모델 목록 + 표시 설정) ============
(function () {
  const CFG = window.SeumTownConfig;
  const ZONES = ["전원주택", "세컨하우스", "체류형 쉼터", "특별모델"];
  // 관리자 비밀번호(SHA-256). 변경하려면 새 비밀번호의 sha256 hex로 교체.
  const PASS_HASH = "8229c51fcf2de11d4a910c0d74001df6d5bfb22b054efadd6a8da63f9f4a7cc3";

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
  }

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
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
