import { ShapeType } from './board-shapes.config.js';
import { STICKY_NOTE_PRESETS } from './sticky-notes.config.js';

export interface DiagramComponentItem {
  category: 'flowchart' | 'mindmap' | 'cloud_data' | 'structure' | 'connectors' | 'stickies';
  categoryLabel: string;
  connectorStyle?: 'curved' | 'orthogonal' | 'straight';
  description: string;
  fillColor?: string;
  height?: number;
  id: string;
  isMindMapNode?: boolean;
  name: string;
  previewSvg: string;
  shapeType?: ShapeType;
  strokeColor?: string;
  strokeStyle?: 'dashed' | 'dotted' | 'solid';
  text?: string;
  textColor?: string;
  type: 'shape' | 'connector' | 'sticky';
  width?: number;
}

export const DIAGRAM_COMPONENTS: DiagramComponentItem[] = [];
