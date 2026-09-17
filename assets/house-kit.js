// ============ METAHOUSE 하우스 키트 — 파라메트릭 정밀 주택 빌더 ============
// 치수(m)를 넣으면 실제 건축 디테일로 집을 조립한다: 사이딩 요철, 코너 트림,
// 매입 창호(리빌+창틀+유리), 파라펫/박공 지붕, 물받이·선홈통, 데크, 현관 캐노피.
// 스캔 GLB보다 지오메트리가 깨끗하고 치수가 정확해 "3D맥스 렌더" 느낌을 낸다.
// 마을(town.js)·빌드룸(build.js) 공용. 사용: buildHouse(HOUSE_SPECS.stay14)
import * as THREE from "three";

// ---------- 절차적 텍스처 (캔버스) ----------
const texCache = {};
function canvasTex(key, w, h, draw) {
  if (texCache[key]) return texCache[key];
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  draw(cv.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  texCache[key] = t;
  return t;
}
// 범프맵(무채색)은 colorSpace 지정 없이
function canvasBump(key, w, h, draw) {
  if (texCache[key]) return texCache[key];
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  draw(cv.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  texCache[key] = t;
  return t;
}
function hexCss(hex) { return "#" + hex.toString(16).padStart(6, "0"); }
function shade(hex, f) {
  const r = Math.min(255, Math.max(0, Math.round(((hex >> 16) & 255) * f)));
  const g = Math.min(255, Math.max(0, Math.round(((hex >> 8) & 255) * f)));
  const b = Math.min(255, Math.max(0, Math.round((hex & 255) * f)));
  return `rgb(${r},${g},${b})`;
}
// 수평 목재 사이딩: 판재 폭 ~15cm, 나뭇결·판재별 톤 편차·이음 그림자
function sidingTexture(baseHex) {
  const key = `sid_${baseHex}`;
  return canvasTex(key, 512, 512, (c) => {
    const rows = 12; // 512px = 1.8m 가정 → 판재 15cm
    const rh = 512 / rows;
    for (let i = 0; i < rows; i++) {
      const tone = 0.9 + ((i * 2654435761) % 100) / 100 * 0.22; // 판재별 편차
      c.fillStyle = shade(baseHex, tone);
      c.fillRect(0, i * rh, 512, rh);
      // 나뭇결 스트로크
      c.globalAlpha = 0.1;
      for (let g = 0; g < 7; g++) {
        c.strokeStyle = g % 2 ? "#000" : "#fff";
        c.lineWidth = 1;
        c.beginPath();
        const y = i * rh + 4 + ((i * 37 + g * 53) % (rh - 8));
        c.moveTo(0, y);
        for (let x = 0; x <= 512; x += 64) c.lineTo(x, y + Math.sin((x + i * 91) * 0.02) * 1.6);
        c.stroke();
      }
      c.globalAlpha = 1;
      // 판재 하단 이음 그림자 + 상단 하이라이트 (섀도갭)
      c.fillStyle = "rgba(0,0,0,0.38)";
      c.fillRect(0, (i + 1) * rh - 3, 512, 3);
      c.fillStyle = "rgba(255,255,255,0.14)";
      c.fillRect(0, i * rh, 512, 1.5);
    }
  });
}
function sidingBump() {
  return canvasBump("sid_bump", 256, 512, (c) => {
    const rows = 12, rh = 512 / rows;
    c.fillStyle = "#808080";
    c.fillRect(0, 0, 256, 512);
    for (let i = 0; i < rows; i++) {
      c.fillStyle = "#3a3a3a";
      c.fillRect(0, (i + 1) * rh - 4, 256, 4); // 홈
      c.fillStyle = "#a8a8a8";
      c.fillRect(0, i * rh, 256, 2); // 판재 윗면
    }
  });
}
// 세로 금속 패널 (스탠딩심 지붕/다크 메탈 외장)
function seamTexture(baseHex) {
  return canvasTex(`seam_${baseHex}`, 512, 256, (c) => {
    c.fillStyle = hexCss(baseHex);
    c.fillRect(0, 0, 512, 256);
    const cols = 10, cw = 512 / cols;
    for (let i = 0; i < cols; i++) {
      c.fillStyle = "rgba(255,255,255,0.10)";
      c.fillRect(i * cw, 0, 2.5, 256); // 심 하이라이트
      c.fillStyle = "rgba(0,0,0,0.34)";
      c.fillRect(i * cw + 2.5, 0, 3, 256); // 심 그림자
      c.fillStyle = `rgba(255,255,255,${0.015 + (i % 3) * 0.012})`; // 패널 톤 편차
      c.fillRect(i * cw + 6, 0, cw - 6, 256);
    }
  });
}
function seamBump() {
  return canvasBump("seam_bump", 512, 64, (c) => {
    c.fillStyle = "#808080";
    c.fillRect(0, 0, 512, 64);
    const cols = 10, cw = 512 / cols;
    for (let i = 0; i < cols; i++) {
      c.fillStyle = "#ffffff";
      c.fillRect(i * cw, 0, 3, 64);
    }
  });
}
// 데크 플랭크
function deckTexture() {
  return canvasTex("deck", 512, 512, (c) => {
    const cols = 9, cw = 512 / cols;
    for (let i = 0; i < cols; i++) {
      c.fillStyle = shade(0xa07850, 0.85 + ((i * 97) % 10) / 10 * 0.3);
      c.fillRect(i * cw, 0, cw, 512);
      c.globalAlpha = 0.12;
      for (let g = 0; g < 5; g++) {
        c.strokeStyle = "#3a2a18";
        c.beginPath();
        const x = i * cw + 5 + ((i * 31 + g * 47) % (cw - 10));
        c.moveTo(x, 0);
        for (let y = 0; y <= 512; y += 64) c.lineTo(x + Math.sin(y * 0.02 + i) * 2, y);
        c.stroke();
      }
      c.globalAlpha = 1;
      c.fillStyle = "rgba(0,0,0,0.42)";
      c.fillRect((i + 1) * cw - 3, 0, 3, 512);
    }
  });
}

// ---------- 공용 재질 ----------
function wallMaterial(spec) {
  const color = spec.color != null ? spec.color : 0x8a6a4c;
  if (spec.finish === "metal") {
    const m = new THREE.MeshStandardMaterial({
      map: seamTexture(color), bumpMap: seamBump(), bumpScale: 1.6,
      roughness: 0.42, metalness: 0.35, envMapIntensity: 0.9,
    });
    m.map.repeat.set(1, 1);
    return m;
  }
  // 기본: 목재 사이딩
  return new THREE.MeshStandardMaterial({
    map: sidingTexture(color), bumpMap: sidingBump(), bumpScale: 1.8,
    roughness: 0.72, envMapIntensity: 0.55,
  });
}
const MAT = {
  trim: () => new THREE.MeshStandardMaterial({ color: 0x22252a, roughness: 0.45, metalness: 0.25 }),
  frame: () => new THREE.MeshStandardMaterial({ color: 0x1c1f24, roughness: 0.32, metalness: 0.55, envMapIntensity: 1.0 }),
  glass: () => new THREE.MeshPhysicalMaterial ? new THREE.MeshPhysicalMaterial({
    color: 0x8fb4c4, roughness: 0.06, metalness: 0.1, envMapIntensity: 1.5,
    clearcoat: 1.0, clearcoatRoughness: 0.05, transparent: true, opacity: 0.86,
  }) : new THREE.MeshStandardMaterial({ color: 0x7fa8bd, roughness: 0.08, metalness: 0.5, envMapIntensity: 1.4 }),
  reveal: () => new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.8 }),
  concrete: () => new THREE.MeshStandardMaterial({ color: 0x8f9089, roughness: 0.95 }),
  roof: (hex) => new THREE.MeshStandardMaterial({
    map: seamTexture(hex != null ? hex : 0x2e3338), bumpMap: seamBump(), bumpScale: 1.4,
    roughness: 0.5, metalness: 0.4, envMapIntensity: 0.8,
  }),
  fascia: () => new THREE.MeshStandardMaterial({ color: 0x282c31, roughness: 0.5, metalness: 0.2 }),
  deck: () => new THREE.MeshStandardMaterial({ map: deckTexture(), roughness: 0.7, envMapIntensity: 0.4 }),
  white: () => new THREE.MeshStandardMaterial({ color: 0xeceae4, roughness: 0.6 }),
};
function box(w, h, d, mat, x, y, z, castShadow) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x || 0, y || 0, z || 0);
  if (castShadow !== false) m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// ---------- 창호 유닛 (리빌 + 프레임 + 유리 + 분할바) ----------
