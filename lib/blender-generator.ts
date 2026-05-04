import { BoothConfig, BoothElement } from './types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function m(val: number): string {
  return val.toFixed(4);
}

// ─── Material Palette ─────────────────────────────────────────────────────────

function generateMaterials(): string {
  return `
# ─── MATERIAL LIBRARY ─────────────────────────────────────────────────────────
def create_material(name, base_color, metallic=0.0, roughness=0.8, emission=None, emission_strength=0.0):
    if name in bpy.data.materials:
        return bpy.data.materials[name]
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()
    
    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.location = (0, 0)
    bsdf.inputs['Base Color'].default_value = (*base_color, 1.0)
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = roughness
    
    if emission:
        bsdf.inputs['Emission Color'].default_value = (*emission, 1.0)
        bsdf.inputs['Emission Strength'].default_value = emission_strength
    
    output = nodes.new('ShaderNodeOutputMaterial')
    output.location = (300, 0)
    links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])
    return mat

MAT = {
    'floor_concrete':  create_material('Floor_Concrete',    (0.82, 0.82, 0.80), roughness=0.85),
    'floor_carpet':    create_material('Floor_Carpet_Blue', (0.05, 0.12, 0.35), roughness=0.95),
    'wall_white':      create_material('Wall_White',        (0.95, 0.95, 0.94), roughness=0.88),
    'wall_navy':       create_material('Wall_DeepNavy',     (0.04, 0.10, 0.18), roughness=0.85),
    'wood_walnut':     create_material('Wood_Walnut',       (0.29, 0.16, 0.07), roughness=0.82),
    'wood_oak':        create_material('Wood_Oak',          (0.67, 0.54, 0.34), roughness=0.80),
    'brass':           create_material('Metal_Brass',       (0.66, 0.52, 0.28), metallic=0.88, roughness=0.25),
    'black_matte':     create_material('Metal_Black_Matte', (0.10, 0.11, 0.13), roughness=0.90),
    'orange_accent':   create_material('Omantel_Orange',    (0.96, 0.49, 0.17), roughness=0.75),
    'cyan_led':        create_material('LED_Cyan',          (0.00, 0.86, 0.85), emission=(0.00, 0.86, 0.85), emission_strength=4.0),
    'screen_dark':     create_material('Screen_Dark',       (0.05, 0.07, 0.09), metallic=0.2, roughness=0.05),
    'screen_glow':     create_material('Screen_Backlit',    (0.00, 0.82, 0.90), emission=(0.00, 0.82, 0.90), emission_strength=2.5),
    'velvet_teal':     create_material('Velvet_Teal',       (0.00, 0.46, 0.50), roughness=0.97),
    'glass':           create_material('Glass',             (0.78, 0.86, 0.90), metallic=0.0, roughness=0.02),
    'plant_green':     create_material('Plant_Green',       (0.13, 0.47, 0.23), roughness=0.94),
    'planter_black':   create_material('Planter_Black',     (0.15, 0.15, 0.16), roughness=0.88),
    'gold_accent':     create_material('Gold_Accent',       (0.83, 0.64, 0.22), metallic=0.92, roughness=0.20),
}
`.trim();
}

// ─── Scene Setup ──────────────────────────────────────────────────────────────

function generateSceneSetup(): string {
  return `
# ─── SCENE SETUP ──────────────────────────────────────────────────────────────
import bpy
import bmesh
import math
import os

# Clear scene
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for col in list(bpy.data.collections):
    bpy.data.collections.remove(col)

# Units
bpy.context.scene.unit_settings.system = 'METRIC'
bpy.context.scene.unit_settings.length_unit = 'METERS'
bpy.context.scene.unit_settings.scale_length = 1.0

# World lighting (HDRI-like ambient)
world = bpy.context.scene.world
world.use_nodes = True
bg_node = world.node_tree.nodes.get('Background')
if bg_node:
    bg_node.inputs['Color'].default_value = (0.05, 0.07, 0.12, 1.0)
    bg_node.inputs['Strength'].default_value = 0.4

# Render settings
bpy.context.scene.render.engine = 'BLENDER_EEVEE_NEXT' if hasattr(bpy.context.scene.render, 'engine') else 'BLENDER_EEVEE'
bpy.context.scene.eevee.use_ssr = True
bpy.context.scene.eevee.use_bloom = True
bpy.context.scene.eevee.bloom_threshold = 0.8
bpy.context.scene.eevee.bloom_intensity = 0.05
bpy.context.scene.render.resolution_x = 1920
bpy.context.scene.render.resolution_y = 1080
bpy.context.scene.render.film_transparent = False

# ─── COLLECTION SETUP ────────────────────────────────────────────────────────
def get_or_create_collection(name):
    if name in bpy.data.collections:
        return bpy.data.collections[name]
    col = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(col)
    return col

COLS = {
    'structure':   get_or_create_collection('01_Structure'),
    'walls':       get_or_create_collection('02_Walls'),
    'ceiling':     get_or_create_collection('03_Ceiling'),
    'furniture':   get_or_create_collection('04_Furniture'),
    'screens':     get_or_create_collection('05_Screens'),
    'lighting':    get_or_create_collection('06_Lighting'),
    'landscaping': get_or_create_collection('07_Landscaping'),
    'figures':     get_or_create_collection('08_HumanFigures'),
}
`.trim();
}

