import { BoothConfig, BoothElement, CameraScene } from './types';

// ─── Twinmotion Material Library ──────────────────────────────────────────────
// Maps our material names to Twinmotion's built-in library paths

interface TwinMotionMaterial {
  library: string;    // Twinmotion material library path
  roughness: number;  // 0-1
  metallic: number;   // 0-1
  emissive?: boolean;
  emissiveIntensity?: number;
  color?: string;     // hex
  opacity?: number;   // 0-1
}

const MATERIAL_MAP: Record<string, TwinMotionMaterial> = {
  'Floor_Concrete':     { library: 'Concrete/Polished Concrete Light', roughness: 0.85, metallic: 0.0 },
  'Floor_Carpet_Blue':  { library: 'Fabric/Carpet Dark Blue',           roughness: 0.95, metallic: 0.0, color: '#0D1F59' },
  'Wall_White':         { library: 'Plaster/White Plaster Smooth',      roughness: 0.88, metallic: 0.0 },
  'Wall_DeepNavy':      { library: 'Plaster/Dark Painted Wall',         roughness: 0.85, metallic: 0.0, color: '#0A1A30' },
  'Wood_Walnut':        { library: 'Wood/Walnut Dark',                  roughness: 0.82, metallic: 0.0 },
  'Wood_Oak':           { library: 'Wood/Oak Natural',                  roughness: 0.80, metallic: 0.0 },
  'Metal_Brass':        { library: 'Metal/Polished Gold',               roughness: 0.25, metallic: 0.88, color: '#A88448' },
  'Metal_Black_Matte':  { library: 'Metal/Black Anodized',              roughness: 0.90, metallic: 0.85 },
  'LED_Cyan':           { library: 'Emissive/Neon Blue',                roughness: 0.1,  metallic: 0.0, emissive: true, emissiveIntensity: 8.0, color: '#00E0D8' },
  'Screen_Dark':        { library: 'Glass/Dark Tinted Glass',           roughness: 0.05, metallic: 0.2, opacity: 0.9 },
  'Screen_Backlit':     { library: 'Emissive/Screen Backlit',           roughness: 0.05, metallic: 0.0, emissive: true, emissiveIntensity: 4.0, color: '#00D4E8' },
  'Omantel_Orange':     { library: 'Plastic/Matte Orange',              roughness: 0.75, metallic: 0.0, color: '#F47C2C' },
  'Gold_Accent':        { library: 'Metal/Polished Gold',               roughness: 0.20, metallic: 0.92, color: '#D4A437' },
  'Upholstery_Teal':    { library: 'Fabric/Velvet Dark Teal',           roughness: 0.97, metallic: 0.0, color: '#007A82' },
  'Glass_Clear':        { library: 'Glass/Clear Glass',                 roughness: 0.02, metallic: 0.0, opacity: 0.15 },
  'Plant_Green':        { library: 'Vegetation/Tropical Leaves',        roughness: 0.94, metallic: 0.0 },
  'Planter_Black':      { library: 'Ceramic/Matte Black Ceramic',       roughness: 0.88, metallic: 0.0 },
};

// ─── Sky Presets per Style ─────────────────────────────────────────────────────

interface SkyPreset {
  name: string;
  timeOfDay: number;    // 0-24 decimal
  sunIntensity: number; // 0-100
  skyExposure: number;  // EV
  cloudCover: number;   // 0-1
  ambientOcclusion: number;
  description: string;
}

