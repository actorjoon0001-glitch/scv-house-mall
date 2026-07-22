// ============ METAHOUSE 3D TOWN ============
// 상쾌환 스타일의 미니 3D 타운: 메타봇이 하우스 사이를 걸어다닌다.
import * as THREE from "three";
import { GLTFLoader } from "./GLTFLoader.js";
import { RGBELoader } from "./RGBELoader.js";
import { clone as skeletonClone } from "./SkeletonUtils.js";
import { EffectComposer } from "./postprocessing/EffectComposer.js";
import { RenderPass } from "./postprocessing/RenderPass.js";
import { UnrealBloomPass } from "./postprocessing/UnrealBloomPass.js";
import { OutputPass } from "./postprocessing/OutputPass.js";

const stage = document.getElementById("town-stage");
const canvas = document.getElementById("town-canvas");
const loadingEl = document.getElementById("town-loading");
const joyBase = document.getElementById("town-joystick");
const joyStick = document.getElementById("town-stick");

// ---------- 로딩 화면: 진행률 + 팁 로테이션 ----------
// GLB·HDRI·텍스처가 모두 기본 로딩매니저를 쓰므로 전체 진행률을 한 번에 집계할 수 있다.
{
  const fill = document.getElementById("town-loading-fill");
  const tipEl = document.getElementById("town-loading-tip");
  const TIPS = [
    "💡 SHIFT를 누르면 달릴 수 있어요",
    "💡 집 앞에 서면 가격·상담 카드가 떠요",
    "💡 왼쪽 아래 미니맵을 누르면 큰 지도가 열려요",
    "💡 남서쪽 체험존에서 내 집을 직접 지어볼 수 있어요",
    "💡 🌙 버튼으로 밤의 전시장도 구경해보세요",
    "💡 안내봇 메타봇에게 다가가면 존을 안내해줘요",
  ];
  let tipIdx = 0;
  const tipTimer = setInterval(() => {
    if (!loadingEl || loadingEl.hidden) { clearInterval(tipTimer); return; }
    tipIdx = (tipIdx + 1) % TIPS.length;
    if (tipEl) tipEl.textContent = TIPS[tipIdx];
  }, 2200);
  let maxTotal = 0;
  THREE.DefaultLoadingManager.onProgress = (url, loaded, total) => {
    maxTotal = Math.max(maxTotal, total);
    if (fill && maxTotal) fill.style.width = Math.min(100, Math.round((loaded / maxTotal) * 100)) + "%";
  };
}

let started = false;
let running = false;

