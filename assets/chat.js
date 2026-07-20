// ============ 메타봇 상담 채팅 ============
// 방문자 질문에 답하며 자연스럽게 상담(방문예약 폼)으로 유도하는 규칙 기반 챗봇.
(function () {
  const fab = document.getElementById("chat-fab");
  const panel = document.getElementById("chat-panel");
  const bodyEl = document.getElementById("chat-body");
  const quickEl = document.getElementById("chat-quick");
  const closeBtn = document.getElementById("chat-close");
  const formEl = document.getElementById("chat-form");
  const inputEl = document.getElementById("chat-input");
  if (!fab || !panel) return;

  let greeted = false;

  function scrollBottom() {
    bodyEl.scrollTop = bodyEl.scrollHeight;
  }

  function bubble(text, who) {
    const div = document.createElement("div");
    div.className = `chat__msg chat__msg--${who}`;
    div.textContent = text;
    bodyEl.appendChild(div);
    scrollBottom();
    return div;
  }

  function botSay(text, ctas) {
    const typing = bubble("···", "bot");
    typing.classList.add("chat__msg--typing");
    setTimeout(() => {
      typing.classList.remove("chat__msg--typing");
      typing.textContent = text;
      if (ctas && ctas.length) {
        const row = document.createElement("div");
        row.className = "chat__ctas";
        ctas.forEach((c) => {
          const b = document.createElement("button");
          b.type = "button";
          b.className = "chat__cta";
          b.textContent = c.label;
          b.addEventListener("click", c.action);
          row.appendChild(b);
        });
        bodyEl.appendChild(row);
      }
      scrollBottom();
    }, 450 + Math.random() * 350);
  }

  function goSection(sel) {
    const el = document.querySelector(sel);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  }

  function goContact() {
    closeChat();
    goSection("#contact");
    setTimeout(() => {
      const name = document.getElementById("name");
      if (name) name.focus({ preventScroll: true });
    }, 900);
  }

  function stayMinPrice() {
    const ms = window.__seumModels || [];
    const prices = ms
      .filter((m) => /^stay/i.test(m.name || "") && m.base_price)
      .map((m) => m.base_price)
      .sort((a, b) => a - b);
    const won = prices[0];
    return won ? `${Math.round(won / 1e4).toLocaleString()}만원` : "3,300만원";
  }

  function modelCount() {
    const n = (window.__seumModels || []).length;
    return n ? `${n}종` : "30여 종";
  }

  const CONSULT_CTA = { label: "📞 상담 신청하기", action: goContact };

  const FLOWS = {
    price: {
      label: "💰 가격이 궁금해요",
      keywords: /가격|얼마|비용|금액|견적|만원|예산/,
      reply: () =>
        `모델과 평수, 옵션에 따라 달라요. STAY 시리즈는 ${stayMinPrice()}부터 시작해요.\n원하시는 평수·예산 알려주시면 딱 맞는 모델이랑 견적 안내해드릴게요! 💰`,
      ctas: [{ label: "📝 상담 신청하고 견적 받기", action: goContact }],
    },
    period: {
      label: "🏗️ 얼마나 걸려요?",
      keywords: /기간|걸려|걸리|공사|시공|완공|입주|언제/,
      reply: () =>
        "공장에서 약 30일이면 완성돼요. 현장 설치까지 하면 조금 더 걸리고요.\n언제쯤 입주 생각하세요? 일정 맞춰 도와드릴게요 🏗️",
      ctas: [CONSULT_CTA],
    },
    region: {
      label: "🌏 우리 지역도 되나요?",
      keywords: /지역|어디|지방|가능한 곳|배송|운송/,
      reply: () =>
        "전국 어디든 시공 가능해요! 어느 지역에 놓으실 건가요?\n지역 알려주시면 담당 매니저가 상담해드릴게요 🌏",
      ctas: [CONSULT_CTA],
    },
    land: {
      label: "🏞️ 땅이 없어도 되나요?",
      keywords: /땅|토지|부지|대지|농지|인허가|허가/,
      reply: () =>
        "네, 토지가 없어도 괜찮아요! 부지 검토부터 인허가까지 함께 도와드리고 있어요 🏞️\n편하게 상담부터 받아보세요.",
      ctas: [CONSULT_CTA],
    },
    models: {
      label: "🏠 어떤 모델이 있어요?",
      keywords: /모델|종류|어떤 집|라인업|평수|스타일/,
      reply: () =>
        `전원주택·세컨하우스·체류형 쉼터·특별모델까지 ${modelCount()} 모델이 있어요! 🏠\n3D 타운에서 메타봇이랑 같이 직접 구경할 수도 있어요.`,
      ctas: [
        { label: "🏘️ 3D 타운 구경하기", action: () => { closeChat(); goSection("#viewer"); } },
        { label: "📋 라인업 보기", action: () => { closeChat(); goSection("#products"); } },
      ],
    },
    consult: {
      label: "📞 상담 신청할래요",
      keywords: /상담|전화|연락|예약|신청|매니저/,
      reply: () =>
        "좋아요! 아래 폼에 연락처만 남겨주시면 담당 매니저가 바로 연락드려요 📞\n상담은 무료예요!",
      ctas: [{ label: "📝 상담 폼으로 이동", action: goContact }],
    },
  };

  function renderQuick() {
    quickEl.innerHTML = "";
    Object.entries(FLOWS).forEach(([key, f]) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chat__quickbtn";
      b.textContent = f.label;
      b.addEventListener("click", () => runFlow(key, true));
      quickEl.appendChild(b);
    });
  }

  function runFlow(key, echo) {
    const f = FLOWS[key];
    if (!f) return;
    if (echo) bubble(f.label.replace(/^[^ ]+ /, ""), "me");
    botSay(f.reply(), f.ctas);
  }

  function handleFree(text) {
    bubble(text, "me");
    for (const [key, f] of Object.entries(FLOWS)) {
      if (f.keywords && f.keywords.test(text)) {
        botSay(f.reply(), f.ctas);
        return;
      }
    }
    botSay(
      "음, 그 부분은 제가 정확히 안내하기 어려워요 🤖\n담당 매니저가 확실하게 안내해드릴게요!",
      [CONSULT_CTA]
    );
  }

  function openChat() {
    panel.hidden = false;
    fab.classList.add("is-open");
    if (!greeted) {
      greeted = true;
      botSay("안녕하세요! 저는 메타봇이에요 🤖 집 고르는 거 도와드릴게요!");
      renderQuick();
    }
    setTimeout(scrollBottom, 100);
  }

  function closeChat() {
    panel.hidden = true;
    fab.classList.remove("is-open");
  }

  fab.addEventListener("click", () => (panel.hidden ? openChat() : closeChat()));
  if (closeBtn) closeBtn.addEventListener("click", closeChat);
  if (formEl) {
    formEl.addEventListener("submit", (e) => {
      e.preventDefault();
      const t = (inputEl.value || "").trim();
      if (!t) return;
      inputEl.value = "";
      handleFree(t);
    });
  }

  // 3D 타운의 NPC 메타봇 근접 시 열기 위한 훅
  window.__metaChat = { open: openChat, close: closeChat };
})();