const SKY_PRESETS: Record<string, SkyPreset> = {
  corporate: {
    name: 'Studio Overcast',
    timeOfDay: 10.5,
    sunIntensity: 65,
    skyExposure: 14.0,
    cloudCover: 0.7,
    ambientOcclusion: 0.8,
    description: 'Clean overcast light — eliminates harsh shadows, good for product-style booth photography',
  },
  luxury: {
    name: 'Golden Hour Interior',
    timeOfDay: 18.5,
    sunIntensity: 45,
    skyExposure: 13.5,
    cloudCover: 0.2,
    ambientOcclusion: 0.9,
    description: 'Warm golden tones, dramatic contrast — emphasises brass and wood finishes',
  },
  pavilion: {
    name: 'Bright Midday',
    timeOfDay: 12.0,
    sunIntensity: 85,
    skyExposure: 15.0,
    cloudCover: 0.1,
    ambientOcclusion: 0.7,
    description: 'Full brightness, great for open pavilion structures and island booths',
  },
  organic: {
    name: 'Soft Morning',
    timeOfDay: 9.0,
    sunIntensity: 55,
    skyExposure: 13.2,
    cloudCover: 0.4,
    ambientOcclusion: 0.85,
    description: 'Gentle diffused light, flatters curved surfaces and natural materials',
  },
  modern: {
    name: 'Cool Afternoon',
    timeOfDay: 14.0,
    sunIntensity: 70,
    skyExposure: 14.5,
    cloudCover: 0.3,
    ambientOcclusion: 0.75,
    description: 'Clean cool light, good for tech and modern minimal booths',
  },
  industrial: {
    name: 'Dramatic Dusk',
    timeOfDay: 20.0,
    sunIntensity: 30,
    skyExposure: 12.5,
    cloudCover: 0.5,
    ambientOcclusion: 0.95,
    description: 'Low moody light, emphasises metal textures and LED accents',
  },
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

let _uid = 1000;
const uid = () => `{${(_uid++).toString(16).toUpperCase().padStart(8, '0')}-0000-0000-0000-000000000000}`;

function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function colorToRGB(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16) / 255,
    g: parseInt(h.slice(2, 4), 16) / 255,
    b: parseInt(h.slice(4, 6), 16) / 255,
  };
}

function mToUE(meters: number): number {
  // Unreal Engine units: 1 UE unit = 1 cm → meters * 100
  return meters * 100;
}

// ─── Mesh Generator ────────────────────────────────────────────────────────────

