import { BoothConfig, BoothElement, BoothStyle } from './types';

/**
 * Algorithmic config generator from zone-based inventory.
 * Instead of relying on AI to generate every element JSON,
 * this takes zone descriptions and programmatically creates
 * walls, floors, carpets, furniture, and landscaping.
 */

// ─── Inventory Types ────────────────────────────────────────────────────────

interface InventoryItem {
  type: string;
  count: number;
  color?: string;
  notes?: string;
}

interface InventoryZone {
  name: string;
  gridPosition?: string;
  bounds: { x1: number; y1: number; x2: number; y2: number };
  items: InventoryItem[];
}

interface Inventory {
  overallSize?: { width: number; depth: number };
  style?: string;
  zones?: InventoryZone[];
  totalCounts?: Record<string, number>;
  dominantColors?: string[];
  keyFeatures?: string[];
}

// ─── ID Generator ───────────────────────────────────────────────────────────

let idCounter = 0;
function nextId(prefix: string): string {
  return `${prefix}_${++idCounter}`;
}

// ─── Zone Type Detection ────────────────────────────────────────────────────

type ZoneType = 'seating' | 'stage' | 'booth' | 'lounge' | 'reception' | 'corridor' | 'landscape' | 'storage' | 'meeting' | 'general';

function detectZoneType(zone: InventoryZone): ZoneType {
  const name = zone.name.toLowerCase();
  const itemTypes = zone.items.map(i => i.type.toLowerCase()).join(' ');
  const all = `${name} ${itemTypes}`;

  if (all.match(/seat|chair|auditor|theater|audience|row/)) return 'seating';
  if (all.match(/stage|podium|platform|present/)) return 'stage';
  if (all.match(/booth|stand|exhibit|display|kiosk/)) return 'booth';
  if (all.match(/lounge|sofa|vip|hospitality|relax/)) return 'lounge';
  if (all.match(/recep|registr|welcome|entry|foyer|lobby/)) return 'reception';
  if (all.match(/corrid|aisle|walk|path|hall/)) return 'corridor';
  if (all.match(/garden|plant|tree|green|landscape/)) return 'landscape';
  if (all.match(/store|storage|archive|service|back/)) return 'storage';
  if (all.match(/meet|conference|board|room/)) return 'meeting';
  return 'general';
}

// ─── Wall Generators ────────────────────────────────────────────────────────

function generateWallsForZone(zone: InventoryZone, zoneType: ZoneType): BoothElement[] {
  const walls: BoothElement[] = [];
  const { x1, y1, x2, y2 } = zone.bounds;
  const w = x2 - x1;
  const d = y2 - y1;
  const h = 3.0;
  const t = 0.12;

  // Enclosed zones (storage, meeting rooms) get all 4 walls
  // Semi-open zones (booths, reception) get 2-3 walls
  // Open zones (seating, corridor) get 0-1 walls

  if (zoneType === 'storage' || zoneType === 'meeting') {
    // Full enclosure
    walls.push(
      { id: nextId('wall'), type: 'back_wall', label: `${zone.name} - Back`, position: { x: x1, y: y2 - t, z: 0 }, dimensions: { width: w, height: h, thickness: t } },
      { id: nextId('wall'), type: 'back_wall', label: `${zone.name} - Front`, position: { x: x1, y: y1, z: 0 }, dimensions: { width: w, height: h, thickness: t } },
      { id: nextId('wall'), type: 'side_wall_left', label: `${zone.name} - Left`, position: { x: x1, y: y1, z: 0 }, dimensions: { width: t, depth: d, height: h, thickness: t } },
      { id: nextId('wall'), type: 'side_wall_right', label: `${zone.name} - Right`, position: { x: x2 - t, y: y1, z: 0 }, dimensions: { width: t, depth: d, height: h, thickness: t } },
    );
  } else if (zoneType === 'booth') {
    // Back and side walls, open front
    walls.push(
      { id: nextId('wall'), type: 'back_wall', label: `${zone.name} - Back`, position: { x: x1, y: y2 - t, z: 0 }, dimensions: { width: w, height: h, thickness: t } },
    );
    if (w > 3) {
      walls.push(
        { id: nextId('wall'), type: 'side_wall_left', label: `${zone.name} - Left`, position: { x: x1, y: y1, z: 0 }, dimensions: { width: t, depth: d, height: h, thickness: t } },
        { id: nextId('wall'), type: 'side_wall_right', label: `${zone.name} - Right`, position: { x: x2 - t, y: y1, z: 0 }, dimensions: { width: t, depth: d, height: h, thickness: t } },
      );
    }
  } else if (zoneType === 'stage') {
    // Back wall only for stage backdrop
    walls.push(
      { id: nextId('wall'), type: 'back_wall', label: `${zone.name} - Backdrop`, position: { x: x1, y: y2 - t, z: 0 }, dimensions: { width: w, height: h + 1, thickness: t }, color: '#1a1c20' },
    );
  }

  return walls;
}

