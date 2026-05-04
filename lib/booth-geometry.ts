import * as THREE from 'three';
import { BoothConfig, BoothElement } from './types';

// ─── Color Palette (matches SketchUp material names for Twinmotion) ──────────

const C = {
  floor: 0xd2d2d0,
  wall: 0xf8f8f6,
  wallAccent: 0x0c1a30,
  desk: 0xb08848,
  deskTop: 0x1a1c20,
  furniture: 0xc0c0c0,
  sofa: 0x007680,
  wood: 0x4a2a12,
  woodOak: 0xac8a58,
  plant: 0x227838,
  planterPot: 0x262628,
  screen: 0x0e1016,
  screenGlow: 0x00d2e6,
  cyan: 0x00dcd8,
  brass: 0xa88448,
  blackMatte: 0x1a1c20,
  glass: 0xc8dce6,
  white: 0xffffff,
};

// ─── Material Factory ────────────────────────────────────────────────────────

function mat(color: number, opts?: Partial<THREE.MeshStandardMaterialParameters>): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.75,
    metalness: 0.05,
    ...opts,
  });
}

/** Resolve element color: use element.color override if provided, else fallback */
function elColor(el: BoothElement, fallback: number): number {
  if (el.color) {
    const hex = el.color.replace('#', '');
    const parsed = parseInt(hex, 16);
    if (!isNaN(parsed)) return parsed;
  }
  return fallback;
}

const emissiveMat = (color: number, intensity = 0.6) =>
  new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.3 });

// ─── Geometry Helpers ────────────────────────────────────────────────────────

function box(w: number, h: number, d: number, material: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function cylinder(rTop: number, rBot: number, h: number, material: THREE.Material, segments = 32): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, segments), material);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// Position element: BoothConfig pos (x=right, y=back, z=up) → Three.js (x, y=up, z)
function applyTransform(obj: THREE.Object3D, el: BoothElement, yOffset = 0) {
  const p = el.position;
  obj.position.set(p.x, (p.z ?? 0) + yOffset, p.y);
  if (el.rotation) obj.rotation.y = -THREE.MathUtils.degToRad(el.rotation);
}

// ─── Element Builders ────────────────────────────────────────────────────────

function buildFloor(el: BoothElement, config: BoothConfig): THREE.Group {
  const g = new THREE.Group();
  const w = el.dimensions.width ?? config.width;
  const d = el.dimensions.depth ?? config.depth;
  const mesh = box(w, 0.03, d, mat(elColor(el, C.floor)));
  mesh.position.set(w / 2, 0.015, d / 2);
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  g.add(mesh);
  return g;
}

function buildWall(el: BoothElement, config: BoothConfig): THREE.Group {
  const g = new THREE.Group();
  const w = el.dimensions.width ?? 3;
  const h = el.dimensions.height ?? config.wallHeight;
  const t = el.dimensions.thickness ?? 0.15;

  const wall = box(w, h, t, mat(elColor(el, C.wall)));
  wall.position.set(w / 2, h / 2, t / 2);
  g.add(wall);

  if (el.hasScreen && el.screenSize) {
    const sw = el.screenSize.width;
    const sh = el.screenSize.height;
    const scr = box(sw, sh, 0.04, mat(C.screen));
    scr.position.set(w / 2, h * 0.55, -0.01);
    g.add(scr);

    // Screen bezel glow
    const bezel = box(sw + 0.02, sh + 0.02, 0.02, emissiveMat(C.screenGlow, 0.3));
    bezel.position.set(w / 2, h * 0.55, -0.005);
    g.add(bezel);
  }

  if (el.hasCyanGlow) {
    const strip = box(w, 0.025, t + 0.01, emissiveMat(C.cyan, 0.8));
    strip.position.set(w / 2, 0.12, t / 2);
    g.add(strip);
    const strip2 = box(w, 0.025, t + 0.01, emissiveMat(C.cyan, 0.8));
    strip2.position.set(w / 2, h - 0.12, t / 2);
    g.add(strip2);
  }

  if (el.hasBrassTrim) {
    const trim = box(w + 0.02, 0.02, t + 0.04, mat(C.brass, { metalness: 0.7, roughness: 0.25 }));
    trim.position.set(w / 2, h, t / 2);
    g.add(trim);
  }

  applyTransform(g, el);
  return g;
}