function elementToMeshes(el: BoothElement): Array<{
  id: string;
  name: string;
  materialName: string;
  tx: number; ty: number; tz: number;
  sx: number; sy: number; sz: number;
  layer: string;
}> {
  const meshes: Array<{id: string; name: string; materialName: string; tx: number; ty: number; tz: number; sx: number; sy: number; sz: number; layer: string}> = [];
  const x = mToUE(el.position.x);
  const y = mToUE(el.position.y);
  const z = mToUE(el.position.z ?? 0);

  const w = mToUE(el.dimensions.width ?? 1);
  const d = mToUE(el.dimensions.depth ?? 0.14);
  const h = mToUE(el.dimensions.height ?? 3);

  function push(name: string, mat: string, tx: number, ty: number, tz: number, sx: number, sy: number, sz: number, layer: string) {
    meshes.push({ id: uid(), name: xmlEscape(name), materialName: mat, tx, ty, tz, sx, sy, sz, layer });
  }

  switch (el.type) {
    case 'floor':
      push(`${el.label ?? 'Floor'}`, 'Floor_Carpet_Blue', x + w / 2, y + d / 2, -5, w, d, 10, 'Structure');
      break;
    case 'back_wall':
      push('Wall_Back', 'Wall_DeepNavy', x + w / 2, y + d / 2, z + h / 2, w, d, h, 'Walls');
      break;
    case 'side_wall_left':
      push('Wall_Left', 'Wall_White', x + w / 2, y + d / 2, z + h / 2, w, d, h, 'Walls');
      break;
    case 'side_wall_right':
      push('Wall_Right', 'Wall_White', x + w / 2, y + d / 2, z + h / 2, w, d, h, 'Walls');
      break;
    case 'pillar_wall':
      push(`${el.label ?? 'Pillar'}_Frame`,  'Wood_Walnut',    x, y, z + h / 2, w, d + 2, h + 10, 'Walls');
      push(`${el.label ?? 'Pillar'}_Inset`,  'Metal_Black_Matte', x, y - 1, z + h / 2, w - 10, d, h - 10, 'Walls');
      if (el.hasScreen) {
        const scW = mToUE(el.screenSize?.width ?? 1.1);
        const scH = mToUE(el.screenSize?.height ?? 1.5);
        push(`${el.label ?? 'Pillar'}_Screen`, 'Screen_Backlit', x, y - d / 2 - 3, mToUE(0.3) + scH / 2, scW, 5, scH, 'Screens');
        push(`${el.label ?? 'Pillar'}_GlowStrip`, 'LED_Cyan', x, y - d / 2 - 3, mToUE(0.3) + scH + 15, scW, 3, 10, 'Lighting');
      }
      push(`${el.label ?? 'Pillar'}_BrassTop`, 'Metal_Brass', x, y, z + h + 2, w + 5, d + 5, 5, 'Walls');
      push(`${el.label ?? 'Pillar'}_Plinth`, 'Wood_Oak', x, y, -12, w + 10, d + 4, 12, 'Structure');
      break;
    case 'header_fascia':
      push('Header_Frame',      'Wood_Walnut',  x, y, z + h / 2, w + 12, 22, h, 'Walls');
      push('Header_CyanGlow',   'LED_Cyan',     x, y - 3,  z + h / 2, w - 16, 6, h - 22, 'Lighting');
      push('Header_BrassTrim',  'Metal_Brass',  x, y, z + h + 2, w + 12, 22, 4, 'Walls');
      break;
    case 'display_tower':
      push(`${el.label ?? 'Column'}`, el.label?.toLowerCase().includes('orange') ? 'Omantel_Orange' : 'Metal_Black_Matte', x + w / 2, y + d / 2, z + h / 2, w, d, h, 'Structure');
      break;
    case 'reception_desk':
      push('Reception_Body',    'Wood_Walnut',  x, y, z + h / 2, w, d, h, 'Furniture');
      push('Reception_Top',     'Metal_Brass',  x, y, z + h + 2, w, d, 4, 'Furniture');
      push('Reception_CyanBar', 'LED_Cyan',     x, y - d / 2, mToUE(0.18), w - 20, 2, 6, 'Lighting');
      push('Reception_Back',    'Wood_Walnut',  x, y + d / 2 - 5, z + h + 20, w, 5, 55, 'Furniture');
      break;
    case 'kiosk':
      push('Kiosk_Body',    'Wood_Walnut',    x, y, z + h / 2, w, w, h, 'Furniture');
      push('Kiosk_Screen',  'Screen_Backlit', x, y - w / 2 - 3, mToUE(0.3) + 22, w - 16, 5, 45, 'Screens');
      push('Kiosk_TopGlow', 'LED_Cyan',       x, y, z + h + 3, w + 4, w + 4, 3, 'Lighting');
      push('Kiosk_Base',    'Wood_Oak',       x, y, -8, w + 10, w + 10, 8, 'Structure');
      break;
    case 'pergola':
      push('Pergola_Back',    'Wood_Walnut', x + w / 2, y + d - 15, z + 11, w, 30, 22, 'Ceiling');
      push('Pergola_Front',   'Wood_Walnut', x + w / 2, y + 15, z + 11, w, 30, 22, 'Ceiling');
      push('Pergola_Left',    'Wood_Walnut', x + 15, y + d / 2, z + 11, 30, d, 22, 'Ceiling');
      push('Pergola_Right',   'Wood_Walnut', x + w - 15, y + d / 2, z + 11, 30, d, 22, 'Ceiling');
      push('Pergola_GlowRun', 'LED_Cyan',   x + w / 2, y + d / 2, z + 15, w - 30, 4, 3, 'Lighting');
      break;
    case 'sofa':
      push('Sofa_Seat',  'Upholstery_Teal', x, y, z + 19, w, d, 38, 'Furniture');
      push('Sofa_Back',  'Upholstery_Teal', x, y + d / 2 - 6, z + 38 + 25, w, 12, 50, 'Furniture');
      push('Sofa_ArmL',  'Upholstery_Teal', x - w / 2 + 5, y, z + 38 + 13, 10, d, 26, 'Furniture');
      push('Sofa_ArmR',  'Upholstery_Teal', x + w / 2 - 5, y, z + 38 + 13, 10, d, 26, 'Furniture');
      break;
    case 'round_table':
    case 'high_table':
      push(`Table_${el.id}_Top`,  'Wood_Walnut', x, y, z + h - 4, mToUE((el.dimensions.radius ?? 0.38) * 2), mToUE((el.dimensions.radius ?? 0.38) * 2), 4, 'Furniture');
      push(`Table_${el.id}_Stem`, 'Metal_Brass', x, y, z + h / 2, 5, 5, h - 8, 'Furniture');
      push(`Table_${el.id}_Base`, 'Metal_Brass', x, y, 4, mToUE(0.36), mToUE(0.36), 4, 'Furniture');
      break;
    case 'stool':
      push(`Stool_${el.id}_Seat`, 'Wood_Walnut', x, y, z + h - 4, mToUE(0.37), mToUE(0.37), 4, 'Furniture');
      push(`Stool_${el.id}_Stem`, 'Metal_Brass', x, y, z + h / 2, 5, 5, h - 8, 'Furniture');
      push(`Stool_${el.id}_Base`, 'Metal_Brass', x, y, 4, mToUE(0.30), mToUE(0.30), 4, 'Furniture');
      break;
    case 'screen_panel':
      push(`Screen_${el.id}_Frame`,   'Metal_Black_Matte', x, y, z + h / 2, w + 10, 14, h + 14, 'Walls');
      push(`Screen_${el.id}_Display`, 'Screen_Backlit',    x, y - 3, z + h / 2, w, 5, h - 6, 'Screens');
      break;
    case 'palm_tree':
      push(`Palm_${el.id}_Pot`,   'Planter_Black', x, y, mToUE(0.19), mToUE(0.48), mToUE(0.48), mToUE(0.38), 'Landscaping');
      push(`Palm_${el.id}_Trunk`, 'Wood_Oak',      x, y, mToUE(0.38) + mToUE((el.dimensions.height ?? 1.6) * 0.5), mToUE(0.13), mToUE(0.13), mToUE((el.dimensions.height ?? 1.6) - 0.38), 'Landscaping');
      push(`Palm_${el.id}_Crown`, 'Plant_Green',   x, y, mToUE(el.dimensions.height ?? 1.6), mToUE(1.1), mToUE(1.1), mToUE(0.9), 'Landscaping');
      break;
    case 'planter':
      push(`Planter_${el.id}_Pot`,   'Planter_Black', x, y, mToUE(0.20), mToUE(0.44), mToUE(0.44), mToUE(0.40), 'Landscaping');
      push(`Planter_${el.id}_Plant`, 'Plant_Green',   x, y, mToUE(0.44), mToUE(0.38), mToUE(0.38), mToUE(0.36), 'Landscaping');
      break;
    case 'mashrabiya_panel':
      push(`Mash_${el.id}_Frame`, 'Wood_Walnut', x, y, z + h / 2, w + 8, 8, h + 8, 'Walls');
      push(`Mash_${el.id}_Latt`,  'Metal_Brass', x, y - 1, z + h / 2, w, 4, h, 'Walls');
      break;
    default:
      push(el.label ?? el.id, 'Wall_White', x, y, z + h / 2, w, d, h, 'Structure');
  }

  return meshes;
}