// ─── Seating Generator ──────────────────────────────────────────────────────

function generateSeating(zone: InventoryZone, item: InventoryItem): BoothElement[] {
  const elements: BoothElement[] = [];
  const { x1, y1, x2, y2 } = zone.bounds;
  const zoneW = x2 - x1;
  const zoneD = y2 - y1;

  const totalSeats = item.count || 50;
  const seatsPerRow = Math.min(Math.floor(zoneW / 0.55), 20);
  const numRows = Math.max(1, Math.ceil(totalSeats / seatsPerRow));
  const rowSpacing = Math.min(0.9, (zoneD - 0.5) / numRows);
  const color = item.color || '#333333';

  const startX = x1 + (zoneW - seatsPerRow * 0.55) / 2; // center seating
  const startY = y1 + 0.5;

  for (let r = 0; r < numRows; r++) {
    const rowSeats = (r === numRows - 1) ? (totalSeats - seatsPerRow * r) : seatsPerRow;
    if (rowSeats <= 0) break;
    elements.push({
      id: nextId('seating_row'),
      type: 'seating_row',
      label: `${zone.name} Row ${r + 1}`,
      position: { x: startX, y: startY + r * rowSpacing, z: 0 },
      dimensions: { width: rowSeats * 0.55, depth: 0.8 },
      count: Math.min(rowSeats, seatsPerRow),
      color,
    });
  }

  return elements;
}

// ─── Furniture Generators ───────────────────────────────────────────────────

function generateTables(zone: InventoryZone, item: InventoryItem): BoothElement[] {
  const elements: BoothElement[] = [];
  const { x1, y1, x2, y2 } = zone.bounds;
  const count = item.count || 1;
  const zoneW = x2 - x1;
  const zoneD = y2 - y1;

  // Grid layout for tables
  const cols = Math.max(1, Math.ceil(Math.sqrt(count * (zoneW / zoneD))));
  const rows = Math.max(1, Math.ceil(count / cols));
  const spacingX = zoneW / (cols + 1);
  const spacingY = zoneD / (rows + 1);

  let placed = 0;
  for (let r = 0; r < rows && placed < count; r++) {
    for (let c = 0; c < cols && placed < count; c++) {
      elements.push({
        id: nextId('table'),
        type: 'round_table',
        label: `${zone.name} Table ${placed + 1}`,
        position: { x: x1 + spacingX * (c + 1), y: y1 + spacingY * (r + 1), z: 0 },
        dimensions: { radius: 0.4, height: 0.74 },
      });
      placed++;
    }
  }

  return elements;
}

function generateChairs(zone: InventoryZone, item: InventoryItem): BoothElement[] {
  const elements: BoothElement[] = [];
  const { x1, y1, x2, y2 } = zone.bounds;
  const count = Math.min(item.count || 4, 20); // cap individual chairs
  const zoneW = x2 - x1;
  const zoneD = y2 - y1;

  const cols = Math.max(1, Math.ceil(Math.sqrt(count)));
  const rows = Math.max(1, Math.ceil(count / cols));
  const spacingX = zoneW / (cols + 1);
  const spacingY = zoneD / (rows + 1);

  let placed = 0;
  for (let r = 0; r < rows && placed < count; r++) {
    for (let c = 0; c < cols && placed < count; c++) {
      elements.push({
        id: nextId('chair'),
        type: 'chair',
        label: `Chair`,
        position: { x: x1 + spacingX * (c + 1), y: y1 + spacingY * (r + 1), z: 0 },
        dimensions: { width: 0.48, depth: 0.48 },
        color: item.color,
      });
      placed++;
    }
  }

  return elements;
}

