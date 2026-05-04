import { BoothConfig, BoothElement } from './types';

const SCALE = 60; // pixels per meter
const PADDING = 40;

function toSvgX(x: number): number { return PADDING + x * SCALE; }
function toSvgY(y: number, depth: number): number { return PADDING + (depth - y) * SCALE; }

function elementColor(el: BoothElement): string {
  // Use element-level color override if available
  if (el.color) return el.color;

  const colors: Record<string, string> = {
    floor:            '#E8E8E6',
    back_wall:        '#1A1C20',
    side_wall_left:   '#1A1C20',
    side_wall_right:  '#1A1C20',
    curved_wall:      '#1A1C20',
    pillar_wall:      '#4A2810',
    header_fascia:    '#0A1828',
    reception_desk:   '#4A2810',
    kiosk:            '#4A2810',
    round_table:      '#9A6830',
    high_table:       '#9A6830',
    stool:            '#A08840',
    chair:            '#282A2E',
    sofa:             '#007A82',
    screen_panel:     '#0A1022',
    pergola:          '#4A2810',
    arch:             '#E8E8E6',
    header:           '#0A1828',
    mashrabiya_panel: '#282A2E',
    palm_tree:        '#1E7A3C',
    planter:          '#1E7A3C',
    carpet:           '#CC1122',
    stage:            '#2A2A2E',
    seating_row:      '#CC2222',
    signage_tower:    '#0A1828',
    column:           '#E8E8E6',
    partition:        '#888888',
  };
  return colors[el.type] ?? '#888888';
}