// ─── Light Generator ───────────────────────────────────────────────────────────

interface DSLight {
  id: string;
  name: string;
  type: 'Point' | 'Spot' | 'Directional' | 'Area';
  tx: number; ty: number; tz: number;
  intensity: number;
  r: number; g: number; b: number;
  temperature: number;
  radius?: number;
}

function generateLights(config: BoothConfig): DSLight[] {
  const lights: DSLight[] = [];
  const W = mToUE(config.width);
  const D = mToUE(config.depth);
  const H = mToUE(config.wallHeight);

  // Main fill light
  lights.push({ id: uid(), name: 'Light_Main_Fill', type: 'Area', tx: W / 2, ty: D * 0.3, tz: H * 1.4, intensity: 8000, r: 1.0, g: 0.98, b: 0.94, temperature: 5600 });
  lights.push({ id: uid(), name: 'Light_Rim', type: 'Area', tx: W * 0.8, ty: D * 0.9, tz: H * 0.9, intensity: 3000, r: 0.7, g: 0.8, b: 1.0, temperature: 7000 });
  lights.push({ id: uid(), name: 'Light_Bounce', type: 'Area', tx: W / 2, ty: D / 2, tz: 5, intensity: 1500, r: 0.95, g: 0.90, b: 0.80, temperature: 4000 });

  // Per-element lights
  config.elements.forEach(el => {
    const x = mToUE(el.position.x);
    const y = mToUE(el.position.y);
    const h = mToUE(el.dimensions.height ?? 3);

    if (el.type === 'pillar_wall') {
      lights.push({ id: uid(), name: `Light_Screen_${el.id}`, type: 'Point', tx: x, ty: y - 30, tz: h * 0.5, intensity: 500, r: 0.0, g: 0.85, b: 0.9, temperature: 8000, radius: 20 });
    }
    if (el.type === 'kiosk') {
      lights.push({ id: uid(), name: `Light_Kiosk_${el.id}`, type: 'Point', tx: x, ty: y - 20, tz: mToUE(0.6), intensity: 400, r: 0.0, g: 0.85, b: 0.9, temperature: 8000, radius: 15 });
    }
    if (el.type === 'reception_desk') {
      lights.push({ id: uid(), name: `Light_Reception_${el.id}`, type: 'Spot', tx: x, ty: y - 30, tz: mToUE(1.4), intensity: 600, r: 1.0, g: 0.95, b: 0.85, temperature: 3200, radius: 25 });
    }
    if (el.type === 'header_fascia') {
      lights.push({ id: uid(), name: `Light_Header_${el.id}`, type: 'Area', tx: x, ty: y - 20, tz: mToUE((el.position.z ?? 2.6) + 0.2), intensity: 1200, r: 0.0, g: 0.88, b: 0.86, temperature: 8500 });
    }
  });

  return lights;
}

