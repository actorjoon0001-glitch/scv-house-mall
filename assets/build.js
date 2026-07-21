// ============ METAHOUSE 빌드룸 (레벨 1: 모듈러 유닛 조립 + 기본 옵션 + 실시간 견적) ============
// 마을과 완전히 분리된 전용 화면. 유닛·옵션·가격은 Supabase(town_settings data.build)로
// 오버라이드 가능하며, 아래 DEFAULT_*는 데이터가 없을 때의 폴백이다.
import * as THREE from "three";

const stage = document.getElementById("build-stage");
const canvas = document.getElementById("build-canvas");
const loadingEl = document.getElementById("build-loading");
const CFG = window.SeumTownConfig;

// ---------- 유닛·옵션 기본 데이터 (Supabase data.build.units / data.build.options로 교체 가능) ----------
// price: 만원 단위, w/d: 미터 (격자 1.5m 배수)
const DEFAULT_UNITS = [
  { id: "living", label: "거실동", w: 6, d: 3, price: 1900, icon: "🛋️" },
  { id: "bed", label: "침실동", w: 3, d: 3, price: 1050, icon: "🛏️" },
  { id: "kitchen", label: "주방동", w: 3, d: 3, price: 1250, icon: "🍳" },
  { id: "bath", label: "욕실동", w: 1.5, d: 3, price: 780, icon: "🛁" },
];
const DEFAULT_OPTIONS = {
  siding: [
    { id: "white", label: "화이트 마감", add: 0, color: 0xf2efe8 },
    { id: "wood", label: "우드 마감", add: 150, color: 0xb98f62 },
    { id: "dark", label: "다크 메탈", add: 220, color: 0x4a5054 },
  ],
  roof: [
    { id: "flat", label: "평지붕", add: 0 },
    { id: "gable", label: "박공지붕", add: 120 },
  ],
  deck: { label: "우드 데크", add: 180 },
  garden: { label: "기본 조경", add: 90 },
};
let UNITS = DEFAULT_UNITS;
let OPTIONS = DEFAULT_OPTIONS;

const GRID = 1.5; // 스냅 격자 (m)
const LOT_W = 21, LOT_D = 15; // 부지 크기

// ---------- 씬 ----------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xdcecf5);
scene.fog = new THREE.Fog(0xdcecf5, 60, 140);
const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 300);

