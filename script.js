// ============ PRODUCT DATA ============
const products = [
  { id: 1, brand: "SECHAN WOOD", name: "프리미엄 원목마루 (오크)", price: 89000, was: 109000, unit: "/㎡", badge: "NEW", cat: "floor", shade: 1,
    img: "https://images.unsplash.com/photo-1615873968403-89e068629265?w=800&q=80&auto=format&fit=crop" },
  { id: 2, brand: "IMPORT TILE", name: "포세린 대형 타일 600×1200", price: 42000, unit: "/㎡", badge: null, cat: "tile", shade: 2,
    img: "https://images.unsplash.com/photo-1600566752355-35792bedcfea?w=800&q=80&auto=format&fit=crop" },
  { id: 3, brand: "SECHAN DOOR", name: "시스템 단열 현관도어", price: 1250000, unit: "/EA", badge: "BEST", cat: "door", shade: 3,
    img: "https://images.unsplash.com/photo-1558002038-1055907df827?w=800&q=80&auto=format&fit=crop" },
  { id: 4, brand: "THERMO", name: "고성능 압출 단열재 XPS", price: 18000, unit: "/장", badge: null, cat: "insul", shade: 4,
    img: "https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=800&q=80&auto=format&fit=crop" },
  { id: 5, brand: "IMPORT TILE", name: "이탈리아 수입 포세린", price: 68000, unit: "/㎡", badge: "직수입", cat: "tile", shade: 5,
    img: "https://images.unsplash.com/photo-1615529328331-f8917597711f?w=800&q=80&auto=format&fit=crop" },
  { id: 6, brand: "SECHAN WOOD", name: "강화 강마루 (내수합판)", price: 39000, was: 47000, unit: "/㎡", badge: null, cat: "floor", shade: 6,
    img: "https://images.unsplash.com/photo-1585128792020-803d29415281?w=800&q=80&auto=format&fit=crop" },
  { id: 7, brand: "SYSTEM WIN", name: "알루미늄 시스템 창호", price: 320000, unit: "/㎡", badge: "BEST", cat: "door", shade: 7,
    img: "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?w=800&q=80&auto=format&fit=crop" },
  { id: 8, brand: "THERMO", name: "준불연 그라스울 단열재", price: 12000, unit: "/장", badge: null, cat: "insul", shade: 8,
    img: "https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=800&q=80&auto=format&fit=crop" },
];

const fmt = (n) => "₩ " + n.toLocaleString("ko-KR");

const grid = document.getElementById("products");

let io = null;

function render(list) {
  grid.innerHTML = list
    .map(
      (p) => `
    <a href="#" class="product reveal" data-cat="${p.cat}">
      <div class="product__media" data-shade="${p.shade}">
        <img class="product__img" src="${p.img}" alt="${p.brand} ${p.name}" loading="lazy" />
        ${p.badge ? `<span class="product__badge">${p.badge}</span>` : ""}
        <button class="product__wish" aria-label="Wishlist" onclick="event.preventDefault(); this.classList.toggle('is-on');">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M12 21s-7-4.5-9.3-9.2C1.3 8.5 3 5 6.3 5c2 0 3.4 1 4.7 2.6.5.6 1.1.6 1.6 0C13.9 6 15.3 5 17.3 5c3.3 0 5 3.5 3.6 6.8C19 16.5 12 21 12 21z"/></svg>
        </button>
        <span class="product__quick">Quick View</span>
      </div>
      <div class="product__info">
        <span class="product__brand">${p.brand}</span>
        <h3 class="product__name">${p.name}</h3>
        <div class="product__price">
          ${p.was ? `<s>${fmt(p.was)}</s>` : ""}${fmt(p.price)}${p.unit || ""}
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

// ============ BAG COUNTER ============
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
  nav.style.boxShadow = window.scrollY > 10 ? "0 12px 30px rgba(0,0,0,.35)" : "none";
};
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();