// ─── Camera Generator ──────────────────────────────────────────────────────────

interface DSCamera {
  id: string;
  name: string;
  tx: number; ty: number; tz: number;
  pitch: number; yaw: number; roll: number;
  fov: number;
  dofEnabled: boolean;
  focalDistance: number;
  isActive: boolean;
}

function generateCameras(scenes: CameraScene[]): DSCamera[] {
  return scenes.map((s, i) => {
    const dx = s.target.x - s.eye.x;
    const dy = s.target.y - s.eye.y;
    const dz = (s.target.z ?? 1.2) - (s.eye.z ?? 5);
    const yaw   = Math.atan2(dx, dy) * (180 / Math.PI);
    const dist  = Math.sqrt(dx * dx + dy * dy);
    const pitch = -Math.atan2(dz, dist) * (180 / Math.PI);
    return {
      id: uid(),
      name: xmlEscape(s.name),
      tx: mToUE(s.eye.x),
      ty: mToUE(s.eye.y),
      tz: mToUE(s.eye.z ?? 5),
      pitch: Math.round(pitch * 100) / 100,
      yaw:   Math.round(yaw   * 100) / 100,
      roll:  0,
      fov:   i === scenes.length - 1 ? 90 : 60,
      dofEnabled: i !== scenes.length - 1,
      focalDistance: Math.sqrt(dx * dx + dy * dy + dz * dz) * 100,
      isActive: i === 0,
    };
  });
}

// ─── Datasmith XML Builder ────────────────────────────────────────────────────

function buildMaterialsXML(config: BoothConfig): string {
  const usedMats = new Set<string>();
  config.elements.forEach(el => {
    const meshes = elementToMeshes(el);
    meshes.forEach(m => usedMats.add(m.materialName));
  });
  // Always include standard materials
  ['Floor_Carpet_Blue', 'Wall_White', 'Wall_DeepNavy', 'LED_Cyan', 'Screen_Backlit', 'Metal_Brass', 'Wood_Walnut'].forEach(m => usedMats.add(m));

  return Array.from(usedMats).map(matName => {
    const mat = MATERIAL_MAP[matName] ?? { library: 'Plaster/White Plaster Smooth', roughness: 0.8, metallic: 0.0 };
    const rgb = mat.color ? colorToRGB(mat.color) : { r: 0.8, g: 0.8, b: 0.8 };
    const matId = uid();
    return `
  <UEPbrMaterial name="${xmlEscape(matName)}" label="${xmlEscape(matName)}" id="${matId}" twinmotionlibrary="${xmlEscape(mat.library)}">
    <Color name="Base Color" r="${rgb.r.toFixed(4)}" g="${rgb.g.toFixed(4)}" b="${rgb.b.toFixed(4)}" a="1.0"/>
    <Scalar name="Metallic" value="${mat.metallic.toFixed(4)}"/>
    <Scalar name="Roughness" value="${mat.roughness.toFixed(4)}"/>
    <Scalar name="Opacity" value="${(mat.opacity ?? 1.0).toFixed(4)}"/>
    ${mat.emissive ? `<Scalar name="EmissiveIntensity" value="${mat.emissiveIntensity ?? 4.0}"/>
    <Color name="EmissiveColor" r="${rgb.r.toFixed(4)}" g="${rgb.g.toFixed(4)}" b="${rgb.b.toFixed(4)}" a="1.0"/>` : ''}
  </UEPbrMaterial>`;
  }).join('\n');
}

