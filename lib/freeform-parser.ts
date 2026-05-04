import Anthropic from '@anthropic-ai/sdk';
import { FreeFormSpec } from './freeform-engine';

const client = new Anthropic();

const SYSTEM_PROMPT = `You are an expert architectural booth designer specializing in radial, circular, and free-form pavilion designs.

Analyze the sketch/description and extract a FreeFormSpec. Return ONLY valid JSON, no markdown.

JSON Schema:
{
  "boothName": string,
  "width": number (meters, overall bounding box width),
  "depth": number (meters, overall bounding box depth),
  "height": number (meters, tallest element height, typically 2.5-4.0),
  "formType": "radial_sunburst"|"circular_rotunda"|"curved_wave"|"amphitheatre"|"hybrid_radial",
  "centerX": number (meters, center of radial form, typically width/2),
  "centerY": number (meters, typically depth/2),
  "hasRadialFins": boolean,
  "finCount": number (8-24, number of radiating fins/blades),
  "finStartAngleDeg": number (0-360, where first fin begins),
  "finSweepDeg": number (typically 360 for full sunburst, or 180 for half),
  "finInnerRadius": number (meters, distance from center where fin starts),
  "finOuterRadius": number (meters, distance from center where fin ends),
  "finHeight": number (meters, vertical height of each fin),
  "finThickness": number (meters, how thick each fin panel is, typically 0.08-0.2),
  "finTaper": "none"|"outward"|"inward",
  "hasCentralRotunda": boolean,
  "rotundaRadius": number (meters, radius of central LED cylinder),
  "rotundaHeight": number (meters, height of rotunda wall),
  "rotundaSegments": number (6-16, number of LED panel segments),
  "rotundaHasOpening": boolean (true if there's an entrance gap),
  "rotundaOpeningAngleDeg": number (degrees of opening, typically 40-90),
  "hasFloorDisc": boolean,
  "floorDiscRadius": number (meters),
  "furniturePlacements": [
    {"type": "table"|"sofa"|"kiosk"|"planter", "angleDeg": number, "radiusFromCenter": number}
  ]
}

Guidelines:
- For a "sunburst pavilion": hasRadialFins=true, fins radiating from center
- For a "rotunda": hasCentralRotunda=true, cylindrical LED wall
- For hybrid designs: combine both fins and rotunda
- Place furniture in gaps between fins or outside the rotunda
- finInnerRadius should be > rotundaRadius if both exist
- Typical booth widths: 6-15m for architectural forms`;

export async function parseFreeFormSketch(
  imageBase64: string,
  mimeType: string,
  notes: string,
  projectName: string,
  clientName: string
): Promise<FreeFormSpec> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2500,
    system: SYSTEM_PROMPT,
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
          text: `Analyze this free-form/architectural booth sketch and extract the FreeFormSpec as JSON.\n${notes ? `Designer notes: ${notes}` : ''}`,
        },
      ],
    }],
  });

  const raw = response.content
    .filter(b => b.type === 'text')
    .map(b => (b as { type: 'text'; text: string }).text)
    .join('')
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  const parsed = JSON.parse(raw);

  // Apply defaults and clamp
  const spec: FreeFormSpec = {
    projectName,
    clientName,
    boothName: parsed.boothName || 'Free-Form Booth',
    width: Math.max(4, Math.min(20, parsed.width || 9)),
    depth: Math.max(4, Math.min(20, parsed.depth || 9)),
    height: Math.max(2.0, Math.min(5.0, parsed.height || 3.0)),
    formType: parsed.formType || 'radial_sunburst',
    centerX: parsed.centerX ?? (parsed.width || 9) / 2,
    centerY: parsed.centerY ?? (parsed.depth || 9) / 2,
    hasRadialFins: parsed.hasRadialFins ?? false,
    finCount: Math.max(4, Math.min(24, parsed.finCount || 12)),
    finStartAngleDeg: parsed.finStartAngleDeg ?? 0,
    finSweepDeg: parsed.finSweepDeg ?? 360,
    finInnerRadius: parsed.finInnerRadius ?? 2.0,
    finOuterRadius: parsed.finOuterRadius ?? 4.0,
    finHeight: Math.max(0.5, Math.min(5.0, parsed.finHeight || 2.8)),
    finThickness: Math.max(0.04, Math.min(0.4, parsed.finThickness || 0.12)),
    finTaper: parsed.finTaper || 'none',
    hasCentralRotunda: parsed.hasCentralRotunda ?? false,
    rotundaRadius: parsed.rotundaRadius ?? 1.5,
    rotundaHeight: Math.max(1.0, Math.min(5.0, parsed.rotundaHeight || 2.8)),
    rotundaSegments: Math.max(4, Math.min(24, parsed.rotundaSegments || 8)),
    rotundaHasOpening: parsed.rotundaHasOpening ?? true,
    rotundaOpeningAngleDeg: parsed.rotundaOpeningAngleDeg ?? 60,
    hasFloorDisc: parsed.hasFloorDisc ?? true,
    floorDiscRadius: parsed.floorDiscRadius ?? (parsed.width || 9) / 2 - 0.5,
    furniturePlacements: Array.isArray(parsed.furniturePlacements) ? parsed.furniturePlacements : [],
  };

  return spec;
}

export async function parseFreeFormBrief(
  brief: string,
  projectName: string,
  clientName: string
): Promise<FreeFormSpec> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2500,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `Extract the free-form booth design from this brief. Return ONLY JSON.\n\nProject: ${projectName}\nClient: ${clientName}\nBrief:\n${brief}`,
    }],
  });

  const raw = response.content
    .filter(b => b.type === 'text')
    .map(b => (b as { type: 'text'; text: string }).text)
    .join('')
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  const parsed = JSON.parse(raw);

  return {
    projectName,
    clientName,
    boothName: parsed.boothName || 'Free-Form Booth',
    width: parsed.width || 9,
    depth: parsed.depth || 9,
    height: parsed.height || 3.0,
    formType: parsed.formType || 'radial_sunburst',
    centerX: parsed.centerX ?? (parsed.width || 9) / 2,
    centerY: parsed.centerY ?? (parsed.depth || 9) / 2,
    hasRadialFins: parsed.hasRadialFins ?? true,
    finCount: parsed.finCount ?? 12,
    finStartAngleDeg: parsed.finStartAngleDeg ?? 0,
    finSweepDeg: parsed.finSweepDeg ?? 360,
    finInnerRadius: parsed.finInnerRadius ?? 2.0,
    finOuterRadius: parsed.finOuterRadius ?? 4.0,
    finHeight: parsed.finHeight ?? 2.8,
    finThickness: parsed.finThickness ?? 0.12,
    finTaper: parsed.finTaper || 'none',
    hasCentralRotunda: parsed.hasCentralRotunda ?? false,
    rotundaRadius: parsed.rotundaRadius ?? 1.5,
    rotundaHeight: parsed.rotundaHeight ?? 2.8,
    rotundaSegments: parsed.rotundaSegments ?? 8,
    rotundaHasOpening: parsed.rotundaHasOpening ?? true,
    rotundaOpeningAngleDeg: parsed.rotundaOpeningAngleDeg ?? 60,
    hasFloorDisc: parsed.hasFloorDisc ?? true,
    floorDiscRadius: parsed.floorDiscRadius ?? (parsed.width || 9) / 2 - 0.5,
    furniturePlacements: parsed.furniturePlacements || [],
  };
}
