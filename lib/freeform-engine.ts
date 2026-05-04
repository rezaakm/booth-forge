import { BoothConfig, BoothElement, CameraScene } from './types';

// ─── Free-Form Spec ──────────────────────────────────────────────────────────

export type FreeFormType =
  | 'radial_sunburst'
  | 'circular_rotunda'
  | 'curved_wave'
  | 'amphitheatre'
  | 'hybrid_radial';

export interface FurniturePlacement {
  type: 'table' | 'sofa' | 'kiosk' | 'planter';
  angleDeg: number;
  radiusFromCenter: number;
}

export interface FreeFormSpec {
  projectName: string;
  clientName: string;
  boothName: string;
  width: number;
  depth: number;
  height: number;
  formType: FreeFormType;
  centerX: number;
  centerY: number;
  // Radial fins (sunburst)
  hasRadialFins: boolean;
  finCount: number;
  finStartAngleDeg: number;
  finSweepDeg: number;
  finInnerRadius: number;
  finOuterRadius: number;
  finHeight: number;
  finThickness: number;
  finTaper: 'none' | 'outward' | 'inward';
  // Central rotunda
  hasCentralRotunda: boolean;
  rotundaRadius: number;
  rotundaHeight: number;
  rotundaSegments: number;
  rotundaHasOpening: boolean;
  rotundaOpeningAngleDeg: number;
  // Floor disc
  hasFloorDisc: boolean;
  floorDiscRadius: number;
  // Furniture
  furniturePlacements: FurniturePlacement[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function deg2rad(deg: number): number {
  return deg * Math.PI / 180;
}

function polarToCart(cx: number, cy: number, radius: number, angleDeg: number): { x: number; y: number } {
  const rad = deg2rad(angleDeg);
  return {
    x: cx + radius * Math.cos(rad),
    y: cy + radius * Math.sin(rad),
  };
}

let idCounter = 0;
function id(prefix: string): string {
  return `${prefix}_${++idCounter}`;
}

// ─── Builder ─────────────────────────────────────────────────────────────────

export function buildFreeFormBooth(spec: FreeFormSpec): BoothConfig {
  idCounter = 0;
  const elements: BoothElement[] = [];
  const cx = spec.centerX;
  const cy = spec.centerY;

  // ── Floor disc ─────────────────────────────────────────────────────────────
  if (spec.hasFloorDisc) {
    elements.push({
      id: id('floor_disc'),
      type: 'custom_box' as const, // floor_disc
      label: 'Floor_Disc',
      position: { x: cx, y: cy, z: -0.05 },
      dimensions: { radius: spec.floorDiscRadius, height: 0.05 },
    });
  }

  // ── Radial fins (sunburst) ─────────────────────────────────────────────────
  if (spec.hasRadialFins && spec.finCount > 0) {
    const angleStep = spec.finSweepDeg / spec.finCount;
    for (let i = 0; i < spec.finCount; i++) {
      const angleDeg = spec.finStartAngleDeg + angleStep * i + angleStep / 2;
      const midRadius = (spec.finInnerRadius + spec.finOuterRadius) / 2;
      const finLength = spec.finOuterRadius - spec.finInnerRadius;
      const pos = polarToCart(cx, cy, midRadius, angleDeg);

      // Width varies based on taper
      let finW = spec.finThickness;
      if (spec.finTaper === 'outward') finW *= 1.5;
      if (spec.finTaper === 'inward') finW *= 0.7;

      elements.push({
        id: id('fin'),
        type: 'custom_box' as const, // rotated_box
        label: `Fin_${i + 1}`,
        position: { x: pos.x, y: pos.y, z: 0 },
        dimensions: {
          width: finW,
          depth: finLength,
          height: spec.finHeight,
        },
        rotation: angleDeg,
      });
    }
  }

  // ── Central rotunda (curved LED wall segments) ─────────────────────────────
  if (spec.hasCentralRotunda) {
    const segCount = spec.rotundaSegments;
    const totalArc = spec.rotundaHasOpening
      ? 360 - spec.rotundaOpeningAngleDeg
      : 360;
    const startAngle = spec.rotundaHasOpening ? spec.rotundaOpeningAngleDeg / 2 : 0;
    const segArc = totalArc / segCount;

    for (let i = 0; i < segCount; i++) {
      const segStart = startAngle + segArc * i;
      const segMid = segStart + segArc / 2;
      const pos = polarToCart(cx, cy, spec.rotundaRadius, segMid);

      elements.push({
        id: id('rotunda_seg'),
        type: 'curved_wall' as const, // rotunda_segment
        label: `Rotunda_Seg_${i + 1}`,
        position: { x: pos.x, y: pos.y, z: 0 },
        dimensions: {
          radius: spec.rotundaRadius,
          arcDeg: segArc,
          height: spec.rotundaHeight,
          thickness: 0.08,
        },
        rotation: segStart,
        hasScreen: true,
        hasCyanGlow: true,
      });
    }

    // Rotunda top ring
    elements.push({
      id: id('rotunda_ring'),
      type: 'curved_wall',
      label: 'Rotunda_TopRing',
      position: { x: cx, y: cy, z: spec.rotundaHeight },
      dimensions: {
        radius: spec.rotundaRadius,
        arcDeg: totalArc,
        height: 0.12,
        thickness: 0.15,
      },
      rotation: startAngle,
      hasBrassTrim: true,
    });
  }

  // ── Furniture placements ───────────────────────────────────────────────────
  for (const fp of spec.furniturePlacements) {
    const pos = polarToCart(cx, cy, fp.radiusFromCenter, fp.angleDeg);
    switch (fp.type) {
      case 'table':
        elements.push({
          id: id('ftable'),
          type: 'round_table',
          label: `Table_${fp.angleDeg}deg`,
          position: { x: pos.x, y: pos.y, z: 0 },
          dimensions: { radius: 0.4, height: 0.76 },
        });
        break;
      case 'sofa':
        elements.push({
          id: id('fsofa'),
          type: 'sofa',
          label: `Sofa_${fp.angleDeg}deg`,
          position: { x: pos.x, y: pos.y, z: 0 },
          dimensions: { width: 1.8, depth: 0.72 },
          rotation: fp.angleDeg + 180, // face inward
        });
        break;
      case 'kiosk':
        elements.push({
          id: id('fkiosk'),
          type: 'kiosk',
          label: `Kiosk_${fp.angleDeg}deg`,
          position: { x: pos.x, y: pos.y, z: 0 },
          dimensions: { width: 1.0, height: 1.05 },
        });
        break;
      case 'planter':
        elements.push({
          id: id('fplanter'),
          type: 'planter',
          label: `Planter_${fp.angleDeg}deg`,
          position: { x: pos.x, y: pos.y, z: 0 },
          dimensions: { radius: 0.25, height: 0.45 },
        });
        break;
    }
  }

  // ── Camera scenes ──────────────────────────────────────────────────────────
  const scenes: CameraScene[] = [
    {
      name: 'Overview_Aerial',
      eye: { x: cx, y: cy - spec.width * 0.8, z: spec.height * 2.5 },
      target: { x: cx, y: cy, z: spec.height * 0.4 },
    },
    {
      name: 'Front_Perspective',
      eye: { x: cx - spec.width * 0.6, y: cy - spec.depth * 0.7, z: 1.7 },
      target: { x: cx, y: cy, z: spec.height * 0.5 },
    },
    {
      name: 'Interior_View',
      eye: { x: cx, y: cy, z: 1.6 },
      target: { x: cx + spec.width * 0.3, y: cy + spec.depth * 0.3, z: spec.height * 0.6 },
    },
  ];

  return {
    projectName: spec.projectName,
    clientName: spec.clientName,
    boothName: spec.boothName,
    width: spec.width,
    depth: spec.depth,
    wallHeight: spec.height,
    style: 'pavilion',
    openSides: ['front', 'left', 'right'],
    elements,
    scenes,
  };
}