function buildCurvedWall(el: BoothElement, config: BoothConfig): THREE.Group {
  const g = new THREE.Group();
  const r = el.dimensions.radius ?? 2;
  const h = el.dimensions.height ?? config.wallHeight;
  const t = el.dimensions.thickness ?? 0.15;
  const arcRad = THREE.MathUtils.degToRad(el.dimensions.arcDeg ?? 180);
  const segments = 48;

  // Outer surface
  const outer = new THREE.Mesh(
    new THREE.CylinderGeometry(r, r, h, segments, 1, true, 0, arcRad),
    mat(C.wall, { side: THREE.DoubleSide })
  );
  outer.position.y = h / 2;
  outer.castShadow = true;
  g.add(outer);

  // Inner surface
  const inner = new THREE.Mesh(
    new THREE.CylinderGeometry(r - t, r - t, h, segments, 1, true, 0, arcRad),
    mat(C.wall, { side: THREE.DoubleSide })
  );
  inner.position.y = h / 2;
  g.add(inner);

  // Top cap
  const capShape = new THREE.Shape();
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * arcRad;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (i === 0) capShape.moveTo(x, z);
    else capShape.lineTo(x, z);
  }
  for (let i = segments; i >= 0; i--) {
    const a = (i / segments) * arcRad;
    capShape.lineTo(Math.cos(a) * (r - t), Math.sin(a) * (r - t));
  }
  capShape.closePath();
  const capGeo = new THREE.ShapeGeometry(capShape);
  const cap = new THREE.Mesh(capGeo, mat(C.wall));
  cap.rotation.x = -Math.PI / 2;
  cap.position.y = h;
  g.add(cap);

  applyTransform(g, el);
  return g;
}

function buildReceptionDesk(el: BoothElement): THREE.Group {
  const g = new THREE.Group();
  const w = el.dimensions.width ?? 2.0;
  const d = el.dimensions.depth ?? 0.65;
  const h = el.dimensions.height ?? 1.05;

  // Main body
  const body = box(w, h - 0.03, d, mat(C.blackMatte));
  body.position.set(0, (h - 0.03) / 2, 0);
  g.add(body);

  // Top surface
  const top = box(w + 0.04, 0.03, d + 0.04, mat(C.woodOak));
  top.position.set(0, h - 0.015, 0);
  g.add(top);

  // Front panel accent
  const front = box(w - 0.1, h * 0.6, 0.02, mat(C.wallAccent));
  front.position.set(0, h * 0.45, -d / 2 - 0.01);
  g.add(front);

  if (el.hasCyanGlow) {
    const strip = box(w - 0.1, 0.02, 0.03, emissiveMat(C.cyan));
    strip.position.set(0, h * 0.15, -d / 2 - 0.015);
    g.add(strip);
  }

  if (el.hasBrassTrim) {
    const trim = box(w + 0.06, 0.015, d + 0.06, mat(C.brass, { metalness: 0.7, roughness: 0.25 }));
    trim.position.set(0, h, 0);
    g.add(trim);
  }

  applyTransform(g, el);
  return g;
}

function buildKiosk(el: BoothElement): THREE.Group {
  const g = new THREE.Group();
  const s = el.dimensions.width ?? 1.0;
  const d = el.dimensions.depth ?? s;
  const h = el.dimensions.height ?? 1.05;

  const body = box(s, h, d, mat(C.blackMatte));
  body.position.set(0, h / 2, 0);
  g.add(body);

  // Screen face
  const scrH = h * 0.35;
  const scrW = s * 0.75;
  const scr = box(scrW, scrH, 0.02, mat(C.screen));
  scr.position.set(0, h * 0.7, -d / 2 - 0.01);
  g.add(scr);

  applyTransform(g, el);
  return g;
}

function buildRoundTable(el: BoothElement): THREE.Group {
  const g = new THREE.Group();
  const r = el.dimensions.radius ?? 0.35;
  const h = el.dimensions.height ?? 0.74;

  // Pedestal
  const ped = cylinder(0.06, 0.08, h - 0.03, mat(C.blackMatte), 16);
  ped.position.y = (h - 0.03) / 2;
  g.add(ped);

  // Base
  const base = cylinder(0.2, 0.2, 0.02, mat(C.blackMatte), 16);
  base.position.y = 0.01;
  g.add(base);

  // Top
  const top = cylinder(r, r, 0.03, mat(C.woodOak), 32);
  top.position.y = h - 0.015;
  g.add(top);

  applyTransform(g, el);
  return g;
}

