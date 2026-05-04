import { BoothConfig, BoothElement, CameraScene } from './types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function m(val: number): string {
  // Convert meters to the .m Ruby call (SketchUp inches via .m extension)
  return `${val.toFixed(4)}.m`;
}

function color(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `Sketchup::Color.new(${r}, ${g}, ${b})`;
}

function indent(code: string, spaces = 2): string {
  return code.split('\n').map(l => ' '.repeat(spaces) + l).join('\n');
}

// ─── Material Definitions ─────────────────────────────────────────────────────

function generateMaterials(): string {
  return `
# ─── MATERIALS ────────────────────────────────────────────────────────────────
mats = model.materials

def get_or_create_material(model, name, r, g, b, roughness_hint = nil)
  existing = model.materials[name]
  return existing if existing
  mat = model.materials.add(name)
  mat.color = Sketchup::Color.new(r, g, b)
  mat
end

MAT = {
  :floor_concrete  => get_or_create_material(model, "Floor_Concrete",      210, 210, 208),
  :wall_white      => get_or_create_material(model, "Wall_White",           248, 248, 246),
  :wall_navy       => get_or_create_material(model, "Wall_DeepNavy",         12,  26,  48),
  :wood_walnut     => get_or_create_material(model, "Wood_Walnut",            74,  42,  18),
  :wood_oak        => get_or_create_material(model, "Wood_Oak",             172, 138,  88),
  :brass           => get_or_create_material(model, "Metal_Brass",          168, 132,  72),
  :black_matte     => get_or_create_material(model, "Metal_Black_Matte",     26,  28,  32),
  :cyan_led        => get_or_create_material(model, "LED_Cyan",               0, 220, 216),
  :screen_dark     => get_or_create_material(model, "Screen_Dark",           14,  16,  22),
  :screen_glow     => get_or_create_material(model, "Screen_Backlit",          0, 210, 230),
  :velvet_teal     => get_or_create_material(model, "Upholstery_Teal",         0, 118, 128),
  :glass           => get_or_create_material(model, "Glass_Clear",           200, 220, 230),
  :plant_green     => get_or_create_material(model, "Plant_Green",            34, 120,  58),
  :planter_black   => get_or_create_material(model, "Planter_Black",          38,  38,  40),
  :carpet_mid      => get_or_create_material(model, "Carpet_Mid",            150, 152, 155),
  :carpet_red      => get_or_create_material(model, "Carpet_Red",            204,  17,  34),
  :stage_dark      => get_or_create_material(model, "Stage_Dark",             42,  42,  46),
}
`.trim();
}

// ─── Layer Setup ──────────────────────────────────────────────────────────────

function generateLayers(): string {
  return `
# ─── LAYERS / TAGS ────────────────────────────────────────────────────────────
def get_or_add_layer(model, name)
  model.layers[name] || model.layers.add(name)
end

LAYERS = {
  :structure    => get_or_add_layer(model, "01_Structure"),
  :walls        => get_or_add_layer(model, "02_Walls"),
  :ceiling      => get_or_add_layer(model, "03_Ceiling"),
  :furniture    => get_or_add_layer(model, "04_Furniture"),
  :screens      => get_or_add_layer(model, "05_Screens"),
  :lighting     => get_or_add_layer(model, "06_Lighting_Accents"),
  :landscaping  => get_or_add_layer(model, "07_Landscaping"),
  :dimensions   => get_or_add_layer(model, "08_Dimensions"),
}
`.trim();
}

// ─── Helper Ruby Functions ────────────────────────────────────────────────────

function generateHelperFunctions(): string {
  return `
# ─── HELPER FUNCTIONS ─────────────────────────────────────────────────────────

def apply_material_to_group(group, mat)
  group.entities.grep(Sketchup::Face).each do |face|
    face.material = mat
    face.back_material = mat
  end
end

def make_box(entities, name, x, y, z, w, d, h, mat, layer)
  group = entities.add_group
  group.name = name
  group.layer = layer
  grp = group.entities
  pts = [
    Geom::Point3d.new(x, y, z),
    Geom::Point3d.new(x+w, y, z),
    Geom::Point3d.new(x+w, y+d, z),
    Geom::Point3d.new(x, y+d, z)
  ]
  face = grp.add_face(pts)
  face.reverse! if face.normal.z < 0
  face.pushpull(h)
  apply_material_to_group(group, mat)
  group
end

def make_cylinder(entities, name, cx, cy, z_bot, radius, height, mat, layer, segs = 24)
  group = entities.add_group
  group.name = name
  group.layer = layer
  grp = group.entities
  pts = []
  segs.times do |i|
    angle = 2.0 * Math::PI * i / segs
    pts << Geom::Point3d.new(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle), z_bot)
  end
  face = grp.add_face(pts)
  face.reverse! if face.normal.z < 0
  face.pushpull(height)
  apply_material_to_group(group, mat)
  group
end

def make_curved_wall(entities, name, cx, cy, radius, start_angle_deg, end_angle_deg, height, thickness, mat, layer, segs = 32)
  group = entities.add_group
  group.name = name
  group.layer = layer
  grp = group.entities

  sa = start_angle_deg * Math::PI / 180.0
  ea = end_angle_deg   * Math::PI / 180.0
  steps = segs

  outer_pts_bot, inner_pts_bot = [], []
  outer_pts_top, inner_pts_top = [], []

  (0..steps).each do |i|
    t = i.to_f / steps
    angle = sa + t * (ea - sa)
    ox = cx + (radius + thickness/2.0) * Math.cos(angle)
    oy = cy + (radius + thickness/2.0) * Math.sin(angle)
    ix = cx + (radius - thickness/2.0) * Math.cos(angle)
    iy = cy + (radius - thickness/2.0) * Math.sin(angle)
    outer_pts_bot << Geom::Point3d.new(ox, oy, 0)
    inner_pts_bot << Geom::Point3d.new(ix, iy, 0)
    outer_pts_top << Geom::Point3d.new(ox, oy, height)
    inner_pts_top << Geom::Point3d.new(ix, iy, height)
  end

  # Outer face
  n = steps + 1
  n.times do |i|
    next if i == 0
    quad = [outer_pts_bot[i-1], outer_pts_bot[i], outer_pts_top[i], outer_pts_top[i-1]]
    f = grp.add_face(quad) rescue nil
    f.material = mat if f
  end
  # Inner face
  n.times do |i|
    next if i == 0
    quad = [inner_pts_bot[i], inner_pts_bot[i-1], inner_pts_top[i-1], inner_pts_top[i]]
    f = grp.add_face(quad) rescue nil
    f.material = mat if f
  end
  # Top cap
  n.times do |i|
    next if i == 0
    quad = [outer_pts_top[i-1], inner_pts_top[i-1], inner_pts_top[i], outer_pts_top[i]]
    f = grp.add_face(quad) rescue nil
    f.material = mat if f
  end
  # End caps
  cap1 = [outer_pts_bot[0], inner_pts_bot[0], inner_pts_top[0], outer_pts_top[0]]
  cap2 = [inner_pts_bot[steps], outer_pts_bot[steps], outer_pts_top[steps], inner_pts_top[steps]]
  [cap1, cap2].each { |cap| grp.add_face(cap) rescue nil }

  apply_material_to_group(group, mat)
  group
end
`.trim();
}