function buildMeshActorsXML(config: BoothConfig): string {
  const xmlParts: string[] = [];
  config.elements.forEach(el => {
    const meshes = elementToMeshes(el);
    meshes.forEach(mesh => {
      xmlParts.push(`
  <MeshActor name="${mesh.name}" label="${mesh.name}" id="${mesh.id}" layer="${mesh.layer}">
    <Transform tx="${mesh.tx.toFixed(2)}" ty="${mesh.ty.toFixed(2)}" tz="${mesh.tz.toFixed(2)}" rx="0" ry="0" rz="0" sx="${mesh.sx.toFixed(2)}" sy="${mesh.sy.toFixed(2)}" sz="${mesh.sz.toFixed(2)}"/>
    <Material name="${xmlEscape(mesh.materialName)}" id="${mesh.id}_mat" slot="0"/>
    <MeshElement label="${mesh.name}_mesh" staticmesh="${mesh.name}_mesh"/>
    <tag value="${mesh.layer}"/>
  </MeshActor>`);
    });
  });
  return xmlParts.join('\n');
}

function buildLightsXML(lights: DSLight[]): string {
  return lights.map(l => `
  <PointLight name="${l.name}" label="${l.name}" id="${l.id}" type="${l.type}">
    <Transform tx="${l.tx.toFixed(2)}" ty="${l.ty.toFixed(2)}" tz="${l.tz.toFixed(2)}" rx="-90" ry="0" rz="0" sx="1" sy="1" sz="1"/>
    <Intensity value="${l.intensity}"/>
    <Color r="${l.r.toFixed(4)}" g="${l.g.toFixed(4)}" b="${l.b.toFixed(4)}" a="1.0"/>
    <Temperature value="${l.temperature}"/>
    ${l.radius ? `<AttenuationRadius value="${l.radius}"/>` : ''}
    <CastShadow enabled="true"/>
  </PointLight>`).join('\n');
}

function buildCamerasXML(cameras: DSCamera[]): string {
  return cameras.map(c => `
  <Camera name="${c.name}" label="${c.name}" id="${c.id}" ${c.isActive ? 'active="true"' : ''}>
    <Transform tx="${c.tx.toFixed(2)}" ty="${c.ty.toFixed(2)}" tz="${c.tz.toFixed(2)}" rx="${c.pitch.toFixed(2)}" ry="${c.yaw.toFixed(2)}" rz="${c.roll}"/>
    <FieldOfView value="${c.fov}"/>
    <DepthOfField enabled="${c.dofEnabled}" focalDistance="${c.focalDistance.toFixed(1)}" fstop="2.8"/>
    <PostProcess>
      <Exposure mode="Manual" ev="${c.isActive ? '13.5' : '14.0'}"/>
      <Bloom enabled="true" intensity="0.3"/>
      <Vignette enabled="true" intensity="0.4"/>
      <ChromaticAberration enabled="false"/>
      <TemperatureType>WhiteBalance</TemperatureType>
      <WhiteBalance value="6500"/>
    </PostProcess>
  </Camera>`).join('\n');
}

// ─── Main Generator ────────────────────────────────────────────────────────────