function buildHighTable(el: BoothElement): THREE.Group {
  const g = new THREE.Group();
  const r = el.dimensions.radius ?? 0.38;
  const h = el.dimensions.height ?? 1.1;

  const ped = cylinder(0.05, 0.07, h - 0.03, mat(C.blackMatte), 12);
  ped.position.y = (h - 0.03) / 2;
  g.add(ped);

  const base = cylinder(0.22, 0.22, 0.015, mat(C.blackMatte), 16);
  base.position.y = 0.0075;
  g.add(base);

  const top = cylinder(r, r, 0.025, mat(C.woodOak), 32);
  top.position.y = h - 0.0125;
  g.add(top);

  applyTransform(g, el);
  return g;
}

function buildStool(el: BoothElement): THREE.Group {
  const g = new THREE.Group();
  const h = el.dimensions.height ?? 0.76;

  // Seat
  const seat = cylinder(0.17, 0.17, 0.04, mat(C.sofa), 24);
  seat.position.y = h;
  g.add(seat);

  // Leg (single center post)
  const leg = cylinder(0.025, 0.025, h - 0.04, mat(C.blackMatte), 8);
  leg.position.y = (h - 0.04) / 2;
  g.add(leg);

  // Footring
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.14, 0.012, 8, 24),
    mat(C.blackMatte)
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = h * 0.35;
  g.add(ring);

  // Base
  const base = cylinder(0.22, 0.22, 0.015, mat(C.blackMatte), 16);
  base.position.y = 0.0075;
  g.add(base);

  applyTransform(g, el);
  return g;
}

function buildChair(el: BoothElement): THREE.Group {
  const g = new THREE.Group();
  const w = el.dimensions.width ?? 0.48;
  const d = el.dimensions.depth ?? 0.48;
  const seatH = 0.45;

  // Seat
  const chairColor = elColor(el, C.furniture);
  const seat = box(w, 0.05, d, mat(chairColor));
  seat.position.set(0, seatH, 0);
  g.add(seat);

  // Back
  const back = box(w, 0.4, 0.04, mat(chairColor));
  back.position.set(0, seatH + 0.22, d / 2 - 0.02);
  g.add(back);

  // 4 legs
  const legMat = mat(C.blackMatte);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([lx, lz]) => {
    const leg = box(0.025, seatH, 0.025, legMat);
    leg.position.set(lx * (w / 2 - 0.04), seatH / 2, lz * (d / 2 - 0.04));
    g.add(leg);
  });

  applyTransform(g, el);
  return g;
}

function buildSofa(el: BoothElement): THREE.Group {
  const g = new THREE.Group();
  const w = el.dimensions.width ?? 1.7;
  const d = el.dimensions.depth ?? 0.72;
  const h = el.dimensions.height ?? 0.75;
  const seatH = 0.40;
  const armW = 0.10;

  // Seat cushion
  const seat = box(w - armW * 2, seatH * 0.35, d - 0.15, mat(C.sofa));
  seat.position.set(0, seatH * 0.82, -0.05);
  g.add(seat);

  // Seat base
  const base = box(w, seatH * 0.6, d, mat(C.blackMatte));
  base.position.set(0, seatH * 0.3, 0);
  g.add(base);

  // Back
  const back = box(w - armW * 2, h - seatH, 0.12, mat(C.sofa));
  back.position.set(0, seatH + (h - seatH) / 2, d / 2 - 0.06);
  g.add(back);

  // Arms
  const armH = h * 0.55;
  const leftArm = box(armW, armH, d, mat(C.sofa));
  leftArm.position.set(-w / 2 + armW / 2, armH / 2, 0);
  g.add(leftArm);

  const rightArm = box(armW, armH, d, mat(C.sofa));
  rightArm.position.set(w / 2 - armW / 2, armH / 2, 0);
  g.add(rightArm);

  applyTransform(g, el);
  return g;
}

function buildScreenPanel(el: BoothElement, config: BoothConfig): THREE.Group {
  const g = new THREE.Group();
  const w = el.dimensions.width ?? 1.5;
  const h = el.dimensions.height ?? config.wallHeight * 0.8;
  const t = el.dimensions.thickness ?? 0.06;

  // Frame
  const frame = box(w, h, t, mat(C.blackMatte));
  frame.position.set(0, h / 2, 0);
  g.add(frame);

  // Screen surface
  const sw = w - 0.06;
  const sh = h - 0.08;
  const scr = box(sw, sh, 0.01, mat(C.screen));
  scr.position.set(0, h / 2 + 0.01, -t / 2 - 0.005);
  g.add(scr);

  applyTransform(g, el);
  return g;
}

