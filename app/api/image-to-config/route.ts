import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { BoothConfig } from '@/lib/types';
import { validateAndFixConfig } from '@/lib/config-validator';
import { inventoryToConfig } from '@/lib/inventory-to-config';

const client = new Anthropic();

// ─── Step 1: Vision Analysis — extract zones, items, text, structure ────────

const ANALYSIS_SYSTEM = `You are an expert at reading architectural floor plans, booth layouts, 3D renders, and exhibition space images.

Your job: produce a precise SPATIAL INVENTORY with accurate zone boundaries and item counts.

RULES:
1. Read ALL text labels in the image — room names, dimensions, annotations
2. Estimate the overall space dimensions in meters (use text annotations if visible, or estimate from proportions)
3. Divide the space into distinct ZONES — each room, area, or functional space is a zone
4. For each zone, give PRECISE metric bounds: x1,y1 (top-left corner) to x2,y2 (bottom-right corner)
   - x goes left→right, y goes top→bottom in the image
   - Scale bounds to match the overall size in meters
5. List every item type and COUNT in each zone
6. Note colors and materials you can identify

FOR FLOOR PLANS specifically:
- Each labeled room = one zone
- Corridors and aisles = zones of type "corridor"
- Seating blocks = count TOTAL seats (rows × columns)
- Read dimension annotations if present (e.g. "6.0m", "3x3")
- Recognize standard plan symbols: rectangles with X = tables, circles = columns, curved lines = reception desks
- Hatched areas = walls or service areas

Return ONLY valid JSON, no markdown fences:
{
  "overallSize": { "width": number, "depth": number },
  "style": string,
  "textLabelsFound": [string],
  "zones": [
    {
      "name": string (use text labels from the image if visible),
      "gridPosition": string,
      "bounds": { "x1": number, "y1": number, "x2": number, "y2": number },
      "items": [
        { "type": string, "count": number, "color": string, "notes": string }
      ]
    }
  ],
  "totalCounts": {
    "trees": number,
    "seatingRows": number,
    "seatsPerRow": number,
    "carpetAreas": number,
    "boothStructures": number,
    "screens": number,
    "tables": number,
    "stages": number,
    "arches": number,
    "receptionDesks": number,
    "rooms": number,
    "corridors": number
  },
  "dominantColors": [string],
  "keyFeatures": [string]
}

Be precise with bounds. A 20m × 15m space divided into 6 zones means each zone is roughly 6-7m × 5-7m, not all 0-20 × 0-15.`;

export async function POST(req: NextRequest) {
  try {
    const { image, mediaType, notes } = await req.json();

    if (!image) {
      return NextResponse.json({ error: 'No image provided.' }, { status: 400 });
    }

    const imageBlock: Anthropic.ImageBlockParam = {
      type: 'image',
      source: {
        type: 'base64',
        media_type: mediaType as 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp',
        data: image,
      },
    };

    // ─── Step 1: AI Vision — extract zones & counts ──────────────────────

    const analysisResponse = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 6000,
      system: ANALYSIS_SYSTEM,
      messages: [{
        role: 'user',
        content: [
          imageBlock,
          {
            type: 'text',
            text: `Analyze this image. Extract every zone, room, and item with precise spatial bounds in meters.
${notes ? `Additional context from user: ${notes}` : ''}
Return the inventory JSON.`,
          },
        ],
      }],
    });

    const analysisRaw = analysisResponse.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('');

    const analysisCleaned = analysisRaw
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();

    let inventory: Record<string, unknown>;
    try {
      inventory = JSON.parse(analysisCleaned);
    } catch {
      // Fallback: try to extract JSON from mixed text
      const jsonMatch = analysisCleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        inventory = JSON.parse(jsonMatch[0]);
      } else {
        return NextResponse.json({
          error: 'Failed to parse image analysis. Try adding notes about the space dimensions and layout.',
        }, { status: 422 });
      }
    }

    // ─── Step 2: Algorithmic generation from inventory ───────────────────
    // This is where accuracy is created — NOT by asking AI to write more JSON

    const algorithmicConfig = inventoryToConfig(inventory as Parameters<typeof inventoryToConfig>[0]);

    // Apply user-provided names if available
    if (notes) {
      algorithmicConfig.boothName = algorithmicConfig.boothName || 'Exhibition Space';
    }

    // ─── Step 3: Validate and fix ────────────────────────────────────────

    const { config, fixes } = validateAndFixConfig(algorithmicConfig);

    return NextResponse.json({
      config,
      fixes,
      inventory, // pass through so client can debug
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