function generateTrees(zone: InventoryZone, item: InventoryItem): BoothElement[] {
  const elements: BoothElement[] = [];
  const { x1, y1, x2, y2 } = zone.bounds;
  const count = item.count || 2;
  const zoneW = x2 - x1;
  const zoneD = y2 - y1;

  // Distribute along the longer edge, or in a grid
  if (zoneW > zoneD * 2 || zoneD > zoneW * 2) {
    // Linear distribution along the long axis
    const isWide = zoneW > zoneD;
    const spacing = (isWide ? zoneW : zoneD) / (count + 1);
    for (let i = 0; i < count; i++) {
      elements.push({
        id: nextId('palm_tree'),
        type: 'palm_tree',
        label: `Tree ${i + 1}`,
        position: {
          x: isWide ? x1 + spacing * (i + 1) : x1 + zoneW / 2,
          y: isWide ? y1 + zoneD / 2 : y1 + spacing * (i + 1),
          z: 0,
        },
        dimensions: { height: 1.8 + Math.random() * 0.6 },
      });
    }
  } else {
    // Grid distribution
    const cols = Math.max(1, Math.ceil(Math.sqrt(count)));
    const rows = Math.max(1, Math.ceil(count / cols));
    const spacingX = zoneW / (cols + 1);
    const spacingY = zoneD / (rows + 1);
    let placed = 0;
    for (let r = 0; r < rows && placed < count; r++) {
      for (let c = 0; c < cols && placed < count; c++) {
        elements.push({
          id: nextId('palm_tree'),
          type: 'palm_tree',
          label: `Tree ${placed + 1}`,
          position: { x: x1 + spacingX * (c + 1), y: y1 + spacingY * (r + 1), z: 0 },
          dimensions: { height: 1.8 + Math.random() * 0.5 },
        });
        placed++;
      }
    }
  }

  return elements;
}

// ─── Zone Content Generator ─────────────────────────────────────────────────