const hemi = new THREE.HemisphereLight(0xeaf4ff, 0x9db98a, 0.9);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff3e0, 2.0);
sun.position.set(16, 24, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -20; sun.shadow.camera.right = 20;
sun.shadow.camera.top = 20; sun.shadow.camera.bottom = -20;
scene.add(sun);

// 주변 잔디 + 부지
const lawn = new THREE.Mesh(
  new THREE.PlaneGeometry(240, 240),
  new THREE.MeshStandardMaterial({ color: 0x9cc47e, roughness: 1 })
);
lawn.rotation.x = -Math.PI / 2;
lawn.position.y = -0.02;
lawn.receiveShadow = true;
scene.add(lawn);
const lot = new THREE.Mesh(
  new THREE.PlaneGeometry(LOT_W, LOT_D),
  new THREE.MeshStandardMaterial({ color: 0xd9d2c0, roughness: 0.95 })
);
lot.rotation.x = -Math.PI / 2;
lot.receiveShadow = true;
scene.add(lot);
const grid = new THREE.GridHelper(Math.max(LOT_W, LOT_D), Math.max(LOT_W, LOT_D) / GRID, 0xb9b19c, 0xcac2ac);
grid.scale.set(LOT_W / Math.max(LOT_W, LOT_D), 1, LOT_D / Math.max(LOT_W, LOT_D));
grid.position.y = 0.01;
scene.add(grid);

// ---------- 상태 ----------
let placed = []; // { uid, typeId, x, z, rot, group }
let uidSeq = 1;
let selected = null;
let opt = { siding: "white", roof: "flat", deck: false, garden: false };
let deckGroup = null, gardenGroup = null;

const sidingOf = () => OPTIONS.siding.find((s) => s.id === opt.siding) || OPTIONS.siding[0];

// ---------- 유닛 메시 ----------
function unitDef(typeId) {
  return UNITS.find((u) => u.id === typeId) || UNITS[0];
}
function buildUnitMesh(u) {
  const g = new THREE.Group();
  const wallMat = new THREE.MeshStandardMaterial({ color: sidingOf().color, roughness: 0.85 });
  const H = 2.7;
  const body = new THREE.Mesh(new THREE.BoxGeometry(u.w, H, u.d), wallMat);
  body.position.y = H / 2 + 0.15;
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);
  // 기초
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(u.w + 0.2, 0.3, u.d + 0.2),
    new THREE.MeshStandardMaterial({ color: 0x8d8d85, roughness: 1 })
  );
  base.position.y = 0.15;
  g.add(base);
  // 창문 (남쪽 면) + 현관(거실동만)
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x30414d, roughness: 0.2, metalness: 0.4 });
  const winCount = Math.max(1, Math.round(u.w / 3));
  for (let i = 0; i < winCount; i++) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.1, 0.06), glassMat);
    win.position.set(-u.w / 2 + (i + 0.5) * (u.w / winCount), 1.65, u.d / 2 + 0.02);
    g.add(win);
  }
  if (u.id === "living") {
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.95, 2.05, 0.07), new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 0.6 }));
    door.position.set(u.w / 2 - 0.85, 1.2, u.d / 2 + 0.03);
    g.add(door);
  }
  // 지붕 (옵션)
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x3c4348, roughness: 0.7 });
  if (opt.roof === "gable") {
    const shape = new THREE.Shape();
    shape.moveTo(-u.w / 2 - 0.25, 0);
    shape.lineTo(u.w / 2 + 0.25, 0);
    shape.lineTo(0, Math.min(1.2, u.w * 0.22));
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: u.d + 0.5, bevelEnabled: false });
    geo.translate(0, 0, -(u.d + 0.5) / 2);
    const roof = new THREE.Mesh(geo, roofMat);
    roof.position.y = H + 0.15;
    roof.castShadow = true;
    g.add(roof);
  } else {
    const roof = new THREE.Mesh(new THREE.BoxGeometry(u.w + 0.4, 0.18, u.d + 0.4), roofMat);
    roof.position.y = H + 0.24;
    roof.castShadow = true;
    g.add(roof);
  }
  return g;
}
function refreshUnitMeshes() {
  placed.forEach((p) => {
    const old = p.group;
    p.group = buildUnitMesh(unitDef(p.typeId));
    p.group.position.set(p.x, 0, p.z);
    p.group.rotation.y = (p.rot * Math.PI) / 180;
    scene.remove(old);
    scene.add(p.group);
  });
  refreshSelectionRing();
}

// ---------- 배치/선택 ----------
const ring = new THREE.Mesh(
  new THREE.RingGeometry(0.4, 0.55, 32),
  new THREE.MeshBasicMaterial({ color: 0xf0c674, transparent: true, opacity: 0.9, side: THREE.DoubleSide })
);
ring.rotation.x = -Math.PI / 2;
ring.visible = false;
scene.add(ring);
function refreshSelectionRing() {
  if (!selected) { ring.visible = false; setSelBtns(false); return; }
  const u = unitDef(selected.typeId);
  ring.visible = true;
  ring.scale.setScalar(Math.max(u.w, u.d) * 0.72);
  ring.position.set(selected.x, 0.03, selected.z);
  setSelBtns(true);
}
function setSelBtns(on) {
  document.getElementById("build-rot").disabled = !on;
  document.getElementById("build-del").disabled = !on;
}
const snap = (v) => Math.round(v / GRID) * GRID;
function clampToLot(u, x, z, rot) {
  const w = rot % 180 === 0 ? u.w : u.d;
  const d = rot % 180 === 0 ? u.d : u.w;
  return [
    Math.max(-LOT_W / 2 + w / 2, Math.min(LOT_W / 2 - w / 2, x)),
    Math.max(-LOT_D / 2 + d / 2, Math.min(LOT_D / 2 - d / 2, z)),
  ];
}
function addUnit(typeId, px, pz, rot) {
  const u = unitDef(typeId);
  let x = px != null ? px : 0, z = pz != null ? pz : 0;
  // 빈 자리 찾기 (겹치면 동쪽으로 이동)
  for (let k = 0; k < 24 && overlapsAny(u, x, z, rot || 0, null); k++) x += GRID;
  [x, z] = clampToLot(u, snap(x), snap(z), rot || 0);
  const p = { uid: uidSeq++, typeId, x, z, rot: rot || 0, group: buildUnitMesh(u) };
  p.group.position.set(x, 0, z);
  p.group.rotation.y = (p.rot * Math.PI) / 180;
  scene.add(p.group);
  placed.push(p);
  selected = p;
  refreshSelectionRing();
  refreshQuote();
  return p;
}
function footprint(u, rot) {
  return rot % 180 === 0 ? [u.w, u.d] : [u.d, u.w];
}
function overlapsAny(u, x, z, rot, ignore) {
  const [w, d] = footprint(u, rot);
  return placed.some((p) => {
    if (p === ignore) return false;
    const pu = unitDef(p.typeId);
    const [pw, pd] = footprint(pu, p.rot);
    return Math.abs(p.x - x) < (w + pw) / 2 - 0.01 && Math.abs(p.z - z) < (d + pd) / 2 - 0.01;
  });
}

