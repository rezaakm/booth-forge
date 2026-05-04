'use client';

import { useState, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Download, Wand2, AlertTriangle, CheckCircle2, Box, FileCode2, Map, ChevronDown, ChevronUp, Loader2, Layers, Camera, Settings2, Sparkles, Zap, Upload, Image as ImageIcon, FileBox } from 'lucide-react';
import { GenerateResponse, BoothConfig } from '@/lib/types';
import type { BoothViewer3DHandle } from '@/components/booth-viewer-3d';

const BoothViewer3D = dynamic(() => import('@/components/booth-viewer-3d'), { ssr: false }) as any;

// ─── Constants ───────────────────────────────────────────────────────────────

const BOOTH_SIZES = [
  { label: '3×3', w: 3, d: 3, tag: 'Small' },
  { label: '3×6', w: 3, d: 6, tag: 'Medium' },
  { label: '6×6', w: 6, d: 6, tag: 'Standard' },
  { label: '6×9', w: 6, d: 9, tag: 'Large' },
  { label: '9×9', w: 9, d: 9, tag: 'XL' },
  { label: '12×6', w: 12, d: 6, tag: 'Wide' },
  { label: 'Custom', w: 0, d: 0, tag: '' },
];

const BOOTH_STYLES = [
  { id: 'corporate', label: 'Corporate', desc: 'Clean, professional, branded' },
  { id: 'luxury', label: 'Luxury', desc: 'Premium materials, high-end' },
  { id: 'modern', label: 'Modern', desc: 'Minimal, contemporary lines' },
  { id: 'pavilion', label: 'Pavilion', desc: 'Open, architectural, airy' },
  { id: 'organic', label: 'Organic', desc: 'Curved forms, soft geometry' },
  { id: 'industrial', label: 'Industrial', desc: 'Raw, structured, bold' },
];

const OPEN_SIDES_LIST = ['Front', 'Back', 'Left', 'Right'];

const ELEMENT_GROUPS = [
  { label: 'Structure', items: [
    { id: 'back_wall', label: 'Back Wall' },
    { id: 'side_walls', label: 'Side Walls' },
    { id: 'curved_wall', label: 'Curved Wall' },
    { id: 'pergola', label: 'Pergola / Ceiling' },
    { id: 'arch', label: 'Entry Arch' },
    { id: 'header_fascia', label: 'Header Fascia' },
  ]},
  { label: 'Displays', items: [
    { id: 'pillar_wall', label: 'Pillar Walls w/ Screens' },
    { id: 'screen_panel', label: 'Screen Panels' },
    { id: 'mashrabiya_panel', label: 'Mashrabiya / Lattice' },
  ]},
  { label: 'Counters', items: [
    { id: 'reception_desk', label: 'Reception Desk' },
    { id: 'kiosk', label: 'Interactive Kiosk' },
  ]},
  { label: 'Seating', items: [
    { id: 'sofa', label: 'Sofa / Lounge' },
    { id: 'chair', label: 'Chairs' },
    { id: 'round_table', label: 'Meeting Table' },
    { id: 'high_table', label: 'High / Bistro Table' },
    { id: 'stool', label: 'Bar Stools' },
  ]},
  { label: 'Landscaping', items: [
    { id: 'palm_tree', label: 'Palm Trees' },
    { id: 'planter', label: 'Planters' },
  ]},
];

