// ============ METAHOUSE 하우스 키트 — 파라메트릭 정밀 주택 빌더 ============
// 치수(m)를 넣으면 실제 건축 디테일로 집을 조립한다: 사이딩 요철, 코너 트림,
// 매입 창호(리빌+창틀+유리), 파라펫/박공/외쪽 지붕, 물받이·선홈통, 데크, 현관 캐노피.
// 스캔 GLB보다 지오메트리가 깨끗하고 치수가 정확해 "3D맥스 렌더" 느낌을 낸다.
// 마을(town.js)·빌드룸(build.js) 공용.
//   buildHouse(spec)       — 편집 가능한 부재 트리 (빌드룸 등)
//   buildHouseMerged(spec) — 재질별 병합 메시 (드로우콜 ~12개, 마을 다수 배치용)
import * as THREE from "three";

// ---------- 절차적 텍스처 (캔버스) ----------
const texCache = {};
function canvasTex(key, w, h, srgb, draw) {
  if (texCache[key]) return texCache[key];
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  draw(cv.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  texCache[key] = t;
  return t;
}
function shade(hex, f) {
  const r = Math.min(255, Math.max(0, Math.round(((hex >> 16) & 255) * f)));
  const g = Math.min(255, Math.max(0, Math.round(((hex >> 8) & 255) * f)));
  const b = Math.min(255, Math.max(0, Math.round((hex & 255) * f)));
  return `rgb(${r},${g},${b})`;
}
// 수평 목재 사이딩: 판재 폭 ~15cm, 나뭇결·판재별 톤 편차·이음 그림자
function sidingTexture(baseHex) {
  return canvasTex(`sid_${baseHex}`, 512, 512, true, (c) => {
    const rows = 12, rh = 512 / rows;
    for (let i = 0; i < rows; i++) {
      c.fillStyle = shade(baseHex, 0.9 + ((i * 2654435761) % 100) / 100 * 0.22);
      c.fillRect(0, i * rh, 512, rh);
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
      c.fillStyle = "rgba(0,0,0,0.38)";
      c.fillRect(0, (i + 1) * rh - 3, 512, 3);
      c.fillStyle = "rgba(255,255,255,0.14)";
      c.fillRect(0, i * rh, 512, 1.5);
    }
  });
}
function sidingBump() {
  return canvasTex("sid_bump", 256, 512, false, (c) => {
    const rows = 12, rh = 512 / rows;
    c.fillStyle = "#808080";
    c.fillRect(0, 0, 256, 512);
    for (let i = 0; i < rows; i++) {
      c.fillStyle = "#3a3a3a";
      c.fillRect(0, (i + 1) * rh - 4, 256, 4);
      c.fillStyle = "#a8a8a8";
      c.fillRect(0, i * rh, 256, 2);
    }
  });
}
// 세로 금속 패널 (스탠딩심 지붕/다크 메탈 외장)
function seamTexture(baseHex) {
  return canvasTex(`seam_${baseHex}`, 512, 256, true, (c) => {
    c.fillStyle = shade(baseHex, 1);
    c.fillRect(0, 0, 512, 256);
    const cols = 10, cw = 512 / cols;
    for (let i = 0; i < cols; i++) {
      c.fillStyle = "rgba(255,255,255,0.10)";
      c.fillRect(i * cw, 0, 2.5, 256);
      c.fillStyle = "rgba(0,0,0,0.34)";
      c.fillRect(i * cw + 2.5, 0, 3, 256);
      c.fillStyle = `rgba(255,255,255,${0.015 + (i % 3) * 0.012})`;
      c.fillRect(i * cw + 6, 0, cw - 6, 256);
    }
  });
}
function seamBump() {
  return canvasTex("seam_bump", 512, 64, false, (c) => {
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
  return canvasTex("deck", 512, 512, true, (c) => {
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

// ---------- 재질 세트 (집 1채당 1세트 — 병합 시 재질별 버킷이 되도록 공유) ----------
function makeMaterialSet(spec) {
  const color = spec.color != null ? spec.color : 0x8a6a4c;
  let wall;
  if (spec.finish === "metal") {
    wall = new THREE.MeshStandardMaterial({
      map: seamTexture(color).clone(), bumpMap: seamBump().clone(), bumpScale: 1.6,
      roughness: 0.42, metalness: 0.35, envMapIntensity: 0.9,
    });
  } else {
    wall = new THREE.MeshStandardMaterial({
      map: sidingTexture(color).clone(), bumpMap: sidingBump().clone(), bumpScale: 1.8,
      roughness: 0.72, envMapIntensity: 0.55,
    });
  }
  wall.map.needsUpdate = true;
  wall.bumpMap.needsUpdate = true;
  const doorWood = new THREE.MeshStandardMaterial({
    map: sidingTexture(0x5d4634).clone(), roughness: 0.55, envMapIntensity: 0.5,
  });
  doorWood.map.rotation = Math.PI / 2;
  doorWood.map.center.set(0.5, 0.5);
  doorWood.map.needsUpdate = true;
  return {
    wall,
    doorWood,
    trim: new THREE.MeshStandardMaterial({ color: 0x22252a, roughness: 0.45, metalness: 0.25 }),
    frame: new THREE.MeshStandardMaterial({ color: 0x1c1f24, roughness: 0.32, metalness: 0.55, envMapIntensity: 1.0 }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0x8fb4c4, roughness: 0.06, metalness: 0.1, envMapIntensity: 1.5,
      clearcoat: 1.0, clearcoatRoughness: 0.05, transparent: true, opacity: 0.86,
    }),
    reveal: new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.8 }),
    concrete: new THREE.MeshStandardMaterial({ color: 0x8f9089, roughness: 0.95 }),
    roof: new THREE.MeshStandardMaterial({
      map: seamTexture(spec.roof && spec.roof.color != null ? spec.roof.color : 0x2e3338).clone(),
      bumpMap: seamBump().clone(), bumpScale: 1.4,
      roughness: 0.5, metalness: 0.4, envMapIntensity: 0.8,
    }),
    fascia: new THREE.MeshStandardMaterial({ color: 0x282c31, roughness: 0.5, metalness: 0.2 }),
    deck: new THREE.MeshStandardMaterial({ map: deckTexture(), roughness: 0.7, envMapIntensity: 0.4 }),
    white: new THREE.MeshStandardMaterial({ color: 0xeceae4, roughness: 0.6 }),
    steel: new THREE.MeshStandardMaterial({ color: 0xc9c9c9, roughness: 0.25, metalness: 0.9 }),
    bulb: new THREE.MeshStandardMaterial({ color: 0xfff2cf, emissive: 0xffdf9a, emissiveIntensity: 0.55, roughness: 0.4 }),
  };
}
function box(w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x || 0, y || 0, z || 0);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// ---------- 창호 유닛 ----------
// 벽이 솔리드 박스이므로 요소들을 바깥쪽(+z)으로 살짝 띄우고
// 어두운 리빌 + 프레임 그림자로 매입감을 표현한다.
function makeWindow(M, w, h, opts) {
  const g = new THREE.Group();
  const o = opts || {};
  const F = 0.06;
  g.add(box(w, h, 0.012, M.reveal, 0, 0, 0.008));
  g.add(box(w - F * 2, h - F * 2, 0.012, M.glass, 0, 0, 0.02));
  g.add(box(w, F, 0.05, M.frame, 0, h / 2 - F / 2, 0.032));
  g.add(box(w, F, 0.05, M.frame, 0, -h / 2 + F / 2, 0.032));
  g.add(box(F, h - F * 2, 0.05, M.frame, -w / 2 + F / 2, 0, 0.032));
  g.add(box(F, h - F * 2, 0.05, M.frame, w / 2 - F / 2, 0, 0.032));
  const bars = o.bars != null ? o.bars : w > 1.6 ? 2 : 1;
  for (let i = 1; i <= bars; i++) {
    g.add(box(0.035, h - F * 2, 0.035, M.frame, -w / 2 + (w / (bars + 1)) * i, 0, 0.034));
  }
  g.add(box(w + 0.1, 0.045, 0.12, M.trim, 0, -h / 2 - 0.0225, 0.05)); // 창대(물끊기)
  return g;
}
// 현관문 (패널 + 손잡이 + 캐노피 + 현관등)
function makeDoor(M, w, h, opts) {
  const g = new THREE.Group();
  g.add(box(w + 0.12, h + 0.06, 0.012, M.reveal, 0, 0.03, 0.008));
  g.add(box(w + 0.12, 0.06, 0.06, M.frame, 0, h / 2 + 0.03, 0.03));
  g.add(box(0.06, h + 0.06, 0.06, M.frame, -w / 2 - 0.03, 0.03, 0.03));
  g.add(box(0.06, h + 0.06, 0.06, M.frame, w / 2 + 0.03, 0.03, 0.03));
  g.add(box(w, h, 0.045, M.doorWood, 0, 0, 0.026));
  g.add(box(0.14, h * 0.72, 0.02, M.glass, w / 2 - 0.2, 0.05, 0.052));
  const hd = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.32, 10), M.steel);
  hd.position.set(-w / 2 + 0.12, 0, 0.085);
  g.add(hd);
  if (!opts || opts.canopy !== false) {
    const cn = box(w + 0.7, 0.05, 0.75, M.fascia, 0, h / 2 + 0.22, 0.36);
    cn.rotation.x = -0.06;
    g.add(cn);
    [-1, 1].forEach((s) => {
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.62, 8), M.frame);
      rod.position.set(s * (w / 2 + 0.22), h / 2 + 0.42, 0.4);
      rod.rotation.x = 0.85;
      g.add(rod);
    });
  }
  g.add(box(0.07, 0.16, 0.07, M.frame, w / 2 + 0.35, h * 0.42, 0.045));
  g.add(box(0.05, 0.09, 0.05, M.bulb, w / 2 + 0.35, h * 0.42, 0.05));
  return g;
}

