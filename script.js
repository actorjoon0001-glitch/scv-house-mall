// ============ MODEL DATA ============
const products = [
  { id: 1, tag: "컨테이너하우스", name: "컨테이너하우스 20ft 스튜디오", size: "20ft · 16㎡", spec: "원룸 · 욕실 1", price: 3900, from: true, badge: "BEST", cat: "container", shade: 1,
    img: "https://images.unsplash.com/photo-1449844908441-8829872d2607?w=800&q=80&auto=format&fit=crop" },
  { id: 2, tag: "모듈러주택", name: "모듈러 원룸 32㎡", size: "32㎡ · 10평", spec: "1.5룸 · 욕실 1", price: 6800, from: true, badge: "NEW", cat: "modular", shade: 2,
    img: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80&auto=format&fit=crop" },
  { id: 3, tag: "체류형 쉼터", name: "체류형 쉼터 팜빌라 (농막형)", size: "20㎡ · 6평", spec: "원룸 · 데크 포함", price: 3200, from: true, badge: null, cat: "stay", shade: 3,
    img: "https://images.unsplash.com/photo-1416331108676-a22ccb276e35?w=800&q=80&auto=format&fit=crop" },
  { id: 4, tag: "컨테이너하우스", name: "컨테이너하우스 40ft 2룸", size: "40ft · 30㎡", spec: "2룸 · 욕실 1", price: 6500, from: true, badge: null, cat: "container", shade: 4,
    img: "https://images.unsplash.com/photo-1510798831971-661eb04b3739?w=800&q=80&auto=format&fit=crop" },
  { id: 5, tag: "모듈러주택", name: "모듈러 듀플렉스 66㎡", size: "66㎡ · 20평", spec: "3룸 · 욕실 2", price: 12800, from: true, badge: "인기", cat: "modular", shade: 5,
    img: "https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=800&q=80&auto=format&fit=crop" },
  { id: 6, tag: "이동식주택", name: "이동식 우드캐빈 A타입", size: "26㎡ · 8평", spec: "원룸 · 다락", price: 4900, from: true, badge: null, cat: "move", shade: 6,
    img: "https://images.unsplash.com/photo-1523217582562-09d0def993a6?w=800&q=80&auto=format&fit=crop" },
  { id: 7, tag: "체류형 쉼터", name: "스테이 큐브 프리미엄", size: "24㎡ · 7평", spec: "원룸 · 통창", price: 5400, from: true, badge: "NEW", cat: "stay", shade: 7,
    img: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=80&auto=format&fit=crop" },
  { id: 8, tag: "모듈러주택", name: "모듈러 오피스 · 상가형", size: "48㎡ · 14평", spec: "오픈형 · 화장실 1", price: 8900, from: true, badge: null, cat: "modular", shade: 8,
    img: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80&auto=format&fit=crop" },
];

const fmt = (n) => n.toLocaleString("ko-KR") + "만원";

const grid = document.getElementById("products");

let io = null;

function render(list) {
  grid.innerHTML = list
    .map(
      (p) => `
    <a href="#" class="product reveal" data-cat="${p.cat}">
      <div class="product__media" data-shade="${p.shade}">
        <img class="product__img" src="${p.img}" alt="${p.tag} ${p.name}" loading="lazy" />
        ${p.badge ? `<span class="product__badge">${p.badge}</span>` : ""}
        <button class="product__wish" aria-label="관심 모델" onclick="event.preventDefault(); this.classList.toggle('is-on');">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 21s-7-4.5-9.3-9.2C1.3 8.5 3 5 6.3 5c2 0 3.4 1 4.7 2.6.5.6 1.1.6 1.6 0C13.9 6 15.3 5 17.3 5c3.3 0 5 3.5 3.6 6.8C19 16.5 12 21 12 21z"/></svg>
        </button>
        <span class="product__quick">자세히 보기</span>
      </div>
      <div class="product__info">
        <span class="product__brand">${p.tag}</span>
        <h3 class="product__name">${p.name}</h3>
        <p class="product__meta">${p.size} · ${p.spec}</p>
        <div class="product__price">
          ${p.was ? `<s>${fmt(p.was)}</s>` : ""}${fmt(p.price)}${p.from ? " ~" : ""}
        </div>
      </div>
    </a>`
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

// ============ WISHLIST COUNTER ============
let bag = 0;
const bagCount = document.querySelector(".bag__count");
document.addEventListener("click", (e) => {
  const wish = e.target.closest(".product__wish");
  if (wish && wish.classList.contains("is-on")) {
    bag++;
    bagCount.textContent = bag;
    bagCount.animate(
      [
        { transform: "scale(1)" },
        { transform: "scale(1.4)" },
        { transform: "scale(1)" },
      ],
      { duration: 350, easing: "cubic-bezier(.2,.7,.2,1)" }
    );
  }
});

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

// Mark sections as revealable
document
  .querySelectorAll(".section-head, .cat, .post, .look, .value, .hero__card")
  .forEach((el) => el.classList.add("reveal"));
observeReveal();

// ============ NAV SHADOW ON SCROLL ============
const nav = document.getElementById("nav");
const onScroll = () => {
  nav.style.boxShadow = window.scrollY > 10 ? "0 10px 30px rgba(20,18,12,.12)" : "none";
};
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();
