import { BoothConfig, BoothElement } from './types';

// ─── Dimension Constraints (meters) ─────────────────────────────────────────

const DIMENSION_RULES: Record<string, { minW?: number; maxW?: number; minD?: number; maxD?: number; minH?: number; maxH?: number; minR?: number; maxR?: number }> = {
  back_wall:        { minW: 1, maxW: 30, minH: 2, maxH: 5 },
  side_wall_left:   { minW: 0.1, maxW: 0.25, minH: 2, maxH: 5 },
  side_wall_right:  { minW: 0.1, maxW: 0.25, minH: 2, maxH: 5 },
  pillar_wall:      { minW: 0.8, maxW: 3, minH: 2, maxH: 4.5 },
  curved_wall:      { minR: 0.5, maxR: 8, minH: 2, maxH: 5 },
  reception_desk:   { minW: 1.2, maxW: 4, minD: 0.4, maxD: 1.2, minH: 0.9, maxH: 1.2 },
  kiosk:            { minW: 0.5, maxW: 1.5, minH: 0.8, maxH: 1.3 },
  round_table:      { minR: 0.25, maxR: 0.8, minH: 0.65, maxH: 0.85 },
  high_table:       { minR: 0.25, maxR: 0.6, minH: 0.95, maxH: 1.2 },
  chair:            { minW: 0.35, maxW: 0.6, minD: 0.35, maxD: 0.6 },
  sofa:             { minW: 1.2, maxW: 3.5, minD: 0.5, maxD: 1.0, minH: 0.6, maxH: 0.9 },
  stool:            { minH: 0.6, maxH: 0.9 },
  screen_panel:     { minW: 0.6, maxW: 4, minH: 1, maxH: 4 },
  palm_tree:        { minH: 1.2, maxH: 3.5 },
  planter:          { minH: 0.2, maxH: 1.0 },
  pergola:          { minH: 2.4, maxH: 4.0 },
  arch:             { minW: 1.5, maxW: 6, minH: 2.2, maxH: 5 },
  carpet:           { minW: 0.5, maxW: 50, minD: 0.5, maxD: 50 },
  stage:            { minW: 1, maxW: 20, minD: 1, maxD: 15, minH: 0.1, maxH: 1.0 },
  seating_row:      {},
  signage_tower:    { minW: 0.3, maxW: 1.5, minH: 2, maxH: 6 },
  display_tower:    { minW: 0.3, maxW: 1.5, minH: 2, maxH: 6 },
  column:           { minR: 0.08, maxR: 0.5, minH: 2, maxH: 6 },
  partition:        { minW: 0.5, maxW: 6, minH: 0.8, maxH: 3 },
};

// ─── Clamp ──────────────────────────────────────────────────────────────────

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

// ─── Enforce Dimension Bounds ───────────────────────────────────────────────

function enforceDimensions(el: BoothElement): BoothElement {
  const rules = DIMENSION_RULES[el.type];
  if (!rules) return el;

  const dims = { ...el.dimensions };

  if (rules.minW !== undefined && rules.maxW !== undefined && dims.width !== undefined) {
    dims.width = clamp(dims.width, rules.minW, rules.maxW);
  }
  if (rules.minD !== undefined && rules.maxD !== undefined && dims.depth !== undefined) {
    dims.depth = clamp(dims.depth, rules.minD, rules.maxD);
  }
  if (rules.minH !== undefined && rules.maxH !== undefined && dims.height !== undefined) {
    dims.height = clamp(dims.height, rules.minH, rules.maxH);
  }
  if (rules.minR !== undefined && rules.maxR !== undefined && dims.radius !== undefined) {
    dims.radius = clamp(dims.radius, rules.minR, rules.maxR);
  }

  return { ...el, dimensions: dims };
}

// ─── Bounding Box for Overlap Detection ─────────────────────────────────────

interface BBox {
  x1: number; y1: number; x2: number; y2: number;
}