export function generateDatasmithFile(config: BoothConfig): string {
  const sky = SKY_PRESETS[config.style] ?? SKY_PRESETS.corporate;
  const lights = generateLights(config);
  const cameras = generateCameras(config.scenes);
  const W = mToUE(config.width);
  const D = mToUE(config.depth);

  return `<?xml version="1.0" encoding="UTF-8"?>
<DatasmithUnrealScene>

  <!-- ═══════════════════════════════════════════════════════════════════════
       BOOTH FORGE — Twinmotion Datasmith Export
       Project  : ${xmlEscape(config.projectName)}
       Client   : ${xmlEscape(config.clientName)}
       Booth    : ${xmlEscape(config.boothName)}
       Size     : ${config.width}m × ${config.depth}m × ${config.wallHeight}m
       Style    : ${config.style}
       Generated: ${new Date().toISOString()}

       HOW TO IMPORT INTO TWINMOTION:
       1. Save this file as: ${config.boothName.replace(/\s+/g, '_')}.udatasmith
       2. Open Twinmotion
       3. Import → Datasmith → select this file
       4. Materials auto-match Twinmotion library (may need manual confirm)
       5. Cameras appear in the Viewpoints panel
       6. Adjust sky if needed: ${sky.description}
  ═══════════════════════════════════════════════════════════════════════ -->

  <Version>0.27</Version>
  <SDKVersion>5.3</SDKVersion>
  <Host>BoothForge_MCP</Host>
  <DateTime>${new Date().toISOString()}</DateTime>
  <Name>${xmlEscape(config.boothName)}</Name>
  <ResourcePath>.</ResourcePath>

  <!-- ─── SCENE SETTINGS ─────────────────────────────────────────────── -->
  <SceneSettings>
    <Units unit="cm"/>
    <Geolocation lat="23.5880" lng="58.3829" elevation="0" city="Muscat" country="Oman"/>
  </SceneSettings>

  <!-- ─── SKY / ENVIRONMENT ──────────────────────────────────────────── -->
  <Environment>
    <Sky type="SunSky">
      <TimeOfDay value="${sky.timeOfDay}"/>
      <SunIntensity value="${sky.sunIntensity}"/>
      <SkyExposure ev="${sky.skyExposure}"/>
      <CloudCover value="${sky.cloudCover}"/>
      <SunTemperature value="5600"/>
      <SkyTemperature value="7500"/>
    </Sky>
    <Fog enabled="false"/>
    <GlobalIllumination mode="PathTracing" bounces="3"/>
    <AmbientOcclusion intensity="${sky.ambientOcclusion}" radius="200"/>
    <Bloom enabled="true" intensity="0.25"/>
    <ReflectionCapture enabled="true"/>
  </Environment>

  <!-- ─── RENDER SETTINGS (4K, Path Traced) ──────────────────────────── -->
  <RenderSettings>
    <Resolution width="3840" height="2160"/>
    <Quality mode="PathTracing" samples="512"/>
    <OutputFormat format="PNG" hdr="false"/>
    <AntiAliasing mode="Temporal" samples="8"/>
    <LensDistortion enabled="false"/>
    <MotionBlur enabled="false"/>
    <DLSS enabled="true"/>
  </RenderSettings>

  <!-- ─── MATERIALS ──────────────────────────────────────────────────── -->
${buildMaterialsXML(config)}

  <!-- ─── MESH ACTORS ────────────────────────────────────────────────── -->
${buildMeshActorsXML(config)}

  <!-- ─── LIGHTS ─────────────────────────────────────────────────────── -->
${buildLightsXML(lights)}

  <!-- ─── CAMERAS / VIEWPOINTS ───────────────────────────────────────── -->
${buildCamerasXML(cameras)}

  <!-- ─── TWINMOTION HINTS ───────────────────────────────────────────── -->
  <TwinmotionHints>
    <Hint type="SkyPreset" value="${xmlEscape(sky.name)}" reason="${xmlEscape(sky.description)}"/>
    <Hint type="TimeOfDay" value="${sky.timeOfDay}" reason="Optimised for ${config.style} booth style"/>
    <Hint type="MaterialAutoMatch" value="true" reason="Material names match Twinmotion library"/>
    <Hint type="HeroCamera" value="${cameras[0]?.name ?? 'Entrance_View'}" reason="Best angle for client presentation"/>
    <Hint type="RenderMode" value="PathTracing" reason="Required for accurate LED glow and screen reflections"/>
  </TwinmotionHints>

  <!-- ─── LAYER / VISIBILITY GROUPS ─────────────────────────────────── -->
  <Layers>
    <Layer name="Structure" visible="true" locked="false"/>
    <Layer name="Walls" visible="true" locked="false"/>
    <Layer name="Ceiling" visible="true" locked="false"/>
    <Layer name="Furniture" visible="true" locked="false"/>
    <Layer name="Screens" visible="true" locked="false"/>
    <Layer name="Lighting" visible="true" locked="false"/>
    <Layer name="Landscaping" visible="true" locked="false"/>
  </Layers>

  <!-- ─── BOOTH METADATA ─────────────────────────────────────────────── -->
  <Metadata>
    <Entry key="BoothName" value="${xmlEscape(config.boothName)}"/>
    <Entry key="Client" value="${xmlEscape(config.clientName)}"/>
    <Entry key="Project" value="${xmlEscape(config.projectName)}"/>
    <Entry key="Width_m" value="${config.width}"/>
    <Entry key="Depth_m" value="${config.depth}"/>
    <Entry key="Height_m" value="${config.wallHeight}"/>
    <Entry key="Style" value="${config.style}"/>
    <Entry key="ElementCount" value="${config.elements.length}"/>
    <Entry key="CameraCount" value="${config.scenes.length}"/>
    <Entry key="GeneratedBy" value="Booth Forge MCP v1.0"/>
  </Metadata>

</DatasmithUnrealScene>`;
}