function generateZoneContent(zone: InventoryZone, zoneType: ZoneType): BoothElement[] {
  const elements: BoothElement[] = [];
  const { x1, y1, x2, y2 } = zone.bounds;
  const zoneW = x2 - x1;
  const zoneD = y2 - y1;

  // Floor/carpet for every zone
  elements.push({
    id: nextId('carpet'),
    type: 'carpet',
    label: zone.name,
    position: { x: x1, y: y1, z: 0 },
    dimensions: { width: zoneW, depth: zoneD },
    color: zoneType === 'corridor' ? '#cc1122'
         : zoneType === 'stage' ? '#1a1c20'
         : zoneType === 'lounge' ? '#334455'
         : zoneType === 'reception' ? '#885533'
         : zoneType === 'seating' ? '#444444'
         : zoneType === 'storage' ? '#666666'
         : '#888888',
  });

  // Stage platform
  if (zoneType === 'stage') {
    elements.push({
      id: nextId('stage'),
      type: 'stage',
      label: `${zone.name} Platform`,
      position: { x: x1 + 0.3, y: y1 + 0.3, z: 0 },
      dimensions: { width: zoneW - 0.6, depth: zoneD - 0.6, height: 0.4 },
    });
    // Podium/screen
    elements.push({
      id: nextId('screen'),
      type: 'screen_panel',
      label: `${zone.name} Screen`,
      position: { x: x1 + zoneW / 2, y: y2 - 0.5, z: 0.4 },
      dimensions: { width: Math.min(zoneW * 0.6, 4), height: 2.5, thickness: 0.08 },
    });
  }

  // Reception desk
  if (zoneType === 'reception') {
    elements.push({
      id: nextId('reception'),
      type: 'reception_desk',
      label: `${zone.name} Desk`,
      position: { x: x1 + zoneW / 2, y: y1 + zoneD * 0.4, z: 0 },
      dimensions: { width: Math.min(zoneW * 0.5, 2.5), depth: 0.65, height: 1.05 },
    });
  }

  // Lounge furniture
  if (zoneType === 'lounge') {
    elements.push({
      id: nextId('sofa'),
      type: 'sofa',
      label: `${zone.name} Sofa`,
      position: { x: x1 + zoneW / 2, y: y1 + zoneD * 0.6, z: 0 },
      dimensions: { width: Math.min(zoneW * 0.6, 2.2), depth: 0.72, height: 0.75 },
    });
    elements.push({
      id: nextId('table'),
      type: 'round_table',
      label: `Coffee Table`,
      position: { x: x1 + zoneW / 2, y: y1 + zoneD * 0.4, z: 0 },
      dimensions: { radius: 0.35, height: 0.45 },
    });
  }

  // Booth content
  if (zoneType === 'booth') {
    // Display screen
    elements.push({
      id: nextId('screen'),
      type: 'screen_panel',
      label: `${zone.name} Display`,
      position: { x: x1 + zoneW / 2, y: y2 - 0.2, z: 0 },
      dimensions: { width: Math.min(zoneW * 0.7, 2), height: 2.0, thickness: 0.06 },
    });
    // Counter
    if (zoneW > 2.5) {
      elements.push({
        id: nextId('desk'),
        type: 'reception_desk',
        label: `${zone.name} Counter`,
        position: { x: x1 + zoneW / 2, y: y1 + zoneD * 0.35, z: 0 },
        dimensions: { width: Math.min(zoneW * 0.5, 1.8), depth: 0.6, height: 1.05 },
      });
    }
  }

  // Meeting room content
  if (zoneType === 'meeting') {
    elements.push({
      id: nextId('table'),
      type: 'round_table',
      label: `${zone.name} Table`,
      position: { x: x1 + zoneW / 2, y: y1 + zoneD / 2, z: 0 },
      dimensions: { radius: Math.min(zoneW, zoneD) * 0.25, height: 0.74 },
    });
    const chairCount = Math.min(8, Math.floor((zoneW + zoneD) / 0.8));
    const angleStep = (2 * Math.PI) / chairCount;
    const chairR = Math.min(zoneW, zoneD) * 0.35;
    for (let i = 0; i < chairCount; i++) {
      const angle = angleStep * i;
      elements.push({
        id: nextId('chair'),
        type: 'chair',
        label: `Chair`,
        position: {
          x: x1 + zoneW / 2 + Math.cos(angle) * chairR,
          y: y1 + zoneD / 2 + Math.sin(angle) * chairR,
          z: 0,
        },
        dimensions: { width: 0.48, depth: 0.48 },
        rotation: -(angle * 180 / Math.PI) + 180,
      });
    }
  }

  // Process explicit items from inventory
  for (const item of zone.items) {
    const t = item.type.toLowerCase();
    if (t.match(/seat|chair row|audience|row/)) {
      elements.push(...generateSeating(zone, item));
    } else if (t.match(/table/)) {
      elements.push(...generateTables(zone, item));
    } else if (t.match(/chair/) && !t.match(/row/)) {
      elements.push(...generateChairs(zone, item));
    } else if (t.match(/tree|palm|plant/)) {
      elements.push(...generateTrees(zone, item));
    } else if (t.match(/screen|display|tv|led|monitor/)) {
      for (let i = 0; i < (item.count || 1); i++) {
        elements.push({
          id: nextId('screen'),
          type: 'screen_panel',
          label: `Screen ${i + 1}`,
          position: { x: x1 + (zoneW / (item.count + 1)) * (i + 1), y: y2 - 0.3, z: 0 },
          dimensions: { width: 1.5, height: 2.2, thickness: 0.06 },
        });
      }
    } else if (t.match(/kiosk|interactive/)) {
      for (let i = 0; i < (item.count || 1); i++) {
        elements.push({
          id: nextId('kiosk'),
          type: 'kiosk',
          label: `Kiosk ${i + 1}`,
          position: { x: x1 + (zoneW / (item.count + 1)) * (i + 1), y: y1 + zoneD * 0.5, z: 0 },
          dimensions: { width: 0.9, depth: 0.9, height: 1.05 },
        });
      }
    } else if (t.match(/sofa|couch/)) {
      for (let i = 0; i < (item.count || 1); i++) {
        elements.push({
          id: nextId('sofa'),
          type: 'sofa',
          label: `Sofa ${i + 1}`,
          position: { x: x1 + (zoneW / (item.count + 1)) * (i + 1), y: y1 + zoneD * 0.5, z: 0 },
          dimensions: { width: 1.7, depth: 0.72, height: 0.75 },
        });
      }
    } else if (t.match(/arch|gate|entrance/)) {
      elements.push({
        id: nextId('arch'),
        type: 'arch',
        label: `${zone.name} Arch`,
        position: { x: x1 + zoneW / 2, y: y1, z: 0 },
        dimensions: { width: Math.min(zoneW * 0.6, 3), height: 3.0, thickness: 0.2 },
      });
    } else if (t.match(/pergola|canopy|roof|ceiling/)) {
      elements.push({
        id: nextId('pergola'),
        type: 'pergola',
        label: `${zone.name} Pergola`,
        position: { x: x1, y: y1, z: 0 },
        dimensions: { width: zoneW, depth: zoneD, height: 2.8 },
      });
    }
  }

  return elements;
}