// ─── Element Generators ───────────────────────────────────────────────────────

function genFloor(el: BoothElement, boothW: number, boothD: number): string {
  const h = el.dimensions.height ?? 0.05;
  const raised = el.dimensions.height && el.dimensions.height > 0.06;
  return `
# FLOOR PLATFORM
floor_group = make_box(entities, "Floor_Platform",
  0, 0, ${m(-h)},
  ${m(boothW)}, ${m(boothD)}, ${m(h)},
  MAT[:floor_concrete], LAYERS[:structure])
${raised ? `
# Raised edge trim (brass perimeter)
floor_trim_front = make_box(entities, "Floor_Trim_Front",
  0, 0, 0,
  ${m(boothW)}, ${m(0.04)}, ${m(0.025)},
  MAT[:brass], LAYERS[:structure])
floor_trim_back = make_box(entities, "Floor_Trim_Back",
  0, ${m(boothD - 0.04)}, 0,
  ${m(boothW)}, ${m(0.04)}, ${m(0.025)},
  MAT[:brass], LAYERS[:structure])` : ''}
`.trim();
}

function genBackWall(el: BoothElement, boothW: number): string {
  const h = el.dimensions.height ?? 3.0;
  const thickness = el.dimensions.thickness ?? 0.15;
  const y = el.position.y;
  return `
# BACK WALL
make_box(entities, "Wall_Back",
  0, ${m(y)}, 0,
  ${m(boothW)}, ${m(thickness)}, ${m(h)},
  MAT[:wall_white], LAYERS[:walls])
`.trim();
}

function genSideWall(el: BoothElement, boothD: number, side: 'left' | 'right'): string {
  const h = el.dimensions.height ?? 3.0;
  const thickness = el.dimensions.thickness ?? 0.15;
  const x = side === 'left' ? 0 : el.position.x;
  return `
# SIDE WALL ${side.toUpperCase()}
make_box(entities, "Wall_Side_${side.charAt(0).toUpperCase() + side.slice(1)}",
  ${m(x)}, 0, 0,
  ${m(thickness)}, ${m(boothD)}, ${m(h)},
  MAT[:wall_white], LAYERS[:walls])
`.trim();
}

function genCurvedWall(el: BoothElement): string {
  const cx = el.position.x;
  const cy = el.position.y;
  const r = el.dimensions.radius ?? 2.0;
  const arcDeg = el.dimensions.arcDeg ?? 180;
  const h = el.dimensions.height ?? 3.0;
  const thick = el.dimensions.thickness ?? 0.12;
  const startDeg = el.rotation ?? 0;
  const endDeg = startDeg + arcDeg;
  return `
# CURVED WALL: ${el.label ?? el.id}
make_curved_wall(entities, "${el.label ?? 'Curved_Wall'}",
  ${m(cx)}, ${m(cy)},
  ${m(r)},
  ${startDeg}, ${endDeg},
  ${m(h)}, ${m(thick)},
  MAT[:wall_white], LAYERS[:walls])
`.trim();
}

function genPillarWall(el: BoothElement): string {
  const cx = el.position.x;
  const cy = el.position.y;
  const w = el.dimensions.width ?? 1.8;
  const h = el.dimensions.height ?? 2.8;
  const d = el.dimensions.depth ?? 0.15;
  const rot = el.rotation ?? 0;
  const label = el.label ?? el.id;
  const scrW = el.screenSize?.width ?? 1.1;
  const scrH = el.screenSize?.height ?? 1.6;
  return `
# PILLAR WALL: ${label}
# Wood frame outer shell
pillar_${el.id} = make_box(entities, "Pillar_${label}_Frame",
  ${m(cx - w/2)}, ${m(cy - d/2)}, 0,
  ${m(w)}, ${m(d)}, ${m(h + 0.1)},
  MAT[:wood_walnut], LAYERS[:walls])
# Black inset panel
make_box(entities, "Pillar_${label}_Inset",
  ${m(cx - w/2 + 0.05)}, ${m(cy - d/2 - 0.01)}, ${m(0.1)},
  ${m(w - 0.10)}, ${m(d + 0.01)}, ${m(h)},
  MAT[:black_matte], LAYERS[:walls])
# LED screen (vertical)
make_box(entities, "Pillar_${label}_Screen",
  ${m(cx - scrW/2)}, ${m(cy - d/2 - 0.04)}, ${m(0.3)},
  ${m(scrW)}, ${m(0.04)}, ${m(scrH)},
  MAT[:screen_glow], LAYERS[:screens])
# Cyan header glow zone (label area above screen)
make_box(entities, "Pillar_${label}_Header",
  ${m(cx - scrW/2)}, ${m(cy - d/2 - 0.04)}, ${m(0.3 + scrH + 0.05)},
  ${m(scrW)}, ${m(0.04)}, ${m(0.18)},
  MAT[:cyan_led], LAYERS[:lighting])
# Brass trim top
make_box(entities, "Pillar_${label}_BrassTop",
  ${m(cx - w/2)}, ${m(cy - d/2 - 0.01)}, ${m(h + 0.05)},
  ${m(w)}, ${m(d + 0.01)}, ${m(0.05)},
  MAT[:brass], LAYERS[:walls])
# Brass trim bottom
make_box(entities, "Pillar_${label}_BrassBot",
  ${m(cx - w/2)}, ${m(cy - d/2 - 0.01)}, 0,
  ${m(w)}, ${m(d + 0.01)}, ${m(0.05)},
  MAT[:brass], LAYERS[:walls])
# Oak plinth base
make_box(entities, "Pillar_${label}_Plinth",
  ${m(cx - w/2 - 0.05)}, ${m(cy - d/2 - 0.02)}, ${m(-0.12)},
  ${m(w + 0.10)}, ${m(d + 0.04)}, ${m(0.12)},
  MAT[:wood_oak], LAYERS[:structure])
# Wall-mounted tablet at 1.2m
make_box(entities, "Pillar_${label}_Tablet",
  ${m(cx - 0.2)}, ${m(cy - d/2 - 0.07)}, ${m(1.15)},
  ${m(0.4)}, ${m(0.07)}, ${m(0.28)},
  MAT[:screen_dark], LAYERS[:screens])
`.trim();
}