// ─── Blender Helpers ──────────────────────────────────────────────────────────

function generateHelpers(): string {
  return `
# ─── GEOMETRY HELPERS ─────────────────────────────────────────────────────────

def add_to_collection(obj, collection):
    for col in list(obj.users_collection):
        col.objects.unlink(obj)
    collection.objects.link(obj)

def apply_mat(obj, mat):
    if obj.data and hasattr(obj.data, 'materials'):
        obj.data.materials.clear()
        obj.data.materials.append(mat)

def make_box(name, x, y, z, w, d, h, mat, collection):
    """Create a box mesh. Origin at bottom-front-left corner."""
    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)
    bm = bmesh.new()
    verts = [
        bm.verts.new((0,0,0)), bm.verts.new((w,0,0)),
        bm.verts.new((w,d,0)), bm.verts.new((0,d,0)),
        bm.verts.new((0,0,h)), bm.verts.new((w,0,h)),
        bm.verts.new((w,d,h)), bm.verts.new((0,d,h)),
    ]
    bm.faces.new([verts[0],verts[1],verts[5],verts[4]])
    bm.faces.new([verts[1],verts[2],verts[6],verts[5]])
    bm.faces.new([verts[2],verts[3],verts[7],verts[6]])
    bm.faces.new([verts[3],verts[0],verts[4],verts[7]])
    bm.faces.new([verts[0],verts[3],verts[2],verts[1]])
    bm.faces.new([verts[4],verts[5],verts[6],verts[7]])
    bm.to_mesh(mesh)
    bm.free()
    obj.location = (x, y, z)
    add_to_collection(obj, collection)
    apply_mat(obj, mat)
    return obj

def make_cylinder(name, cx, cy, z, radius, height, mat, collection, vertices=32):
    """Create a cylinder. Center at cx, cy, base at z."""
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=height,
        location=(cx, cy, z + height/2)
    )
    obj = bpy.context.active_object
    obj.name = name
    add_to_collection(obj, collection)
    apply_mat(obj, mat)
    return obj

def make_curved_wall(name, cx, cy, radius, start_deg, end_deg, height, thickness, mat, collection, segments=48):
    """Create a proper curved wall using bmesh."""
    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)
    bm = bmesh.new()
    
    sa = math.radians(start_deg)
    ea = math.radians(end_deg)
    n = segments
    
    ob = []; ib = []; ot = []; it_ = []
    for i in range(n + 1):
        t = i / n
        a = sa + t * (ea - sa)
        ro = radius + thickness / 2
        ri = radius - thickness / 2
        ob.append(bm.verts.new((cx + ro * math.cos(a), cy + ro * math.sin(a), 0)))
        ib.append(bm.verts.new((cx + ri * math.cos(a), cy + ri * math.sin(a), 0)))
        ot.append(bm.verts.new((cx + ro * math.cos(a), cy + ro * math.sin(a), height)))
        it_.append(bm.verts.new((cx + ri * math.cos(a), cy + ri * math.sin(a), height)))
    
    for i in range(n):
        bm.faces.new([ob[i], ob[i+1], ot[i+1], ot[i]])   # outer
        bm.faces.new([ib[i+1], ib[i], it_[i], it_[i+1]]) # inner
        bm.faces.new([ot[i], ot[i+1], it_[i+1], it_[i]]) # top
    bm.faces.new([ob[0], ib[0], it_[0], ot[0]])           # cap start
    bm.faces.new([ib[-1], ob[-1], ot[-1], it_[-1]])        # cap end
    
    bm.normal_update()
    bm.to_mesh(mesh)
    bm.free()
    add_to_collection(obj, collection)
    apply_mat(obj, mat)
    return obj

def make_sphere_section(name, cx, cy, z, radius, mat, collection, u=16, v=8, start_v=0, end_v=1):
    """Create a hemisphere/dome."""
    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)
    bm = bmesh.new()
    verts = []
    for vi in range(v + 1):
        row = []
        phi = math.pi * 0.5 * (start_v + (end_v - start_v) * vi / v)
        for ui in range(u):
            theta = 2 * math.pi * ui / u
            x = cx + radius * math.cos(phi) * math.cos(theta)
            y = cy + radius * math.cos(phi) * math.sin(theta)
            z_ = z + radius * math.sin(phi)
            row.append(bm.verts.new((x, y, z_)))
        verts.append(row)
    for vi in range(v):
        for ui in range(u):
            ui2 = (ui + 1) % u
            bm.faces.new([verts[vi][ui], verts[vi][ui2], verts[vi+1][ui2], verts[vi+1][ui]])
    bm.to_mesh(mesh)
    bm.free()
    add_to_collection(obj, collection)
    apply_mat(obj, mat)
    return obj

def add_light(name, x, y, z, energy, color=(1,1,1), light_type='POINT', radius=0.1):
    light_data = bpy.data.lights.new(name=name, type=light_type)
    light_data.energy = energy
    light_data.color = color
    light_data.shadow_soft_size = radius
    obj = bpy.data.objects.new(name, light_data)
    obj.location = (x, y, z)
    bpy.context.scene.collection.objects.link(obj)
    return obj

def add_camera(name, eye, target, fov_deg=45):
    cam_data = bpy.data.cameras.new(name=name)
    cam_data.lens_unit = 'FOV'
    cam_data.angle = math.radians(fov_deg)
    cam_obj = bpy.data.objects.new(name, cam_data)
    cam_obj.location = eye
    # Point camera at target
    direction = (
        target[0] - eye[0],
        target[1] - eye[1],
        target[2] - eye[2],
    )
    rot_quat = cam_obj.rotation_euler
    import mathutils
    direction_v = mathutils.Vector(direction).normalized()
    rot_quat = direction_v.to_track_quat('-Z', 'Y')
    cam_obj.rotation_euler = rot_quat.to_euler()
    bpy.context.scene.collection.objects.link(cam_obj)
    return cam_obj
`.trim();
}

