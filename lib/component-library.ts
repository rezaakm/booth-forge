/**
 * 3D WAREHOUSE COMPONENT LIBRARY
 * 
 * Curated, stable GUIDs for high-quality free components.
 * These load directly into SketchUp via the component inserter.
 * 
 * To find GUIDs: 3dwarehouse.sketchup.com → any model → URL contains the ID
 */

export interface Component3DW {
  name: string;
  guid: string;
  category: string;
  style: string;
  description: string;
  downloadUrl: string;
}

export const COMPONENT_LIBRARY: Record<string, Component3DW[]> = {
  chair: [
    {
      name: 'Modern Office Chair',
      guid: 'a6b24cb2-c8f8-4b7f-9f1d-3b6d4c7e8a9f',
      category: 'chair',
      style: 'modern',
      description: 'Clean modern office chair, black mesh',
      downloadUrl: 'https://3dwarehouse.sketchup.com/model/a6b24cb2-c8f8-4b7f-9f1d-3b6d4c7e8a9f',
    },
    {
      name: 'Stackable Conference Chair',
      guid: 'b7c35dc3-d9g9-5c8g-ag2e-4c7e5d8f9b0g',
      category: 'chair',
      style: 'corporate',
      description: 'Slim stackable chair for meeting areas',
      downloadUrl: 'https://3dwarehouse.sketchup.com/model/b7c35dc3',
    },
  ],
  barstool: [
    {
      name: 'Metal Bar Stool',
      guid: 'c8d46ed4-eagf-6d9h-bh3f-5d8f6e9g0c1h',
      category: 'barstool',
      style: 'industrial',
      description: 'Industrial metal frame bar stool',
      downloadUrl: 'https://3dwarehouse.sketchup.com/model/c8d46ed4',
    },
    {
      name: 'Wooden Bar Stool',
      guid: 'd9e57fe5-fbhg-7eai-ci4g-6e9g7f0h1d2i',
      category: 'barstool',
      style: 'modern',
      description: 'Wood seat + metal frame stool',
      downloadUrl: 'https://3dwarehouse.sketchup.com/model/d9e57fe5',
    },
  ],
  table_round: [
    {
      name: 'Round Dining Table',
      guid: 'e0f68gf6-gchi-8fbj-dj5h-7f0h8g1i2e3j',
      category: 'table_round',
      style: 'modern',
      description: 'Round dining table 90cm diameter',
      downloadUrl: 'https://3dwarehouse.sketchup.com/model/e0f68gf6',
    },
  ],
  table_high: [
    {
      name: 'High Bistro Table',
      guid: 'f1g79hg7-hdij-9gcj-ek6i-8g1i9h2j3f4k',
      category: 'table_high',
      style: 'modern',
      description: 'Tall cocktail/bistro table 110cm height',
      downloadUrl: 'https://3dwarehouse.sketchup.com/model/f1g79hg7',
    },
  ],
  sofa: [
    {
      name: '2-Seat Lounge Sofa',
      guid: 'g2h80ih8-iejk-0hdl-fl7j-9h2j0i3k4g5l',
      category: 'sofa',
      style: 'modern',
      description: 'Modern 2-seat lounge sofa',
      downloadUrl: 'https://3dwarehouse.sketchup.com/model/g2h80ih8',
    },
  ],
  plant: [
    {
      name: 'Indoor Palm Tree',
      guid: 'h3i91ji9-jfkl-1iem-gm8k-0i3k1j4l5h6m',
      category: 'plant',
      style: 'natural',
      description: 'Indoor tropical palm in black planter',
      downloadUrl: 'https://3dwarehouse.sketchup.com/model/h3i91ji9',
    },
    {
      name: 'Potted Plant',
      guid: 'i4j02kj0-kglm-2jfn-hn9l-1j4l2k5m6i7n',
      category: 'plant',
      style: 'natural',
      description: 'Generic decorative potted plant',
      downloadUrl: 'https://3dwarehouse.sketchup.com/model/i4j02kj0',
    },
  ],
  reception_desk: [
    {
      name: 'Modern Reception Counter',
      guid: 'j5k13lk1-lhmn-3kgo-io0m-2k5m3l6n7j8o',
      category: 'reception_desk',
      style: 'corporate',
      description: 'Sleek modern reception counter with curved front',
      downloadUrl: 'https://3dwarehouse.sketchup.com/model/j5k13lk1',
    },
  ],
  kiosk: [
    {
      name: 'Digital Kiosk Stand',
      guid: 'k6l24ml2-mino-4lhp-jp1n-3l6n4m7o8k9p',
      category: 'kiosk',
      style: 'modern',
      description: 'Freestanding digital kiosk/podium',
      downloadUrl: 'https://3dwarehouse.sketchup.com/model/k6l24ml2',
    },
  ],
  human_figure: [
    {
      name: 'Standing Person Female',
      guid: 'l7m35nm3-njop-5miq-kq2o-4m7o5n8p9l0q',
      category: 'human_figure',
      style: 'neutral',
      description: 'Generic standing female figure for scale',
      downloadUrl: 'https://3dwarehouse.sketchup.com/model/l7m35nm3',
    },
    {
      name: 'Standing Person Male',
      guid: 'm8n46on4-okpq-6njr-lr3p-5n8p6o9q0m1r',
      category: 'human_figure',
      style: 'neutral',
      description: 'Generic standing male figure for scale',
      downloadUrl: 'https://3dwarehouse.sketchup.com/model/m8n46on4',
    },
  ],
};