// ---------- 벽면에 개구부 배치 ----------
// side: "front"(+z) "back"(-z) "left"(-x) "right"(+x), u: 벽 좌측단으로부터 중심 위치(m)
function placeOnWall(group, item, W, D, side, u, cy) {
  const HW = W / 2, HD = D / 2;
  if (side === "front") { item.position.set(-HW + u, cy, HD); }
  else if (side === "back") { item.position.set(HW - u, cy, -HD); item.rotation.y = Math.PI; }
  else if (side === "left") { item.position.set(-HW, cy, -HD + u); item.rotation.y = -Math.PI / 2; }
  else { item.position.set(HW, cy, HD - u); item.rotation.y = Math.PI / 2; }
  group.add(item);
}

// ---------- 메인: 주택 조립 ----------
// spec: { w, d, wallH, finish:"wood"|"metal", color,
//         roof:{type:"flat"|"gable"|"mono", h, overhang, color},
//         windows:[{side,u,w,h,sill,bars}], door:{side,u,w,h}, deck:{depth,inset,stepU}, base }
export function buildHouse(spec) {
  const W = spec.w, D = spec.d, H = spec.wallH || 2.7;
  const BASE = spec.base != null ? spec.base : 0.32;
  const M = makeMaterialSet(spec);
  const g = new THREE.Group();

  // 기초
  g.add(box(W - 0.12, BASE, D - 0.12, M.concrete, 0, BASE / 2, 0));
  // 벽체 (텍스처 반복을 실치수에 맞춤)
  M.wall.map.repeat.set(Math.max(1, W / 1.8), Math.max(1, H / 1.8));
  if (M.wall.bumpMap) M.wall.bumpMap.repeat.copy(M.wall.map.repeat);
  g.add(box(W, H, D, M.wall, 0, BASE + H / 2, 0));
  // 하단 물끊기
  g.add(box(W + 0.06, 0.09, D + 0.06, M.trim, 0, BASE + 0.045, 0));
  // 코너 트림
  const CT = 0.09;
  [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([sx, sz]) => {
    g.add(box(CT, H, CT, M.trim, sx * (W / 2 - 0.005), BASE + H / 2, sz * (D / 2 - 0.005)));
  });

  // 창호·현관
  (spec.windows || []).forEach((wd) => {
    const win = makeWindow(M, wd.w, wd.h, wd);
    const sill = wd.sill != null ? wd.sill : 0.9;
    placeOnWall(g, win, W, D, wd.side || "front", wd.u, BASE + sill + wd.h / 2);
  });
  if (spec.door) {
    const dr = makeDoor(M, spec.door.w || 1.0, spec.door.h || 2.1, spec.door);
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
    const rf = new THREE.Mesh(geo, M.roof);
    rf.position.y = topY;
    rf.castShadow = true;
    rf.receiveShadow = true;
    g.add(rf);
    g.add(box(0.12, 0.06, D + OV * 2 + 0.04, M.fascia, 0, topY + RH + 0.01, 0)); // 용마루 캡
    [-1, 1].forEach((s) => g.add(box(W + OV * 2, 0.14, 0.05, M.fascia, 0, topY - 0.02, s * (D / 2 + OV))));
  } else if (roof.type === "mono") {
    const RH = roof.h || 0.5;
    const len = Math.hypot(W + OV * 2, RH);
    const slab = box(len, 0.1, D + OV * 2, M.roof, 0, 0, 0);
    slab.rotation.z = Math.atan2(RH, W + OV * 2);
    slab.position.set(0, topY + RH / 2 + 0.03, 0);
    g.add(slab);
    g.add(box(0.06, 0.24, D + OV * 2, M.fascia, -(W / 2 + OV), topY + 0.02, 0));
    g.add(box(0.06, 0.24, D + OV * 2, M.fascia, W / 2 + OV, topY + RH + 0.02, 0));
  } else {
    // 평지붕: 파라펫 + 두겁 + 지붕판
    const P = 0.32;
    g.add(box(W + 0.08, P, D + 0.08, M.wall, 0, topY + P / 2, 0));
    g.add(box(W + 0.16, 0.05, D + 0.16, M.fascia, 0, topY + P + 0.025, 0));
    g.add(box(W - 0.1, 0.03, D - 0.1, M.roof, 0, topY + P - 0.06, 0));
  }

  // 물받이·선홈통 (경사지붕)
  if (roof.type === "gable" || roof.type === "mono") {
    [-1, 1].forEach((s) => {
      const gutter = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, D + OV * 2, 10, 1, false, 0, Math.PI), M.fascia);
      gutter.rotation.x = Math.PI / 2;
      gutter.rotation.z = Math.PI;
      gutter.position.set(s * (W / 2 + OV), topY - 0.1, 0);
      g.add(gutter);
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, H + BASE - 0.15, 8), M.fascia);
      pipe.position.set(s * (W / 2 + 0.05), (H + BASE) / 2, D / 2 - 0.25);
      g.add(pipe);
    });
  }

  // 데크
  if (spec.deck) {
    const dk = spec.deck;
    const depth = dk.depth || 1.8;
    const dw = dk.w || W - (dk.inset || 0) * 2;
    g.add(box(dw, 0.12, depth, M.deck, dk.offset || 0, BASE - 0.06, D / 2 + depth / 2));
    g.add(box(dw, 0.16, 0.1, M.trim, dk.offset || 0, BASE - 0.2, D / 2 + depth - 0.05));
    g.add(box(1.4, 0.11, 0.4, M.deck, dk.stepU != null ? -W / 2 + dk.stepU : 0, BASE - 0.26, D / 2 + depth + 0.2));
  }

  // 후면 소품: 환기구 + 실외기
  g.add(box(0.35, 0.22, 0.05, M.trim, W / 2 - 0.6, BASE + H - 0.45, -D / 2 - 0.02));
  const ac = new THREE.Group();
  ac.add(box(0.85, 0.6, 0.32, M.white, 0, 0.34, 0));
  const fan = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.02, 20), M.trim);
  fan.rotation.x = Math.PI / 2;
  fan.position.set(-0.16, 0.36, 0.17);
  ac.add(fan);
  ac.position.set(-W / 2 + 0.75, 0, -D / 2 - 0.42);
  g.add(ac);

  g.userData.spec = spec;
  return g;
}