function genReceptionDesk(el: BoothElement): string {
  const cx = el.position.x;
  const cy = el.position.y;
  const w = el.dimensions.width ?? 2.0;
  const d = el.dimensions.depth ?? 0.65;
  const h = el.dimensions.height ?? 1.1;
  return `
# RECEPTION DESK: ${el.label ?? 'Reception'}
# Main desk body
make_box(entities, "Reception_Body",
  ${m(cx - w/2)}, ${m(cy - d/2)}, 0,
  ${m(w)}, ${m(d)}, ${m(h)},
  MAT[:wood_walnut], LAYERS[:furniture])
# Brass top surface
make_box(entities, "Reception_BrassTop",
  ${m(cx - w/2)}, ${m(cy - d/2)}, ${m(h)},
  ${m(w)}, ${m(d)}, ${m(0.04)},
  MAT[:brass], LAYERS[:furniture])
# Cyan accent strip on front face
make_box(entities, "Reception_CyanStrip",
  ${m(cx - w/2 + 0.1)}, ${m(cy - d/2 - 0.01)}, ${m(0.18)},
  ${m(w - 0.2)}, ${m(0.02)}, ${m(0.06)},
  MAT[:cyan_led], LAYERS[:lighting])
# Back panel (signage zone)
make_box(entities, "Reception_BackPanel",
  ${m(cx - w/2)}, ${m(cy + d/2 - 0.05)}, ${m(h)},
  ${m(w)}, ${m(0.05)}, ${m(0.55)},
  MAT[:wood_walnut], LAYERS[:furniture])
# Logo plate on back panel
make_box(entities, "Reception_LogoPlate",
  ${m(cx - 0.35)}, ${m(cy + d/2 - 0.03)}, ${m(h + 0.15)},
  ${m(0.7)}, ${m(0.03)}, ${m(0.22)},
  MAT[:brass], LAYERS[:furniture])
`.trim();
}

function genKiosk(el: BoothElement): string {
  const cx = el.position.x;
  const cy = el.position.y;
  const sz = el.dimensions.width ?? 1.0;
  const h = el.dimensions.height ?? 1.05;
  return `
# FORESIGHT KIOSK: ${el.label ?? 'Kiosk'}
# Wide oak base
make_box(entities, "Kiosk_Base",
  ${m(cx - sz/2 - 0.05)}, ${m(cy - sz/2 - 0.05)}, ${m(-0.08)},
  ${m(sz + 0.1)}, ${m(sz + 0.1)}, ${m(0.08)},
  MAT[:wood_oak], LAYERS[:furniture])
# Brass ring
make_box(entities, "Kiosk_BrassRing",
  ${m(cx - sz/2 - 0.06)}, ${m(cy - sz/2 - 0.06)}, 0,
  ${m(sz + 0.12)}, ${m(sz + 0.12)}, ${m(0.04)},
  MAT[:brass], LAYERS[:furniture])
# Main body
make_box(entities, "Kiosk_Body",
  ${m(cx - sz/2)}, ${m(cy - sz/2)}, ${m(0.04)},
  ${m(sz)}, ${m(sz)}, ${m(h - 0.04)},
  MAT[:wood_walnut], LAYERS[:furniture])
# Front touchscreen
make_box(entities, "Kiosk_Screen",
  ${m(cx - sz/2 + 0.08)}, ${m(cy - sz/2 - 0.04)}, ${m(0.28)},
  ${m(sz - 0.16)}, ${m(0.04)}, ${m(0.46)},
  MAT[:screen_glow], LAYERS[:screens])
# Brass label plate
make_box(entities, "Kiosk_LabelPlate",
  ${m(cx - 0.22)}, ${m(cy - sz/2 - 0.035)}, ${m(0.78)},
  ${m(0.44)}, ${m(0.03)}, ${m(0.06)},
  MAT[:brass], LAYERS[:furniture])
# Top cap
make_box(entities, "Kiosk_TopCap",
  ${m(cx - sz/2 - 0.02)}, ${m(cy - sz/2 - 0.02)}, ${m(h)},
  ${m(sz + 0.04)}, ${m(sz + 0.04)}, ${m(0.06)},
  MAT[:wood_oak], LAYERS[:furniture])
# Cyan glow crown strips (all 4 sides)
[
  [${m(cx - sz/2)}, ${m(cy - sz/2 - 0.015)}, ${m(sz)}, ${m(0.015)}],
  [${m(cx - sz/2)}, ${m(cy + sz/2)}, ${m(sz)}, ${m(0.015)}],
].each_with_index do |strip, i|
  make_box(entities, "Kiosk_TopGlow_\#{i}",
    strip[0], strip[1], ${m(h + 0.01)},
    strip[2], strip[3], ${m(0.025)},
    MAT[:cyan_led], LAYERS[:lighting])
end
`.trim();
}