function buildPergola(el: BoothElement, config: BoothConfig): THREE.Group {
  const g = new THREE.Group();
  const w = el.dimensions.width ?? config.width;
  const d = el.dimensions.depth ?? config.depth;
  const h = el.dimensions.height ?? 2.8;
  const beamT = 0.08;
  const beamMat = mat(C.wall);

  // Main perimeter beams (4 sides)
  const topFront = box(w, beamT, beamT, beamMat);
  topFront.position.set(w / 2, h, 0);
  g.add(topFront);

  const topBack = box(w, beamT, beamT, beamMat);
  topBack.position.set(w / 2, h, d);
  g.add(topBack);

  const topLeft = box(beamT, beamT, d, beamMat);
  topLeft.position.set(0, h, d / 2);
  g.add(topLeft);

  const topRight = box(beamT, beamT, d, beamMat);
  topRight.position.set(w, h, d / 2);
  g.add(topRight);

  // Cross beams (slats running front-to-back)
  const slats = Math.max(3, Math.floor(w / 0.4));
  for (let i = 0; i < slats; i++) {
    const x = (i + 0.5) * (w / slats);
    const slat = box(0.04, 0.06, d, beamMat);
    slat.position.set(x, h - 0.04, d / 2);
    g.add(slat);
  }

  // 4 support columns at corners
  const colMat = mat(C.wall);
  [[0.05, 0.05], [w - 0.05, 0.05], [0.05, d - 0.05], [w - 0.05, d - 0.05]].forEach(([cx, cz]) => {
    const col = box(0.1, h, 0.1, colMat);
    col.position.set(cx, h / 2, cz);
    g.add(col);
  });

  applyTransform(g, el);
  return g;
}

function buildArch(el: BoothElement, config: BoothConfig): THREE.Group {
  const g = new THREE.Group();
  const w = el.dimensions.width ?? 2.8;
  const h = el.dimensions.height ?? 3.0;
  const t = el.dimensions.thickness ?? 0.15;
  const archMat = mat(C.wall);

  // Two pillars
  const pillarH = h * 0.6;
  const pillarW = 0.2;
  const leftPillar = box(pillarW, pillarH, t, archMat);
  leftPillar.position.set(-w / 2 + pillarW / 2, pillarH / 2, 0);
  g.add(leftPillar);

  const rightPillar = box(pillarW, pillarH, t, archMat);
  rightPillar.position.set(w / 2 - pillarW / 2, pillarH / 2, 0);
  g.add(rightPillar);

  // Arch curve (semicircle on top)
  const archR = (w - pillarW * 2) / 2;
  const archSegments = 24;
  const shape = new THREE.Shape();
  // Outer arc
  for (let i = 0; i <= archSegments; i++) {
    const angle = Math.PI * (i / archSegments);
    shape.lineTo(Math.cos(angle) * archR, Math.sin(angle) * archR);
  }
  // Inner arc
  const innerR = archR - pillarW;
  for (let i = archSegments; i >= 0; i--) {
    const angle = Math.PI * (i / archSegments);
    shape.lineTo(Math.cos(angle) * innerR, Math.sin(angle) * innerR);
  }
  shape.closePath();

  const archGeo = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false });
  const archMesh = new THREE.Mesh(archGeo, archMat);
  archMesh.position.set(0, pillarH, -t / 2);
  archMesh.castShadow = true;
  g.add(archMesh);

  // Header text zone
  if (el.label) {
    const header = box(w * 0.6, 0.3, t + 0.02, mat(C.wallAccent));
    header.position.set(0, h - 0.2, 0);
    g.add(header);
  }

  applyTransform(g, el);
  return g;
}