// ---------- 재질별 병합 (드로우콜 절감: ~90개 → 재질 수 ~12개) ----------
export function buildHouseMerged(spec) {
  const src = buildHouse(spec);
  src.updateMatrixWorld(true);
  const buckets = new Map(); // material → geometry[]
  src.traverse((o) => {
    if (!o.isMesh) return;
    const geo = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone());
    geo.applyMatrix4(o.matrixWorld);
    if (!buckets.has(o.material)) buckets.set(o.material, []);
    buckets.get(o.material).push(geo);
  });
  const out = new THREE.Group();
  buckets.forEach((geos, mat) => {
    const total = geos.reduce((s, gg) => s + gg.attributes.position.count, 0);
    const pos = new Float32Array(total * 3);
    const nor = new Float32Array(total * 3);
    const uv = new Float32Array(total * 2);
    let off = 0;
    geos.forEach((gg) => {
      pos.set(gg.attributes.position.array, off * 3);
      nor.set(gg.attributes.normal.array, off * 3);
      if (gg.attributes.uv) uv.set(gg.attributes.uv.array, off * 2);
      off += gg.attributes.position.count;
      gg.dispose();
    });
    const bg = new THREE.BufferGeometry();
    bg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    bg.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
    bg.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    const mesh = new THREE.Mesh(bg, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    out.add(mesh);
  });
  out.userData.spec = spec;
  return out;
}

