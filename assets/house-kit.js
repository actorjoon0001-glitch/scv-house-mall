// ============ METAHOUSE 하우스 키트 — 파라메트릭 정밀 주택 빌더 ============
// 치수(m)를 넣으면 실제 건축 디테일로 집을 조립한다. 카탈로그 실물 사진 기준으로
// 모델별 사양(HOUSE_SPECS)을 작성 — 외장(세로 금속/우드/브릭), 투톤 악센트,
// 커버드 포치(기둥·우드천장·난간), 데크+난간, 평/박공/외쪽 지붕, 중앙 솟은 박공,
// 복층 타워, 파일 기초, 옥상 태양광/실외기까지 지원한다.
//   buildHouse(spec)       — 부재 트리
//   buildHouseMerged(spec) — 재질별 병합 (집 1채당 드로우콜 ~15개, 다수 배치용)
import * as THREE from "three";

// ---------- 절차적 텍스처 ----------
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
// 세로 금속/우드 패널 (512px = 1.8m)
function vertPanelTexture(baseHex, plank) {
  return canvasTex(`vp_${baseHex}_${plank}`, 512, 512, true, (c) => {
    const cols = plank ? 18 : 10; // 우드 루버는 촘촘하게
    const cw = 512 / cols;
    for (let i = 0; i < cols; i++) {
      c.fillStyle = shade(baseHex, 0.9 + ((i * 2654435761) % 100) / 100 * (plank ? 0.24 : 0.1));
      c.fillRect(i * cw, 0, cw, 512);
      if (plank) {
        c.globalAlpha = 0.12;
        for (let g = 0; g < 4; g++) {
          c.strokeStyle = "#000";
          c.beginPath();
          const x = i * cw + 3 + ((i * 31 + g * 47) % (cw - 6));
          c.moveTo(x, 0);
          for (let y = 0; y <= 512; y += 64) c.lineTo(x + Math.sin(y * 0.02 + i) * 1.6, y);
          c.stroke();
        }
        c.globalAlpha = 1;
      }
      c.fillStyle = "rgba(0,0,0,0.36)";
      c.fillRect((i + 1) * cw - 3, 0, 3, 512);
      c.fillStyle = "rgba(255,255,255,0.12)";
      c.fillRect(i * cw, 0, 1.6, 512);
    }
  });
}
function vertPanelBump(plank) {
  return canvasTex(`vpb_${plank}`, 512, 64, false, (c) => {
    const cols = plank ? 18 : 10, cw = 512 / cols;
    c.fillStyle = "#808080";
    c.fillRect(0, 0, 512, 64);
    for (let i = 0; i < cols; i++) {
      c.fillStyle = "#3a3a3a";
      c.fillRect((i + 1) * cw - 3, 0, 3, 64);
      c.fillStyle = "#b0b0b0";
      c.fillRect(i * cw, 0, 2, 64);
    }
  });
}
// 벽돌 (512px = 1.8m → 벽돌 약 22.5×7.5cm)
function brickTexture(baseHex) {
  return canvasTex(`brick_${baseHex}`, 512, 512, true, (c) => {
    c.fillStyle = shade(baseHex, 0.62); // 줄눈
    c.fillRect(0, 0, 512, 512);
    const bw = 64, bh = 21;
    for (let row = 0; row < 512 / bh + 1; row++) {
      const off = row % 2 ? bw / 2 : 0;
      for (let col = -1; col < 512 / bw + 1; col++) {
        const t = 0.82 + (((row * 73 + col * 131) * 2654435761) % 100) / 100 * 0.4;
        c.fillStyle = shade(baseHex, t);
        c.fillRect(col * bw + off + 2, row * bh + 2, bw - 4, bh - 4);
        // 벽돌 표면 얼룩
        c.fillStyle = "rgba(0,0,0,0.08)";
        if ((row + col) % 3 === 0) c.fillRect(col * bw + off + 6, row * bh + 5, bw * 0.4, bh * 0.35);
      }
    }
  });
}
function brickBump() {
  return canvasTex("brick_bump", 256, 256, false, (c) => {
    c.fillStyle = "#909090";
    c.fillRect(0, 0, 256, 256);
    const bw = 32, bh = 10.5;
    c.fillStyle = "#404040";
    for (let row = 0; row < 26; row++) {
      c.fillRect(0, row * bh, 256, 2);
      const off = row % 2 ? bw / 2 : 0;
      for (let col = -1; col < 9; col++) c.fillRect(col * bw + off, row * bh, 2, bh);
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
// 지붕 스탠딩심
function seamTexture(baseHex) {
  return canvasTex(`seam_${baseHex}`, 512, 256, true, (c) => {
    c.fillStyle = shade(baseHex, 1);
    c.fillRect(0, 0, 512, 256);
    const cols = 10, cw = 512 / cols;
    for (let i = 0; i < cols; i++) {
      c.fillStyle = "rgba(255,255,255,0.10)";
      c.fillRect(i * cw, 0, 2.5, 256);
      c.fillStyle = "rgba(0,0,0,0.30)";
      c.fillRect(i * cw + 2.5, 0, 3, 256);
    }
  });
}

// ---------- 재질 ----------
function surfaceMaterial(finish, color) {
  if (finish === "brick") {
    return new THREE.MeshStandardMaterial({
      map: brickTexture(color).clone(), bumpMap: brickBump().clone(), bumpScale: 2.2,
      roughness: 0.88, envMapIntensity: 0.4,
    });
  }
  if (finish === "wood") {
    return new THREE.MeshStandardMaterial({
      map: vertPanelTexture(color, true).clone(), bumpMap: vertPanelBump(true).clone(), bumpScale: 1.6,
      roughness: 0.68, envMapIntensity: 0.5,
    });
  }
  // metal (기본)
  return new THREE.MeshStandardMaterial({
    map: vertPanelTexture(color, false).clone(), bumpMap: vertPanelBump(false).clone(), bumpScale: 1.6,
    roughness: 0.45, metalness: 0.3, envMapIntensity: 0.85,
  });
}
function makeMaterialSet(spec) {
  const wall = surfaceMaterial(spec.finish || "metal", spec.color != null ? spec.color : 0x33373c);
  const woodAccent = surfaceMaterial("wood", 0xb27a3e);
  return {
    wall,
    woodAccent,
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
      roughness: 0.5, metalness: 0.35, envMapIntensity: 0.8,
    }),
    fascia: new THREE.MeshStandardMaterial({ color: 0x282c31, roughness: 0.5, metalness: 0.2 }),
    deck: new THREE.MeshStandardMaterial({ map: deckTexture(), roughness: 0.7, envMapIntensity: 0.4 }),
    white: new THREE.MeshStandardMaterial({ color: 0xeceae4, roughness: 0.6 }),
    steel: new THREE.MeshStandardMaterial({ color: 0xc9c9c9, roughness: 0.25, metalness: 0.9 }),
    bulb: new THREE.MeshStandardMaterial({ color: 0xfff2cf, emissive: 0xffdf9a, emissiveIntensity: 0.55, roughness: 0.4 }),
    solar: new THREE.MeshStandardMaterial({ color: 0x18244a, roughness: 0.25, metalness: 0.6, envMapIntensity: 1.2 }),
    membrane: new THREE.MeshStandardMaterial({ color: 0xdfe2e2, roughness: 0.85 }),
  };
}
function box(w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x || 0, y || 0, z || 0);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// ---------- 부재: 창호 ----------
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
  if (!o.noSill) g.add(box(w + 0.1, 0.045, 0.12, M.trim, 0, -h / 2 - 0.0225, 0.05));
  return g;
}
// 부재: 현관문
function makeDoor(M, w, h, opts) {
  const g = new THREE.Group();
  const o = opts || {};
  g.add(box(w + 0.12, h + 0.06, 0.012, M.reveal, 0, 0.03, 0.008));
  g.add(box(w + 0.12, 0.06, 0.06, M.frame, 0, h / 2 + 0.03, 0.03));
  g.add(box(0.06, h + 0.06, 0.06, M.frame, -w / 2 - 0.03, 0.03, 0.03));
  g.add(box(0.06, h + 0.06, 0.06, M.frame, w / 2 + 0.03, 0.03, 0.03));
  const doorMat = o.dark ? M.fascia : M.woodAccent;
  g.add(box(w, h, 0.045, doorMat, 0, 0, 0.026));
  g.add(box(0.14, h * 0.72, 0.02, M.glass, w / 2 - 0.2, 0.05, 0.052));
  const hd = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.32, 10), M.steel);
  hd.position.set(-w / 2 + 0.12, 0, 0.085);
  g.add(hd);
  if (o.canopy) {
    const cn = box(w + 0.7, 0.05, 0.75, M.fascia, 0, h / 2 + 0.22, 0.36);
    cn.rotation.x = -0.06;
    g.add(cn);
  }
  g.add(box(0.07, 0.16, 0.07, M.frame, w / 2 + 0.35, h * 0.42, 0.045));
  g.add(box(0.05, 0.09, 0.05, M.bulb, w / 2 + 0.35, h * 0.42, 0.05));
  return g;
}
// 부재: 블랙 메탈 난간 (로컬 x축 길이 len, 바닥 y0 기준)
function makeRailing(M, len) {
  const g = new THREE.Group();
  const H = 1.02;
  g.add(box(len, 0.05, 0.05, M.fascia, 0, H, 0)); // 상부 레일
  g.add(box(len, 0.035, 0.035, M.fascia, 0, 0.12, 0)); // 하부 레일
  const nPosts = Math.max(2, Math.round(len / 1.4) + 1);
  for (let i = 0; i < nPosts; i++) {
    g.add(box(0.05, H, 0.05, M.fascia, -len / 2 + (len / (nPosts - 1)) * i, H / 2, 0));
  }
  const nBal = Math.floor(len / 0.15);
  for (let i = 1; i < nBal; i++) {
    g.add(box(0.016, H - 0.17, 0.016, M.fascia, -len / 2 + (len / nBal) * i, (H - 0.17) / 2 + 0.14, 0));
  }
  return g;
}
// 벽면 배치 헬퍼 — side: front(+z) back(-z) left(-x) right(+x), u: 벽 좌측단 기준 중심(m)
function placeOnWall(group, item, W, D, side, u, cy) {
  const HW = W / 2, HD = D / 2;
  if (side === "front") { item.position.set(-HW + u, cy, HD); }
  else if (side === "back") { item.position.set(HW - u, cy, -HD); item.rotation.y = Math.PI; }
  else if (side === "left") { item.position.set(-HW, cy, -HD + u); item.rotation.y = -Math.PI / 2; }
  else { item.position.set(HW, cy, HD - u); item.rotation.y = Math.PI / 2; }
  group.add(item);
}

