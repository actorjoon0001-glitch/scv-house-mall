// ============ METAHOUSE 3D TOWN ============
// 상쾌환 스타일의 미니 3D 타운: 메타봇이 하우스 사이를 걸어다닌다.
import * as THREE from "three";
import { GLTFLoader } from "./GLTFLoader.js";
import { clone as skeletonClone } from "./SkeletonUtils.js";

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
    cardTag.textContent = m.category || "메타하우스 모델";
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

  // ---------- 캐릭터 시스템 ----------
  const player = new THREE.Group();
  scene.add(player);

  const CHARACTERS = {
    robot: { label: "메타봇", walk: "assets/robot-walk.glb", run: "assets/robot-run.glb", height: 1.9 },
    boy: { label: "남자아이", walk: "assets/chars/kid.glb", height: 1.25, img: "kid" },
    girl: { label: "여자아이", walk: "assets/chars/girl.glb", height: 1.22 },
    woman: { label: "여성", walk: "assets/chars/woman.glb", height: 1.7 },
    man: { label: "남성", walk: "assets/chars/man.glb", height: 1.78 },
    grandpa: { label: "할아버지", walk: "assets/chars/grandpa.glb", height: 1.68 },
    grandma: { label: "할머니", walk: "assets/chars/grandma.glb", height: 1.6 },
  };
  // 예전 키(kid) 저장값 호환
  const CHAR_ALIAS = { kid: "boy" };

  const CUSTOM_COLORS = ["#e74c3c", "#f39c12", "#f6d743", "#2ecc71", "#3498db", "#9b59b6", "#ff7fb2", "#f4f4f0"];

  const myId = (crypto.randomUUID && crypto.randomUUID()) || "u" + Math.random().toString(36).slice(2);
  let myChar = null;
  let myNick = "";
  let myColor = CUSTOM_COLORS[4];
  let myScale = 1;
  try {
    myChar = localStorage.getItem("seum_char");
    if (myChar && CHAR_ALIAS[myChar]) myChar = CHAR_ALIAS[myChar];
    if (myChar && !CHARACTERS[myChar]) myChar = null;
    myNick = localStorage.getItem("seum_nick") || "";
    myColor = localStorage.getItem("seum_color") || myColor;
    myScale = parseFloat(localStorage.getItem("seum_scale")) || 1;
  } catch (e) {}

  // 포인트 컬러 풍선 액세서리
  function makeBalloon(hex, charH) {
    const g = new THREE.Group();
    const string = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, 0.55, 5),
      new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.9 })
    );
    string.position.y = 0.275;
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 18, 18),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(hex), roughness: 0.35 })
    );
    ball.position.y = 0.72;
    ball.scale.y = 1.12;
    g.add(string, ball);
    g.position.set(0.42, charH * 0.86, -0.1);
    g.userData.baseY = g.position.y;
    return g;
  }
  function attachBalloon(group, hex, charH) {
    if (group.userData.balloon) group.remove(group.userData.balloon);
    const b = makeBalloon(hex, charH);
    group.add(b);
    group.userData.balloon = b;
  }

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

  // 캐릭터 GLB 캐시 (scene+animations 통째로)
  const charCache = {};
  function loadCharAsset(url) {
    if (!charCache[url]) {
      charCache[url] = new Promise((resolve, reject) =>
        loader.load(url, (g) => { sharpen(g.scene); resolve(g); }, undefined, reject)
      );
    }
    return charCache[url];
  }

  // 같은 캐릭터를 여러 명이 써도 되도록 스켈레톤 클론으로 인스턴스 생성
  function buildCharInstance(charKey) {
    const def = CHARACTERS[charKey] || CHARACTERS.robot;
    return loadCharAsset(def.walk).then((gltf) => {
      const inst = skeletonClone(gltf.scene);
      inst.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      const box = skinnedBox(inst);
      const size = box.getSize(new THREE.Vector3());
      inst.scale.setScalar(def.height / Math.max(size.y, 0.01));
      const box2 = skinnedBox(inst);
      inst.position.y -= box2.min.y;
      const c = box2.getCenter(new THREE.Vector3());
      inst.position.x -= c.x; inst.position.z -= c.z;
      const mx = new THREE.AnimationMixer(inst);
      let walk = null;
      if (gltf.animations && gltf.animations.length) {
        walk = mx.clipAction(gltf.animations[0]);
        walk.play();
        walk.paused = true;
      }
      const rig = { obj: inst, mixer: mx, walk, run: null };
      if (def.run) {
        loadCharAsset(def.run)
          .then((rg) => { if (rg.animations && rg.animations.length) rig.run = mx.clipAction(rg.animations[0]); })
          .catch(() => {});
      }
      return rig;
    });
  }

  function capsuleFallback() {
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
    return { obj: g, mixer: null, walk: null, run: null };
  }

  let playerRig = null;
  function setPlayerCharacter(charKey) {
    myChar = CHARACTERS[charKey] ? charKey : "robot";
    try { localStorage.setItem("seum_char", myChar); } catch (e) {}
    buildCharInstance(myChar)
      .catch(() => capsuleFallback())
      .then((rig) => {
        while (player.children.length) player.remove(player.children[0]);
        player.userData.balloon = null;
        player.add(rig.obj);
        playerRig = rig;
        attachBalloon(player, myColor, CHARACTERS[myChar].height);
        player.scale.setScalar(myScale);
        loadingEl.hidden = true;
        if (rtChannel) {
          try { rtChannel.track({ char: myChar, nick: myNick || "방문객", color: myColor, scale: myScale }); } catch (e) {}
        }
      });
  }

  player.position.set(0, 0, 4);

  // ---------- 멀티플레이 (Supabase Realtime) ----------
  const remotes = new Map(); // id -> { group, rig, char, nick, target }
  let rtChannel = null;

  function spawnRemote(id, meta) {
    const charKey = CHARACTERS[meta.char] ? meta.char : "robot";
    const group = new THREE.Group();
    group.position.set((Math.random() - 0.5) * 4, 0, 4 + Math.random() * 3);
    scene.add(group);
    const metaKey = `${charKey}|${meta.color || ""}|${meta.scale || 1}|${meta.nick || ""}`;
    const entry = { group, rig: null, metaKey, target: null };
    remotes.set(id, entry);
    buildCharInstance(charKey)
      .catch(() => capsuleFallback())
      .then((rig) => {
        if (!remotes.has(id) || remotes.get(id) !== entry) return;
        group.add(rig.obj);
        const h = CHARACTERS[charKey] ? CHARACTERS[charKey].height : 1.8;
        const label = nameSign(meta.nick || "방문객");
        label.scale.set(2.4, 0.6, 1);
        label.position.y = h + 0.55;
        group.add(label);
        if (meta.color) attachBalloon(group, meta.color, h);
        const sc = parseFloat(meta.scale);
        if (sc && sc > 0.5 && sc < 2) group.scale.setScalar(sc);
        entry.rig = rig;
      });
  }

  function removeRemote(id) {
    const r = remotes.get(id);
    if (r) { scene.remove(r.group); remotes.delete(id); }
  }

  function joinRealtime() {
    if (rtChannel || !window.supabase || !window.supabase.createClient) return;
    try {
      const client = window.supabase.createClient(SB_URL, SB_KEY);
      rtChannel = client.channel("seum-town-v1", {
        config: { presence: { key: myId }, broadcast: { self: false } },
      });
      rtChannel.on("presence", { event: "sync" }, () => {
        const state = rtChannel.presenceState();
        Object.entries(state).forEach(([id, metas]) => {
          if (id === myId) return;
          const meta = (metas && metas[0]) || {};
          const metaKey = `${CHARACTERS[meta.char] ? meta.char : "robot"}|${meta.color || ""}|${meta.scale || 1}|${meta.nick || ""}`;
          const existing = remotes.get(id);
          if (!existing) {
            spawnRemote(id, meta);
          } else if (existing.metaKey !== metaKey) {
            removeRemote(id);
            spawnRemote(id, meta);
          }
        });
        [...remotes.keys()].forEach((id) => { if (!state[id]) removeRemote(id); });
      });
      rtChannel.on("broadcast", { event: "pos" }, ({ payload }) => {
        const r = remotes.get(payload.id);
        if (r) r.target = payload;
      });
      rtChannel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          try { rtChannel.track({ char: myChar || "robot", nick: myNick || "방문객", color: myColor, scale: myScale }); } catch (e) {}
        }
      });
    } catch (e) {
      rtChannel = null;
    }
  }

  let lastSend = 0;
  let wasMoving = false;
  function broadcastPos(now, moving, sprinting) {
    if (!rtChannel) return;
    if (!moving && !wasMoving && now - lastSend < 2) return; // 정지 중엔 2초 하트비트
    if (now - lastSend < 0.12) return;
    lastSend = now;
    wasMoving = moving;
    try {
      rtChannel.send({
        type: "broadcast",
        event: "pos",
        payload: {
          id: myId,
          x: +player.position.x.toFixed(2),
          z: +player.position.z.toFixed(2),
          y: +player.position.y.toFixed(2),
          h: +heading.toFixed(2),
          m: moving ? 1 : 0,
          run: sprinting ? 1 : 0,
        },
      });
    } catch (e) {}
  }

  // ---------- 캐릭터 선택 UI ----------
  const selEl = document.getElementById("town-select");
  const selGrid = document.getElementById("town-select-grid");
  const nickInput = document.getElementById("town-nick");
  const enterBtn = document.getElementById("town-enter");
  const charBtn = document.getElementById("town-char");
  let selChar = myChar || "robot";

  const colorsEl = document.getElementById("town-colors");
  const scaleEl = document.getElementById("town-scale");
  const scaleValEl = document.getElementById("town-scale-val");
  let selColor = myColor;
  let selScale = myScale;

  function renderSelect() {
    if (!selGrid) return;
    selGrid.innerHTML = Object.entries(CHARACTERS)
      .map(([k, d]) => `
        <button type="button" class="town__char${k === selChar ? " is-sel" : ""}" data-char="${k}">
          <img src="assets/chars/${d.img || k}.webp" alt="${d.label}" loading="lazy" />
          <span>${d.label}</span>
        </button>`)
      .join("");
    selGrid.querySelectorAll(".town__char").forEach((b) =>
      b.addEventListener("click", () => {
        selChar = b.dataset.char;
        selGrid.querySelectorAll(".town__char").forEach((x) => x.classList.toggle("is-sel", x === b));
      })
    );
    if (colorsEl) {
      colorsEl.innerHTML = CUSTOM_COLORS
        .map((c) => `<button type="button" class="town__color${c === selColor ? " is-sel" : ""}" data-color="${c}" style="background:${c}" aria-label="포인트 컬러 ${c}"></button>`)
        .join("");
      colorsEl.querySelectorAll(".town__color").forEach((b) =>
        b.addEventListener("click", () => {
          selColor = b.dataset.color;
          colorsEl.querySelectorAll(".town__color").forEach((x) => x.classList.toggle("is-sel", x === b));
        })
      );
    }
    if (scaleEl) {
      scaleEl.value = Math.round(selScale * 100);
      if (scaleValEl) scaleValEl.textContent = `${Math.round(selScale * 100)}%`;
    }
  }
  if (scaleEl) {
    scaleEl.addEventListener("input", () => {
      selScale = scaleEl.value / 100;
      if (scaleValEl) scaleValEl.textContent = `${scaleEl.value}%`;
    });
  }
  function openSelect() {
    if (!selEl) return;
    renderSelect();
    if (nickInput) nickInput.value = myNick;
    selEl.hidden = false;
  }
  if (enterBtn) {
    enterBtn.addEventListener("click", () => {
      myNick = ((nickInput && nickInput.value) || "").trim().slice(0, 10) || "방문객";
      myColor = selColor;
      myScale = Math.min(1.15, Math.max(0.9, selScale));
      try {
        localStorage.setItem("seum_nick", myNick);
        localStorage.setItem("seum_color", myColor);
        localStorage.setItem("seum_scale", String(myScale));
      } catch (e) {}
      selEl.hidden = true;
      setPlayerCharacter(selChar);
      joinRealtime();
    });
  }
  if (charBtn) charBtn.addEventListener("click", openSelect);

  if (myChar) {
    setPlayerCharacter(myChar);
    joinRealtime();
  } else {
    setPlayerCharacter("robot");
    openSelect();
  }

  // ---------- 입력 ----------
  const keys = new Set();
  let shiftHeld = false;
  const KEYMAP = {
    ArrowUp: "f", KeyW: "f", ArrowDown: "b", KeyS: "b",
    ArrowLeft: "l", KeyA: "l", ArrowRight: "r", KeyD: "r",
  };
  // 점프
  let vy = 0;
  let airborne = false;
  function doJump() {
    if (!airborne) { vy = 9.4; airborne = true; }
  }
  const jumpBtn = document.getElementById("town-jump");
  if (jumpBtn) jumpBtn.addEventListener("pointerdown", (e) => { doJump(); e.preventDefault(); });

  window.addEventListener("keydown", (e) => {
    if (e.code === "ShiftLeft" || e.code === "ShiftRight") { shiftHeld = true; return; }
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if (e.code === "Space" && running) { doJump(); e.preventDefault(); return; }
    const dir = KEYMAP[e.code];
    if (!dir || !running) return;
    keys.add(dir);
    if (e.code.startsWith("Arrow")) e.preventDefault();
  });
  window.addEventListener("keyup", (e) => {
    if (e.code === "ShiftLeft" || e.code === "ShiftRight") { shiftHeld = false; return; }
    const dir = KEYMAP[e.code];
    if (dir) keys.delete(dir);
  });

  // 조이스틱 (터치 + 마우스 공용, 포인터 이벤트)
  const joy = { active: false, x: 0, y: 0 };
  function joyMove(e) {
    const rect = joyBase.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = e.clientX - cx, dy = e.clientY - cy;
    const max = rect.width / 2 - 14;
    const len = Math.hypot(dx, dy);
    if (len > max) { dx = (dx / len) * max; dy = (dy / len) * max; }
    joyStick.style.transform = `translate(${dx}px, ${dy}px)`;
    joy.x = dx / max; joy.y = dy / max;
  }
  function joyEnd() {
    joy.active = false; joy.x = joy.y = 0;
    joyStick.style.transform = "translate(0,0)";
  }
  joyBase.addEventListener("pointerdown", (e) => {
    joy.active = true;
    joyBase.setPointerCapture(e.pointerId);
    joyMove(e);
    e.preventDefault();
  });
  joyBase.addEventListener("pointermove", (e) => { if (joy.active) joyMove(e); });
  ["pointerup", "pointercancel"].forEach((ev) => joyBase.addEventListener(ev, joyEnd));

  // 카메라 줌(휠/핀치)·회전(드래그)
  let camAz = 0;
  let camZoom = 1;
  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    camZoom = Math.min(4.4, Math.max(0.55, camZoom * (1 + e.deltaY * 0.0012)));
  }, { passive: false });

  let orbit = null;
  let pinch = null;
  canvas.addEventListener("touchstart", (e) => {
    if (e.touches.length === 2) {
      pinch = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    }
  }, { passive: true });
  canvas.addEventListener("touchmove", (e) => {
    if (pinch && e.touches.length === 2) {
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      camZoom = Math.min(4.4, Math.max(0.55, camZoom * (pinch / d)));
      pinch = d;
    }
  }, { passive: true });
  canvas.addEventListener("touchend", () => { pinch = null; });

  // 하우스 클릭 → 상세 / 드래그 → 시점 회전
  const ray = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let downAt = null;
  canvas.addEventListener("pointerdown", (e) => {
    downAt = [e.clientX, e.clientY];
    orbit = { px: e.clientX, az0: camAz };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (orbit && (e.buttons || e.pointerType === "touch")) {
      camAz = orbit.az0 + (e.clientX - orbit.px) * 0.006;
    }
  });
  canvas.addEventListener("pointercancel", () => { orbit = null; });
  canvas.addEventListener("pointerup", (e) => {
    orbit = null;
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

  // 미니맵
  const mapCanvas = document.getElementById("town-map");
  const mapCtx = mapCanvas ? mapCanvas.getContext("2d") : null;
  let mapTimer = 0;
  function drawMap() {
    const S = mapCanvas.width;
    const c = S / 2;
    const scale = (S / 2 - 8) / (WORLD_R + 12);
    mapCtx.clearRect(0, 0, S, S);
    mapCtx.save();
    mapCtx.beginPath();
    mapCtx.arc(c, c, S / 2 - 3, 0, Math.PI * 2);
    mapCtx.clip();
    mapCtx.fillStyle = "#8fbe75";
    mapCtx.fillRect(0, 0, S, S);
    mapCtx.strokeStyle = "rgba(210,200,178,0.95)";
    mapCtx.lineWidth = 4;
    [21.5, 31.5].forEach((r) => {
      mapCtx.beginPath();
      mapCtx.arc(c, c, r * scale, 0, Math.PI * 2);
      mapCtx.stroke();
    });
    mapCtx.fillStyle = "#d9cfbb";
    mapCtx.beginPath();
    mapCtx.arc(c, c, 7.5 * scale, 0, Math.PI * 2);
    mapCtx.fill();
    // 집
    mapCtx.fillStyle = "#274b38";
    houseLots.forEach((l) => {
      mapCtx.fillRect(c + l.wrap.position.x * scale - 2.4, c + l.wrap.position.z * scale - 2.4, 4.8, 4.8);
    });
    // 다른 방문자
    mapCtx.fillStyle = "#f39c12";
    remotes.forEach((r) => {
      mapCtx.beginPath();
      mapCtx.arc(c + r.group.position.x * scale, c + r.group.position.z * scale, 3, 0, Math.PI * 2);
      mapCtx.fill();
    });
    // 내 위치 (진행 방향 화살표)
    mapCtx.save();
    mapCtx.translate(c + player.position.x * scale, c + player.position.z * scale);
    mapCtx.rotate(Math.PI - heading);
    mapCtx.fillStyle = "#e74c3c";
    mapCtx.strokeStyle = "#fff";
    mapCtx.lineWidth = 1.5;
    mapCtx.beginPath();
    mapCtx.moveTo(0, -6.5);
    mapCtx.lineTo(4.4, 4.6);
    mapCtx.lineTo(-4.4, 4.6);
    mapCtx.closePath();
    mapCtx.fill();
    mapCtx.stroke();
    mapCtx.restore();
    mapCtx.restore();
  }
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
      // 입력을 카메라 방향 기준으로 회전 (시점을 돌려도 W = 화면 앞)
      const ca = Math.cos(camAz), sa = Math.sin(camAz);
      const wx = mx * ca + mz * sa;
      const wz = -mx * sa + mz * ca;
      const dir = Math.atan2(wx, wz);
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
      const wantRun = sprinting && playerRig && playerRig.run;
      const active = playerRig ? (wantRun ? playerRig.run : playerRig.walk) : null;
      const idle = playerRig ? (wantRun ? playerRig.walk : playerRig.run) : null;
      if (idle && idle.isRunning()) idle.stop();
      if (active) {
        if (!active.isRunning()) active.play();
        active.paused = false;
        // 달리기 클립이 없으면 걷기 재생속도를 올려 임시 대응
        active.timeScale = wantRun ? 1.1 : (sprinting ? 1.8 : 0.7 + mag * 0.6);
      }
      updateNearCard();
    } else if (playerRig) {
      if (playerRig.walk) playerRig.walk.paused = true;
      if (playerRig.run) playerRig.run.paused = true;
    }

    // 점프 물리
    if (airborne) {
      vy -= 24 * dt;
      player.position.y += vy * dt;
      if (player.position.y <= 0) { player.position.y = 0; vy = 0; airborne = false; }
    }

    if (playerRig && playerRig.mixer) playerRig.mixer.update(dt);

    // 원격 방문자 보간·애니메이션
    remotes.forEach((r) => {
      const t = r.target;
      if (t) {
        r.group.position.x += (t.x - r.group.position.x) * Math.min(1, dt * 10);
        r.group.position.z += (t.z - r.group.position.z) * Math.min(1, dt * 10);
        r.group.position.y += ((t.y || 0) - r.group.position.y) * Math.min(1, dt * 12);
        if (typeof t.h === "number") {
          let diff = t.h - r.group.rotation.y;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          r.group.rotation.y += diff * Math.min(1, dt * 8);
        }
        if (r.rig) {
          const act = t.run && r.rig.run ? r.rig.run : r.rig.walk;
          const other = act === r.rig.run ? r.rig.walk : r.rig.run;
          if (t.m) {
            if (other && other.isRunning()) other.stop();
            if (act) {
              if (!act.isRunning()) act.play();
              act.paused = false;
              act.timeScale = t.run && !r.rig.run ? 1.8 : 1.1;
            }
          } else {
            if (r.rig.walk) r.rig.walk.paused = true;
            if (r.rig.run) r.rig.run.paused = true;
          }
        }
      }
      if (r.rig && r.rig.mixer) r.rig.mixer.update(dt);
    });

    broadcastPos(clock.elapsedTime, moving, sprinting);

    clouds.forEach((c, i) => { c.position.x += dt * (0.25 + i * 0.05); if (c.position.x > 55) c.position.x = -55; });

    // 풍선 둥실거림
    const bobT = clock.elapsedTime;
    const bob = (g, phase) => {
      const b = g.userData.balloon;
      if (b) {
        b.position.y = b.userData.baseY + Math.sin(bobT * 1.8 + phase) * 0.05;
        b.rotation.z = Math.sin(bobT * 1.3 + phase) * 0.08;
      }
    };
    bob(player, 0);
    let ph = 1;
    remotes.forEach((r) => bob(r.group, ph++));

    // 시점: 줌·회전 반영
    camOffset.set(Math.sin(camAz) * 9.5 * camZoom, 6.2 * camZoom, Math.cos(camAz) * 9.5 * camZoom);
    scene.fog.near = 40 * Math.max(1, camZoom);
    scene.fog.far = 95 * Math.max(1, camZoom);
    camPos.lerp(new THREE.Vector3().copy(player.position).add(camOffset), 1 - Math.pow(0.001, dt));
    camera.position.copy(camPos);
    lookAt.lerp(new THREE.Vector3(player.position.x, player.position.y + 1.2, player.position.z), 1 - Math.pow(0.0005, dt));
    camera.lookAt(lookAt);

    // 미니맵 갱신 (0.15초 간격)
    if (mapCtx) {
      mapTimer += dt;
      if (mapTimer > 0.15) { mapTimer = 0; drawMap(); }
    }

    positionCard();
    renderer.render(scene, camera);
  }
  tick();
}