function genPergola(el: BoothElement, boothW: number, boothD: number): string {
  const h = el.dimensions.height ?? 2.75;
  const beamH = el.dimensions.depth ?? 0.22;
  const x1 = el.position.x ?? 0.2;
  const y1 = el.position.y ?? 0.3;
  const x2 = el.dimensions.width ? x1 + el.dimensions.width : boothW - 0.2;
  const y2 = el.dimensions.depth ? y1 + el.dimensions.depth : boothD - 0.3;
  const nCross = Math.max(3, Math.round((x2 - x1) / 1.2));
  const crossSpacing = (x2 - x1) / (nCross + 1);

  let crossBeams = '';
  for (let i = 1; i <= nCross; i++) {
    const bx = x1 + crossSpacing * i;
    crossBeams += `make_box(entities, "Pergola_Cross_${i}",
  ${m(bx - 0.06)}, ${m(y1)}, ${m(h)},
  ${m(0.12)}, ${m(y2 - y1)}, ${m(beamH * 0.7)},
  MAT[:wood_walnut], LAYERS[:ceiling])\n`;
  }

  const nGlow = nCross - 1;
  let glowStrips = '';
  for (let i = 1; i <= nGlow; i++) {
    const gx = x1 + crossSpacing * i + crossSpacing * 0.5;
    glowStrips += `make_box(entities, "Pergola_DownGlow_${i}",
  ${m(gx - 0.02)}, ${m(y1 + 0.2)}, ${m(h + 0.04)},
  ${m(0.04)}, ${m(y2 - y1 - 0.4)}, ${m(0.025)},
  MAT[:cyan_led], LAYERS[:lighting])\n`;
  }

  return `
# PERGOLA CEILING STRUCTURE
# Outer frame beams
make_box(entities, "Pergola_Beam_Back",
  ${m(x1)}, ${m(y2 - 0.28)}, ${m(h)},
  ${m(x2 - x1)}, ${m(0.28)}, ${m(beamH)},
  MAT[:wood_walnut], LAYERS[:ceiling])
make_box(entities, "Pergola_Beam_Front",
  ${m(x1)}, ${m(y1)}, ${m(h)},
  ${m(x2 - x1)}, ${m(0.28)}, ${m(beamH)},
  MAT[:wood_walnut], LAYERS[:ceiling])
make_box(entities, "Pergola_Beam_Left",
  ${m(x1)}, ${m(y1)}, ${m(h)},
  ${m(0.28)}, ${m(y2 - y1)}, ${m(beamH)},
  MAT[:wood_walnut], LAYERS[:ceiling])
make_box(entities, "Pergola_Beam_Right",
  ${m(x2 - 0.28)}, ${m(y1)}, ${m(h)},
  ${m(0.28)}, ${m(y2 - y1)}, ${m(beamH)},
  MAT[:wood_walnut], LAYERS[:ceiling])
# Black metal edge accent
make_box(entities, "Pergola_BlackEdge_Back",
  ${m(x1)}, ${m(y2 - 0.3)}, ${m(h - 0.02)},
  ${m(x2 - x1)}, ${m(0.04)}, ${m(0.06)},
  MAT[:black_matte], LAYERS[:ceiling])
make_box(entities, "Pergola_BlackEdge_Front",
  ${m(x1)}, ${m(y1 + 0.26)}, ${m(h - 0.02)},
  ${m(x2 - x1)}, ${m(0.04)}, ${m(0.06)},
  MAT[:black_matte], LAYERS[:ceiling])
# Cross beams
${crossBeams.trim()}
# Cyan downlight strips
${glowStrips.trim()}
`.trim();
}

function genHeaderFascia(el: BoothElement): string {
  const cx = el.position.x;
  const cy = el.position.y;
  const w = el.dimensions.width ?? 3.6;
  const h = el.dimensions.height ?? 0.55;
  const z = el.position.z ?? 2.3;
  return `
# BACKLIT HEADER FASCIA: ${el.label ?? 'Campaign Header'}
make_box(entities, "Header_WoodFrame",
  ${m(cx - w/2 - 0.06)}, ${m(cy - 0.12)}, ${m(z)},
  ${m(w + 0.12)}, ${m(0.22)}, ${m(h)},
  MAT[:wood_walnut], LAYERS[:walls])
make_box(entities, "Header_BacklitInner",
  ${m(cx - w/2)}, ${m(cy - 0.09)}, ${m(z + 0.06)},
  ${m(w)}, ${m(0.12)}, ${m(h - 0.12)},
  MAT[:wall_navy], LAYERS[:walls])
make_box(entities, "Header_CyanGlow",
  ${m(cx - w/2 + 0.08)}, ${m(cy - 0.075)}, ${m(z + 0.1)},
  ${m(w - 0.16)}, ${m(0.06)}, ${m(h - 0.22)},
  MAT[:cyan_led], LAYERS[:lighting])
make_box(entities, "Header_BrassTrim",
  ${m(cx - w/2 - 0.06)}, ${m(cy - 0.12)}, ${m(z + h)},
  ${m(w + 0.12)}, ${m(0.22)}, ${m(0.04)},
  MAT[:brass], LAYERS[:walls])
`.trim();
}

function genRoundTable(el: BoothElement): string {
  const cx = el.position.x;
  const cy = el.position.y;
  const r = el.dimensions.radius ?? 0.35;
  const h = el.dimensions.height ?? 0.74;
  const isHigh = h > 0.9;
  const stemR = isHigh ? 0.04 : 0.035;
  const baseR = isHigh ? 0.22 : 0.18;
  return `
# TABLE: ${el.label ?? el.id}
make_cylinder(entities, "Table_${el.id}_Top",
  ${m(cx)}, ${m(cy)}, ${m(h - 0.04)}, ${m(r)}, ${m(0.04)},
  MAT[:wood_walnut], LAYERS[:furniture])
make_cylinder(entities, "Table_${el.id}_Stem",
  ${m(cx)}, ${m(cy)}, ${m(0.04)}, ${m(stemR)}, ${m(h - 0.08)},
  MAT[:brass], LAYERS[:furniture])
make_cylinder(entities, "Table_${el.id}_Base",
  ${m(cx)}, ${m(cy)}, 0, ${m(baseR)}, ${m(0.04)},
  MAT[:brass], LAYERS[:furniture])
`.trim();
}