function getElementBBox(el: BoothElement): BBox | null {
  const x = el.position.x;
  const y = el.position.y;

  // Skip floor and carpet — they're supposed to overlap
  if (el.type === 'floor' || el.type === 'carpet' || el.type === 'ceiling_canopy' || el.type === 'pergola') return null;

  const w = el.dimensions.width ?? el.dimensions.radius ? (el.dimensions.radius! * 2) : 0.5;
  const d = el.dimensions.depth ?? el.dimensions.thickness ?? w;

  // Round/circular elements: center-based
  if (['round_table', 'high_table', 'palm_tree', 'planter', 'stool', 'column'].includes(el.type)) {
    const r = el.dimensions.radius ?? 0.3;
    return { x1: x - r, y1: y - r, x2: x + r, y2: y + r };
  }

  // Seating row: width based on count
  if (el.type === 'seating_row') {
    const count = el.count ?? 6;
    const rowW = count * 0.55;
    return { x1: x, y1: y, x2: x + rowW, y2: y + 0.8 };
  }

  // Center-based elements (desks, kiosks, sofas, chairs, etc.)
  if (['reception_desk', 'kiosk', 'sofa', 'chair', 'signage_tower', 'display_tower'].includes(el.type)) {
    const hw = (el.dimensions.width ?? 1) / 2;
    const hd = (el.dimensions.depth ?? 0.5) / 2;
    return { x1: x - hw, y1: y - hd, x2: x + hw, y2: y + hd };
  }

  // Position-based (walls, stages, etc.)
  return { x1: x, y1: y, x2: x + (el.dimensions.width ?? 1), y2: y + (el.dimensions.depth ?? el.dimensions.thickness ?? 0.15) };
}

function bboxOverlap(a: BBox, b: BBox): boolean {
  return a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;
}

function bboxOverlapArea(a: BBox, b: BBox): number {
  const dx = Math.max(0, Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1));
  const dy = Math.max(0, Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1));
  return dx * dy;
}

// ─── Resolve Overlaps ───────────────────────────────────────────────────────

function resolveOverlaps(elements: BoothElement[], boothW: number, boothD: number): BoothElement[] {
  const result = elements.map(el => ({ ...el, position: { ...el.position } }));
  const FURNITURE_TYPES = ['chair', 'sofa', 'round_table', 'high_table', 'stool', 'kiosk', 'reception_desk', 'palm_tree', 'planter', 'signage_tower', 'display_tower', 'column'];

  // Only resolve overlaps for moveable furniture, not walls/structure
  for (let i = 0; i < result.length; i++) {
    if (!FURNITURE_TYPES.includes(result[i].type)) continue;
    const bboxI = getElementBBox(result[i]);
    if (!bboxI) continue;

    for (let j = 0; j < i; j++) {
      const bboxJ = getElementBBox(result[j]);
      if (!bboxJ) continue;

      if (bboxOverlap(bboxI, bboxJ)) {
        const overlap = bboxOverlapArea(bboxI, bboxJ);
        const areaI = (bboxI.x2 - bboxI.x1) * (bboxI.y2 - bboxI.y1);
        // Only nudge if overlap is significant (>30% of the smaller element)
        if (overlap > areaI * 0.3) {
          // Nudge element i away from j
          const dx = ((bboxI.x1 + bboxI.x2) / 2) - ((bboxJ.x1 + bboxJ.x2) / 2);
          const dy = ((bboxI.y1 + bboxI.y2) / 2) - ((bboxJ.y1 + bboxJ.y2) / 2);
          const dist = Math.sqrt(dx * dx + dy * dy) || 0.5;
          const nudge = 0.6; // meters
          result[i].position.x += (dx / dist) * nudge;
          result[i].position.y += (dy / dist) * nudge;
        }
      }
    }
  }

  return result;
}

// ─── Clamp Positions to Booth Footprint ─────────────────────────────────────

function clampToFootprint(elements: BoothElement[], boothW: number, boothD: number): BoothElement[] {
  return elements.map(el => {
    if (el.type === 'floor') return el;
    const margin = 0.2;
    const pos = { ...el.position };
    pos.x = clamp(pos.x, margin, boothW - margin);
    pos.y = clamp(pos.y, margin, boothD - margin);
    if (pos.z !== undefined && pos.z < 0 && el.type !== 'carpet') {
      pos.z = 0;
    }
    return { ...el, position: pos };
  });
}