// ─── Element Generators ───────────────────────────────────────────────────────

function genFloor(el: BoothElement, boothW: number, boothD: number): string {
  const hasCarpet = el.label?.toLowerCase().includes('carpet') || el.label?.toLowerCase().includes('blue');
  const mat = hasCarpet ? 'MAT["floor_carpet"]' : 'MAT["floor_concrete"]';
  return `
# FLOOR
make_box("Floor_Platform", 0, 0, -0.05, ${m(boothW)}, ${m(boothD)}, 0.05, ${mat}, COLS['structure'])
`.trim();
}

function genBackWall(el: BoothElement, boothW: number): string {
  const h = el.dimensions.height ?? 3.0;
  const t = el.dimensions.thickness ?? 0.14;
  const y = el.position.y;
  return `
# BACK WALL
make_box("Wall_Back", 0, ${m(y)}, 0, ${m(boothW)}, ${m(t)}, ${m(h)}, MAT['wall_navy'], COLS['walls'])
`.trim();
}

function genSideWall(el: BoothElement, boothD: number, side: 'left' | 'right'): string {
  const h = el.dimensions.height ?? 3.0;
  const t = el.dimensions.thickness ?? 0.14;
  const x = side === 'left' ? 0 : el.position.x;
  return `
# SIDE WALL ${side.toUpperCase()}
make_box("Wall_Side_${side}", ${m(x)}, 0, 0, ${m(t)}, ${m(boothD - t)}, ${m(h)}, MAT['wall_white'], COLS['walls'])
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
  return `
# CURVED WALL: ${el.label ?? el.id}
make_curved_wall("${el.label ?? 'CurvedWall'}", 
    ${m(cx)}, ${m(cy)}, ${m(r)}, ${startDeg}, ${startDeg + arcDeg},
    ${m(h)}, ${m(thick)}, MAT['wall_white'], COLS['walls'])
`.trim();
}

function genPillarWall(el: BoothElement): string {
  const cx = el.position.x;
  const cy = el.position.y;
  const w = el.dimensions.width ?? 1.8;
  const h = el.dimensions.height ?? 2.8;
  const d = el.dimensions.depth ?? 0.16;
  const label = el.label ?? el.id;
  const scW = el.screenSize?.width ?? 1.1;
  const scH = el.screenSize?.height ?? 1.5;
  return `
# PILLAR WALL: ${label}
make_box("Pillar_${el.id}_Frame",  ${m(cx - w/2)}, ${m(cy - d/2)}, 0, ${m(w)}, ${m(d + 0.01)}, ${m(h + 0.1)}, MAT['wood_walnut'], COLS['walls'])
make_box("Pillar_${el.id}_Inset",  ${m(cx - w/2 + 0.05)}, ${m(cy - d/2 - 0.01)}, 0.1, ${m(w - 0.1)}, ${m(d + 0.01)}, ${m(h)}, MAT['black_matte'], COLS['walls'])
make_box("Pillar_${el.id}_Screen", ${m(cx - scW/2)}, ${m(cy - d/2 - 0.05)}, 0.28, ${m(scW)}, 0.05, ${m(scH)}, MAT['screen_glow'], COLS['screens'])
make_box("Pillar_${el.id}_Header", ${m(cx - scW/2)}, ${m(cy - d/2 - 0.05)}, ${m(0.28 + scH + 0.06)}, ${m(scW)}, 0.05, 0.18, MAT['cyan_led'], COLS['lighting'])
make_box("Pillar_${el.id}_BrassTop", ${m(cx - w/2)}, ${m(cy - d/2 - 0.01)}, ${m(h + 0.05)}, ${m(w)}, ${m(d + 0.01)}, 0.05, MAT['brass'], COLS['walls'])
make_box("Pillar_${el.id}_BrassBtm", ${m(cx - w/2)}, ${m(cy - d/2 - 0.01)}, 0, ${m(w)}, ${m(d + 0.01)}, 0.05, MAT['brass'], COLS['walls'])
make_box("Pillar_${el.id}_Plinth",  ${m(cx - w/2 - 0.05)}, ${m(cy - d/2 - 0.02)}, -0.12, ${m(w + 0.1)}, ${m(d + 0.04)}, 0.12, MAT['wood_oak'], COLS['structure'])
# Tablet at 1.2m
make_box("Pillar_${el.id}_Tablet",  ${m(cx - 0.22)}, ${m(cy - d/2 - 0.08)}, 1.15, 0.44, 0.08, 0.28, MAT['screen_dark'], COLS['screens'])
# Point light for screen glow
add_light("Light_${el.id}_Screen", ${m(cx)}, ${m(cy - d/2 - 0.3)}, ${m(0.28 + scH/2)}, 15, (0.0, 0.82, 0.90))
add_light("Light_${el.id}_Header", ${m(cx)}, ${m(cy - d/2 - 0.2)}, ${m(0.28 + scH + 0.15)}, 8, (0.0, 0.86, 0.85))
`.trim();
}

function genDisplayTower(el: BoothElement): string {
  const cx = el.position.x + (el.dimensions.width ?? 0.18) / 2;
  const cy = el.position.y + (el.dimensions.depth ?? 0.18) / 2;
  const w = el.dimensions.width ?? 0.18;
  const d = el.dimensions.depth ?? 0.18;
  const h = el.dimensions.height ?? 3.0;
  const isOrange = el.label?.toLowerCase().includes('orange');
  const mat = isOrange ? "MAT['orange_accent']" : "MAT['wall_navy']";
  return `
# COLUMN/TOWER: ${el.label ?? el.id}
make_box("${el.label ?? el.id}", ${m(cx - w/2)}, ${m(cy - d/2)}, 0, ${m(w)}, ${m(d)}, ${m(h)}, ${mat}, COLS['structure'])
`.trim();
}

function genHeaderFascia(el: BoothElement): string {
  const cx = el.position.x;
  const cy = el.position.y;
  const w = el.dimensions.width ?? 4.0;
  const h = el.dimensions.height ?? 0.4;
  const z = el.position.z ?? 2.55;
  return `
# HEADER FASCIA: ${el.label ?? 'Campaign Header'}
make_box("Header_WoodFrame",  ${m(cx - w/2 - 0.06)}, ${m(cy - 0.14)}, ${m(z)}, ${m(w + 0.12)}, 0.22, ${m(h)}, MAT['wood_walnut'], COLS['walls'])
make_box("Header_BacklitInner", ${m(cx - w/2)}, ${m(cy - 0.10)}, ${m(z + 0.06)}, ${m(w)}, 0.12, ${m(h - 0.12)}, MAT['wall_navy'], COLS['walls'])
make_box("Header_CyanGlow",   ${m(cx - w/2 + 0.08)}, ${m(cy - 0.08)}, ${m(z + 0.1)}, ${m(w - 0.16)}, 0.06, ${m(h - 0.22)}, MAT['cyan_led'], COLS['lighting'])
make_box("Header_BrassTrim",  ${m(cx - w/2 - 0.06)}, ${m(cy - 0.14)}, ${m(z + h)}, ${m(w + 0.12)}, 0.22, 0.04, MAT['brass'], COLS['walls'])
add_light("Light_Header", ${m(cx)}, ${m(cy - 0.2)}, ${m(z + h/2)}, 20, (0.0, 0.86, 0.85))
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
make_box("Reception_Body",      ${m(cx - w/2)}, ${m(cy - d/2)}, 0, ${m(w)}, ${m(d)}, ${m(h)}, MAT['wood_walnut'], COLS['furniture'])
make_box("Reception_BrassTop",  ${m(cx - w/2)}, ${m(cy - d/2)}, ${m(h)}, ${m(w)}, ${m(d)}, 0.04, MAT['brass'], COLS['furniture'])
make_box("Reception_CyanStrip", ${m(cx - w/2 + 0.1)}, ${m(cy - d/2 - 0.01)}, 0.18, ${m(w - 0.2)}, 0.02, 0.06, MAT['cyan_led'], COLS['lighting'])
make_box("Reception_BackPanel", ${m(cx - w/2)}, ${m(cy + d/2 - 0.05)}, ${m(h)}, ${m(w)}, 0.05, 0.55, MAT['wood_walnut'], COLS['furniture'])
make_box("Reception_LogoPlate", ${m(cx - 0.36)}, ${m(cy + d/2 - 0.04)}, ${m(h + 0.16)}, 0.72, 0.04, 0.22, MAT['brass'], COLS['furniture'])
add_light("Light_Reception", ${m(cx)}, ${m(cy - d/2 - 0.3)}, ${m(h + 0.2)}, 12, (1.0, 0.92, 0.80))
`.trim();
}

function genKiosk(el: BoothElement): string {
  const cx = el.position.x;
  const cy = el.position.y;
  const sz = el.dimensions.width ?? 1.0;
  const h = el.dimensions.height ?? 1.05;
  return `
# KIOSK: ${el.label ?? 'Kiosk'}
make_box("Kiosk_Base",    ${m(cx - sz/2 - 0.05)}, ${m(cy - sz/2 - 0.05)}, -0.08, ${m(sz + 0.1)}, ${m(sz + 0.1)}, 0.08, MAT['wood_oak'], COLS['furniture'])
make_box("Kiosk_Ring",    ${m(cx - sz/2 - 0.06)}, ${m(cy - sz/2 - 0.06)}, 0, ${m(sz + 0.12)}, ${m(sz + 0.12)}, 0.04, MAT['brass'], COLS['furniture'])
make_box("Kiosk_Body",    ${m(cx - sz/2)}, ${m(cy - sz/2)}, 0.04, ${m(sz)}, ${m(sz)}, ${m(h - 0.04)}, MAT['wood_walnut'], COLS['furniture'])
make_box("Kiosk_Screen",  ${m(cx - sz/2 + 0.08)}, ${m(cy - sz/2 - 0.05)}, 0.3, ${m(sz - 0.16)}, 0.05, 0.45, MAT['screen_glow'], COLS['screens'])
make_box("Kiosk_TopCap",  ${m(cx - sz/2 - 0.02)}, ${m(cy - sz/2 - 0.02)}, ${m(h)}, ${m(sz + 0.04)}, ${m(sz + 0.04)}, 0.06, MAT['wood_oak'], COLS['furniture'])
make_box("Kiosk_TopGlow_F", ${m(cx - sz/2)}, ${m(cy - sz/2 - 0.015)}, ${m(h + 0.01)}, ${m(sz)}, 0.015, 0.025, MAT['cyan_led'], COLS['lighting'])
make_box("Kiosk_TopGlow_B", ${m(cx - sz/2)}, ${m(cy + sz/2)}, ${m(h + 0.01)}, ${m(sz)}, 0.015, 0.025, MAT['cyan_led'], COLS['lighting'])
add_light("Light_Kiosk_Screen", ${m(cx)}, ${m(cy - sz/2 - 0.3)}, 0.52, 18, (0.0, 0.82, 0.90))
add_light("Light_Kiosk_Crown",  ${m(cx)}, ${m(cy)}, ${m(h + 0.3)}, 10, (0.0, 0.86, 0.85))
`.trim();
}

function genPergola(el: BoothElement, boothW: number, boothD: number): string {
  const h = el.dimensions.height ?? 2.75;
  const bh = 0.22;
  const x1 = el.position.x ?? 0.2;
  const y1 = el.position.y ?? 0.3;
  const x2 = (el.dimensions.width ? x1 + el.dimensions.width : boothW - 0.2);
  const y2 = (el.dimensions.depth ? y1 + el.dimensions.depth : boothD - 0.35);
  const nCross = Math.max(3, Math.round((x2 - x1) / 1.2));
  const crossSpacing = (x2 - x1) / (nCross + 1);

  let cross = '';
  for (let i = 1; i <= nCross; i++) {
    const bx = x1 + crossSpacing * i;
    cross += `make_box("Pergola_Cross_${i}", ${m(bx - 0.06)}, ${m(y1)}, ${m(h)}, 0.12, ${m(y2 - y1)}, ${m(bh * 0.7)}, MAT['wood_walnut'], COLS['ceiling'])\n`;
  }
  let glows = '';
  for (let i = 1; i < nCross; i++) {
    const gx = x1 + crossSpacing * i + crossSpacing * 0.5;
    glows += `make_box("Pergola_Glow_${i}", ${m(gx - 0.02)}, ${m(y1 + 0.2)}, ${m(h + 0.04)}, 0.04, ${m(y2 - y1 - 0.4)}, 0.025, MAT['cyan_led'], COLS['lighting'])\n`;
    glows += `add_light("Light_Pergola_${i}", ${m(gx)}, ${m((y1 + y2) / 2)}, ${m(h + 0.1)}, 12, (0.0, 0.86, 0.85), 'AREA')\n`;
  }

  return `
# PERGOLA CEILING
make_box("Pergola_Back",  ${m(x1)}, ${m(y2 - 0.3)}, ${m(h)}, ${m(x2 - x1)}, 0.3, ${m(bh)}, MAT['wood_walnut'], COLS['ceiling'])
make_box("Pergola_Front", ${m(x1)}, ${m(y1)}, ${m(h)}, ${m(x2 - x1)}, 0.3, ${m(bh)}, MAT['wood_walnut'], COLS['ceiling'])
make_box("Pergola_Left",  ${m(x1)}, ${m(y1)}, ${m(h)}, 0.3, ${m(y2 - y1)}, ${m(bh)}, MAT['wood_walnut'], COLS['ceiling'])
make_box("Pergola_Right", ${m(x2 - 0.3)}, ${m(y1)}, ${m(h)}, 0.3, ${m(y2 - y1)}, ${m(bh)}, MAT['wood_walnut'], COLS['ceiling'])
make_box("Pergola_BlackEdge_B", ${m(x1)}, ${m(y2 - 0.32)}, ${m(h - 0.02)}, ${m(x2 - x1)}, 0.04, 0.06, MAT['black_matte'], COLS['ceiling'])
${cross.trim()}
${glows.trim()}
`.trim();
}

function genRoundTable(el: BoothElement): string {
  const cx = el.position.x;
  const cy = el.position.y;
  const r = el.dimensions.radius ?? 0.35;
  const h = el.dimensions.height ?? 0.74;
  const isHigh = h > 0.9;
  return `
# TABLE: ${el.id}
make_cylinder("Table_${el.id}_Top",  ${m(cx)}, ${m(cy)}, ${m(h - 0.04)}, ${m(r)}, 0.04, MAT['wood_walnut'], COLS['furniture'], 32)
make_cylinder("Table_${el.id}_Stem", ${m(cx)}, ${m(cy)}, 0.04, ${m(isHigh ? 0.04 : 0.035)}, ${m(h - 0.08)}, MAT['brass'], COLS['furniture'], 12)
make_cylinder("Table_${el.id}_Base", ${m(cx)}, ${m(cy)}, 0, ${m(isHigh ? 0.22 : 0.18)}, 0.04, MAT['brass'], COLS['furniture'], 24)
`.trim();
}

function genStool(el: BoothElement): string {
  const cx = el.position.x;
  const cy = el.position.y;
  const h = el.dimensions.height ?? 0.74;
  return `
# STOOL: ${el.id}
make_cylinder("Stool_${el.id}_Seat", ${m(cx)}, ${m(cy)}, ${m(h - 0.04)}, 0.185, 0.04, MAT['wood_walnut'], COLS['furniture'], 24)
make_cylinder("Stool_${el.id}_Stem", ${m(cx)}, ${m(cy)}, 0.04, 0.028, ${m(h - 0.08)}, MAT['brass'], COLS['furniture'], 10)
make_cylinder("Stool_${el.id}_Base", ${m(cx)}, ${m(cy)}, 0, 0.15, 0.04, MAT['brass'], COLS['furniture'], 20)
`.trim();
}

function genSofa(el: BoothElement): string {
  const cx = el.position.x;
  const cy = el.position.y;
  const w = el.dimensions.width ?? 1.8;
  const d = el.dimensions.depth ?? 0.72;
  return `
# SOFA: ${el.label ?? el.id}
make_box("Sofa_${el.id}_Seat", ${m(cx - w/2)}, ${m(cy - d/2)}, 0, ${m(w)}, ${m(d)}, 0.38, MAT['velvet_teal'], COLS['furniture'])
make_box("Sofa_${el.id}_Back", ${m(cx - w/2)}, ${m(cy + d/2 - 0.12)}, 0.38, ${m(w)}, 0.12, 0.5, MAT['velvet_teal'], COLS['furniture'])
make_box("Sofa_${el.id}_ArmL", ${m(cx - w/2)}, ${m(cy - d/2)}, 0.38, 0.1, ${m(d)}, 0.26, MAT['velvet_teal'], COLS['furniture'])
make_box("Sofa_${el.id}_ArmR", ${m(cx + w/2 - 0.1)}, ${m(cy - d/2)}, 0.38, 0.1, ${m(d)}, 0.26, MAT['velvet_teal'], COLS['furniture'])
make_sphere_section("Sofa_${el.id}_Cush_L", ${m(cx - 0.45)}, ${m(cy)}, 0.38, 0.25, MAT['velvet_teal'], COLS['furniture'])
make_sphere_section("Sofa_${el.id}_Cush_R", ${m(cx + 0.45)}, ${m(cy)}, 0.38, 0.25, MAT['velvet_teal'], COLS['furniture'])
`.trim();
}

function genPalmTree(el: BoothElement): string {
  const cx = el.position.x;
  const cy = el.position.y;
  const h = el.dimensions.height ?? 1.6;
  const cr = el.dimensions.radius ?? 0.55;
  return `
# PALM TREE: ${el.id}
make_cylinder("Palm_${el.id}_Pot",   ${m(cx)}, ${m(cy)}, 0, 0.24, 0.38, MAT['planter_black'], COLS['landscaping'], 18)
make_cylinder("Palm_${el.id}_Trunk", ${m(cx)}, ${m(cy)}, 0.38, 0.065, ${m(h - 0.38)}, MAT['wood_oak'], COLS['landscaping'], 10)
make_sphere_section("Palm_${el.id}_Crown_A", ${m(cx)}, ${m(cy)}, ${m(h)}, ${m(cr)}, MAT['plant_green'], COLS['landscaping'])
make_sphere_section("Palm_${el.id}_Crown_B", ${m(cx)}, ${m(cy)}, ${m(h + cr * 0.4)}, ${m(cr * 0.6)}, MAT['plant_green'], COLS['landscaping'])
`.trim();
}

function genPlanter(el: BoothElement): string {
  const cx = el.position.x;
  const cy = el.position.y;
  const r = el.dimensions.radius ?? 0.22;
  const h = el.dimensions.height ?? 0.4;
  return `
# PLANTER: ${el.id}
make_cylinder("Planter_${el.id}_Pot",   ${m(cx)}, ${m(cy)}, 0, ${m(r)}, ${m(h)}, MAT['planter_black'], COLS['landscaping'], 18)
make_sphere_section("Planter_${el.id}_Plant", ${m(cx)}, ${m(cy)}, ${m(h)}, ${m(r * 0.9)}, MAT['plant_green'], COLS['landscaping'])
`.trim();
}

function genScreenPanel(el: BoothElement): string {
  const cx = el.position.x;
  const cy = el.position.y;
  const w = el.dimensions.width ?? 1.2;
  const h = el.dimensions.height ?? 2.2;
  return `
# SCREEN PANEL: ${el.label ?? el.id}
make_box("Screen_${el.id}_Frame",   ${m(cx - w/2 - 0.05)}, ${m(cy - 0.07)}, 0, ${m(w + 0.1)}, 0.14, ${m(h + 0.14)}, MAT['black_matte'], COLS['walls'])
make_box("Screen_${el.id}_Display", ${m(cx - w/2)}, ${m(cy - 0.05)}, 0.06, ${m(w)}, 0.05, ${m(h - 0.06)}, MAT['screen_glow'], COLS['screens'])
add_light("Light_Screen_${el.id}", ${m(cx)}, ${m(cy - 0.4)}, ${m(h / 2)}, 20, (0.0, 0.82, 0.90))
`.trim();
}

function genFloorPath(el: BoothElement): string {
  return `
# CYAN FLOOR PATH
make_box("FloorPath_Seg1", ${m(el.position.x - 0.04)}, 0, 0.001, 0.08, ${m(el.position.y * 0.5)}, 0.002, MAT['cyan_led'], COLS['lighting'])
make_box("FloorPath_Seg2", ${m(el.position.x - 0.04)}, ${m(el.position.y * 0.5)}, 0.001, 0.08, ${m(el.position.y * 0.35)}, 0.002, MAT['cyan_led'], COLS['lighting'])
add_light("Light_FloorPath", ${m(el.position.x)}, ${m(el.position.y * 0.4)}, 0.05, 5, (0.0, 0.86, 0.85), 'AREA')
`.trim();
}

function genMashrabiya(el: BoothElement): string {
  const cx = el.position.x;
  const cy = el.position.y;
  const w = el.dimensions.width ?? 0.9;
  const h = el.dimensions.height ?? 2.2;
  return `
# MASHRABIYA PANEL: ${el.label ?? el.id}
make_box("Mash_${el.id}_Frame", ${m(cx - w/2 - 0.04)}, ${m(cy - 0.04)}, -0.04, ${m(w + 0.08)}, 0.08, ${m(h + 0.08)}, MAT['wood_walnut'], COLS['walls'])
make_box("Mash_${el.id}_Body",  ${m(cx - w/2)}, ${m(cy - 0.02)}, 0, ${m(w)}, 0.04, ${m(h)}, MAT['black_matte'], COLS['walls'])
# Lattice dividers
for _i in range(6):
    _z = (_i + 1) * ${m(h / 7)}
    make_box(f"Mash_${el.id}_H{_i}", ${m(cx - w/2)}, ${m(cy - 0.01)}, _z - 0.015, ${m(w)}, 0.02, 0.03, MAT['brass'], COLS['walls'])
for _j in range(4):
    _x = ${m(cx - w/2)} + (_j + 1) * ${m(w / 5)}
    make_box(f"Mash_${el.id}_V{_j}", _x - 0.015, ${m(cy - 0.01)}, 0, 0.03, 0.02, ${m(h)}, MAT['brass'], COLS['walls'])
`.trim();
}

// ─── Camera + Lighting Setup ──────────────────────────────────────────────────

function genCameras(scenes: BoothConfig['scenes']): string {
  let code = `\n# ─── CAMERAS ─────────────────────────────────────────────────────────────────\ntry:\n    import mathutils\n    cams_created = []\n`;
  scenes.forEach((s, i) => {
    code += `    cam_${i} = add_camera("${s.name}", (${m(s.eye.x)}, ${m(s.eye.y)}, ${m(s.eye.z ?? 5)}), (${m(s.target.x)}, ${m(s.target.y)}, ${m(s.target.z ?? 1.2)}), 45)\n`;
    code += `    cams_created.append(cam_${i})\n`;
    if (i === 0) code += `    bpy.context.scene.camera = cam_${i}\n`;
  });
  code += `except ImportError:\n    print("Note: mathutils not available — cameras skipped")\n`;
  return code;
}

