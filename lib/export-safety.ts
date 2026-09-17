import type { BoothConfig } from './types';

export function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
}

// Keep generated labels on one Ruby line and disable string interpolation.
export function rubyText(value: string): string {
  return value.replace(/[\r\n\u0000-\u001f]/g, ' ').replace(/[\\"#]/g, '\\$&');
}

export function assertExportConfig(config: BoothConfig): void {
  const finite = (value: unknown, name: string, positive = false) => {
    if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 10000 || (positive && value <= 0)) {
      throw new Error(`Invalid numeric value for ${name}`);
    }
  };
  for (const key of ['width','depth','wallHeight'] as const) finite(config[key], key, true);
  for (const key of ['boothName','projectName','clientName','style'] as const) {
    if (typeof config[key] !== 'string') throw new Error(`Invalid ${key}`);
  }
  if (!Array.isArray(config.elements) || config.elements.length > 1000 || !Array.isArray(config.scenes)) throw new Error('Invalid layout elements or scenes');
  const position = (v: object) => {
    if (!v || typeof v !== 'object') throw new Error('Invalid position');
    const p = v as Record<string, unknown>;
    finite(p.x, 'x'); finite(p.y, 'y');
    if (p.z !== undefined) finite(p.z, 'z');
  };
  for (const el of config.elements) {
    if (typeof el.id !== 'string' || typeof el.type !== 'string' || (el.label !== undefined && typeof el.label !== 'string')) throw new Error('Invalid element name');
    position(el.position);
    if (!el.dimensions || typeof el.dimensions !== 'object') throw new Error('Invalid dimensions');
    for (const [key, value] of Object.entries(el.dimensions)) if (value !== undefined) finite(value, key, true);
    if (el.rotation !== undefined) finite(el.rotation, 'rotation');
    if (el.screenSize) { finite(el.screenSize.width, 'screen width', true); finite(el.screenSize.height, 'screen height', true); }
    if (el.count !== undefined && (!Number.isInteger(el.count) || el.count < 1 || el.count > 500)) throw new Error('Invalid seat count');
    if (el.color !== undefined && !/^#[0-9a-f]{6}$/i.test(el.color)) throw new Error('Use a six-digit hex color');
  }
  for (const scene of config.scenes) {
    if (typeof scene.name !== 'string') throw new Error('Invalid scene name');
    position(scene.eye); position(scene.target);
  }
}