// wall 로컬 기준: 벽 바깥면이 z=0. 벽이 솔리드 박스이므로 요소들을 바깥쪽(+z)으로
// 살짝 띄우고, 어두운 리빌 + 프레임 그림자로 매입감을 표현한다.
function makeWindow(w, h, opts) {
  const g = new THREE.Group();
  const o = opts || {};
  const F = 0.06; // 프레임 두께
  // 리빌(개구부 어둠) — 벽면 바로 위
  g.add(box(w, h, 0.012, MAT.reveal(), 0, 0, 0.008, false));
  // 유리
  const glass = box(w - F * 2, h - F * 2, 0.012, MAT.glass(), 0, 0, 0.02, false);
  g.add(glass);
  // 프레임 4변 (유리보다 앞으로 — 매입 그림자 라인 생성)
  const fm = MAT.frame();
  g.add(box(w, F, 0.05, fm, 0, h / 2 - F / 2, 0.032));
  g.add(box(w, F, 0.05, fm, 0, -h / 2 + F / 2, 0.032));
  g.add(box(F, h - F * 2, 0.05, fm, -w / 2 + F / 2, 0, 0.032));
  g.add(box(F, h - F * 2, 0.05, fm, w / 2 - F / 2, 0, 0.032));
  // 분할바 (세로 1개 기본, wide면 2개)
  const bars = o.bars != null ? o.bars : w > 1.6 ? 2 : 1;
  for (let i = 1; i <= bars; i++) {
    g.add(box(0.035, h - F * 2, 0.035, fm, -w / 2 + (w / (bars + 1)) * i, 0, 0.034));
  }
  // 창대(sill) — 하단 물끊기
  g.add(box(w + 0.1, 0.045, 0.12, MAT.trim(), 0, -h / 2 - 0.0225, 0.05));
  return g;
}
// 현관문 (패널 + 손잡이 + 상부 캐노피 옵션)
function makeDoor(w, h, opts) {
  const g = new THREE.Group();
  g.add(box(w + 0.12, h + 0.06, 0.012, MAT.reveal(), 0, 0.03, 0.008, false));
  const fm = MAT.frame();
  g.add(box(w + 0.12, 0.06, 0.06, fm, 0, h / 2 + 0.03, 0.03));
  g.add(box(0.06, h + 0.06, 0.06, fm, -w / 2 - 0.03, 0.03, 0.03));
  g.add(box(0.06, h + 0.06, 0.06, fm, w / 2 + 0.03, 0.03, 0.03));
  // 도어 본체 (세로 우드 패널)
  const door = box(w, h, 0.045, new THREE.MeshStandardMaterial({
    map: sidingTexture(0x5d4634), roughness: 0.55, envMapIntensity: 0.5,
  }), 0, 0, 0.026);
  door.material.map = door.material.map.clone();
  door.material.map.rotation = Math.PI / 2;
  door.material.map.center.set(0.5, 0.5);
  door.material.map.needsUpdate = true;
  g.add(door);
  // 세로 유리 슬릿
  g.add(box(0.14, h * 0.72, 0.02, MAT.glass(), w / 2 - 0.2, 0.05, 0.052, false));
  // 손잡이 (바 타입)
  const hd = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.32, 10),
    new THREE.MeshStandardMaterial({ color: 0xc9c9c9, roughness: 0.25, metalness: 0.9 }));
  hd.position.set(-w / 2 + 0.12, 0, 0.085);
  g.add(hd);
  // 캐노피 (상부 차양)
  if (!opts || opts.canopy !== false) {
    const cn = box(w + 0.7, 0.05, 0.75, MAT.fascia(), 0, h / 2 + 0.22, 0.36);
    cn.rotation.x = -0.06;
    g.add(cn);
    [-1, 1].forEach((s) => {
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.62, 8), MAT.frame());
      rod.position.set(s * (w / 2 + 0.22), h / 2 + 0.42, 0.4);
      rod.rotation.x = 0.85;
      g.add(rod);
    });
  }
  // 현관등
  const lamp = box(0.07, 0.16, 0.07, MAT.frame(), w / 2 + 0.35, h * 0.42, 0.045);
  g.add(lamp);
  const bulb = box(0.05, 0.09, 0.05, new THREE.MeshStandardMaterial({
    color: 0xfff2cf, emissive: 0xffdf9a, emissiveIntensity: 0.55, roughness: 0.4,
  }), w / 2 + 0.35, h * 0.42, 0.05, false);
  g.add(bulb);
  return g;
}

