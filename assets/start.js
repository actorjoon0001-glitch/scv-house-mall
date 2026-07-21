// ============ 시작 화면 (START) — 게임식 회원가입/로그인 ============
// 마을 입장은 회원(이름·핸드폰·아이디·비밀번호·닉네임 필수) 전용.
// 계정은 전용 Supabase RPC(town_register/town_login, 서버측 bcrypt)로 처리.
// 회원 시스템(SQL)이 아직 없으면 예전처럼 닉네임만으로 게스트 입장 폴백.
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
  const prodBtn = document.getElementById("start-products");
  const modeBtn = document.getElementById("start-mode");
  const returningEl = document.getElementById("start-returning");
  const rNameEl = document.getElementById("start-rname");

  let selChar = "boy";
  let savedNick = "";
  let account = null; // { username, name, nick }
  try {
    selChar = localStorage.getItem("seum_char") || "boy";
    savedNick = localStorage.getItem("seum_nick") || "";
    account = JSON.parse(localStorage.getItem("seum_user") || "null");
  } catch (e) {}
  if (!CHARS.some(([k]) => k === selChar)) selChar = "boy"; // 메타봇 등 예약/구버전 저장값 폴백

  let mode = account ? "returning" : "signup"; // signup | login | returning

  function applyMode() {
    panel.classList.toggle("start--login", mode === "login");
    panel.classList.toggle("start--returning", mode === "returning");
    if (mode === "returning" && account) {
      rNameEl.textContent = account.nick || account.name;
      returningEl.hidden = false;
      townBtn.textContent = "🎮 바로 입장하기";
      modeBtn.textContent = "";
    } else {
      returningEl.hidden = true;
      townBtn.textContent = mode === "login" ? "🎮 로그인하고 입장" : "🎮 회원가입하고 입장";
      modeBtn.textContent = mode === "login" ? "처음이에요 → 회원가입" : "이미 계정이 있어요 → 로그인";
    }
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

  function persistAccount(acc) {
    account = acc;
    try {
      localStorage.setItem("seum_user", JSON.stringify(acc));
      localStorage.setItem("seum_nick", acc.nick || "");
      localStorage.setItem("seum_char", selChar);
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
    if (mode === "returning" && account) return goTown();
    showErr("");
    const username = (userEl.value || "").trim();
    const pass = passEl.value || "";
    if (!/^[a-zA-Z0-9_]{4,20}$/.test(username)) { markBad(userEl); showErr("아이디는 영문·숫자 4자 이상이어야 해요."); return; }
    if (pass.length < 4) { markBad(passEl); showErr("비밀번호는 4자 이상이어야 해요."); return; }
    if (!CFG || !CFG.authLogin) return guestFallback();
    townBtn.disabled = true;
    try {
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
      else if (msg.includes("bad_username")) showErr("아이디는 4자 이상이어야 해요.");
      else if (msg.includes("bad_password")) showErr("비밀번호는 4자 이상이어야 해요.");
      else showErr("잠시 후 다시 시도해주세요.");
    } finally {
      townBtn.disabled = false;
    }
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
  if (prodBtn) prodBtn.addEventListener("click", goProducts);
  if (modeBtn) modeBtn.addEventListener("click", () => {
    mode = mode === "login" ? "signup" : "login";
    applyMode();
  });
  [userEl, passEl, nickEl].forEach((i) => i && i.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); }));

  applyMode();
  document.body.classList.add("start-lock");
})();
