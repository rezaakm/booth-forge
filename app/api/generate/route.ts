import { NextRequest, NextResponse } from 'next/server';
import { parseBriefToConfig } from '@/lib/claude-parser';
import { generateRubyScript } from '@/lib/ruby-generator';
import { generateFloorPlanSvg } from '@/lib/floor-plan';
import { validateAndFixConfig } from '@/lib/config-validator';
import { GenerateRequest, GenerateResponse } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const body: GenerateRequest = await req.json();

    if (!body.brief || body.brief.trim().length < 10) {
      return NextResponse.json(
        { error: 'Brief is too short. Describe the booth dimensions, style, and key elements.' },
        { status: 400 }
      );
    }

    // Step 1: Parse brief into structured config via Claude
    const rawConfig = await parseBriefToConfig(body);

    // Step 2: Validate and fix config
    const { config, fixes } = validateAndFixConfig(rawConfig);

    // Step 3: Generate SketchUp Ruby script
    const rubyScript = generateRubyScript(config);

    // Step 4: Generate SVG floor plan
    const floorPlanSvg = generateFloorPlanSvg(config);

    // Step 5: Collect warnings
    const warnings: string[] = [...fixes];
    if (config.elements.length < 3) {
      warnings.push('Very few elements generated — try adding more detail to your brief.');
    }
    if (!config.elements.find(e => e.type === 'floor')) {
      warnings.push('No floor element found — the script may need adjustment.');
    }
    const hasWalls = config.elements.some(e =>
      ['back_wall', 'side_wall_left', 'side_wall_right', 'curved_wall'].includes(e.type)
    );
    if (!hasWalls && config.openSides.length < 4) {
      warnings.push('No walls detected — booth may appear open on all sides.');
    }

    const response: GenerateResponse = {
      config,
      rubyScript,
      floorPlanSvg,
      warnings,
    };

    return NextResponse.json(response);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
