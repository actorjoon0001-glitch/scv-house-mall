// ============ PRODUCT DATA ============
const products = [
  { id: 1, brand: "Maison Margiela", name: "Oversized Wool Topcoat", price: 2480000, was: 2980000, badge: "NEW", cat: "outer", shade: 1 },
  { id: 2, brand: "The Row", name: "Cashmere Crewneck", price: 1290000, badge: null, cat: "knit", shade: 2 },
  { id: 3, brand: "Bottega Veneta", name: "Intrecciato Tote", price: 4150000, badge: "LIMITED", cat: "bag", shade: 3 },
  { id: 4, brand: "Saint Laurent", name: "Leather Chelsea Boot", price: 1680000, badge: null, cat: "shoes", shade: 4 },
  { id: 5, brand: "Lemaire", name: "Croissant Shoulder Bag", price: 1320000, badge: "NEW", cat: "bag", shade: 5 },
  { id: 6, brand: "Jil Sander", name: "Tailored Wool Trouser", price: 980000, badge: null, cat: "outer", shade: 6 },
  { id: 7, brand: "Loewe", name: "Anagram Wool Knit", price: 1450000, badge: "EXCLUSIVE", cat: "knit", shade: 7 },
  { id: 8, brand: "Prada", name: "Re-Nylon Loafer", price: 1290000, badge: null, cat: "shoes", shade: 8 },
];

const fmt = (n) => "₩ " + n.toLocaleString("ko-KR");

const grid = document.getElementById("products");

function render(list) {
  grid.innerHTML = list
    .map(
      (p) => `
    <a href="#" class="product reveal" data-cat="${p.cat}">
      <div class="product__media" data-shade="${p.shade}">
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
          ${p.was ? `<s>${fmt(p.was)}</s>` : ""}${fmt(p.price)}
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
let io;
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