const INDUSTRY_TEMPLATES = [
  { label: 'Tech / Software', icon: '💻', brief: '6m x 6m island booth for a technology company. Modern pavilion style, open all 4 sides. Central interactive kiosk for product demo. 4 pillar walls with large vertical LED screens. Pergola ceiling with integrated downlighting. Meeting table with 4 chairs. Reception desk at entry. Lounge sofa in hospitality corner. 2 tall planters. Clean white finish with electric blue accents.' },
  { label: 'Automotive', icon: '🚗', brief: '9m x 6m premium automotive exhibition booth. Luxury style. Open front and right side. Back wall with full-width header and branded LED fascia. Left and right side walls with floor-to-ceiling graphic panels. Reception desk. VIP lounge: sofa, 2 chairs. Pergola ceiling. 2 decorative palms. High bistro table near entry. Dark matte surfaces with brushed steel accents.' },
  { label: 'Healthcare', icon: '🏥', brief: '6m x 4m corporate healthcare booth. Clean corporate style. 3-wall, open front. Back wall with 3 pillar sections each with screen and tablet. Reception desk center-front. Small consultation corner with 2 chairs. Kiosk for digital brochures. Round meeting table with 4 chairs. White and teal accent palette. Entry arch. 2 planters.' },
  { label: 'Real Estate', icon: '🏢', brief: '9m x 6m luxury real estate booth. Luxury style. Grand entry arch. Reception desk with curved front. Back wall with large backlit header flanked by mashrabiya lattice panels. Full-height LED video wall on left. Lounge area: premium sofa, 2 armchairs, coffee table. Private meeting room back-right: glass walls, table, 4 chairs. Pergola ceiling. 2 palms. Walnut wood, brass accents.' },
  { label: 'Government', icon: '🏛️', brief: '9m x 9m government pavilion. Island booth open all 4 sides. Central display tower 3.5m tall. 4 zone pillar walls each with screen and tablet. Pergola overhead full span. Mashrabiya lattice dividers. 2 VIP meeting areas each with sofa and chairs. Reception desk at main entry. 4 palms, decorative planters. Header fascias at all 4 entries. Warm stone, wood and brass materials.' },
  { label: 'Retail / FMCG', icon: '🛍️', brief: '6m x 3m retail product booth. Modern style. Back and left walls, open front and right. Back wall: 4 product display sections with built-in lighting. Product demo counter at front-center. Kiosk for digital sign-up. 2 small high tables with 2 stools each for product sampling. Branded header fascia. Bold accent strips. 2 planters.' },
  { label: 'Food & Beverage', icon: '🍽️', brief: '6m x 4m food and beverage booth. Modern organic style. 3-wall, open front. Back wall with brand signage header and product display shelves. Curved sampling counter at front with 3 bar stools. Kiosk for digital menu. 2 high bistro tables with 4 stools. Product showcase panels on side walls. Warm wood surfaces, greenery, 4 herb planters.' },
  { label: 'Custom Brief', icon: '✏️', brief: '' },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function BoothForgePage() {
  // Input mode
  const [inputMode, setInputMode] = useState<'brief' | 'image'>('brief');

  // Brief mode state
  const [selectedSize, setSelectedSize] = useState(BOOTH_SIZES[2]);
  const [customW, setCustomW] = useState('');
  const [customD, setCustomD] = useState('');
  const [selectedStyle, setSelectedStyle] = useState(BOOTH_STYLES[0].id);
  const [openSides, setOpenSides] = useState(['Front']);
  const [selectedElements, setSelectedElements] = useState(['back_wall', 'reception_desk', 'screen_panel', 'round_table', 'palm_tree']);
  const [projectName, setProjectName] = useState('');
  const [clientName, setClientName] = useState('');
  const [brief, setBrief] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  // Image mode state
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageMediaType, setImageMediaType] = useState('image/png');
  const [imageNotes, setImageNotes] = useState('');

  // Generation state
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enhancing, setEnhancing] = useState(false);

  // View state
  const [viewMode, setViewMode] = useState<'plan' | '3d'>('plan');
  const [showRuby, setShowRuby] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const [exporting, setExporting] = useState(false);

  // 3D viewer handle (via callback, not ref — next/dynamic breaks ref forwarding)
  const viewerRef = useRef<BoothViewer3DHandle | null>(null);
  const handleViewerReady = useCallback((handle: BoothViewer3DHandle) => {
    viewerRef.current = handle;
  }, []);

  // ─── Handlers ────────────────────────────────────────────────────────────

  function toggleElement(id: string) {
    setSelectedElements(prev => prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]);
  }
  function toggleOpenSide(side: string) {
    setOpenSides(prev => prev.includes(side) ? prev.filter(s => s !== side) : [...prev, side]);
  }
  function applyTemplate(t: typeof INDUSTRY_TEMPLATES[0]) {
    setSelectedTemplate(t.label);
    if (!t.brief) {
      setBrief('');
      return;
    }
    // Replace the template's hardcoded size with the user's current selection
    const w = selectedSize.label === 'Custom' ? parseFloat(customW) || 6 : selectedSize.w;
    const d = selectedSize.label === 'Custom' ? parseFloat(customD) || 4 : selectedSize.d;
    const style = BOOTH_STYLES.find(s => s.id === selectedStyle)?.label?.toLowerCase() ?? selectedStyle;
    // Strip the first sentence (which contains the hardcoded size/style) and rebuild it
    const briefBody = t.brief.replace(/^\d+m?\s*x\s*\d+m?\s+[^.]+\.\s*/, '');
    const open = openSides.length > 0 ? `Open sides: ${openSides.join(', ')}.` : '';
    setBrief(`${w}m x ${d}m ${style} ${t.label.toLowerCase()} exhibition booth. ${open} ${briefBody}`.trim());
  }

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageMediaType(file.type || 'image/png');
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setImagePreview(dataUrl);
      // Extract base64 data without the data URL prefix
      const base64 = dataUrl.split(',')[1];
      setUploadedImage(base64);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    setImageMediaType(file.type);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setImagePreview(dataUrl);
      setUploadedImage(dataUrl.split(',')[1]);
    };
    reader.readAsDataURL(file);
  }, []);

  async function enhanceBrief() {
    setEnhancing(true);
    try {
      const w = selectedSize.label === 'Custom' ? parseFloat(customW) || 6 : selectedSize.w;
      const d = selectedSize.label === 'Custom' ? parseFloat(customD) || 4 : selectedSize.d;
      const style = BOOTH_STYLES.find(s => s.id === selectedStyle)?.label ?? selectedStyle;
      const res = await fetch('/api/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief, size: `${w}m x ${d}m`, style, openSides: openSides.join(', '), elements: selectedElements, clientName, projectName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setBrief(data.enhanced);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Enhancement failed');
    } finally {
      setEnhancing(false);
    }
  }

  function buildFullBrief() {
    const w = selectedSize.label === 'Custom' ? parseFloat(customW) || 6 : selectedSize.w;
    const d = selectedSize.label === 'Custom' ? parseFloat(customD) || 4 : selectedSize.d;
    const style = BOOTH_STYLES.find(s => s.id === selectedStyle)?.label ?? selectedStyle;
    const open = openSides.length > 0 ? openSides.join(', ') : 'Front';
    if (brief.trim()) {
      if (!brief.includes('m x') && !brief.includes('m ×')) {
        return `${w}m x ${d}m ${style.toLowerCase()} exhibition booth. Open sides: ${open}.\n${brief}`;
      }
      return brief;
    }
    const elemList = selectedElements.join(', ');
    return `${w}m x ${d}m exhibition booth. Style: ${style}. Open sides: ${open}. Elements required: ${elemList}. Design a complete professional booth layout with all selected elements placed logically.`;
  }

  async function generateFromBrief() {
    const fullBrief = buildFullBrief();
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief: fullBrief, projectName, clientName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Generation failed');
      setResult(data);
      setViewMode('3d');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function generateFromImage() {
    if (!uploadedImage) return;
    setLoading(true); setError(null); setResult(null);
    try {
      // Two-step AI pipeline: inventory → config (handled server-side)
      const configRes = await fetch('/api/image-to-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: uploadedImage, mediaType: imageMediaType, notes: imageNotes }),
      });
      const configData = await configRes.json();
      if (!configRes.ok) throw new Error(configData.error ?? 'Image analysis failed');

      const config: BoothConfig = configData.config;
      const fixes: string[] = configData.fixes ?? [];

      // Merge UI-provided client/project names into the config
      if (clientName) config.clientName = clientName;
      if (projectName) config.projectName = projectName;
      if (projectName && !config.boothName) config.boothName = projectName;
      if (!config.boothName || config.boothName === 'Main Floor') {
        config.boothName = projectName || clientName || 'Exhibition Space';
      }

      // Generate ruby + floor plan locally from validated config
      const { generateRubyScript } = await import('@/lib/ruby-generator');
      const { generateFloorPlanSvg } = await import('@/lib/floor-plan');

      setResult({
        config,
        rubyScript: generateRubyScript(config),
        floorPlanSvg: generateFloorPlanSvg(config),
        warnings: fixes,
      });
      setViewMode('3d');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  function generate() {
    if (loading) return;
    if (inputMode === 'image') {
      generateFromImage();
    } else {
      generateFromBrief();
    }
  }

  function downloadRuby() {
    if (!result) return;
    const blob = new Blob([result.rubyScript], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(result.config.boothName || projectName || 'booth').replace(/\s+/g, '_')}.rb`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleExportGLB() {
    if (!viewerRef.current) return;
    setExporting(true);
    try { await viewerRef.current.exportGLB(); }
    catch (e) { alert(e instanceof Error ? e.message : 'Export failed'); }
    finally { setExporting(false); }
  }

  async function handleExportUSDZ() {
    if (!viewerRef.current) return;
    setExporting(true);
    try { await viewerRef.current.exportUSDZ(); }
    catch (e) { alert(e instanceof Error ? e.message : 'Export failed'); }
    finally { setExporting(false); }
  }

  // ─── Styles ──────────────────────────────────────────────────────────────

  const S = {
    input: { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, padding: '8px 10px', fontSize: 13, color: 'white', outline: 'none', fontFamily: 'inherit' } as React.CSSProperties,
    chip: { padding: '7px 8px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 11, textAlign: 'center' as const, transition: 'all 0.15s', display: 'flex', flexDirection: 'column' as const, alignItems: 'center' } as React.CSSProperties,
    chipOn: { border: '1px solid #00D4D4', background: 'rgba(0,212,212,0.1)', color: '#00D4D4' } as React.CSSProperties,
    outBtn: { display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, fontSize: 12, color: 'rgba(255,255,255,0.7)', cursor: 'pointer' } as React.CSSProperties,
    priBtn: { display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#00D4D4', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 700, color: '#000', cursor: 'pointer' } as React.CSSProperties,
    sectionHead: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, color: 'rgba(255,255,255,0.35)', fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: '0.08em' } as React.CSSProperties,
  };

  const modeTab = (mode: 'brief' | 'image', label: string, icon: React.ReactNode) => (
    <button
      onClick={() => setInputMode(mode)}
      style={{
        flex: 1, padding: '9px 0', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600,
        background: inputMode === mode ? 'rgba(0,212,212,0.12)' : 'transparent',
        color: inputMode === mode ? '#00D4D4' : 'rgba(255,255,255,0.35)',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        transition: 'all 0.15s',
      }}
    >
      {icon} {label}
    </button>
  );

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: '#0c0d0f', color: 'white', fontFamily: 'system-ui,-apple-system,sans-serif' }}>
      <header style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '14px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 32, height: 32, background: '#00D4D4', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Box size={18} color="#000" strokeWidth={2.5} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Booth Forge</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Exhibition Booth → 3D Model Generator</div>
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>Text brief or 2D sketch → 3D · .rb · .glb · .usdz</div>
      </header>

      <div style={{ display: 'flex', height: 'calc(100vh - 57px)' }}>

        {/* ── LEFT PANEL ─────────────────────────────────────────────────── */}
        <div style={{ width: 400, flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 0' }}>

            {/* Mode Toggle */}
            <div style={{ display: 'flex', gap: 4, padding: 3, background: 'rgba(255,255,255,0.03)', borderRadius: 8, marginBottom: 20, border: '1px solid rgba(255,255,255,0.06)' }}>
              {modeTab('brief', 'Text Brief', <FileCode2 size={13} />)}
              {modeTab('image', 'Image → 3D', <ImageIcon size={13} />)}
            </div>

            {/* Project details (shared) */}
            <div style={{ marginBottom: 20 }}>
              <div style={S.sectionHead}><Settings2 size={12} /> Project Details</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 5 }}>CLIENT</div>
                  <input style={S.input} placeholder="e.g. Samsung, DEWA…" value={clientName} onChange={e => setClientName(e.target.value)} />
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 5 }}>PROJECT / EVENT</div>
                  <input style={S.input} placeholder="Project name" value={projectName} onChange={e => setProjectName(e.target.value)} />
                </div>
              </div>
            </div>

            {/* ── IMAGE MODE ──────────────────────────────────────────── */}
            {inputMode === 'image' && (
              <>
                <div style={{ marginBottom: 20 }}>
                  <div style={S.sectionHead}><Upload size={12} /> Upload Floor Plan / Sketch</div>
                  <div
                    onDrop={handleDrop}
                    onDragOver={e => e.preventDefault()}
                    style={{
                      border: '2px dashed rgba(0,212,212,0.25)',
                      borderRadius: 10,
                      padding: imagePreview ? 8 : 40,
                      textAlign: 'center',
                      cursor: 'pointer',
                      background: 'rgba(0,212,212,0.03)',
                      transition: 'all 0.15s',
                      position: 'relative',
                    }}
                    onClick={() => document.getElementById('image-input')?.click()}
                  >
                    {imagePreview ? (
                      <div style={{ position: 'relative' }}>
                        <img src={imagePreview} alt="Uploaded sketch" style={{ width: '100%', borderRadius: 6, maxHeight: 250, objectFit: 'contain' }} />
                        <button
                          onClick={(e) => { e.stopPropagation(); setUploadedImage(null); setImagePreview(null); }}
                          style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.7)', border: 'none', color: 'white', borderRadius: 4, padding: '2px 6px', fontSize: 11, cursor: 'pointer' }}
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <>
                        <ImageIcon size={32} color="rgba(0,212,212,0.3)" style={{ marginBottom: 8 }} />
                        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 4 }}>Drop a floor plan or booth sketch</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>PNG, JPG, or any image format</div>
                      </>
                    )}
                    <input id="image-input" type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
                  </div>
                </div>
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 5 }}>ADDITIONAL NOTES (optional)</div>
                  <textarea
                    style={{ ...S.input, height: 60, resize: 'none', lineHeight: '1.5' }}
                    placeholder="e.g. Booth is 9m x 6m, luxury style, the circular structure is a VIP meeting pod…"
                    value={imageNotes}
                    onChange={e => setImageNotes(e.target.value)}
                  />
                </div>
              </>
            )}

            {/* ── BRIEF MODE ──────────────────────────────────────────── */}
            {inputMode === 'brief' && (
              <>
                {/* Size */}
                <div style={{ marginBottom: 20 }}>
                  <div style={S.sectionHead}><Layers size={12} /> Booth Size</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                    {BOOTH_SIZES.map(sz => (
                      <button key={sz.label} onClick={() => setSelectedSize(sz)} style={{ ...S.chip, ...(selectedSize.label === sz.label ? S.chipOn : {}) }}>
                        <div style={{ fontWeight: 600, fontSize: 12 }}>{sz.label}</div>
                        {sz.tag && <div style={{ fontSize: 9, opacity: 0.5 }}>{sz.tag}</div>}
                      </button>
                    ))}
                  </div>
                  {selectedSize.label === 'Custom' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                      <div>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 5 }}>WIDTH (m)</div>
                        <input style={S.input} type="number" placeholder="6" value={customW} onChange={e => setCustomW(e.target.value)} />
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 5 }}>DEPTH (m)</div>
                        <input style={S.input} type="number" placeholder="4" value={customD} onChange={e => setCustomD(e.target.value)} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Style */}
                <div style={{ marginBottom: 20 }}>
                  <div style={S.sectionHead}><Sparkles size={12} /> Booth Style</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    {BOOTH_STYLES.map(st => (
                      <button key={st.id} onClick={() => setSelectedStyle(st.id)} style={{ ...S.chip, alignItems: 'flex-start', padding: '8px 10px', ...(selectedStyle === st.id ? S.chipOn : {}) }}>
                        <div style={{ fontWeight: 600, fontSize: 12 }}>{st.label}</div>
                        <div style={{ fontSize: 10, opacity: 0.45, marginTop: 1 }}>{st.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Open sides */}
                <div style={{ marginBottom: 20 }}>
                  <div style={S.sectionHead}><Map size={12} /> Open Sides</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {OPEN_SIDES_LIST.map(side => (
                      <button key={side} onClick={() => toggleOpenSide(side)} style={{ ...S.chip, flex: 1, fontSize: 11, ...(openSides.includes(side) ? S.chipOn : {}) }}>
                        {side}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Elements */}
                <div style={{ marginBottom: 20 }}>
                  <div style={S.sectionHead}><Box size={12} /> Elements to Include</div>
                  {ELEMENT_GROUPS.map(group => (
                    <div key={group.label} style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{group.label}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                        {group.items.map(item => (
                          <button key={item.id} onClick={() => toggleElement(item.id)} style={{
                            padding: '4px 9px', borderRadius: 5, fontSize: 11, cursor: 'pointer', transition: 'all 0.15s',
                            border: selectedElements.includes(item.id) ? '1px solid #00D4D4' : '1px solid rgba(255,255,255,0.1)',
                            background: selectedElements.includes(item.id) ? 'rgba(0,212,212,0.12)' : 'rgba(255,255,255,0.03)',
                            color: selectedElements.includes(item.id) ? '#00D4D4' : 'rgba(255,255,255,0.5)',
                          }}>
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Industry templates */}
                <div style={{ marginBottom: 20 }}>
                  <div style={S.sectionHead}><Camera size={12} /> Industry Templates</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    {INDUSTRY_TEMPLATES.map(t => (
                      <button key={t.label} onClick={() => applyTemplate(t)} style={{
                        padding: '8px 10px', borderRadius: 7, textAlign: 'left', cursor: 'pointer', transition: 'all 0.15s',
                        border: selectedTemplate === t.label ? '1px solid #00D4D4' : '1px solid rgba(255,255,255,0.08)',
                        background: selectedTemplate === t.label ? 'rgba(0,212,212,0.08)' : 'rgba(255,255,255,0.02)',
                      }}>
                        <div style={{ fontSize: 14, marginBottom: 2 }}>{t.icon}</div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: selectedTemplate === t.label ? '#00D4D4' : 'rgba(255,255,255,0.7)' }}>{t.label}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom brief */}
                <div style={{ marginBottom: 20 }}>
                  <div style={S.sectionHead}>
                    <FileCode2 size={12} /> Custom Brief <span style={{ color: 'rgba(255,255,255,0.2)', marginLeft: 4 }}>optional</span>
                  </div>
                  <textarea style={{ ...S.input, height: 90, resize: 'none', lineHeight: '1.5' }} placeholder="Add specific details, special elements, zones, materials, branding…&#10;Leave blank to auto-generate from your selections." value={brief} onChange={e => setBrief(e.target.value)} />
                  <button onClick={enhanceBrief} disabled={enhancing} style={{
                    marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 7, fontSize: 12, cursor: enhancing ? 'default' : 'pointer', transition: 'all 0.15s', width: '100%', justifyContent: 'center',
                    background: enhancing ? 'rgba(255,255,255,0.04)' : 'rgba(250,204,21,0.08)',
                    border: enhancing ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(250,204,21,0.25)',
                    color: enhancing ? 'rgba(255,255,255,0.25)' : '#facc15',
                  }}>
                    {enhancing ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Enhancing brief…</> : <><Zap size={13} /> Enhance Brief with AI</>}
                  </button>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', marginTop: 5 }}>Claude rewrites your brief into a rich, detailed professional design specification</div>
                </div>
              </>
            )}

            <div style={{ height: 20 }} />
          </div>

          {/* CTA */}
          <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.07)', background: 'rgba(0,0,0,0.3)' }}>
            <button
              onClick={generate}
              disabled={loading || (inputMode === 'image' && !uploadedImage)}
              style={{
                width: '100%', padding: '12px 0', borderRadius: 8, border: 'none', fontWeight: 700, fontSize: 14, cursor: loading ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                background: loading || (inputMode === 'image' && !uploadedImage) ? 'rgba(255,255,255,0.06)' : '#00D4D4',
                color: loading || (inputMode === 'image' && !uploadedImage) ? 'rgba(255,255,255,0.25)' : '#000',
              }}
            >
              {loading ? (
                <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> {inputMode === 'image' ? 'Analyzing image…' : 'Generating…'}</>
              ) : inputMode === 'image' ? (
                <><Box size={16} /> Generate 3D from Image</>
              ) : (
                <><Wand2 size={16} /> Generate Booth</>
              )}
            </button>
            <div style={{ textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.2)', marginTop: 8 }}>
              {inputMode === 'image'
                ? 'Outputs 3D model · .glb · .usdz · .rb'
                : 'Outputs 3D model · .rb · .glb · .usdz'}
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL ────────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

          {/* Empty state */}
          {!result && !loading && !error && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 48, textAlign: 'center' }}>
              <div style={{ width: 72, height: 72, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                <Box size={32} color="rgba(255,255,255,0.12)" />
              </div>
              <div style={{ fontSize: 22, fontWeight: 600, color: 'rgba(255,255,255,0.45)', marginBottom: 8 }}>Configure your booth</div>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.22)', maxWidth: 420, lineHeight: 1.7 }}>
                Write a brief or upload a 2D sketch. Claude generates a complete 3D booth model with named groups, ready for Twinmotion.
              </div>
              <div style={{ marginTop: 36, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, maxWidth: 480 }}>
                {['Image → 3D', 'Text → 3D', 'Export .glb', 'Export .usdz', 'SketchUp .rb', 'Twinmotion-ready'].map(f => (
                  <div key={f} style={{ padding: '10px 14px', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 8, fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>{f}</div>
                ))}
              </div>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <Loader2 size={40} color="#00D4D4" style={{ animation: 'spin 1s linear infinite' }} />
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)' }}>
                {inputMode === 'image' ? 'Analyzing your sketch…' : 'Claude is designing your booth…'}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.22)' }}>
                {inputMode === 'image' ? 'Step 1: Inventory → Step 2: 3D Config → Render' : 'Brief → Config → 3D Model → Floor plan'}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{ padding: 32 }}>
              <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: 20, display: 'flex', gap: 12 }}>
                <AlertTriangle size={18} color="#f87171" />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#f87171', marginBottom: 4 }}>Generation failed</div>
                  <div style={{ fontSize: 13, color: 'rgba(248,113,113,0.7)' }}>{error}</div>
                </div>
              </div>
            </div>
          )}

          {/* Results */}
          {result && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              {/* Header bar */}
              <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{result.config.boothName}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                    {result.config.clientName && <span>{result.config.clientName} · </span>}
                    {result.config.width}m × {result.config.depth}m · {result.config.style} · {result.config.elements.length} elements
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button onClick={downloadRuby} style={S.outBtn}><FileCode2 size={13} /> .rb</button>
                  <button onClick={handleExportGLB} disabled={exporting} style={S.outBtn}><FileBox size={13} /> .glb</button>
                  <button onClick={handleExportUSDZ} disabled={exporting} style={S.priBtn}><Download size={14} /> .usdz</button>
                </div>
              </div>

              {/* View tabs */}
              <div style={{ display: 'flex', gap: 0, padding: '0 24px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
                {[
                  { id: '3d' as const, label: '3D View', icon: <Box size={13} /> },
                  { id: 'plan' as const, label: 'Floor Plan', icon: <Map size={13} /> },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setViewMode(tab.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', border: 'none', cursor: 'pointer',
                      background: 'transparent', fontSize: 12, fontWeight: 600, transition: 'all 0.15s',
                      color: viewMode === tab.id ? '#00D4D4' : 'rgba(255,255,255,0.35)',
                      borderBottom: viewMode === tab.id ? '2px solid #00D4D4' : '2px solid transparent',
                    }}
                  >
                    {tab.icon} {tab.label}
                  </button>
                ))}
              </div>

              {/* View content */}
              <div style={{ flex: 1, minHeight: 0 }}>
                {viewMode === '3d' && result.config && (
                  <div style={{ height: '100%', padding: 16 }}>
                    <BoothViewer3D onReady={handleViewerReady} config={result.config} name={result.config.boothName || projectName} />
                  </div>
                )}

                {viewMode === 'plan' && (
                  <div style={{ padding: 24, overflowY: 'auto' }}>
                    {/* Warnings */}
                    {result.warnings?.length > 0 && result.warnings.map((w, i) => (
                      <div key={i} style={{ display: 'flex', gap: 8, padding: '8px 12px', background: 'rgba(234,179,8,0.06)', border: '1px solid rgba(234,179,8,0.15)', borderRadius: 7, marginBottom: 6, fontSize: 12, color: 'rgba(234,179,8,0.8)' }}>
                        <AlertTriangle size={14} /> {w}
                      </div>
                    ))}

                    {/* How to use */}
                    <div style={{ background: 'rgba(0,212,212,0.05)', border: '1px solid rgba(0,212,212,0.15)', borderRadius: 10, padding: 16, marginBottom: 20 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                        <CheckCircle2 size={15} color="#00D4D4" />
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#00D4D4' }}>Export options</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                        {[
                          { n: '.glb', t: 'Import into Twinmotion, Blender, or any 3D app' },
                          { n: '.usdz', t: 'AR preview on iOS or import into Twinmotion' },
                          { n: '.rb', t: 'Run in SketchUp Ruby Console for native model' },
                        ].map(s => (
                          <div key={s.n} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 7, padding: '10px 12px' }}>
                            <div style={{ fontSize: 16, fontWeight: 800, color: 'rgba(0,212,212,0.45)', marginBottom: 4 }}>{s.n}</div>
                            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', lineHeight: 1.4 }}>{s.t}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Floor plan */}
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>
                        <Map size={13} /> Floor Plan
                      </div>
                      <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.07)' }} dangerouslySetInnerHTML={{ __html: result.floorPlanSvg }} />
                    </div>

                    {/* Elements grid */}
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginBottom: 10 }}><Layers size={13} style={{ display: 'inline', marginRight: 6 }} />Elements ({result.config.elements.length})</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                        {result.config.elements.map(el => (
                          <div key={el.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 7 }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#00D4D4', flexShrink: 0 }} />
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{el.label ?? el.id}</div>
                              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>{el.type}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Ruby preview */}
                    <div style={{ border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, overflow: 'hidden', marginBottom: 10 }}>
                      <button onClick={() => setShowRuby(!showRuby)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(255,255,255,0.02)', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.55)', fontSize: 13 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><FileCode2 size={13} /> Ruby Script <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', marginLeft: 4 }}>{result.rubyScript.split('\n').length} lines</span></span>
                        {showRuby ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      </button>
                      {showRuby && <textarea readOnly value={result.rubyScript} style={{ width: '100%', height: 300, background: 'rgba(0,0,0,0.5)', border: 'none', padding: '12px 16px', fontSize: 11, color: '#86efac', fontFamily: 'monospace', resize: 'none', outline: 'none' }} />}
                    </div>

                    {/* JSON */}
                    <div style={{ border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, overflow: 'hidden' }}>
                      <button onClick={() => setShowJson(!showJson)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(255,255,255,0.02)', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.55)', fontSize: 13 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><FileCode2 size={13} /> Booth Config JSON</span>
                        {showJson ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      </button>
                      {showJson && <textarea readOnly value={JSON.stringify(result.config, null, 2)} style={{ width: '100%', height: 240, background: 'rgba(0,0,0,0.5)', border: 'none', padding: '12px 16px', fontSize: 11, color: '#93c5fd', fontFamily: 'monospace', resize: 'none', outline: 'none' }} />}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } ::-webkit-scrollbar { width:5px; } ::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.1); border-radius:4px; } * { box-sizing:border-box; }`}</style>
    </div>
  );
}
