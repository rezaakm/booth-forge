import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { layoutBooth, BoothSpec } from '@/lib/layout-engine';
import { buildFreeFormBooth } from '@/lib/freeform-engine';
import { parseFreeFormSketch } from '@/lib/freeform-parser';
import { generateRubyScript } from '@/lib/ruby-generator';
import { generateBlenderScript } from '@/lib/blender-generator';
import { generateOBJ, generateMTL } from '@/lib/obj-generator';
import { generateFloorPlanSvg } from '@/lib/floor-plan';

const client = new Anthropic();

// Step 1: Classify the sketch as rectangular or free-form
const CLASSIFIER_SYSTEM = `You are an exhibition booth design classifier.
Look at the uploaded sketch/floor plan and determine whether it shows:
1. A RECTANGULAR booth (standard grid layout with walls, pillars, furniture in rows)
2. A FREE-FORM/ARCHITECTURAL booth (radial, circular, curved, organic shapes, sunburst patterns, rotunda)

Return ONLY valid JSON:
{"boothType": "rectangular" | "freeform", "confidence": number (0-1), "reason": string}`;

// Rectangular extraction prompt (same as sketch-to-3d)
const RECT_SYSTEM = `You are an expert exhibition booth designer and 3D modeler.
Analyze a hand-drawn booth sketch or floor plan and extract a precise design specification.

Look for:
- Overall booth dimensions (estimate from proportions if no scale shown)
- Wall configuration (which sides have walls)
- Back wall structure (pillar panels, screens)
- Furniture placement (reception desk, kiosk, tables, seating)
- Special elements (columns, header signs, planters, floor markings)
- Overall style/aesthetic

Return ONLY valid JSON matching this schema exactly, no markdown:
{
  "boothName": string,
  "width": number (meters, estimate if not labeled, typical: 3-12m),
  "depth": number (meters, estimate if not labeled, typical: 3-9m),
  "wallHeight": 3.0,
  "style": "corporate"|"luxury"|"modern"|"pavilion"|"organic"|"industrial",
  "hasBackWall": boolean,
  "hasLeftWall": boolean,
  "hasRightWall": boolean,
  "pillarCount": 0|2|3|4,
  "pillarLabels": string[],
  "pillarHasScreens": boolean,
  "hasPergola": boolean,
  "hasHeaderFascia": boolean,
  "headerText": string,
  "hasReceptionDesk": boolean,
  "receptionSide": "left"|"right"|"center",
  "hasKiosk": boolean,
  "kioskLabel": string,
  "hasSofa": boolean,
  "sofaSide": "left"|"right",
  "hasBistro": boolean,
  "bistroSide": "left"|"right",
  "bistroStools": 2,
  "hasMeetingTable": boolean,
  "meetingChairs": 4,
  "leftWallContent": "identity"|"screen"|"plain",
  "rightWallContent": "identity"|"screen"|"plain",
  "hasMashrabiya": boolean,
  "hasOrangeColumns": boolean,
  "hasFloorPath": boolean,
  "floorPathSide": "center",
  "palmCount": number,
  "planterCount": number
}`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageBase64, mimeType = 'image/png', notes = '', projectName = 'Sketch Project', clientName = 'Client' } = body;

    if (!imageBase64) {
      return NextResponse.json({ error: 'No image provided.' }, { status: 400 });
    }

    // Step 1: Classify the sketch
    const classifyResponse = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 200,
      system: CLASSIFIER_SYSTEM,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mimeType as 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp',
              data: imageBase64,
            },
          },
          { type: 'text', text: 'Classify this booth sketch.' },
        ],
      }],
    });

    const classRaw = classifyResponse.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('')
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();

    const classification = JSON.parse(classRaw);
    const isFreeForm = classification.boothType === 'freeform';

    let config;

    if (isFreeForm) {
      // ── Free-form pipeline ─────────────────────────────────────────────────
      const freeFormSpec = await parseFreeFormSketch(imageBase64, mimeType, notes, projectName, clientName);
      config = buildFreeFormBooth(freeFormSpec);
    } else {
      // ── Rectangular pipeline ───────────────────────────────────────────────
      const visionResponse = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: RECT_SYSTEM,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType as 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp',
                data: imageBase64,
              },
            },
            {
              type: 'text',
              text: `Analyze this booth sketch and extract the design specification as JSON.\n${notes ? `Additional notes: ${notes}` : ''}`,
            },
          ],
        }],
      });

      const raw = visionResponse.content
        .filter(b => b.type === 'text')
        .map(b => (b as { type: 'text'; text: string }).text)
        .join('')
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();

      const spec: BoothSpec = {
        ...JSON.parse(raw),
        projectName,
        clientName,
      };

      spec.pillarCount = Math.max(0, Math.min(4, spec.pillarCount || 0));
      spec.palmCount = Math.max(0, Math.min(4, spec.palmCount || 0));
      spec.planterCount = Math.max(0, Math.min(4, spec.planterCount || 0));
      spec.bistroStools = spec.bistroStools || 2;
      spec.pillarLabels = spec.pillarLabels || [];
      while (spec.pillarLabels.length < spec.pillarCount) {
        spec.pillarLabels.push(`SECTION ${spec.pillarLabels.length + 1}`);
      }

      config = layoutBooth(spec);
    }

    // Step 3: Generate all output formats
    const objFile = generateOBJ(config);
    const mtlFile = generateMTL(config);
    const rubyScript = generateRubyScript(config);
    const blenderScript = generateBlenderScript(config);
    const floorPlan = generateFloorPlanSvg(config);

    const fbxExportScript = `\n\n# ─── FBX + OBJ EXPORT ────────────────────────────────────────────────\nimport os\nexport_dir = os.path.dirname(os.path.abspath(__file__)) if '__file__' in dir() else bpy.path.abspath("//")\nname = "${config.boothName.replace(/\s+/g, '_')}"\n\n# Export FBX\nfbx_path = os.path.join(export_dir, name + ".fbx")\ntry:\n    bpy.ops.export_scene.fbx(\n        filepath=fbx_path,\n        use_selection=False,\n        global_scale=0.01,\n        apply_unit_scale=True,\n        apply_scale_options='FBX_SCALE_ALL',\n        use_mesh_modifiers=True,\n        mesh_smooth_type='FACE',\n        use_tspace=True,\n        embed_textures=False,\n        axis_forward='-Z',\n        axis_up='Y'\n    )\n    print(f"\\u2713 FBX exported: {fbx_path}")\nexcept Exception as e:\n    print(f"FBX export error: {e}")\n\n# Export OBJ\nobj_path = os.path.join(export_dir, name + ".obj")\ntry:\n    bpy.ops.wm.obj_export(\n        filepath=obj_path,\n        export_selected_objects=False,\n        global_scale=0.01,\n        forward_axis='NEGATIVE_Z',\n        up_axis='Y'\n    )\n    print(f"\\u2713 OBJ exported: {obj_path}")\nexcept Exception as e:\n    try:\n        bpy.ops.export_scene.obj(filepath=obj_path, use_selection=False)\n        print(f"\\u2713 OBJ exported (legacy): {obj_path}")\n    except Exception as e2:\n        print(f"OBJ export error: {e2}")\n\nprint("Export complete. Files saved to:", export_dir)\n`;

    return NextResponse.json({
      config,
      objFile,
      mtlFile,
      rubyScript,
      blenderScript: blenderScript + fbxExportScript,
      floorPlan,
      detectedType: isFreeForm ? 'freeform' : 'rectangular',
      classificationConfidence: classification.confidence,
      detectedElements: {
        width: config.width,
        depth: config.depth,
        style: config.style,
        elementCount: config.elements.length,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