// ---------- 벽면에 개구부 배치 헬퍼 ----------
// side: "front"(+z) "back"(-z) "left"(-x) "right"(+x), u: 벽 좌측단으로부터의 중심 위치(m)
function placeOnWall(group, item, W, D, side, u, cy) {
  const HW = W / 2, HD = D / 2;
  if (side === "front") { item.position.set(-HW + u, cy, HD); }
  else if (side === "back") { item.position.set(HW - u, cy, -HD); item.rotation.y = Math.PI; }
  else if (side === "left") { item.position.set(-HW, cy, -HD + u); item.rotation.y = -Math.PI / 2; }
  else { item.position.set(HW, cy, HD - u); item.rotation.y = Math.PI / 2; }
  group.add(item);
}

// ---------- 메인: 주택 조립 ----------
// spec: { w, d, wallH, finish:"wood"|"metal", color, roof:{type:"flat"|"gable"|"mono", h, overhang, color},
//         windows:[{side,u,w,h,sill,bars}], door:{side,u,w,h}, deck:{side,depth,inset}, base:0.35 }
export function buildHouse(spec) {
  const W = spec.w, D = spec.d, H = spec.wallH || 2.7;
  const BASE = spec.base != null ? spec.base : 0.32; // 기초 높이
  const g = new THREE.Group();

  // 기초 (콘크리트 — 벽보다 살짝 안쪽, 물끊기 라인)
  g.add(box(W - 0.12, BASE, D - 0.12, MAT.concrete(), 0, BASE / 2, 0));
  // 벽체
  const wm = wallMaterial(spec);
  wm.map = wm.map.clone();
  wm.map.needsUpdate = true;
  wm.map.repeat.set(Math.max(1, W / 1.8), Math.max(1, H / 1.8));
  if (wm.bumpMap) {
    wm.bumpMap = wm.bumpMap.clone();
    wm.bumpMap.needsUpdate = true;
    wm.bumpMap.repeat.copy(wm.map.repeat);
  }
  const walls = box(W, H, D, wm, 0, BASE + H / 2, 0);
  g.add(walls);
  // 하단 물끊기(베이스 플래싱)
  g.add(box(W + 0.06, 0.09, D + 0.06, MAT.trim(), 0, BASE + 0.045, 0));
  // 코너 트림 4개
  const CT = 0.09;
  [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([sx, sz]) => {
    g.add(box(CT, H, CT, MAT.trim(), sx * (W / 2 - 0.005), BASE + H / 2, sz * (D / 2 - 0.005)));
  });

  // 창호
  (spec.windows || []).forEach((wd) => {
    const win = makeWindow(wd.w, wd.h, wd);
    const sill = wd.sill != null ? wd.sill : 0.9;
    placeOnWall(g, win, W, D, wd.side || "front", wd.u, BASE + sill + wd.h / 2);
  });
  // 현관
  if (spec.door) {
    const dr = makeDoor(spec.door.w || 1.0, spec.door.h || 2.1, spec.door);
    placeOnWall(g, dr, W, D, spec.door.side || "front", spec.door.u, BASE + (spec.door.h || 2.1) / 2);
  }

  // 지붕
  const roof = spec.roof || { type: "flat" };
  const OV = roof.overhang != null ? roof.overhang : 0.35;
  const topY = BASE + H;
  if (roof.type === "gable") {
    const RH = roof.h || Math.min(1.4, W * 0.2);
    const shape = new THREE.Shape();
    shape.moveTo(-W / 2 - OV, 0);
    shape.lineTo(W / 2 + OV, 0);
    shape.lineTo(0, RH);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: D + OV * 2, bevelEnabled: false });
    geo.translate(0, 0, -(D + OV * 2) / 2);
    const rf = new THREE.Mesh(geo, MAT.roof(roof.color));
    rf.position.y = topY;
    rf.castShadow = true;
    rf.receiveShadow = true;
    g.add(rf);
    // 용마루 캡
    g.add(box(0.12, 0.06, D + OV * 2 + 0.04, MAT.fascia(), 0, topY + RH + 0.01, 0));
    // 처마 페이시아 (전후)
    [-1, 1].forEach((s) => g.add(box(W + OV * 2, 0.14, 0.05, MAT.fascia(), 0, topY - 0.02, s * (D / 2 + OV))));
  } else if (roof.type === "mono") {
    // 외쪽(단경사) 지붕 — 모던 컨테이너 스타일
    const RH = roof.h || 0.5;
    const rg = new THREE.Group();
    const len = Math.hypot(W + OV * 2, RH);
    const slab = box(len, 0.1, D + OV * 2, MAT.roof(roof.color), 0, 0, 0);
    slab.rotation.z = Math.atan2(RH, W + OV * 2);
    rg.position.set(0, topY + RH / 2 + 0.03, 0);
    rg.add(slab);
    g.add(rg);
    [-1, 1].forEach((s) => g.add(box(W + OV * 2, 0.16, 0.05, MAT.fascia(), 0, topY + (s > 0 ? RH : 0), s * 0 + (s > 0 ? 0 : 0))));
    // 높은쪽·낮은쪽 페이시아
    g.add(box(0.06, 0.2, D + OV * 2, MAT.fascia(), -(W / 2 + OV), topY + 0.04, 0));
    g.add(box(0.06, 0.2, D + OV * 2, MAT.fascia(), W / 2 + OV, topY + RH + 0.02, 0));
  } else {
    // 평지붕: 파라펫 + 캡 플래싱 + 지붕판
    const P = 0.32; // 파라펫 높이
    g.add(box(W + 0.08, P, D + 0.08, wm, 0, topY + P / 2, 0));
    g.add(box(W + 0.16, 0.05, D + 0.16, MAT.fascia(), 0, topY + P + 0.025, 0)); // 두겁(캡)
    const rf = box(W - 0.1, 0.03, D - 0.1, MAT.roof(roof.color), 0, topY + P - 0.06, 0, false);
    g.add(rf);
  }

  // 물받이 + 선홈통 (박공/외쪽만)
  if (roof.type === "gable" || roof.type === "mono") {
    [-1, 1].forEach((s) => {
      const gutter = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, D + OV * 2, 10, 1, false, 0, Math.PI), MAT.fascia());
      gutter.rotation.x = Math.PI / 2;
      gutter.rotation.z = Math.PI;
      gutter.position.set(s * (W / 2 + OV), topY - 0.1, 0);
      g.add(gutter);
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, H + BASE - 0.15, 8), MAT.fascia());
      pipe.position.set(s * (W / 2 + 0.05), (H + BASE) / 2, D / 2 - 0.25);
      g.add(pipe);
    });
  }

  // 데크
  if (spec.deck) {
    const dk = spec.deck;
    const depth = dk.depth || 1.8;
    const dw = dk.w || W - (dk.inset || 0) * 2;
    const deck = box(dw, 0.12, depth, MAT.deck(), (dk.offset || 0), BASE - 0.06, D / 2 + depth / 2);
    deck.material = deck.material.clone?.() || deck.material;
    g.add(deck);
    // 데크 하부 지지목 + 스텝
    g.add(box(dw, 0.16, 0.1, MAT.trim(), dk.offset || 0, BASE - 0.2, D / 2 + depth - 0.05));
    g.add(box(1.4, 0.11, 0.4, MAT.deck(), (dk.stepU != null ? -W / 2 + dk.stepU : 0), BASE - 0.26, D / 2 + depth + 0.2));
  }

  // 환기구 (후면) + 에어컨 실외기
  const vent = box(0.35, 0.22, 0.05, MAT.trim(), W / 2 - 0.6, BASE + H - 0.45, -D / 2 - 0.02);
  g.add(vent);
  // 에어컨 실외기 (후면)
  const ac = new THREE.Group();
  ac.add(box(0.85, 0.6, 0.32, MAT.white(), 0, 0.34, 0));
  const fan = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.02, 20), MAT.trim());
  fan.rotation.x = Math.PI / 2;
  fan.position.set(-0.16, 0.36, 0.17);
  ac.add(fan);
  ac.position.set(-W / 2 + 0.75, 0, -D / 2 - 0.42);
  g.add(ac);

  g.userData.spec = spec;
  return g;
}

// ---------- 모델별 사양 (실측 도면 값으로 교체 예정 — 단위: m) ----------
export const HOUSE_SPECS = {
  stay14: {
    w: 9.0, d: 5.1, wallH: 2.65, finish: "wood", color: 0x6e5138, // 다크 우드
    roof: { type: "flat" },
    door: { side: "front", u: 7.9, w: 1.0, h: 2.1 },
    windows: [
      { side: "front", u: 2.1, w: 2.6, h: 1.9, sill: 0.45, bars: 2 }, // 거실 대형 픽처윈도
      { side: "front", u: 5.2, w: 1.6, h: 1.4, sill: 0.9 },
      { side: "right", u: 2.0, w: 1.2, h: 1.1, sill: 1.0 },
      { side: "back", u: 2.4, w: 1.4, h: 1.1, sill: 1.0 },
      { side: "back", u: 6.4, w: 0.8, h: 0.7, sill: 1.4 }, // 욕실 창
      { side: "left", u: 2.6, w: 1.2, h: 1.1, sill: 1.0 },
    ],
    deck: { depth: 1.8, inset: 0.4, stepU: 7.9 },
  },
};

export default { buildHouse, HOUSE_SPECS };
