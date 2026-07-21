// 내 집 현황 마이페이지 — 계약 고객이 시공 단계·현장 사진·일정·공지를 확인하는 화면.
// 본인 확인: 핸드폰 번호(+닉네임 대조)로 get_my_project RPC 조회 — 남의 현황은 조회 불가.
(function () {
  "use strict";
  const CFG = window.SeumTownConfig;
  const STAGES = (CFG && CFG.BUILD_STAGES) || ["토목", "기초", "골조", "지붕/외장", "내부", "마감", "준공"];
  const $ = (id) => document.getElementById(id);

  const gateEl = $("my-gate"), noneEl = $("my-none"), bodyEl = $("my-body");
  let myPhone = "", myNick = "", project = null;

  const digits = (s) => String(s || "").replace(/[^0-9]/g, "");
  function show(which) {
    gateEl.hidden = which !== "gate";
    noneEl.hidden = which !== "none";
    bodyEl.hidden = which !== "body";
  }

  // 저장된 입장 정보로 자동 확인 (인증된 번호 + 닉네임)
  try {
    myPhone = digits(localStorage.getItem("seum_phone_verified") || "");
    myNick = localStorage.getItem("seum_nick") || "";
    const acc = JSON.parse(localStorage.getItem("seum_user") || "null");
    if (acc && acc.nick && !myNick) myNick = acc.nick;
  } catch (e) {}

  function fmtDate(d) {
    return d || "";
  }

  function render() {
    const p = project;
    $("my-hello").textContent = `${p.nick || p.name || "고객"}님 댁, 지금 이렇게 지어지고 있어요 👷`;
    const done = p.status === "완공";
    $("my-done-banner").hidden = !done;
    // ① 단계 진행바
    const stage = Math.max(0, Math.min(STAGES.length - 1, Number(p.stage) || 0));
    const pct = done ? 100 : Math.round((stage / (STAGES.length - 1)) * 100);
    $("my-bar").style.width = pct + "%";
    $("my-percent").textContent = done ? "공사가 모두 끝났어요! (100%)" : `현재 "${STAGES[stage]}" 단계 진행 중 · ${pct}%`;
    const stEl = $("my-stages");
    stEl.innerHTML = "";
    STAGES.forEach((s, i) => {
      const li = document.createElement("div");
      li.className = "my__stage" + (i < stage || done ? " is-done" : i === stage ? " is-now" : "");
      li.innerHTML = `<span class="my__stage-dot">${i < stage || done ? "✓" : i + 1}</span><span>${s}</span>`;
      stEl.appendChild(li);
    });
    // ② 단계별 사진첩 (최신 단계가 위)
    const photos = Array.isArray(p.photos) ? p.photos : [];
    const phEl = $("my-photos");
    phEl.innerHTML = "";
    $("my-photos-empty").hidden = photos.length > 0;
    const byStage = {};
    photos.forEach((ph) => {
      const si = Math.max(0, Math.min(STAGES.length - 1, Number(ph.stage) || 0));
      (byStage[si] = byStage[si] || []).push(ph);
    });
    Object.keys(byStage).map(Number).sort((a, b) => b - a).forEach((si) => {
      const grp = document.createElement("div");
      grp.className = "my__photo-group";
      grp.innerHTML = `<h3>${si + 1}. ${STAGES[si]}</h3>`;
      const grid = document.createElement("div");
      grid.className = "my__photo-grid";
      byStage[si]
        .slice()
        .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
        .forEach((ph) => {
          const fig = document.createElement("figure");
          fig.className = "my__photo";
          fig.innerHTML = `<img src="${ph.url}" alt="${STAGES[si]} 현장 사진" loading="lazy" />
            <figcaption>${fmtDate(ph.date)}${ph.caption ? " · " + ph.caption : ""}</figcaption>`;
          fig.querySelector("img").addEventListener("click", () => {
            $("my-lightbox-img").src = ph.url;
            $("my-lightbox-cap").textContent = `${STAGES[si]} · ${fmtDate(ph.date)}${ph.caption ? " · " + ph.caption : ""}`;
            $("my-lightbox").hidden = false;
          });
          grid.appendChild(fig);
        });
      grp.appendChild(grid);
      phEl.appendChild(grp);
    });
    // ③ 일정 (다가오는 일정 강조)
    const sch = Array.isArray(p.schedule) ? p.schedule.slice() : [];
    sch.sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
    const schEl = $("my-schedule");
    schEl.innerHTML = "";
    $("my-schedule-empty").hidden = sch.length > 0;
    const today = new Date().toISOString().slice(0, 10);
    let nextMarked = false;
    sch.forEach((s) => {
      const li = document.createElement("li");
      const past = String(s.date || "") < today;
      const isNext = !past && !nextMarked;
      if (isNext) nextMarked = true;
      li.className = past ? "is-past" : isNext ? "is-next" : "";
      li.innerHTML = `<b>${fmtDate(s.date)}</b><span>${s.label || ""}</span>${isNext ? '<em class="my__next">다음 일정</em>' : ""}`;
      schEl.appendChild(li);
    });
    // ④ 공지
    const nts = Array.isArray(p.notices) ? p.notices.slice().reverse() : [];
    const ntEl = $("my-notices");
    ntEl.innerHTML = "";
    $("my-notices-empty").hidden = nts.length > 0;
    nts.forEach((n) => {
      const li = document.createElement("li");
      li.innerHTML = `<b>${fmtDate(n.date)}</b><span>${n.text || ""}</span>`;
      ntEl.appendChild(li);
    });
    // 문의 기록
    renderInqs();
    show("body");
  }

  function renderInqs() {
    const inqs = Array.isArray(project.inquiries) ? project.inquiries.slice().reverse() : [];
    const el = $("my-inqs");
    el.innerHTML = "";
    inqs.forEach((q) => {
      const li = document.createElement("li");
      li.innerHTML = `<b>${q.date || ""}</b><span>${q.text || ""}</span>${q.answer ? `<p class="my__answer">↳ 답변: ${q.answer}</p>` : ""}`;
      el.appendChild(li);
    });
  }

  async function lookup(phone, nick) {
    const rows = await CFG.getMyProject(phone, nick);
    return Array.isArray(rows) ? rows[0] : rows;
  }

  async function boot() {
    if (!myPhone) { show("gate"); return; }
    try {
      const p = await lookup(myPhone, myNick);
      if (p) { project = p; render(); }
      else show("none");
    } catch (e) {
      if (e && e.status === 404) {
        $("my-none-sub").textContent = "시공 현황 시스템 준비 중이에요. 곧 첫 계약 고객부터 현장 사진을 보실 수 있어요!";
        show("none");
      } else show("gate");
    }
  }

  $("my-gate-btn").addEventListener("click", async () => {
    const ph = digits($("my-phone").value);
    const nk = ($("my-nick").value || "").trim();
    const errEl = $("my-gate-err");
    if (!/^01[016789][0-9]{7,8}$/.test(ph)) { errEl.textContent = "핸드폰 번호를 정확히 입력해주세요."; errEl.hidden = false; return; }
    errEl.hidden = true;
    try {
      const p = await lookup(ph, nk);
      if (p) {
        myPhone = ph; myNick = nk; project = p;
        render();
      } else {
        show("none");
      }
    } catch (e) {
      if (e && e.status === 404) {
        $("my-none-sub").textContent = "시공 현황 시스템 준비 중이에요. 곧 첫 계약 고객부터 현장 사진을 보실 수 있어요!";
        show("none");
      } else { errEl.textContent = "확인에 실패했어요. 잠시 후 다시 시도해주세요."; errEl.hidden = false; }
    }
  });

  // 문의 남기기 (A/S 문의 버튼도 같은 폼으로)
  async function sendInquiry(prefix) {
    const txtEl = $("my-inq-text");
    const text = ((prefix || "") + (txtEl.value || "")).trim();
    const errEl = $("my-inq-err");
    if (!text) { txtEl.focus(); return; }
    $("my-inq-btn").disabled = true;
    try {
      await CFG.addProjectInquiry(myPhone, myNick, text);
      project.inquiries = (project.inquiries || []).concat([{ date: new Date().toISOString().slice(0, 16).replace("T", " "), text }]);
      renderInqs();
      txtEl.value = "";
      errEl.textContent = "문의가 등록됐어요! 담당자가 확인 후 연락드릴게요 ✅";
      errEl.hidden = false;
      errEl.style.color = "#2f8f5a";
    } catch (e) {
      errEl.textContent = "등록에 실패했어요. 잠시 후 다시 시도해주세요.";
      errEl.hidden = false;
      errEl.style.color = "";
    } finally {
      $("my-inq-btn").disabled = false;
    }
  }
  $("my-inq-btn").addEventListener("click", () => sendInquiry(""));
  const asBtn = $("my-as-btn");
  if (asBtn) asBtn.addEventListener("click", () => {
    $("my-inq-card").scrollIntoView({ behavior: "smooth" });
    $("my-inq-text").placeholder = "A/S가 필요한 부분을 적어주세요 (예: 주방 실리콘 마감)";
    $("my-inq-text").focus();
  });

  // 후기 남기기 → 관심모델에 표시해 상담폼으로 (기존 문의 폼 재사용)
  const reviewBtn = $("my-review-btn");
  if (reviewBtn) reviewBtn.addEventListener("click", () => {
    try { localStorage.setItem("seum_interest_model", "완공 후기 작성"); } catch (e) {}
  });

  $("my-lightbox-close").addEventListener("click", () => { $("my-lightbox").hidden = true; });
  $("my-lightbox").addEventListener("click", (e) => { if (e.target === $("my-lightbox")) $("my-lightbox").hidden = true; });

  if (CFG && CFG.logEvent) CFG.logEvent("visit_my", "");
  boot();
})();
