import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

export async function POST(req: NextRequest) {
  try {
    const { brief, size, style, openSides, elements, clientName, projectName } = await req.json();

    if (!brief && !elements?.length) {
      return NextResponse.json({ error: 'Nothing to enhance yet. Add a brief or select some elements first.' }, { status: 400 });
    }

    const systemPrompt = `You are a senior exhibition booth designer with 20+ years of experience.
Your job is to take a rough booth brief and transform it into a rich, detailed, professional design brief.

Rules:
- Expand vague descriptions into specific architectural and spatial decisions
- Add realistic dimensions for all elements mentioned
- Suggest material finishes, lighting types, and flow logic
- Add zones (entry, engagement, hospitality, display) with clear spatial relationships
- Mention ceiling treatments, flooring zones, accent lighting
- Keep it practical — this will be modeled in SketchUp
- Do NOT add elements the user clearly doesn't want
- Output as clear flowing paragraphs, NOT bullet points
- Max 250 words — rich but not overwhelming
- Write it as a design brief, not a conversation`;

    const userPrompt = `Enhance this booth brief into a detailed professional design brief:

Client: ${clientName || 'Not specified'}
Project: ${projectName || 'Not specified'}
Size: ${size || 'Not specified'}
Style: ${style || 'Not specified'}
Open sides: ${openSides || 'Front'}
Elements selected: ${elements?.join(', ') || 'Not specified'}
Current brief: ${brief || '(none — generate from the parameters above)'}

Return ONLY the enhanced brief text. No headers, no intro, no "here is your enhanced brief" — just the brief itself.`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 600,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const enhanced = response.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('');

    return NextResponse.json({ enhanced });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
