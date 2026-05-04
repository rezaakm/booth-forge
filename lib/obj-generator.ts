import { BoothConfig, BoothElement } from './types';

/**
 * OBJ Coordinate system:
 *   X = booth width (left → right)
 *   Y = booth height (floor → ceiling)  [OBJ Y = up]
 *   Z = booth depth (front → back)      [OBJ Z = depth]
 */

// ─── MTL Material Library ─────────────────────────────────────────────────────

interface MTLMat {
  r: number; g: number; b: number;
  metallic?: number;
  roughness?: number;
  opacity?: number;
  emissive?: boolean;
  emR?: number; emG?: number; emB?: number;
}

const MATERIALS: Record<string, MTLMat> = {
  Floor_Carpet_Blue:   { r:0.05, g:0.12, b:0.35 },
  Floor_Concrete:      { r:0.82, g:0.82, b:0.80 },
  Wall_White:          { r:0.95, g:0.95, b:0.94 },
  Wall_DeepNavy:       { r:0.04, g:0.10, b:0.18 },
  Wood_Walnut:         { r:0.29, g:0.16, b:0.07 },
  Wood_Oak:            { r:0.67, g:0.54, b:0.34 },
  Metal_Brass:         { r:0.66, g:0.52, b:0.28, metallic:0.88, roughness:0.25 },
  Metal_Black_Matte:   { r:0.10, g:0.11, b:0.13 },
  LED_Cyan:            { r:0.00, g:0.88, b:0.85, emissive:true, emR:0.0, emG:0.88, emB:0.85 },
  Screen_Backlit:      { r:0.00, g:0.82, b:0.90, emissive:true, emR:0.0, emG:0.82, emB:0.90 },
  Screen_Dark:         { r:0.05, g:0.07, b:0.09, metallic:0.2, roughness:0.05 },
  Omantel_Orange:      { r:0.96, g:0.49, b:0.17 },
  Upholstery_Teal:     { r:0.00, g:0.47, b:0.50 },
  Plant_Green:         { r:0.13, g:0.47, b:0.23 },
  Planter_Black:       { r:0.15, g:0.15, b:0.16 },
  Gold_Accent:         { r:0.83, g:0.64, b:0.22, metallic:0.92, roughness:0.20 },
};

export function generateMTL(config: BoothConfig): string {
  let mtl = `# Booth Forge — Material Library\n# Project: ${config.projectName}\n# Client: ${config.clientName}\n\n`;
  for (const [name, m] of Object.entries(MATERIALS)) {
    const ks = m.metallic ?? 0.1;
    const ns = m.roughness != null ? (1 - m.roughness) * 900 + 10 : 50;
    mtl += `newmtl ${name}\n`;
    mtl += `Ka ${(m.r*0.1).toFixed(3)} ${(m.g*0.1).toFixed(3)} ${(m.b*0.1).toFixed(3)}\n`;
    mtl += `Kd ${m.r.toFixed(3)} ${m.g.toFixed(3)} ${m.b.toFixed(3)}\n`;
    mtl += `Ks ${ks.toFixed(3)} ${ks.toFixed(3)} ${ks.toFixed(3)}\n`;
    mtl += `Ns ${ns.toFixed(1)}\n`;
    mtl += `d ${(m.opacity ?? 1.0).toFixed(3)}\n`;
    if (m.emissive) mtl += `Ke ${(m.emR??0).toFixed(3)} ${(m.emG??0).toFixed(3)} ${(m.emB??0).toFixed(3)}\n`;
    mtl += `illum ${m.metallic ? 3 : 2}\n\n`;
  }
  return mtl;
}

// ─── OBJ Builder ──────────────────────────────────────────────────────────────

class OBJBuilder {
  private lines: string[] = [];
  private vIdx = 1; // OBJ vertex indices are 1-based

  header(config: BoothConfig): void {
    this.lines.push(
      `# ${'═'.repeat(60)}`,
      `# BOOTH FORGE — OBJ Export`,
      `# Project  : ${config.projectName}`,
      `# Client   : ${config.clientName}`,
      `# Booth    : ${config.boothName}`,
      `# Size     : ${config.width}m × ${config.depth}m × ${config.wallHeight}m`,
      `# Style    : ${config.style}`,
      `# ${'═'.repeat(60)}`,
      ``,
      `mtllib ${config.boothName.replace(/\s+/g, '_')}.mtl`,
      ``,
    );
  }

