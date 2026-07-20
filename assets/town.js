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
  sun.shadow.camera.left = -40; sun.shadow.camera.right = 40;
  sun.shadow.camera.top = 40; sun.shadow.camera.bottom = -40;
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
    const path = new THREE.Mesh(new THREE.PlaneGeometry(3, 26), pathMat);
    path.rotation.x = -Math.PI / 2;
    path.position.set(Math.sin(a) * 19, 0.015, Math.cos(a) * 19);
    path.rotation.z = -a;
    path.receiveShadow = true;
    scene.add(path);
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
    const rad = 26 + Math.random() * (WORLD_R - 28);
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

  // 세움 하우스 배치 (기존 image-to-3D 하우스 재사용)
  const HOUSES = [
    { pos: [-14, -13], rot: 0.6, h: 4.6, label: "STAY 19RB" },
    { pos: [15, -11], rot: -0.7, h: 4.0, label: "STAY 16GB" },
    { pos: [-16, 12], rot: 2.3, h: 3.6, label: "FOREST 6" },
    { pos: [14, 14], rot: -2.4, h: 4.3, label: "CUBE-G 10W" },
    { pos: [0, -21], rot: 0, h: 5.0, label: "STAY 28" },
  ];
  loader.load("assets/house-3d.glb", (glb) => {
    sharpen(glb.scene);
    HOUSES.forEach((cfg) => {
      const wrap = new THREE.Group();
      const inst = glb.scene.clone(true);
      inst.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      normalize(inst, cfg.h);
      inst.position.y -= cfg.h * 0.045; // 스캔 밑판을 지면에 살짝 묻기
      wrap.add(inst);
      wrap.position.set(cfg.pos[0], 0, cfg.pos[1]);
      wrap.rotation.y = cfg.rot;
      wrap.userData.label = cfg.label;
      scene.add(wrap);
      clickTargets.push(wrap);
    });
  });

  // ---------- 캐릭터 (세움봇) ----------
  const player = new THREE.Group();
  scene.add(player);
  let mixer = null;
  let walkAction = null;

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
  const KEYMAP = {
    ArrowUp: "f", KeyW: "f", ArrowDown: "b", KeyS: "b",
    ArrowLeft: "l", KeyA: "l", ArrowRight: "r", KeyD: "r",
  };
  window.addEventListener("keydown", (e) => {
    const dir = KEYMAP[e.code];
    if (!dir || !running) return;
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    keys.add(dir);
    if (e.code.startsWith("Arrow")) e.preventDefault();
  });
  window.addEventListener("keyup", (e) => {
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
      const prod = document.getElementById("products");
      if (prod) prod.scrollIntoView({ behavior: "smooth" });
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

  // ---------- 루프 ----------
  const SPEED = 5.2;
  const camOffset = new THREE.Vector3(0, 6.2, 9.5);
  const camPos = new THREE.Vector3().copy(player.position).add(camOffset);
  const lookAt = new THREE.Vector3();
  const clock = new THREE.Clock();
  let heading = 0;

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

    if (moving) {
      const dir = Math.atan2(mx, mz);
      player.position.x += Math.sin(dir) * SPEED * mag * dt;
      player.position.z += Math.cos(dir) * SPEED * mag * dt;
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
      if (walkAction) { walkAction.paused = false; walkAction.timeScale = 0.7 + mag * 0.6; }
    } else if (walkAction) {
      walkAction.paused = true;
    }
    if (mixer) mixer.update(dt);

    clouds.forEach((c, i) => { c.position.x += dt * (0.25 + i * 0.05); if (c.position.x > 55) c.position.x = -55; });

    camPos.lerp(new THREE.Vector3().copy(player.position).add(camOffset), 1 - Math.pow(0.001, dt));
    camera.position.copy(camPos);
    lookAt.lerp(new THREE.Vector3(player.position.x, player.position.y + 1.2, player.position.z), 1 - Math.pow(0.0005, dt));
    camera.lookAt(lookAt);

    renderer.render(scene, camera);
  }
  tick();
}
