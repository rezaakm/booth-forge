import Anthropic from '@anthropic-ai/sdk';
import { BoothConfig, GenerateRequest } from './types';

const client = new Anthropic();

const SYSTEM_PROMPT = `You are a professional exhibition booth designer and SketchUp 3D modeler.
Convert booth design briefs into precise structured JSON configurations.

Rules:
- Always include a floor element as the first element
- Position all elements within the booth footprint (x=0 is left, y=0 is front)
- Elements must NOT overlap each other
- Maintain realistic proportions for all furniture and architectural elements
- Include exactly 3 camera scenes: "Entrance View" (front-left 3/4), "Hero 3-Quarter" (elevated 3/4), "Top Plan" (bird's eye)
- Use metric units (meters) for all dimensions
- Name all groups clearly so they can be identified when assigning materials in Twinmotion/V-Ray

Standard dimensions (meters):
- Wall thickness: 0.12-0.18
- Reception desk: 1.8-2.2w x 0.6-0.7d x 1.05h
- Kiosk: 0.9-1.1 square x 1.0-1.1h
- Round dining table: r=0.35, h=0.74
- High bistro table: r=0.38, h=1.1
- Stool h=0.76, Chair 0.48x0.48
- Sofa 2-seat: 1.7w x 0.72d
- Palm tree: h=1.6-2.0
- Pillar wall: 1.6-2.0w x full_height x 0.15d
- Pergola: spans full booth at h=2.7-2.85
- Arch: 2.6-3.0w x 2.8-3.0h

Camera positioning guide:
- Entrance View eye: (-booth_width*0.6, -booth_depth*0.8, booth_height*1.5) looking at (booth_width*0.5, booth_depth*0.4, 1.2)
- Hero 3-Quarter eye: (-booth_width*0.4, -booth_depth*0.6, booth_height*1.8) looking at (booth_width*0.6, booth_depth*0.6, 1.0)
- Top Plan eye: (booth_width*0.5, booth_depth*0.5, booth_height*4) looking at (booth_width*0.5, booth_depth*0.5, 0)`;

export async function parseBriefToConfig(request: GenerateRequest): Promise<BoothConfig> {
  const schema = `Return ONLY valid JSON, no markdown fences, no explanation:
{
  "projectName": string,
  "clientName": string,
  "boothName": string,
  "width": number,
  "depth": number,
  "wallHeight": number,
  "style": "corporate"|"pavilion"|"luxury"|"organic"|"industrial"|"modern",
  "openSides": array of "front"|"back"|"left"|"right",
  "elements": [
    {
      "id": string (no spaces),
      "type": one of: floor|back_wall|side_wall_left|side_wall_right|curved_wall|pillar_wall|reception_desk|kiosk|round_table|high_table|stool|chair|sofa|screen_panel|pergola|arch|header_fascia|mashrabiya_panel|palm_tree|planter|carpet|stage|seating_row|signage_tower|column|partition|ceiling_canopy|display_tower,
      "label": string,
      "position": {"x": number, "y": number, "z": number},
      "dimensions": {"width": number, "depth": number, "height": number, "radius": number, "arcDeg": number, "thickness": number},
      "rotation": number,
      "hasScreen": boolean,
      "screenSize": {"width": number, "height": number},
      "hasCyanGlow": boolean,
      "hasBrassTrim": boolean,
      "color": string (hex e.g. "#cc1122", optional),
      "count": number (for seating_row only)
    }
  ],
  "scenes": [
    {
      "name": string,
      "eye": {"x": number, "y": number, "z": number},
      "target": {"x": number, "y": number, "z": number}
    }
  ]
}`;

  const userMessage = `Brief: ${request.brief}
Project: ${request.projectName ?? 'Booth Project'}
Client: ${request.clientName ?? 'Client'}

${schema}`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 12000,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  const rawText = response.content
    .filter(b => b.type === 'text')
    .map(b => (b as { type: 'text'; text: string }).text)
    .join('');

  // Strip markdown fences if Claude added them
  const cleaned = rawText
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  try {
    return JSON.parse(cleaned) as BoothConfig;
  } catch {
    throw new Error(`Failed to parse booth config: ${cleaned.slice(0, 200)}`);
  }
}
