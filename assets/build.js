// ============ METAHOUSE 빌드룸 (레벨 1: 모듈러 유닛 조립 + 기본 옵션 + 실시간 견적) ============
// 마을과 완전히 분리된 전용 화면. 유닛·옵션·가격은 Supabase(town_settings data.build)로
// 오버라이드 가능하며, 아래 DEFAULT_*는 데이터가 없을 때의 폴백이다.
import * as THREE from "three";
import { GLTFLoader } from "./GLTFLoader.js";

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

// ---------- 실제 판매 모델 (카탈로그 연동) ----------
const CAT_SB = "https://aypugjvzvwinnmpquguj.supabase.co";
const CAT_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5cHVnanZ6dndpbm5tcHF1Z3VqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1NjQ0ODIsImV4cCI6MjA4OTE0MDQ4Mn0.yLBG31-8VGWai9Rpv9RtVxZwwWMsKI_syGs0QN7PkUU";
let MODELS = [];
const gltfLoader = new GLTFLoader();
const glbCache = {};
function loadGlb(url) {
  if (!glbCache[url]) {
    glbCache[url] = new Promise((resolve, reject) =>
      gltfLoader.load(url, (g) => resolve(g.scene), undefined, reject)
    );
  }
  return glbCache[url];
}
// "24평" 같은 문자열에서 평수 합산 → ㎡
function pyeongOf(m) {
  let sum = 0;
  String(m.size || "").replace(/([\d.]+)\s*평/g, (_, n) => { sum += parseFloat(n); return _; });
  return sum || 10;
}
function priceOf(m) {
  return Number(m.event_on && m.event_price ? m.event_price : m.base_price) || 0;
}
function normalizeFootprint(obj, maxXZ, maxH) {
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const s = Math.min(maxXZ / Math.max(size.x, size.z, 0.01), maxH / Math.max(size.y, 0.01));
  obj.scale.setScalar(s);
  const box2 = new THREE.Box3().setFromObject(obj);
  obj.position.y -= box2.min.y;
  const c = box2.getCenter(new THREE.Vector3());
  obj.position.x -= c.x; obj.position.z -= c.z;
  return box2.getSize(new THREE.Vector3());
}

const GRID = 1.5; // 스냅 격자 (m)
// 부지 크기 — 고객 땅 크기로 변경 가능 (localStorage에 유지)
let LOT_W = 21, LOT_D = 15;
try {
  const saved = JSON.parse(localStorage.getItem("seum_build_lot") || "null");
  if (saved && saved.w >= 9 && saved.w <= 60 && saved.d >= 9 && saved.d <= 60) { LOT_W = saved.w; LOT_D = saved.d; }
} catch (e) {}

// ---------- 씬 ----------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;

const scene = new THREE.Scene();
// 하늘 그라데이션 — 배경 + 유리·금속 반사용 환경맵(PMREM)으로 같이 쓴다
{
  const cv = document.createElement("canvas");
  cv.width = 64; cv.height = 256;
  const cx = cv.getContext("2d");
  const gr = cx.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, "#7db3e8");
  gr.addColorStop(0.42, "#bcd9f0");
  gr.addColorStop(0.55, "#eef3ec");
  gr.addColorStop(0.62, "#d9e6cd");
  gr.addColorStop(1, "#9cc47e");
  cx.fillStyle = gr;
  cx.fillRect(0, 0, 64, 256);
  const skyTex = new THREE.CanvasTexture(cv);
  skyTex.mapping = THREE.EquirectangularReflectionMapping;
  skyTex.colorSpace = THREE.SRGBColorSpace;
  scene.background = skyTex;
  try {
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromEquirectangular(skyTex).texture;
    pmrem.dispose();
  } catch (e) {}
}
scene.fog = new THREE.Fog(0xdfeaf2, 70, 150);
const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 300);

const hemi = new THREE.HemisphereLight(0xeaf4ff, 0x8fae7c, 0.55);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffedd0, 2.2);
sun.position.set(18, 26, 12);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -22; sun.shadow.camera.right = 22;
sun.shadow.camera.top = 22; sun.shadow.camera.bottom = -22;
sun.shadow.bias = -0.0002;
sun.shadow.normalBias = 0.02;
scene.add(sun);
const fill = new THREE.DirectionalLight(0xdce8ff, 0.3);
fill.position.set(-14, 10, -8);
scene.add(fill);