// ---------- 모델별 사양 (실측 도면 값으로 교체 가능 — 단위: m) ----------
export const HOUSE_SPECS = {
  // 14평 세컨하우스 — 다크 우드 · 평지붕 · 전면 데크
  stay14: {
    w: 9.0, d: 5.1, wallH: 2.65, finish: "wood", color: 0x6e5138,
    roof: { type: "flat" },
    door: { side: "front", u: 7.9, w: 1.0, h: 2.1 },
    windows: [
      { side: "front", u: 2.1, w: 2.6, h: 1.9, sill: 0.45, bars: 2 },
      { side: "front", u: 5.2, w: 1.6, h: 1.4, sill: 0.9 },
      { side: "right", u: 2.0, w: 1.2, h: 1.1, sill: 1.0 },
      { side: "back", u: 2.4, w: 1.4, h: 1.1, sill: 1.0 },
      { side: "back", u: 6.4, w: 0.8, h: 0.7, sill: 1.4 },
      { side: "left", u: 2.6, w: 1.2, h: 1.1, sill: 1.0 },
    ],
    deck: { depth: 1.8, inset: 0.4, stepU: 7.9 },
  },
  // 19평 전원주택 — 웜 브릭 레드 사이딩 · 박공
  "stay-19rb": {
    w: 9.9, d: 6.3, wallH: 2.7, finish: "wood", color: 0x96543e,
    roof: { type: "gable", h: 1.5, color: 0x33373c },
    door: { side: "front", u: 1.2, w: 1.0, h: 2.1 },
    windows: [
      { side: "front", u: 4.2, w: 2.4, h: 1.8, sill: 0.5, bars: 2 },
      { side: "front", u: 7.6, w: 1.6, h: 1.4, sill: 0.9 },
      { side: "right", u: 2.2, w: 1.4, h: 1.2, sill: 0.95 },
      { side: "right", u: 4.6, w: 1.0, h: 1.0, sill: 1.05 },
      { side: "back", u: 3.0, w: 1.6, h: 1.2, sill: 0.95 },
      { side: "left", u: 3.2, w: 1.2, h: 1.1, sill: 1.0 },
    ],
    deck: { depth: 1.6, inset: 0.5, stepU: 1.2 },
  },
  // 24평 전원주택 — 화이트 사이딩 · 박공 · 대형 창
  stay24w: {
    w: 10.8, d: 7.3, wallH: 2.75, finish: "wood", color: 0xe3ddd0,
    roof: { type: "gable", h: 1.7, color: 0x3a3f45 },
    door: { side: "front", u: 9.5, w: 1.05, h: 2.1 },
    windows: [
      { side: "front", u: 2.6, w: 3.0, h: 2.0, sill: 0.4, bars: 3 },
      { side: "front", u: 6.2, w: 2.0, h: 1.6, sill: 0.7, bars: 2 },
      { side: "right", u: 2.4, w: 1.6, h: 1.3, sill: 0.9 },
      { side: "right", u: 5.2, w: 1.2, h: 1.1, sill: 1.0 },
      { side: "back", u: 2.8, w: 1.8, h: 1.3, sill: 0.9, bars: 2 },
      { side: "back", u: 7.6, w: 0.8, h: 0.7, sill: 1.4 },
      { side: "left", u: 3.4, w: 1.6, h: 1.3, sill: 0.9 },
    ],
    deck: { depth: 2.0, inset: 0.6, stepU: 9.5 },
  },
  // 20평 전원주택 — 내추럴 우드 · 박공(레드브라운 지붕)
  stay20r: {
    w: 10.2, d: 6.5, wallH: 2.7, finish: "wood", color: 0x8a6a4c,
    roof: { type: "gable", h: 1.5, color: 0x5a352c },
    door: { side: "front", u: 1.3, w: 1.0, h: 2.1 },
    windows: [
      { side: "front", u: 4.6, w: 2.6, h: 1.8, sill: 0.5, bars: 2 },
      { side: "front", u: 8.2, w: 1.5, h: 1.3, sill: 0.9 },
      { side: "right", u: 2.4, w: 1.4, h: 1.2, sill: 0.95 },
      { side: "back", u: 3.2, w: 1.6, h: 1.2, sill: 0.95 },
      { side: "back", u: 7.4, w: 0.8, h: 0.7, sill: 1.4 },
      { side: "left", u: 3.0, w: 1.2, h: 1.1, sill: 1.0 },
    ],
    deck: { depth: 1.7, inset: 0.5, stepU: 1.3 },
  },
  // 18평 — 블랙 메탈 · 외쪽지붕 (모던)
  "stay18-b": {
    w: 9.6, d: 6.2, wallH: 2.7, finish: "metal", color: 0x33373c,
    roof: { type: "mono", h: 0.7, color: 0x26292e },
    door: { side: "front", u: 8.4, w: 1.0, h: 2.1 },
    windows: [
      { side: "front", u: 2.4, w: 2.8, h: 1.9, sill: 0.45, bars: 2 },
      { side: "front", u: 5.8, w: 1.6, h: 1.4, sill: 0.9 },
      { side: "right", u: 2.2, w: 1.3, h: 1.1, sill: 1.0 },
      { side: "back", u: 3.0, w: 1.5, h: 1.2, sill: 0.95 },
      { side: "left", u: 2.8, w: 1.2, h: 1.1, sill: 1.0 },
    ],
    deck: { depth: 1.8, inset: 0.5, stepU: 8.4 },
  },
  // 9평 체류형 쉼터 — 오크 우드 · 평지붕 · 컴팩트
  cube9o: {
    w: 7.2, d: 4.2, wallH: 2.6, finish: "wood", color: 0x9a7a52,
    roof: { type: "flat" },
    door: { side: "front", u: 6.3, w: 0.95, h: 2.05 },
    windows: [
      { side: "front", u: 2.0, w: 2.2, h: 1.7, sill: 0.5, bars: 2 },
      { side: "front", u: 4.4, w: 1.2, h: 1.2, sill: 0.95 },
      { side: "right", u: 1.8, w: 1.1, h: 1.0, sill: 1.0 },
      { side: "back", u: 2.4, w: 1.2, h: 1.0, sill: 1.05 },
    ],
    deck: { depth: 1.5, inset: 0.3, stepU: 6.3 },
  },
  // 10평 포레스트 — 그린 스테인 우드 · 박공
  forest10g: {
    w: 7.5, d: 4.4, wallH: 2.65, finish: "wood", color: 0x5f7355,
    roof: { type: "gable", h: 1.2, color: 0x33373c },
    door: { side: "front", u: 1.1, w: 0.95, h: 2.05 },
    windows: [
      { side: "front", u: 3.6, w: 2.0, h: 1.6, sill: 0.6, bars: 2 },
      { side: "front", u: 6.2, w: 1.1, h: 1.1, sill: 1.0 },
      { side: "right", u: 1.9, w: 1.1, h: 1.0, sill: 1.0 },
      { side: "back", u: 2.6, w: 1.2, h: 1.0, sill: 1.05 },
    ],
    deck: { depth: 1.5, inset: 0.3, stepU: 1.1 },
  },
  // 10평 포레스트 블랙 — 다크 메탈 · 평지붕
  forest10bb: {
    w: 7.5, d: 4.4, wallH: 2.65, finish: "metal", color: 0x26292e,
    roof: { type: "flat" },
    door: { side: "front", u: 6.6, w: 0.95, h: 2.05 },
    windows: [
      { side: "front", u: 2.2, w: 2.4, h: 1.7, sill: 0.5, bars: 2 },
      { side: "front", u: 4.9, w: 1.1, h: 1.1, sill: 1.0 },
      { side: "left", u: 1.9, w: 1.1, h: 1.0, sill: 1.0 },
      { side: "back", u: 2.6, w: 1.2, h: 1.0, sill: 1.05 },
    ],
    deck: { depth: 1.5, inset: 0.3, stepU: 6.6 },
  },
  // 10평 큐브 화이트 — 화이트 메탈 · 외쪽지붕
  "cube-g-10w": {
    w: 7.5, d: 4.4, wallH: 2.6, finish: "metal", color: 0xd7d7d0,
    roof: { type: "mono", h: 0.55, color: 0x3a3f45 },
    door: { side: "front", u: 1.1, w: 0.95, h: 2.05 },
    windows: [
      { side: "front", u: 3.8, w: 2.2, h: 1.7, sill: 0.5, bars: 2 },
      { side: "front", u: 6.3, w: 1.1, h: 1.1, sill: 1.0 },
      { side: "right", u: 1.9, w: 1.1, h: 1.0, sill: 1.0 },
      { side: "back", u: 2.6, w: 1.2, h: 1.0, sill: 1.05 },
    ],
    deck: { depth: 1.5, inset: 0.3, stepU: 1.1 },
  },
};

export default { buildHouse, buildHouseMerged, HOUSE_SPECS };