// ---------- 메인: 주택 조립 ----------
export function buildHouse(spec) {
  const W = spec.w, D = spec.d, H = spec.wallH || 2.7;
  const BASE = spec.base != null ? spec.base : 0.32;
  const M = makeMaterialSet(spec);
  const g = new THREE.Group();
  const topY = BASE + H;

  // 기초: 통기초 또는 파일(피어)
  if (spec.pier) {
    const nx = Math.max(2, Math.round(W / 1.7) + 1);
    for (let i = 0; i < nx; i++) {
      const px = -W / 2 + 0.35 + (W - 0.7) * (i / (nx - 1));
      g.add(box(0.42, BASE, 0.42, M.concrete, px, BASE / 2, D / 2 - 0.35));
      g.add(box(0.42, BASE, 0.42, M.concrete, px, BASE / 2, -D / 2 + 0.35));
    }
    g.add(box(W, 0.14, D, M.fascia, 0, BASE - 0.07, 0)); // 하부 프레임
  } else {
    g.add(box(W - 0.12, BASE, D - 0.12, M.concrete, 0, BASE / 2, 0));
  }

  // 벽체
  M.wall.map.repeat.set(Math.max(1, W / 1.8), Math.max(1, H / 1.8));
  if (M.wall.bumpMap) M.wall.bumpMap.repeat.copy(M.wall.map.repeat);
  g.add(box(W, H, D, M.wall, 0, BASE + H / 2, 0));
  g.add(box(W + 0.06, 0.09, D + 0.06, M.trim, 0, BASE + 0.045, 0)); // 하단 물끊기
  const CT = 0.09;
  [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([sx, sz]) => {
    g.add(box(CT, H, CT, M.trim, sx * (W / 2 - 0.005), BASE + H / 2, sz * (D / 2 - 0.005)));
  });

  // 투톤 악센트 패널 (벽면 위 얇은 오버레이)
  (spec.accents || []).forEach((a) => {
    const mat = surfaceMaterial(a.finish || "wood", a.color != null ? a.color : 0xb27a3e);
    mat.map.repeat.set(Math.max(0.5, a.w / 1.8), Math.max(1, H / 1.8));
    if (mat.bumpMap) mat.bumpMap.repeat.copy(mat.map.repeat);
    const ah = a.h || H;
    const panel = box(a.w, ah, 0.035, mat, 0, 0, 0.018);
    const wrapG = new THREE.Group();
    wrapG.add(panel);
    placeOnWall(g, wrapG, W, D, a.side || "front", a.u + a.w / 2, BASE + (a.sill || 0) + ah / 2);
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

  // 커버드 포치 (전면): 플랫 캐노피 + 우드 천장 + 블랙 기둥 + 데크 + 난간
  if (spec.porch) {
    const p = spec.porch;
    const pw = p.w || W, pd = p.depth || 2.2;
    const px0 = -W / 2 + (p.u || 0) + pw / 2; // 중심 x
    const pg = new THREE.Group();
    // 캐노피 (벽 상단에서 밖으로)
    pg.add(box(pw + 0.1, 0.09, pd + 0.15, M.fascia, 0, H - 0.045, pd / 2));
    const ceil = new THREE.Mesh(new THREE.BoxGeometry(pw, 0.02, pd), M.deck);
    ceil.position.set(0, H - 0.1, pd / 2);
    pg.add(ceil); // 우드 천장
    // 데크 바닥
    pg.add(box(pw, 0.1, pd, M.deck, 0, -0.05, pd / 2));
    // 기둥 (모서리 + 폭 4m 이상이면 중간)
    const postXs = pw > 4.2 ? [-pw / 2 + 0.1, 0, pw / 2 - 0.1] : [-pw / 2 + 0.1, pw / 2 - 0.1];
    postXs.forEach((x) => pg.add(box(0.1, H, 0.1, M.fascia, x, H / 2, pd - 0.1)));
    // 난간 (전면 — 스텝 자리 비움 — + 양측)
    if (p.railing !== false) {
      const gap = p.stepU != null ? p.stepU - (p.u || 0) : pw / 2; // 포치 내 스텝 중심
      const segL = gap - 0.7, segR = pw - gap - 0.7;
      if (segL > 0.5) { const r = makeRailing(M, segL); r.position.set(-pw / 2 + segL / 2, 0, pd - 0.06); pg.add(r); }
      if (segR > 0.5) { const r = makeRailing(M, segR); r.position.set(pw / 2 - segR / 2, 0, pd - 0.06); pg.add(r); }
      [-1, 1].forEach((s) => {
        const r = makeRailing(M, pd - 0.1);
        r.rotation.y = Math.PI / 2;
        r.position.set(s * (pw / 2 - 0.03), 0, pd / 2);
        pg.add(r);
      });
    }
    // 스텝
    const stepX = p.stepU != null ? p.stepU - (p.u || 0) - pw / 2 : 0;
    pg.add(box(1.3, 0.09, 0.38, M.deck, stepX, -0.14, pd + 0.19));
    pg.add(box(1.3, 0.09, 0.38, M.deck, stepX, -0.23, pd + 0.45));
    pg.position.set(px0, BASE, D / 2);
    g.add(pg);
  }

  // 사이드 포치 (박공 본체 옆에 붙는 개방형 포치 — stay14 스타일)
  if (spec.sidePorch) {
    const sp = spec.sidePorch;
    const dir = sp.side === "left" ? -1 : 1;
    const pw = sp.w || 3.4;
    const pg = new THREE.Group();
    // 캐노피 + 우드 천장
    pg.add(box(pw + 0.15, 0.12, D + 0.1, M.fascia, 0, H - 0.06, 0));
    const ceil = new THREE.Mesh(new THREE.BoxGeometry(pw, 0.02, D - 0.1), M.deck);
    ceil.position.set(0, H - 0.13, 0);
    pg.add(ceil);
    // 데크 바닥
    pg.add(box(pw, 0.12, D, M.deck, 0, -0.06, 0));
    // 뒷벽 (본체 마감 연장) + 안쪽 유리 양문
    const bw = box(pw, H, 0.14, M.wall, 0, H / 2, -D / 2 + 0.07);
    pg.add(bw);
    const gl = makeWindow(M, Math.min(2.2, pw - 0.9), 2.05, { bars: 1, noSill: true });
    gl.position.set(0, 1.06, -D / 2 + 0.16);
    pg.add(gl);
    // 기둥 2개 (바깥 모서리)
    pg.add(box(0.1, H, 0.1, M.fascia, dir * (pw / 2 - 0.1), H / 2, D / 2 - 0.1));
    pg.add(box(0.1, H, 0.1, M.fascia, dir * (pw / 2 - 0.1), H / 2, -D / 2 + 0.35));
    // 바깥쪽 난간
    if (sp.railing !== false) {
      const r = makeRailing(M, D - 0.4);
      r.rotation.y = Math.PI / 2;
      r.position.set(dir * (pw / 2 - 0.04), 0, 0);
      pg.add(r);
    }
    pg.position.set(dir * (W / 2 + pw / 2), BASE, 0);
    g.add(pg);
  }

  // 복층 타워 (stay18-b 스타일 — 본체 한쪽 끝의 높은 볼륨)
  if (spec.tower) {
    const t = spec.tower;
    const dir = t.side === "left" ? -1 : 1;
    const tw = t.w || 3.4, th = t.h || H * 2;
    const tMat = surfaceMaterial(t.finish || spec.finish || "metal", t.color != null ? t.color : spec.color);
    tMat.map.repeat.set(Math.max(1, tw / 1.8), Math.max(1, th / 1.8));
    if (tMat.bumpMap) tMat.bumpMap.repeat.copy(tMat.map.repeat);
    const tg = new THREE.Group();
    tg.add(box(tw, th, D, tMat, 0, th / 2, 0));
    tg.add(box(tw + 0.14, 0.3, D + 0.14, M.fascia, 0, th - 0.15, 0)); // 상단 밴드
    tg.add(box(tw - 0.08, 0.04, D - 0.08, M.membrane, 0, th + 0.02, 0));
    // 1층 대형 유리 + 상부 창 3개
    const big = makeWindow(M, tw - 1.0, 2.15, { bars: 1, noSill: true });
    big.position.set(0, 1.35, D / 2);
    tg.add(big);
    for (let i = 0; i < 3; i++) {
      const sw = makeWindow(M, 0.55, 0.95, { bars: 0.0001, noSill: true });
      sw.position.set(-tw / 2 + 0.65 + i * ((tw - 1.3) / 2), th - 1.15, D / 2);
      tg.add(sw);
    }
    tg.position.set(dir * (W / 2 + tw / 2 - 0.01), BASE, 0);
    g.add(tg);
  }

  // 지붕
  const roof = spec.roof || { type: "flat" };
  const OV = roof.overhang != null ? roof.overhang : 0.35;
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
    g.add(box(0.12, 0.06, D + OV * 2 + 0.04, M.fascia, 0, topY + RH + 0.01, 0));
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
    // 평지붕 (멤브레인 + 파라펫 얇은 두겁)
    g.add(box(W + 0.12, 0.2, D + 0.12, M.fascia, 0, topY + 0.1, 0));
    g.add(box(W - 0.06, 0.04, D - 0.06, M.membrane, 0, topY + 0.22, 0));
  }
  // 중앙 솟은 박공 (stay20r 스타일 클리어스토리)
  if (spec.centerGable) {
    const cgSpec = spec.centerGable;
    const cw = cgSpec.w || 3.4, ch = cgSpec.h || 1.15, cd = D * 0.7;
    const cx = cgSpec.u != null ? -W / 2 + cgSpec.u + cw / 2 : 0;
    const cMat = M.wall;
    const cg = new THREE.Group();
    cg.add(box(cw, ch, cd, cMat, 0, ch / 2, 0));
    const shape = new THREE.Shape();
    shape.moveTo(-cw / 2 - 0.25, 0);
    shape.lineTo(cw / 2 + 0.25, 0);
    shape.lineTo(0, Math.min(0.9, cw * 0.22));
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: cd + 0.5, bevelEnabled: false });
    geo.translate(0, 0, -(cd + 0.5) / 2);
    const rf = new THREE.Mesh(geo, M.roof);
    rf.position.y = ch;
    rf.castShadow = true;
    cg.add(rf);
    // 3연창
    for (let i = 0; i < 3; i++) {
      const sw = makeWindow(M, (cw - 0.9) / 3 - 0.12, ch - 0.5, { bars: 0.0001, noSill: true });
      sw.position.set(-cw / 2 + 0.45 + (i + 0.5) * ((cw - 0.9) / 3), ch / 2, cd / 2 + 0.02);
      cg.add(sw);
    }
    cg.position.set(cx, topY + (roof.type === "gable" ? (roof.h || 0.9) * 0.35 : 0), (D - cd) / 2 - 0.0);
    cg.position.z = D / 2 - cd / 2; // 전면 벽과 면 맞춤
    g.add(cg);
  }

  // 물받이·선홈통 (경사지붕)
  if (roof.type === "gable" || roof.type === "mono") {
    [-1, 1].forEach((s) => {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, H + BASE - 0.15, 8), M.fascia);
      pipe.position.set(s * (W / 2 + 0.05), (H + BASE) / 2, D / 2 - 0.25);
      g.add(pipe);
    });
  }

  // 데크 (포치 없는 모델의 개방 데크)
  if (spec.deck) {
    const dk = spec.deck;
    const depth = dk.depth || 1.8;
    const dw = dk.w || W - (dk.inset || 0) * 2;
    const dx = dk.offset || 0;
    g.add(box(dw, 0.12, depth, M.deck, dx, BASE - 0.06, D / 2 + depth / 2));
    g.add(box(dw, 0.16, 0.1, M.trim, dx, BASE - 0.2, D / 2 + depth - 0.05));
    const stepX = dk.stepU != null ? -W / 2 + dk.stepU : dx;
    g.add(box(1.4, 0.11, 0.4, M.deck, stepX, BASE - 0.26, D / 2 + depth + 0.2));
    if (dk.railing) {
      const gap = (dk.stepU != null ? -W / 2 + dk.stepU : dx) - (dx - dw / 2); // 스텝 중심까지
      const segL = gap - 0.75, segR = dw - gap - 0.75;
      if (segL > 0.5) { const r = makeRailing(M, segL); r.position.set(dx - dw / 2 + segL / 2, BASE, D / 2 + depth - 0.05); g.add(r); }
      if (segR > 0.5) { const r = makeRailing(M, segR); r.position.set(dx + dw / 2 - segR / 2, BASE, D / 2 + depth - 0.05); g.add(r); }
      [-1, 1].forEach((s) => {
        const r = makeRailing(M, depth - 0.1);
        r.rotation.y = Math.PI / 2;
        r.position.set(dx + s * (dw / 2 - 0.03), BASE, D / 2 + depth / 2);
        g.add(r);
      });
    }
  }

  // 옥상 설비 (평지붕): 태양광 패널 + 실외기
  if (roof.type !== "gable" && roof.type !== "mono") {
    const ry = topY + 0.24;
    if (roof.solar) {
      const pnl = box(2.6, 0.06, 1.6, M.solar, -W * 0.15, ry + 0.22, 0);
      pnl.rotation.x = -0.24;
      g.add(pnl);
      [[-1.1, 0.6], [1.1, 0.6], [-1.1, -0.6], [1.1, -0.6]].forEach(([lx, lz]) => {
        g.add(box(0.06, 0.3, 0.06, M.fascia, -W * 0.15 + lx, ry + 0.12, lz));
      });
    }
    if (roof.ac) {
      g.add(box(0.8, 0.55, 0.3, M.white, W * 0.22, ry + 0.28, -D * 0.15));
    }
  } else {
    // 후면 실외기
    const ac = new THREE.Group();
    ac.add(box(0.85, 0.6, 0.32, M.white, 0, 0.34, 0));
    const fan = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.02, 20), M.trim);
    fan.rotation.x = Math.PI / 2;
    fan.position.set(-0.16, 0.36, 0.17);
    ac.add(fan);
    ac.position.set(-W / 2 + 0.75, 0, -D / 2 - 0.42);
    g.add(ac);
  }

  g.userData.spec = spec;
  return g;
}