function buildHeaderFascia(el: BoothElement, config: BoothConfig): THREE.Group {
  const g = new THREE.Group();
  const w = el.dimensions.width ?? config.width;
  const h = el.dimensions.height ?? 0.5;
  const t = el.dimensions.thickness ?? 0.08;
  const mountH = config.wallHeight - h / 2;

  const fascia = box(w, h, t, mat(C.wallAccent));
  fascia.position.set(w / 2, mountH, 0);
  g.add(fascia);

  if (el.hasCyanGlow) {
    const glow = box(w, 0.02, t + 0.02, emissiveMat(C.cyan));
    glow.position.set(w / 2, mountH - h / 2 - 0.01, 0);
    g.add(glow);
  }

  applyTransform(g, el);
  return g;
}

function buildMashrabiya(el: BoothElement, config: BoothConfig): THREE.Group {
  const g = new THREE.Group();
  const w = el.dimensions.width ?? 1.5;
  const h = el.dimensions.height ?? config.wallHeight;
  const t = el.dimensions.thickness ?? 0.06;

  // Back panel
  const panel = box(w, h, t * 0.3, mat(C.wall, { transparent: true, opacity: 0.3 }));
  panel.position.set(0, h / 2, 0);
  g.add(panel);

  // Lattice pattern (simplified grid)
  const cols = Math.floor(w / 0.15);
  const rows = Math.floor(h / 0.15);
  const latticeMat = mat(C.woodOak);

  // Vertical bars
  for (let i = 0; i <= cols; i++) {
    const x = -w / 2 + i * (w / cols);
    const bar = box(0.015, h, t, latticeMat);
    bar.position.set(x, h / 2, 0);
    g.add(bar);
  }

  // Horizontal bars
  for (let i = 0; i <= rows; i++) {
    const y = i * (h / rows);
    const bar = box(w, 0.015, t, latticeMat);
    bar.position.set(0, y, 0);
    g.add(bar);
  }

  applyTransform(g, el);
  return g;
}

function buildDisplayTower(el: BoothElement): THREE.Group {
  const g = new THREE.Group();
  const w = el.dimensions.width ?? 0.6;
  const d = el.dimensions.depth ?? 0.6;
  const h = el.dimensions.height ?? 3.5;

  // Tower body
  const body = box(w, h, d, mat(C.wall));
  body.position.set(0, h / 2, 0);
  g.add(body);

  // Screen panels on 4 sides
  const scrH = h * 0.3;
  const scrW = w * 0.85;
  const scrMat = mat(C.screen);
  [
    [0, 0, -d / 2 - 0.01, 0],
    [0, 0, d / 2 + 0.01, 0],
    [-w / 2 - 0.01, 0, 0, Math.PI / 2],
    [w / 2 + 0.01, 0, 0, Math.PI / 2],
  ].forEach(([x, _y, z, ry]) => {
    const scr = box(scrW, scrH, 0.02, scrMat);
    scr.position.set(x, h * 0.7, z);
    scr.rotation.y = ry;
    g.add(scr);
  });

  // Top cap
  const cap = box(w + 0.06, 0.04, d + 0.06, mat(C.brass, { metalness: 0.7, roughness: 0.25 }));
  cap.position.set(0, h + 0.02, 0);
  g.add(cap);

  applyTransform(g, el);
  return g;
}

function buildPalmTree(el: BoothElement): THREE.Group {
  const g = new THREE.Group();
  const h = el.dimensions.height ?? 1.8;
  const trunkH = h * 0.6;
  const canopyR = h * 0.35;

  // Trunk (tapered cylinder)
  const trunk = cylinder(0.06, 0.09, trunkH, mat(0x8b6b3d, { roughness: 0.9 }), 8);
  trunk.position.y = trunkH / 2;
  g.add(trunk);

  // Canopy (sphere of leaves)
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(canopyR, 12, 8),
    mat(C.plant, { roughness: 0.85 })
  );
  canopy.scale.set(1, 0.6, 1);
  canopy.position.y = trunkH + canopyR * 0.3;
  canopy.castShadow = true;
  g.add(canopy);

  // Planter pot
  const pot = cylinder(0.18, 0.14, 0.3, mat(C.planterPot), 12);
  pot.position.y = 0.15;
  g.add(pot);

  applyTransform(g, el);
  return g;
}

