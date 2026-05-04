/**
 * DETERMINISTIC LAYOUT ENGINE
 * 
 * Claude decides WHAT elements to include and their labels.
 * This engine decides WHERE everything goes — calculated from
 * booth dimensions using fixed rules. No AI-guessed coordinates.
 * 
 * Coordinate system (meters):
 *   X: 0 = left edge,  width = right edge
 *   Y: 0 = front (open entry), depth = back wall face
 *   Z: 0 = floor level
 */

import { BoothConfig, BoothElement, CameraScene } from './types';

// ─── Booth Spec — what Claude decides ─────────────────────────────────────────

export interface BoothSpec {
  projectName:      string;
  clientName:       string;
  boothName:        string;
  width:            number;   // meters
  depth:            number;   // meters
  wallHeight:       number;   // meters (default 3.0)
  style:            string;

  // Walls
  hasBackWall:      boolean;
  hasLeftWall:      boolean;
  hasRightWall:     boolean;

  // Back wall pillars
  pillarCount:      number;   // 2, 3, or 4
  pillarLabels:     string[]; // e.g. ["AUDIT ENABLES","AUDIT PROTECTS","AUDIT ANTICIPATES"]
  pillarHasScreens: boolean;

  // Ceiling / top
  hasPergola:       boolean;
  hasHeaderFascia:  boolean;
  headerText:       string;

  // Counters
  hasReceptionDesk: boolean;
  receptionSide:    'left' | 'right' | 'center';
  hasKiosk:         boolean;
  kioskLabel:       string;

  // Seating
  hasSofa:          boolean;
  sofaSide:         'left' | 'right';
  hasBistro:        boolean;
  bistroSide:       'left' | 'right';
  bistroStools:     number;
  hasMeetingTable:  boolean;
  meetingChairs:    number;

  // Side wall content
  leftWallContent:  'identity' | 'screen' | 'plain';
  rightWallContent: 'identity' | 'screen' | 'plain';

  // Special
  hasMashrabiya:    boolean;
  hasOrangeColumns: boolean;
  hasFloorPath:     boolean;
  floorPathSide:    'left' | 'center' | 'right';

  // Landscaping
  palmCount:        number;
  planterCount:     number;

  // Camera overrides (optional)
  customCameraHints?: string;
}

// ─── Layout Constants ──────────────────────────────────────────────────────────

const WT   = 0.14;  // wall thickness (m)
const COL  = 0.18;  // orange column size (m)
const EDGE = 0.20;  // margin from wall inner face to pillar start

// ─── Layout Engine ────────────────────────────────────────────────────────────