function genSceneLighting(boothW: number, boothD: number, boothH: number): string {
  const cx = boothW / 2;
  const cy = boothD / 2;
  return `
# ─── SCENE LIGHTING ──────────────────────────────────────────────────────────
# Main area light
add_light("Light_Main",    ${m(cx)}, ${m(cy * 0.3)}, ${m(boothH * 1.5)}, 400, (1.0, 0.98, 0.95), 'AREA', 2.0)
# Fill light
add_light("Light_Fill",    ${m(cx * 1.8)}, ${m(cy)}, ${m(boothH * 1.2)}, 120, (0.9, 0.95, 1.0), 'AREA', 1.5)
# Back rim
add_light("Light_Rim",     ${m(cx)}, ${m(boothD * 0.9)}, ${m(boothH * 0.8)}, 80, (0.7, 0.8, 1.0), 'AREA', 1.0)
# Floor bounce (simulated)
add_light("Light_Bounce",  ${m(cx)}, ${m(cy)}, 0.05, 30, (0.9, 0.85, 0.75), 'AREA', 3.0)
`.trim();
}

// ─── Main Blender Generator ───────────────────────────────────────────────────

export function generateBlenderScript(config: BoothConfig): string {
  const lines: string[] = [];

  lines.push(`# ${'═'.repeat(65)}`);
  lines.push(`# BOOTH FORGE — Blender Python Script`);
  lines.push(`# Project: ${config.projectName}`);
  lines.push(`# Client:  ${config.clientName}`);
  lines.push(`# Booth:   ${config.boothName}`);
  lines.push(`# Size:    ${config.width}m × ${config.depth}m × ${config.wallHeight}m`);
  lines.push(`#`);
  lines.push(`# HOW TO USE:`);
  lines.push(`#   Option A (recommended):`);
  lines.push(`#     blender --background --python booth.py`);
  lines.push(`#     → Opens Blender, builds model, saves as booth.blend`);
  lines.push(`#`);
  lines.push(`#   Option B:`);
  lines.push(`#     1. Open Blender`);
  lines.push(`#     2. Go to Scripting tab`);
  lines.push(`#     3. Paste entire script, click Run`);
  lines.push(`#`);
  lines.push(`# THEN: Apply materials in Shader Editor, set render engine`);
  lines.push(`#       (EEVEE for fast preview, Cycles for photorealistic)`);
  lines.push(`# ${'═'.repeat(65)}`);
  lines.push(``);

  lines.push(generateSceneSetup());
  lines.push(``);
  lines.push(generateMaterials());
  lines.push(``);
  lines.push(generateHelpers());
  lines.push(``);
  lines.push(`# ${'─'.repeat(65)}`);
  lines.push(`# BOOTH GEOMETRY`);
  lines.push(`# ${'─'.repeat(65)}`);
  lines.push(``);

  config.elements.forEach(el => {
    let code = '';
    switch (el.type) {
      case 'floor':             code = genFloor(el, config.width, config.depth); break;
      case 'back_wall':         code = genBackWall(el, config.width); break;
      case 'side_wall_left':    code = genSideWall(el, config.depth, 'left'); break;
      case 'side_wall_right':   code = genSideWall(el, config.depth, 'right'); break;
      case 'curved_wall':       code = genCurvedWall(el); break;
      case 'pillar_wall':       code = genPillarWall(el); break;
      case 'display_tower':     code = genDisplayTower(el); break;
      case 'header_fascia':     code = genHeaderFascia(el); break;
      case 'reception_desk':    code = genReceptionDesk(el); break;
      case 'kiosk':             code = genKiosk(el); break;
      case 'pergola':           code = genPergola(el, config.width, config.depth); break;
      case 'round_table':
      case 'high_table':        code = genRoundTable(el); break;
      case 'stool':             code = genStool(el); break;
      case 'sofa':              code = genSofa(el); break;
      case 'screen_panel':      code = genScreenPanel(el); break;
      case 'palm_tree':         code = genPalmTree(el); break;
      case 'planter':           code = genPlanter(el); break;
      case 'mashrabiya_panel':  code = genMashrabiya(el); break;
      case 'arch':              code = `# Entry arch: ${el.label ?? el.id} — add manually or use curved_wall type\n`; break;
      default:                  code = `# Element "${el.type}" (${el.label ?? el.id}) — geometry not yet defined\n`;
    }
    lines.push(code);
    lines.push(``);
  });

  lines.push(genSceneLighting(config.width, config.depth, config.wallHeight));
  lines.push(``);
  lines.push(genCameras(config.scenes));
  lines.push(``);

  lines.push(`# ─── SAVE & REPORT ──────────────────────────────────────────────────────────`);
  lines.push(`output_path = os.path.join(os.path.dirname(os.path.abspath(__file__)) if '__file__' in dir() else bpy.path.abspath("//"), "${config.boothName.replace(/\s+/g, '_')}.blend")`);
  lines.push(`try:`);
  lines.push(`    bpy.ops.wm.save_as_mainfile(filepath=output_path)`);
  lines.push(`    print(f"✓ Saved: {output_path}")`);
  lines.push(`except Exception as e:`);
  lines.push(`    print(f"Note: Could not auto-save: {e}")`);
  lines.push(`    print("  → File → Save As manually to save your work")`);
  lines.push(``);
  lines.push(`print("✓ ${config.boothName} built successfully")`);
  lines.push(`print(f"  Objects: {len(bpy.data.objects)}")`);
  lines.push(`print(f"  Materials: {len(bpy.data.materials)}")`);
  lines.push(`print(f"  Collections: {len(bpy.data.collections)}")`);
  lines.push(`print("  → Switch to Rendered view (Z key) to preview")`);

  return lines.join('\n');
}