// ---------- 텍스처 ----------
const texLoader = new THREE.TextureLoader();
function pbrTex(url, srgb, rx, ry) {
  const t = texLoader.load(url);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
// 접지 그림자(AO) 원판 텍스처
let aoTexCache = null;
function aoTexture() {
  if (aoTexCache) return aoTexCache;
  const cv = document.createElement("canvas");
  cv.width = cv.height = 128;
  const cx = cv.getContext("2d");
  const gr = cx.createRadialGradient(64, 64, 8, 64, 64, 64);
  gr.addColorStop(0, "rgba(30,40,30,0.32)");
  gr.addColorStop(0.7, "rgba(30,40,30,0.14)");
  gr.addColorStop(1, "rgba(30,40,30,0)");
  cx.fillStyle = gr;
  cx.fillRect(0, 0, 128, 128);
  aoTexCache = new THREE.CanvasTexture(cv);
  return aoTexCache;
}
function makeAoDisc(w, d, y) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshBasicMaterial({ map: aoTexture(), transparent: true, depthWrite: false })
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = y || 0.012;
  return m;
}

// 주변 잔디 + 부지
const lawn = new THREE.Mesh(
  new THREE.PlaneGeometry(240, 240),
  new THREE.MeshStandardMaterial({
    map: pbrTex("assets/hdri/grass_diff_1k.jpg", true, 34, 34),
    normalMap: pbrTex("assets/tex/grass_n.jpg", false, 34, 34),
    color: 0xc4d8ab,
    roughness: 1,
  })
);
lawn.rotation.x = -Math.PI / 2;
lawn.position.y = -0.02;
lawn.receiveShadow = true;
scene.add(lawn);
// 부지·격자·울타리·나무 — 고객 땅 크기에 맞춰 재구성 가능
const lotMat = new THREE.MeshStandardMaterial({
  map: pbrTex("assets/tex/concrete_c.jpg", true, 5.2, 3.7),
  normalMap: pbrTex("assets/tex/concrete_n.jpg", false, 5.2, 3.7),
  color: 0xe9e3d5,
  roughness: 0.95,
});
let lot = null, grid = null, fenceGroup = null, treeGroup = null;
function rebuildGround() {
  [lot, grid, fenceGroup, treeGroup].forEach((o) => { if (o) scene.remove(o); });
  lot = new THREE.Mesh(new THREE.PlaneGeometry(LOT_W, LOT_D), lotMat);
  lotMat.map.repeat.set(LOT_W / 4, LOT_D / 4);
  lotMat.normalMap.repeat.set(LOT_W / 4, LOT_D / 4);
  lot.rotation.x = -Math.PI / 2;
  lot.receiveShadow = true;
  scene.add(lot);
  const mx = Math.max(LOT_W, LOT_D);
  grid = new THREE.GridHelper(mx, mx / GRID, 0xa9a28c, 0xbdb59e);
  grid.scale.set(LOT_W / mx, 1, LOT_D / mx);
  grid.position.y = 0.01;
  grid.material.transparent = true;
  grid.material.opacity = 0.35;
  scene.add(grid);

  // 흰 울타리 (남쪽 가운데는 입구로 비움)
  const fenceMat = new THREE.MeshStandardMaterial({ color: 0xf4f4ee, roughness: 0.55 });
  const fg = (fenceGroup = new THREE.Group());
  const FW = LOT_W / 2 + 1.6, FD = LOT_D / 2 + 1.6;
  const addPost = (x, z) => {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.13, 1.0, 0.13), fenceMat);
    p.position.set(x, 0.5, z);
    p.castShadow = true;
    fg.add(p);
  };
  const addRail = (cx2, cz, len, rotY) => {
    [0.42, 0.8].forEach((y) => {
      const r = new THREE.Mesh(new THREE.BoxGeometry(len, 0.07, 0.05), fenceMat);
      r.position.set(cx2, y, cz);
      r.rotation.y = rotY;
      fg.add(r);
    });
  };
  const step = 2.9;
  for (let x = -FW; x <= FW + 0.01; x += step) {
    addPost(x, -FD);
    if (Math.abs(x) > 2.2) addPost(x, FD); // 남쪽 입구 틈
  }
  for (let z = -FD; z <= FD + 0.01; z += step) { addPost(-FW, z); addPost(FW, z); }
  addRail(0, -FD, FW * 2, 0);
  addRail(-FW, 0, FD * 2, Math.PI / 2);
  addRail(FW, 0, FD * 2, Math.PI / 2);
  const segLen = FW - 2.2;
  addRail(-(2.2 + segLen / 2), FD, segLen, 0);
  addRail(2.2 + segLen / 2, FD, segLen, 0);
  scene.add(fg);

  // 주변 나무 (울타리 바깥 링, 3겹 수풀 + 접지 그림자)
  treeGroup = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7d5f43, roughness: 0.9 });
  const crownCols = [0x5e9455, 0x6da562, 0x4f8a4c, 0x79b06b];
  const ox = FW + 4.5, oz = FD + 4.5;
  const spots = [
    [-ox, -oz * 0.65], [-ox * 0.8, oz * 0.45], [-ox * 1.1, 0.08 * oz], [ox, -oz * 0.6], [ox * 0.85, oz * 0.5],
    [ox * 1.1, -0.05 * oz], [-ox * 0.45, -oz], [ox * 0.5, -oz * 1.05], [0, -oz * 1.2], [-ox * 0.9, oz * 0.85], [ox * 0.9, oz * 0.9],
  ];
  spots.forEach(([x, z], i) => {
    const g = new THREE.Group();
    const h = 1.6 + (i % 3) * 0.35;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, h, 6), trunkMat);
    trunk.position.y = h / 2;
    trunk.castShadow = true;
    g.add(trunk);
    const col = crownCols[i % crownCols.length];
    for (let k = 0; k < 3; k++) {
      const c = new THREE.Mesh(
        new THREE.IcosahedronGeometry(1.15 - k * 0.28, 1),
        new THREE.MeshStandardMaterial({ color: col, roughness: 0.85, flatShading: true })
      );
      c.position.set(k % 2 ? 0.18 : -0.12, h + 0.5 + k * 0.6, k % 2 ? -0.1 : 0.14);
      c.castShadow = true;
      g.add(c);
    }
    g.add(makeAoDisc(3, 3, 0.015));
    g.position.set(x, 0, z);
    g.rotation.y = i * 1.7;
    treeGroup.add(g);
  });
  scene.add(treeGroup);

  // 그림자 카메라를 부지 크기에 맞춤
  const half = Math.max(22, Math.max(LOT_W, LOT_D) / 2 + 12);
  sun.shadow.camera.left = -half; sun.shadow.camera.right = half;
  sun.shadow.camera.top = half; sun.shadow.camera.bottom = -half;
  sun.shadow.camera.updateProjectionMatrix();
}
rebuildGround();
// 구름 (렌더 루프에서 천천히 드리프트)
const clouds = [];
{
  const cm = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
  for (let i = 0; i < 5; i++) {
    const c = new THREE.Group();
    for (let j = 0; j < 3; j++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(1.5 + (j % 2) * 0.7, 10, 10), cm);
      puff.position.set(j * 1.7 - 1.7, (j % 2) * 0.35, (j % 2) * 0.6);
      puff.scale.y = 0.55;
      c.add(puff);
    }
    c.position.set(-70 + i * 32, 17 + (i % 3) * 3.5, -34 + (i % 4) * 20);
    clouds.push(c);
    scene.add(c);
  }
}

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
// 사이딩(외장 패널) 라인 텍스처 — 밝은 회색조라 외장 색이 그대로 곱해진다
let sidingTexBase = null;
function sidingTex(rx, ry) {
  if (!sidingTexBase) {
    const cv = document.createElement("canvas");
    cv.width = cv.height = 128;
    const cx = cv.getContext("2d");
    cx.fillStyle = "#e9e9e9";
    cx.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 128; y += 16) {
      cx.fillStyle = "rgba(0,0,0,0.11)";
      cx.fillRect(0, y + 13, 128, 3);
      cx.fillStyle = "rgba(255,255,255,0.4)";
      cx.fillRect(0, y, 128, 2);
    }
    sidingTexBase = new THREE.CanvasTexture(cv);
    sidingTexBase.wrapS = sidingTexBase.wrapT = THREE.RepeatWrapping;
  }
  const t = sidingTexBase.clone();
  t.repeat.set(rx, ry);
  t.needsUpdate = true;
  return t;
}
const BASE_MAT = new THREE.MeshStandardMaterial({ color: 0x9a9a92, roughness: 1 });
function buildUnitMesh(u) {
  const g = new THREE.Group();
  const sid = sidingOf();
  const dark = sid.id === "dark";
  const wallMat = new THREE.MeshStandardMaterial({
    color: sid.color,
    roughness: dark ? 0.5 : 0.8,
    metalness: dark ? 0.3 : 0,
    map: sidingTex(Math.max(1, Math.round(u.w / 1.5)), 1.8),
  });
  const H = 2.7;
  const body = new THREE.Mesh(new THREE.BoxGeometry(u.w, H, u.d), wallMat);
  body.position.y = H / 2 + 0.15;
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);
  // 기초 (콘크리트)
  const base = new THREE.Mesh(new THREE.BoxGeometry(u.w + 0.2, 0.3, u.d + 0.2), BASE_MAT);
  base.position.y = 0.15;
  g.add(base);
  // 접지 그림자 (은은한 AO)
  g.add(makeAoDisc(u.w + 1.6, u.d + 1.6, 0.013));
  // 창문 (남쪽 면): 흰 창틀 + 반사 유리
  const frameMat = new THREE.MeshStandardMaterial({ color: 0xf6f6f2, roughness: 0.4 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x7fa8bd, roughness: 0.12, metalness: 0.5, envMapIntensity: 1.3 });
  const winCount = Math.max(1, Math.round(u.w / 3));
  for (let i = 0; i < winCount; i++) {
    const wx = -u.w / 2 + (i + 0.5) * (u.w / winCount);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.32, 1.27, 0.05), frameMat);
    frame.position.set(wx, 1.65, u.d / 2 + 0.015);
    const win = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.1, 0.06), glassMat);
    win.position.set(wx, 1.65, u.d / 2 + 0.035);
    // 창살 (십자)
    const mulV = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.1, 0.02), frameMat);
    mulV.position.set(wx, 1.65, u.d / 2 + 0.07);
    g.add(frame, win, mulV);
  }
  if (u.id === "living") {
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.95, 2.05, 0.07), new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 0.55 }));
    door.position.set(u.w / 2 - 0.85, 1.2, u.d / 2 + 0.03);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 10), new THREE.MeshStandardMaterial({ color: 0xd8c66a, roughness: 0.25, metalness: 0.8 }));
    knob.position.set(u.w / 2 - 0.5, 1.15, u.d / 2 + 0.08);
    g.add(door, knob);
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
    if (p.kind === "model") return; // 실제 모델은 외장 옵션 영향 없음
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
  const [w, d] = fpOfEntry(selected);
  ring.visible = true;
  ring.scale.setScalar(Math.max(w, d) * 0.72);
  ring.position.set(selected.x, 0.03, selected.z);
  setSelBtns(true);
}
function setSelBtns(on) {
  document.getElementById("build-rot").disabled = !on;
  document.getElementById("build-del").disabled = !on;
}
const snap = (v) => Math.round(v / GRID) * GRID;
// 배치물(유닛/실제 모델) 공용 풋프린트 — 회전 반영 [가로, 세로]
function fpOfEntry(p, rotOverride) {
  const rot = rotOverride != null ? rotOverride : p.rot;
  if (p.kind === "model") return rot % 180 === 0 ? [p.fw, p.fd] : [p.fd, p.fw];
  return footprint(unitDef(p.typeId), rot);
}
function clampToLotFp(w, d, x, z) {
  return [
    Math.max(-LOT_W / 2 + w / 2, Math.min(LOT_W / 2 - w / 2, x)),
    Math.max(-LOT_D / 2 + d / 2, Math.min(LOT_D / 2 - d / 2, z)),
  ];
}
function clampToLot(u, x, z, rot) {
  const [w, d] = footprint(u, rot);
  return clampToLotFp(w, d, x, z);
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

// 실제 판매 모델을 부지에 배치 — 카탈로그 평수에 맞춰 스케일한 실제 3D 외형
function addModel(m) {
  const url = (window.SeumTownConfig && window.SeumTownConfig.archetypeFor && window.SeumTownConfig.archetypeFor(m, 0)) || "assets/house-3d.glb";
  loadGlb(url)
    .catch(() => loadGlb("assets/house-3d.glb"))
    .then((seed) => {
      const inst = seed.clone(true);
      inst.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      const py = pyeongOf(m);
      // 평수 → 한 변 목표 길이 (㎡의 제곱근 근사, 부지에 들어가게 클램프)
      const target = Math.min(11, Math.max(5.5, Math.sqrt(py * PYEONG) * 1.2));
      const bs = normalizeFootprint(inst, target, 6.5);
      const fw = Math.max(GRID, Math.ceil(bs.x / GRID) * GRID);
      const fd = Math.max(GRID, Math.ceil(bs.z / GRID) * GRID);
      // 빈 자리 탐색 (부지 중앙부터 동→서)
      let x = 0, z = 0, found = false;
      outer: for (const tz of [0, -3, 3, -6, 6]) {
        for (const tx of [0, 3, -3, 6, -6, 9, -9]) {
          const [cx2, cz] = clampToLotFp(fw, fd, tx, tz);
          if (!overlapsAnyFp(fw, fd, cx2, cz, null)) { x = cx2; z = cz; found = true; break outer; }
        }
      }
      if (!found) { alert("부지에 자리가 부족해요. 유닛을 정리한 뒤 다시 시도해주세요!"); return; }
      const g = new THREE.Group();
      g.add(inst);
      g.add(makeAoDisc(fw + 2, fd + 2, 0.014));
      g.position.set(x, 0, z);
      scene.add(g);
      const p = { uid: uidSeq++, kind: "model", model: m, fw, fd, x, z, rot: 0, group: g };
      placed.push(p);
      selected = p;
      refreshSelectionRing();
      refreshQuote();
    })
    .catch(() => {});
}
function overlapsAnyFp(w, d, x, z, ignore) {
  return placed.some((p) => {
    if (p === ignore) return false;
    const [pw, pd] = fpOfEntry(p);
    return Math.abs(p.x - x) < (w + pw) / 2 - 0.01 && Math.abs(p.z - z) < (d + pd) / 2 - 0.01;
  });
}
function overlapsAny(u, x, z, rot, ignore) {
  const [w, d] = footprint(u, rot);
  return overlapsAnyFp(w, d, x, z, ignore);
}

// ---------- 카메라 (궤도 + 줌) ----------
let az = 0.6, el = 0.85, dist = 26;
const maxDist = () => Math.max(46, Math.hypot(LOT_W, LOT_D) * 1.8);
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
  const [w, d] = fpOfEntry(p);
  let nx = snap(gp.x + dragging.offX), nz = snap(gp.z + dragging.offZ);
  [nx, nz] = clampToLotFp(w, d, nx, nz);
  if (!overlapsAnyFp(w, d, nx, nz, p)) {
    p.x = nx; p.z = nz;
    p.group.position.set(nx, 0, nz);
    refreshSelectionRing();
  }
});
window.addEventListener("pointerup", () => { dragging = null; });
canvas.addEventListener("wheel", (e) => {
  e.preventDefault();
  dist = Math.max(12, Math.min(maxDist(), dist + e.deltaY * 0.03));
  applyCam();
}, { passive: false });
canvas.addEventListener("touchmove", (e) => {
  if (e.touches.length === 2) {
    const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    if (pinch != null) { dist = Math.max(12, Math.min(maxDist(), dist - (d - pinch) * 0.05)); applyCam(); }
    pinch = d;
    e.preventDefault();
  }
}, { passive: false });
canvas.addEventListener("touchend", () => { pinch = null; });

