// ============ 시작 화면 (START) — 게임식 회원가입/로그인/비번찾기/카카오 ============
// 마을 입장은 회원(이름·핸드폰·아이디·비밀번호·닉네임 필수) 전용.
// 계정은 전용 Supabase RPC(서버측 bcrypt)로 처리. 카카오는 Supabase 소셜 로그인 사용.
// 회원 시스템(SQL)이 아직 없으면 닉네임 게스트 입장 폴백.
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

  const panel = el.querySelector(".start__panel");
  const charsEl = document.getElementById("start-chars");
  const nameEl = document.getElementById("start-name");
  const phoneEl = document.getElementById("start-phone");
  const userEl = document.getElementById("start-username");
  const passEl = document.getElementById("start-pass");
  const nickEl = document.getElementById("start-nick");
  const errEl = document.getElementById("start-err");
  const townBtn = document.getElementById("start-town");
  const kakaoBtn = document.getElementById("start-kakao");
  const prodBtn = document.getElementById("start-products");
  const modeBtn = document.getElementById("start-mode");
  const forgotBtn = document.getElementById("start-forgot");
  const logoutBtn = document.getElementById("start-logout");
  const autoWrap = document.getElementById("start-auto-wrap");
  const autoChk = document.getElementById("start-auto");
  const returningEl = document.getElementById("start-returning");
  const rNameEl = document.getElementById("start-rname");
  const fieldOf = (input) => input && input.closest("label");

  let selChar = "boy";
  let savedNick = "";
  let account = null; // { username, name, nick }
  try {
    selChar = localStorage.getItem("seum_char") || "boy";
    savedNick = localStorage.getItem("seum_nick") || "";
    account = JSON.parse(localStorage.getItem("seum_user") || "null");
  } catch (e) {}
  if (!CHARS.some(([k]) => k === selChar)) selChar = "boy"; // 메타봇 등 예약/구버전 저장값 폴백

  // ---------- 자동 로그인: 계정 + 설정이 있으면 세션당 1회 바로 입장 ----------
  // (마을에서 '나가기'로 돌아오면 같은 세션이라 다시 튕기지 않음)
  try {
    if (account && localStorage.getItem("seum_autologin") === "1" && !sessionStorage.getItem("seum_autologged")) {
      sessionStorage.setItem("seum_autologged", "1");
      window.location.replace("town.html");
      return;
    }
  } catch (e) {}

  let mode = account ? "returning" : "signup"; // signup | login | reset | returning

  // 모드별 필드 표시 구성
  const MODE_FIELDS = {
    signup: [nameEl, phoneEl, userEl, passEl, nickEl],
    login: [userEl, passEl],
    reset: [userEl, nameEl, phoneEl, passEl],
    returning: [],
  };
  function applyMode() {
    [nameEl, phoneEl, userEl, passEl, nickEl].forEach((i) => {
      const lb = fieldOf(i);
      if (lb) lb.hidden = !MODE_FIELDS[mode].includes(i);
    });
    // 비밀번호 라벨: 재설정 모드에서는 "새 비밀번호"
    const passLabel = fieldOf(passEl) && fieldOf(passEl).querySelector("span");
    if (passLabel) passLabel.innerHTML = mode === "reset" ? "새 비밀번호 <em>*</em>" : "비밀번호 <em>*</em>";
    charsEl.hidden = mode === "reset" || mode === "returning" ? mode === "reset" : false;
    if (mode === "returning" && account) {
      rNameEl.textContent = account.nick || account.name;
      returningEl.hidden = false;
      townBtn.textContent = "🎮 바로 입장하기";
    } else {
      returningEl.hidden = true;
      townBtn.textContent = mode === "login" ? "🎮 로그인하고 입장" : mode === "reset" ? "🔑 비밀번호 재설정" : "🎮 회원가입하고 입장";
    }
    modeBtn.hidden = mode === "returning";
    modeBtn.textContent = mode === "signup" ? "이미 계정이 있어요 → 로그인" : "처음이에요 → 회원가입";
    forgotBtn.hidden = mode !== "login";
    logoutBtn.hidden = mode !== "returning";
    if (kakaoBtn) kakaoBtn.hidden = mode === "reset" || mode === "returning";
    if (autoWrap) autoWrap.hidden = mode === "reset";
    showErr("");
  }

  function showErr(msg, ok) {
    if (!errEl) return;
    errEl.textContent = msg;
    errEl.hidden = !msg;
    errEl.style.color = ok ? "#8fe6b5" : "";
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

  function persistAccount(acc) {
    account = acc;
    try {
      localStorage.setItem("seum_user", JSON.stringify(acc));
      localStorage.setItem("seum_nick", acc.nick || "");
      localStorage.setItem("seum_char", selChar);
      localStorage.setItem("seum_autologin", autoChk && autoChk.checked ? "1" : "0");
      sessionStorage.setItem("seum_autologged", "1"); // 이번 세션은 이미 입장 처리
      localStorage.removeItem("seum_guest_ok");
    } catch (e) {}
  }

  function goTown() {
    try { localStorage.setItem("seum_char", selChar); } catch (e) {}
    window.location.href = "town.html";
  }

  // 회원 시스템 미구축(테이블/RPC 없음) 시 게스트 폴백
  function guestFallback() {
    const nick = ((nickEl && nickEl.value) || savedNick || "").trim().slice(0, 10);
    if (!nick) { markBad(nickEl); showErr("닉네임을 입력해주세요."); return; }
    try {
      localStorage.setItem("seum_nick", nick);
      localStorage.setItem("seum_guest_ok", "1");
    } catch (e) {}
    goTown();
  }

  async function submit() {
    if (mode === "returning" && account) {
      try { localStorage.setItem("seum_autologin", autoChk && autoChk.checked ? "1" : localStorage.getItem("seum_autologin") || "0"); } catch (e) {}
      return goTown();
    }
    showErr("");
    const username = (userEl.value || "").trim();
    const pass = passEl.value || "";
    if (!/^[a-zA-Z0-9_]{4,20}$/.test(username)) { markBad(userEl); showErr("아이디는 영문·숫자 4자 이상이어야 해요."); return; }
    if (pass.length < 4) { markBad(passEl); showErr(mode === "reset" ? "새 비밀번호는 4자 이상이어야 해요." : "비밀번호는 4자 이상이어야 해요."); return; }
    if (!CFG || !CFG.authLogin) return guestFallback();
    townBtn.disabled = true;
    try {
      if (mode === "reset") {
        const name = (nameEl.value || "").trim();
        const phone = (phoneEl.value || "").trim();
        if (name.length < 2) { markBad(nameEl); showErr("가입할 때 쓴 이름을 입력해주세요."); townBtn.disabled = false; return; }
        if (!phone) { markBad(phoneEl); showErr("가입할 때 쓴 핸드폰 번호를 입력해주세요."); townBtn.disabled = false; return; }
        await CFG.authResetPass({ username, name, phone, newPass: pass });
        mode = "login";
        applyMode();
        showErr("비밀번호가 변경됐어요! 새 비밀번호로 로그인해주세요.", true);
        passEl.value = "";
        townBtn.disabled = false;
        return;
      }
      let acc;
      if (mode === "login") {
        acc = await CFG.authLogin(username, pass);
      } else {
        const name = (nameEl.value || "").trim();
        const phone = (phoneEl.value || "").trim();
        const nick = (nickEl.value || "").trim().slice(0, 10);
        if (name.length < 2) { markBad(nameEl); showErr("이름을 입력해주세요."); townBtn.disabled = false; return; }
        if (!/^01[016789][-\s]?\d{3,4}[-\s]?\d{4}$/.test(phone)) { markBad(phoneEl); showErr("핸드폰 번호를 정확히 입력해주세요. (예: 010-1234-5678)"); townBtn.disabled = false; return; }
        if (!nick) { markBad(nickEl); showErr("닉네임을 입력해주세요."); townBtn.disabled = false; return; }
        acc = await CFG.authRegister({ username, pass, name, phone, nick });
        // 신규 회원은 상담 리드에도 기록 (관리자 대시보드에서 확인)
        if (CFG.addLead) CFG.addLead({ name, phone, interest: "회원가입", memo: `아이디: ${username} / 닉네임: ${nick}`, source: "회원가입" });
      }
      persistAccount(acc);
      goTown();
    } catch (err) {
      if (err && err.status === 404) return guestFallback(); // 회원 테이블 미구축 → 게스트 입장
      const msg = String((err && err.message) || "");
      if (msg.includes("username_taken")) showErr("이미 사용 중인 아이디예요. 로그인하거나 다른 아이디를 써주세요.");
      else if (msg.includes("invalid_login")) showErr("아이디 또는 비밀번호가 맞지 않아요.");
      else if (msg.includes("no_match")) showErr("아이디·이름·핸드폰 번호가 가입 정보와 일치하지 않아요.");
      else if (msg.includes("bad_username")) showErr("아이디는 4자 이상이어야 해요.");
      else if (msg.includes("bad_password")) showErr("비밀번호는 4자 이상이어야 해요.");
      else showErr("잠시 후 다시 시도해주세요.");
    } finally {
      townBtn.disabled = false;
    }
  }

  // ---------- 카카오로 시작하기 (Supabase 소셜 로그인) ----------
  let sbClient = null;
  function supa() {
    if (!sbClient && window.supabase && window.supabase.createClient && CFG && CFG.SETTINGS_URL) {
      sbClient = window.supabase.createClient(CFG.SETTINGS_URL, CFG.SETTINGS_KEY);
    }
    return sbClient;
  }
  let kakaoReady = null; // null=미확인, true/false=확인됨
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
        showErr("카카오 로그인은 아직 준비 중이에요. 아이디 회원가입/로그인을 이용해주세요 🙏");
        return;
      }
      const { error } = await client.auth.signInWithOAuth({
        provider: "kakao",
        options: { redirectTo: window.location.origin + window.location.pathname },
      });
      if (error) showErr("카카오 로그인 설정이 아직 완료되지 않았어요. 관리자에게 문의해주세요.");
    } catch (e) {
      showErr("카카오 로그인에 실패했어요. 잠시 후 다시 시도해주세요.");
    }
  }
  // 카카오 로그인 후 돌아왔을 때 세션 감지 → 회원 연결
  async function checkKakaoReturn() {
    const client = supa();
    if (!client || account) return;
    try {
      const { data } = await client.auth.getSession();
      const user = data && data.session && data.session.user;
      if (!user) return;
      const um = user.user_metadata || {};
      const name = um.name || um.full_name || um.preferred_username || "카카오 회원";
      const acc = await CFG.authKakaoUpsert({ kid: user.id, name, nick: name.slice(0, 10) });
      persistAccount(acc);
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

  if (townBtn) townBtn.addEventListener("click", submit);
  if (kakaoBtn) kakaoBtn.addEventListener("click", kakaoStart);
  if (prodBtn) prodBtn.addEventListener("click", goProducts);
  if (modeBtn) modeBtn.addEventListener("click", () => {
    mode = mode === "signup" ? "login" : "signup";
    applyMode();
  });
  if (forgotBtn) forgotBtn.addEventListener("click", () => { mode = "reset"; applyMode(); });
  if (logoutBtn) logoutBtn.addEventListener("click", () => {
    try {
      localStorage.removeItem("seum_user");
      localStorage.removeItem("seum_autologin");
      localStorage.removeItem("seum_guest_ok");
    } catch (e) {}
    account = null;
    mode = "login";
    applyMode();
    const client = supa();
    if (client) client.auth.signOut().catch(() => {});
  });
  [userEl, passEl, nickEl].forEach((i) => i && i.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); }));

  applyMode();
  checkKakaoReturn();
  document.body.classList.add("start-lock");
})();