// ---------- 카메라 (궤도 + 줌) ----------
let az = 0.6, el = 0.85, dist = 26;
function applyCam() {
  camera.position.set(
    Math.sin(az) * Math.cos(el) * dist,
    Math.sin(el) * dist,
    Math.cos(az) * Math.cos(el) * dist
  );
  camera.lookAt(0, 1, 0);
}
applyCam();

// ---------- 입력 (선택/드래그/궤도) ----------
const ray = new THREE.Raycaster();
const ptr = new THREE.Vector2();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
let dragging = null; // { p, offX, offZ } | { orbit: true, sx, sy, saz, sel }
let pinch = null;
function ptrPos(e) {
  const r = canvas.getBoundingClientRect();
  ptr.x = ((e.clientX - r.left) / r.width) * 2 - 1;
  ptr.y = -((e.clientY - r.top) / r.height) * 2 + 1;
}
function groundHit(e) {
  ptrPos(e);
  ray.setFromCamera(ptr, camera);
  const v = new THREE.Vector3();
  return ray.ray.intersectPlane(groundPlane, v) ? v : null;
}
canvas.addEventListener("pointerdown", (e) => {
  canvas.setPointerCapture(e.pointerId);
  ptrPos(e);
  ray.setFromCamera(ptr, camera);
  const objs = placed.map((p) => p.group);
  const hit = ray.intersectObjects(objs, true)[0];
  if (hit) {
    let g = hit.object;
    while (g.parent && !objs.includes(g)) g = g.parent;
    const p = placed.find((pp) => pp.group === g);
    if (p) {
      selected = p;
      refreshSelectionRing();
      const gp = groundHit(e);
      dragging = gp ? { p, offX: p.x - gp.x, offZ: p.z - gp.z } : null;
      return;
    }
  }
  dragging = { orbit: true, sx: e.clientX, sy: e.clientY, saz: az, sel: el };
});
canvas.addEventListener("pointermove", (e) => {
  if (!dragging) return;
  if (dragging.orbit) {
    az = dragging.saz - (e.clientX - dragging.sx) * 0.005;
    el = Math.max(0.25, Math.min(1.35, dragging.sel + (e.clientY - dragging.sy) * 0.004));
    applyCam();
    return;
  }
  const gp = groundHit(e);
  if (!gp) return;
  const p = dragging.p;
  const u = unitDef(p.typeId);
  let nx = snap(gp.x + dragging.offX), nz = snap(gp.z + dragging.offZ);
  [nx, nz] = clampToLot(u, nx, nz, p.rot);
  if (!overlapsAny(u, nx, nz, p.rot, p)) {
    p.x = nx; p.z = nz;
    p.group.position.set(nx, 0, nz);
    refreshSelectionRing();
  }
});
window.addEventListener("pointerup", () => { dragging = null; });
canvas.addEventListener("wheel", (e) => {
  e.preventDefault();
  dist = Math.max(12, Math.min(46, dist + e.deltaY * 0.03));
  applyCam();
}, { passive: false });
canvas.addEventListener("touchmove", (e) => {
  if (e.touches.length === 2) {
    const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    if (pinch != null) { dist = Math.max(12, Math.min(46, dist - (d - pinch) * 0.05)); applyCam(); }
    pinch = d;
    e.preventDefault();
  }
}, { passive: false });
canvas.addEventListener("touchend", () => { pinch = null; });