// 마을은 회원 전용: 계정(또는 회원 시스템 미구축 시 게스트 승인) 없으면 시작 화면으로
try {
  if (!localStorage.getItem("seum_user") && !localStorage.getItem("seum_guest_ok")) {
    window.location.replace("index.html");
  }
} catch (e) {}

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
  // dpr 1 모니터에서도 최소 1.6배로 슈퍼샘플링해 계단현상/뭉개짐 방지.
  // 단, 프레임이 안 나오는 기기는 자동 품질 조절(qLevel)이 해상도를 단계적으로 낮춘다.
  const Q_CAPS = [2.5, 1.6, 1.2, 0.9]; // qLevel별 픽셀비 상한
  let qLevel = 0;
  const pixelRatio = () => {
    const base = qLevel === 0 ? Math.max(window.devicePixelRatio || 1, 1.6) : (window.devicePixelRatio || 1);
    return Math.min(base, Q_CAPS[qLevel]);
  };
  renderer.setPixelRatio(pixelRatio());
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xbfe0f5);
  scene.fog = new THREE.Fog(0xbfe0f5, 55, 155);

  // near 0.5: 깊이 버퍼 정밀도 확보 (far 확장으로 인한 바닥 z-파이팅 방지 — 카메라가 0.5m 안까지 붙을 일 없음)
  const camera = new THREE.PerspectiveCamera(48, 1, 0.5, 520);

  // ---------- PBR 지면 텍스처 (ambientCG CC0, 512px 축소판 — 모바일 로딩 부담 최소화) ----------
  THREE.Cache.enabled = true; // 같은 텍스처 파일 재요청 방지
  const texLoader = new THREE.TextureLoader();
  const texAniso = renderer.capabilities.getMaxAnisotropy();
  function pbrTex(url, srgb, rx, ry) {
    const t = texLoader.load(url);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rx, ry);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = texAniso;
    return t;
  }

  // ---------- 후처리: 은은한 블룸 (고사양 티어 전용, 실패 시 기본 렌더 폴백) ----------
  // 주의: SSAOPass는 MSAA 렌더타깃과 충돌해 고사양에서 화면이 비는 문제가 있어 사용하지 않는다.
  let composer = null;
  try {
    const rt = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, samples: 4 });
    composer = new EffectComposer(renderer, rt);
    composer.addPass(new RenderPass(scene, camera));
    // 과하면 촌스러워지므로 강도는 낮게, 문턱은 햇빛·조명만 번지게
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.2, 0.5, 0.85));
    composer.addPass(new OutputPass());
  } catch (e) {
    composer = null;
  }

  // ---------- 조명 ----------
  // HDRI 로드 전 폴백 조명 (로드되면 HDRI가 주광을 맡고 아래 값은 축소됨)
  const hemi = new THREE.HemisphereLight(0xdff0ff, 0x7da06a, 1.0);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2df, 2.2);
  sun.position.set(18, 30, 14);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  // 그림자 카메라를 플레이어 주변에만 집중시켜 같은 해상도로 훨씬 선명한 그림자 (tick에서 추적)
  sun.shadow.camera.left = -36; sun.shadow.camera.right = 36;
  sun.shadow.camera.top = 36; sun.shadow.camera.bottom = -36;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02; // 벽면 그림자 줄무늬(acne) 제거
  scene.add(sun);
  scene.add(sun.target);

  // ---------- HDRI 하늘·환경광 (Poly Haven kloofendal_48d_partly_cloudy_puresky, CC0) ----------
  // 좁은 화면/데이터 절약 모드는 1K, 그 외 2K
  const hdrFile =
    window.innerWidth < 700 || (navigator.connection && navigator.connection.saveData)
      ? "assets/hdri/sky_1k.hdr"
      : "assets/hdri/sky_2k.hdr";
  let skyTex = null; // 낮 하늘 HDRI (밤 모드에서 복귀할 때 사용)
  new RGBELoader().load(
    hdrFile,
    (tex) => {
      tex.mapping = THREE.EquirectangularReflectionMapping;
      skyTex = tex;
      if (nightMode) return; // 밤 모드 중이면 낮 복귀 때 적용
      scene.background = tex;
      scene.environment = tex; // 집·바닥·캐릭터에 자연광
      hemi.intensity = 0.18;   // 보조광을 낮춰 태양·그림자 대비 강화 (게임풍 라이팅)
      sun.intensity = 1.95;
      renderer.toneMappingExposure = 1.12;
      scene.fog.color.set(0xe7eef4); // 안개 색을 지평선 톤에 맞춤
    },
    undefined,
    () => {} // 실패 시 기존 단색 하늘·조명 유지
  );

  // ---------- 밤/낮 모드 ----------
  let nightMode = false;
  let lampGroup = null;
  function buildLamps() {
    // 밤 전용 가로등 불빛 (기둥·전구는 소품 섹션에서 상시 표시)
    lampGroup = new THREE.Group();
    // 바닥 불빛 웅덩이 텍스처 (라디얼 그라데이션 — 조명 웅덩이 연출, 드로우 부담 거의 없음)
    const pc = document.createElement("canvas");
    pc.width = pc.height = 128;
    const px = pc.getContext("2d");
    const grad = px.createRadialGradient(64, 64, 4, 64, 64, 62);
    grad.addColorStop(0, "rgba(255,220,160,0.85)");
    grad.addColorStop(0.5, "rgba(255,205,130,0.35)");
    grad.addColorStop(1, "rgba(255,200,120,0)");
    px.fillStyle = grad;
    px.fillRect(0, 0, 128, 128);
    const poolTex = new THREE.CanvasTexture(pc);
    const poolMat = new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
    for (let z = 12; z >= -60; z -= 18) {
      const pl = new THREE.PointLight(0xffd9a0, 15, 26, 2);
      pl.position.set(0, 3.6, z);
      lampGroup.add(pl);
      const pool = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), poolMat);
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(0, 0.055, z);
      lampGroup.add(pool);
    }
    lampGroup.visible = false;
    scene.add(lampGroup);
  }
  function setNight(on) {
    nightMode = on;
    if (on && !lampGroup) buildLamps();
    if (lampGroup) lampGroup.visible = on;
    // 가로등 전구 발광 (밤 + 블룸에서 은은히 번짐)
    lampBulbMat.emissive.set(on ? 0xffdf9e : 0x000000);
    lampBulbMat.emissiveIntensity = on ? 1.6 : 1;
    // 원경 산 능선: 밤에는 어두운 남색 실루엣으로
    mountainMats.forEach((m) => m.color.set(on ? 0x1c2433 : 0xffffff));
    // 간판(보드)들이 밤에 은은히 발광 — 야간 전시장 분위기
    (BOARD_MATS || []).forEach((m) => {
      m.emissive.set(on ? 0xffffff : 0x000000);
      m.emissiveMap = on ? m.map : null;
      m.emissiveIntensity = 0.5;
      m.needsUpdate = true;
    });
    if (on) {
      scene.background = new THREE.Color(0x0b1322);
      scene.environment = null;
      scene.fog.color.set(0x0b1322);
      hemi.color.set(0x2c3d58);
      hemi.groundColor.set(0x1a2030);
      hemi.intensity = 0.5;
      sun.color.set(0x9db8e8); // 달빛
      sun.intensity = 0.55;
      renderer.toneMappingExposure = 0.95;
    } else {
      hemi.color.set(0xdff0ff);
      hemi.groundColor.set(0x7da06a);
      sun.color.set(0xfff2df);
      if (skyTex) {
        scene.background = skyTex;
        scene.environment = skyTex;
        hemi.intensity = 0.18;
        sun.intensity = 1.95;
        scene.fog.color.set(0xe7eef4);
      } else {
        scene.background = new THREE.Color(0xbfe0f5);
        hemi.intensity = 1.0;
        sun.intensity = 2.2;
        scene.fog.color.set(0xbfe0f5);
      }
      renderer.toneMappingExposure = 1.12;
    }
    const nb = document.getElementById("town-night");
    if (nb) nb.textContent = on ? "☀️" : "🌙";
  }
  {
    const nb = document.getElementById("town-night");
    if (nb) nb.addEventListener("click", () => setNight(!nightMode));
  }

  // ---------- 사운드 (BGM 음원 파일 + 신스 효과음) ----------
  let soundOn = true;
  try { soundOn = localStorage.getItem("seum_sound") !== "0"; } catch (e) {}
  let audioCtx = null, masterGain = null, noiseBuf = null, bgmEl = null;
  function initAudio() {
    if (audioCtx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    audioCtx = new AC();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = soundOn ? 1 : 0;
    masterGain.connect(audioCtx.destination);
    // 발소리용 노이즈 버퍼
    noiseBuf = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.08, audioCtx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    // BGM: 업로드 음원 (Gallery Drift) 반복 재생
    bgmEl = new Audio("assets/bgm.mp3");
    bgmEl.loop = true;
    bgmEl.volume = 0.55;
    bgmEl.preload = "auto";
    if (soundOn) bgmEl.play().catch(() => {});
  }
  function playStep(sprinting) {
    if (!audioCtx || !soundOn || audioCtx.state !== "running") return;
    // 발소리 = 쿵(저음 썸프) + 탁(노이즈 탭) — BGM 위에서도 또렷하게
    const t = audioCtx.currentTime;
    const o = audioCtx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(sprinting ? 135 : 110, t);
    o.frequency.exponentialRampToValueAtTime(55, t + 0.08);
    const og = audioCtx.createGain();
    og.gain.setValueAtTime(0.28, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    o.connect(og).connect(masterGain);
    o.start(t);
    o.stop(t + 0.12);
    const src = audioCtx.createBufferSource();
    src.buffer = noiseBuf;
    src.playbackRate.value = 0.85 + Math.random() * 0.3; // 걸음마다 살짝 다른 톤
    const bp = audioCtx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = sprinting ? 900 : 700;
    const g = audioCtx.createGain();
    g.gain.value = 0.12;
    src.connect(bp).connect(g).connect(masterGain);
    src.start(t);
  }
  function playJump() {
    if (!audioCtx || !soundOn || audioCtx.state !== "running") return;
    // 게임식 점프음: 위로 슉 올라가는 스윕
    const t = audioCtx.currentTime;
    const o = audioCtx.createOscillator();
    o.type = "square";
    o.frequency.setValueAtTime(260, t);
    o.frequency.exponentialRampToValueAtTime(660, t + 0.13);
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.09, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    o.connect(g).connect(masterGain);
    o.start(t);
    o.stop(t + 0.2);
  }
  function playLand() {
    if (!audioCtx || !soundOn || audioCtx.state !== "running") return;
    // 착지: 짧고 묵직한 쿵
    const t = audioCtx.currentTime;
    const o = audioCtx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(50, t + 0.09);
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(g).connect(masterGain);
    o.start(t);
    o.stop(t + 0.14);
  }
  let stepT = 0;
  function stepTick(dt, moving, sprinting, grounded) {
    if (!moving || !grounded) { stepT = 0.3; return; }
    stepT += dt;
    if (stepT > (sprinting ? 0.3 : 0.44)) { stepT = 0; playStep(sprinting); }
  }
  function setSound(on) {
    soundOn = on;
    try { localStorage.setItem("seum_sound", on ? "1" : "0"); } catch (e) {}
    if (on && !audioCtx) initAudio();
    if (audioCtx) {
      if (on && audioCtx.state === "suspended") audioCtx.resume();
      if (masterGain) masterGain.gain.value = on ? 1 : 0;
    }
    if (bgmEl) { if (on) bgmEl.play().catch(() => {}); else bgmEl.pause(); }
    const sb = document.getElementById("town-sound");
    if (sb) sb.textContent = on ? "🔊" : "🔇";
  }
  {
    const sb = document.getElementById("town-sound");
    if (sb) {
      sb.textContent = soundOn ? "🔊" : "🔇";
      sb.addEventListener("click", () => setSound(!soundOn));
    }
    // 브라우저 자동재생 정책: 첫 입력에서 오디오 시작
    const kick = () => {
      if (!soundOn) return;
      initAudio();
      if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
      if (bgmEl && bgmEl.paused) bgmEl.play().catch(() => {});
    };
    window.addEventListener("pointerdown", kick, { once: true });
    window.addEventListener("keydown", kick, { once: true });
  }

  // ---------- 공유 (링크 복사 + QR) ----------
  {
    const shareEl = document.getElementById("share");
    const shareBtn = document.getElementById("town-share");
    if (shareEl && shareBtn) {
      const url = `${location.origin}/town`;
      const urlEl = document.getElementById("share-url");
      const qrImg = document.getElementById("share-qr");
      const nativeBtn = document.getElementById("share-native");
      shareBtn.addEventListener("click", () => {
        urlEl.textContent = url;
        if (window.qrcode && !qrImg.src) {
          try {
            const qr = window.qrcode(0, "M");
            qr.addData(url);
            qr.make();
            qrImg.src = qr.createDataURL(6, 10);
          } catch (e) {}
        }
        if (!navigator.share) nativeBtn.hidden = true;
        shareEl.hidden = false;
        if (window.SeumTownConfig && window.SeumTownConfig.logEvent) window.SeumTownConfig.logEvent("share", "");
      });
      document.getElementById("share-close").addEventListener("click", () => { shareEl.hidden = true; });
      shareEl.addEventListener("click", (e) => { if (e.target === shareEl) shareEl.hidden = true; });
      document.getElementById("share-copy").addEventListener("click", (e) => {
        try { navigator.clipboard.writeText(url); e.target.textContent = "✓ 복사됨"; setTimeout(() => (e.target.textContent = "🔗 링크 복사"), 1600); } catch (err) {}
      });
      if (nativeBtn) nativeBtn.addEventListener("click", () => {
        if (navigator.share) navigator.share({ title: "메타하우스 3D 타운", text: "3D 마을에서 이동식 주택 모델을 직접 걸어보며 구경해보세요!", url }).catch(() => {});
      });
    }
  }

  // ---------- 부지 (전시장 대지: 사각 경계) ----------
  // 부지·통로·존 구획은 관리자 격자(존 데이터)와 같은 좌표 체계에서 생성된다.
  const SITE = { x: 70, zN: -82, zS: 34 }; // 대지 사각형 경계
  const MAP_EXT = 92; // 미니맵 표시 범위 (주차장 포함)
  // 부지 바깥 완충 녹지 (짙은 톤 — 대지와 확실히 구분)
  const outerGround = new THREE.Mesh(
    new THREE.PlaneGeometry(520, 520),
    new THREE.MeshStandardMaterial({ color: 0x6e8f58, roughness: 1 })
  );
  outerGround.rotation.x = -Math.PI / 2;
  outerGround.position.y = -0.02;
  outerGround.receiveShadow = true;
  scene.add(outerGround);
  // 대지 잔디 (정돈된 밝은 톤, PBR 잔디 텍스처 + 노멀)
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(SITE.x * 2, SITE.zS - SITE.zN),
    new THREE.MeshStandardMaterial({
      color: 0xb2d795,
      roughness: 1,
      map: pbrTex("assets/hdri/grass_diff_1k.jpg", true, 28, 23),
      normalMap: pbrTex("assets/tex/grass_n.jpg", false, 28, 23),
    })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, (SITE.zN + SITE.zS) / 2);
  ground.receiveShadow = true;
  scene.add(ground);
  // 잔디 매크로 얼룩 오버레이 — 큰 스케일의 명암 변화로 텍스처 타일 반복이 눈에 안 띄게
  {
    const c = document.createElement("canvas");
    c.width = c.height = 512;
    const x = c.getContext("2d");
    for (let i = 0; i < 70; i++) {
      const px = Math.random() * 512, py = Math.random() * 512;
      const r = 34 + Math.random() * 78;
      const dark = Math.random() < 0.55;
      const g = x.createRadialGradient(px, py, 2, px, py, r);
      g.addColorStop(0, dark ? "rgba(38,66,32,0.13)" : "rgba(214,236,168,0.11)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      x.fillStyle = g;
      x.fillRect(px - r, py - r, r * 2, r * 2);
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(3, 3);
    const macro = new THREE.Mesh(
      new THREE.PlaneGeometry(SITE.x * 2, SITE.zS - SITE.zN),
      new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false })
    );
    macro.rotation.x = -Math.PI / 2;
    macro.position.set(0, 0.006, (SITE.zN + SITE.zS) / 2);
    scene.add(macro);
  }

  // ---------- 통로 (곧은 격자 포장, PBR 포장석 텍스처) ----------
  // 조각마다 크기가 달라 타일링이 일정하도록 스트립별 텍스처 반복값을 계산한다
  // asphalt=true면 차량 도로 느낌의 아스팔트 재질 (메인 대로·주차장), 아니면 보행 포장석
  // y: 겹치는 바닥끼리 z-파이팅하지 않게 층별 높이를 분리 (메인 0.02 < 세로 0.028 < 동서 0.036)
  function roadStrip(w, d, x, z, asphalt, y) {
    const cTex = asphalt ? "assets/tex/asphalt_c.jpg" : "assets/tex/paving_c.jpg";
    const nTex = asphalt ? "assets/tex/asphalt_n.jpg" : "assets/tex/paving_n.jpg";
    const rep = asphalt ? 5.2 : 2.6;
    const p = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      new THREE.MeshStandardMaterial({
        color: asphalt ? 0xaaaaaa : 0xe3dbc8,
        roughness: asphalt ? 0.98 : 0.95,
        map: pbrTex(cTex, true, Math.max(1, w / rep), Math.max(1, d / rep)),
        normalMap: pbrTex(nTex, false, Math.max(1, w / rep), Math.max(1, d / rep)),
      })
    );
    p.rotation.x = -Math.PI / 2;
    p.position.set(x, y == null ? 0.02 : y, z);
    p.receiveShadow = true;
    scene.add(p);
  }
  // 입구 광장 (부지 정면 중앙 — 여기서 메인 축이 북쪽으로 뻗는다)
  const plaza = new THREE.Mesh(
    new THREE.CircleGeometry(7, 40),
    new THREE.MeshStandardMaterial({
      color: 0xe8dfca,
      roughness: 0.95,
      map: pbrTex("assets/tex/paving_c.jpg", true, 5.4, 5.4),
      normalMap: pbrTex("assets/tex/paving_n.jpg", false, 5.4, 5.4),
    })
  );
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.set(0, 0.024, 26);
  plaza.receiveShadow = true;
  scene.add(plaza);
  // 메인 대로 (남북 축, 정문→부지 끝) — 아스팔트 (전시장 관람차·서비스 차량 도로 컨셉)
  roadStrip(7, SITE.zS - SITE.zN + 10, 0, (SITE.zN + SITE.zS) / 2 + 5, true);
  // 집 줄 사이 통로 (동서, 각 줄 정면) — 보행 포장석 (메인 도로 위를 지나므로 한 층 위)
  const AISLES = [19.5, 8.5, -2.5, -13.5, -24.5, -35.5, -46.5, -57.5, -68.5];
  AISLES.forEach((z) => roadStrip(136, 2.4, 0, z, false, 0.036));
  // 안쪽 블록 ↔ 파트너 블록 사이 세로 통로 (동서 통로 아래·메인 위)
  roadStrip(2.4, 92, 36.5, -25, false, 0.028);
  roadStrip(2.4, 92, -36.5, -25, false, 0.028);
  // ---------- 메인 대로 차선·연석 (통로 교차부·광장은 비움) ----------
  {
    const CROSS = AISLES.map((a) => [a - 1.9, a + 1.9]).concat([[18.5, 33.5]]); // 광장 구간 포함
    const isClear = (z0, z1) => !CROSS.some(([s, e]) => z1 > s && z0 < e);
    // 가장자리 실선 + 연석: 교차부를 피해 구간별로
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xeeeadf });
    const curbMat = new THREE.MeshStandardMaterial({ color: 0xcfcabb, roughness: 0.85 });
    const curbGeo = new THREE.BoxGeometry(1, 1, 1);
    const edgeItems = [], curbItems = [];
    let segStart = SITE.zN + 1;
    const bounds = CROSS.slice().sort((a, b) => a[0] - b[0]);
    const pushSeg = (s, e) => {
      const len = e - s;
      if (len < 1.4) return;
      const mid = (s + e) / 2;
      [-3.35, 3.35].forEach((x) => edgeItems.push({ x, z: mid, len }));
      [-3.72, 3.72].forEach((x) => curbItems.push({ x, z: mid, len }));
    };
    bounds.forEach(([s, e]) => { pushSeg(segStart, s); segStart = Math.max(segStart, e); });
    pushSeg(segStart, SITE.zS + 7);
    edgeItems.forEach((it) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.13, it.len), lineMat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(it.x, 0.032, it.z);
      scene.add(m);
    });
    curbItems.forEach((it) => {
      const m = new THREE.Mesh(curbGeo, curbMat);
      m.scale.set(0.3, 0.13, it.len);
      m.position.set(it.x, 0.065, it.z);
      m.receiveShadow = true;
      scene.add(m);
    });
    // 중앙 점선
    const dashItems = [];
    for (let z = SITE.zS + 5; z > SITE.zN + 2; z -= 4.6) {
      if (!isClear(z - 1.1, z + 1.1)) continue;
      dashItems.push(z);
    }
    dashItems.forEach((z) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 2.2), lineMat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(0, 0.032, z);
      scene.add(m);
    });
  }

  // ---------- 울타리 + 정문 (부지 경계 마감) ----------
  // 반복 장식(포스트·나무·생울타리 등)은 InstancedMesh로 묶어 드로우콜을 최소화한다
  const IM_TMP = { m: new THREE.Matrix4(), p: new THREE.Vector3(), q: new THREE.Quaternion(), s: new THREE.Vector3(1, 1, 1), up: new THREE.Vector3(0, 1, 0) };
  function buildInstanced(geo, mat, items) {
    // items: [{x,y,z, sx,sy,sz, ry, color}]
    const im = new THREE.InstancedMesh(geo, mat, items.length);
    items.forEach((it, i) => {
      IM_TMP.q.setFromAxisAngle(IM_TMP.up, it.ry || 0);
      IM_TMP.m.compose(
        IM_TMP.p.set(it.x, it.y, it.z),
        IM_TMP.q,
        IM_TMP.s.set(it.sx || 1, it.sy || 1, it.sz || 1)
      );
      im.setMatrixAt(i, IM_TMP.m);
      if (it.color) im.setColorAt(i, it.color);
    });
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    scene.add(im);
    return im;
  }
  const fenceMat = new THREE.MeshStandardMaterial({ color: 0xe8e2d2, roughness: 0.7 });
  const fencePosts = [];
  function fenceRun(x1, z1, x2, z2) {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const ang = Math.atan2(x2 - x1, z2 - z1);
    const n = Math.max(1, Math.round(len / 9));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      fencePosts.push({ x: x1 + (x2 - x1) * t, y: 0.75, z: z1 + (z2 - z1) * t });
    }
    [0.62, 1.28].forEach((y) => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, len), fenceMat);
      rail.position.set((x1 + x2) / 2, y, (z1 + z2) / 2);
      rail.rotation.y = ang;
      scene.add(rail);
    });
  }
  fenceRun(-SITE.x, SITE.zN, SITE.x, SITE.zN); // 북
  fenceRun(-SITE.x, SITE.zN, -SITE.x, SITE.zS); // 서
  fenceRun(SITE.x, SITE.zN, SITE.x, SITE.zS); // 동
  fenceRun(-SITE.x, SITE.zS, -9, SITE.zS); // 남서 (정문 왼쪽)
  fenceRun(9, SITE.zS, SITE.x, SITE.zS); // 남동 (정문 오른쪽)
  buildInstanced(new THREE.BoxGeometry(0.32, 1.5, 0.32), fenceMat, fencePosts); // 포스트 전체 1드로우
  // 정문 아치
  const archMat = new THREE.MeshStandardMaterial({ color: 0x2f5d46, roughness: 0.5 });
  [-9, 9].forEach((dx) => {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.9, 6, 0.9), archMat);
    p.position.set(dx, 3, SITE.zS + 0.5);
    p.castShadow = true;
    scene.add(p);
  });
  const archBeam = new THREE.Mesh(new THREE.BoxGeometry(18.9, 0.9, 0.9), archMat);
  archBeam.position.set(0, 6.2, SITE.zS + 0.5);
  archBeam.castShadow = true;
  scene.add(archBeam);
  // 정문 간판: 가장 크고 격 있는 보드 (짙은 초록 바탕 + 크림 글씨)
  const archBoard = makeBoardMesh("메타하우스 전시장", 10.5, 2.1, { bg: "#2f4a3a", fg: "#f2ede0" });
  archBoard.position.set(0, 7.35, SITE.zS + 0.55);
  scene.add(archBoard);

  // 접지 그림자(가짜 AO) 텍스처 — 차·나무·패드·부스 밑을 살짝 어둡게 해 "붕 뜬 느낌" 제거
  const aoTex = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const x = c.getContext("2d");
    const g = x.createRadialGradient(64, 64, 6, 64, 64, 62);
    g.addColorStop(0, "rgba(12,18,12,0.34)");
    g.addColorStop(0.65, "rgba(12,18,12,0.14)");
    g.addColorStop(1, "rgba(12,18,12,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  })();
  const aoMat = new THREE.MeshBasicMaterial({ map: aoTex, transparent: true, depthWrite: false });
  const aoGeo = new THREE.PlaneGeometry(1, 1);
  aoGeo.rotateX(-Math.PI / 2); // buildInstanced가 ry만 지원하므로 지오메트리 자체를 눕힘
  function makeAoDisc(size) {
    const m = new THREE.Mesh(aoGeo, aoMat);
    m.scale.set(size, 1, size);
    m.position.y = 0.013;
    m.renderOrder = 0;
    return m;
  }

  // ---------- 주차장 (정문 동측 바깥) — 아스팔트 + 실주차 차량 ----------
  const parking = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 13),
    new THREE.MeshStandardMaterial({
      color: 0xa5a5a5,
      roughness: 0.98,
      map: pbrTex("assets/tex/asphalt_c.jpg", true, 6, 2.6),
      normalMap: pbrTex("assets/tex/asphalt_n.jpg", false, 6, 2.6),
    })
  );
  parking.rotation.x = -Math.PI / 2;
  parking.position.set(30, 0.012, SITE.zS + 8.5);
  parking.receiveShadow = true;
  scene.add(parking);
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xf2efe6 });
  for (let x = 18; x <= 42; x += 3.4) {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 5.4), lineMat);
    line.rotation.x = -Math.PI / 2;
    line.position.set(x, 0.016, SITE.zS + 5.6);
    scene.add(line);
  }
  const parkSign = nameSign("🅿️ 주차장");
  parkSign.position.set(30, 3, SITE.zS + 2.4);
  scene.add(parkSign);
  // 주차 차량 (메탈릭 페인트 — HDRI 환경 반사로 실차 느낌, 각 ~7메시)
  function makeCar(paint) {
    const g = new THREE.Group();
    const paintMat = new THREE.MeshStandardMaterial({ color: paint, metalness: 0.85, roughness: 0.28, envMapIntensity: 1.1 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x0d1218, metalness: 0.9, roughness: 0.08 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.85 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.52, 4.15), paintMat);
    body.position.y = 0.62;
    body.castShadow = true;
    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.16, 3.9), paintMat);
    hood.position.y = 0.94;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.5, 2.1), glassMat);
    cabin.position.set(0, 1.22, -0.25);
    cabin.castShadow = true;
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.08, 2.14), paintMat);
    roof.position.set(0, 1.5, -0.25);
    const bumperF = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.3, 0.3), darkMat);
    bumperF.position.set(0, 0.42, 2.05);
    const bumperB = bumperF.clone();
    bumperB.position.z = -2.05;
    const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.26, 14);
    wheelGeo.rotateZ(Math.PI / 2);
    const hubGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.27, 10);
    hubGeo.rotateZ(Math.PI / 2);
    const hubMat = new THREE.MeshStandardMaterial({ color: 0xb9bcc2, metalness: 0.9, roughness: 0.3 });
    [[-0.82, 1.35], [0.82, 1.35], [-0.82, -1.35], [0.82, -1.35]].forEach(([wx, wz]) => {
      const w = new THREE.Mesh(wheelGeo, darkMat);
      w.position.set(wx, 0.34, wz);
      g.add(w);
      const h = new THREE.Mesh(hubGeo, hubMat);
      h.position.set(wx, 0.34, wz);
      g.add(h);
    });
    g.add(makeAoDisc(5.2), body, hood, cabin, roof, bumperF, bumperB);
    return g;
  }
  [0xb9bdc4, 0x27435f, 0x2b2d33, 0x7a2530, 0xe4e6e9].forEach((paint, i) => {
    const car = makeCar(paint);
    car.position.set(19.7 + i * 3.4 + (i % 2) * 0.12, 0, SITE.zS + 5.9 + (i % 2) * 0.25);
    car.rotation.y = (i % 2 ? Math.PI : 0) + (Math.random() - 0.5) * 0.04;
    scene.add(car);
  });

  // ---------- 원경 산 능선 (지평선 실루엣 — 공기원근 연출, 드로우 2) ----------
  // 안개 너머라 fog:false로 두고 대기색을 미리 입힌다. 밤에는 setNight에서 어둡게 틴트.
  const mountainMats = [];
  function ridgeTexture(fill, base, jag) {
    const c = document.createElement("canvas");
    c.width = 2048; c.height = 256;
    const x = c.getContext("2d");
    x.fillStyle = fill;
    x.beginPath();
    x.moveTo(0, 256);
    const pts = [];
    const N = 26;
    for (let i = 0; i <= N; i++) {
      const px = (i / N) * 2048;
      const py = i === 0 || i === N ? base : base + (Math.random() - 0.5) * jag * 2 - Math.random() * jag; // 봉우리는 위로 더
      pts.push([px, Math.max(30, Math.min(230, py))]);
    }
    pts[N][1] = pts[0][1]; // 원통 이음매가 맞물리게 (좌우 끝 동일)
    x.lineTo(pts[0][0], pts[0][1]);
    for (let i = 1; i <= N; i++) {
      const [px, py] = pts[i];
      const [qx, qy] = pts[i - 1];
      x.quadraticCurveTo(qx + (px - qx) * 0.5, Math.min(py, qy) - 14, px, py);
    }
    x.lineTo(2048, 256);
    x.closePath();
    x.fill();
    return new THREE.CanvasTexture(c);
  }
  [
    { r: 430, h: 130, fill: "#c3ced9", base: 150, jag: 46 }, // 먼 능선 (밝고 푸른 대기색)
    { r: 320, h: 96, fill: "#a7b6c0", base: 130, jag: 60 },  // 가까운 능선 (조금 진하게)
  ].forEach((cfg) => {
    const mat = new THREE.MeshBasicMaterial({
      map: ridgeTexture(cfg.fill, cfg.base, cfg.jag),
      transparent: true, side: THREE.BackSide, fog: false, depthWrite: false,
    });
    mountainMats.push(mat);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(cfg.r, cfg.r, cfg.h, 72, 1, true), mat);
    m.position.y = cfg.h / 2 - 6;
    scene.add(m);
  });

  // ---------- 조경 (통로·경계를 따라 규칙 배치 — 인스턴싱으로 드로우 수 고정) ----------
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8a6a4f, roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true }); // 실제 색은 인스턴스 컬러
  const CROWN_COLS = [0x6fae63, 0x568f52, 0x7fb96e, 0x497f4b].map((c) => new THREE.Color(c));
  const treeSpots = [];
  // 동·서 울타리 바깥 가로수
  for (let z = -76; z <= 28; z += 13) {
    treeSpots.push([-SITE.x - 4, z], [SITE.x + 4, z]);
  }
  // 북쪽 울타리 바깥 가로수
  for (let x = -65; x <= 65; x += 13) treeSpots.push([x, SITE.zN - 5]);
  // 정문 좌우 가로수 (주차장 자리는 비움)
  [-16, -29, -42, -55, -68, 52, 65].forEach((x) => treeSpots.push([x, SITE.zS + 4]));
  buildInstanced(
    new THREE.CylinderGeometry(0.16, 0.22, 1, 6), // 단위 높이 → sy로 키 적용
    trunkMat,
    treeSpots.map(([x, z], i) => ({ x, y: (2 + (i % 3) * 0.5) / 2, z, sy: 2 + (i % 3) * 0.5 }))
  );
  // 수관(잎)은 3겹 로브 — 그루마다 색·크기·방향이 달라 훨씬 자연스러운 실루엣 (드로우 3)
  const crownGeo = new THREE.IcosahedronGeometry(1, 1);
  const crownCol = (i, j) => {
    const c = CROWN_COLS[(i + j) % CROWN_COLS.length].clone();
    return c.offsetHSL(0, 0, ((i * 37 + j * 53) % 10 - 5) / 100); // 그루별 미묘한 명도 변화
  };
  buildInstanced(crownGeo, leafMat, treeSpots.map(([x, z], i) => {
    const h = 2 + (i % 3) * 0.5;
    const r = 1.05 + (i % 2) * 0.32;
    return { x, y: h + 0.42, z, sx: r, sy: r * 0.92, sz: r, ry: i * 1.3, color: crownCol(i, 0) };
  }));
  buildInstanced(crownGeo, leafMat, treeSpots.map(([x, z], i) => {
    const h = 2 + (i % 3) * 0.5;
    const r = (1.05 + (i % 2) * 0.32) * 0.62;
    const a = i * 2.1;
    return { x: x + Math.cos(a) * 0.62, y: h + 0.18, z: z + Math.sin(a) * 0.62, sx: r, sy: r, sz: r, ry: i * 0.7, color: crownCol(i, 1) };
  }));
  buildInstanced(crownGeo, leafMat, treeSpots.map(([x, z], i) => {
    const h = 2 + (i % 3) * 0.5;
    const r = (1.05 + (i % 2) * 0.32) * 0.55;
    return { x: x + Math.sin(i) * 0.2, y: h + 1.08, z: z + Math.cos(i) * 0.2, sx: r, sy: r, sz: r, ry: i * 2.4, color: crownCol(i, 2) };
  }));
  // 나무 밑 접지 그림자
  buildInstanced(aoGeo, aoMat, treeSpots.map(([x, z], i) => ({ x, y: 0.012, z, sx: 3.2 + (i % 2) * 0.6, sz: 3.2 + (i % 2) * 0.6 })));
  // 메인 대로 양옆 생울타리 + 꽃 화단 (통로 교차부는 비움)
  const hedgeMat = new THREE.MeshStandardMaterial({ color: 0x3f7a44, roughness: 0.9 });
  const flowerMat = new THREE.MeshStandardMaterial({ color: 0xd9799b, roughness: 0.8 });
  const hedgeSpots = [];
  const flowerSpots = [];
  let hedgeIdx = 0;
  for (let z = 16; z >= -72; z -= 7) {
    if (AISLES.some((a) => Math.abs(z - a) < 2.6)) continue;
    [-5.3, 5.3].forEach((x) => {
      hedgeSpots.push({ x, y: 0.25, z });
      if (hedgeIdx % 2 === 0) flowerSpots.push({ x, y: 0.58, z });
      hedgeIdx++;
    });
  }
  buildInstanced(new THREE.BoxGeometry(2.6, 0.5, 0.9), hedgeMat, hedgeSpots);
  buildInstanced(new THREE.BoxGeometry(2, 0.18, 0.5), flowerMat, flowerSpots);

  // ---------- 소품 (살아있는 박람회장: 통로 축·교차점 기준 규칙 배치, 전부 인스턴싱) ----------
  // 배치 규칙: 가로등=메인 대로 일정 간격 / 벤치·쓰레기통=통로 교차점 / 화분=존 게이트 양옆
  // 밀도는 PROP_CFG로 조절 — 추후 관리자 오버라이드(ov.props)로 확장 가능한 구조
  const PROP_CFG = {
    lampEvery: 14,                          // 가로등 간격 (메인 대로)
    benchZ: [19.5, 8.5, -13.5, -35.5],      // 벤치를 놓는 통로 (교차점 근처)
  };
  const npcWalkers = []; // NPC 방문객 (applyQuality에서 저사양 시 수 축소)
  // 가로등 전구 재질 — 밤 모드에서 emissive를 켜 빛나게 (블룸과 연동)
  const lampBulbMat = new THREE.MeshStandardMaterial({ color: 0xf5efdf, roughness: 0.4 });
  {
    // 가로등 기둥·전구 — 낮에도 보이는 거리시설 (조명은 밤 모드에서만 켜짐)
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x3a3f3a, roughness: 0.8 });
    const lampSpots = [];
    for (let z = 18; z >= -66; z -= PROP_CFG.lampEvery) lampSpots.push([-5.2, z], [5.2, z]);
    buildInstanced(
      new THREE.CylinderGeometry(0.07, 0.09, 1, 6),
      poleMat,
      lampSpots.map(([x, z]) => ({ x, y: 1.7, z, sy: 3.4 }))
    );
    buildInstanced(
      new THREE.SphereGeometry(0.16, 8, 8),
      lampBulbMat,
      lampSpots.map(([x, z]) => ({ x, y: 3.55, z }))
    );
    // 벤치(앉는 판+등받이+다리) + 쓰레기통 — 통로 교차점 양옆, 길을 바라보게
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x8a6a4f, roughness: 0.85 });
    const binMat = new THREE.MeshStandardMaterial({ color: 0x2f5d46, roughness: 0.7 });
    const seats = [], backs = [], legs = [], bins = [];
    PROP_CFG.benchZ.forEach((z) => {
      [[-8.4, Math.PI / 2], [8.4, -Math.PI / 2]].forEach(([x, ry]) => {
        seats.push({ x, y: 0.42, z, ry });
        backs.push({ x: x + (x < 0 ? -0.2 : 0.2), y: 0.72, z, ry });
        legs.push({ x, y: 0.2, z: z - 0.55, ry }, { x, y: 0.2, z: z + 0.55, ry });
        bins.push({ x, y: 0.35, z: z + 1.6 });
      });
    });
    // 광장 벤치 3개 (인포 데스크를 바라보게)
    [[-4.5, 30.5, 0], [4.5, 30.5, 0], [6, 23, -Math.PI / 2]].forEach(([x, z, ry]) => {
      seats.push({ x, y: 0.42, z, ry });
      backs.push({ x, y: 0.72, z: z + (ry === 0 ? 0.2 : 0), ry });
      legs.push({ x: x - 0.55, y: 0.2, z, ry }, { x: x + 0.55, y: 0.2, z, ry });
    });
    buildInstanced(new THREE.BoxGeometry(1.5, 0.09, 0.48), woodMat, seats);
    buildInstanced(new THREE.BoxGeometry(1.5, 0.5, 0.09), woodMat, backs);
    buildInstanced(new THREE.BoxGeometry(0.4, 0.4, 0.08), poleMat, legs);
    buildInstanced(new THREE.CylinderGeometry(0.22, 0.18, 0.7, 8), binMat, bins);
    // 정문 진입로 깃발 (존 색 배너 — 박람회 느낌)
    const flagPoleMat = new THREE.MeshStandardMaterial({ color: 0xd8d4c8, roughness: 0.5 });
    const flagCols = [0x69b25e, 0xb2a15e, 0x5e9db2, 0x9a7fc0];
    [-11, 11].forEach((x, side) => {
      [37.5, 42.5].forEach((z, i) => {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 4.6, 6), flagPoleMat);
        pole.position.set(x, 2.3, z);
        scene.add(pole);
        const flag = new THREE.Mesh(
          new THREE.PlaneGeometry(1.15, 0.72),
          new THREE.MeshStandardMaterial({ color: flagCols[side * 2 + i], roughness: 0.7, side: THREE.DoubleSide })
        );
        flag.position.set(x + (x < 0 ? 0.62 : -0.62), 4.05, z);
        flag.rotation.y = x < 0 ? 0 : Math.PI;
        scene.add(flag);
      });
    });
  }

  // ---------- NPC 방문객 (통로·광장을 오가는 사람들 — 마을이 붐비는 느낌) ----------
  // 통로 축을 따라 왕복 (집 부지 안으로는 들어가지 않음)
  const NPC_WALKS = [
    { char: "woman", path: [[-26, 19.5], [26, 19.5]], speed: 1.1 },
    { char: "man", path: [[26, 8.5], [-26, 8.5]], speed: 1.25 },
    { char: "boy", path: [[1.8, 22], [1.8, -30]], speed: 1.6 },
    { char: "girl", path: [[-21, -13.5], [21, -13.5]], speed: 1.0 },
    { char: "grandpa", path: [[13, 25.5], [30, 25.5]], speed: 0.75 },
  ];
  function spawnWalkers() {
    NPC_WALKS.forEach((cfg, i) => {
      buildCharInstance(cfg.char)
        .then((rig) => {
          const g = new THREE.Group();
          g.add(rig.obj);
          g.position.set(cfg.path[0][0], 0, cfg.path[0][1]);
          addBlob(g, 0.5);
          scene.add(g);
          if (rig.walk) rig.walk.paused = false; // 항상 걷기 모션
          npcWalkers.push({ g, rig, cfg, wp: 1 });
        })
        .catch(() => {});
    });
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

  // 부지(lot) 기준 정규화: 가로·세로가 부지 크기를 절대 넘지 않게 → 격자에서 겹침 방지
  function normalizeFootprint(obj, maxXZ, maxH) {
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    const s = Math.min(maxXZ / Math.max(size.x, size.z, 0.01), maxH / Math.max(size.y, 0.01));
    obj.scale.setScalar(s);
    const box2 = new THREE.Box3().setFromObject(obj);
    obj.position.y -= box2.min.y;
    const c = box2.getCenter(new THREE.Vector3());
    obj.position.x -= c.x; obj.position.z -= c.z;
    return box2.getSize(new THREE.Vector3()).y; // 실제 높이 반환
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
  const cardChat = document.getElementById("town-card-chat");
  // ---------- 내부 사진 뷰어 (카탈로그 interior_images 슬라이드) ----------
  const photosBtn = document.getElementById("town-card-photos");
  const pvEl = document.getElementById("pv");
  const pvImg = document.getElementById("pv-img");
  const pvTitle = document.getElementById("pv-title");
  const pvCount = document.getElementById("pv-count");
  let pvPics = [];
  let pvIdx = 0;
  function modelPics(m) {
    const pics = [].concat(m.interior_images || [], m.gallery_images || []).filter(Boolean);
    return pics;
  }
  function pvShow(i) {
    if (!pvPics.length) return;
    pvIdx = (i + pvPics.length) % pvPics.length;
    pvImg.src = pvPics[pvIdx];
    pvCount.textContent = `${pvIdx + 1} / ${pvPics.length}`;
  }
  function openPhotos(m) {
    pvPics = modelPics(m);
    if (!pvPics.length) return;
    if (window.SeumTownConfig && window.SeumTownConfig.logEvent) window.SeumTownConfig.logEvent("photos", m.name);
    pvTitle.textContent = `${m.name} 내부·상세`;
    pvEl.hidden = false;
    pvShow(0);
  }
  if (pvEl) {
    document.getElementById("pv-close").addEventListener("click", () => { pvEl.hidden = true; });
    document.getElementById("pv-prev").addEventListener("click", () => pvShow(pvIdx - 1));
    document.getElementById("pv-next").addEventListener("click", () => pvShow(pvIdx + 1));
    pvEl.addEventListener("click", (e) => { if (e.target === pvEl) pvEl.hidden = true; });
    window.addEventListener("keydown", (e) => {
      if (pvEl.hidden) return;
      if (e.key === "Escape") pvEl.hidden = true;
      if (e.key === "ArrowLeft") pvShow(pvIdx - 1);
      if (e.key === "ArrowRight") pvShow(pvIdx + 1);
    });
  }
  if (photosBtn) {
    photosBtn.addEventListener("click", () => { if (activeLot) openPhotos(activeLot.model); });
  }
  // ---------- 카드 행동 버튼: 방문예약 · 전화 상담 · 빌드룸 시작 ----------
  const CONTACT_PHONE = (window.SeumTownConfig && window.SeumTownConfig.CONTACT_PHONE) || "";
  const cardCall = document.getElementById("town-card-call");
  const cardReserve = document.getElementById("town-card-reserve");
  const cardBuild = document.getElementById("town-card-build");
  // 모델 평수 추출 (예: "18평", "1층 14.5평 2층 3평" → 합산)
  function modelPyeong(m) {
    let sum = 0;
    String(m.size || "").replace(/([\d.]+)\s*평/g, (_, n) => { sum += parseFloat(n); return _; });
    return sum || 10;
  }
  if (cardReserve) {
    cardReserve.addEventListener("click", () => {
      if (!activeLot) return;
      const m = activeLot.model;
      // 보고 있던 집을 관심 모델로 담아 기존 방문예약 폼으로 (script.js가 자동 프리필)
      try { localStorage.setItem("seum_interest_model", m.name); } catch (e) {}
      if (window.SeumTownConfig && window.SeumTownConfig.logEvent) window.SeumTownConfig.logEvent("reserve_click", m.name);
      window.location.href = "index.html#contact";
    });
  }
  if (cardBuild) {
    cardBuild.addEventListener("click", () => {
      if (!activeLot) return;
      const m = activeLot.model;
      if (window.SeumTownConfig && window.SeumTownConfig.logEvent) window.SeumTownConfig.logEvent("build_from_model", m.name);
      try { sessionStorage.setItem("seum_town_return", JSON.stringify({ x: player.position.x, z: player.position.z })); } catch (e) {}
      window.location.href = `build.html?pyeong=${modelPyeong(m)}&model=${encodeURIComponent(m.name)}`;
    });
  }
  // 체험 포털 입장 버튼: 나가기 전 현재 위치 저장 (돌아오면 체험존 자리로 복귀)
  {
    const cta = document.getElementById("town-build-cta");
    if (cta) cta.addEventListener("click", () => {
      try { sessionStorage.setItem("seum_town_return", JSON.stringify({ x: player.position.x, z: player.position.z })); } catch (e) {}
    });
  }
  if (cardChat) {
    cardChat.addEventListener("click", () => {
      if (activeLot && window.__metaChat && window.__metaChat.openCurator) {
        window.__metaChat.openCurator(activeLot.model);
      }
    });
  }

  function fmtPrice(m) {
    const won = m.event_on && m.event_price ? m.event_price : m.base_price;
    if (!won) return "가격 상담";
    const uk = Math.floor(won / 1e8);
    const man = Math.round((won % 1e8) / 1e4);
    return `${uk ? uk + "억 " : ""}${man ? man.toLocaleString() + "만" : ""}원~`;
  }

  function nameSign(text, textColor) {
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
    ctx.fillStyle = textColor || "#fff";
    ctx.font = "700 52px 'Inter','Noto Sans KR',sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 256, 68, 460);
    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy(); // 초기 부지 간판에서도 호출되므로 maxAniso 선언 순서에 안 묶는다
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    sp.scale.set(4.2, 1.05, 1);
    return sp;
  }

  // ---------- 물리 간판 (알약 스프라이트 대신 3D 세계에 녹아드는 보드) ----------
  // 위계: 정문(크고 진중) > 존 게이트(중간) > 집 앞 사인보드(작음)
  function boardTexture(text, o) {
    const c = document.createElement("canvas");
    c.width = 512; c.height = Math.round(512 * (o.h / o.w));
    const x = c.getContext("2d");
    const bg = o.bg || "#f4efe3";
    const fg = o.fg || "#3a382f";
    x.fillStyle = bg;
    x.beginPath();
    x.roundRect(4, 4, c.width - 8, c.height - 8, 14);
    x.fill();
    x.strokeStyle = "rgba(60,56,45,0.35)";
    x.lineWidth = 5;
    x.stroke();
    if (o.accent) {
      x.fillStyle = o.accent;
      x.beginPath();
      x.roundRect(16, c.height - 20, c.width - 32, 9, 4);
      x.fill();
    }
    x.fillStyle = fg;
    x.font = `700 ${Math.round(c.height * (o.accent ? 0.42 : 0.46))}px 'Inter','Noto Sans KR',sans-serif`;
    x.textAlign = "center";
    x.textBaseline = "middle";
    x.fillText(text, c.width / 2, c.height / 2 - (o.accent ? 4 : 0), c.width - 40);
    const t = new THREE.CanvasTexture(c);
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  function hex(n) { return `#${n.toString(16).padStart(6, "0")}`; }
  // 밤 모드에서 간판을 은은히 발광시키기 위한 재질 목록 (makeBoardMesh가 상단 코드에서도 호출되므로 var로 호이스팅)
  var BOARD_MATS;
  function makeBoardMesh(text, w, h, o) {
    o = o || {};
    const mat = new THREE.MeshStandardMaterial({ map: boardTexture(text, { w, h, bg: o.bg, fg: o.fg, accent: o.accent != null ? hex(o.accent) : null }), roughness: 0.85, side: THREE.DoubleSide });
    (BOARD_MATS = BOARD_MATS || []).push(mat);
    return new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  }
  const tagPostMat = new THREE.MeshStandardMaterial({ color: 0x8a6a4f, roughness: 0.85 });
  function makeHouseTag(name) {
    const g = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 1.05, 6), tagPostMat);
    post.position.y = 0.52;
    const board = makeBoardMesh(name, 1.9, 0.55, {});
    board.position.y = 1.28;
    g.add(post, board);
    return g;
  }

  // ---------- 전시장 존 (용도별 사각 블록, 2×2) ----------
  // 카탈로그 category 기준 자동 배치. 격자(행×열) 정렬로 겹침 없이,
  // 새 모델은 해당 존의 다음 빈 격자 칸에 자동으로 들어간다.
  // 부지 피치 11 (부지 8 + 여유 3). 모든 집은 남쪽(+z, 통로)을 향한다.
  const PITCH = 11;     // 줄(남북) 피치: 부지 패드 8.6 + 통로 2.4
  const XP = 10;        // 열(동서) 피치: 패드 8.6 + 여백 1.4 (박람회식 압축 간격)
  const LOT_MAX = 8;    // 부지 위 집의 최대 가로/세로
  // 존 accent는 저채도 팔레트만 사용 (형광 원색 금지) — 표지판·테두리·게이트에만 쓰인다
  const ZONES = {
    // 북서 블록 (모델 수가 많아 북쪽으로 확장 가능)
    "전원주택": { label: "전원주택 존", emoji: "🏡", color: 0x7d9471, cols: [-31, -21, -11], rowStart: -19, entry: { x: -21, z: -11 } },
    // 북동 블록
    "체류형 쉼터": { label: "체류형 쉼터 존", emoji: "🌿", color: 0xb3a284, cols: [11, 21, 31], rowStart: -19, entry: { x: 21, z: -11 } },
    // 남서 블록
    "세컨하우스": { label: "세컨하우스 존", emoji: "🏠", color: 0x87a0ad, cols: [-31, -21, -11], rowStart: 14, entry: { x: -21, z: 22 } },
    // 남동 블록
    "특별모델": { label: "특별모델 존", emoji: "⛳", color: 0x9a8fa6, cols: [11, 21, 31], rowStart: 14, entry: { x: 21, z: 22 } },
    // ---- 파트너 존 (바깥 블록: 입점 업체·이벤트 전시) ----
    "LG가전 이벤트": { label: "LG가전 이벤트 존", emoji: "📺", color: 0x9c5a63, cols: [42, 52, 62], rowStart: -19, rows: 2, partner: true, entry: { x: 52, z: -11 } },
    "가구": { label: "가구 존", emoji: "🛋️", color: 0xb08a66, cols: [42, 52, 62], rowStart: 14, rows: 2, partner: true, entry: { x: 52, z: 22 } },
    "건축 자재": { label: "건축 자재 존", emoji: "🧱", color: 0x8b959c, cols: [-62, -52, -42], rowStart: -19, rows: 2, partner: true, entry: { x: -52, z: -11 } },
  };
  function zoneFor(cat) {
    return ZONES[cat] ? cat : "특별모델";
  }
  // 존 표시 이름 (관리자 존 관리에서 바꾼 이름 — "…존" 접미사 제거한 짧은 형태)
  function zoneDisplay(cat) {
    const z = ZONES[zoneFor(cat)];
    return z ? z.label.replace(/\s*존$/, "") : (cat || "메타하우스 모델");
  }
  // 존 격자 i번째 칸 (열 우선, 다음 줄은 북쪽으로)
  function zoneSlot(zone, i) {
    const col = zone.cols[i % zone.cols.length];
    const row = zone.rowStart - Math.floor(i / zone.cols.length) * PITCH;
    return { x: col, z: row };
  }

  // 관리자 존 설정(overrides.zones/booths) 반영: 존 이름·색상·부스명 커스텀
  function applyZoneOverrides(ov) {
    const zo = (ov && ov.zones) || {};
    Object.entries(zo).forEach(([k, o]) => {
      const z = ZONES[k];
      if (!z || !o) return;
      if (o.label) z.label = String(o.label).slice(0, 20);
      if (o.color && /^#?[0-9a-fA-F]{6}$/.test(o.color)) z.color = parseInt(String(o.color).replace("#", ""), 16);
    });
    const bo = (ov && ov.booths) || {};
    Object.entries(bo).forEach(([k, arr]) => {
      if (PARTNER_BOOTHS[k] && Array.isArray(arr)) {
        arr.forEach((v, i) => { if (v && i < 3) PARTNER_BOOTHS[k][i] = String(v).slice(0, 20); });
      }
    });
  }

  // 존 바닥 포장 슬래브 + 존 색 테두리 + 입구 게이트(기둥·간판) — 존 구분이 한눈에 보이게
  // 블록 내부는 잔디가 아니라 존 색이 섞인 포장으로 마감 (박람회 부스 단지 느낌)
  // 관리자 설정(존 색·이름)을 먼저 반영해야 하므로 설정 로드 후 buildZoneDecor()로 호출된다.
  function buildZoneDecor() {
  const gatePillars = [], gateBeams = [], cornerPosts = []; // 인스턴스 수집용
  Object.values(ZONES).forEach((z) => {
    const minX = Math.min(...z.cols) - XP / 2;
    const maxX = Math.max(...z.cols) + XP / 2;
    const rows = z.rows || (z.rowStart < 0 ? 6 : 3); // 북쪽 블록은 깊게 (모델 수가 많음)
    z.rowsDeep = rows;
    const front = z.rowStart + PITCH / 2;
    const back = z.rowStart - (rows - 0.5) * PITCH;
    const cx = (minX + maxX) / 2;
    // 존 내부는 잔디 그대로 — 바닥을 색으로 칠하지 않고, 얇은 경계 라인 + 게이트 간판으로만 구분
    const frameMat = new THREE.MeshBasicMaterial({ color: z.color, transparent: true, opacity: 0.5, depthWrite: false });
    const strip = (w, d, x, zz) => {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(w, d), frameMat);
      s.rotation.x = -Math.PI / 2;
      s.position.set(x, 0.014, zz);
      scene.add(s);
    };
    strip(maxX - minX, 0.3, cx, front);
    strip(maxX - minX, 0.3, cx, back);
    strip(0.3, front - back, minX, (front + back) / 2);
    strip(0.3, front - back, maxX, (front + back) / 2);
    // 입구 게이트(존 색 기둥 2개 + 상단 보) + 모서리 포스트 — 인스턴스 배열에 수집
    const gc = new THREE.Color(z.color);
    gatePillars.push(
      { x: cx - 4.8, y: 2.2, z: front + 1.4, color: gc },
      { x: cx + 4.8, y: 2.2, z: front + 1.4, color: gc }
    );
    gateBeams.push({ x: cx, y: 4.55, z: front + 1.4, color: gc });
    // 게이트 보 위에 실제 간판(보드) — 모든 존 동일 스타일·높이
    const board = makeBoardMesh(`${z.emoji} ${z.label}`, 6.6, 1.5, { accent: z.color });
    board.position.set(cx, 5.5, front + 1.4);
    scene.add(board);
    [[minX, front], [maxX, front], [minX, back], [maxX, back]].forEach(([px, pz]) => {
      cornerPosts.push({ x: px, y: 0.85, z: pz, color: gc });
    });
  });
  // 게이트·포스트 일괄 생성 (존 색은 인스턴스 컬러, 총 3드로우)
  const gateMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
  buildInstanced(new THREE.BoxGeometry(0.55, 4.4, 0.55), gateMat, gatePillars);
  buildInstanced(new THREE.BoxGeometry(10.2, 0.55, 0.55), gateMat, gateBeams);
  buildInstanced(new THREE.BoxGeometry(0.45, 1.7, 0.45), gateMat, cornerPosts);
  // 존 게이트 양옆 화분 (테라코타 + 관목) — 쉬어가는 지점 연출
  const pots = [], bushes = [];
  Object.values(ZONES).forEach((z) => {
    const cx = (Math.min(...z.cols) + Math.max(...z.cols)) / 2;
    const front = z.rowStart + PITCH / 2;
    [-6.4, 6.4].forEach((dx) => {
      pots.push({ x: cx + dx, y: 0.3, z: front + 1.4 });
      bushes.push({ x: cx + dx, y: 0.85, z: front + 1.4 });
    });
  });
  buildInstanced(new THREE.CylinderGeometry(0.34, 0.26, 0.6, 8), new THREE.MeshStandardMaterial({ color: 0xb9714f, roughness: 0.8 }), pots);
  buildInstanced(new THREE.IcosahedronGeometry(0.42, 0), new THREE.MeshStandardMaterial({ color: 0x4e8f4e, roughness: 0.9 }), bushes);
  buildBooths(zoneOvData);
  buildExperienceZone(zoneOvData);
  scatterGreenery();
  }

  // ---------- 풀 포기·들꽃 스캐터 (걷는 잔디밭에만 — 도로·존 블록·광장 회피) ----------
  // 존 경계(ZONES)가 확정된 뒤에 호출된다. 십자 교차 쿼드 인스턴싱으로 드로우 4회 고정.
  function scatterGreenery() {
    const tuftTex = (() => {
      const c = document.createElement("canvas");
      c.width = 64; c.height = 64;
      const x = c.getContext("2d");
      for (let i = 0; i < 9; i++) {
        const bx = 10 + i * 5 + (Math.random() - 0.5) * 4;
        x.strokeStyle = ["#5d9a52", "#6fae63", "#4c8746"][i % 3];
        x.lineWidth = 2.6;
        x.beginPath();
        x.moveTo(bx, 64);
        x.quadraticCurveTo(bx + (Math.random() - 0.5) * 10, 34, bx + (Math.random() - 0.5) * 16, 10 + Math.random() * 12);
        x.stroke();
      }
      return new THREE.CanvasTexture(c);
    })();
    const petalDotTex = (() => {
      const c = document.createElement("canvas");
      c.width = c.height = 32;
      const x = c.getContext("2d");
      x.fillStyle = "#fff";
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        x.beginPath();
        x.ellipse(16 + Math.cos(a) * 6, 16 + Math.sin(a) * 6, 5, 5, 0, 0, Math.PI * 2);
        x.fill();
      }
      x.fillStyle = "#ffd75e";
      x.beginPath();
      x.arc(16, 16, 4, 0, Math.PI * 2);
      x.fill();
      return new THREE.CanvasTexture(c);
    })();
    const inZone = (x, z) => {
      for (const zn of Object.values(ZONES)) {
        const minX = Math.min(...zn.cols) - XP / 2 - 1;
        const maxX = Math.max(...zn.cols) + XP / 2 + 1;
        const front = zn.rowStart + PITCH / 2 + 1;
        const back = zn.rowStart - ((zn.rowStart < 0 ? 6 : 3) - 0.5) * PITCH - 1;
        if (x >= minX && x <= maxX && z >= back && z <= front) return true;
      }
      return x >= EXP.minX - 1 && x <= EXP.maxX + 1 && z >= EXP.back - 1 && z <= EXP.front + 1;
    };
    const tufts = [], flowers = [];
    let guard = 0;
    while (tufts.length < 240 && guard++ < 4000) {
      const x = -68 + Math.random() * 136;
      const z = -78 + Math.random() * 108;
      if (Math.abs(x) < 5.4) continue;                       // 메인 대로
      if (AISLES.some((a) => Math.abs(z - a) < 2.2)) continue; // 동서 통로
      if (Math.abs(Math.abs(x) - 36.5) < 2.2) continue;      // 남북 보조로
      if (Math.hypot(x, z - 26) < 9.5) continue;             // 입구 광장
      if (inZone(x, z)) continue;                            // 존 블록(부지) 내부
      const s = 0.55 + Math.random() * 0.5;
      const item = { x, y: 0.16 * s, z, sx: s, sy: s, sz: s, ry: Math.random() * Math.PI };
      tufts.push(item);
      if (tufts.length % 6 === 0) {
        flowers.push({
          x: x + 0.3, y: 0.1, z: z + 0.2, sx: 0.34, sy: 0.34, sz: 0.34, ry: Math.random() * Math.PI,
          color: new THREE.Color([0xf3a6c0, 0xf6e08a, 0xffffff, 0xc9a6f3][flowers.length % 4]),
        });
      }
    }
    const tuftGeo = new THREE.PlaneGeometry(0.62, 0.34);
    tuftGeo.translate(0, 0.02, 0);
    const tuftMat = new THREE.MeshStandardMaterial({ map: tuftTex, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 1 });
    buildInstanced(tuftGeo, tuftMat, tufts);
    buildInstanced(tuftGeo, tuftMat, tufts.map((t) => Object.assign({}, t, { ry: t.ry + Math.PI / 2 })));
    const flowerGeo = new THREE.PlaneGeometry(0.5, 0.5);
    flowerGeo.rotateX(-Math.PI / 2);
    const flowerMat2 = new THREE.MeshBasicMaterial({ map: petalDotTex, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide });
    buildInstanced(flowerGeo, flowerMat2, flowers);
  }
  let zoneOvData = {}; // buildZoneDecor 호출 전에 설정됨

  // ---------- 파트너 존 부스 (입점 업체 전시 부스, 앞줄 0~2번 칸 고정) ----------
  const PARTNER_BOOTHS = {
    "LG가전 이벤트": ["📺 LG 가전 체험관", "🎉 이벤트 특가관", "🏠 스마트홈관"],
    "가구": ["🛋️ 리빙 가구관", "🌤️ 아웃도어 가구관", "🤝 입점 문의"],
    "건축 자재": ["🪟 단열·창호관", "🧱 마감재관", "🤝 입점 문의"],
  };
  function buildBooths(ovData) {
    const floorMat = new THREE.MeshStandardMaterial({ color: 0xeae4d6, roughness: 0.9 });
    const counterMat = new THREE.MeshStandardMaterial({ color: 0xf6f3ea, roughness: 0.6 });
    const wallMats = {};
    const wallMatFor = (z) => {
      if (!wallMats[z.color]) wallMats[z.color] = new THREE.MeshStandardMaterial({ color: z.color, roughness: 0.7 });
      return wallMats[z.color];
    };
    function makeBooth(z, i, label) {
      const wallMat = wallMatFor(z);
      const slot = zoneSlot(z, i);
      const b = new THREE.Group();
      const floor = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.24, 8.6), floorMat); // 부지 패드와 같은 크기
      floor.position.y = 0.12;
      floor.receiveShadow = true;
      const backWall = new THREE.Mesh(new THREE.BoxGeometry(5.8, 2.7, 0.3), wallMat);
      backWall.position.set(0, 1.59, -2.75);
      backWall.castShadow = true;
      const sideL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.7, 3.2), wallMat);
      sideL.position.set(-2.75, 1.59, -1.3);
      sideL.castShadow = true;
      const sideR = sideL.clone();
      sideR.position.x = 2.75;
      const counter = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.95, 0.9), counterMat);
      counter.position.set(0, 0.71, 1.5);
      counter.castShadow = true;
      const canopy = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.16, 2.8), wallMat);
      canopy.position.set(0, 3.15, 0.7);
      canopy.rotation.x = -0.14;
      canopy.castShadow = true;
      // 부스 간판: 백월 위 보드 (존 accent 언더라인)
      const sign = makeBoardMesh(label, 4.2, 1.0, { accent: z.color });
      sign.position.set(0, 3.55, -2.55);
      b.add(makeAoDisc(11.5), floor, backWall, sideL, sideR, counter, canopy, sign);
      b.position.set(slot.x, 0, slot.z);
      scene.add(b);
    }
    // 파트너 존 기본 부스 (앞줄 고정)
    Object.entries(PARTNER_BOOTHS).forEach(([zk, labels]) => {
      const z = ZONES[zk];
      if (z) labels.forEach((label, i) => makeBooth(z, i, label));
    });
    // 관리자가 지정한 부스 칸 (모든 존, 입점 모집/계약 업체) — 실제 박람회 부스 분양처럼
    const CFG2 = window.SeumTownConfig;
    const fixed = (CFG2 && CFG2.RESERVED_SLOTS) || {};
    Object.entries((ovData && ovData.boothSlots) || {}).forEach(([key, o]) => {
      const sep = key.lastIndexOf("|");
      const zk = key.slice(0, sep);
      const i = Number(key.slice(sep + 1));
      const z = ZONES[zk];
      if (!z || isNaN(i)) return;
      if ((fixed[zk] || []).includes(i)) return; // 파트너 기본 부스 자리와 중복 방지
      makeBooth(z, i, o && o.company ? `🏢 ${String(o.company).slice(0, 16)}` : "🤝 입점 모집");
    });
  }

  // 인포메이션 데스크 (남쪽 입구 광장)
  const INFO_POS = { x: 0, z: 26 };
  const infoDesk = new THREE.Group();
  {
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(1.15, 1.3, 1.1, 8),
      new THREE.MeshStandardMaterial({ color: 0x2f5d46, roughness: 0.6 })
    );
    base.position.y = 0.55;
    base.castShadow = true;
    const top = new THREE.Mesh(
      new THREE.CylinderGeometry(1.5, 1.5, 0.14, 8),
      new THREE.MeshStandardMaterial({ color: 0xf4f4f0, roughness: 0.5 })
    );
    top.position.y = 1.18;
    top.castShadow = true;
    const infoSign = nameSign("ℹ️ 인포메이션");
    infoSign.scale.set(4.6, 1.15, 1);
    infoSign.position.y = 3;
    infoDesk.add(base, top, infoSign);
    infoDesk.position.set(INFO_POS.x - 2.5, 0, INFO_POS.z);
    scene.add(infoDesk);
  }

  // ---------- 광장 분수 (입구 광장 서측 — 물결·물방울 애니메이션) ----------
  let fountainWater = null;
  const fountainDrops = [];
  {
    const f = new THREE.Group();
    const stone = new THREE.MeshStandardMaterial({ color: 0xd8d3c4, roughness: 0.75 });
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.75, 0.5, 18), stone);
    basin.position.y = 0.25;
    basin.castShadow = true;
    // 물결 텍스처 (동심원 링) — 회전시키면 잔잔히 이는 물결처럼 보인다
    const wc = document.createElement("canvas");
    wc.width = wc.height = 128;
    const wx = wc.getContext("2d");
    wx.fillStyle = "#7fc4d8";
    wx.fillRect(0, 0, 128, 128);
    wx.strokeStyle = "rgba(255,255,255,0.5)";
    for (let r = 10; r < 70; r += 9) {
      wx.lineWidth = 1.6;
      wx.beginPath();
      wx.arc(64, 64, r + Math.random() * 3, Math.random(), Math.random() + 4.5);
      wx.stroke();
    }
    fountainWater = new THREE.Mesh(
      new THREE.CircleGeometry(1.42, 24),
      new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(wc), transparent: true, opacity: 0.9, roughness: 0.25, metalness: 0.1 })
    );
    fountainWater.rotation.x = -Math.PI / 2;
    fountainWater.position.y = 0.46;
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.9, 10), stone);
    column.position.y = 0.9;
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.4, 0.16, 14), stone);
    bowl.position.y = 1.38;
    // 물방울 (은은한 하늘빛 발광 구슬이 상하로 통통)
    const dropMat = new THREE.MeshBasicMaterial({ color: 0xbfe8f5, transparent: true, opacity: 0.85 });
    for (let i = 0; i < 6; i++) {
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), dropMat);
      d.userData.a = (i / 6) * Math.PI * 2;
      fountainDrops.push(d);
      f.add(d);
    }
    f.add(makeAoDisc(4.6), basin, fountainWater, column, bowl);
    f.position.set(-6.5, 0, 29.5);
    scene.add(f);
  }

  // ---------- 떠다니는 꽃잎 파티클 (산들바람 — 저사양에서는 자동 꺼짐) ----------
  let petals = null;
  {
    const pc = document.createElement("canvas");
    pc.width = pc.height = 32;
    const px = pc.getContext("2d");
    px.fillStyle = "rgba(255,214,228,0.95)";
    px.beginPath();
    px.ellipse(16, 16, 9, 6, 0.6, 0, Math.PI * 2);
    px.fill();
    const N = 80;
    const pos = new Float32Array(N * 3);
    const seed = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = -60 + Math.random() * 120;
      pos[i * 3 + 1] = 0.5 + Math.random() * 6;
      pos[i * 3 + 2] = -70 + Math.random() * 102;
      seed[i] = Math.random() * Math.PI * 2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    petals = new THREE.Points(geo, new THREE.PointsMaterial({
      map: new THREE.CanvasTexture(pc), size: 0.26, transparent: true, opacity: 0.85,
      depthWrite: false, sizeAttenuation: true,
    }));
    petals.userData.seed = seed;
    scene.add(petals);
  }

  // ---------- 체험존 (부대시설 구역) ----------
  // 포털을 마을 곳곳에 흩뿌리지 않고 남서쪽 한 블록에 모두 모은다 (가구 존과 대칭 자리).
  // 포털 목록은 데이터(town-config DEFAULT_PORTALS + 관리자 설정 data.portals)로 관리 —
  // 새 체험 공간이 생기면 목록에 추가만 하면 되고, 관리자에서 이름 변경·숨김이 가능하다.
  const EXP = { cols: [-62, -52, -42], minX: -67, maxX: -37, front: 19.5, back: 6.5, cx: -52, color: 0x5e8a74, entry: { x: -52, z: 23 } };
  const expPortals = []; // { group, ring, ring2, disc, orbs, def }

  function makeExpPortal(def, x, z) {
    const g = new THREE.Group();
    const accent = new THREE.Color(def.color || "#2fe08a");
    const dim = def.soon ? 0.35 : 1; // 준비 중 포털은 어둡게
    const ringMat = new THREE.MeshStandardMaterial({
      color: accent.clone().multiplyScalar(0.55), emissive: accent, emissiveIntensity: 1.5 * dim, roughness: 0.35, metalness: 0.3,
    });
    const gold = new THREE.MeshStandardMaterial({ color: 0xd9a54a, emissive: 0xffcf7a, emissiveIntensity: 0.7 * dim, roughness: 0.4, metalness: 0.5 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.09, 14, 48), ringMat);
    ring.position.y = 1.55;
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.05, 12, 40), gold);
    ring2.position.y = 1.55;
    // 은은하게 빛나는 포털면 (블룸에서 살짝 번짐)
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(0.68, 40),
      new THREE.MeshBasicMaterial({ color: accent.clone().lerp(new THREE.Color(0xffffff), 0.55), transparent: true, opacity: 0.35 * dim, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    disc.position.y = 1.55;
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.85, 1.05, 0.22, 24),
      new THREE.MeshStandardMaterial({ color: 0xe3ddcb, roughness: 0.85 })
    );
    base.position.y = 0.11;
    const glowRing = new THREE.Mesh(
      new THREE.RingGeometry(1.0, 1.35, 40),
      new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.35 * dim, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    glowRing.rotation.x = -Math.PI / 2;
    glowRing.position.y = 0.03;
    const orbs = [];
    if (!def.soon) {
      const orbMat = new THREE.MeshBasicMaterial({ color: accent.clone().lerp(new THREE.Color(0xffffff), 0.65) });
      for (let i = 0; i < 7; i++) {
        const orb = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), orbMat);
        orb.userData.a = (i / 7) * Math.PI * 2;
        orbs.push(orb);
        g.add(orb);
      }
    }
    // 포털 이름표는 링 위에 붙여 한 덩어리로 — 준비 중은 명시
    const sign = nameSign(def.soon ? `${def.icon} ${def.label} (준비 중)` : `${def.icon} ${def.label}`);
    sign.scale.set(2.3, 0.58, 1);
    sign.position.y = 2.95;
    g.add(ring, ring2, disc, base, glowRing, sign);
    g.position.set(x, 0, z);
    scene.add(g);
    expPortals.push({ group: g, ring, ring2, disc, orbs, def });
  }

  function buildExperienceZone(ovData) {
    const CFG = window.SeumTownConfig;
    const portals = (CFG && CFG.portalsFor) ? CFG.portalsFor(ovData) : [];
    // 존과 같은 문법의 얇은 경계 라인 (바닥은 잔디 유지)
    const frameMat = new THREE.MeshBasicMaterial({ color: EXP.color, transparent: true, opacity: 0.5, depthWrite: false });
    const strip = (w, d, x, zz) => {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(w, d), frameMat);
      s.rotation.x = -Math.PI / 2;
      s.position.set(x, 0.014, zz);
      scene.add(s);
    };
    strip(EXP.maxX - EXP.minX, 0.3, EXP.cx, EXP.front);
    strip(EXP.maxX - EXP.minX, 0.3, EXP.cx, EXP.back);
    strip(0.3, EXP.front - EXP.back, EXP.minX, (EXP.front + EXP.back) / 2);
    strip(0.3, EXP.front - EXP.back, EXP.maxX, (EXP.front + EXP.back) / 2);
    // 입구 게이트 (존 게이트와 같은 스타일) + "체험존 / EXPERIENCE" 간판
    const gateMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
    const gc = new THREE.Color(EXP.color);
    [-4.8, 4.8].forEach((dx) => {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.55, 4.4, 0.55), gateMat.clone());
      p.material.color = gc;
      p.position.set(EXP.cx + dx, 2.2, EXP.front + 1.4);
      p.castShadow = true;
      scene.add(p);
    });
    const beam = new THREE.Mesh(new THREE.BoxGeometry(10.2, 0.55, 0.55), gateMat.clone());
    beam.material.color = gc;
    beam.position.set(EXP.cx, 4.55, EXP.front + 1.4);
    scene.add(beam);
    const board = makeBoardMesh("🎪 체험존 · EXPERIENCE", 7.4, 1.5, { bg: "#2f4a3a", fg: "#f2ede0", accent: EXP.color });
    board.position.set(EXP.cx, 5.5, EXP.front + 1.4);
    scene.add(board);
    // 포털을 한 줄로 정렬 배치 (간격 10 — 서로 겹치지 않게)
    portals.forEach((def, i) => {
      const x = EXP.cols[i % EXP.cols.length];
      const z = 12.5 - Math.floor(i / EXP.cols.length) * 6; // 4개 이상이면 뒷줄로
      makeExpPortal(def, x, z);
    });
  }

  // 전시존에는 포털을 두지 않는다 — 대신 인포 광장·통로에 방향 안내 표지만
  function makeGuideSign(x, z, ry) {
    const g = new THREE.Group();
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.09, 2.5, 8),
      new THREE.MeshStandardMaterial({ color: 0x6b5b45, roughness: 0.85 })
    );
    post.position.set(0, 1.25, -0.09);
    post.castShadow = true;
    // 체험존은 서쪽(-x) — 남쪽에서 보는 보드 기준 왼쪽 화살표
    // 보드는 기둥 앞(+z)에 붙여 기둥이 글씨를 가리지 않게 (실제 표지판처럼)
    const b = makeBoardMesh("← 🎪 체험존 이쪽", 3.1, 0.75, { accent: EXP.color });
    b.position.set(0, 2.15, 0.06);
    g.add(post, b);
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    scene.add(g);
  }
  makeGuideSign(5.8, 27.4, -0.5);  // 인포 데스크 옆 (서쪽 체험존 방향으로 비스듬히)
  makeGuideSign(-34.2, 21.5, -0.85); // 남쪽 통로 서쪽 끝 — 체험존 입구 직전

  const houseLots = []; // { wrap, model }
  const padMat = new THREE.MeshStandardMaterial({
    color: 0xe4dfd2,
    roughness: 0.92,
    map: pbrTex("assets/tex/concrete_c.jpg", true, 2.4, 2.4),
    normalMap: pbrTex("assets/tex/concrete_n.jpg", false, 2.4, 2.4),
  }); // 부지 패드 (콘크리트 PBR)

  // 3D 아키타입 매핑·중복 제거 규칙은 관리자 지도와 공유 (town-config.js)
  const HOUSE_GLBS = window.SeumTownConfig.HOUSE_GLBS;
  const CAT_POOL = window.SeumTownConfig.CAT_POOL;
  const DEFAULT_GLB = window.SeumTownConfig.DEFAULT_GLB;

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

  function placeModels(models, ovData) {
    // 배치 규칙은 관리자 지도와 공유 (town-config.js computePlacement):
    // 관리자가 고정한 칸(placement)을 우선 반영하고, 나머지는 존 내 빈 칸 자동 채움.
    const CFG = window.SeumTownConfig;
    // 같은 존에 같은 외형이 반복 배치되지 않게 정리 (마을 전시는 외형당 한 채)
    if (CFG && CFG.dedupeForTown) models = CFG.dedupeForTown(models);
    const placement = [];
    if (CFG && CFG.computePlacement) {
      const plan = CFG.computePlacement(models, ovData || {});
      models.forEach((m) => {
        const p = plan[CFG.keyOf(m)];
        const zone = ZONES[p.zone] || ZONES["특별모델"];
        placement.push([m, zoneSlot(zone, p.index), p.rot || 0]);
      });
    } else {
      // 폴백: 용도(category)별 존으로 그룹핑 후 순서대로
      const byZone = {};
      models.forEach((m) => {
        const zc = zoneFor(m.category);
        (byZone[zc] = byZone[zc] || []).push(m);
      });
      Object.entries(byZone).forEach(([zc, list]) => {
        const zone = ZONES[zc];
        list.forEach((m, i) => placement.push([m, zoneSlot(zone, i), 0]));
      });
    }
    const catCounters = {};
    placement.forEach(([m, lot, rot], i) => {
      const c = m.category || "_";
      const idxInCat = catCounters[c] || 0;
      catCounters[c] = idxInCat + 1;
      const url = archetypeFor(m, idxInCat);
      loadGlb(url)
        .catch(() => loadGlb(DEFAULT_GLB))
        .then((seed) => {
          const wrap = new THREE.Group();
          // 부지 패드: 집을 잔디/포장 위에 바로 얹지 않고 전시 부스처럼 콘크리트 판 위에
          const pad = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.22, 8.6), padMat);
          pad.position.y = 0.11;
          pad.receiveShadow = true;
          wrap.add(makeAoDisc(11.5)); // 패드 접지 그림자 — 판이 잔디에 붙어 보이게
          wrap.add(pad);
          const inst = seed.clone(true);
          const foot = 7.2 + ((i * 2654435761) % 100) / 100 * 0.8; // 부지 내 크기 변화 (최대 8)
          const castsShadow = lot.z > -25; // 앞쪽 줄만 그림자 캐스팅 (성능)
          inst.traverse((o) => { if (o.isMesh) { o.castShadow = castsShadow; o.receiveShadow = true; } });
          const h = normalizeFootprint(inst, Math.min(foot, LOT_MAX), 5.2);
          inst.position.y += 0.22 - h * 0.04; // 패드 위에 올리고 스캔 밑판은 살짝 묻기
          wrap.add(inst);
          // 집 이름표: 떠 있는 라벨 대신 앞마당의 작은 사인보드 (통일 스타일)
          const tag = makeHouseTag(m.name);
          tag.position.set(-2.9, 0.22, 4.05);
          wrap.add(tag);
          wrap.position.set(lot.x, 0, lot.z);
          // 기본 0도 = 남쪽 통로 정면. 관리자 배치에서 90도 단위 회전 가능 (90=동, 180=북, 270=서)
          wrap.rotation.y = THREE.MathUtils.degToRad(rot || 0);
          wrap.userData.model = m;
          scene.add(wrap);
          clickTargets.push(wrap);
          houseLots.push({ wrap, model: m, h });
          // 이 집 담당 큐레이터 배치 (성별은 데이터 우선, 없으면 규칙 자동)
          m.__curator = curatorGender(m, idxInCat);
          placeCurator(wrap, m.__curator);
          updateNearCard();
        })
        .catch(() => {});
    });
  }

  // ---------- 집 앞 큐레이터 (정장 상담사, 남/녀) ----------
  // 겉모습만 사람 캐릭터로 교체 — 안내 로직(카탈로그 데이터 큐레이터)은 chat.js 그대로.
  // 성별 배정: 모델에 curator 필드('m'|'f')가 있으면 수동 지정값 사용,
  // 없으면 존 내 순서대로 남/녀 교차 자동 배정. 새 모델도 같은 규칙 적용.
  const CURATORS = {
    m: { glb: "assets/chars/suitman.glb", height: 1.78 },
    f: { glb: "assets/chars/suitwoman.glb", height: 1.7 },
    bot: { glb: "assets/robot-walk.glb", height: 1.55 }, // 메타봇 큐레이터
  };
  const curatorRigs = []; // { wrap, mixer }
  function curatorGender(model, idxInCat) {
    if (model.curator === "m" || model.curator === "f" || model.curator === "bot") return model.curator;
    return idxInCat % 2 === 0 ? "f" : "m";
  }
  function placeCurator(wrap, gender) {
    const def = CURATORS[gender];
    if (!def) return;
    loadCharAsset(def.glb)
      .then((gltf) => {
        const inst = skeletonClone(gltf.scene);
        inst.traverse((o) => { if (o.isMesh) o.castShadow = true; });
        const box = skinnedBox(inst);
        const size = box.getSize(new THREE.Vector3());
        inst.scale.setScalar(def.height / Math.max(size.y, 0.01));
        const box2 = skinnedBox(inst);
        inst.position.y -= box2.min.y;
        const cc = box2.getCenter(new THREE.Vector3());
        inst.position.x -= cc.x; inst.position.z -= cc.z;
        const mx = new THREE.AnimationMixer(inst);
        if (gltf.animations && gltf.animations.length) {
          mx.clipAction(gltf.animations[0]).play(); // 대기(Idle) 모션
        }
        const g = new THREE.Group();
        g.add(inst);
        g.position.set(3, 0, 4.5); // 부지 앞쪽 오른편, 통로를 향해
        wrap.add(g);
        curatorRigs.push({ wrap, mixer: mx });
      })
      .catch(() => {});
  }

  Promise.all([
    fetch(
      `${SB_URL}/rest/v1/models?select=slug,name,category,size,base_price,main_image,event_on,event_price,rooms,bathrooms,short_description,features,badge,interior_images,gallery_images&order=created_at.asc`,
      { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } }
    ).then((r) => { if (!r.ok) throw new Error("catalog"); return r.json(); }),
    window.SeumTownConfig ? window.SeumTownConfig.load().catch(() => ({ data: {} })) : Promise.resolve({ data: {} }),
  ])
    .then(([data, cfg]) => {
      let models = data.filter((m) => m.name);
      // 관리자 표시 설정 병합 (숨김/이름/가격/존/큐레이터 등)
      if (window.SeumTownConfig) models = window.SeumTownConfig.apply(models, cfg.data || {});
      applyZoneOverrides(cfg.data || {});
      zoneOvData = cfg.data || {};
      buildZoneDecor();
      placeModels(models.length ? models : TOWN_FALLBACK, cfg.data || {});
      spawnWalkers();
    })
    .catch(() => { buildZoneDecor(); placeModels(TOWN_FALLBACK, {}); spawnWalkers(); });

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
    // 메타봇 채팅에 현재 집 컨텍스트 전달 (큐레이터 모드)
    if (window.__metaChat && window.__metaChat.setContext) {
      window.__metaChat.setContext(best ? best.model : null);
    }
    if (!best) { cardEl.hidden = true; return; }
    const m = best.model;
    // 방문 통계: 어떤 모델 앞에 왔는지 (세션당 모델별 1회)
    if (window.SeumTownConfig && window.SeumTownConfig.logEvent) window.SeumTownConfig.logEvent("model", m.name);
    cardTag.textContent = zoneDisplay(m.category);
    cardName.textContent = m.name;
    cardSpec.textContent = m.size || "";
    cardPrice.textContent = fmtPrice(m);
    if (m.main_image) { cardImg.src = m.main_image; cardImg.hidden = false; }
    else cardImg.hidden = true;
    if (photosBtn) photosBtn.hidden = modelPics(m).length === 0;
    // 전화 상담: 실제 번호가 설정된 경우에만 (tel: 탭 즉시 통화)
    if (cardCall) {
      if (CONTACT_PHONE) { cardCall.href = `tel:${CONTACT_PHONE.replace(/[^0-9+]/g, "")}`; cardCall.hidden = false; }
      else cardCall.hidden = true;
    }
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

  // 캐릭터 발밑 블롭 그림자 — 떠 보이는 느낌 제거 (실그림자 꺼진 저사양에서 특히 효과)
  const blobTex = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const x = c.getContext("2d");
    const g = x.createRadialGradient(32, 32, 2, 32, 32, 30);
    g.addColorStop(0, "rgba(10,14,10,0.42)");
    g.addColorStop(0.7, "rgba(10,14,10,0.18)");
    g.addColorStop(1, "rgba(10,14,10,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  function addBlob(group, r) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(r * 2, r * 2),
      new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.05;
    m.renderOrder = 1;
    group.add(m);
    return m;
  }
  const playerBlob = addBlob(player, 0.62);

  const CHARACTERS = {
    // 메타봇은 안내봇·큐레이터 전용 — 방문객 선택 불가 (reserved)
    robot: { label: "메타봇", walk: "assets/robot-walk.glb", run: "assets/robot-run.glb", height: 1.9, reserved: true },
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
    if (myChar && (!CHARACTERS[myChar] || CHARACTERS[myChar].reserved)) myChar = null; // 예약 캐릭터 저장값은 무효
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

  const nickChip = document.getElementById("town-nick-chip");
  function updateNickChip() {
    if (!nickChip) return;
    const label = CHARACTERS[myChar] ? CHARACTERS[myChar].label : "";
    nickChip.textContent = `${myNick || "방문객"} · ${label}`;
    nickChip.hidden = false;
  }

  let playerRig = null;
  function setPlayerCharacter(charKey) {
    myChar = CHARACTERS[charKey] && !CHARACTERS[charKey].reserved ? charKey : "boy";
    try { localStorage.setItem("seum_char", myChar); } catch (e) {}
    buildCharInstance(myChar)
      .catch(() => capsuleFallback())
      .then((rig) => {
        while (player.children.length) player.remove(player.children[0]);
        player.userData.balloon = null;
        player.add(rig.obj);
        playerRig = rig;
        // 내 머리 위 닉네임 — 노란색으로 표시해 내 위치를 바로 찾을 수 있게
        const myLabel = nameSign(myNick || "방문객", "#ffd75e");
        myLabel.scale.set(2.4, 0.6, 1);
        myLabel.position.y = CHARACTERS[myChar].height + 0.55;
        player.add(myLabel);
        // 풍선 액세서리는 내 캐릭터에만
        attachBalloon(player, myColor, CHARACTERS[myChar].height);
        player.scale.setScalar(myScale);
        updateNickChip();
        loadingEl.hidden = true;
        if (rtChannel) {
          try { rtChannel.track({ char: myChar, nick: myNick || "방문객", color: myColor, scale: myScale }); } catch (e) {}
        }
      });
  }

  player.position.set(0, 0, 30); // 남쪽 입구(인포 앞)에서 시작
  // 체험 화면(빌드룸·교육관)에서 돌아온 경우 → 나갔던 자리(체험존)로 복귀
  try {
    const back = JSON.parse(sessionStorage.getItem("seum_town_return") || "null");
    sessionStorage.removeItem("seum_town_return");
    if (back && isFinite(back.x) && isFinite(back.z)) {
      player.position.x = Math.max(-SITE.x + 2, Math.min(SITE.x - 2, back.x));
      player.position.z = Math.max(SITE.zN + 2, Math.min(SITE.zS + 8, back.z));
    }
  } catch (e) {}
  // 방문 통계: 마을 입장 1회 기록
  if (window.SeumTownConfig && window.SeumTownConfig.logEvent) window.SeumTownConfig.logEvent("visit", "");

  // ---------- 멀티플레이 (Supabase Realtime) ----------
  const remotes = new Map(); // id -> { group, rig, char, nick, target }
  let rtChannel = null;

  function spawnRemote(id, meta) {
    const charKey = CHARACTERS[meta.char] ? meta.char : "robot";
    const group = new THREE.Group();
    group.position.set((Math.random() - 0.5) * 4, 0, 4 + Math.random() * 3);
    addBlob(group, 0.55);
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
        // 풍선은 내 캐릭터 전용 — 다른 방문자에게는 표시하지 않음 (내 위치 구분용)
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
        // 동시 접속 카운터
        const countEl = document.getElementById("town-count");
        if (countEl) {
          const n = Object.keys(state).length;
          countEl.textContent = `👥 지금 ${Math.max(n, 1)}명 구경 중`;
          countEl.hidden = n < 1;
        }
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
  let selChar = myChar || "boy";

  const colorsEl = document.getElementById("town-colors");
  const scaleEl = document.getElementById("town-scale");
  const scaleValEl = document.getElementById("town-scale-val");
  let selColor = myColor;
  let selScale = myScale;

  function renderSelect() {
    if (!selGrid) return;
    selGrid.innerHTML = Object.entries(CHARACTERS)
      .filter(([, d]) => !d.reserved) // 안내봇 전용 캐릭터 제외
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
      maybeAutoInfo();
    });
  }
  if (charBtn) charBtn.addEventListener("click", openSelect);

  if (myChar) {
    setPlayerCharacter(myChar);
    joinRealtime();
    maybeAutoInfo();
  } else {
    setPlayerCharacter("boy");
    openSelect();
  }

  // 인포메이션의 안내 NPC 메타봇 — 다가가면 안내 채팅이 열린다
  let npcGroup = null;
  let npcNear = false;
  buildCharInstance("robot")
    .then((rig) => {
      const npc = new THREE.Group();
      npc.add(rig.obj);
      const label = nameSign("안내봇 메타봇 🤖");
      label.scale.set(2.8, 0.7, 1);
      label.position.y = 2.5;
      npc.add(label);
      npc.position.set(INFO_POS.x + 2.6, 0, INFO_POS.z);
      npc.rotation.y = Math.atan2(0 - (INFO_POS.x + 2.6), 30 - INFO_POS.z);
      addBlob(npc, 0.6);
      scene.add(npc);
      npcGroup = npc;
    })
    .catch(() => {});

  // 마을 첫 입장 시 인포 안내 자동 오픈 (세션당 1회)
  function maybeAutoInfo() {
    try {
      if (sessionStorage.getItem("seum_info_greeted")) return;
      sessionStorage.setItem("seum_info_greeted", "1");
    } catch (e) {}
    setTimeout(() => {
      if (window.__metaChat && window.__metaChat.openInfo) window.__metaChat.openInfo();
    }, 1600);
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
    if (!airborne) { vy = 9.4; airborne = true; playJump(); }
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
    if (composer) {
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.setSize(w, h);
    }
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
  // 미니맵 탭 → 큰 지도 열기 (큰 지도에서 원하는 자리를 탭하면 순간이동)
  const bigmapEl = document.getElementById("bigmap");
  const bigCanvas = document.getElementById("bigmap-canvas");
  const bigCtx = bigCanvas ? bigCanvas.getContext("2d") : null;
  function openBigMap() {
    if (!bigmapEl) return;
    bigmapEl.hidden = false;
    if (bigCtx) paintMap(bigCtx, bigCanvas.width, true);
  }
  if (mapCanvas) {
    mapCanvas.style.pointerEvents = "auto";
    mapCanvas.style.cursor = "pointer";
    mapCanvas.addEventListener("click", openBigMap);
  }
  {
    const closeBtn = document.getElementById("bigmap-close");
    if (closeBtn) closeBtn.addEventListener("click", () => { bigmapEl.hidden = true; });
    if (bigmapEl) bigmapEl.addEventListener("click", (e) => { if (e.target === bigmapEl) bigmapEl.hidden = true; });
    if (bigCanvas) bigCanvas.addEventListener("click", (e) => {
      const r = bigCanvas.getBoundingClientRect();
      const S = bigCanvas.width;
      const scale = (S / 2 - 10) / MAP_EXT;
      const wx = (((e.clientX - r.left) / r.width) * S - S / 2) / scale;
      const wz = (((e.clientY - r.top) / r.height) * S - S / 2) / scale;
      // 대지 안으로 클램프 후 그 자리로 이동
      const tx = Math.max(-SITE.x + 2, Math.min(SITE.x - 2, wx));
      const tz = Math.max(SITE.zN + 2, Math.min(SITE.zS - 1.5, wz));
      player.position.x = tx;
      player.position.z = tz;
      updateNearCard();
      bigmapEl.hidden = true;
      if (window.SeumTownConfig && window.SeumTownConfig.logEvent) window.SeumTownConfig.logEvent("bigmap_tp", "");
    });
  }
  // 미니맵·큰 지도 공용 페인터 (big=true면 존 이름 라벨·큰 글씨)
  function paintMap(ctx, S, big) {
    const c = S / 2;
    const pad = big ? 10 : 6;
    const scale = (S / 2 - pad) / MAP_EXT;
    ctx.clearRect(0, 0, S, S);
    ctx.save();
    ctx.beginPath();
    if (big) ctx.roundRect(2, 2, S - 4, S - 4, 18);
    else ctx.arc(c, c, S / 2 - 3, 0, Math.PI * 2);
    ctx.clip();
    // 부지 바깥(짙은 녹지) + 사각 대지 + 울타리
    ctx.fillStyle = "#6e8f58";
    ctx.fillRect(0, 0, S, S);
    ctx.fillStyle = "#93c178";
    ctx.fillRect(c - SITE.x * scale, c + SITE.zN * scale, SITE.x * 2 * scale, (SITE.zS - SITE.zN) * scale);
    ctx.strokeStyle = "rgba(255,255,255,0.75)";
    ctx.lineWidth = 1;
    ctx.strokeRect(c - SITE.x * scale, c + SITE.zN * scale, SITE.x * 2 * scale, (SITE.zS - SITE.zN) * scale);
    // 도로 (존 블록보다 먼저 깔아 블록·라벨이 위에 오게)
    ctx.fillStyle = "rgba(210,200,178,0.95)";
    ctx.fillRect(c - 3.5 * scale, c + SITE.zN * scale, 7 * scale, (SITE.zS - SITE.zN + 8) * scale);
    AISLES.forEach((z) => {
      ctx.fillRect(c - 68 * scale, c + (z - 1.2) * scale, 136 * scale, Math.max(2.4 * scale, 1.6));
    });
    [-36.5, 36.5].forEach((x) => {
      ctx.fillRect(c + (x - 1.2) * scale, c - 71 * scale, Math.max(2.4 * scale, 1.6), 92 * scale);
    });
    // 존 사각 블록 + 이모지(+큰 지도는 존 이름)
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const zoneCell = (minX, maxX, front, back, color, emoji, label) => {
      ctx.fillStyle = `#${color.toString(16).padStart(6, "0")}88`;
      ctx.fillRect(c + minX * scale, c + back * scale, (maxX - minX) * scale, (front - back) * scale);
      const zx = c + ((minX + maxX) / 2) * scale;
      const zy = c + ((front + back) / 2) * scale;
      if (big) {
        ctx.font = "22px sans-serif";
        ctx.fillText(emoji, zx, zy - 10);
        ctx.font = "700 12px 'Noto Sans KR', sans-serif";
        ctx.fillStyle = "#233527";
        ctx.fillText(label, zx, zy + 12);
      } else {
        ctx.font = "12px sans-serif";
        ctx.fillText(emoji, zx, zy);
      }
    };
    Object.values(ZONES).forEach((z) => {
      const minX = Math.min(...z.cols) - XP / 2;
      const maxX = Math.max(...z.cols) + XP / 2;
      const front = z.rowStart + PITCH / 2;
      const back = z.rowStart - ((z.rowsDeep || 3) - 0.5) * PITCH;
      zoneCell(minX, maxX, front, back, z.color, z.emoji, z.label.replace(/\s*존$/, ""));
    });
    zoneCell(EXP.minX, EXP.maxX, EXP.front, EXP.back, EXP.color, "🎪", "체험존");
    // 입구 광장 + 인포메이션
    ctx.fillStyle = "#d9cfbb";
    ctx.beginPath();
    ctx.arc(c, c + 26 * scale, 7 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = big ? "16px sans-serif" : "11px sans-serif";
    ctx.fillText("ℹ️", c, c + 26 * scale);
    // 집
    ctx.fillStyle = "#274b38";
    const hs = big ? 3.6 : 2.4;
    houseLots.forEach((l) => {
      ctx.fillRect(c + l.wrap.position.x * scale - hs, c + l.wrap.position.z * scale - hs, hs * 2, hs * 2);
    });
    // 다른 방문자
    ctx.fillStyle = "#f39c12";
    remotes.forEach((r) => {
      ctx.beginPath();
      ctx.arc(c + r.group.position.x * scale, c + r.group.position.z * scale, big ? 4.5 : 3, 0, Math.PI * 2);
      ctx.fill();
    });
    // 내 위치 (진행 방향 화살표)
    ctx.save();
    ctx.translate(c + player.position.x * scale, c + player.position.z * scale);
    ctx.rotate(Math.PI - heading);
    const as = big ? 1.6 : 1;
    ctx.fillStyle = "#e74c3c";
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -6.5 * as);
    ctx.lineTo(4.4 * as, 4.6 * as);
    ctx.lineTo(-4.4 * as, 4.6 * as);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.restore();
  }
  function drawMap() {
    paintMap(mapCtx, mapCanvas.width, false);
    // 큰 지도가 열려 있으면 같이 갱신 (내 위치·방문자 실시간)
    if (bigmapEl && !bigmapEl.hidden && bigCtx) paintMap(bigCtx, bigCanvas.width, true);
  }
  const lookAt = new THREE.Vector3();
  const clock = new THREE.Clock();
  let heading = 0;

  // ---------- 자동 품질 조절 (프레임 기준 해상도 단계 조정) ----------
  let fpsTime = 0, fpsFrames = 0, qCooldown = 0;
  function tuneQuality(dt) {
    fpsTime += dt;
    fpsFrames++;
    qCooldown -= dt;
    if (fpsTime < 2.5) return;
    const fps = fpsFrames / fpsTime;
    fpsTime = 0;
    fpsFrames = 0;
    if (qCooldown > 0) return;
    if (fps < 32 && qLevel < Q_CAPS.length - 1) {
      qLevel++;
      applyQuality();
      qCooldown = 4; // 연속 강등 방지
    } else if (fps > 55 && qLevel > 0) {
      qLevel--;
      applyQuality();
      qCooldown = 8; // 승격 후 출렁임 방지
    }
  }
  // 품질 티어 일괄 적용: 해상도 + 그림자 + 후처리
  function applyQuality() {
    renderer.setPixelRatio(pixelRatio());
    if (composer) {
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.setSize(stage.clientWidth, stage.clientHeight);
    }
    sun.castShadow = qLevel < 2; // 저사양: 그림자 끔
    // 저사양: NPC 방문객 수 축소 (앞의 2명만)
    npcWalkers.forEach((w, i) => { if (w.g) w.g.visible = qLevel < 2 || i < 2; });
    if (petals) petals.visible = qLevel < 2; // 저사양: 꽃잎 파티클 끔
  }

  // ---------- 존 진입 배너 (존 경계를 넘으면 상단에 잠깐 표시) ----------
  const zoneBannerEl = document.getElementById("town-zonebanner");
  let curZoneKey = null, zoneBannerTimer = null, zoneCheckT = 0;
  function zoneAt(x, z) {
    // front(게이트) 쪽은 통로·입구까지 존 영역으로 인정 (+4) — 입구에 서자마자 배너가 뜨게
    const M = 4;
    if (x >= EXP.minX && x <= EXP.maxX && z >= EXP.back && z <= EXP.front + M) {
      return { key: "체험존", emoji: "🎪", label: "체험존", color: EXP.color };
    }
    for (const [key, zn] of Object.entries(ZONES)) {
      const minX = Math.min(...zn.cols) - XP / 2;
      const maxX = Math.max(...zn.cols) + XP / 2;
      const front = zn.rowStart + PITCH / 2;
      const back = zn.rowStart - ((zn.rowsDeep || 3) - 0.5) * PITCH;
      if (x >= minX && x <= maxX && z >= back && z <= front + M) return { key, emoji: zn.emoji, label: zn.label, color: zn.color };
    }
    return null;
  }
  function checkZoneBanner() {
    const zn = zoneAt(player.position.x, player.position.z);
    const key = zn ? zn.key : null;
    if (key === curZoneKey) return;
    curZoneKey = key;
    if (!zn || !zoneBannerEl) return;
    zoneBannerEl.textContent = `${zn.emoji} ${zn.label}`;
    zoneBannerEl.style.borderColor = hex(zn.color);
    zoneBannerEl.hidden = false;
    zoneBannerEl.classList.remove("is-show");
    void zoneBannerEl.offsetWidth; // 애니메이션 재시작
    zoneBannerEl.classList.add("is-show");
    if (zoneBannerTimer) clearTimeout(zoneBannerTimer);
    zoneBannerTimer = setTimeout(() => { zoneBannerEl.classList.remove("is-show"); }, 2400);
  }

  // 외부(시작 화면)·디버그용 훅
  window.__seumTown = {
    teleport(x, z) { player.position.x = x; player.position.z = z; updateNearCard(); },
    lots: houseLots,
    // 시작 화면에서 캐릭터·닉네임을 정하고 바로 입장시킬 때 사용
    setCharacter(charKey, nick) {
      if (nick) {
        myNick = nick;
        try { localStorage.setItem("seum_nick", nick); } catch (e) {}
      }
      if (selEl) selEl.hidden = true;
      setPlayerCharacter(charKey && CHARACTERS[charKey] && !CHARACTERS[charKey].reserved ? charKey : myChar || "boy");
      joinRealtime();
    },
    // 존 바로가기 (인포 안내봇·미니맵의 순간이동)
    gotoZone(cat) {
      if (window.SeumTownConfig && window.SeumTownConfig.logEvent) window.SeumTownConfig.logEvent("zone", cat);
      const z = ZONES[zoneFor(cat)];
      player.position.x = z.entry.x;
      player.position.z = z.entry.z;
      heading = Math.PI; // 블록(북쪽)을 바라보게
      player.rotation.y = heading;
      updateNearCard();
    },
    zones: Object.keys(ZONES),
    zoneLabel: (cat) => zoneDisplay(cat), // 챗봇 등에서 존 표시 이름 조회
    // 체험존 바로가기 (안내봇의 "직접 지어보기·배워보기" 안내용)
    gotoExperience() {
      if (window.SeumTownConfig && window.SeumTownConfig.logEvent) window.SeumTownConfig.logEvent("zone", "체험존");
      player.position.x = EXP.entry.x;
      player.position.z = EXP.entry.z;
      heading = Math.PI;
      player.rotation.y = heading;
      updateNearCard();
    },
    // 체험 화면(빌드룸·교육관)으로 나가기 전에 현재 위치 저장 → 돌아오면 그 자리(체험존)로 복귀
    saveReturnSpot() {
      try { sessionStorage.setItem("seum_town_return", JSON.stringify({ x: player.position.x, z: player.position.z })); } catch (e) {}
    },
    // 디버그·연출용 카메라 (방위각 rad, 줌 배율)
    setCam(az, zoom) { if (az != null) camAz = az; if (zoom != null) camZoom = Math.max(0.55, Math.min(3.2, zoom)); },
    quality: () => ({ qLevel, pixelRatio: renderer.getPixelRatio() }),
    _scene: scene,
    _expPortals: expPortals,
  };

  function tick() {
    requestAnimationFrame(tick);
    const rawDt = clock.getDelta();
    const dt = Math.min(rawDt, 0.05); // 게임 로직용 클램프 (프레임 급락 시 순간이동 방지)
    if (!running) return;
    tuneQuality(Math.min(rawDt, 1)); // FPS 측정은 실제 프레임 간격으로

    // 발밑 블롭 그림자: 점프 중에도 지면에 붙어 있고, 높이에 따라 작아짐
    playerBlob.position.y = 0.05 - player.position.y;
    playerBlob.scale.setScalar(Math.max(0.45, 1 - player.position.y * 0.22));
    // 존 진입 감지 (0.35초 간격이면 충분)
    zoneCheckT += dt;
    if (zoneCheckT > 0.35) { zoneCheckT = 0; checkZoneBanner(); }

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
    stepTick(dt, moving, sprinting, player.position.y <= 0.01); // 발소리

    if (moving) {
      // 입력을 카메라 방향 기준으로 회전 (시점을 돌려도 W = 화면 앞)
      const ca = Math.cos(camAz), sa = Math.sin(camAz);
      const wx = mx * ca + mz * sa;
      const wz = -mx * sa + mz * ca;
      const dir = Math.atan2(wx, wz);
      const speed = sprinting ? RUN_SPEED : WALK_SPEED;
      player.position.x += Math.sin(dir) * speed * mag * dt;
      player.position.z += Math.cos(dir) * speed * mag * dt;
      // 사각 부지 경계 안에서만 이동. 남쪽은 정문(|x|<7.5)으로만 출입
      player.position.x = Math.max(-SITE.x + 2, Math.min(SITE.x - 2, player.position.x));
      const zMax = Math.abs(player.position.x) < 7.5 ? SITE.zS + 8 : SITE.zS - 1.5;
      player.position.z = Math.max(SITE.zN + 2, Math.min(zMax, player.position.z));
      if (player.position.z > SITE.zS - 1.5) player.position.x = Math.max(-7.4, Math.min(7.4, player.position.x));
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
      if (player.position.y <= 0) { player.position.y = 0; vy = 0; airborne = false; playLand(); }
    }

    if (playerRig && playerRig.mixer) playerRig.mixer.update(dt);

    // 근처 큐레이터만 대기 모션 재생 (성능)
    curatorRigs.forEach((r) => {
      const wp = r.wrap.position;
      if (Math.abs(wp.x - player.position.x) < 30 && Math.abs(wp.z - player.position.z) < 30) {
        r.mixer.update(dt);
      }
    });

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

    // NPC 메타봇 근접 → 인포 안내 채팅 열기 (멀어지면 다시 트리거 가능)
    if (npcGroup && window.__metaChat) {
      const nd = Math.hypot(npcGroup.position.x - player.position.x, npcGroup.position.z - player.position.z);
      if (nd < 2.6 && !npcNear) {
        npcNear = true;
        if (window.__metaChat.openInfo) window.__metaChat.openInfo();
        else window.__metaChat.open();
      } else if (nd > 4.8) npcNear = false;
    }

    // 체험존 포털들: 이중 링 역회전 + 포털면 맥동 + 빛 구슬 공전 + 근접 입장 버튼
    if (expPortals.length) {
      let nearest = null, nearestD = Infinity;
      expPortals.forEach((p) => {
        const T = (p.group.userData.t = (p.group.userData.t || 0) + dt);
        p.ring.rotation.y += dt * 0.7;
        p.ring2.rotation.y -= dt * 1.3;
        p.disc.material.opacity = (p.def.soon ? 0.1 : 0.28) + Math.sin(T * 2.2) * (p.def.soon ? 0.04 : 0.12);
        p.orbs.forEach((o, i) => {
          const a = o.userData.a + T * 0.9;
          o.position.set(Math.cos(a) * 1.25, 1.55 + Math.sin(T * 1.6 + i * 1.7) * 0.55, Math.sin(a) * 1.25);
        });
        if (p.def.href) {
          const d = Math.hypot(p.group.position.x - player.position.x, p.group.position.z - player.position.z);
          if (d < nearestD) { nearestD = d; nearest = p; }
        }
      });
      const cta = document.getElementById("town-build-cta");
      if (cta) {
        if (nearest && nearestD <= 3.6) {
          cta.hidden = false;
          cta.href = nearest.def.href;
          cta.textContent = `${nearest.def.icon} ${nearest.def.label} 입장`;
        } else cta.hidden = true;
      }
    }

    clouds.forEach((c, i) => { c.position.x += dt * (0.25 + i * 0.05); if (c.position.x > 55) c.position.x = -55; });

    // 분수: 물결 회전 + 물방울 통통
    if (fountainWater) {
      fountainWater.rotation.z += dt * 0.35;
      const T = clock.elapsedTime;
      fountainDrops.forEach((d, i) => {
        const p = (T * 1.4 + i * 0.55) % 1;
        d.position.set(Math.cos(d.userData.a) * (0.3 + p * 0.9), 1.45 + Math.sin(p * Math.PI) * 0.75 - p * 0.5, Math.sin(d.userData.a) * (0.3 + p * 0.9));
        d.scale.setScalar(1 - p * 0.5);
      });
    }
    // 꽃잎: 천천히 낙하 + 좌우 하늘하늘 (바닥에 닿으면 위에서 재등장)
    if (petals && petals.visible) {
      const arr = petals.geometry.attributes.position.array;
      const seed = petals.userData.seed;
      const T = clock.elapsedTime;
      for (let i = 0; i < seed.length; i++) {
        arr[i * 3] += Math.sin(T * 0.9 + seed[i]) * dt * 0.5;
        arr[i * 3 + 1] -= dt * (0.28 + (seed[i] % 1) * 0.2);
        arr[i * 3 + 2] += Math.cos(T * 0.7 + seed[i]) * dt * 0.35;
        if (arr[i * 3 + 1] < 0.15) {
          arr[i * 3] = player.position.x - 40 + Math.random() * 80;
          arr[i * 3 + 1] = 5 + Math.random() * 3;
          arr[i * 3 + 2] = player.position.z - 35 + Math.random() * 70;
        }
      }
      petals.geometry.attributes.position.needsUpdate = true;
    }

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
    scene.fog.near = 55 * Math.max(1, camZoom);
    scene.fog.far = 155 * Math.max(1, camZoom);
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
    // NPC 방문객: 통로 왕복 + 가까울 때만 애니메이션 (성능)
    npcWalkers.forEach((w) => {
      if (!w.g.visible) return;
      const [tx, tz] = w.cfg.path[w.wp];
      const dx = tx - w.g.position.x, dz = tz - w.g.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.3) { w.wp = (w.wp + 1) % w.cfg.path.length; return; }
      const sp = w.cfg.speed * dt;
      w.g.position.x += (dx / dist) * sp;
      w.g.position.z += (dz / dist) * sp;
      const ang = Math.atan2(dx, dz);
      let diff = ang - w.g.rotation.y;
      diff = ((diff + Math.PI) % (Math.PI * 2)) - Math.PI;
      w.g.rotation.y += diff * Math.min(1, dt * 8);
      if (w.rig.mixer && Math.abs(w.g.position.x - player.position.x) < 45 && Math.abs(w.g.position.z - player.position.z) < 45) {
        w.rig.mixer.update(dt);
      }
    });
    // 태양·그림자 카메라를 플레이어 주변으로 이동 (선명한 그림자 유지)
    sun.position.set(player.position.x + 18, 30, player.position.z + 14);
    sun.target.position.set(player.position.x, 0, player.position.z);
    // 고사양 티어: 블룸 후처리, 그 외: 기본 렌더
    if (composer && qLevel === 0) composer.render();
    else renderer.render(scene, camera);
  }
  tick();
}