// ─── Main: Convert Inventory to Config ──────────────────────────────────────

export function inventoryToConfig(inventory: Inventory): BoothConfig {
  idCounter = 0; // reset

  const width = inventory.overallSize?.width ?? 20;
  const depth = inventory.overallSize?.depth ?? 15;
  const styleRaw = (inventory.style ?? 'corporate').toLowerCase();
  const style: BoothStyle = (['corporate', 'pavilion', 'luxury', 'organic', 'industrial', 'modern'] as BoothStyle[])
    .find(s => styleRaw.includes(s)) ?? 'corporate';

  const elements: BoothElement[] = [];

  // Main floor
  elements.push({
    id: 'floor_main',
    type: 'floor',
    label: 'Main Floor',
    position: { x: 0, y: 0, z: 0 },
    dimensions: { width, depth, height: 0.03 },
  });

  // Process each zone
  if (inventory.zones && inventory.zones.length > 0) {
    for (const zone of inventory.zones) {
      // Clamp zone bounds to booth footprint
      const clampedZone = {
        ...zone,
        bounds: {
          x1: Math.max(0, Math.min(zone.bounds.x1, width)),
          y1: Math.max(0, Math.min(zone.bounds.y1, depth)),
          x2: Math.max(0, Math.min(zone.bounds.x2, width)),
          y2: Math.max(0, Math.min(zone.bounds.y2, depth)),
        },
      };

      // Skip degenerate zones
      if (clampedZone.bounds.x2 - clampedZone.bounds.x1 < 0.5) continue;
      if (clampedZone.bounds.y2 - clampedZone.bounds.y1 < 0.5) continue;

      const zoneType = detectZoneType(clampedZone);

      // Generate walls
      elements.push(...generateWallsForZone(clampedZone, zoneType));

      // Generate zone content
      elements.push(...generateZoneContent(clampedZone, zoneType));
    }
  }

  // Default camera scenes
  const scenes = [
    {
      name: 'Entrance View',
      eye: { x: -width * 0.4, y: -depth * 0.6, z: width * 0.8 },
      target: { x: width * 0.5, y: depth * 0.4, z: 1.2 },
    },
    {
      name: 'Hero 3-Quarter',
      eye: { x: -width * 0.2, y: -depth * 0.3, z: width * 1.2 },
      target: { x: width * 0.5, y: depth * 0.5, z: 1.0 },
    },
    {
      name: 'Top Plan',
      eye: { x: width * 0.5, y: depth * 0.5, z: Math.max(width, depth) * 2 },
      target: { x: width * 0.5, y: depth * 0.5, z: 0 },
    },
  ];

  return {
    projectName: '',
    clientName: '',
    boothName: inventory.zones?.[0]?.name ?? 'Exhibition Space',
    width,
    depth,
    wallHeight: 3.0,
    style,
    openSides: ['front'],
    elements,
    scenes,
  };
}