document.getElementById("build-rot").addEventListener("click", () => {
  if (!selected) return;
  const u = unitDef(selected.typeId);
  const nr = (selected.rot + 90) % 360;
  let [nx, nz] = clampToLot(u, selected.x, selected.z, nr);
  if (overlapsAny(u, nx, nz, nr, selected)) return;
  selected.rot = nr;
  selected.x = nx; selected.z = nz;
  selected.group.rotation.y = (nr * Math.PI) / 180;
  selected.group.position.set(nx, 0, nz);
  refreshSelectionRing();
});
document.getElementById("build-del").addEventListener("click", () => {
  if (!selected) return;
  scene.remove(selected.group);
  placed = placed.filter((p) => p !== selected);
  selected = null;
  refreshSelectionRing();
  refreshQuote();
});

// ---------- 옵션 소품 (데크·조경) ----------
function refreshExtras() {
  if (deckGroup) { scene.remove(deckGroup); deckGroup = null; }
  if (gardenGroup) { scene.remove(gardenGroup); gardenGroup = null; }
  if (opt.deck && placed.length) {
    // 유닛 묶음의 남쪽 앞에 데크
    const minX = Math.min(...placed.map((p) => p.x - footprint(unitDef(p.typeId), p.rot)[0] / 2));
    const maxX = Math.max(...placed.map((p) => p.x + footprint(unitDef(p.typeId), p.rot)[0] / 2));
    const maxZ = Math.max(...placed.map((p) => p.z + footprint(unitDef(p.typeId), p.rot)[1] / 2));
    deckGroup = new THREE.Group();
    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(Math.min(maxX - minX, LOT_W - 1), 0.16, 2.1),
      new THREE.MeshStandardMaterial({ color: 0xa8794f, roughness: 0.8 })
    );
    deck.position.set((minX + maxX) / 2, 0.08, Math.min(maxZ + 1.15, LOT_D / 2 - 1.1));
    deck.receiveShadow = true;
    deckGroup.add(deck);
    scene.add(deckGroup);
  }
  if (opt.garden) {
    gardenGroup = new THREE.Group();
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8a6a4f });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x5a9a55 });
    [[-LOT_W / 2 + 1.4, -LOT_D / 2 + 1.4], [LOT_W / 2 - 1.4, -LOT_D / 2 + 1.4], [LOT_W / 2 - 1.4, LOT_D / 2 - 1.4]].forEach(([x, z]) => {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 1.6, 6), trunkMat);
      trunk.position.set(x, 0.8, z);
      trunk.castShadow = true;
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.85, 0), leafMat);
      crown.position.set(x, 2.0, z);
      crown.castShadow = true;
      gardenGroup.add(trunk, crown);
    });
    const bed = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.24, 1), new THREE.MeshStandardMaterial({ color: 0xd9799b, roughness: 0.8 }));
    bed.position.set(-LOT_W / 2 + 2.4, 0.12, LOT_D / 2 - 1.2);
    gardenGroup.add(bed);
    scene.add(gardenGroup);
  }
}

// ---------- 견적 ----------
const PYEONG = 3.3058;
function quote() {
  const items = [];
  const counts = {};
  placed.forEach((p) => (counts[p.typeId] = (counts[p.typeId] || 0) + 1));
  let area = 0, price = 0;
  Object.entries(counts).forEach(([tid, n]) => {
    const u = unitDef(tid);
    area += u.w * u.d * n;
    price += u.price * n;
    items.push({ label: `${u.icon} ${u.label} × ${n}`, amt: u.price * n });
  });
  const sid = sidingOf();
  if (sid.add) items.push({ label: `🎨 ${sid.label}`, amt: sid.add });
  price += sid.add || 0;
  const roof = OPTIONS.roof.find((r) => r.id === opt.roof) || OPTIONS.roof[0];
  if (roof.add) { items.push({ label: `🏠 ${roof.label}`, amt: roof.add }); price += roof.add; }
  if (opt.deck) { items.push({ label: `🪵 ${OPTIONS.deck.label}`, amt: OPTIONS.deck.add }); price += OPTIONS.deck.add; }
  if (opt.garden) { items.push({ label: `🌳 ${OPTIONS.garden.label}`, amt: OPTIONS.garden.add }); price += OPTIONS.garden.add; }
  return { items, area, pyeong: area / PYEONG, price };
}
function refreshQuote() {
  const q = quote();
  const body = document.getElementById("build-quote-body");
  body.innerHTML = q.items.length
    ? q.items.map((i) => `<div class="build__qrow"><span>${i.label}</span><span>${i.amt.toLocaleString()}만</span></div>`).join("")
    : `<p class="build__qempty">왼쪽에서 유닛을 눌러 집을 올려보세요!</p>`;
  document.getElementById("build-area").textContent = q.pyeong ? `${q.pyeong.toFixed(1)}평 (${q.area.toFixed(0)}㎡)` : "0평";
  document.getElementById("build-price").textContent = q.price ? `${q.price.toLocaleString()}만원~` : "-";
  refreshExtras();
}