// ---------- 재질별 병합 (드로우콜 절감) ----------
export function buildHouseMerged(spec) {
  const src = buildHouse(spec);
  src.updateMatrixWorld(true);
  const buckets = new Map();
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

// ---------- 모델별 사양 (카탈로그 실물 사진 대조 — 단위: m) ----------
export const HOUSE_SPECS = {
  // STAY14-BK · 10평+포치4평 — 블랙 세로 금속 + 우드 악센트 · 박공 · 우측 개방 포치
  stay14: {
    w: 6.6, d: 5.0, wallH: 2.7, finish: "metal", color: 0x24262a,
    roof: { type: "gable", h: 1.15, color: 0x232528 },
    accents: [
      { side: "front", u: 0.9, w: 2.2, finish: "wood", color: 0xb27a3e },
      { side: "left", u: 1.2, w: 2.4, finish: "wood", color: 0xb27a3e },
    ],
    door: { side: "front", u: 4.4, w: 1.0, h: 2.1, dark: true },
    windows: [
      { side: "front", u: 1.9, w: 1.3, h: 1.1, sill: 0.95 },
      { side: "left", u: 2.4, w: 1.2, h: 1.0, sill: 1.0 },
      { side: "back", u: 2.2, w: 1.4, h: 1.1, sill: 0.95 },
    ],
    sidePorch: { side: "right", w: 3.6, railing: true },
  },
  // STAY19-BK · 19평 — 다크 차콜 + 우드 악센트 · 저경사 박공 · 전면 풀폭 커버드 포치
  "stay-19rb": {
    w: 9.2, d: 5.2, wallH: 2.7, finish: "metal", color: 0x2e3236,
    roof: { type: "gable", h: 0.85, color: 0x232528 },
    accents: [
      { side: "front", u: 3.4, w: 2.6, finish: "wood", color: 0xb9834a },
    ],
    door: { side: "front", u: 3.0, w: 1.0, h: 2.1, dark: true },
    windows: [
      { side: "front", u: 1.4, w: 1.5, h: 1.6, sill: 0.55 },
      { side: "front", u: 5.6, w: 1.7, h: 1.7, sill: 0.45, bars: 1 },
      { side: "front", u: 7.9, w: 1.7, h: 1.7, sill: 0.45, bars: 1 },
      { side: "right", u: 2.1, w: 1.3, h: 1.1, sill: 0.95 },
      { side: "back", u: 2.6, w: 1.5, h: 1.1, sill: 0.95 },
      { side: "back", u: 6.8, w: 0.8, h: 0.7, sill: 1.35 },
    ],
    porch: { u: 0, depth: 2.3, railing: true, stepU: 3.0 },
  },
  // STAY24-WB · 24평 — 화이트+블랙 투톤 세로 금속 · 외쪽 지붕 · 플로팅 데크
  stay24w: {
    w: 10.8, d: 7.3, wallH: 2.85, finish: "metal", color: 0xdfe0da,
    roof: { type: "mono", h: 0.8, color: 0x33373c },
    accents: [
      { side: "front", u: 1.2, w: 4.6, finish: "metal", color: 0x24262a },
    ],
    door: { side: "front", u: 7.2, w: 1.0, h: 2.15, dark: false },
    windows: [
      { side: "front", u: 3.0, w: 3.1, h: 1.35, sill: 0.95, bars: 2 },
      { side: "front", u: 5.6, w: 2.4, h: 2.2, sill: 0.05, bars: 1, noSill: true },
      { side: "front", u: 9.3, w: 1.5, h: 1.25, sill: 0.95 },
      { side: "right", u: 2.6, w: 1.6, h: 1.2, sill: 0.95 },
      { side: "back", u: 3.0, w: 1.8, h: 1.25, sill: 0.95, bars: 2 },
      { side: "back", u: 7.8, w: 0.8, h: 0.7, sill: 1.4 },
      { side: "left", u: 3.4, w: 1.5, h: 1.2, sill: 0.95 },
    ],
    deck: { depth: 2.4, w: 4.2, offset: 0.2, stepU: 5.4 },
  },
  // STAY20-R · 20평 — 레드 브릭 · 차콜 박공 + 중앙 솟은 박공(3연창) · 전면 데크+난간
  stay20r: {
    w: 10.0, d: 6.6, wallH: 2.75, finish: "brick", color: 0x9a4a3c,
    roof: { type: "gable", h: 0.8, color: 0x2b2e33 },
    centerGable: { u: 3.3, w: 3.4, h: 1.2 },
    door: { side: "front", u: 1.5, w: 1.0, h: 2.1, dark: true, canopy: true },
    windows: [
      { side: "front", u: 4.9, w: 2.7, h: 2.15, sill: 0.05, bars: 2, noSill: true },
      { side: "front", u: 8.3, w: 1.9, h: 1.25, sill: 0.95, bars: 2 },
      { side: "left", u: 2.2, w: 1.4, h: 1.1, sill: 1.0 },
      { side: "back", u: 3.0, w: 1.7, h: 1.2, sill: 0.95 },
      { side: "back", u: 7.4, w: 0.8, h: 0.7, sill: 1.4 },
    ],
    deck: { depth: 2.0, inset: 0.15, stepU: 5.0, railing: true },
  },
  // STAY14.5-3-GB · 복층 — 크림 브릭 + 다크브라운 트림 · 좌측 평지붕 윙 + 우측 2층 타워
  "stay18-b": {
    w: 6.4, d: 5.2, wallH: 2.7, finish: "brick", color: 0xcfc0a8,
    roof: { type: "flat" },
    accents: [
      { side: "front", u: 2.4, w: 1.3, finish: "wood", color: 0x8a6038 },
    ],
    door: { side: "front", u: 3.3, w: 0.95, h: 2.05, dark: true },
    windows: [
      { side: "front", u: 1.3, w: 1.4, h: 1.15, sill: 0.9 },
      { side: "front", u: 5.2, w: 1.3, h: 1.15, sill: 0.9 },
      { side: "back", u: 2.6, w: 1.4, h: 1.1, sill: 0.95 },
    ],
    tower: { side: "right", w: 3.4, h: 5.5, finish: "brick", color: 0xcfc0a8 },
    porch: { u: 0, w: 6.4, depth: 1.9, railing: false, stepU: 3.3 },
  },
  // CUBE9-O · 9평 — 그레이 금속 + 오렌지 센터 패널 · 완경사 박공 · 파일 기초
  cube9o: {
    w: 8.4, d: 3.6, wallH: 2.6, finish: "metal", color: 0x6e7276,
    roof: { type: "gable", h: 0.55, color: 0x84888d, overhang: 0.2 },
    pier: true,
    accents: [
      { side: "front", u: 1.7, w: 4.2, finish: "wood", color: 0xe07b20 },
    ],
    door: { side: "front", u: 7.3, w: 0.95, h: 2.05, dark: true },
    windows: [
      { side: "front", u: 3.8, w: 2.2, h: 1.7, sill: 0.5, bars: 1 },
      { side: "left", u: 1.4, w: 1.1, h: 1.0, sill: 1.0 },
      { side: "back", u: 2.6, w: 1.2, h: 1.0, sill: 1.0 },
    ],
    deck: { w: 1.6, offset: 3.1, depth: 0.9, stepU: 7.3 },
  },
  // FOREST10-N · 10평 — 딥 그린 세로 사이딩 · 다크 스탠딩심 박공 · 풀폭 데크+블랙 난간
  forest10g: {
    w: 8.2, d: 4.0, wallH: 2.65, finish: "wood", color: 0x2e4a38,
    roof: { type: "gable", h: 1.0, color: 0x26292d },
    door: { side: "front", u: 3.5, w: 0.95, h: 2.05, dark: false },
    windows: [
      { side: "front", u: 1.6, w: 1.5, h: 0.75, sill: 1.25 },
      { side: "front", u: 5.2, w: 0.9, h: 0.75, sill: 1.25 },
      { side: "front", u: 6.9, w: 1.75, h: 1.95, sill: 0.1, bars: 1, noSill: true },
      { side: "left", u: 1.5, w: 1.1, h: 0.9, sill: 1.05 },
      { side: "back", u: 2.8, w: 1.3, h: 0.95, sill: 1.0 },
    ],
    deck: { depth: 1.9, w: 9.4, offset: 0, stepU: 1.6, railing: true },
  },
  // FOREST10-UB · 10평 — 평지붕(멤브레인+태양광+실외기) · 우드 루버 + 컬러 패널 투톤
  forest10bb: {
    w: 7.6, d: 4.2, wallH: 2.65, finish: "metal", color: 0xb9c4c9,
    roof: { type: "flat", solar: true, ac: true },
    accents: [
      { side: "front", u: 0, w: 1.9, finish: "wood", color: 0xa8703c },
      { side: "front", u: 1.9, w: 2.7, finish: "metal", color: 0x7076c0 },
    ],
    door: { side: "front", u: 5.3, w: 0.95, h: 2.05, dark: true },
    windows: [
      { side: "front", u: 3.3, w: 1.9, h: 1.9, sill: 0.15, bars: 1, noSill: true },
      { side: "left", u: 1.3, w: 1.0, h: 0.8, sill: 1.1 },
      { side: "back", u: 2.6, w: 1.2, h: 0.95, sill: 1.0 },
    ],
    deck: { w: 1.9, offset: -0.5, depth: 0.8, stepU: 3.3 },
  },
  // FOREST-G10-W · 10평 — 화이트 세로 사이딩 · 외쪽(쐐기) · 우측 우드 개방 포치
  "cube-g-10w": {
    w: 6.6, d: 4.0, wallH: 2.7, finish: "metal", color: 0xdcdcd6,
    roof: { type: "mono", h: 0.85, color: 0xd2d2cc, overhang: 0.25 },
    door: { side: "left", u: 1.6, w: 0.95, h: 2.05, dark: true },
    windows: [
      { side: "left", u: 3.0, w: 0.9, h: 1.3, sill: 0.7 },
      { side: "back", u: 2.4, w: 1.3, h: 1.0, sill: 1.0 },
      { side: "front", u: 1.6, w: 1.3, h: 1.2, sill: 0.85 },
    ],
    sidePorch: { side: "right", w: 2.4, railing: false },
  },
  // ===== 2차 커버리지: 카탈로그 전 모델 (실물 사진 대조) =====
  // STAY18-WR · 18평 — 화이트 벽 + 레드브릭 포치부 · 외쪽 다크 지붕 · 좌측 코너 포치
  "stay-18wb": {
    w: 9.4, d: 5.4, wallH: 2.7, finish: "metal", color: 0xdfdcd2,
    roof: { type: "mono", h: 0.55, color: 0x33373c },
    accents: [
      { side: "front", u: 3.7, w: 1.9, finish: "brick", color: 0xa04a34 },
      { side: "front", u: 8.4, w: 1.0, finish: "wood", color: 0x6a5a45 },
    ],
    door: { side: "front", u: 4.6, w: 0.95, h: 2.05 },
    windows: [
      { side: "front", u: 6.6, w: 1.6, h: 1.9, sill: 0.15, bars: 1, noSill: true },
      { side: "front", u: 8.3, w: 1.1, h: 1.9, sill: 0.15, noSill: true },
      { side: "back", u: 3.0, w: 1.5, h: 1.1, sill: 0.95 },
      { side: "right", u: 2.2, w: 1.2, h: 1.0, sill: 1.0 },
    ],
    porch: { u: 0, w: 3.6, depth: 2.1, railing: true, stepU: 1.8 },
  },
  // CUBE-T4-K · 4평 — 네이비 컨테이너 · 평지붕 · 트윈 도어 · 우드 플랫폼
  "cube-4b": {
    w: 5.6, d: 2.4, wallH: 2.5, finish: "metal", color: 0x2b3350,
    roof: { type: "flat" },
    door: { side: "front", u: 1.4, w: 0.9, h: 2.0 },
    windows: [
      { side: "front", u: 4.0, w: 0.9, h: 1.95, sill: 0.05, bars: 0.001, noSill: true },
      { side: "back", u: 2.0, w: 1.0, h: 0.8, sill: 1.1 },
    ],
    deck: { w: 5.6, depth: 1.4, stepU: 1.4 },
  },
  // STAY18-UB · 18평 — 블루그레이 브릭 + 우드 루버 · 외쪽 다크 · 풀폭 커버드 포치
  stay18k: {
    w: 9.4, d: 5.2, wallH: 2.75, finish: "brick", color: 0x8a93a8,
    roof: { type: "mono", h: 0.5, color: 0x33373c },
    accents: [
      { side: "front", u: 3.4, w: 1.4, finish: "wood", color: 0xa8703c, h: 2.75 },
      { side: "front", u: 7.6, w: 1.6, finish: "wood", color: 0xa8703c, h: 1.0, sill: 1.75 },
    ],
    door: { side: "front", u: 6.6, w: 1.0, h: 2.1, dark: true },
    windows: [
      { side: "front", u: 1.8, w: 2.1, h: 2.05, sill: 0.1, bars: 1, noSill: true },
      { side: "front", u: 8.3, w: 1.4, h: 1.3, sill: 0.85 },
      { side: "back", u: 3.0, w: 1.5, h: 1.1, sill: 0.95 },
      { side: "left", u: 2.2, w: 1.2, h: 1.0, sill: 1.0 },
    ],
    porch: { u: 0, depth: 2.2, railing: true, stepU: 6.6 },
  },
  // FOREST10-WB · 10평 — 라이트그레이 패널 + 다크 섹션 · 외쪽 다크 · 랩 데크+난간
  forest10wb: {
    w: 8.2, d: 4.0, wallH: 2.65, finish: "metal", color: 0xd8d8d2,
    roof: { type: "mono", h: 0.45, color: 0x2e3236 },
    accents: [{ side: "front", u: 1.5, w: 2.0, finish: "metal", color: 0x3a3d42 }],
    door: { side: "front", u: 2.5, w: 0.95, h: 2.05, dark: true, canopy: true },
    windows: [
      { side: "front", u: 0.8, w: 0.8, h: 1.0, sill: 0.95 },
      { side: "front", u: 5.6, w: 3.4, h: 1.95, sill: 0.1, bars: 2, noSill: true },
      { side: "back", u: 2.8, w: 1.4, h: 1.0, sill: 1.0 },
    ],
    deck: { depth: 2.0, w: 9.6, stepU: 2.5, railing: true },
  },
  // CUBE10-W · 10평 — 화이트 컨테이너 · 평지붕 · 블랙 개구부
  cube10w: {
    w: 9.0, d: 3.0, wallH: 2.6, finish: "metal", color: 0xe3e1da,
    roof: { type: "flat" },
    pier: true,
    door: { side: "front", u: 2.5, w: 0.95, h: 2.05, dark: true },
    windows: [
      { side: "front", u: 1.1, w: 1.1, h: 0.75, sill: 1.05 },
      { side: "front", u: 4.4, w: 1.5, h: 0.75, sill: 1.05 },
      { side: "front", u: 7.1, w: 2.0, h: 1.95, sill: 0.1, bars: 1, noSill: true },
      { side: "back", u: 2.4, w: 1.2, h: 0.8, sill: 1.05 },
    ],
    deck: { w: 1.6, offset: -2.0, depth: 0.9, stepU: 2.5 },
  },
  // FOREST10-3-WB · 10평+다락3평 — 화이트+우드 루버 · 높은 외쪽 · 상부 클리어스토리
  forest13w: {
    w: 8.0, d: 4.2, wallH: 3.6, finish: "metal", color: 0xe0ddd3,
    roof: { type: "mono", h: 0.8, color: 0x2e3236 },
    accents: [{ side: "front", u: 2.2, w: 2.2, finish: "wood", color: 0x9a6a3c }],
    door: { side: "front", u: 6.8, w: 0.95, h: 2.05, dark: true },
    windows: [
      { side: "front", u: 1.1, w: 1.2, h: 1.1, sill: 0.9 },
      { side: "front", u: 3.3, w: 1.8, h: 2.05, sill: 0.1, bars: 1, noSill: true },
      { side: "front", u: 2.2, w: 1.5, h: 0.7, sill: 2.6, noSill: true },
      { side: "front", u: 5.4, w: 1.1, h: 0.7, sill: 2.6, noSill: true },
      { side: "back", u: 2.8, w: 1.3, h: 1.0, sill: 1.0 },
    ],
    deck: { depth: 1.9, w: 8.6, stepU: 4.0, railing: true },
  },
  // FOREST10-M · 10평 — 세이지 그린 컨테이너 · 평지붕 · 대형 우드 플랫폼
  forest10m: {
    w: 8.4, d: 3.4, wallH: 2.6, finish: "metal", color: 0xa8bf8a,
    roof: { type: "flat" },
    door: { side: "front", u: 6.2, w: 0.9, h: 2.0 },
    windows: [
      { side: "front", u: 1.4, w: 1.3, h: 1.1, sill: 0.85 },
      { side: "front", u: 3.7, w: 2.2, h: 1.95, sill: 0.1, bars: 1, noSill: true },
      { side: "back", u: 2.6, w: 1.2, h: 0.9, sill: 1.0 },
    ],
    deck: { depth: 2.6, w: 10.0, stepU: 4.2 },
  },
  // STAY15-B · 15평 — 우드 루버 + 다크 차콜 · 박공 다크 · 매입 현관
  stay15c: {
    w: 7.8, d: 5.0, wallH: 2.7, finish: "wood", color: 0xbe8a4a,
    roof: { type: "gable", h: 1.0, color: 0x26292d },
    accents: [{ side: "front", u: 0, w: 2.2, finish: "metal", color: 0x33373c }],
    door: { side: "front", u: 1.1, w: 0.95, h: 2.05, dark: true, canopy: true },
    windows: [
      { side: "front", u: 3.3, w: 1.0, h: 1.1, sill: 0.9 },
      { side: "front", u: 5.8, w: 2.2, h: 1.9, sill: 0.3, bars: 1 },
      { side: "left", u: 2.0, w: 1.2, h: 1.0, sill: 1.0 },
      { side: "back", u: 2.8, w: 1.4, h: 1.0, sill: 1.0 },
    ],
    deck: { depth: 1.4, inset: 0.4, stepU: 1.1 },
  },
  // STAY12-6-W · 복층(12+6평) — 크림 화이트 + 우드 악센트 · 박공 · 2단 창
  stay18w: {
    w: 7.6, d: 4.6, wallH: 4.6, finish: "metal", color: 0xe6e2d8,
    roof: { type: "gable", h: 1.1, color: 0x8a8e93 },
    accents: [{ side: "front", u: 5.4, w: 2.2, finish: "wood", color: 0xa8703c }],
    door: { side: "front", u: 6.4, w: 0.95, h: 2.05, dark: true },
    windows: [
      { side: "front", u: 1.3, w: 1.3, h: 1.2, sill: 0.9 },
      { side: "front", u: 3.4, w: 1.5, h: 1.2, sill: 0.9 },
      { side: "front", u: 1.3, w: 1.1, h: 1.0, sill: 3.1 },
      { side: "front", u: 3.4, w: 1.1, h: 1.0, sill: 3.1 },
      { side: "back", u: 2.6, w: 1.4, h: 1.1, sill: 0.95 },
      { side: "back", u: 5.2, w: 1.1, h: 0.9, sill: 3.1 },
    ],
    deck: { depth: 1.6, w: 4.0, offset: 1.6, stepU: 6.4 },
  },
  // FOREST10-4-W · 10평+다락4평 — 화이트 보드앤배튼 · 급경사 박공 · 우드 게이블
  stay10w: {
    w: 6.4, d: 4.6, wallH: 3.4, finish: "wood", color: 0xe3ded2,
    roof: { type: "gable", h: 2.0, color: 0x84888d, overhang: 0.4 },
    accents: [{ side: "right", u: 1.2, w: 2.2, finish: "wood", color: 0xa8703c }],
    door: { side: "right", u: 3.7, w: 0.95, h: 2.05, dark: true },
    windows: [
      { side: "front", u: 2.2, w: 2.0, h: 2.2, sill: 0.15, bars: 1, noSill: true },
      { side: "front", u: 4.6, w: 1.1, h: 1.1, sill: 0.9 },
      { side: "front", u: 3.2, w: 1.4, h: 1.0, sill: 3.0, noSill: true },
      { side: "back", u: 2.4, w: 1.3, h: 1.0, sill: 1.0 },
    ],
    deck: { depth: 1.8, w: 7.6, stepU: 3.2 },
  },
  // FOREST8-W · 8평 — 크림 패널 + 블랙 트림 · 완경사 박공 · 파일 기초
  forest8wb: {
    w: 7.2, d: 3.2, wallH: 2.6, finish: "metal", color: 0xd9d5c9,
    roof: { type: "gable", h: 0.4, color: 0x26292d, overhang: 0.2 },
    pier: true,
    door: { side: "right", u: 1.6, w: 0.95, h: 2.05, dark: true },
    windows: [
      { side: "front", u: 1.8, w: 2.0, h: 1.9, sill: 0.15, bars: 1, noSill: true },
      { side: "front", u: 4.8, w: 1.2, h: 1.0, sill: 1.0 },
      { side: "back", u: 2.4, w: 1.1, h: 0.9, sill: 1.05 },
    ],
  },
  // FOREST9-O · 9평 — 오렌지+그레이 투톤 · 완경사 박공 블랙 · 데크+난간
  forest9o: {
    w: 7.8, d: 3.6, wallH: 2.65, finish: "metal", color: 0x5a6068,
    roof: { type: "gable", h: 0.55, color: 0x26292d, overhang: 0.25 },
    accents: [
      { side: "front", u: 0, w: 1.8, finish: "wood", color: 0xe07b20 },
      { side: "front", u: 3.6, w: 2.0, finish: "wood", color: 0xe07b20 },
      { side: "left", u: 0.8, w: 2.0, finish: "wood", color: 0xe07b20 },
    ],
    door: { side: "front", u: 6.4, w: 0.95, h: 2.05, dark: true },
    windows: [
      { side: "front", u: 2.6, w: 1.5, h: 1.9, sill: 0.2, bars: 1, noSill: true },
      { side: "left", u: 1.6, w: 1.2, h: 1.0, sill: 0.95 },
      { side: "back", u: 2.6, w: 1.2, h: 0.95, sill: 1.0 },
    ],
    deck: { depth: 1.8, w: 8.8, stepU: 6.4, railing: true },
  },
  // FOREST10-WG · 10평 — 화이트+다크 센터 투톤 컨테이너 · 평지붕
  forest10w: {
    w: 8.6, d: 3.4, wallH: 2.65, finish: "metal", color: 0xdedbd2,
    roof: { type: "flat" },
    accents: [{ side: "front", u: 2.6, w: 2.6, finish: "metal", color: 0x4a4e54 }],
    door: { side: "front", u: 3.9, w: 0.95, h: 2.05, dark: true },
    windows: [
      { side: "front", u: 1.3, w: 1.8, h: 1.9, sill: 0.15, bars: 1, noSill: true },
      { side: "front", u: 6.8, w: 1.4, h: 1.1, sill: 0.9 },
      { side: "back", u: 2.8, w: 1.2, h: 0.95, sill: 1.0 },
    ],
    deck: { depth: 1.6, w: 9.2, stepU: 3.9 },
  },
  // STAY16-C · 16평 — 올 다크 차콜 투 매스 · 평지붕 · 중앙 리세스 현관 · 데크+난간
  stay16dg: {
    w: 6.0, d: 5.0, wallH: 2.75, finish: "metal", color: 0x3a3e44,
    roof: { type: "flat" },
    accents: [{ side: "front", u: 4.6, w: 1.4, finish: "wood", color: 0x9a6a3c }],
    door: { side: "front", u: 5.2, w: 0.95, h: 2.1, dark: true },
    windows: [
      { side: "front", u: 1.6, w: 2.2, h: 2.1, sill: 0.1, bars: 1, noSill: true },
      { side: "back", u: 2.6, w: 1.4, h: 1.1, sill: 0.95 },
    ],
    tower: { side: "right", w: 3.6, h: 3.4, finish: "metal", color: 0x33373c },
    deck: { depth: 1.9, w: 9.2, offset: 1.7, stepU: 3.0, railing: true },
  },
  // STAY20-WB · 20평 — 화이트 + 다크브라운 트림 · 박공 + 중앙 3연창 · 랩 데크+난간
  stay20wb: {
    w: 10.0, d: 6.4, wallH: 2.75, finish: "metal", color: 0xe8e5dd,
    roof: { type: "gable", h: 0.85, color: 0xb0b4b8 },
    centerGable: { u: 3.4, w: 3.2, h: 1.1 },
    accents: [{ side: "front", u: 4.2, w: 1.6, finish: "wood", color: 0x6a4a30 }],
    door: { side: "front", u: 5.0, w: 1.0, h: 2.1, dark: true },
    windows: [
      { side: "front", u: 1.8, w: 2.3, h: 2.1, sill: 0.1, bars: 1, noSill: true },
      { side: "front", u: 8.1, w: 2.0, h: 1.3, sill: 0.9, bars: 2 },
      { side: "left", u: 2.2, w: 1.4, h: 1.1, sill: 0.95 },
      { side: "back", u: 3.0, w: 1.6, h: 1.2, sill: 0.95 },
    ],
    deck: { depth: 2.0, w: 11.4, stepU: 5.0, railing: true },
  },
  // STAY19-WB · 19평 — 화이트 + 다크브라운 양끝 · 외쪽 다크 · 좌측 개방 포치
  stay19wb: {
    w: 8.4, d: 5.2, wallH: 2.75, finish: "metal", color: 0xe4e1d8,
    roof: { type: "mono", h: 0.4, color: 0x33373c },
    accents: [{ side: "front", u: 7.2, w: 1.2, finish: "wood", color: 0x5a4634 }],
    door: { side: "front", u: 7.7, w: 0.95, h: 2.05, dark: true },
    windows: [
      { side: "front", u: 1.7, w: 2.6, h: 2.05, sill: 0.1, bars: 2, noSill: true },
      { side: "front", u: 4.8, w: 1.9, h: 1.5, sill: 0.6, bars: 1 },
      { side: "back", u: 2.8, w: 1.5, h: 1.1, sill: 0.95 },
    ],
    sidePorch: { side: "left", w: 2.8, railing: false },
  },
  // CUBE-H4-O · 4평+포치2평 — 우드 + 블랙 트림 · 평지붕 오버행 · 전면 포치
  "cube-h4o": {
    w: 3.4, d: 2.6, wallH: 2.55, finish: "wood", color: 0xb27a3e,
    roof: { type: "flat" },
    door: { side: "front", u: 1.7, w: 0.9, h: 2.0, dark: true },
    windows: [
      { side: "left", u: 1.0, w: 1.0, h: 0.9, sill: 1.0 },
      { side: "back", u: 1.3, w: 1.0, h: 0.8, sill: 1.05 },
    ],
    porch: { u: 0, w: 3.4, depth: 1.7, railing: true, stepU: 1.7 },
  },
  // FOREST10-3-E · 13평 — 크림+그레이 투 매스(다락 타워) · 데크+난간
  forest13: {
    w: 4.8, d: 4.4, wallH: 2.6, finish: "metal", color: 0xe0ddd3,
    roof: { type: "mono", h: 0.45, color: 0x8a8e93 },
    accents: [{ side: "front", u: 0.4, w: 1.6, finish: "metal", color: 0x9a9ea4 }],
    door: { side: "front", u: 3.4, w: 0.95, h: 2.05, dark: true },
    windows: [{ side: "front", u: 1.4, w: 1.6, h: 1.3, sill: 0.7, bars: 1 }],
    tower: { side: "right", w: 3.6, h: 4.3, finish: "metal", color: 0xe0ddd3 },
    deck: { depth: 1.8, w: 8.8, offset: 1.6, stepU: 2.4, railing: true },
  },
  // STAY15-BK · 15평 — 다크 차콜 + 우드 · 완경사 박공 · 풀폭 커버드 포치 + 랩 데크
  stay15w: {
    w: 8.6, d: 5.0, wallH: 2.7, finish: "metal", color: 0x2b2e33,
    roof: { type: "gable", h: 0.55, color: 0x232528 },
    accents: [{ side: "front", u: 4.6, w: 2.4, finish: "wood", color: 0xb27a3e }],
    door: { side: "front", u: 4.0, w: 1.0, h: 2.1, dark: true },
    windows: [
      { side: "front", u: 1.6, w: 2.2, h: 1.9, sill: 0.25, bars: 1 },
      { side: "front", u: 6.9, w: 1.6, h: 1.5, sill: 0.6 },
      { side: "back", u: 2.8, w: 1.5, h: 1.1, sill: 0.95 },
    ],
    porch: { u: 0, depth: 2.3, railing: true, stepU: 6.6 },
  },
  // STAY20-4-BW · 2층(20평+포치4평) — 블랙+화이트 투톤 · 외쪽 · 2단 창
  stay24wb: {
    w: 7.4, d: 5.4, wallH: 5.4, finish: "metal", color: 0x2b2e33,
    roof: { type: "mono", h: 0.4, color: 0x26292d },
    accents: [
      { side: "front", u: 0, w: 2.6, finish: "metal", color: 0xe6e3da, h: 2.7 },
      { side: "front", u: 0, w: 2.0, finish: "metal", color: 0xe6e3da, h: 2.7, sill: 2.7 },
    ],
    door: { side: "front", u: 3.5, w: 0.95, h: 2.1, dark: false },
    windows: [
      { side: "front", u: 1.3, w: 1.9, h: 2.05, sill: 0.15, bars: 1, noSill: true },
      { side: "front", u: 5.6, w: 1.6, h: 1.2, sill: 0.9 },
      { side: "front", u: 5.2, w: 1.7, h: 1.2, sill: 3.4, noSill: true },
      { side: "front", u: 2.9, w: 1.3, h: 1.2, sill: 3.4, noSill: true },
      { side: "back", u: 2.6, w: 1.5, h: 1.1, sill: 0.95 },
      { side: "back", u: 4.8, w: 1.3, h: 1.1, sill: 3.4 },
    ],
    deck: { depth: 1.6, w: 4.6, offset: -1.2, stepU: 3.5 },
  },
  // STAY10-6-W · 복층(10+6평) — 화이트 보드앤배튼 + 다크 1층 악센트 · 박공
  stay16w: {
    w: 6.2, d: 4.8, wallH: 4.8, finish: "wood", color: 0xe3ded2,
    roof: { type: "gable", h: 1.3, color: 0x33373c },
    accents: [{ side: "front", u: 0, w: 3.0, finish: "metal", color: 0x33373c, h: 2.6 }],
    door: { side: "right", u: 3.4, w: 0.95, h: 2.05, dark: true },
    windows: [
      { side: "front", u: 1.5, w: 2.4, h: 2.2, sill: 0.15, bars: 2, noSill: true },
      { side: "front", u: 4.7, w: 1.2, h: 1.2, sill: 0.9 },
      { side: "front", u: 4.4, w: 1.4, h: 1.2, sill: 3.2, noSill: true },
      { side: "back", u: 2.4, w: 1.4, h: 1.1, sill: 0.95 },
      { side: "back", u: 4.4, w: 1.2, h: 1.0, sill: 3.2 },
    ],
    deck: { depth: 1.5, w: 3.6, offset: 1.2, stepU: 4.6 },
  },
  // STAY13-W · 13평 — 화이트 + 다크 도어 섹션 · 블랙 모임지붕(근사) · 저상 데크
  stay13w: {
    w: 7.6, d: 5.0, wallH: 2.7, finish: "brick", color: 0xe8e4dc,
    roof: { type: "gable", h: 0.75, color: 0x26292d, overhang: 0.55 },
    accents: [{ side: "front", u: 2.6, w: 1.7, finish: "wood", color: 0x4a4440 }],
    door: { side: "front", u: 3.4, w: 0.95, h: 2.1, dark: true },
    windows: [
      { side: "front", u: 1.4, w: 1.1, h: 0.95, sill: 1.05 },
      { side: "front", u: 5.9, w: 1.7, h: 1.2, sill: 0.9, bars: 1 },
      { side: "back", u: 2.8, w: 1.4, h: 1.0, sill: 1.0 },
    ],
    deck: { depth: 1.7, w: 8.6, stepU: 3.4 },
  },
  // STAY19-R · 19평 — 레드 브릭 · 브라운 박공 · 풀폭 커버드 포치
  stay19rb: {
    w: 9.4, d: 5.4, wallH: 2.7, finish: "brick", color: 0x8f4a38,
    roof: { type: "gable", h: 1.0, color: 0x5a4232 },
    door: { side: "front", u: 1.3, w: 1.0, h: 2.1 },
    windows: [
      { side: "front", u: 3.3, w: 1.1, h: 1.3, sill: 0.8 },
      { side: "front", u: 5.4, w: 1.5, h: 2.05, sill: 0.1, bars: 1, noSill: true },
      { side: "front", u: 7.6, w: 1.5, h: 2.05, sill: 0.1, bars: 1, noSill: true },
      { side: "left", u: 2.2, w: 1.3, h: 1.1, sill: 0.95 },
      { side: "back", u: 3.0, w: 1.5, h: 1.1, sill: 0.95 },
    ],
    porch: { u: 0, depth: 2.4, railing: true, stepU: 7.0 },
  },
  // STAY13-B · 13평 — 다크브라운 우드 루버 · 평지붕 · 좌측 개방 포치
  stay12b: {
    w: 7.0, d: 4.8, wallH: 2.7, finish: "wood", color: 0x6a4e36,
    roof: { type: "flat" },
    door: { side: "front", u: 1.1, w: 0.95, h: 2.05, dark: true },
    windows: [
      { side: "front", u: 4.6, w: 2.5, h: 2.1, sill: 0.1, bars: 1, noSill: true },
      { side: "right", u: 2.0, w: 0.9, h: 0.9, sill: 1.6 },
      { side: "back", u: 2.6, w: 1.4, h: 1.0, sill: 1.0 },
    ],
    sidePorch: { side: "left", w: 3.2, railing: true },
  },
};
// 동일 외형 변형 슬러그 (사진이 같은 계열 — 사양 공유)
HOUSE_SPECS.forest10ww = HOUSE_SPECS.forest10w;
HOUSE_SPECS.forest10wwww = HOUSE_SPECS.forest10w;
HOUSE_SPECS.forest10w01 = HOUSE_SPECS.forest10w;
HOUSE_SPECS.forest10wbb = HOUSE_SPECS.forest10wb;
HOUSE_SPECS.forest10www = HOUSE_SPECS.forest13w;

export default { buildHouse, buildHouseMerged, HOUSE_SPECS };