function genStool(el: BoothElement): string {
  const cx = el.position.x;
  const cy = el.position.y;
  const h = el.dimensions.height ?? 0.74;
  return `
# STOOL: ${el.id}
make_cylinder(entities, "Stool_${el.id}_Seat",
  ${m(cx)}, ${m(cy)}, ${m(h - 0.04)}, ${m(0.185)}, ${m(0.04)},
  MAT[:wood_walnut], LAYERS[:furniture])
make_cylinder(entities, "Stool_${el.id}_Stem",
  ${m(cx)}, ${m(cy)}, ${m(0.04)}, ${m(0.028)}, ${m(h - 0.08)},
  MAT[:brass], LAYERS[:furniture])
make_cylinder(entities, "Stool_${el.id}_Base",
  ${m(cx)}, ${m(cy)}, 0, ${m(0.15)}, ${m(0.04)},
  MAT[:brass], LAYERS[:furniture])
`.trim();
}

function genChair(el: BoothElement): string {
  const cx = el.position.x;
  const cy = el.position.y;
  const rot = el.rotation ?? 0;
  return `
# CHAIR: ${el.id}
# Seat
make_box(entities, "Chair_${el.id}_Seat",
  ${m(cx - 0.24)}, ${m(cy - 0.24)}, ${m(0.44)},
  ${m(0.48)}, ${m(0.48)}, ${m(0.05)},
  MAT[:black_matte], LAYERS[:furniture])
# Backrest
make_box(entities, "Chair_${el.id}_Back",
  ${m(cx - 0.22)}, ${m(cy + 0.2)}, ${m(0.44)},
  ${m(0.44)}, ${m(0.05)}, ${m(0.44)},
  MAT[:black_matte], LAYERS[:furniture])
# Legs (4)
[[${cx - 0.2}, ${cy - 0.2}], [${cx + 0.2}, ${cy - 0.2}], [${cx - 0.2}, ${cy + 0.2}], [${cx + 0.2}, ${cy + 0.2}]].each_with_index do |pos, i|
  make_box(entities, "Chair_${el.id}_Leg_\#{i}",
    pos[0].m - 0.015.m, pos[1].m - 0.015.m, 0,
    0.03.m, 0.03.m, 0.44.m,
    MAT[:black_matte], LAYERS[:furniture])
end
`.trim();
}

function genSofa(el: BoothElement): string {
  const cx = el.position.x;
  const cy = el.position.y;
  const w = el.dimensions.width ?? 1.8;
  const d = el.dimensions.depth ?? 0.72;
  return `
# SOFA: ${el.label ?? el.id}
make_box(entities, "Sofa_${el.id}_Seat",
  ${m(cx - w/2)}, ${m(cy - d/2)}, 0,
  ${m(w)}, ${m(d)}, ${m(0.38)},
  MAT[:velvet_teal], LAYERS[:furniture])
make_box(entities, "Sofa_${el.id}_Back",
  ${m(cx - w/2)}, ${m(cy + d/2 - 0.12)}, ${m(0.38)},
  ${m(w)}, ${m(0.12)}, ${m(0.48)},
  MAT[:velvet_teal], LAYERS[:furniture])
make_box(entities, "Sofa_${el.id}_ArmL",
  ${m(cx - w/2)}, ${m(cy - d/2)}, ${m(0.38)},
  ${m(0.1)}, ${m(d)}, ${m(0.26)},
  MAT[:velvet_teal], LAYERS[:furniture])
make_box(entities, "Sofa_${el.id}_ArmR",
  ${m(cx + w/2 - 0.1)}, ${m(cy - d/2)}, ${m(0.38)},
  ${m(0.1)}, ${m(d)}, ${m(0.26)},
  MAT[:velvet_teal], LAYERS[:furniture])
# Cushion mounds (half-cylinder approximation)
[-0.42, 0.42].each_with_index do |offset, i|
  make_cylinder(entities, "Sofa_${el.id}_Cushion_\#{i}",
    ${m(cx)} + offset.m, ${m(cy - d/2 + 0.32)}, ${m(0.38)},
    0.26.m, 0.08.m,
    MAT[:velvet_teal], LAYERS[:furniture], 16)
end
# Brass legs
[
  [${m(cx - w/2 + 0.12)}, ${m(cy - d/2 + 0.08)}],
  [${m(cx + w/2 - 0.12)}, ${m(cy - d/2 + 0.08)}],
  [${m(cx - w/2 + 0.12)}, ${m(cy + d/2 - 0.08)}],
  [${m(cx + w/2 - 0.12)}, ${m(cy + d/2 - 0.08)}],
].each_with_index do |pos, i|
  make_box(entities, "Sofa_${el.id}_Leg_\#{i}",
    pos[0] - 0.02.m, pos[1] - 0.02.m, ${m(-0.06)},
    0.04.m, 0.04.m, 0.06.m,
    MAT[:brass], LAYERS[:furniture])
end
`.trim();
}

function genScreenPanel(el: BoothElement): string {
  const cx = el.position.x;
  const cy = el.position.y;
  const w = el.dimensions.width ?? 1.2;
  const h = el.dimensions.height ?? 2.2;
  const thick = el.dimensions.thickness ?? 0.12;
  const z = el.position.z ?? 0;
  return `
# SCREEN PANEL: ${el.label ?? el.id}
make_box(entities, "Screen_${el.id}_Frame",
  ${m(cx - w/2 - 0.05)}, ${m(cy - thick/2)}, ${m(z)},
  ${m(w + 0.1)}, ${m(thick)}, ${m(h + 0.12)},
  MAT[:black_matte], LAYERS[:walls])
make_box(entities, "Screen_${el.id}_Display",
  ${m(cx - w/2)}, ${m(cy - thick/2 - 0.04)}, ${m(z + 0.08)},
  ${m(w)}, ${m(0.04)}, ${m(h - 0.08)},
  MAT[:screen_glow], LAYERS[:screens])
`.trim();
}

