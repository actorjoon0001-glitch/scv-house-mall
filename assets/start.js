// ============ 시작 화면 (START) ============
// 회원가입 없는 가벼운 입장: 캐릭터 + 닉네임(필수) + 연락처(선택, 리드 전송).
(function () {
  const el = document.getElementById("start");
  if (!el) return;

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
  const phoneEl = document.getElementById("start-phone");
  const townBtn = document.getElementById("start-town");
  const prodBtn = document.getElementById("start-products");
  const returningEl = document.getElementById("start-returning");
  const rNameEl = document.getElementById("start-rname");

  let selChar = "boy";
  let savedNick = "";
  try {
    selChar = localStorage.getItem("seum_char") || "boy";
    savedNick = localStorage.getItem("seum_nick") || "";
  } catch (e) {}
  if (!CHARS.some(([k]) => k === selChar)) selChar = "boy"; // 메타봇 등 예약/구버전 저장값 폴백

  // 재방문자는 인사 + 간소화
  if (savedNick && returningEl && rNameEl) {
    rNameEl.textContent = savedNick;
    returningEl.hidden = false;
    if (townBtn) townBtn.textContent = "🎮 바로 입장하기";
  }
  if (nickEl) nickEl.value = savedNick;

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

  function currentNick() {
    return ((nickEl && nickEl.value) || "").trim().slice(0, 10);
  }

  function persist(nick) {
    try {
      localStorage.setItem("seum_char", selChar);
      if (nick) localStorage.setItem("seum_nick", nick);
    } catch (e) {}
  }

  // 연락처(선택)를 남기면 기존 리드 폼(Netlify '상담신청')으로 전송
  function maybeSendLead(nick) {
    const phone = ((phoneEl && phoneEl.value) || "").trim();
    if (!phone) return;
    const body = new URLSearchParams({
      "form-name": "상담신청",
      name: nick || "방문객",
      phone,
      interest: "미정",
      memo: "시작 화면 알림 신청 (신규 모델·이벤트)",
      agree: "on",
    }).toString();
    fetch("/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    }).catch(() => {});
  }

  function hide() {
    el.classList.add("is-hidden");
    document.body.classList.remove("start-lock");
    setTimeout(() => { el.hidden = true; }, 450);
  }

  function enterTown() {
    let nick = currentNick();
    if (!nick) {
      if (savedNick) nick = savedNick;
      else {
        nickEl.focus();
        nickEl.classList.add("is-error");
        setTimeout(() => nickEl.classList.remove("is-error"), 900);
        return;
      }
    }
    persist(nick);
    maybeSendLead(nick);
    // 독립 3D 타운 페이지로 이동 (캐릭터·닉네임은 localStorage로 전달)
    window.location.href = "town.html";
  }

  function goProducts() {
    const nick = currentNick();
    if (nick) persist(nick);
    maybeSendLead(nick || savedNick);
    hide();
    const prod = document.getElementById("products");
    if (prod) prod.scrollIntoView({ behavior: "smooth" });
  }

  if (townBtn) townBtn.addEventListener("click", enterTown);
  if (prodBtn) prodBtn.addEventListener("click", goProducts);

  document.body.classList.add("start-lock");
})();