export function layoutBooth(spec: BoothSpec): BoothConfig {
  const elements: BoothElement[] = [];
  const W = spec.width;
  const D = spec.depth;
  const H = spec.wallHeight || 3.0;
  let n = 0;
  const id = (prefix: string) => `${prefix}_${++n}`;

  // ── FLOOR ────────────────────────────────────────────────────────────────────
  elements.push({
    id: 'floor', type: 'floor', label: 'Blue_Carpet_Floor',
    position: { x: 0, y: 0, z: 0 },
    dimensions: { width: W, depth: D, height: 0.05 },
  });

  // ── BACK WALL ────────────────────────────────────────────────────────────────
  if (spec.hasBackWall) {
    elements.push({
      id: 'wall_back', type: 'back_wall', label: 'Back_Wall',
      position: { x: 0, y: D - WT, z: 0 },
      dimensions: { width: W, depth: WT, height: H },
    });
  }

  // ── SIDE WALLS ───────────────────────────────────────────────────────────────
  if (spec.hasLeftWall) {
    elements.push({
      id: 'wall_left', type: 'side_wall_left', label: 'Left_Wall',
      position: { x: 0, y: 0, z: 0 },
      dimensions: { width: WT, depth: D, height: H },
    });
  }
  if (spec.hasRightWall) {
    elements.push({
      id: 'wall_right', type: 'side_wall_right', label: 'Right_Wall',
      position: { x: W - WT, y: 0, z: 0 },
      dimensions: { width: WT, depth: D, height: H },
    });
  }

  // ── ORANGE ANCHOR COLUMNS ────────────────────────────────────────────────────
  if (spec.hasOrangeColumns && spec.hasBackWall) {
    const leftX  = spec.hasLeftWall  ? WT : 0;
    const rightX = spec.hasRightWall ? W - WT - COL : W - COL;
    elements.push({
      id: id('col_L'), type: 'display_tower', label: 'Orange_Column_Left',
      position: { x: leftX, y: D - WT - COL, z: 0 },
      dimensions: { width: COL, depth: COL, height: H },
    });
    elements.push({
      id: id('col_R'), type: 'display_tower', label: 'Orange_Column_Right',
      position: { x: rightX, y: D - WT - COL, z: 0 },
      dimensions: { width: COL, depth: COL, height: H },
    });
  }

  // ── HEADER FASCIA — always wall-mounted at top of back wall ──────────────────
  if (spec.hasHeaderFascia && spec.hasBackWall) {
    const fasH   = H * 0.13;           // fascia height = 13% of wall
    const fasZ   = H - fasH;           // sits at top of back wall
    const leftX  = spec.hasLeftWall  ? WT : 0;
    const fasW   = W - leftX - (spec.hasRightWall ? WT : 0);
    elements.push({
      id: id('header'), type: 'header_fascia',
      label: spec.headerText || 'Campaign Header',
      position: { x: leftX, y: D - WT - 0.01, z: fasZ },
      dimensions: { width: fasW, depth: 0.20, height: fasH },
      hasCyanGlow: true, hasBrassTrim: true,
    });
  }

  // ── PILLAR WALLS — evenly distributed across back wall ───────────────────────
  if (spec.pillarCount > 0 && spec.hasBackWall) {
    const leftEdge  = (spec.hasLeftWall  ? WT : 0) + (spec.hasOrangeColumns ? COL : 0) + EDGE;
    const rightEdge = (spec.hasRightWall ? W - WT : W) - (spec.hasOrangeColumns ? COL : 0) - EDGE;
    const available = rightEdge - leftEdge;
    const gapCount  = spec.pillarCount - 1;
    const gapW      = 0.10;
    const pW        = (available - gapCount * gapW) / spec.pillarCount;

    for (let i = 0; i < spec.pillarCount; i++) {
      const px  = leftEdge + i * (pW + gapW);
      const pCx = px + pW / 2;
      const label = spec.pillarLabels[i] ?? `PILLAR ${i + 1}`;

      elements.push({
        id: id('pillar'), type: 'pillar_wall', label,
        position: { x: pCx, y: D - WT - 0.01, z: 0 },
        dimensions: { width: pW, depth: 0.16, height: H * 0.96 },
        hasScreen:  spec.pillarHasScreens,
        screenSize: { width: pW * 0.68, height: H * 0.52 },
        hasCyanGlow: true, hasBrassTrim: true,
      });

      // ── CONSOLE TABLE in front of each pillar ──────────────────────────────
      const tableW = Math.min(pW * 0.85, 1.2);
      const tableD = 0.55;
      const tableY = D - WT - 0.16 - tableD - 0.35; // 35cm gap from wall face
      elements.push({
        id: id('ctable'), type: 'rect_table', label: `Console_Table_${i + 1}`,
        position: { x: pCx - tableW / 2, y: tableY, z: 0 },
        dimensions: { width: tableW, depth: tableD, height: 0.76 },
      });
    }
  }

  // ── LEFT SIDE WALL CONTENT ───────────────────────────────────────────────────
  if (spec.hasLeftWall && spec.leftWallContent !== 'plain') {
    const panH  = H * 0.90;
    const panW  = D * 0.70;
    const panCY = D * 0.40;
    if (spec.leftWallContent === 'screen') {
      elements.push({
        id: id('lwall_scr'), type: 'screen_panel', label: 'Left_Screen_Loop',
        position: { x: WT, y: panCY - panW / 2, z: H * 0.05 },
        dimensions: { width: 0.05, depth: panW, height: panH },
        hasScreen: true, hasCyanGlow: true,
      });
    } else {
      elements.push({
        id: id('lwall_id'), type: 'screen_panel', label: 'Left_Identity_Panel',
        position: { x: WT, y: panCY - panW / 2, z: H * 0.05 },
        dimensions: { width: 0.05, depth: panW, height: panH },
        hasScreen: false, hasCyanGlow: true,
      });
    }
  }

  // ── RIGHT SIDE WALL CONTENT ──────────────────────────────────────────────────
  if (spec.hasRightWall && spec.rightWallContent !== 'plain') {
    const panH  = H * 0.90;
    const panW  = D * 0.70;
    const panCY = D * 0.40;
    elements.push({
      id: id('rwall_scr'), type: 'screen_panel', label: 'Right_Screen_Loop',
      position: { x: W - WT - 0.05, y: panCY - panW / 2, z: H * 0.05 },
      dimensions: { width: 0.05, depth: panW, height: panH },
      hasScreen: true, hasCyanGlow: true,
    });
  }

  // ── CENTRAL KIOSK — center-forward, 40% from back wall ───────────────────────
  if (spec.hasKiosk) {
    const kioX = W / 2;
    const kioY = D * 0.42; // 42% from front = center-forward
    elements.push({
      id: id('kiosk'), type: 'kiosk', label: spec.kioskLabel || 'Interactive_Kiosk',
      position: { x: kioX, y: kioY, z: 0 },
      dimensions: { width: 1.0, depth: 1.0, height: 1.05 },
      hasCyanGlow: true,
    });
  }

  // ── RECEPTION DESK ───────────────────────────────────────────────────────────
  if (spec.hasReceptionDesk) {
    const deskW = 2.0;
    const deskY = D * 0.25;
    let deskX   = W / 2; // center default
    if (spec.receptionSide === 'left')  deskX = (spec.hasLeftWall  ? WT : 0) + deskW / 2 + 0.4;
    if (spec.receptionSide === 'right') deskX = W - (spec.hasRightWall ? WT : 0) - deskW / 2 - 0.4;
    elements.push({
      id: id('reception'), type: 'reception_desk', label: 'Reception_Desk',
      position: { x: deskX, y: deskY, z: 0 },
      dimensions: { width: deskW, depth: 0.65, height: 1.1 },
      hasCyanGlow: true, hasBrassTrim: true,
    });
  }

  // ── BISTRO CORNER ────────────────────────────────────────────────────────────
  if (spec.hasBistro) {
    const isRight  = spec.bistroSide !== 'left';
    const bZoneX   = isRight
      ? W - (spec.hasRightWall ? WT : 0) - 0.5 - 0.80
      : (spec.hasLeftWall ? WT : 0) + 0.5;
    const bZoneY   = D * 0.18; // front quarter
    elements.push({
      id: id('bistro_tbl'), type: 'high_table', label: 'Bistro_Table',
      position: { x: bZoneX, y: bZoneY, z: 0 },
      dimensions: { width: 0.76, depth: 0.76, height: 1.1, radius: 0.38 },
    });
    const stoolAngles = spec.bistroStools === 2 ? [0, 180] : [0, 120, 240];
    stoolAngles.forEach((angle, si) => {
      const rad  = (angle * Math.PI) / 180;
      const sX   = bZoneX + Math.cos(rad) * 0.60;
      const sY   = bZoneY + Math.sin(rad) * 0.60;
      elements.push({
        id: id('stool'), type: 'stool', label: `Bistro_Stool_${si + 1}`,
        position: { x: sX, y: sY, z: 0 },
        dimensions: { width: 0.38, depth: 0.38, height: 0.76, radius: 0.19 },
        hasBrassTrim: true,
      });
    });
  }

  // ── SOFA ─────────────────────────────────────────────────────────────────────
  if (spec.hasSofa) {
    const isRight = spec.sofaSide === 'right';
    const sofaX   = isRight
      ? W - (spec.hasRightWall ? WT : 0) - 0.9 - 1.8
      : (spec.hasLeftWall ? WT : 0) + 0.9;
    const sofaY   = D * 0.28;
    elements.push({
      id: id('sofa'), type: 'sofa', label: 'Lounge_Sofa',
      position: { x: sofaX + 0.9, y: sofaY, z: 0 },
      dimensions: { width: 1.8, depth: 0.72, height: 0.88 },
    });
  }

  // ── MEETING TABLE ─────────────────────────────────────────────────────────────
  if (spec.hasMeetingTable) {
    const mtX = W / 2;
    const mtY = D * 0.30;
    elements.push({
      id: id('meeting_tbl'), type: 'round_table', label: 'Meeting_Table',
      position: { x: mtX, y: mtY, z: 0 },
      dimensions: { width: 1.2, depth: 1.2, height: 0.74, radius: 0.60 },
    });
  }

  // ── PERGOLA ──────────────────────────────────────────────────────────────────
  if (spec.hasPergola) {
    const leftX = spec.hasLeftWall  ? WT + 0.05 : 0.15;
    const pW    = W - leftX - (spec.hasRightWall ? WT + 0.05 : 0.15);
    elements.push({
      id: id('pergola'), type: 'pergola', label: 'Pergola_Ceiling',
      position: { x: leftX, y: D * 0.05, z: H * 0.90 },
      dimensions: { width: pW, depth: D * 0.90, height: H * 0.10 },
      hasCyanGlow: true,
    });
  }

  // ── CYAN FLOOR PATH ───────────────────────────────────────────────────────────
  if (spec.hasFloorPath) {
    const pX = spec.floorPathSide === 'left'  ? W * 0.25
             : spec.floorPathSide === 'right' ? W * 0.75
             : W / 2;
    elements.push({
      id: id('floorpath'), type: 'arch', label: 'Cyan_Floor_Path',
      position: { x: pX - 0.25, y: -2.0, z: 0.001 },
      dimensions: { width: 0.5, depth: 3.5, height: 0.002 },
      hasCyanGlow: true,
    });
  }

  // ── PALM TREES ───────────────────────────────────────────────────────────────
  const palmPositions: Array<[number, number]> = [
    [spec.hasLeftWall ? WT + 0.55 : 0.55, D * 0.20],
    [W - (spec.hasRightWall ? WT : 0) - 0.55, D * 0.20],
    [spec.hasLeftWall ? WT + 0.55 : 0.55, D * 0.55],
    [W - (spec.hasRightWall ? WT : 0) - 0.55, D * 0.55],
  ];
  for (let i = 0; i < Math.min(spec.palmCount, palmPositions.length); i++) {
    const [px, py] = palmPositions[i];
    elements.push({
      id: id('palm'), type: 'palm_tree', label: `Palm_Tree_${i + 1}`,
      position: { x: px, y: py, z: 0 },
      dimensions: { width: 0.48, depth: 0.48, height: 1.7, radius: 0.24 },
    });
  }

  // ── PLANTERS ─────────────────────────────────────────────────────────────────
  const planterPositions: Array<[number, number]> = [
    [spec.hasLeftWall ? WT + 0.35 : 0.35, D * 0.12],
    [spec.hasLeftWall ? WT + 0.80 : 0.80, D * 0.12],
    [W - (spec.hasRightWall ? WT : 0) - 0.35, D * 0.12],
    [W - (spec.hasRightWall ? WT : 0) - 0.80, D * 0.12],
  ];
  for (let i = 0; i < Math.min(spec.planterCount, planterPositions.length); i++) {
    const [px, py] = planterPositions[i];
    elements.push({
      id: id('planter'), type: 'planter', label: `Planter_${i + 1}`,
      position: { x: px, y: py, z: 0 },
      dimensions: { width: 0.40, depth: 0.40, height: 0.38, radius: 0.20 },
    });
  }

  // ── CAMERA SCENES ────────────────────────────────────────────────────────────
  const scenes: CameraScene[] = [
    {
      name: 'Entrance_View',
      eye:    { x: W / 2,       y: -2.5,      z: 1.7 },
      target: { x: W / 2,       y: D * 0.55,  z: 1.4 },
    },
    {
      name: 'Hero_3Quarter',
      eye:    { x: -W * 0.55,   y: -D * 0.55, z: H * 1.5 },
      target: { x: W * 0.55,    y: D * 0.55,  z: 1.1 },
    },
    {
      name: 'Top_Plan',
      eye:    { x: W / 2,       y: D / 2,     z: H * 5 },
      target: { x: W / 2,       y: D / 2,     z: 0 },
    },
  ];

  return {
    projectName: spec.projectName,
    clientName:  spec.clientName,
    boothName:   spec.boothName,
    width:       W,
    depth:       D,
    wallHeight:  H,
    style:       spec.style as 'corporate' | 'luxury' | 'modern' | 'pavilion' | 'organic' | 'industrial',
    openSides:   buildOpenSides(spec) as ('left' | 'right' | 'front' | 'back')[],
    elements,
    scenes,
  };
}

function buildOpenSides(spec: BoothSpec): string[] {
  const open: string[] = [];
  if (!spec.hasBackWall)  open.push('back');
  if (!spec.hasLeftWall)  open.push('left');
  if (!spec.hasRightWall) open.push('right');
  open.push('front'); // always open front
  return open;
}