function genPalmTree(el: BoothElement): string {
  const cx = el.position.x;
  const cy = el.position.y;
  const h = el.dimensions.height ?? 1.6;
  const crownR = el.dimensions.radius ?? 0.55;
  return `
# PALM TREE: ${el.id}
make_cylinder(entities, "Palm_${el.id}_Pot",
  ${m(cx)}, ${m(cy)}, 0, ${m(0.24)}, ${m(0.38)},
  MAT[:planter_black], LAYERS[:landscaping])
make_cylinder(entities, "Palm_${el.id}_Trunk",
  ${m(cx)}, ${m(cy)}, ${m(0.38)}, ${m(0.065)}, ${m(h - 0.38)},
  MAT[:wood_oak], LAYERS[:landscaping], 8)
# Crown (flattened sphere approximation)
make_cylinder(entities, "Palm_${el.id}_Crown_Base",
  ${m(cx)}, ${m(cy)}, ${m(h)}, ${m(crownR)}, ${m(0.12)},
  MAT[:plant_green], LAYERS[:landscaping], 18)
make_cylinder(entities, "Palm_${el.id}_Crown_Mid",
  ${m(cx)}, ${m(cy)}, ${m(h + 0.12)}, ${m(crownR * 0.7)}, ${m(0.22)},
  MAT[:plant_green], LAYERS[:landscaping], 18)
make_cylinder(entities, "Palm_${el.id}_Crown_Top",
  ${m(cx)}, ${m(cy)}, ${m(h + 0.34)}, ${m(crownR * 0.3)}, ${m(0.2)},
  MAT[:plant_green], LAYERS[:landscaping], 16)
`.trim();
}

function genPlanter(el: BoothElement): string {
  const cx = el.position.x;
  const cy = el.position.y;
  const r = el.dimensions.radius ?? 0.22;
  const h = el.dimensions.height ?? 0.4;
  return `
# PLANTER: ${el.id}
make_cylinder(entities, "Planter_${el.id}_Pot",
  ${m(cx)}, ${m(cy)}, 0, ${m(r)}, ${m(h)},
  MAT[:planter_black], LAYERS[:landscaping])
make_cylinder(entities, "Planter_${el.id}_Plant",
  ${m(cx)}, ${m(cy)}, ${m(h)}, ${m(r * 0.8)}, ${m(r * 0.9)},
  MAT[:plant_green], LAYERS[:landscaping], 14)
`.trim();
}

function genArch(el: BoothElement): string {
  const cx = el.position.x;
  const cy = el.position.y;
  const w = el.dimensions.width ?? 2.8;
  const h = el.dimensions.height ?? 3.0;
  const thick = el.dimensions.thickness ?? 0.2;
  const pillarW = 0.25;
  return `
# ENTRY ARCH: ${el.label ?? 'Entry'}
# Left pillar
make_box(entities, "Arch_${el.id}_PillarL",
  ${m(cx - w/2)}, ${m(cy - thick/2)}, 0,
  ${m(pillarW)}, ${m(thick)}, ${m(h)},
  MAT[:wall_white], LAYERS[:structure])
# Right pillar
make_box(entities, "Arch_${el.id}_PillarR",
  ${m(cx + w/2 - pillarW)}, ${m(cy - thick/2)}, 0,
  ${m(pillarW)}, ${m(thick)}, ${m(h)},
  MAT[:wall_white], LAYERS[:structure])
# Arch beam at top (curved approximation with rectangular header)
make_box(entities, "Arch_${el.id}_Header",
  ${m(cx - w/2)}, ${m(cy - thick/2)}, ${m(h - 0.3)},
  ${m(w)}, ${m(thick)}, ${m(0.3)},
  MAT[:wall_white], LAYERS[:structure])
# Cyan glow strip on header
make_box(entities, "Arch_${el.id}_GlowStrip",
  ${m(cx - w/2 + 0.05)}, ${m(cy - thick/2 - 0.01)}, ${m(h - 0.12)},
  ${m(w - 0.1)}, ${m(0.02)}, ${m(0.06)},
  MAT[:cyan_led], LAYERS[:lighting])
# Brass edge trim
make_box(entities, "Arch_${el.id}_BrassTrim",
  ${m(cx - w/2)}, ${m(cy - thick/2 - 0.01)}, ${m(h)},
  ${m(w)}, ${m(thick + 0.02)}, ${m(0.04)},
  MAT[:brass], LAYERS[:structure])
`.trim();
}

function genMashrabiya(el: BoothElement): string {
  const cx = el.position.x;
  const cy = el.position.y;
  const w = el.dimensions.width ?? 0.9;
  const h = el.dimensions.height ?? 2.2;
  const thick = 0.04;
  const nH = 6, nV = 4;
  let dividers = '';
  for (let i = 1; i < nH; i++) {
    const z = (h / nH) * i;
    dividers += `make_box(entities, "Mash_${el.id}_H${i}", ${m(cx - w/2)}, ${m(cy - 0.02)}, ${m(z - 0.015)}, ${m(w)}, ${m(0.04)}, ${m(0.03)}, MAT[:brass], LAYERS[:walls])\n`;
  }
  for (let i = 1; i < nV; i++) {
    const x = cx - w/2 + (w / nV) * i;
    dividers += `make_box(entities, "Mash_${el.id}_V${i}", ${m(x - 0.015)}, ${m(cy - 0.02)}, 0, ${m(0.03)}, ${m(0.04)}, ${m(h)}, MAT[:brass], LAYERS[:walls])\n`;
  }
  return `
# MASHRABIYA PANEL: ${el.label ?? el.id}
# Wood frame
make_box(entities, "Mash_${el.id}_Frame",
  ${m(cx - w/2 - 0.04)}, ${m(cy - 0.04)}, ${m(-0.04)},
  ${m(w + 0.08)}, ${m(0.08)}, ${m(h + 0.08)},
  MAT[:wood_walnut], LAYERS[:walls])
# Black lattice body
make_box(entities, "Mash_${el.id}_Body",
  ${m(cx - w/2)}, ${m(cy - 0.02)}, 0,
  ${m(w)}, ${m(thick)}, ${m(h)},
  MAT[:black_matte], LAYERS[:walls])
# Brass grid dividers
${dividers.trim()}
`.trim();
}