// ─── Ensure Floor Exists ────────────────────────────────────────────────────

function ensureFloor(config: BoothConfig): BoothConfig {
  const hasFloor = config.elements.some(e => e.type === 'floor');
  if (hasFloor) return config;

  const floorEl: BoothElement = {
    id: 'floor_main',
    type: 'floor',
    label: 'Main Floor',
    position: { x: 0, y: 0, z: 0 },
    dimensions: { width: config.width, depth: config.depth, height: 0.03 },
  };

  return { ...config, elements: [floorEl, ...config.elements] };
}

// ─── Deduplicate IDs ────────────────────────────────────────────────────────

function deduplicateIds(elements: BoothElement[]): BoothElement[] {
  const seen = new Set<string>();
  return elements.map(el => {
    let id = el.id;
    let counter = 2;
    while (seen.has(id)) {
      id = `${el.id}_${counter++}`;
    }
    seen.add(id);
    return { ...el, id };
  });
}

// ─── Validate Seating Row Counts ────────────────────────────────────────────

function fixSeatingRows(elements: BoothElement[]): BoothElement[] {
  return elements.map(el => {
    if (el.type !== 'seating_row') return el;
    const count = el.count ?? 6;
    return {
      ...el,
      count: clamp(count, 2, 30),
      dimensions: {
        ...el.dimensions,
        width: el.dimensions.width ?? count * 0.55,
        depth: el.dimensions.depth ?? 0.8,
      },
    };
  });
}

// ─── Main Validator ─────────────────────────────────────────────────────────

export function validateAndFixConfig(config: BoothConfig): { config: BoothConfig; fixes: string[] } {
  const fixes: string[] = [];
  let c = { ...config };

  // 1. Clamp overall booth dimensions
  if (c.width < 2 || c.width > 100) {
    fixes.push(`Booth width clamped: ${c.width}m → ${clamp(c.width, 2, 100)}m`);
    c.width = clamp(c.width, 2, 100);
  }
  if (c.depth < 2 || c.depth > 100) {
    fixes.push(`Booth depth clamped: ${c.depth}m → ${clamp(c.depth, 2, 100)}m`);
    c.depth = clamp(c.depth, 2, 100);
  }
  if (!c.wallHeight || c.wallHeight < 2 || c.wallHeight > 8) {
    c.wallHeight = clamp(c.wallHeight || 3, 2, 8);
  }

  // 2. Ensure floor
  c = ensureFloor(c);

  // 3. Enforce element dimensions
  const beforeCount = c.elements.length;
  c.elements = c.elements.map(enforceDimensions);

  // 4. Fix seating rows
  c.elements = fixSeatingRows(c.elements);

  // 5. Deduplicate IDs
  c.elements = deduplicateIds(c.elements);

  // 6. Clamp positions to footprint
  c.elements = clampToFootprint(c.elements, c.width, c.depth);

  // 7. Resolve overlaps (furniture only)
  c.elements = resolveOverlaps(c.elements, c.width, c.depth);

  // 8. Ensure scenes exist
  if (!c.scenes || c.scenes.length === 0) {
    c.scenes = [
      {
        name: 'Entrance View',
        eye: { x: -c.width * 0.5, y: -c.depth * 0.7, z: c.wallHeight * 1.5 },
        target: { x: c.width * 0.5, y: c.depth * 0.4, z: 1.2 },
      },
      {
        name: 'Hero 3-Quarter',
        eye: { x: -c.width * 0.3, y: -c.depth * 0.5, z: c.wallHeight * 2 },
        target: { x: c.width * 0.5, y: c.depth * 0.5, z: 1.0 },
      },
      {
        name: 'Top Plan',
        eye: { x: c.width * 0.5, y: c.depth * 0.5, z: c.wallHeight * 4 },
        target: { x: c.width * 0.5, y: c.depth * 0.5, z: 0 },
      },
    ];
    fixes.push('Added default camera scenes');
  }

  if (fixes.length > 0) {
    fixes.unshift(`Validated ${c.elements.length} elements`);
  }

  return { config: c, fixes };
}
