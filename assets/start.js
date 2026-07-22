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
    // 이미 로그인된 상태면 기존 회원 로그인 토글 숨김
    const loginToggle = document.getElementById("start-login-toggle");
    const loginBox = document.getElementById("start-login");
    if (loginToggle) loginToggle.hidden = ret;
    if (loginBox && ret) loginBox.hidden = true;
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

  // ---------- 핸드폰 문자(SMS) 인증 ----------
  // 인증번호 생성·대조는 서버(Netlify Function)에서만. SMS 미설정 시 인증 없이 입장 폴백.
  const otpSendBtn = document.getElementById("start-otp-send");
  const otpRow = document.getElementById("start-otp-row");
  const otpInput = document.getElementById("start-otp");
  const otpVerifyBtn = document.getElementById("start-otp-verify");
  const otpTimerEl = document.getElementById("start-otp-timer");
  const verifiedEl = document.getElementById("start-verified");
  let phoneVerified = false;
  let smsAvailable = null; // null=미확인, false=미설정(폴백 입장 허용)
  let otpDeadline = 0, otpTick = null, resendAt = 0;
  const phoneDigits = () => ((phoneEl && phoneEl.value) || "").replace(/[^0-9]/g, "");
  const validPhone = () => /^01[016789][0-9]{7,8}$/.test(phoneDigits());
  try {
    // 이전에 인증한 번호면 재인증 생략
    const vp = localStorage.getItem("seum_phone_verified") || "";
    if (vp && phoneEl) { phoneEl.value = vp; phoneVerified = true; }
  } catch (e) {}
  function setVerifiedUI() {
    if (verifiedEl) verifiedEl.hidden = !phoneVerified;
    if (otpRow) otpRow.hidden = true;
    if (otpSendBtn) otpSendBtn.hidden = phoneVerified;
    if (otpTick) { clearInterval(otpTick); otpTick = null; }
  }
  setVerifiedUI();
  if (phoneEl) phoneEl.addEventListener("input", () => {
    // 번호를 바꾸면 인증 다시
    let saved = "";
    try { saved = localStorage.getItem("seum_phone_verified") || ""; } catch (e) {}
    phoneVerified = !!saved && phoneDigits() === saved;
    setVerifiedUI();
  });
  function startTimer() {
    otpDeadline = Date.now() + 5 * 60e3;
    resendAt = Date.now() + 60e3;
    if (otpTick) clearInterval(otpTick);
    otpTick = setInterval(() => {
      const left = Math.max(0, otpDeadline - Date.now());
      const m = Math.floor(left / 60e3), s = Math.floor((left % 60e3) / 1000);
      if (otpTimerEl) otpTimerEl.textContent = left ? `${m}:${String(s).padStart(2, "0")}` : "만료됨";
      if (otpSendBtn) {
        const cool = Math.max(0, resendAt - Date.now());
        otpSendBtn.textContent = cool ? `재발송 (${Math.ceil(cool / 1000)}s)` : "재발송";
        otpSendBtn.disabled = cool > 0;
      }
      if (!left) clearInterval(otpTick);
    }, 500);
  }
  async function otpSend() {
    if (!validPhone()) { markBad(phoneEl); showErr("핸드폰 번호를 정확히 입력해주세요. (예: 010-1234-5678)"); return; }
    showErr("");
    otpSendBtn.disabled = true;
    try {
      const r = await fetch("/.netlify/functions/sms-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneDigits() }),
      });
      if (r.status === 503 || r.status === 404) {
        smsAvailable = false;
        showErr("문자 인증 시스템 준비 중이에요 — 지금은 번호 입력만으로 입장돼요.");
        otpSendBtn.hidden = true;
        return;
      }
      const d = await r.json().catch(() => ({}));
      if (r.status === 429) { showErr(d.error === "cooldown" ? `잠시 후 다시 받을 수 있어요 (${d.wait || 60}초)` : "발송 한도를 초과했어요. 1시간 뒤 다시 시도해주세요."); return; }
      if (r.status === 502) {
        // 발송사·통신사 쪽 장애(예: 발신번호 차단)로 문자를 못 보내는 상태 —
        // 가입이 막히지 않게 미인증 폴백으로 입장시키고, 리드에는 "미인증"으로 기록된다.
        smsAvailable = false;
        showErr("문자 발송이 지금 원활하지 않아요 — 번호 입력만으로 입장할게요.");
        otpSendBtn.hidden = true;
        return;
      }
      if (!r.ok) { showErr("인증번호 발송에 실패했어요. 잠시 후 다시 시도해주세요."); return; }
      smsAvailable = true;
      otpRow.hidden = false;
      otpInput.value = "";
      otpInput.focus();
      startTimer();
      showErr("");
    } catch (e) {
      showErr("인증번호 발송에 실패했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      if (smsAvailable !== false) otpSendBtn.disabled = Date.now() < resendAt;
    }
  }
  async function otpVerify() {
    const code = (otpInput.value || "").replace(/[^0-9]/g, "");
    if (code.length !== 6) { markBad(otpInput); return; }
    otpVerifyBtn.disabled = true;
    try {
      const r = await fetch("/.netlify/functions/sms-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneDigits(), code }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.ok) {
        phoneVerified = true;
        try { localStorage.setItem("seum_phone_verified", phoneDigits()); } catch (e) {}
        setVerifiedUI();
        showErr("");
      } else if (d.error === "expired") showErr("인증번호가 만료됐어요. 재발송을 눌러주세요.");
      else if (d.error === "wrong_code") showErr(`인증번호가 달라요. (남은 시도 ${d.left != null ? d.left : "-"}회)`);
      else showErr("인증에 실패했어요. 다시 시도해주세요.");
    } catch (e) {
      showErr("인증에 실패했어요. 다시 시도해주세요.");
    } finally {
      otpVerifyBtn.disabled = false;
    }
  }
  if (otpSendBtn) otpSendBtn.addEventListener("click", otpSend);
  if (otpVerifyBtn) otpVerifyBtn.addEventListener("click", otpVerify);
  if (otpInput) otpInput.addEventListener("keydown", (e) => { if (e.key === "Enter") otpVerify(); });

  // 입장 시 인증된 번호 + 닉네임을 리드로 저장 (Supabase는 RLS로 조회 잠금)
  function saveEntryLead(nick) {
    const name = ((nameEl && nameEl.value) || "").trim();
    const phone = phoneDigits();
    if (CFG && CFG.addLead) {
      CFG.addLead({
        name: name || nick || "방문객",
        phone,
        interest: "마을 입장",
        memo: `닉네임: ${nick} / 번호 인증: ${phoneVerified ? "완료 ✅" : "미인증(시스템 준비중)"}`,
        source: "입장 인증",
      });
    }
    fetch("/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ "form-name": "상담신청", name: name || nick || "방문객", phone, interest: "마을 입장", memo: `번호 인증: ${phoneVerified ? "완료" : "미인증"}`, agree: "on" }).toString(),
    }).catch(() => {});
  }

  // ---------- 입장 (닉네임 + 인증된 번호) ----------
  function enter() {
    if (isReturning()) {
      try { localStorage.setItem("seum_autologin", autoChk && autoChk.checked ? "1" : localStorage.getItem("seum_autologin") || "0"); } catch (e) {}
      try { sessionStorage.setItem("seum_autologged", "1"); } catch (e) {}
      return goTown();
    }
    const nick = ((nickEl && nickEl.value) || "").trim().slice(0, 10);
    if (!nick) { markBad(nickEl); showErr("닉네임을 입력해주세요."); return; }
    // 핸드폰 번호는 문자 인증 복구 전까지 선택 입력 — 닉네임만으로 입장.
    // 번호를 적었는데 형식이 틀린 경우만 잡아주고, 인증 여부는 리드에 기록만 한다.
    if (phoneDigits() && !validPhone()) { markBad(phoneEl); showErr("핸드폰 번호 형식을 확인해주세요. (예: 010-1234-5678)"); return; }
    persistCommon(nick);
    try { localStorage.setItem("seum_guest_ok", "1"); } catch (e) {}
    saveEntryLead(nick);
    goTown();
  }

  // ---------- 기존 회원 로그인 (아이디·비밀번호 — 이전 게임식 가입 회원용) ----------
  // 새 기기·새 브라우저에서도 아이디로 다시 로그인할 수 있게 보조 경로로 유지한다.
  {
    const loginToggle = document.getElementById("start-login-toggle");
    const loginBox = document.getElementById("start-login");
    const loginId = document.getElementById("login-id");
    const loginPw = document.getElementById("login-pw");
    const loginBtn = document.getElementById("login-btn");
    const resetToggle = document.getElementById("login-reset-toggle");
    const resetBox = document.getElementById("login-reset");
    const resetName = document.getElementById("reset-name");
    const resetPhone = document.getElementById("reset-phone");
    const resetPw = document.getElementById("reset-pw");
    const resetBtn = document.getElementById("reset-btn");
    if (loginToggle && loginBox) {
      loginToggle.addEventListener("click", () => {
        loginBox.hidden = !loginBox.hidden;
        if (!loginBox.hidden && loginId) loginId.focus();
      });
    }
    if (resetToggle && resetBox) {
      resetToggle.addEventListener("click", () => { resetBox.hidden = !resetBox.hidden; });
    }
    async function doLogin() {
      const id = ((loginId && loginId.value) || "").trim();
      const pw = (loginPw && loginPw.value) || "";
      if (!id) { markBad(loginId); showErr("아이디를 입력해주세요."); return; }
      if (!pw) { markBad(loginPw); showErr("비밀번호를 입력해주세요."); return; }
      loginBtn.disabled = true;
      showErr("");
      try {
        const acc = await CFG.authLogin(id, pw);
        account = acc;
        try {
          localStorage.setItem("seum_user", JSON.stringify(acc));
          if (acc.nick) localStorage.setItem("seum_nick", acc.nick);
        } catch (e) {}
        persistCommon(acc.nick || acc.name || id);
        goTown();
      } catch (e) {
        if (e && e.status === 404) showErr("회원 시스템 준비 중이에요. 닉네임으로 바로 입장해주세요.");
        else showErr("아이디 또는 비밀번호가 달라요.");
      } finally {
        loginBtn.disabled = false;
      }
    }
    async function doReset() {
      const id = ((loginId && loginId.value) || "").trim();
      if (!id) { markBad(loginId); showErr("위의 아이디 칸을 먼저 채워주세요."); return; }
      const nm = ((resetName && resetName.value) || "").trim();
      const ph = ((resetPhone && resetPhone.value) || "").trim();
      const np = (resetPw && resetPw.value) || "";
      if (!nm) { markBad(resetName); return; }
      if (!ph) { markBad(resetPhone); return; }
      if (np.length < 4) { markBad(resetPw); showErr("새 비밀번호는 4자 이상으로 해주세요."); return; }
      resetBtn.disabled = true;
      showErr("");
      try {
        await CFG.authResetPass({ username: id, name: nm, phone: ph, newPass: np });
        resetBox.hidden = true;
        if (loginPw) loginPw.value = np;
        showErr("비밀번호가 바뀌었어요! 바로 로그인해주세요 ✅");
      } catch (e) {
        if (e && e.status === 404) showErr("회원 시스템 준비 중이에요.");
        else showErr("아이디·이름·번호가 가입 정보와 달라요. 다시 확인해주세요.");
      } finally {
        resetBtn.disabled = false;
      }
    }
    if (loginBtn) loginBtn.addEventListener("click", doLogin);
    if (loginPw) loginPw.addEventListener("keydown", (e) => { if (e.key === "Enter") doLogin(); });
    if (resetBtn) resetBtn.addEventListener("click", doReset);
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