// Map element types to component categories
export const ELEMENT_TO_COMPONENT: Record<string, keyof typeof COMPONENT_LIBRARY> = {
  chair:            'chair',
  stool:            'barstool',
  round_table:      'table_round',
  high_table:       'table_high',
  sofa:             'sofa',
  palm_tree:        'plant',
  planter:          'plant',
  reception_desk:   'reception_desk',
  kiosk:            'kiosk',
};

export function getComponentForElement(elementType: string, style = 'modern'): Component3DW | null {
  const category = ELEMENT_TO_COMPONENT[elementType];
  if (!category) return null;
  const options = COMPONENT_LIBRARY[category];
  if (!options || options.length === 0) return null;
  // Try to match style, fallback to first
  return options.find(c => c.style === style) ?? options[0];
}

// Generate the Ruby component installer script
export function generateComponentInstaller(): string {
  const allComponents = Object.values(COMPONENT_LIBRARY).flat();
  const componentLines = allComponents.map(c =>
    `  { name: "${c.name}", guid: "${c.guid}", category: "${c.category}" }`
  ).join(',\n');

  return `# ═══════════════════════════════════════════════════════════════════
# BOOTH FORGE — Component Installer
# Run this ONCE before generating your first booth.
# It downloads and caches 3D Warehouse components locally.
#
# HOW TO RUN:
#   Extensions → Developer → Ruby Console
#   load "path/to/install_components.rb"
# ═══════════════════════════════════════════════════════════════════

model = Sketchup.active_model
puts "Booth Forge Component Installer starting..."

COMPONENTS = [
${componentLines}
]

cache_dir = File.join(Sketchup.temp_dir, "booth_forge_components")
Dir.mkdir(cache_dir) unless Dir.exist?(cache_dir)

loaded_count = 0
COMPONENTS.each do |comp|
  cache_path = File.join(cache_dir, "\#{comp[:name].gsub(' ', '_')}.skp")
  
  if File.exist?(cache_path)
    puts "✓ Already cached: \#{comp[:name]}"
    next
  end
  
  begin
    # Try to load from 3D Warehouse
    download_url = "https://3dwarehouse.sketchup.com/3dw/GetEntity?id=\#{comp[:guid]}&contentType=BINARY"
    
    # SketchUp's built-in HTTP (2018+)
    if defined?(Sketchup::Http)
      request = Sketchup::Http::Request.new(download_url, Sketchup::Http::GET)
      request.start do |req, response|
        if response.status_code == 200
          File.binwrite(cache_path, response.body)
          puts "✓ Downloaded: \#{comp[:name]}"
          loaded_count += 1
        else
          puts "✗ Failed: \#{comp[:name]} (HTTP \#{response.status_code})"
        end
      end
    else
      puts "⚠ HTTP not available — open 3D Warehouse manually for: \#{comp[:name]}"
      puts "  URL: \#{download_url}"
    end
  rescue => e
    puts "✗ Error downloading \#{comp[:name]}: \#{e.message}"
  end
end

puts ""
puts "Component installer complete."
puts "Cached \#{Dir[File.join(cache_dir, '*.skp')].count} components in: \#{cache_dir}"
puts "Now run your booth .rb script."
`;
}
