// ============ 카탈로그 연동 (Supabase 실사진·실모델) ============
const CATALOG_URL = "https://seum-catalog-online.netlify.app";
const SB_URL = "https://aypugjvzvwinnmpquguj.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5cHVnanZ6dndpbm5tcHF1Z3VqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1NjQ0ODIsImV4cCI6MjA4OTE0MDQ4Mn0.yLBG31-8VGWai9Rpv9RtVxZwwWMsKI_syGs0QN7PkUU";
const PAGE_SIZE = 8;

// 카탈로그 연결 실패 시 보여줄 기본 라인업 (3D 렌더)
const FALLBACK_MODELS = [
  { name: "STAY 19RB", category: "전원주택", size: "19평 · 63㎡", main_image: "assets/product-mobile-house.webp" },
  { name: "STAY 16GB", category: "전원주택", size: "16평 · 53㎡", main_image: "assets/product-stay16.webp" },
  { name: "STAY 28", category: "전원주택", size: "28평 · 92㎡", main_image: "assets/product-stay28.webp" },
  { name: "FOREST-P 10W", category: "체류형 쉼터", size: "10평 · 33㎡", main_image: "assets/product-cabin.webp" },
  { name: "FOREST 6", category: "체류형 쉼터", size: "6평 · 20㎡", main_image: "assets/product-forest6.webp" },
  { name: "CUBE-G 10W", category: "특별모델", size: "10평 · 33㎡", main_image: "assets/product-cube.webp" },
];

const grid = document.getElementById("products-grid");
const chipsEl = document.getElementById("products-filter");
const moreBtn = document.getElementById("products-more");

let io = null;
let allModels = [];
let activeCat = "all";
let shown = PAGE_SIZE;

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function detailUrl(m) {
  return m.slug ? `${CATALOG_URL}/model-detail.html?slug=${encodeURIComponent(m.slug)}` : "#contact";
}

function fmtPrice(m) {
  const won = m.event_on && m.event_price ? m.event_price : m.base_price;
  if (!won) return "가격 상담";
  const uk = Math.floor(won / 1e8);
  const man = Math.round((won % 1e8) / 1e4);
  return `${uk ? uk + "억 " : ""}${man ? man.toLocaleString() + "만" : ""}원~`;
}

function filtered() {
  return activeCat === "all" ? allModels : allModels.filter((m) => m.category === activeCat);
}

function renderChips() {
  const cats = [...new Set(allModels.map((m) => m.category).filter(Boolean))];
  chipsEl.innerHTML = [
    `<button class="chip is-active" data-cat="all">전체</button>`,
    ...cats.map((c) => `<button class="chip" data-cat="${esc(c)}">${esc(c)}</button>`),
  ].join("");
  chipsEl.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      chipsEl.querySelectorAll(".chip").forEach((c) => c.classList.remove("is-active"));
      chip.classList.add("is-active");
      activeCat = chip.dataset.cat;
      shown = PAGE_SIZE;
      render();
    });
  });
}

function render() {
  const list = filtered();
  grid.innerHTML = list
    .slice(0, shown)
    .map((m) => {
      const badge = m.event_on && m.event_label ? m.event_label : m.badge;
      const external = m.slug ? ` target="_blank" rel="noopener"` : "";
      return `
    <article class="product reveal">
      <a class="product__media" href="${detailUrl(m)}"${external}>
        <img src="${esc(m.main_image)}" alt="${esc(m.category || "")} ${esc(m.name)}" loading="lazy" />
        ${badge ? `<span class="product__badge">${esc(badge)}</span>` : ""}
      </a>
      <div class="product__info">
        <span class="product__tag">${esc(m.category || "메타하우스 모델")}</span>
        <h3 class="product__name">${esc(m.name)}</h3>
        <p class="product__spec">${esc(m.size || "")}${m.rooms ? ` · 방 ${m.rooms}` : ""}${m.bathrooms ? ` · 욕실 ${m.bathrooms}` : ""}</p>
        <p class="product__price">${fmtPrice(m)}</p>
        <div class="product__links">
          <a href="${detailUrl(m)}"${external} class="product__cta">상세보기 &rarr;</a>
          <a href="#contact" class="product__cta product__cta--muted">상담 신청</a>
        </div>
      </div>
    </article>`;
    })
    .join("");
  if (moreBtn) moreBtn.hidden = shown >= list.length;
  observeReveal();
}

if (moreBtn) {
  moreBtn.addEventListener("click", () => {
    shown += PAGE_SIZE;
    render();
  });
}

async function loadModels() {
  try {
    const res = await fetch(
      `${SB_URL}/rest/v1/models?select=slug,name,category,size,base_price,main_image,rooms,bathrooms,badge,event_on,event_price,event_label&order=created_at.asc`,
      { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } }
    );
    if (!res.ok) throw new Error("catalog fetch failed");
    const data = await res.json();
    allModels = data.filter((m) => m.main_image && m.name);
    if (!allModels.length) throw new Error("catalog empty");
  } catch (e) {
    allModels = FALLBACK_MODELS;
  }
  renderChips();
  render();
}

loadModels();

// ============ LEAD FORM (Netlify Forms) ============
const form = document.getElementById("lead-form");
if (form) {
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const ok = document.getElementById("lead-ok");
    const err = document.getElementById("lead-err");
    ok.hidden = true;
    err.hidden = true;
    const body = new URLSearchParams(new FormData(form)).toString();
    fetch("/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    })
      .then((res) => {
        if (!res.ok) throw new Error("submit failed");
        form.reset();
        ok.hidden = false;
        ok.scrollIntoView({ behavior: "smooth", block: "center" });
      })
      .catch(() => {
        err.hidden = false;
      });
  });
}

// ============ SCROLL REVEAL ============
function observeReveal() {
  if (!io) {
    io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -40px 0px" }
    );
  }
  document.querySelectorAll(".reveal:not(.is-visible)").forEach((el) => io.observe(el));
}

document
  .querySelectorAll(".head, .why__item, .gallery__item, .contact__copy, .contact__form")
  .forEach((el) => el.classList.add("reveal"));
observeReveal();

// ============ NAV STATE ON SCROLL ============
const nav = document.getElementById("nav");
const onScroll = () => {
  nav.classList.toggle("is-solid", window.scrollY > 40);
};
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();