// ─── Twinmotion Setup Guide ────────────────────────────────────────────────────

export function generateTwinmotionGuide(config: BoothConfig): string {
  const sky = SKY_PRESETS[config.style] ?? SKY_PRESETS.corporate;
  return `# TWINMOTION SETUP GUIDE
# ${config.boothName} — ${config.clientName}
# Generated by Booth Forge MCP
${'─'.repeat(60)}

## 1. IMPORT
   File: ${config.boothName.replace(/\s+/g, '_')}.udatasmith
   Twinmotion → Import → Datasmith → select file
   ✓ Materials auto-match library
   ✓ Cameras load as Viewpoints
   ✓ Layers load as Visibility Groups

## 2. SKY PRESET: ${sky.name}
   Environment → Sky → ${sky.name}
   Time of Day : ${sky.timeOfDay}:00
   Sun Intensity: ${sky.sunIntensity}%
   Cloud Cover  : ${Math.round(sky.cloudCover * 100)}%
   Reason       : ${sky.description}

## 3. MATERIAL QUICK-CHECK
   These may need manual confirmation after import:
   • LED_Cyan       → Emissive/Neon Blue  — set Intensity: 8.0
   • Screen_Backlit → Emissive/Screen     — set Intensity: 4.0
   • Metal_Brass    → Metal/Polished Gold — Roughness: 0.25
   • Upholstery_Teal→ Fabric/Velvet Dark  — confirm color #007A82

## 4. RENDER SETTINGS (4K Path Traced)
   Render → Quality → Path Tracing
   Resolution  : 3840 × 2160
   Samples     : 512 (use 64 for preview)
   Output      : PNG
   DLSS        : ON (speeds up without quality loss)

## 5. CAMERA VIEWPOINTS
${config.scenes.map((s, i) => `   ${i + 1}. ${s.name}${i === 0 ? ' ← HERO SHOT' : ''}`).join('\n')}

   For hero shot:
   • DOF: ON — focus point on ${config.elements.find(e => e.type === 'kiosk' || e.type === 'reception_desk')?.label ?? 'main feature'}
   • f/stop: 2.8
   • Exposure: Manual 13.5 EV

## 6. FINAL RENDER CHECKLIST
   □ LED glow visible on cyan strips
   □ Screen panels emitting light (not flat)
   □ Reflections on brass/metal surfaces
   □ Floor reflection active
   □ Bloom: ON, Intensity 0.25
   □ Vignette: ON, Intensity 0.4
   □ Export at 4K PNG

${'─'.repeat(60)}
Booth Forge MCP · The Agency Oman
`;
}