// ---------- 팔레트·옵션 UI ----------
function renderPalette() {
  document.getElementById("build-units").innerHTML = UNITS.map(
    (u) => `
    <button type="button" class="build__unitbtn" data-unit="${u.id}">
      <span class="build__unitbtn-ic">${u.icon}</span>
      <span><b>${u.label}</b><br /><small>${(u.w * u.d / PYEONG).toFixed(1)}평 · ${u.price.toLocaleString()}만</small></span>
    </button>`
  ).join("");
  document.querySelectorAll("[data-unit]").forEach((b) =>
    b.addEventListener("click", () => addUnit(b.dataset.unit))
  );
}
function renderOptions() {
  const el2 = document.getElementById("build-options");
  el2.innerHTML = `
    <span class="build__optlabel">외장</span>
    ${OPTIONS.siding.map((s) => `<button type="button" class="build__optbtn${opt.siding === s.id ? " is-on" : ""}" data-sid="${s.id}">${s.label}${s.add ? ` +${s.add}만` : ""}</button>`).join("")}
    <span class="build__optlabel">지붕</span>
    ${OPTIONS.roof.map((r) => `<button type="button" class="build__optbtn${opt.roof === r.id ? " is-on" : ""}" data-roof="${r.id}">${r.label}${r.add ? ` +${r.add}만` : ""}</button>`).join("")}
    <span class="build__optlabel">추가</span>
    <button type="button" class="build__optbtn${opt.deck ? " is-on" : ""}" data-tog="deck">${OPTIONS.deck.label} +${OPTIONS.deck.add}만</button>
    <button type="button" class="build__optbtn${opt.garden ? " is-on" : ""}" data-tog="garden">${OPTIONS.garden.label} +${OPTIONS.garden.add}만</button>`;
  el2.querySelectorAll("[data-sid]").forEach((b) => b.addEventListener("click", () => { opt.siding = b.dataset.sid; renderOptions(); refreshUnitMeshes(); refreshQuote(); }));
  el2.querySelectorAll("[data-roof]").forEach((b) => b.addEventListener("click", () => { opt.roof = b.dataset.roof; renderOptions(); refreshUnitMeshes(); refreshQuote(); }));
  el2.querySelectorAll("[data-tog]").forEach((b) => b.addEventListener("click", () => { opt[b.dataset.tog] = !opt[b.dataset.tog]; renderOptions(); refreshQuote(); }));
}