document.getElementById("build-rot").addEventListener("click", () => {
  if (!selected) return;
  const nr = (selected.rot + 90) % 360;
  const [w, d] = fpOfEntry(selected, nr);
  let [nx, nz] = clampToLotFp(w, d, selected.x, selected.z);
  if (overlapsAnyFp(w, d, nx, nz, selected)) return;
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

// ---------- 내 땅 크기 (고객 대지 입력) ----------
function updateLotUI() {
  const wEl = document.getElementById("build-lot-w");
  const dEl = document.getElementById("build-lot-d");
  const info = document.getElementById("build-lot-info");
  if (wEl) wEl.value = LOT_W;
  if (dEl) dEl.value = LOT_D;
  if (info) info.textContent = `대지 ${(LOT_W * LOT_D / PYEONG).toFixed(0)}평 (${LOT_W * LOT_D}㎡)`;
}
function applyLotSize(w, d) {
  LOT_W = Math.round(Math.max(9, Math.min(60, w || LOT_W)));
  LOT_D = Math.round(Math.max(9, Math.min(60, d || LOT_D)));
  try { localStorage.setItem("seum_build_lot", JSON.stringify({ w: LOT_W, d: LOT_D })); } catch (e) {}
  rebuildGround();
  // 기존 배치물을 새 부지 안으로 이동
  placed.forEach((p) => {
    const [fw, fd] = fpOfEntry(p);
    [p.x, p.z] = clampToLotFp(fw, fd, p.x, p.z);
    p.group.position.set(p.x, 0, p.z);
  });
  dist = Math.max(24, Math.hypot(LOT_W, LOT_D) * 1.25);
  applyCam();
  refreshSelectionRing();
  refreshQuote();
  updateLotUI();
}
{
  const applyBtn = document.getElementById("build-lot-apply");
  const readApply = () => applyLotSize(
    parseFloat(document.getElementById("build-lot-w").value),
    parseFloat(document.getElementById("build-lot-d").value)
  );
  if (applyBtn) applyBtn.addEventListener("click", readApply);
  ["build-lot-w", "build-lot-d"].forEach((id) => {
    const el2 = document.getElementById(id);
    if (el2) el2.addEventListener("keydown", (e) => { if (e.key === "Enter") readApply(); });
  });
}

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
    // 우드 데크 — 플랭크 줄무늬 텍스처
    const dcv = document.createElement("canvas");
    dcv.width = dcv.height = 128;
    const dcx = dcv.getContext("2d");
    dcx.fillStyle = "#a8794f";
    dcx.fillRect(0, 0, 128, 128);
    for (let x = 0; x < 128; x += 16) {
      dcx.fillStyle = x % 32 ? "rgba(60,35,15,0.22)" : "rgba(255,220,170,0.12)";
      dcx.fillRect(x, 0, 3, 128);
    }
    const deckTex = new THREE.CanvasTexture(dcv);
    deckTex.wrapS = deckTex.wrapT = THREE.RepeatWrapping;
    deckTex.repeat.set(3, 1);
    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(Math.min(maxX - minX, LOT_W - 1), 0.16, 2.1),
      new THREE.MeshStandardMaterial({ map: deckTex, roughness: 0.75 })
    );
    deck.castShadow = true;
    deck.position.set((minX + maxX) / 2, 0.08, Math.min(maxZ + 1.15, LOT_D / 2 - 1.1));
    deck.receiveShadow = true;
    deckGroup.add(deck);
    scene.add(deckGroup);
  }
  if (opt.garden) {
    gardenGroup = new THREE.Group();
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8a6a4f, roughness: 0.9 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x5a9a55, roughness: 0.85, flatShading: true });
    const leafMat2 = new THREE.MeshStandardMaterial({ color: 0x6dab60, roughness: 0.85, flatShading: true });
    [[-LOT_W / 2 + 1.4, -LOT_D / 2 + 1.4], [LOT_W / 2 - 1.4, -LOT_D / 2 + 1.4], [LOT_W / 2 - 1.4, LOT_D / 2 - 1.4]].forEach(([x, z]) => {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 1.6, 6), trunkMat);
      trunk.position.set(x, 0.8, z);
      trunk.castShadow = true;
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.85, 1), leafMat);
      crown.position.set(x, 2.0, z);
      crown.castShadow = true;
      const crown2 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), leafMat2);
      crown2.position.set(x + 0.2, 2.6, z - 0.12);
      crown2.castShadow = true;
      const ao = makeAoDisc(2.2, 2.2, 0.014);
      ao.position.x = x; ao.position.z = z;
      gardenGroup.add(trunk, crown, crown2, ao);
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
  placed.forEach((p) => { if (p.kind !== "model") counts[p.typeId] = (counts[p.typeId] || 0) + 1; });
  let area = 0, price = 0;
  // 실제 판매 모델
  placed.filter((p) => p.kind === "model").forEach((p) => {
    const py = pyeongOf(p.model);
    const won = priceOf(p.model);
    area += py * PYEONG;
    price += won;
    items.push({ label: `🏠 ${p.model.name}`, amt: won });
  });
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
function renderModels() {
  const el2 = document.getElementById("build-models");
  if (!el2) return;
  if (!MODELS.length) { el2.parentElement && (el2.innerHTML = `<p class="build__qempty">모델을 불러오지 못했어요</p>`); return; }
  el2.innerHTML = MODELS.map(
    (m, i) => `
    <button type="button" class="build__unitbtn" data-model="${i}">
      ${m.main_image ? `<img class="build__unitbtn-img" src="${m.main_image}" alt="" loading="lazy" />` : `<span class="build__unitbtn-ic">🏠</span>`}
      <span><b>${m.name}</b><br /><small>${pyeongOf(m).toFixed(0)}평 · ${priceOf(m) ? priceOf(m).toLocaleString() + "만" : "상담"}</small></span>
    </button>`
  ).join("");
  el2.querySelectorAll("[data-model]").forEach((b) =>
    b.addEventListener("click", () => addModel(MODELS[+b.dataset.model]))
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
  return `[빌드룸] 대지 ${(LOT_W * LOT_D / PYEONG).toFixed(0)}평(${LOT_W}×${LOT_D}m) · 건물 ${q.pyeong.toFixed(1)}평 · ${q.price.toLocaleString()}만원~ | ${parts.join(", ")}`;
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
      units: placed.map((p) => p.kind === "model"
        ? { model: p.model.slug || p.model.name, x: p.x, z: p.z, rot: p.rot }
        : { type: p.typeId, x: p.x, z: p.z, rot: p.rot }),
      options: opt,
      lot: { w: LOT_W, d: LOT_D, pyeong: +(LOT_W * LOT_D / PYEONG).toFixed(1) },
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
  // 구경하던 실제 모델 그대로 시작 (?model=슬러그 또는 이름 — 마을 집 카드에서 넘어옴)
  const slug = q.get("model");
  if (slug) {
    const m = MODELS.find((mm) => mm.slug === slug || mm.name === slug);
    if (m) { addModel(m); return; }
  }
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
Promise.all([
  (CFG && CFG.load ? CFG.load() : Promise.resolve({ data: {} })).catch(() => ({ data: {} })),
  fetch(
    `${CAT_SB}/rest/v1/models?select=slug,name,category,size,base_price,main_image,event_on,event_price&order=created_at.asc`,
    { headers: { apikey: CAT_KEY, Authorization: `Bearer ${CAT_KEY}` } }
  ).then((r) => { if (!r.ok) throw new Error("catalog"); return r.json(); }).catch(() => []),
])
  .then(([cfg, models]) => {
    const b = (cfg.data && cfg.data.build) || {};
    if (Array.isArray(b.units) && b.units.length) UNITS = b.units;
    if (b.options) OPTIONS = Object.assign({}, DEFAULT_OPTIONS, b.options);
    MODELS = Array.isArray(models) ? models : [];
  })
  .then(() => {
    renderPalette();
    renderModels();
    renderOptions();
    updateLotUI();
    // 저장된 고객 땅이 기본값과 다르면 카메라를 부지에 맞춤
    dist = Math.max(26, Math.hypot(LOT_W, LOT_D) * 1.25);
    applyCam();
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
let lastT = 0;
renderer.setAnimationLoop((t) => {
  const dt = Math.min((t - lastT) / 1000, 0.05);
  lastT = t;
  clouds.forEach((c, i) => {
    c.position.x += dt * (0.5 + i * 0.12);
    if (c.position.x > 90) c.position.x = -90;
  });
  renderer.render(scene, camera);
});

// 디버그 훅
window.__seumBuild = {
  add: addUnit,
  addModel: (i) => MODELS[i] && addModel(MODELS[i]),
  models: () => MODELS,
  setLot: applyLotSize,
  lot: () => ({ w: LOT_W, d: LOT_D }),
  units: () => placed.map((p) => ({ type: p.typeId, x: p.x, z: p.z, rot: p.rot })),
  quote,
  setOpt: (k, v) => { opt[k] = v; renderOptions(); refreshUnitMeshes(); refreshQuote(); },
  select: (i) => { selected = placed[i] || null; refreshSelectionRing(); },
};