function genCarpet(el: BoothElement): string {
  const x = el.position.x;
  const y = el.position.y;
  const w = el.dimensions.width ?? 3;
  const d = el.dimensions.depth ?? 3;
  const colorHex = el.color ?? '#cc1122';
  const r = parseInt(colorHex.slice(1, 3), 16);
  const g = parseInt(colorHex.slice(3, 5), 16);
  const b = parseInt(colorHex.slice(5, 7), 16);
  return `
# CARPET: ${el.label ?? el.id}
carpet_mat_${el.id} = get_or_create_material(model, "Carpet_${el.id}", ${r}, ${g}, ${b})
make_box(entities, "Carpet_${el.id}",
  ${m(x)}, ${m(y)}, ${m(-0.015)},
  ${m(w)}, ${m(d)}, ${m(0.015)},
  carpet_mat_${el.id}, LAYERS[:structure])
`.trim();
}

function genStage(el: BoothElement): string {
  const x = el.position.x;
  const y = el.position.y;
  const w = el.dimensions.width ?? 4;
  const d = el.dimensions.depth ?? 3;
  const h = el.dimensions.height ?? 0.3;
  return `
# STAGE: ${el.label ?? el.id}
make_box(entities, "Stage_${el.id}",
  ${m(x)}, ${m(y)}, 0,
  ${m(w)}, ${m(d)}, ${m(h)},
  MAT[:black_matte], LAYERS[:structure])
make_box(entities, "Stage_${el.id}_Trim",
  ${m(x)}, ${m(y)}, ${m(h)},
  ${m(w)}, ${m(d)}, ${m(0.02)},
  MAT[:carpet_mid], LAYERS[:structure])
`.trim();
}

function genSeatingRow(el: BoothElement): string {
  const x = el.position.x;
  const y = el.position.y;
  const count = el.count ?? 6;
  const spacing = 0.55;
  const colorHex = el.color ?? '#cc2222';
  const r = parseInt(colorHex.slice(1, 3), 16);
  const g = parseInt(colorHex.slice(3, 5), 16);
  const b = parseInt(colorHex.slice(5, 7), 16);
  return `
# SEATING ROW: ${el.label ?? el.id} (${count} seats)
seat_mat_${el.id} = get_or_create_material(model, "Seat_${el.id}", ${r}, ${g}, ${b})
${count}.times do |i|
  sx = ${m(x)} + i * ${m(spacing)}
  # Seat
  make_box(entities, "Seat_${el.id}_\#{i}",
    sx, ${m(y)}, 0.44.m,
    0.42.m, 0.42.m, 0.04.m,
    seat_mat_${el.id}, LAYERS[:furniture])
  # Back
  make_box(entities, "SeatBack_${el.id}_\#{i}",
    sx, ${m(y)} + 0.38.m, 0.44.m,
    0.42.m, 0.04.m, 0.35.m,
    seat_mat_${el.id}, LAYERS[:furniture])
  # Legs
  4.times do |j|
    lx = sx + (j % 2 == 0 ? 0.04.m : 0.38.m)
    ly = ${m(y)} + (j < 2 ? 0.04.m : 0.38.m)
    make_box(entities, "SeatLeg_${el.id}_\#{i}_\#{j}",
      lx, ly, 0,
      0.02.m, 0.02.m, 0.44.m,
      MAT[:black_matte], LAYERS[:furniture])
  end
end
`.trim();
}

function genSignageTower(el: BoothElement): string {
  const cx = el.position.x;
  const cy = el.position.y;
  const w = el.dimensions.width ?? 0.5;
  const d = el.dimensions.depth ?? 0.5;
  const h = el.dimensions.height ?? 4.0;
  return `
# SIGNAGE TOWER: ${el.label ?? el.id}
make_box(entities, "Tower_${el.id}_Body",
  ${m(cx - w/2)}, ${m(cy - d/2)}, 0,
  ${m(w)}, ${m(d)}, ${m(h)},
  MAT[:wall_white], LAYERS[:structure])
make_box(entities, "Tower_${el.id}_Sign",
  ${m(cx - w * 0.8)}, ${m(cy - d/2 - 0.02)}, ${m(h * 0.7)},
  ${m(w * 1.6)}, ${m(0.04)}, ${m(h * 0.25)},
  MAT[:wall_navy], LAYERS[:walls])
make_box(entities, "Tower_${el.id}_Cap",
  ${m(cx - w/2 - 0.03)}, ${m(cy - d/2 - 0.03)}, ${m(h)},
  ${m(w + 0.06)}, ${m(d + 0.06)}, ${m(0.05)},
  MAT[:brass], LAYERS[:structure])
`.trim();
}

function genColumn(el: BoothElement): string {
  const cx = el.position.x;
  const cy = el.position.y;
  const r = el.dimensions.radius ?? 0.15;
  const h = el.dimensions.height ?? 3.0;
  return `
# COLUMN: ${el.label ?? el.id}
make_cylinder(entities, "Column_${el.id}",
  ${m(cx)}, ${m(cy)}, 0, ${m(r)}, ${m(h)},
  MAT[:wall_white], LAYERS[:structure])
make_cylinder(entities, "Column_${el.id}_Base",
  ${m(cx)}, ${m(cy)}, 0, ${m(r * 1.5)}, ${m(0.05)},
  MAT[:wall_white], LAYERS[:structure])
make_cylinder(entities, "Column_${el.id}_Cap",
  ${m(cx)}, ${m(cy)}, ${m(h - 0.04)}, ${m(r * 1.4)}, ${m(0.04)},
  MAT[:wall_white], LAYERS[:structure])
`.trim();
}

function genPartition(el: BoothElement): string {
  const x = el.position.x;
  const y = el.position.y;
  const w = el.dimensions.width ?? 2;
  const h = el.dimensions.height ?? 1.5;
  const t = el.dimensions.thickness ?? 0.06;
  return `
# PARTITION: ${el.label ?? el.id}
make_box(entities, "Partition_${el.id}",
  ${m(x)}, ${m(y)}, 0,
  ${m(w)}, ${m(t)}, ${m(h)},
  MAT[:wall_white], LAYERS[:walls])
`.trim();
}