function elementLabel(el: BoothElement): string {
  return el.label ?? el.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function renderElement(el: BoothElement, depth: number): string {
  const fill = elementColor(el);
  const opacity = el.type === 'floor' ? '0.4' : '0.85';
  const stroke = '#ffffff';
  const sw = el.type === 'floor' ? '1' : '1.5';

  if (el.type === 'curved_wall') {
    const cx = toSvgX(el.position.x);
    const cy = toSvgY(el.position.y, depth);
    const r = (el.dimensions.radius ?? 2.0) * SCALE;
    const startDeg = el.rotation ?? 0;
    const arcDeg = el.dimensions.arcDeg ?? 180;
    const endDeg = startDeg + arcDeg;
    const sx = cx + r * Math.cos((startDeg * Math.PI) / 180);
    const sy = cy - r * Math.sin((startDeg * Math.PI) / 180);
    const ex = cx + r * Math.cos((endDeg * Math.PI) / 180);
    const ey = cy - r * Math.sin((endDeg * Math.PI) / 180);
    const largeArc = arcDeg > 180 ? 1 : 0;
    return `<path d="M${sx},${sy} A${r},${r} 0 ${largeArc},0 ${ex},${ey}" 
      fill="none" stroke="${fill}" stroke-width="4" opacity="${opacity}"/>`;
  }

  if (el.type === 'column') {
    const cx = toSvgX(el.position.x);
    const cy = toSvgY(el.position.y, depth);
    const r = (el.dimensions.radius ?? 0.15) * SCALE;
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" opacity="${opacity}"/>
<text x="${cx}" y="${cy + 3}" text-anchor="middle" font-size="6" fill="white" opacity="0.7">Col</text>`;
  }

  if (el.type === 'round_table' || el.type === 'high_table' || el.type === 'palm_tree' || el.type === 'planter' || el.type === 'stool') {
    const cx = toSvgX(el.position.x);
    const cy = toSvgY(el.position.y, depth);
    const r = (el.dimensions.radius ?? (el.type === 'stool' ? 0.18 : el.type === 'palm_tree' ? 0.24 : 0.35)) * SCALE;
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" opacity="${opacity}"/>
<text x="${cx}" y="${cy + 3}" text-anchor="middle" font-size="7" fill="white" opacity="0.8">${elementLabel(el)}</text>`;
  }

  // Rectangle-based elements
  const x = el.position.x;
  const y = el.position.y;
  let w = el.dimensions.width ?? (el.type === 'back_wall' ? 6 : el.type === 'floor' ? 6 : 1.0);
  let d = el.dimensions.depth ?? el.dimensions.thickness ?? 0.15;

  // Seating rows: compute width from seat count, depth is one row
  if (el.type === 'seating_row') {
    const count = (el as { count?: number }).count ?? 6;
    w = el.dimensions.width ?? count * 0.55;
    d = el.dimensions.depth ?? 0.8;
  }

  const svgX = toSvgX(x);
  const svgY = toSvgY(y + d, depth);
  const svgW = w * SCALE;
  const svgH = d * SCALE;

  const label = elementLabel(el);
  const fontSize = Math.max(7, Math.min(11, svgW / label.length));

  return `<rect x="${svgX}" y="${svgY}" width="${svgW}" height="${svgH}" 
    fill="${fill}" stroke="${stroke}" stroke-width="${sw}" opacity="${opacity}" rx="1"/>
<text x="${svgX + svgW / 2}" y="${svgY + svgH / 2 + 3}" text-anchor="middle" 
    font-size="${fontSize}" fill="white" opacity="0.9">${label}</text>`;
}

export function generateFloorPlanSvg(config: BoothConfig): string {
  const svgW = config.width * SCALE + PADDING * 2;
  const svgH = config.depth * SCALE + PADDING * 2;

  const boothX = toSvgX(0);
  const boothY = toSvgY(config.depth, config.depth);
  const boothW = config.width * SCALE;
  const boothH = config.depth * SCALE;

  const elements = config.elements
    .sort((a, b) => {
      const order: Record<string, number> = { floor: 0, back_wall: 1, side_wall_left: 1, side_wall_right: 1 };
      return (order[a.type] ?? 5) - (order[b.type] ?? 5);
    })
    .map(el => renderElement(el, config.depth))
    .join('\n    ');

  // Dimension lines
  const dimY = toSvgY(0, config.depth) + 22;
  const dimX = toSvgX(config.width) + 22;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:auto;max-height:75vh">
  <defs>
    <pattern id="grid" width="${SCALE}" height="${SCALE}" patternUnits="userSpaceOnUse" x="${PADDING}" y="${PADDING}">
      <path d="M ${SCALE} 0 L 0 0 0 ${SCALE}" fill="none" stroke="#333" stroke-width="0.3"/>
    </pattern>
  </defs>
  
  <!-- Background -->
  <rect width="${svgW}" height="${svgH}" fill="#1a1b1e"/>
  
  <!-- Grid -->
  <rect x="${boothX}" y="${boothY}" width="${boothW}" height="${boothH}" fill="url(#grid)"/>
  
  <!-- Booth boundary -->
  <rect x="${boothX}" y="${boothY}" width="${boothW}" height="${boothH}" 
    fill="none" stroke="#00DDDD" stroke-width="2" stroke-dasharray="6,3"/>
  
  <!-- Elements -->
  ${elements}
  
  <!-- Width dimension -->
  <line x1="${boothX}" y1="${dimY}" x2="${boothX + boothW}" y2="${dimY}" stroke="#00DDDD" stroke-width="1"/>
  <line x1="${boothX}" y1="${dimY - 4}" x2="${boothX}" y2="${dimY + 4}" stroke="#00DDDD" stroke-width="1"/>
  <line x1="${boothX + boothW}" y1="${dimY - 4}" x2="${boothX + boothW}" y2="${dimY + 4}" stroke="#00DDDD" stroke-width="1"/>
  <text x="${boothX + boothW / 2}" y="${dimY + 14}" text-anchor="middle" font-size="11" fill="#00DDDD">${config.width}m</text>
  
  <!-- Depth dimension -->
  <line x1="${dimX}" y1="${boothY}" x2="${dimX}" y2="${boothY + boothH}" stroke="#00DDDD" stroke-width="1"/>
  <line x1="${dimX - 4}" y1="${boothY}" x2="${dimX + 4}" y2="${boothY}" stroke="#00DDDD" stroke-width="1"/>
  <line x1="${dimX - 4}" y1="${boothY + boothH}" x2="${dimX + 4}" y2="${boothY + boothH}" stroke="#00DDDD" stroke-width="1"/>
  <text x="${dimX + 14}" y="${boothY + boothH / 2 + 4}" text-anchor="middle" font-size="11" fill="#00DDDD" transform="rotate(-90, ${dimX + 14}, ${boothY + boothH / 2})">${config.depth}m</text>
  
  <!-- Compass -->
  <text x="${PADDING}" y="${PADDING - 10}" font-size="10" fill="#666">↑ BACK</text>
  <text x="${PADDING}" y="${svgH - 8}" font-size="10" fill="#666">↓ FRONT (entry)</text>
  
  <!-- Title -->
  <text x="${svgW - PADDING}" y="${PADDING - 10}" text-anchor="end" font-size="11" fill="#aaa" font-weight="bold">${config.boothName}</text>
  <text x="${svgW - PADDING}" y="${svgH - 8}" text-anchor="end" font-size="9" fill="#555">Booth Forge · ${config.width}m × ${config.depth}m · ${config.style}</text>
</svg>`;
}