// ---------- 상담 연결 ----------
function summaryText() {
  const q = quote();
  const parts = q.items.map((i) => i.label.replace(/[🛋️🛏️🍳🛁🎨🏠🪵🌳]/g, "").trim());
  return `[빌드룸] ${q.pyeong.toFixed(1)}평 · ${q.price.toLocaleString()}만원~ | ${parts.join(", ")}`;
}
{
  const modal = document.getElementById("build-modal");
  const err = document.getElementById("build-modal-err");
  document.getElementById("build-consult").addEventListener("click", () => {
    if (!placed.length) { alert("먼저 유닛을 올려 집을 만들어보세요!"); return; }
    document.getElementById("build-modal-sub").textContent = summaryText();
    try {
      const acc = JSON.parse(localStorage.getItem("seum_user") || "null");
      if (acc && acc.name) document.getElementById("build-name").value = acc.name;
    } catch (e) {}
    modal.hidden = false;
  });
  document.getElementById("build-modal-close").addEventListener("click", () => { modal.hidden = true; });
  modal.addEventListener("click", (e) => { if (e.target === modal) modal.hidden = true; });
  document.getElementById("build-submit").addEventListener("click", async () => {
    const name = document.getElementById("build-name").value.trim();
    const phone = document.getElementById("build-phone").value.trim();
    err.hidden = true;
    if (name.length < 2) { err.textContent = "이름을 입력해주세요."; err.hidden = false; return; }
    if (!/^01[016789][-\s]?\d{3,4}[-\s]?\d{4}$/.test(phone)) { err.textContent = "핸드폰 번호를 정확히 입력해주세요."; err.hidden = false; return; }
    const q = quote();
    const config = {
      units: placed.map((p) => ({ type: p.typeId, x: p.x, z: p.z, rot: p.rot })),
      options: opt,
      area_m2: +q.area.toFixed(1),
      pyeong: +q.pyeong.toFixed(1),
      price_manwon: q.price,
    };
    // 1) 발주용 원본 구성 저장 (town_builds) 2) 상담 리드 3) Netlify 알림 메일
    if (CFG && CFG.addBuild) CFG.addBuild({ name, phone, area: q.pyeong, price: q.price, config });
    if (CFG && CFG.addLead) CFG.addLead({ name, phone, interest: "빌드룸 견적 상담", memo: summaryText().slice(0, 290), source: "빌드룸" });
    try {
      fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ "form-name": "상담신청", name, phone, interest: "빌드룸 견적", memo: summaryText(), agree: "on" }).toString(),
      }).catch(() => {});
    } catch (e) {}
    if (CFG && CFG.logEvent) CFG.logEvent("build_consult", `${q.pyeong.toFixed(1)}평`);
    modal.querySelector(".build__modal-panel").innerHTML = `
      <h3>✅ 상담 신청 완료!</h3>
      <p class="build__modal-sub">만드신 집 구성과 함께 접수됐어요.<br />담당 매니저가 곧 연락드리겠습니다.</p>
      <a class="btn btn--primary btn--block" href="town.html">🏘️ 마을로 돌아가기</a>
      <a class="btn btn--ghost btn--block" style="margin-top:8px" href="index.html">홈으로</a>`;
  });
}

// ---------- 시작: 데이터 로드 + 프리셋 ----------
function applyPreset() {
  const q = new URLSearchParams(location.search);
  const pyeong = parseFloat(q.get("pyeong"));
  if (!pyeong || pyeong <= 0) {
    addUnit("living", 0, 0, 0); // 기본 시작: 거실동 1개
    selected = null;
    refreshSelectionRing();
    return;
  }
  // 목표 평수에 맞춰 유닛 자동 조합 (구경하던 모델 → 빌드룸 프리셋)
  let target = pyeong * PYEONG;
  addUnit("living", -3, 0, 0); target -= 18;
  addUnit("kitchen", 1.5, 0, 0); target -= 9;
  addUnit("bath", 3.75, 0, 0); target -= 4.5;
  let bz = -3;
  while (target > 4 && bz > -8) { addUnit("bed", -4.5, bz - 3, 0); target -= 9; bz -= 3; }
  selected = null;
  refreshSelectionRing();
}
(CFG && CFG.load ? CFG.load() : Promise.resolve({ data: {} }))
  .then((cfg) => {
    const b = (cfg.data && cfg.data.build) || {};
    if (Array.isArray(b.units) && b.units.length) UNITS = b.units;
    if (b.options) OPTIONS = Object.assign({}, DEFAULT_OPTIONS, b.options);
  })
  .catch(() => {})
  .then(() => {
    renderPalette();
    renderOptions();
    applyPreset();
    refreshQuote();
    loadingEl.hidden = true;
    if (CFG && CFG.logEvent) CFG.logEvent("build_enter", "");
  });

// ---------- 렌더 루프 ----------
function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();
renderer.setAnimationLoop(() => renderer.render(scene, camera));

// 디버그 훅
window.__seumBuild = {
  add: addUnit,
  units: () => placed.map((p) => ({ type: p.typeId, x: p.x, z: p.z, rot: p.rot })),
  quote,
  setOpt: (k, v) => { opt[k] = v; renderOptions(); refreshUnitMeshes(); refreshQuote(); },
  select: (i) => { selected = placed[i] || null; refreshSelectionRing(); },
};
