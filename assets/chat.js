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
    bot: { name: "메타봇", icon: "assets/chars/robot.webp", role: "큐레이터" },
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
    ["LG가전 이벤트", "📺"],
    ["가구", "🛋️"],
    ["건축 자재", "🧱"],
  ];
  // 파트너 존: 주택이 아니라 입점 업체 전시 블록 (예산 질문 대신 입점 안내)
  const PARTNER_ZONES = ["LG가전 이벤트", "가구", "건축 자재"];
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

  // 관리자에서 바꾼 존 표시 이름 반영
  function zoneDisp(cat) {
    return (window.__seumTown && window.__seumTown.zoneLabel && window.__seumTown.zoneLabel(cat)) || cat;
  }
  function renderInfoQuick() {
    quickEl.innerHTML = "";
    ZONE_INFO.forEach(([cat, emoji]) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chat__quickbtn";
      b.textContent = `${emoji} ${zoneDisp(cat)}`;
      b.addEventListener("click", () => {
        const disp = zoneDisp(cat);
        bubble(`${disp} 보러 왔어요`, "me");
        const canGo = window.__seumTown && window.__seumTown.gotoZone;
        const goBtn = canGo ? [{ label: `🚀 ${disp} 존으로 이동`, action: () => { closeChat(); window.__seumTown.gotoZone(cat); } }] : [];
        if (PARTNER_ZONES.includes(cat)) {
          botSay(`${disp} 존은 마을 ${zoneDirection(cat)}에 새로 생긴 파트너 전시 블록이에요 ${emoji}\n입점 업체를 모집 중이니 구경해보시고, 입점·제휴 문의도 환영해요!`,
            goBtn.concat([{ label: "🤝 입점·제휴 문의", action: goContact }]));
          return;
        }
        try { localStorage.setItem("seum_pref_use", cat); } catch (e) {}
        botSay(`${disp} 보러 오셨군요 ${emoji} ${disp} 존은 마을 ${zoneDirection(cat)}이에요!\n바로 데려다드릴까요? 예산대도 알려주시면 딱 맞는 집만 골라드려요.`, goBtn);
        askBudget();
      });
      quickEl.appendChild(b);
    });
    // 체험존 유도: 직접 지어보기·배워보기 포털은 전부 체험존에 모여 있다
    const bd = document.createElement("button");
    bd.type = "button";
    bd.className = "chat__quickbtn";
    bd.textContent = "🎪 직접 지어보고·배워보기 (체험존)";
    bd.addEventListener("click", () => {
      bubble("직접 지어보거나 배워보고 싶어요", "me");
      const canGo = window.__seumTown && window.__seumTown.gotoExperience;
      botSay("직접 해보고 싶으시면 체험존으로 가보세요 🎪 마을 남서쪽에 있어요!\n🔨 빌드룸 포털 — 유닛을 조립해 내 집을 만들고 실시간 견적까지\n📚 교육관 포털 — 집이 지어지는 과정을 단계별로 배워보기\n🕶️ VR룸은 준비 중이에요.", [
        canGo ? { label: "🚀 체험존으로 이동", action: () => { closeChat(); window.__seumTown.gotoExperience(); } } : null,
        { label: "🔨 빌드룸 바로 입장", action: () => {
          if (window.__seumTown && window.__seumTown.saveReturnSpot) window.__seumTown.saveReturnSpot();
          window.location.href = "build.html";
        } },
      ].filter(Boolean));
    });
    quickEl.appendChild(bd);
    // 계약 고객이면 내 집 시공 현황 바로가기
    if (window.__seumTown && window.__seumTown.hasProject) {
      const mh = document.createElement("button");
      mh.type = "button";
      mh.className = "chat__quickbtn";
      mh.textContent = "🏗️ 내 집 시공 현황 보기";
      mh.addEventListener("click", () => {
        bubble("내 집 현황 보여줘", "me");
        botSay("고객님 댁 시공 현황 페이지로 모실게요! 단계별 현장 사진과 일정을 보실 수 있어요 🏗️", [
          { label: "🏗️ 내 집 현황 열기", action: () => { window.location.href = "my.html"; } },
        ]);
      });
      quickEl.appendChild(mh);
    }
    const rv = document.createElement("button");
    rv.type = "button";
    rv.className = "chat__quickbtn";
    rv.textContent = "📅 방문 예약";
    rv.addEventListener("click", goContact);
    quickEl.appendChild(rv);
  }

  function zoneDirection(cat) {
    return {
      "전원주택": "북서 블록", "체류형 쉼터": "북동 블록", "세컨하우스": "남서 블록", "특별모델": "남동 블록",
      "LG가전 이벤트": "북동 바깥 블록", "가구": "남동 바깥 블록", "건축 자재": "북서 바깥 블록",
    }[cat] || "안쪽";
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

  // ---------- 시공 감리사 챗봇 (메타하우스 전담 감리 — 신뢰 메시지) ----------
  function openSupervisor() {
    mode = "supervisor";
    curModel = null;
    clearBody();
    setHeader("김현장 감리사 👷 · 시공 감리", "메타하우스 전담 감리");
    setHeadIcon("assets/chars/man.webp");
    panel.hidden = false;
    fab.classList.add("is-open");
    botSay(
      "안녕하세요, 메타하우스 전담 시공 감리사입니다 👷\n" +
      "메타하우스에서 계약하시는 집은 어느 시공사가 짓든 메타하우스가 배정한 전담 감리사가 기초부터 준공까지 전 과정을 직접 검수합니다.\n" +
      "건축주님은 믿고 맡겨주시면 됩니다!"
    );
    renderSupervisorQuick();
  }
  function renderSupervisorQuick() {
    quickEl.innerHTML = "";
    const add = (label, fn) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chat__quickbtn";
      b.textContent = label;
      b.addEventListener("click", fn);
      quickEl.appendChild(b);
    };
    add("🤔 감리사가 뭐예요?", () => {
      bubble("감리사가 뭐예요?", "me");
      botSay(
        "감리사는 시공이 도면과 규정대로 진행되는지 시공사와 별개의 제3자 입장에서 검사하는 건축 전문가예요.\n" +
        "보통은 건축주가 직접 감리를 알아봐야 하지만, 메타하우스는 입점 업체 시공 건마다 감리사를 자체 배정해 품질을 책임져요. 이게 메타하우스에서 계약하는 가장 큰 이유이기도 해요 💪"
      );
    });
    add("🔍 어떤 걸 검사하나요?", () => {
      bubble("어떤 걸 검사하나요?", "me");
      botSay(
        "단계마다 통과해야 다음 공정으로 넘어가요:\n" +
        "· 기초: 배근·콘크리트 강도\n" +
        "· 골조: 치수·수평·구조 접합\n" +
        "· 외장: 단열·방수·창호 시공\n" +
        "· 설비: 전기·수도·정화조 연결\n" +
        "· 마감: 내장 품질·하자 여부\n" +
        "검수 사진은 내 집 현황 페이지에 단계별로 올라가서 건축주님도 직접 확인하실 수 있어요 📸"
      );
    });
    if (window.__seumTown && window.__seumTown.hasProject) {
      add("🏗️ 내 집 검수 현황 보기", () => { window.location.href = "my.html"; });
    }
    add("📚 시공 과정 배우기", () => {
      bubble("시공 과정이 궁금해요", "me");
      const canGo = window.__seumTown && window.__seumTown.gotoExperience;
      botSay("체험존의 교육관에서 집이 지어지는 6단계를 직접 배워보실 수 있어요!", [
        canGo ? { label: "🚀 체험존으로 이동", action: () => { closeChat(); window.__seumTown.gotoExperience(); } } : null,
        { label: "📚 교육관 바로 열기", action: () => {
          if (window.__seumTown && window.__seumTown.saveReturnSpot) window.__seumTown.saveReturnSpot();
          window.location.href = "learn.html";
        } },
      ].filter(Boolean));
    });
    add("📅 방문 상담", goContact);
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
    openSupervisor,
    setContext(model) { nearModel = model || null; },
  };
})();
