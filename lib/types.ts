// ─── Booth Configuration Types ────────────────────────────────────────────────

export type BoothStyle =
  | 'corporate'
  | 'pavilion'
  | 'luxury'
  | 'organic'
  | 'industrial'
  | 'modern';

export type ElementType =
  | 'floor'
  | 'back_wall'
  | 'side_wall_left'
  | 'side_wall_right'
  | 'curved_wall'
  | 'pillar_wall'
  | 'reception_desk'
  | 'kiosk'
  | 'round_table'
  | 'high_table'
  | 'stool'
  | 'chair'
  | 'sofa'
  | 'screen_panel'
  | 'pergola'
  | 'arch'
  | 'header_fascia'
  | 'mashrabiya_panel'
  | 'display_tower'
  | 'palm_tree'
  | 'planter'
  | 'ceiling_canopy'
  | 'carpet'
  | 'stage'
  | 'seating_row'
  | 'signage_tower'
  | 'column'
  | 'partition'
  | 'custom_box'
  | 'rect_table';

export interface Position {
  x: number; // meters from origin (front-left corner)
  y: number; // meters
  z?: number; // meters, default 0
}

export interface Dimensions {
  width?: number;  // meters
  depth?: number;  // meters
  height?: number; // meters
  radius?: number; // meters (for curved elements)
  arcDeg?: number; // degrees (for arcs, default 180)
  thickness?: number; // meters (for walls/panels)
}

export interface BoothElement {
  id: string;
  type: ElementType;
  label?: string;        // display name / signage text
  position: Position;
  dimensions: Dimensions;
  rotation?: number;     // degrees around Z axis
  facing?: 'north' | 'south' | 'east' | 'west' | number; // degrees
  hasScreen?: boolean;   // whether element has an LED screen
  screenSize?: { width: number; height: number };
  hasCyanGlow?: boolean; // LED accent strip
  hasBrassTrim?: boolean;
  color?: string; // hex color override (e.g. "#cc0000" for red carpet)
  material?: 'wood' | 'metal' | 'fabric' | 'glass' | 'stone' | 'matte' | 'glossy';
  count?: number; // for seating_row: number of seats in the row
}

export interface Zone {
  id: string;
  name: string;
  type: 'entry' | 'display' | 'interactive' | 'lounge' | 'meeting' | 'hospitality';
  position: Position;
  size: { width: number; depth: number };
  elements: BoothElement[];
}

export interface CameraScene {
  name: string;
  eye: Position;
  target: Position;
}

export interface BoothConfig {
  // Identity
  projectName: string;
  clientName: string;
  boothName: string;

  // Overall dimensions
  width: number;  // meters
  depth: number;  // meters
  wallHeight: number; // meters, default 3.0

  // Style
  style: BoothStyle;

  // Layout
  openSides: ('front' | 'back' | 'left' | 'right')[];
  elements: BoothElement[];

  // Cameras
  scenes: CameraScene[];
}

// ─── Generation Request / Response ────────────────────────────────────────────

export interface GenerateRequest {
  brief: string;
  projectName?: string;
  clientName?: string;
}

export interface GenerateResponse {
  config: BoothConfig;
  rubyScript: string;
  floorPlanSvg: string;
  warnings: string[];
}
