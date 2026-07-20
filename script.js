// ============ MODEL DATA (실제 세움 라인업) ============
const products = [
  { id: 1, tag: "이동식 주택", name: "STAY 19RB", size: "19평 · 63㎡", spec: "방 3 · 욕실 2", cat: "stay",
    img: "assets/product-mobile-house.webp" },
  { id: 2, tag: "이동식 주택", name: "STAY 16GB", size: "16평 · 53㎡", spec: "방 2 · 욕실 1", cat: "stay",
    img: "assets/product-stay16.webp" },
  { id: 3, tag: "이동식 주택", name: "STAY 28", size: "28평 · 92㎡", spec: "방 3 · 욕실 2", cat: "stay",
    img: "assets/product-stay28.webp" },
  { id: 4, tag: "체류형 쉼터", name: "FOREST-P 10W", size: "10평 · 33㎡", spec: "원룸 · 데크", cat: "forest",
    img: "assets/product-cabin.webp" },
  { id: 5, tag: "체류형 쉼터", name: "FOREST 6", size: "6평 · 20㎡", spec: "원룸 · 농막형", cat: "forest",
    img: "assets/product-forest6.webp" },
  { id: 6, tag: "특수공간", name: "CUBE-G 10W", size: "10평 · 33㎡", spec: "스크린골프 · 큐브", cat: "cube",
    img: "assets/product-cube.webp" },
];

const grid = document.getElementById("products-grid");

let io = null;

function render(list) {
  grid.innerHTML = list
    .map(
      (p) => `
    <article class="product reveal" data-cat="${p.cat}">
      <div class="product__media">
        <img src="${p.img}" alt="${p.tag} ${p.name}" loading="lazy" />
      </div>
      <div class="product__info">
        <span class="product__tag">${p.tag}</span>
        <h3 class="product__name">${p.name}</h3>
        <p class="product__spec">${p.size} · ${p.spec}</p>
        <a href="#contact" class="product__cta">가격 상담 &rarr;</a>
      </div>
    </article>`
    )
    .join("");
  observeReveal();
}

render(products);

// ============ FILTER ============
document.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    document.querySelectorAll(".chip").forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    const f = chip.dataset.filter;
    const list = f === "all" ? products : products.filter((p) => p.cat === f);
    render(list);
  });
});

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
