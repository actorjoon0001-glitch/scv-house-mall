// ============ SEUM 3D TOWN ============
// 상쾌환 스타일의 미니 3D 타운: 세움봇이 하우스 사이를 걸어다닌다.
import * as THREE from "three";
import { GLTFLoader } from "./GLTFLoader.js";

const stage = document.getElementById("town-stage");
const canvas = document.getElementById("town-canvas");
const loadingEl = document.getElementById("town-loading");
const joyBase = document.getElementById("town-joystick");
const joyStick = document.getElementById("town-stick");

let started = false;
let running = false;

// 섹션이 화면에 들어올 때 한 번만 초기화, 벗어나면 렌더 일시정지
const visIO = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (e.isIntersecting) {
      if (!started) { started = true; init(); }
      running = true;
    } else {
      running = false;
    }
  });
}, { threshold: 0.15 });
visIO.observe(stage);

function init() {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  // dpr 1 모니터에서도 최소 1.6배로 슈퍼샘플링해 계단현상/뭉개짐 방지
  const pixelRatio = () => Math.min(Math.max(window.devicePixelRatio || 1, 1.6), 2.5);
  renderer.setPixelRatio(pixelRatio());
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xbfe0f5);
  scene.fog = new THREE.Fog(0xbfe0f5, 40, 95);

  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 220);

  // ---------- 조명 ----------
  scene.add(new THREE.HemisphereLight(0xdff0ff, 0x7da06a, 1.0));
  const sun = new THREE.DirectionalLight(0xfff2df, 2.2);
  sun.position.set(18, 30, 14);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -48; sun.shadow.camera.right = 48;
  sun.shadow.camera.top = 48; sun.shadow.camera.bottom = -48;
  sun.shadow.bias = -0.0004;
  scene.add(sun);

  // ---------- 바닥 ----------
  const WORLD_R = 52;
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(WORLD_R + 26, 64),
    new THREE.MeshStandardMaterial({ color: 0x93c178, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const plaza = new THREE.Mesh(
    new THREE.CircleGeometry(7.5, 48),
    new THREE.MeshStandardMaterial({ color: 0xd9cfbb, roughness: 1 })
  );
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.y = 0.02;
  plaza.receiveShadow = true;
  scene.add(plaza);

  const pathMat = new THREE.MeshStandardMaterial({ color: 0xcdc2ac, roughness: 1 });
  [0, Math.PI / 2, Math.PI, -Math.PI / 2].forEach((a) => {
    const path = new THREE.Mesh(new THREE.PlaneGeometry(3, 40), pathMat);
    path.rotation.x = -Math.PI / 2;
    path.position.set(Math.sin(a) * 24, 0.015, Math.cos(a) * 24);
    path.rotation.z = -a;
    path.receiveShadow = true;
    scene.add(path);
  });
  // 링 도로 (마을 순환로)
  [21.5, 31.5].forEach((r) => {
    const ringRoad = new THREE.Mesh(new THREE.RingGeometry(r - 1.1, r + 1.1, 80), pathMat);
    ringRoad.rotation.x = -Math.PI / 2;
    ringRoad.position.y = 0.012;
    ringRoad.receiveShadow = true;
    scene.add(ringRoad);
  });

  // ---------- 나무 ----------
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8a6a4f, roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x4e8f4e, roughness: 0.9 });
  const leafMat2 = new THREE.MeshStandardMaterial({ color: 0x67a860, roughness: 0.9 });
  for (let i = 0; i < 26; i++) {
    const t = new THREE.Group();
    const h = 1.6 + Math.random() * 1.8;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, h, 6), trunkMat);
    trunk.position.y = h / 2;
    trunk.castShadow = true;
    const crown = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.9 + Math.random() * 0.8, 0),
      Math.random() > 0.5 ? leafMat : leafMat2
    );
    crown.position.y = h + 0.5;
    crown.castShadow = true;
    t.add(trunk, crown);
    const ang = Math.random() * Math.PI * 2;
    const rad = 42 + Math.random() * 16;
    t.position.set(Math.sin(ang) * rad, 0, Math.cos(ang) * rad);
    scene.add(t);
  }

  // ---------- 구름 ----------
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
  const clouds = [];
  for (let i = 0; i < 7; i++) {
    const c = new THREE.Group();
    for (let j = 0; j < 3; j++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(1.4 + Math.random(), 10, 10), cloudMat);
      puff.position.set(j * 1.6 - 1.6, Math.random() * 0.4, Math.random() * 0.8);
      puff.scale.y = 0.55;
      c.add(puff);
    }
    c.position.set((Math.random() - 0.5) * 90, 17 + Math.random() * 7, (Math.random() - 0.5) * 90);
    clouds.push(c);
    scene.add(c);
  }

  // ---------- 모델 로드 ----------
  const loader = new GLTFLoader();
  const clickTargets = [];
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  // 비스듬한 각도에서 텍스처가 뭉개지지 않도록 이방성 필터링 적용
  function sharpen(obj) {
    obj.traverse((o) => {
      if (o.isMesh && o.material) {
        const m = o.material;
        [m.map, m.normalMap, m.roughnessMap, m.metalnessMap, m.aoMap].forEach((t) => {
          if (t) { t.anisotropy = maxAniso; t.needsUpdate = true; }
        });
      }
    });
  }

  function normalize(obj, targetH) {
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    const s = targetH / size.y;
    obj.scale.setScalar(s);
    const box2 = new THREE.Box3().setFromObject(obj);
    obj.position.y -= box2.min.y;
    const c = box2.getCenter(new THREE.Vector3());
    obj.position.x -= c.x; obj.position.z -= c.z;
    return obj;
  }

  // ---------- 카탈로그 모델 전체를 마을에 배치 ----------
  const CATALOG_URL = "https://seum-catalog-online.netlify.app";
  const SB_URL = "https://aypugjvzvwinnmpquguj.supabase.co";
  const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5cHVnanZ6dndpbm5tcHF1Z3VqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1NjQ0ODIsImV4cCI6MjA4OTE0MDQ4Mn0.yLBG31-8VGWai9Rpv9RtVxZwwWMsKI_syGs0QN7PkUU";
  const TOWN_FALLBACK = [
    { name: "STAY 19RB", category: "전원주택", size: "19평" },
    { name: "STAY 16GB", category: "전원주택", size: "16평" },
    { name: "STAY 28", category: "전원주택", size: "28평" },
    { name: "FOREST-P 10W", category: "체류형 쉼터", size: "10평" },
    { name: "FOREST 6", category: "체류형 쉼터", size: "6평" },
    { name: "CUBE-G 10W", category: "특별모델", size: "10평" },
  ];

  const cardEl = document.getElementById("town-card");
  const cardImg = document.getElementById("town-card-img");
  const cardTag = document.getElementById("town-card-tag");
  const cardName = document.getElementById("town-card-name");
  const cardSpec = document.getElementById("town-card-spec");
  const cardPrice = document.getElementById("town-card-price");
  const cardLink = document.getElementById("town-card-link");

  function fmtPrice(m) {
    const won = m.event_on && m.event_price ? m.event_price : m.base_price;
    if (!won) return "가격 상담";
    const uk = Math.floor(won / 1e8);
    const man = Math.round((won % 1e8) / 1e4);
    return `${uk ? uk + "억 " : ""}${man ? man.toLocaleString() + "만" : ""}원~`;
  }

  function nameSign(text) {
    const c = document.createElement("canvas");
    c.width = 512; c.height = 128;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "rgba(16,19,15,0.78)";
    ctx.beginPath();
    ctx.roundRect(6, 6, 500, 116, 60);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.font = "700 52px 'Inter','Noto Sans KR',sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 256, 68, 460);
    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = maxAniso;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    sp.scale.set(4.2, 1.05, 1);
    return sp;
  }

  // 링 배치: 안쪽부터 채워 마을 형태로
  function lotPositions(n) {
    const rings = [
      { r: 16.5, cap: 10 },
      { r: 26.5, cap: 14 },
      { r: 36.5, cap: 18 },
    ];
    const out = [];
    let left = n;
    rings.forEach((ring, ri) => {
      const cnt = Math.min(ring.cap, left);
      left -= cnt;
      for (let i = 0; i < cnt; i++) {
        const a = (i / cnt) * Math.PI * 2 + ri * 0.35;
        out.push({ x: Math.sin(a) * ring.r, z: Math.cos(a) * ring.r, face: a + Math.PI });
      }
    });
    return out;
  }

  const houseLots = []; // { wrap, model }

  // 수퍼베이스 모델 사진으로 변환한 3D 아키타입. 슬러그 일치 모델은 자기 3D를,
  // 나머지는 같은 카테고리의 3D를 순환 배정받는다.
  const HOUSE_GLBS = {
    "stay-19rb": "assets/houses/stay-19rb.glb",
    "stay24w": "assets/houses/stay24w.glb",
    "stay20r": "assets/houses/stay20r.glb",
    "stay18-b": "assets/houses/stay18-b.glb",
    "stay14": "assets/houses/stay14.glb",
    "cube9o": "assets/houses/cube9o.glb",
    "forest10g": "assets/houses/forest10g.glb",
    "forest10bb": "assets/houses/forest10bb.glb",
    "cube-g-10w": "assets/houses/cube-g-10w.glb",
  };
  const CAT_POOL = {
    "전원주택": ["stay-19rb", "stay24w", "stay20r", "stay18-b"],
    "세컨하우스": ["stay14", "stay-19rb", "stay24w"],
    "체류형 쉼터": ["cube9o", "forest10g", "forest10bb"],
    "특별모델": ["cube-g-10w", "cube9o"],
  };
  const DEFAULT_GLB = "assets/house-3d.glb";

  const glbCache = {};
  function loadGlb(url) {
    if (!glbCache[url]) {
      glbCache[url] = new Promise((resolve, reject) =>
        loader.load(url, (g) => { sharpen(g.scene); resolve(g.scene); }, undefined, reject)
      );
    }
    return glbCache[url];
  }

  function archetypeFor(m, idxInCat) {
    if (m.slug && HOUSE_GLBS[m.slug]) return HOUSE_GLBS[m.slug];
    const pool = CAT_POOL[m.category];
    if (pool && pool.length) return HOUSE_GLBS[pool[idxInCat % pool.length]];
    return DEFAULT_GLB;
  }

  function placeModels(models) {
    const lots = lotPositions(models.length);
    const catCounters = {};
    models.forEach((m, i) => {
      const lot = lots[i];
      if (!lot) return;
      const c = m.category || "_";
      const idxInCat = catCounters[c] || 0;
      catCounters[c] = idxInCat + 1;
      const url = archetypeFor(m, idxInCat);
      loadGlb(url)
        .catch(() => loadGlb(DEFAULT_GLB))
        .then((seed) => {
          const wrap = new THREE.Group();
          const inst = seed.clone(true);
          const h = 3.4 + ((i * 2654435761) % 100) / 100 * 1.4; // 모델별 크기 변화
          const castsShadow = i < 12; // 안쪽 링만 그림자 캐스팅 (성능)
          inst.traverse((o) => { if (o.isMesh) { o.castShadow = castsShadow; o.receiveShadow = true; } });
          normalize(inst, h);
          inst.position.y -= h * 0.045;
          wrap.add(inst);
          const sign = nameSign(m.name);
          sign.position.y = h + 1.1;
          wrap.add(sign);
          wrap.position.set(lot.x, 0, lot.z);
          wrap.rotation.y = lot.face;
          wrap.userData.model = m;
          scene.add(wrap);
          clickTargets.push(wrap);
          houseLots.push({ wrap, model: m, h });
          updateNearCard();
        })
        .catch(() => {});
    });
  }

  fetch(
    `${SB_URL}/rest/v1/models?select=slug,name,category,size,base_price,main_image,event_on,event_price&order=created_at.asc`,
    { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } }
  )
    .then((r) => { if (!r.ok) throw new Error("catalog"); return r.json(); })
    .then((data) => {
      const models = data.filter((m) => m.name);
      placeModels(models.length ? models : TOWN_FALLBACK);
    })
    .catch(() => placeModels(TOWN_FALLBACK));

  // 가까운 집 안내 카드
  let activeLot = null;
  function updateNearCard() {
    if (!cardEl || !houseLots.length) return;
    let best = null, bestD = 7.5;
    houseLots.forEach((l) => {
      const d = Math.hypot(l.wrap.position.x - player.position.x, l.wrap.position.z - player.position.z);
      if (d < bestD) { bestD = d; best = l; }
    });
    if (best === activeLot) return;
    activeLot = best;
    if (!best) { cardEl.hidden = true; return; }
    const m = best.model;
    cardTag.textContent = m.category || "세움 모델";
    cardName.textContent = m.name;
    cardSpec.textContent = m.size || "";
    cardPrice.textContent = fmtPrice(m);
    if (m.main_image) { cardImg.src = m.main_image; cardImg.hidden = false; }
    else cardImg.hidden = true;
    if (m.slug) {
      cardLink.href = `${CATALOG_URL}/model-detail.html?slug=${encodeURIComponent(m.slug)}`;
      cardLink.hidden = false;
    } else cardLink.hidden = true;
    cardEl.hidden = false;
    positionCard();
  }

  // 카드를 해당 집 앞(3D 위치를 화면 좌표로 투영)에 붙인다
  const cardAnchor = new THREE.Vector3();
  function positionCard() {
    if (!activeLot || !cardEl || cardEl.hidden) return;
    const { wrap, h } = activeLot;
    cardAnchor.set(wrap.position.x, h * 0.72, wrap.position.z).project(camera);
    if (cardAnchor.z > 1) { cardEl.style.opacity = "0"; return; }
    const w = stage.clientWidth, ht = stage.clientHeight;
    let x = (cardAnchor.x + 1) / 2 * w;
    let y = (1 - cardAnchor.y) / 2 * ht;
    const half = Math.min(220, w * 0.45);
    x = Math.max(half + 8, Math.min(w - half - 8, x));
    y = Math.max(120, Math.min(ht - 20, y));
    cardEl.style.opacity = "1";
    cardEl.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, -100%)`;
  }

  // ---------- 캐릭터 (세움봇) ----------
  const player = new THREE.Group();
  scene.add(player);
  let mixer = null;
  let walkAction = null;
  let runAction = null;

  // 스킨드 메시는 뼈대 변형 기준으로 바운딩을 재야 크기가 맞는다
  function skinnedBox(obj) {
    obj.updateMatrixWorld(true);
    const box = new THREE.Box3();
    obj.traverse((o) => {
      if (o.isSkinnedMesh) {
        o.computeBoundingBox();
        box.union(o.boundingBox.clone().applyMatrix4(o.matrixWorld));
      } else if (o.isMesh) {
        box.union(new THREE.Box3().setFromObject(o));
      }
    });
    return box;
  }

  // 로봇 GLB가 없으면 심플 대체 로봇으로 진행
  loader.load("assets/robot-walk.glb", (glb) => {
    const bot = glb.scene;
    sharpen(bot);
    bot.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
    const box = skinnedBox(bot);
    const size = box.getSize(new THREE.Vector3());
    const s = 1.9 / size.y;
    bot.scale.setScalar(s);
    const box2 = skinnedBox(bot);
    bot.position.y -= box2.min.y;
    const c = box2.getCenter(new THREE.Vector3());
    bot.position.x -= c.x; bot.position.z -= c.z;
    player.add(bot);
    if (glb.animations && glb.animations.length) {
      mixer = new THREE.AnimationMixer(bot);
      walkAction = mixer.clipAction(glb.animations[0]);
      walkAction.play();
      walkAction.paused = true;
      // 달리기 클립 (같은 리깅에서 뽑은 GLB — 본 이름이 동일해 재사용 가능)
      loader.load("assets/robot-run.glb", (runGlb) => {
        if (runGlb.animations && runGlb.animations.length) {
          runAction = mixer.clipAction(runGlb.animations[0]);
        }
      }, undefined, () => {});
    }
    loadingEl.hidden = true;
  }, undefined, () => {
    // 폴백: 캡슐 로봇
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf4f4f0, roughness: 0.4 });
    const greenMat = new THREE.MeshStandardMaterial({ color: 0x2f5d46, roughness: 0.5 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.45, 0.7, 8, 16), bodyMat);
    body.position.y = 1.0; body.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 16), bodyMat);
    head.position.y = 1.95; head.castShadow = true;
    const visor = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 16), greenMat);
    visor.position.set(0, 1.97, 0.2); visor.scale.z = 0.6;
    g.add(body, head, visor);
    player.add(g);
    loadingEl.hidden = true;
  });

  player.position.set(0, 0, 4);

  // ---------- 입력 ----------
  const keys = new Set();
  let shiftHeld = false;
  const KEYMAP = {
    ArrowUp: "f", KeyW: "f", ArrowDown: "b", KeyS: "b",
    ArrowLeft: "l", KeyA: "l", ArrowRight: "r", KeyD: "r",
  };
  window.addEventListener("keydown", (e) => {
    if (e.code === "ShiftLeft" || e.code === "ShiftRight") { shiftHeld = true; return; }
    const dir = KEYMAP[e.code];
    if (!dir || !running) return;
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    keys.add(dir);
    if (e.code.startsWith("Arrow")) e.preventDefault();
  });
  window.addEventListener("keyup", (e) => {
    if (e.code === "ShiftLeft" || e.code === "ShiftRight") { shiftHeld = false; return; }
    const dir = KEYMAP[e.code];
    if (dir) keys.delete(dir);
  });

  // 터치 조이스틱
  const joy = { active: false, x: 0, y: 0 };
  function joyMove(touch) {
    const rect = joyBase.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = touch.clientX - cx, dy = touch.clientY - cy;
    const max = rect.width / 2 - 14;
    const len = Math.hypot(dx, dy);
    if (len > max) { dx = (dx / len) * max; dy = (dy / len) * max; }
    joyStick.style.transform = `translate(${dx}px, ${dy}px)`;
    joy.x = dx / max; joy.y = dy / max;
  }
  joyBase.addEventListener("touchstart", (e) => { joy.active = true; joyMove(e.touches[0]); e.preventDefault(); }, { passive: false });
  joyBase.addEventListener("touchmove", (e) => { joyMove(e.touches[0]); e.preventDefault(); }, { passive: false });
  ["touchend", "touchcancel"].forEach((ev) =>
    joyBase.addEventListener(ev, () => { joy.active = false; joy.x = joy.y = 0; joyStick.style.transform = "translate(0,0)"; })
  );

  // 하우스 클릭 → 제품 섹션으로
  const ray = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let downAt = null;
  canvas.addEventListener("pointerdown", (e) => { downAt = [e.clientX, e.clientY]; });
  canvas.addEventListener("pointerup", (e) => {
    if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return;
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    ray.setFromCamera(pointer, camera);
    const hits = ray.intersectObjects(clickTargets, true);
    if (hits.length) {
      let p = hits[0].object;
      while (p && !p.userData.model) p = p.parent;
      const m = p && p.userData.model;
      if (m && m.slug) {
        window.open(`${CATALOG_URL}/model-detail.html?slug=${encodeURIComponent(m.slug)}`, "_blank", "noopener");
      } else {
        const prod = document.getElementById("products");
        if (prod) prod.scrollIntoView({ behavior: "smooth" });
      }
    }
  });

  // ---------- 리사이즈 ----------
  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setPixelRatio(pixelRatio()); // 창 이동/브라우저 줌으로 dpr가 바뀌어도 유지
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);
  resize();

  // ---------- 전체화면 ----------
  const fsBtn = document.getElementById("town-fs");
  const fsLabel = document.getElementById("town-fs-label");
  function fsActive() {
    return document.fullscreenElement === stage || stage.classList.contains("is-fs");
  }
  function syncFs() {
    const on = fsActive();
    if (fsLabel) fsLabel.textContent = on ? "닫기" : "전체화면";
    document.body.classList.toggle("town-fs-lock", stage.classList.contains("is-fs"));
    resize();
    setTimeout(resize, 120); // 전환 애니메이션 후 최종 크기 반영
  }
  function enterFs() {
    if (stage.requestFullscreen) {
      stage.requestFullscreen().catch(() => { stage.classList.add("is-fs"); syncFs(); });
    } else {
      stage.classList.add("is-fs");
      syncFs();
    }
  }
  function exitFs() {
    if (document.fullscreenElement) document.exitFullscreen();
    stage.classList.remove("is-fs");
    syncFs();
  }
  if (fsBtn) fsBtn.addEventListener("click", () => (fsActive() ? exitFs() : enterFs()));
  document.addEventListener("fullscreenchange", syncFs);
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && stage.classList.contains("is-fs")) exitFs();
  });

  // ---------- 루프 ----------
  const WALK_SPEED = 5.2;
  const RUN_SPEED = 11;
  const camOffset = new THREE.Vector3(0, 6.2, 9.5);
  const camPos = new THREE.Vector3().copy(player.position).add(camOffset);
  const lookAt = new THREE.Vector3();
  const clock = new THREE.Clock();
  let heading = 0;

  // 디버그/테스트 훅 (프로덕션 동작에 영향 없음)
  window.__seumTown = {
    teleport(x, z) { player.position.x = x; player.position.z = z; updateNearCard(); },
    lots: houseLots,
  };

  function tick() {
    requestAnimationFrame(tick);
    const dt = Math.min(clock.getDelta(), 0.05);
    if (!running) return;

    let mx = 0, mz = 0;
    if (keys.has("f")) mz -= 1;
    if (keys.has("b")) mz += 1;
    if (keys.has("l")) mx -= 1;
    if (keys.has("r")) mx += 1;
    if (joy.active) { mx += joy.x; mz += joy.y; }
    const mag = Math.min(Math.hypot(mx, mz), 1);
    const moving = mag > 0.12;
    // Shift 또는 조이스틱을 끝까지 밀면 달리기
    const sprinting = moving && (shiftHeld || (joy.active && mag > 0.94));

    if (moving) {
      const dir = Math.atan2(mx, mz);
      const speed = sprinting ? RUN_SPEED : WALK_SPEED;
      player.position.x += Math.sin(dir) * speed * mag * dt;
      player.position.z += Math.cos(dir) * speed * mag * dt;
      const d = Math.hypot(player.position.x, player.position.z);
      if (d > WORLD_R) {
        player.position.x *= WORLD_R / d;
        player.position.z *= WORLD_R / d;
      }
      let target = dir;
      let diff = target - heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      heading += diff * Math.min(1, dt * 10);
      player.rotation.y = heading;
      const wantRun = sprinting && runAction;
      const active = wantRun ? runAction : walkAction;
      const idle = wantRun ? walkAction : runAction;
      if (idle && idle.isRunning()) idle.stop();
      if (active) {
        if (!active.isRunning()) active.play();
        active.paused = false;
        // 달리기 클립이 없으면 걷기 재생속도를 올려 임시 대응
        active.timeScale = wantRun ? 1.1 : (sprinting ? 1.8 : 0.7 + mag * 0.6);
      }
      updateNearCard();
    } else {
      if (walkAction) walkAction.paused = true;
      if (runAction) runAction.paused = true;
    }
    if (mixer) mixer.update(dt);

    clouds.forEach((c, i) => { c.position.x += dt * (0.25 + i * 0.05); if (c.position.x > 55) c.position.x = -55; });

    camPos.lerp(new THREE.Vector3().copy(player.position).add(camOffset), 1 - Math.pow(0.001, dt));
    camera.position.copy(camPos);
    lookAt.lerp(new THREE.Vector3(player.position.x, player.position.y + 1.2, player.position.z), 1 - Math.pow(0.0005, dt));
    camera.lookAt(lookAt);

    positionCard();
    renderer.render(scene, camera);
  }
  tick();
}
