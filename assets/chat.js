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
    // 타운 페이지에는 상담 폼이 없으므로 랜딩의 폼으로 이동
    if (!document.getElementById("contact")) {
      window.location.href = "index.html#contact";
      return;
    }
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
        {
          label: "🏘️ 3D 타운 구경하기",
          action: () => {
            closeChat();
            if (!document.getElementById("town-stage")) window.location.href = "town.html";
          },
        },
        {
          label: "📋 라인업 보기",
          action: () => {
            closeChat();
            if (document.getElementById("products")) goSection("#products");
            else window.location.href = "index.html#products";
          },
        },
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

  // ============ 봇 캐릭터(페르소나)와 집 데이터의 분리 ============
  // 지금은 모든 집이 기본 '메타봇' 페르소나를 공유한다.
  // 나중에 카탈로그에 모델별 character 필드(예: {name, icon, tone})가 생기면
  // 그 값이 자동으로 우선 적용된다 — 집마다 코드를 만들지 않는다.
  const DEFAULT_PERSONA = { name: "메타봇", icon: "assets/chars/robot.webp", role: "큐레이터" };
  // 집 앞 큐레이터(정장 상담사) 페르소나 — 성별은 타운에서 배정(model.__curator)
  const CURATOR_PERSONAS = {
    m: { name: "준 큐레이터", icon: "assets/chars/suitman.webp", role: "" },
    f: { name: "수아 큐레이터", icon: "assets/chars/suitwoman.webp", role: "" },
  };
  function personaFor(model) {
    const c = model && model.character;
    if (c && typeof c === "object") return Object.assign({}, DEFAULT_PERSONA, c);
    const g = model && model.__curator;
    if (g && CURATOR_PERSONAS[g]) return Object.assign({}, DEFAULT_PERSONA, CURATOR_PERSONAS[g]);
    return DEFAULT_PERSONA;
  }

  const headImg = panel.querySelector(".chat__head img");
  function setHeadIcon(src) {
    if (headImg) headImg.src = src;
  }

  const headTitle = panel.querySelector(".chat__head-t strong");
  const headSub = panel.querySelector(".chat__head-t span");
  function setHeader(title, sub) {
    if (headTitle) headTitle.textContent = title;
    if (headSub) headSub.textContent = sub;
  }

  function imgBubble(url) {
    const img = document.createElement("img");
    img.src = url;
    img.alt = "";
    img.className = "chat__img";
    img.loading = "lazy";
    bodyEl.appendChild(img);
    scrollBottom();
  }

  function clearBody() {
    bodyEl.innerHTML = "";
    quickEl.innerHTML = "";
  }

  function modelPrice(m) {
    const won = m.event_on && m.event_price ? m.event_price : m.base_price;
    if (!won) return null;
    const uk = Math.floor(won / 1e8);
    const man = Math.round((won % 1e8) / 1e4);
    return `${uk ? uk + "억 " : ""}${man ? man.toLocaleString() + "만" : ""}원~`;
  }

  // ============ AI 응답 자리 (비용 통제 포함) ============
  // 서버리스 엔드포인트(예: Netlify Functions + LLM API)가 연결되면
  // 이 함수에서 fetch로 호출한다. 상한을 두어 비용을 통제한다.
  const AI_LIMITS = { maxTurns: 3, maxChars: 280 };
  let aiTurns = 0;
  async function aiAnswer(question, model) {
    if (aiTurns >= AI_LIMITS.maxTurns) return null;
    // TODO: 엔드포인트 연결 시 → aiTurns++; 응답은 AI_LIMITS.maxChars로 잘라 반환
    return null; // 미연결: 준비된 답변/매니저 안내로 폴백
  }

  // ============ 모드 상태 ============
  let mode = "general"; // general | info | curator
  let curModel = null;
  let nearModel = null; // 3D 타운에서 현재 가까이 있는 집
  let curatorTurns = 0;
  let nudged = false;

  function reserveCta(model) {
    return {
      label: "📅 방문 예약하기",
      action: () => {
        try {
          if (model) localStorage.setItem("seum_interest_model", `${model.name} (${model.category || ""})`);
        } catch (e) {}
        goContact();
      },
    };
  }

  function curatorSay(model, text, ctas) {
    curatorTurns++;
    botSay(text, ctas);
    if (curatorTurns >= 2 && !nudged) {
      nudged = true;
      setTimeout(() => {
        botSay(`${model.name}, 마음에 드세요? 실물로 보면 훨씬 좋아요. 방문 예약 잡아드릴까요? 😊`, [reserveCta(model)]);
      }, 1600);
    }
  }

  // 큐레이터 답변은 전부 "집 데이터"에서 생성 — 집마다 코드를 만들지 않는다
  function curatorFlows(m) {
    const lbl = (v, prefix) => (v ? (String(v).includes(prefix) ? String(v) : `${prefix} ${v}`) : "");
    const spec = [m.size, lbl(m.rooms, "방"), lbl(m.bathrooms, "욕실")].filter(Boolean).join(" · ");
    const price = modelPrice(m);
    return {
      price: {
        label: "💰 이 집 가격",
        keywords: /가격|얼마|비용|금액|견적|만원|예산/,
        reply: () =>
          price
            ? `${m.name}은(는) ${price}부터예요${m.event_on ? " (지금 이벤트가 적용 중! 🎉)" : ""}.\n옵션에 따라 달라지니 정확한 견적은 상담으로 안내드릴게요 💰`
            : `${m.name} 가격은 옵션 구성에 따라 안내드리고 있어요.\n상담 남겨주시면 견적 바로 보내드릴게요 💰`,
        ctas: [reserveCta(m)],
      },
      spec: {
        label: "📐 평수·구조",
        keywords: /평수|평|구조|방|욕실|크기|면적/,
        reply: () => (spec ? `${m.name}은(는) ${spec} 구성이에요 📐\n실제 공간감은 방문해서 보시는 게 최고예요!` : `구조 정보는 매니저가 도면과 함께 안내해드릴게요 📐`),
        ctas: [reserveCta(m)],
      },
      period: {
        label: "🏗️ 제작 기간",
        keywords: /기간|걸려|걸리|공사|시공|완공|입주|언제/,
        reply: () => `공장에서 약 30일이면 완성돼요. 현장 설치까지 조금 더 걸리고요 🏗️\n입주 일정 알려주시면 맞춰 도와드릴게요!`,
        ctas: [reserveCta(m)],
      },
      land: {
        label: "🏞️ 토지 관련",
        keywords: /땅|토지|부지|대지|농지|인허가|허가/,
        reply: () => `토지가 없어도 괜찮아요! 부지 검토부터 인허가까지 같이 도와드려요 🏞️`,
        ctas: [reserveCta(m)],
      },
      feature: {
        label: "✨ 이 집 특징",
        keywords: /특징|장점|어때|좋아|추천|왜/,
        reply: () => {
          const feats = Array.isArray(m.features) && m.features.length ? m.features.slice(0, 4).join(" · ") : "";
          return (
            m.short_description ||
            (feats ? `${m.name}의 포인트: ${feats} ✨` : `${m.name}은(는) ${m.category || "메타하우스"} 라인의 인기 모델이에요 ✨`)
          );
        },
        ctas: [{ label: "🖼️ 사진 보기", action: () => { if (m.main_image) imgBubble(m.main_image); } }, reserveCta(m)],
      },
    };
  }

  function renderCuratorQuick(m) {
    const flows = curatorFlows(m);
    quickEl.innerHTML = "";
    Object.values(flows).forEach((f) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chat__quickbtn";
      b.textContent = f.label;
      b.addEventListener("click", () => { bubble(f.label.replace(/^[^ ]+ /, ""), "me"); curatorSay(m, f.reply(), f.ctas); });
      quickEl.appendChild(b);
    });
    const rb = document.createElement("button");
    rb.type = "button";
    rb.className = "chat__quickbtn";
    rb.textContent = "📅 방문 예약";
    rb.addEventListener("click", reserveCta(m).action);
    quickEl.appendChild(rb);
  }

  function openCurator(model) {
    if (!model) return openChat();
    const p = personaFor(model);
    mode = "curator";
    curModel = model;
    curatorTurns = 0;
    nudged = false;
    clearBody();
    setHeader(`${p.name} · ${model.name}${p.role ? " " + p.role : ""}`, `${model.category || "메타하우스"} 전문 안내`);
    setHeadIcon(p.icon);
    panel.hidden = false;
    fab.classList.add("is-open");
    if (model.main_image) imgBubble(model.main_image);
    const price = modelPrice(model);
    botSay(`안녕하세요, ${model.name} 담당 ${p.name}예요 😊\n${model.size ? model.size + " · " : ""}${price ? price : "가격 상담"} — 이 집에 대해 뭐든 물어보세요!`);
    renderCuratorQuick(model);
  }

  // ============ 인포메이션(마을 안내) 모드 ============
  const ZONE_INFO = [
    ["전원주택", "🏡"],
    ["세컨하우스", "🏠"],
    ["체류형 쉼터", "🌿"],
    ["특별모델", "⛳"],
  ];
  const BUDGETS = ["5천만 이하", "5천~8천", "8천~1억", "1억 이상"];

  function askBudget() {
    quickEl.innerHTML = "";
    BUDGETS.forEach((b) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chat__quickbtn";
      btn.textContent = `💰 ${b}`;
      btn.addEventListener("click", () => {
        bubble(b, "me");
        try { localStorage.setItem("seum_pref_budget", b); } catch (e) {}
        botSay(`좋아요, ${b} 기준으로 봐드릴게요! 상담 연결하면 예산에 맞는 모델을 추려서 안내드려요 😊`, [
          { label: "📞 상담 연결", action: goContact },
        ]);
        renderInfoQuick();
      });
      quickEl.appendChild(btn);
    });
  }

  function renderInfoQuick() {
    quickEl.innerHTML = "";
    ZONE_INFO.forEach(([cat, emoji]) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chat__quickbtn";
      b.textContent = `${emoji} ${cat}`;
      b.addEventListener("click", () => {
        bubble(`${cat} 보러 왔어요`, "me");
        try { localStorage.setItem("seum_pref_use", cat); } catch (e) {}
        const canGo = window.__seumTown && window.__seumTown.gotoZone;
        botSay(`${cat} 보러 오셨군요 ${emoji} ${cat} 존은 마을 ${zoneDirection(cat)}이에요!\n바로 데려다드릴까요? 예산대도 알려주시면 딱 맞는 집만 골라드려요.`,
          canGo ? [{ label: `🚀 ${cat} 존으로 이동`, action: () => { closeChat(); window.__seumTown.gotoZone(cat); } }] : []);
        askBudget();
      });
      quickEl.appendChild(b);
    });
    const rv = document.createElement("button");
    rv.type = "button";
    rv.className = "chat__quickbtn";
    rv.textContent = "📅 방문 예약";
    rv.addEventListener("click", goContact);
    quickEl.appendChild(rv);
  }

  function zoneDirection(cat) {
    return { "전원주택": "북서 블록", "체류형 쉼터": "북동 블록", "세컨하우스": "남서 블록", "특별모델": "남동 블록" }[cat] || "안쪽";
  }

  function openInfo() {
    mode = "info";
    curModel = null;
    clearBody();
    setHeader("메타봇 🤖 · 마을 안내", "인포메이션");
    setHeadIcon(DEFAULT_PERSONA.icon);
    panel.hidden = false;
    fab.classList.add("is-open");
    botSay("어서 오세요! 메타하우스 3D 마을 인포메이션이에요 🤖\n어떤 용도의 집을 보러 오셨어요? 맞는 존으로 안내해드릴게요!");
    renderInfoQuick();
  }

  function openChat() {
    // 3D 타운에서 집 근처면 그 집 큐레이터로, 타운이면 인포로, 그 외엔 일반 모드
    if (nearModel) return openCurator(nearModel);
    if (mode === "curator" && curModel) {
      panel.hidden = false;
      fab.classList.add("is-open");
      setTimeout(scrollBottom, 100);
      return;
    }
    if (document.getElementById("town-stage") && mode !== "general") return openInfo();
    mode = "general";
    setHeader("메타봇 🤖", "무엇이든 물어보세요");
    setHeadIcon(DEFAULT_PERSONA.icon);
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
      if (mode === "curator" && curModel) {
        bubble(t, "me");
        const flows = curatorFlows(curModel);
        for (const f of Object.values(flows)) {
          if (f.keywords.test(t)) { curatorSay(curModel, f.reply(), f.ctas); return; }
        }
        aiAnswer(t, curModel).then((ans) => {
          if (ans) curatorSay(curModel, ans.slice(0, AI_LIMITS.maxChars));
          else curatorSay(curModel, "음, 그건 매니저가 정확히 안내해드릴게요 🤖\n방문 예약 남겨주시면 꼼꼼하게 답변드려요!", [reserveCta(curModel)]);
        });
        return;
      }
      handleFree(t);
    });
  }

  // 3D 타운 연동 훅: 근접 컨텍스트(큐레이터), 인포 열기
  window.__metaChat = {
    open: openChat,
    close: closeChat,
    openInfo,
    openCurator,
    setContext(model) { nearModel = model || null; },
  };
})();