  // Add a box. OBJ coords: X=width, Y=height(up), Z=depth
  box(name: string, mat: string,
      x: number, y: number, z: number,  // bottom-front-left corner (booth coords)
      w: number, h: number, d: number   // width, height, depth (booth coords)
  ): void {
    this.lines.push(`# ${name}`, `g ${name}`, `usemtl ${mat}`);

    // 8 vertices (booth Y→OBJ Z, booth Z→OBJ Y)
    const verts = [
      [x,   z,   y  ], [x+w, z,   y  ],  // front bottom L R
      [x+w, z,   y+d], [x,   z,   y+d],  // back  bottom R L
      [x,   z+h, y  ], [x+w, z+h, y  ],  // front top    L R
      [x+w, z+h, y+d], [x,   z+h, y+d],  // back  top    R L
    ];
    verts.forEach(([vx, vy, vz]) =>
      this.lines.push(`v ${vx.toFixed(4)} ${vy.toFixed(4)} ${vz.toFixed(4)}`)
    );

    const b = this.vIdx;
    // 6 faces (CCW winding = outward normals)
    this.lines.push(
      `f ${b} ${b+1} ${b+5} ${b+4}`,      // front  face
      `f ${b+1} ${b+2} ${b+6} ${b+5}`,    // right  face
      `f ${b+2} ${b+3} ${b+7} ${b+6}`,    // back   face
      `f ${b+3} ${b} ${b+4} ${b+7}`,      // left   face
      `f ${b} ${b+3} ${b+2} ${b+1}`,      // bottom face
      `f ${b+4} ${b+5} ${b+6} ${b+7}`,    // top    face
      ``,
    );
    this.vIdx += 8;
  }

  // Cylinder approximation using a prism
  cylinder(name: string, mat: string,
           cx: number, cz: number, baseY: number,
           radius: number, height: number, segments = 16
  ): void {
    this.lines.push(`# ${name}`, `g ${name}`, `usemtl ${mat}`);
    const b = this.vIdx;
    const verts: number[][] = [];

    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const vx = cx + Math.cos(angle) * radius;
      const vz = cz + Math.sin(angle) * radius;
      verts.push([vx, baseY,        vz]);  // bottom ring
      verts.push([vx, baseY+height, vz]);  // top ring
    }

    verts.forEach(([vx, vy, vz]) =>
      this.lines.push(`v ${vx.toFixed(4)} ${vy.toFixed(4)} ${vz.toFixed(4)}`)
    );
    this.vIdx += segments * 2;

    // Side faces
    for (let i = 0; i < segments; i++) {
      const n  = (i + 1) % segments;
      const b0 = b + i * 2;
      const b1 = b + n * 2;
      this.lines.push(`f ${b0} ${b1} ${b1+1} ${b0+1}`);
    }

    // Top + bottom cap (fan triangulation)
    const botCenter = this.vIdx;
    const topCenter = this.vIdx + 1;
    this.lines.push(`v ${cx.toFixed(4)} ${baseY.toFixed(4)} ${cz.toFixed(4)}`);
    this.lines.push(`v ${cx.toFixed(4)} ${(baseY+height).toFixed(4)} ${cz.toFixed(4)}`);
    this.vIdx += 2;

    for (let i = 0; i < segments; i++) {
      const n  = (i + 1) % segments;
      const b0 = b + i * 2;
      const b1 = b + n * 2;
      this.lines.push(`f ${botCenter} ${b1} ${b0}`);     // bottom cap
      this.lines.push(`f ${topCenter} ${b0+1} ${b1+1}`); // top cap
    }
    this.lines.push('');
  }

  toString(): string {
    return this.lines.join('\n');
  }
}

// ─── Element Builders ──────────────────────────────────────────────────────────