function buildPlanter(el: BoothElement): THREE.Group {
  const g = new THREE.Group();
  const w = el.dimensions.width ?? 0.5;
  const d = el.dimensions.depth ?? w;
  const h = el.dimensions.height ?? 0.4;

  if (el.dimensions.radius) {
    // Round planter
    const r = el.dimensions.radius;
    const pot = cylinder(r, r * 0.85, h, mat(C.planterPot), 16);
    pot.position.y = h / 2;
    g.add(pot);

    // Plants
    const plants = new THREE.Mesh(
      new THREE.SphereGeometry(r * 0.9, 10, 8),
      mat(C.plant, { roughness: 0.9 })
    );
    plants.scale.y = 0.5;
    plants.position.y = h + r * 0.3;
    g.add(plants);
  } else {
    // Rectangular planter
    const pot = box(w, h, d, mat(C.planterPot));
    pot.position.set(0, h / 2, 0);
    g.add(pot);

    const plants = box(w * 0.9, h * 0.4, d * 0.9, mat(C.plant, { roughness: 0.9 }));
    plants.position.set(0, h + h * 0.2, 0);
    g.add(plants);
  }

  applyTransform(g, el);
  return g;
}

function buildCarpet(el: BoothElement): THREE.Group {
  const g = new THREE.Group();
  const w = el.dimensions.width ?? 3;
  const d = el.dimensions.depth ?? 3;
  const h = 0.015;

  const carpet = box(w, h, d, mat(elColor(el, 0xcc1122), { roughness: 0.95, metalness: 0 }));
  carpet.position.set(w / 2, h / 2, d / 2);
  carpet.receiveShadow = true;
  carpet.castShadow = false;
  g.add(carpet);

  applyTransform(g, el);
  return g;
}

function buildStage(el: BoothElement): THREE.Group {
  const g = new THREE.Group();
  const w = el.dimensions.width ?? 4;
  const d = el.dimensions.depth ?? 3;
  const h = el.dimensions.height ?? 0.3;

  const platform = box(w, h, d, mat(elColor(el, 0x2a2a2e)));
  platform.position.set(w / 2, h / 2, d / 2);
  g.add(platform);

  // Front edge strip
  const strip = box(w, 0.02, 0.04, emissiveMat(elColor(el, C.cyan), 0.6));
  strip.position.set(w / 2, h, 0);
  g.add(strip);

  applyTransform(g, el);
  return g;
}

function buildSeatingRow(el: BoothElement): THREE.Group {
  const g = new THREE.Group();
  const count = el.count ?? 6;
  const spacing = 0.55;
  const seatW = 0.42;
  const seatD = 0.42;
  const seatH = 0.45;
  const seatColor = elColor(el, 0xcc2222);

  for (let i = 0; i < count; i++) {
    const x = i * spacing;

    // Seat
    const seat = box(seatW, 0.04, seatD, mat(seatColor));
    seat.position.set(x, seatH, 0);
    g.add(seat);

    // Back
    const back = box(seatW, 0.35, 0.03, mat(seatColor));
    back.position.set(x, seatH + 0.19, seatD / 2 - 0.015);
    g.add(back);

    // Legs (2 per seat, front and back)
    const legMat = mat(C.blackMatte);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([lx, lz]) => {
      const leg = box(0.02, seatH, 0.02, legMat);
      leg.position.set(x + lx * (seatW / 2 - 0.04), seatH / 2, lz * (seatD / 2 - 0.04));
      g.add(leg);
    });
  }

  applyTransform(g, el);
  return g;
}

function buildSignageTower(el: BoothElement): THREE.Group {
  const g = new THREE.Group();
  const w = el.dimensions.width ?? 0.5;
  const d = el.dimensions.depth ?? 0.5;
  const h = el.dimensions.height ?? 4.0;
  const bodyColor = elColor(el, C.wall);

  // Tower body
  const body = box(w, h, d, mat(bodyColor));
  body.position.set(0, h / 2, 0);
  g.add(body);

  // Signage panel at top (wider than body)
  const signW = w * 1.6;
  const signH = h * 0.25;
  const sign = box(signW, signH, 0.04, mat(elColor(el, C.wallAccent)));
  sign.position.set(0, h * 0.85, -d / 2 - 0.02);
  g.add(sign);

  // Glow strip
  const glow = box(signW, 0.02, 0.05, emissiveMat(C.cyan, 0.5));
  glow.position.set(0, h * 0.85 - signH / 2 - 0.01, -d / 2 - 0.025);
  g.add(glow);

  applyTransform(g, el);
  return g;
}