function genCeilingCanopy(el: BoothElement, boothW: number, boothD: number): string {
  const w = el.dimensions.width ?? boothW;
  const d = el.dimensions.depth ?? boothD;
  const h = el.dimensions.height ?? 3.0;
  const x = el.position.x ?? 0;
  const y = el.position.y ?? 0;
  return `
# CEILING CANOPY: ${el.label ?? el.id}
make_box(entities, "Canopy_${el.id}",
  ${m(x)}, ${m(y)}, ${m(h)},
  ${m(w)}, ${m(d)}, ${m(0.05)},
  MAT[:wall_white], LAYERS[:ceiling])
`.trim();
}

function genCameraScenes(scenes: CameraScene[]): string {
  let code = `
# ─── CAMERA SCENES ────────────────────────────────────────────────────────────
pages = model.pages
`.trim() + '\n';

  scenes.forEach((scene, i) => {
    code += `
# Scene: ${scene.name}
begin
  cam_${i} = Sketchup::Camera.new(
    Geom::Point3d.new(${m(scene.eye.x)}, ${m(scene.eye.y)}, ${m(scene.eye.z ?? 5)}),
    Geom::Point3d.new(${m(scene.target.x)}, ${m(scene.target.y)}, ${m(scene.target.z ?? 1.2)}),
    Geom::Vector3d.new(0, 0, 1)
  )
  page_${i} = pages["${scene.name}"] || pages.add("${scene.name}")
  page_${i}.camera = cam_${i}
  page_${i}.use_camera = true
  page_${i}.use_rendering_options = true
rescue => e
  puts "Scene '${scene.name}' error: \#{e.message}"
end
`.trim() + '\n';
  });

  return code;
}

// ─── Main Generator ───────────────────────────────────────────────────────────

export function generateRubyScript(config: BoothConfig): string {
  const lines: string[] = [];

  lines.push(`# ═══════════════════════════════════════════════════════════════════`);
  lines.push(`# BOOTH FORGE — Generated SketchUp Ruby Script`);
  lines.push(`# Project: ${config.projectName}`);
  lines.push(`# Client:  ${config.clientName}`);
  lines.push(`# Booth:   ${config.boothName}`);
  lines.push(`# Size:    ${config.width}m × ${config.depth}m × ${config.wallHeight}m`);
  lines.push(`# Style:   ${config.style}`);
  lines.push(`#`);
  lines.push(`# HOW TO USE:`);
  lines.push(`#   1. Open SketchUp`);
  lines.push(`#   2. Extensions > Developer > Ruby Console`);
  lines.push(`#   3. Type: load "path/to/this/file.rb"`);
  lines.push(`#   OR: Paste the entire script into the Ruby Console`);
  lines.push(`# ═══════════════════════════════════════════════════════════════════`);
  lines.push(``);
  lines.push(`model = Sketchup.active_model`);
  lines.push(`entities = model.active_entities`);
  lines.push(`model.start_operation("${config.boothName}", true)`);
  lines.push(``);
  lines.push(generateMaterials());
  lines.push(``);
  lines.push(generateLayers());
  lines.push(``);
  lines.push(generateHelperFunctions());
  lines.push(``);
  lines.push(`# ─── BOOTH GEOMETRY ─────────────────────────────────────────────────`);
  lines.push(``);

  // Process each element
  config.elements.forEach(el => {
    let code = '';
    switch (el.type) {
      case 'floor':          code = genFloor(el, config.width, config.depth); break;
      case 'back_wall':      code = genBackWall(el, config.width); break;
      case 'side_wall_left': code = genSideWall(el, config.depth, 'left'); break;
      case 'side_wall_right':code = genSideWall(el, config.depth, 'right'); break;
      case 'curved_wall':    code = genCurvedWall(el); break;
      case 'pillar_wall':    code = genPillarWall(el); break;
      case 'reception_desk': code = genReceptionDesk(el); break;
      case 'kiosk':          code = genKiosk(el); break;
      case 'pergola':        code = genPergola(el, config.width, config.depth); break;
      case 'header_fascia':  code = genHeaderFascia(el); break;
      case 'round_table':    code = genRoundTable(el); break;
      case 'high_table':     code = genRoundTable({ ...el, dimensions: { ...el.dimensions, height: el.dimensions.height ?? 1.1 }}); break;
      case 'stool':          code = genStool(el); break;
      case 'chair':          code = genChair(el); break;
      case 'sofa':           code = genSofa(el); break;
      case 'screen_panel':   code = genScreenPanel(el); break;
      case 'palm_tree':      code = genPalmTree(el); break;
      case 'planter':        code = genPlanter(el); break;
      case 'arch':           code = genArch(el); break;
      case 'mashrabiya_panel': code = genMashrabiya(el); break;
      case 'carpet':          code = genCarpet(el); break;
      case 'stage':           code = genStage(el); break;
      case 'seating_row':     code = genSeatingRow(el); break;
      case 'signage_tower':   code = genSignageTower(el); break;
      case 'column':          code = genColumn(el); break;
      case 'partition':       code = genPartition(el); break;
      case 'display_tower':   code = genSignageTower(el); break;
      case 'ceiling_canopy':  code = genCeilingCanopy(el, config.width, config.depth); break;
      default: code = `# Element type "${el.type}" not yet supported\n`;
    }
    lines.push(code);
    lines.push(``);
  });

  // Camera scenes
  if (config.scenes.length > 0) {
    lines.push(genCameraScenes(config.scenes));
  }

  lines.push(`model.commit_operation`);
  lines.push(`puts "✓ ${config.boothName} generated successfully"`);
  lines.push(`puts "  Layers: #{model.layers.count}"`);
  lines.push(`puts "  Groups: #{entities.grep(Sketchup::Group).count}"`);
  lines.push(`puts "  Scenes: #{model.pages.count}"`);

  return lines.join('\n');
}