function buildElement(obj: OBJBuilder, el: BoothElement): void {
  const x  = el.position.x;
  const y  = el.position.y;
  const z  = el.position.z ?? 0;
  const w  = el.dimensions.width  ?? 1.0;
  const d  = el.dimensions.depth  ?? 0.14;
  const h  = el.dimensions.height ?? 3.0;
  const r  = el.dimensions.radius ?? 0.35;
  const nm = (el.label ?? el.id).replace(/\s+/g, '_');

  switch (el.type) {
    case 'floor':
      obj.box(nm, 'Floor_Carpet_Blue', x, -0.05, y, w, 0.05, d);
      break;

    case 'back_wall':
      obj.box(nm, 'Wall_DeepNavy', x, z, y, w, h, d);
      break;

    case 'side_wall_left':
    case 'side_wall_right':
      obj.box(nm, 'Wall_White', x, z, y, w, h, d);
      break;

    case 'pillar_wall': {
      const pw = w; const ph = h; const pd = 0.16;
      const px = x - pw/2; const py = y;
      obj.box(`${nm}_Frame`,    'Wood_Walnut',    px-0.03, z,    py-pd/2-0.03, pw+0.06, ph+0.06, pd+0.06);
      obj.box(`${nm}_Inset`,    'Metal_Black_Matte', px,   z+0.04, py-pd/2,    pw,     ph,       pd);
      if (el.hasScreen) {
        const sw = el.screenSize?.width  ?? pw * 0.68;
        const sh = el.screenSize?.height ?? ph * 0.52;
        obj.box(`${nm}_Screen`, 'Screen_Backlit', x-sw/2, z+0.25, py-pd/2-0.04, sw, sh, 0.04);
        obj.box(`${nm}_Glow`,   'LED_Cyan',       x-sw/2, z+0.25+sh+0.04, py-pd/2-0.03, sw, 0.12, 0.03);
      }
      obj.box(`${nm}_BrassTop`, 'Metal_Brass',    px-0.03, z+ph,  py-pd/2-0.03, pw+0.06, 0.04, pd+0.06);
      obj.box(`${nm}_BrassBtm`, 'Metal_Brass',    px-0.03, z,     py-pd/2-0.03, pw+0.06, 0.04, pd+0.06);
      obj.box(`${nm}_Plinth`,   'Wood_Oak',       px-0.06, z-0.12, py-pd/2-0.04, pw+0.12, 0.12, pd+0.08);
      break;
    }

    case 'display_tower': {
      const isOrange = nm.toLowerCase().includes('orange');
      obj.box(nm, isOrange ? 'Omantel_Orange' : 'Metal_Black_Matte', x, z, y, w, h, d);
      break;
    }

    case 'header_fascia':
      obj.box(`${nm}_Frame`,    'Wood_Walnut',  x-0.05, z,    y-0.15, w+0.10, h,      0.22);
      obj.box(`${nm}_CyanGlow`, 'LED_Cyan',     x+0.06, z+0.06, y-0.12, w-0.12, h-0.12, 0.05);
      obj.box(`${nm}_BrassTrim`,'Metal_Brass',  x-0.05, z+h,  y-0.15, w+0.10, 0.04,   0.22);
      break;

    case 'reception_desk':
      obj.box(`${nm}_Body`,     'Wood_Walnut', x-w/2, z, y-d/2, w,    h,    d);
      obj.box(`${nm}_Top`,      'Metal_Brass', x-w/2, z+h, y-d/2, w,   0.04, d);
      obj.box(`${nm}_CyanBar`,  'LED_Cyan',    x-w/2+0.08, z+0.16, y-d/2-0.01, w-0.16, 0.06, 0.02);
      obj.box(`${nm}_BackPanel`,'Wood_Walnut', x-w/2, z+h, y+d/2-0.06, w, 0.55, 0.06);
      break;

    case 'kiosk':
      obj.box(`${nm}_Base`,    'Wood_Oak',    x-w/2-0.06, z-0.08, y-w/2-0.06, w+0.12, 0.08, w+0.12);
      obj.box(`${nm}_Body`,    'Wood_Walnut', x-w/2, z, y-w/2, w, h, w);
      obj.box(`${nm}_Screen`,  'Screen_Backlit', x-w/2+0.08, z+0.28, y-w/2-0.04, w-0.16, 0.46, 0.04);
      obj.box(`${nm}_TopGlow`, 'LED_Cyan',   x-w/2-0.01, z+h, y-w/2-0.01, w+0.02, 0.04, w+0.02);
      obj.box(`${nm}_OrangeRing`,'Omantel_Orange', x-w/2-0.03, z, y-w/2-0.03, w+0.06, 0.04, w+0.06);
      break;

    case 'pergola': {
      const pw = w; const pd2 = d; const ph = 0.22;
      const px = x;  const py = y; const pz = z;
      obj.box(`${nm}_Back`,  'Wood_Walnut', px, pz, py+pd2-0.28, pw, ph, 0.28);
      obj.box(`${nm}_Front`, 'Wood_Walnut', px, pz, py, pw, ph, 0.28);
      obj.box(`${nm}_Left`,  'Wood_Walnut', px, pz, py, 0.28, ph, pd2);
      obj.box(`${nm}_Right`, 'Wood_Walnut', px+pw-0.28, pz, py, 0.28, ph, pd2);
      const crossCount = Math.max(2, Math.round(pw / 1.2));
      for (let i = 1; i < crossCount; i++) {
        const cx = px + (pw / crossCount) * i;
        obj.box(`${nm}_Cross_${i}`, 'Wood_Walnut', cx-0.06, pz, py, 0.12, ph*0.7, pd2);
      }
      obj.box(`${nm}_GlowStrip`, 'LED_Cyan', px+0.30, pz+ph, py+0.28, pw-0.60, 0.025, pd2-0.56);
      break;
    }

    case 'round_table':
    case 'high_table':
      obj.cylinder(`${nm}_Top`,  'Wood_Walnut', x, y, z+h-0.04, r, 0.04, 24);
      obj.cylinder(`${nm}_Stem`, 'Metal_Brass', x, y, z+0.04,   0.032, h-0.08, 10);
      obj.cylinder(`${nm}_Base`, 'Metal_Brass', x, y, z,        r*0.55, 0.04, 20);
      break;

    case 'stool':
      obj.cylinder(`${nm}_Seat`, 'Wood_Walnut', x, y, z+h-0.04, 0.19, 0.04, 18);
      obj.cylinder(`${nm}_Stem`, 'Metal_Brass', x, y, z+0.04,   0.025, h-0.08, 8);
      obj.cylinder(`${nm}_Base`, 'Metal_Brass', x, y, z,        0.14, 0.04, 16);
      break;

    case 'sofa':
      obj.box(`${nm}_Seat`, 'Upholstery_Teal', x-w/2, z,      y-d/2, w, 0.38, d);
      obj.box(`${nm}_Back`, 'Upholstery_Teal', x-w/2, z+0.38, y+d/2-0.12, w, 0.50, 0.12);
      obj.box(`${nm}_ArmL`, 'Upholstery_Teal', x-w/2, z+0.38, y-d/2, 0.10, 0.26, d);
      obj.box(`${nm}_ArmR`, 'Upholstery_Teal', x+w/2-0.10, z+0.38, y-d/2, 0.10, 0.26, d);
      break;

    case 'screen_panel':
      obj.box(`${nm}_Frame`,   'Metal_Black_Matte', x-0.04, z, y-0.07, w+0.08, h+0.08, 0.14);
      obj.box(`${nm}_Display`, 'Screen_Backlit',    x,      z+0.04, y-0.05, w,    h,    0.05);
      break;

    case 'palm_tree':
      obj.cylinder(`${nm}_Pot`,   'Planter_Black', x, y, z,          0.24, 0.38, 16);
      obj.cylinder(`${nm}_Trunk`, 'Wood_Oak',      x, y, z+0.38,     0.065, h-0.38, 8);
      obj.cylinder(`${nm}_Crown`, 'Plant_Green',   x, y, z+h-0.15,  r*0.70, 0.80, 14);
      break;

    case 'planter':
      obj.cylinder(`${nm}_Pot`,   'Planter_Black', x, y, z,     r, h, 16);
      obj.cylinder(`${nm}_Plant`, 'Plant_Green',   x, y, z+h,   r*0.85, r*0.90, 12);
      break;

    case 'mashrabiya_panel':
      obj.box(`${nm}_Frame`, 'Wood_Walnut', x-w/2-0.04, z-0.04, y-0.04, w+0.08, h+0.08, 0.08);
      obj.box(`${nm}_Body`,  'Metal_Black_Matte', x-w/2, z, y, w, h, 0.04);
      for (let gi = 1; gi <= 5; gi++) {
        obj.box(`${nm}_H${gi}`, 'Metal_Brass', x-w/2, z + (h/6)*gi - 0.015, y, w, 0.03, 0.02);
      }
      for (let gj = 1; gj <= 3; gj++) {
        obj.box(`${nm}_V${gj}`, 'Metal_Brass', x-w/2 + (w/4)*gj - 0.015, z, y, 0.03, h, 0.02);
      }
      break;

    case 'arch':
      // Floor path (cyan)
      if (nm.toLowerCase().includes('path')) {
        obj.box(`${nm}_Seg1`, 'LED_Cyan', x, z, y,      w, 0.002, d*0.35);
        obj.box(`${nm}_Seg2`, 'LED_Cyan', x, z, y+d*0.35, w*0.9, 0.002, d*0.35);
        obj.box(`${nm}_Seg3`, 'LED_Cyan', x+w*0.05, z, y+d*0.70, w*0.8, 0.002, d*0.30);
      } else {
        obj.box(nm, 'Wall_White', x-w/2, z, y, w, h, d);
      }
      break;

    default:
      obj.box(nm, 'Wall_White', x, z, y, Math.max(w,0.1), Math.max(h,0.1), Math.max(d,0.1));
  }
}

// ─── Main Generator ────────────────────────────────────────────────────────────

export function generateOBJ(config: BoothConfig): string {
  const obj = new OBJBuilder();
  obj.header(config);
  for (const el of config.elements) {
    buildElement(obj, el);
  }
  return obj.toString();
}

export function generateOBJFilename(config: BoothConfig): string {
  return `${config.boothName.replace(/\s+/g, '_')}.obj`;
}

export function generateMTLFilename(config: BoothConfig): string {
  return `${config.boothName.replace(/\s+/g, '_')}.mtl`;
}