function buildColumn(el: BoothElement): THREE.Group {
  const g = new THREE.Group();
  const r = el.dimensions.radius ?? 0.15;
  const h = el.dimensions.height ?? 3.0;
  const colColor = elColor(el, C.wall);

  const col = cylinder(r, r, h, mat(colColor), 16);
  col.position.y = h / 2;
  g.add(col);

  // Base
  const base = cylinder(r * 1.5, r * 1.5, 0.04, mat(colColor), 16);
  base.position.y = 0.02;
  g.add(base);

  // Capital
  const cap = cylinder(r * 1.4, r * 1.4, 0.03, mat(colColor), 16);
  cap.position.y = h - 0.015;
  g.add(cap);

  applyTransform(g, el);
  return g;
}

function buildPartition(el: BoothElement, config: BoothConfig): THREE.Group {
  const g = new THREE.Group();
  const w = el.dimensions.width ?? 2;
  const h = el.dimensions.height ?? config.wallHeight * 0.5;
  const t = el.dimensions.thickness ?? 0.06;
  const partColor = elColor(el, C.wall);

  const panel = box(w, h, t, mat(partColor));
  panel.position.set(w / 2, h / 2, t / 2);
  g.add(panel);

  applyTransform(g, el);
  return g;
}

function buildCeilingCanopy(el: BoothElement, config: BoothConfig): THREE.Group {
  const g = new THREE.Group();
  const w = el.dimensions.width ?? config.width;
  const d = el.dimensions.depth ?? config.depth;
  const h = el.dimensions.height ?? config.wallHeight;

  const canopy = box(w, 0.04, d, mat(C.wall, { transparent: true, opacity: 0.85 }));
  canopy.position.set(w / 2, h, d / 2);
  canopy.receiveShadow = true;
  g.add(canopy);

  applyTransform(g, el);
  return g;
}

// ─── Main Scene Builder ──────────────────────────────────────────────────────

export function buildBoothScene(config: BoothConfig): THREE.Group {
  const booth = new THREE.Group();
  booth.name = config.boothName || 'Booth';

  for (const el of config.elements) {
    let obj: THREE.Group | null = null;

    switch (el.type) {
      case 'floor':
        obj = buildFloor(el, config);
        break;
      case 'back_wall':
      case 'side_wall_left':
      case 'side_wall_right':
      case 'pillar_wall':
        obj = buildWall(el, config);
        break;
      case 'curved_wall':
        obj = buildCurvedWall(el, config);
        break;
      case 'reception_desk':
        obj = buildReceptionDesk(el);
        break;
      case 'kiosk':
        obj = buildKiosk(el);
        break;
      case 'round_table':
        obj = buildRoundTable(el);
        break;
      case 'high_table':
        obj = buildHighTable(el);
        break;
      case 'stool':
        obj = buildStool(el);
        break;
      case 'chair':
        obj = buildChair(el);
        break;
      case 'sofa':
        obj = buildSofa(el);
        break;
      case 'screen_panel':
        obj = buildScreenPanel(el, config);
        break;
      case 'pergola':
        obj = buildPergola(el, config);
        break;
      case 'arch':
        obj = buildArch(el, config);
        break;
      case 'header_fascia':
        obj = buildHeaderFascia(el, config);
        break;
      case 'mashrabiya_panel':
        obj = buildMashrabiya(el, config);
        break;
      case 'display_tower':
        obj = buildDisplayTower(el);
        break;
      case 'palm_tree':
        obj = buildPalmTree(el);
        break;
      case 'planter':
        obj = buildPlanter(el);
        break;
      case 'ceiling_canopy':
        obj = buildCeilingCanopy(el, config);
        break;
      case 'carpet':
        obj = buildCarpet(el);
        break;
      case 'stage':
        obj = buildStage(el);
        break;
      case 'seating_row':
        obj = buildSeatingRow(el);
        break;
      case 'signage_tower':
        obj = buildSignageTower(el);
        break;
      case 'column':
        obj = buildColumn(el);
        break;
      case 'partition':
        obj = buildPartition(el, config);
        break;
      default:
        // Fallback: generic box
        obj = new THREE.Group();
        const fb = box(
          el.dimensions.width ?? 0.5,
          el.dimensions.height ?? 1.0,
          el.dimensions.depth ?? 0.5,
          mat(C.furniture)
        );
        fb.position.y = (el.dimensions.height ?? 1.0) / 2;
        obj.add(fb);
        applyTransform(obj, el);
    }

    if (obj) {
      obj.name = el.label || el.id;
      booth.add(obj);
    }
  }

  return booth;
}
