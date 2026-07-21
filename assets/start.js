// ============ 시작 화면 (START) — 가벼운 입장 (카카오 우선 + 닉네임 즉시 입장) ============
// 아이디/비밀번호 없음: 재방문·본인확인은 카카오 로그인이, 가벼운 입장은 닉네임이 담당.
// 이름·핸드폰은 선택 입력 — 남기면 상담 리드로 저장된다.
(function () {
  const el = document.getElementById("start");
  if (!el) return;
  const CFG = window.SeumTownConfig;

  // 메타봇은 안내봇 전용이라 방문객 선택 목록에 없음
  const CHARS = [
    ["boy", "남자아이", "kid"],
    ["girl", "여자아이", "girl"],
    ["woman", "여성", "woman"],
    ["man", "남성", "man"],
    ["grandpa", "할아버지", "grandpa"],
    ["grandma", "할머니", "grandma"],
  ];

  const charsEl = document.getElementById("start-chars");
  const nickEl = document.getElementById("start-nick");
  const nameEl = document.getElementById("start-name");
  const phoneEl = document.getElementById("start-phone");
  const errEl = document.getElementById("start-err");
  const fieldsEl = document.getElementById("start-fields");
  const townBtn = document.getElementById("start-town");
  const kakaoBtn = document.getElementById("start-kakao");
  const prodBtn = document.getElementById("start-products");
  const logoutBtn = document.getElementById("start-logout");
  const autoChk = document.getElementById("start-auto");
  const returningEl = document.getElementById("start-returning");
  const rNameEl = document.getElementById("start-rname");

  let selChar = "boy";
  let savedNick = "";
  let account = null; // 카카오 계정 { username, name, nick }
  let entered = false; // 닉네임 입장 이력
  try {
    selChar = localStorage.getItem("seum_char") || "boy";
    savedNick = localStorage.getItem("seum_nick") || "";
    account = JSON.parse(localStorage.getItem("seum_user") || "null");
    entered = localStorage.getItem("seum_guest_ok") === "1";
  } catch (e) {}
  if (!CHARS.some(([k]) => k === selChar)) selChar = "boy";

  // ---------- 자동 입장: 이전에 입장한 적 있고 설정이 켜져 있으면 세션당 1회 바로 마을로 ----------
  try {
    if ((account || (entered && savedNick)) && localStorage.getItem("seum_autologin") === "1" && !sessionStorage.getItem("seum_autologged")) {
      sessionStorage.setItem("seum_autologged", "1");
      window.location.replace("town.html");
      return;
    }
  } catch (e) {}

  const isReturning = () => !!(account || (entered && savedNick));

  function applyMode() {
    const ret = isReturning();
    if (ret) {
      rNameEl.textContent = (account && (account.nick || account.name)) || savedNick;
      returningEl.hidden = false;
      townBtn.textContent = "🎮 바로 입장하기";
    } else {
      returningEl.hidden = true;
      townBtn.textContent = "🎮 닉네임으로 바로 입장";
    }
    if (fieldsEl) fieldsEl.hidden = ret; // 재방문은 입력 없이 바로
    if (kakaoBtn) kakaoBtn.hidden = ret && !!account; // 이미 카카오 로그인 상태면 숨김
    if (logoutBtn) logoutBtn.hidden = !ret;
    showErr("");
  }

  function showErr(msg) {
    if (!errEl) return;
    errEl.textContent = msg;
    errEl.hidden = !msg;
  }

  function renderChars() {
    charsEl.innerHTML = CHARS.map(
      ([k, label, img]) => `
      <button type="button" class="start__char${k === selChar ? " is-sel" : ""}" data-char="${k}" title="${label}">
        <img src="assets/chars/${img}.webp" alt="${label}" />
        <span>${label}</span>
      </button>`
    ).join("");
    charsEl.querySelectorAll(".start__char").forEach((b) =>
      b.addEventListener("click", () => {
        selChar = b.dataset.char;
        charsEl.querySelectorAll(".start__char").forEach((x) => x.classList.toggle("is-sel", x === b));
      })
    );
  }
  renderChars();
  if (nickEl) nickEl.value = savedNick;

  function markBad(input) {
    input.focus();
    input.classList.add("is-error");
    setTimeout(() => input.classList.remove("is-error"), 900);
  }

  function persistCommon(nick) {
    try {
      localStorage.setItem("seum_char", selChar);
      if (nick) localStorage.setItem("seum_nick", nick);
      localStorage.setItem("seum_autologin", autoChk && autoChk.checked ? "1" : "0");
      sessionStorage.setItem("seum_autologged", "1");
    } catch (e) {}
  }

  function goTown() {
    window.location.href = "town.html";
  }

  // 선택 입력(이름·핸드폰)을 남기면 상담 리드로 저장
  function maybeLead(nick) {
    const name = ((nameEl && nameEl.value) || "").trim();
    const phone = ((phoneEl && phoneEl.value) || "").trim();
    if (!phone && !name) return;
    if (CFG && CFG.addLead) {
      CFG.addLead({ name: name || nick || "방문객", phone, interest: "신규 모델·이벤트 알림", memo: `닉네임: ${nick}`, source: "시작화면" });
    }
    if (phone) {
      fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ "form-name": "상담신청", name: name || nick || "방문객", phone, interest: "미정", memo: "시작 화면 알림 신청", agree: "on" }).toString(),
      }).catch(() => {});
    }
  }

  // ---------- 닉네임 즉시 입장 ----------
  function enter() {
    if (isReturning()) {
      try { localStorage.setItem("seum_autologin", autoChk && autoChk.checked ? "1" : localStorage.getItem("seum_autologin") || "0"); } catch (e) {}
      try { sessionStorage.setItem("seum_autologged", "1"); } catch (e) {}
      return goTown();
    }
    const nick = ((nickEl && nickEl.value) || "").trim().slice(0, 10);
    if (!nick) { markBad(nickEl); showErr("닉네임만 입력하면 바로 입장할 수 있어요!"); return; }
    persistCommon(nick);
    try { localStorage.setItem("seum_guest_ok", "1"); } catch (e) {}
    maybeLead(nick);
    goTown();
  }

  // ---------- 카카오로 시작하기 (Supabase 소셜 로그인) ----------
  let sbClient = null;
  function supa() {
    if (!sbClient && window.supabase && window.supabase.createClient && CFG && CFG.SETTINGS_URL) {
      sbClient = window.supabase.createClient(CFG.SETTINGS_URL, CFG.SETTINGS_KEY);
    }
    return sbClient;
  }
  let kakaoReady = null;
  async function kakaoStart() {
    const client = supa();
    if (!client) { showErr("카카오 로그인 준비 중이에요. 잠시 후 다시 시도해주세요."); return; }
    try {
      // 프로바이더 활성화 여부를 먼저 확인 — 미설정 상태로 이동하면 오류 화면이 떠버림
      if (kakaoReady === null) {
        const r = await fetch(`${CFG.SETTINGS_URL}/auth/v1/settings`, { headers: { apikey: CFG.SETTINGS_KEY } });
        const s = await r.json();
        kakaoReady = !!(s && s.external && s.external.kakao);
      }
      if (!kakaoReady) {
        showErr("카카오 로그인은 아직 준비 중이에요. 닉네임으로 바로 입장해주세요 🙏");
        return;
      }
      const { error } = await client.auth.signInWithOAuth({
        provider: "kakao",
        options: { redirectTo: window.location.origin + window.location.pathname },
      });
      if (error) showErr("카카오 로그인 설정이 아직 완료되지 않았어요.");
    } catch (e) {
      showErr("카카오 로그인에 실패했어요. 잠시 후 다시 시도해주세요.");
    }
  }
  // 카카오 로그인 후 복귀 → 회원 연결 + 동의 정보 리드 저장 + 입장
  async function checkKakaoReturn() {
    const client = supa();
    if (!client || account) return;
    try {
      const { data } = await client.auth.getSession();
      const user = data && data.session && data.session.user;
      if (!user) return;
      const um = user.user_metadata || {};
      const name = um.name || um.full_name || um.preferred_username || "카카오 회원";
      const phone = um.phone_number || user.phone || "";
      const acc = await CFG.authKakaoUpsert({ kid: user.id, name, nick: name.slice(0, 10) });
      account = acc;
      try {
        localStorage.setItem("seum_user", JSON.stringify(acc));
        localStorage.setItem("seum_nick", acc.nick || "");
      } catch (e) {}
      // 동의받은 정보는 상담 리드로 (연락처는 카카오 동의 범위에 따라 없을 수 있음)
      if (CFG.addLead) CFG.addLead({ name, phone, interest: "카카오 가입", memo: "카카오로 시작하기", source: "카카오" });
      persistCommon(acc.nick || name.slice(0, 10));
      goTown();
    } catch (e) {}
  }

  function hide() {
    el.classList.add("is-hidden");
    document.body.classList.remove("start-lock");
    setTimeout(() => { el.hidden = true; }, 450);
  }
  function goProducts() {
    hide();
    const prod = document.getElementById("products");
    if (prod) prod.scrollIntoView({ behavior: "smooth" });
  }

  if (townBtn) townBtn.addEventListener("click", enter);
  if (kakaoBtn) kakaoBtn.addEventListener("click", kakaoStart);
  if (prodBtn) prodBtn.addEventListener("click", goProducts);
  if (logoutBtn) logoutBtn.addEventListener("click", () => {
    try {
      localStorage.removeItem("seum_user");
      localStorage.removeItem("seum_guest_ok");
      localStorage.removeItem("seum_autologin");
    } catch (e) {}
    account = null;
    entered = false;
    applyMode();
    const client = supa();
    if (client) client.auth.signOut().catch(() => {});
  });
  if (nickEl) nickEl.addEventListener("keydown", (e) => { if (e.key === "Enter") enter(); });

  applyMode();
  checkKakaoReturn();
  document.body.classList.add("start-lock");
})();
