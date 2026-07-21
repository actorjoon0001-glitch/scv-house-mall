// 메타하우스 교육관 — 모듈러 주택이 지어지는 과정을 단계별로 배우는 독립 화면.
// 단계 데이터는 기본값 + 관리자 설정(town_settings data.learn.steps)으로 교체 가능.
(function () {
  "use strict";

  const DEFAULT_STEPS = [
    {
      icon: "🗒️", title: "1. 상담·설계", period: "약 1~2주",
      desc: "원하는 평형·방 구성·예산을 상담하고 도면을 확정해요. 전시장 모델을 그대로 고르면 이 단계가 훨씬 짧아져요.",
      tip: "TIP. 빌드룸에서 미리 구성해 온 견적을 가져오면 상담이 빨라져요!",
    },
    {
      icon: "🏭", title: "2. 공장 제작", period: "약 3~5주",
      desc: "골조·단열·창호·외장까지 집의 대부분을 공장에서 만들어요. 날씨 영향 없이 균일한 품질로 제작되는 게 모듈러 주택의 장점이에요.",
      tip: "TIP. 제작 중에도 내장재·색상 변경 상담이 가능해요.",
    },
    {
      icon: "🧱", title: "3. 현장 기초 공사", period: "약 1주 (제작과 동시 진행)",
      desc: "집이 공장에서 만들어지는 동안 현장에서는 부지를 정리하고 기초를 시공해요. 두 작업이 동시에 진행돼 전체 공기가 짧아져요.",
      tip: "TIP. 전기·수도 인입 위치는 이 단계에서 미리 정해두는 게 좋아요.",
    },
    {
      icon: "🚚", title: "4. 운송·설치", period: "1~2일",
      desc: "완성된 모듈을 트레일러로 운송해 크레인으로 기초 위에 올려요. 아침에 도착한 집이 저녁이면 제자리에 서 있는 하이라이트 단계!",
      tip: "TIP. 진입로 폭·전선 높이 등 운송 경로는 사전 답사로 확인해드려요.",
    },
    {
      icon: "🔌", title: "5. 마감·설비 연결", period: "약 1주",
      desc: "전기·수도·정화조를 연결하고 내부 마감 상태를 꼼꼼히 점검해요. 데크·어닝 같은 외부 옵션도 이때 시공돼요.",
      tip: "TIP. 옵션 추가는 설치 후보다 계약 때 함께 정하는 게 비용이 적게 들어요.",
    },
    {
      icon: "🏡", title: "6. 준공·입주", period: "검수 후 바로",
      desc: "최종 검수를 마치면 바로 입주할 수 있어요. 상담부터 입주까지 보통 2~3개월 — 일반 건축의 절반 수준이에요.",
      tip: "TIP. 입주 후 하자 점검·A/S 절차도 상담 때 함께 안내해드려요.",
    },
  ];

  let steps = DEFAULT_STEPS;
  let cur = 0;

  const $ = (id) => document.getElementById(id);
  const progEl = $("learn-progress");

  function renderProgress() {
    progEl.innerHTML = "";
    steps.forEach((s, i) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "learn__dot" + (i === cur ? " is-active" : i < cur ? " is-done" : "");
      dot.textContent = s.icon;
      dot.title = s.title;
      dot.addEventListener("click", () => show(i));
      progEl.appendChild(dot);
      if (i < steps.length - 1) {
        const line = document.createElement("span");
        line.className = "learn__line" + (i < cur ? " is-done" : "");
        progEl.appendChild(line);
      }
    });
  }

  function show(i) {
    cur = Math.max(0, Math.min(steps.length - 1, i));
    const s = steps[cur];
    $("learn-emoji").textContent = s.icon;
    $("learn-stepno").textContent = `STEP ${cur + 1} / ${steps.length}`;
    $("learn-title").textContent = s.title.replace(/^\d+\.\s*/, "");
    $("learn-period").textContent = s.period ? `⏱ 소요 기간: ${s.period}` : "";
    $("learn-desc").textContent = s.desc || "";
    $("learn-tip").textContent = s.tip || "";
    $("learn-tip").hidden = !s.tip;
    $("learn-prev").disabled = cur === 0;
    $("learn-next").hidden = cur === steps.length - 1;
    $("learn-done").hidden = cur !== steps.length - 1;
    renderProgress();
  }

  $("learn-prev").addEventListener("click", () => show(cur - 1));
  $("learn-next").addEventListener("click", () => show(cur + 1));
  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") show(cur - 1);
    if (e.key === "ArrowRight") show(cur + 1);
  });

  const CFG = window.SeumTownConfig;
  if (CFG && CFG.logEvent) CFG.logEvent("visit_learn", "");
  show(0);

  // 관리자 설정으로 단계 교체 가능 (data.learn.steps: [{icon,title,period,desc,tip}])
  if (CFG && CFG.load) {
    CFG.load().then((loaded) => {
      const ov = loaded.data && loaded.data.learn && loaded.data.learn.steps;
      if (Array.isArray(ov) && ov.length && ov.every((s) => s && s.title)) {
        steps = ov;
        show(0);
      }
    }).catch(() => {});
  }
})();
