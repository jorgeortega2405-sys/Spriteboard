import { BOARD_SHAPES, ShapeType } from './board-shapes.config.js';
import { STICKY_NOTE_PRESETS } from './sticky-notes.config.js';

export interface DiagramTypeDefinition {
  category: 'analysis' | 'architecture' | 'conceptmap' | 'flowchart' | 'hierarchy' | 'mindmap' | 'planning';
  description: string;
  id: string;
  keyComponents: string[];
  name: string;
  suggestedLayout: 'freeform' | 'grid' | 'left-to-right' | 'matrix' | 'radial' | 'top-down';
}

export interface ToolFeatureItem {
  description: string;
  id: string;
  name: string;
  shortcut?: string;
}

export interface CanvasCategoryManifest {
  canvasType: 'board' | 'doc';
  description: string;
  diagramsAndSchemas?: DiagramTypeDefinition[];
  features: ToolFeatureItem[];
  id: string;
  name: string;
}

export const SUPPORTED_DIAGRAM_TYPES: DiagramTypeDefinition[] = [
  {
    category: 'mindmap',
    description: 'Radial visual map branching outward from a central concept for brain dumping, ideation, and rapid topic expansion.',
    id: 'mind-map',
    keyComponents: ['Central Root Node', 'Primary Radial Branches', 'Subtopics (Tab shortcut)', 'Sibling Nodes (Enter shortcut)', 'Curved Connectors'],
    name: 'Mind Map',
    suggestedLayout: 'radial',
  },
  {
    category: 'conceptmap',
    description: 'Hierarchical relational structure showing meaningful relationships between concepts connected by explicit linking phrases.',
    id: 'concept-map',
    keyComponents: ['Concept Nodes', 'Labelled Connectors (Linking Phrases)', 'Hierarchical Levels', 'Cross-links'],
    name: 'Concept Map',
    suggestedLayout: 'top-down',
  },
  {
    category: 'flowchart',
    description: 'Step-by-step sequential process workflow diagram illustrating algorithmic logic, business workflows, and decision trees.',
    id: 'flowchart',
    keyComponents: ['Start / End (Pill)', 'Process Step (Rect)', 'Decision Condition (Diamond)', 'Input / Output (Parallelogram)', 'Database (Cylinder)', 'Orthogonal Connectors'],
    name: 'Flowchart / Process Flow',
    suggestedLayout: 'top-down',
  },
  {
    category: 'architecture',
    description: 'System architecture diagram representing distributed infrastructure, microservices, cloud components, and API routing.',
    id: 'architecture-diagram',
    keyComponents: ['Cloud Nodes (Cloud)', 'Service Blocks (Rect)', 'Datastores (Cylinder)', 'Directional Connectors', 'Network Boundary Sections'],
    name: 'System Architecture Diagram',
    suggestedLayout: 'left-to-right',
  },
  {
    category: 'architecture',
    description: 'Data model schema illustrating database entities, primary/foreign keys, attributes, and table relationships.',
    id: 'database-schema',
    keyComponents: ['Entity Tables', 'Attribute Fields', 'Key Indicators (PK/FK)', 'Cardinality Connectors (1:N, M:N)'],
    name: 'Entity Relationship / Database Schema',
    suggestedLayout: 'freeform',
  },
  {
    category: 'hierarchy',
    description: 'Top-down organizational chart mapping company structure, management hierarchy, team leadership, and department roles.',
    id: 'org-chart',
    keyComponents: ['Leadership Root Node', 'Department Nodes', 'Role Cards', 'Orthogonal Branch Lines'],
    name: 'Organizational Chart / Hierarchy',
    suggestedLayout: 'top-down',
  },
  {
    category: 'planning',
    description: 'Agile workflow board organized in stage columns for visual task tracking, backlog management, and sprint execution.',
    id: 'kanban-board',
    keyComponents: ['Stage Sections (Backlog, In Progress, Review, Done)', 'Colored Sticky Note Cards', 'Priority Badges'],
    name: 'Kanban / Agile Workboard',
    suggestedLayout: 'left-to-right',
  },
  {
    category: 'analysis',
    description: 'Cause-and-effect root cause analysis diagram organizing potential problem causes into thematic categories.',
    id: 'fishbone-diagram',
    keyComponents: ['Central Problem Spine', 'Category Ribs (People, Process, Tech, Policy)', 'Detailed Cause Nodes'],
    name: 'Fishbone / Ishikawa Diagram',
    suggestedLayout: 'left-to-right',
  },
  {
    category: 'analysis',
    description: 'Overlapping geometric sets visualizing logical relationships, commonalities, intersections, and differences between domains.',
    id: 'venn-diagram',
    keyComponents: ['Translucent Circular Shapes', 'Intersection Zones', 'Labelled Property Texts'],
    name: 'Venn / Set Diagram',
    suggestedLayout: 'freeform',
  },
  {
    category: 'analysis',
    description: 'Four-quadrant strategic planning matrix evaluating Strengths, Weaknesses, Opportunities, and Threats.',
    id: 'swot-matrix',
    keyComponents: ['2×2 Boundary Sections', 'Strengths Quadrant', 'Weaknesses Quadrant', 'Opportunities Quadrant', 'Threats Quadrant', 'Sticky Note Annotations'],
    name: 'SWOT Analysis Matrix',
    suggestedLayout: 'matrix',
  },
  {
    category: 'planning',
    description: 'Timeline-based user experience map tracking personas across touchpoints, emotional states, user actions, and pain points.',
    id: 'user-journey-map',
    keyComponents: ['Stage Header Table', 'Touchpoint Cards', 'Emotion Curve Connectors', 'Opportunity Sticky Notes'],
    name: 'User Journey / Empathy Map',
    suggestedLayout: 'left-to-right',
  },
  {
    category: 'planning',
    description: 'Structured dynamic table with resizable columns, editable cells, custom cell colors, and row/column reordering.',
    id: 'structured-table',
    keyComponents: ['Header Row with Highlight', 'Custom Column Widths', 'Draggable Row/Col Controls', 'Cell Background Customization'],
    name: 'Structured Table & Matrix',
    suggestedLayout: 'grid',
  },
  {
    category: 'planning',
    description: 'Precise retro pixel grid editor supporting custom pixel dimensions, pixel-perfect painting tools, and sprite export.',
    id: 'pixel-art-grid',
    keyComponents: ['Grid Canvases (16×16, 32×32, 48×48, 64×64)', 'Pixel Brush & Eraser', 'Flood Fill Bucket', 'Eyedropper', 'PICO-8 & GameBoy Palettes'],
    name: 'Pixel Art Studio Grid',
    suggestedLayout: 'freeform',
  },
  {
    category: 'planning',
    description: 'Rapid low-fidelity UI sketch and screen layout prototyping canvas with shapes, wireframe boxes, and freehand markup.',
    id: 'freehand-wireframe',
    keyComponents: ['UI Component Shapes', 'Pen / Marker Sketch Strokes', 'Highlighter Accents', 'Text Annotations'],
    name: 'Freehand Wireframe & Sketching',
    suggestedLayout: 'freeform',
  },
];

export const BOARD_TOOLS_MANIFEST: ToolFeatureItem[] = [
  { description: 'Select single or multiple elements with marquee box, transform, drag, and resize with interactive handles', id: 'select', name: 'Select & Transform', shortcut: 'V' },
  { description: 'Smooth two-dimensional canvas panning without altering element selections', id: 'hand', name: 'Hand / Pan', shortcut: 'H or Space' },
  { description: 'Precision smooth vector pen strokes with quadratic bezier smoothing and customizable stroke width (2px - 16px)', id: 'pen', name: 'Pen / Pencil', shortcut: 'P' },
  { description: 'Semi-transparent wide marker strokes for confident markup and emphasis', id: 'marker', name: 'Marker', shortcut: 'M' },
  { description: 'Translucent square-tipped highlighter strokes (35% opacity) preserving underlying text and graphics', id: 'highlighter', name: 'Highlighter', shortcut: 'R' },
  { description: 'Direct contact element and stroke eraser with calibrated proximity radius', id: 'eraser', name: 'Eraser', shortcut: 'E' },
  { description: '11 canonical geometric shapes (Rectangle, Round-Rectangle, Circle, Triangle, Diamond, Parallelogram, Cylinder, Pill, Document, Cloud, Star) with full fill, stroke, and text support', id: 'shapes', name: 'Geometric Shapes (11 Types)', shortcut: 'S' },
  { description: '8 canonical sticky note colors with automatic typography contrast and instant double-click inline text editing', id: 'stickies', name: 'Sticky Notes (8 Colors)', shortcut: 'N' },
  { description: 'Curved (Bezier), orthogonal (right-angle), and straight connectors with 7 endpoint markers (arrows, circles, diamonds, bar) and center labels', id: 'connectors', name: 'Smart Connectors', shortcut: 'C' },
  { description: 'Scalable typography blocks (headings, subheadings, body) with custom colors and font sizes', id: 'text', name: 'Rich Text', shortcut: 'T' },
  { description: 'Interactive table grids with dynamic row/column management, cell coloring, and content autosizing', id: 'tables', name: 'Structured Tables' },
  { description: 'Titled boundary frames that visually cluster and move groups of elements together on the infinite canvas', id: 'sections', name: 'Sections / Grouping Frames' },
  { description: 'Grid drawing module (16×16, 32×32, 48×48, 64×64) with pencil, bucket, eraser, eyedropper, and transparent sprite export', id: 'pixel-grid', name: 'Pixel Art Studio', shortcut: 'X' },
  { description: 'External image upload and preset sticker library for illustrating diagrams', id: 'images-stickers', name: 'Images & Stickers' },
  { description: 'Real-time WebSocket multi-cursor presence showing collaborators with usernames and unique color badges', id: 'collaboration', name: 'Real-time Collaboration' },
  { description: 'One-click export to high-resolution PNG (opaque or transparent), vector SVG, or native Spriteboard JSON project', id: 'export-board', name: 'Multi-format Export' },
  { description: 'Natural vertical canvas panning with mouse wheel; smooth zoom in/out with Ctrl + mouse wheel', id: 'wheel-navigation', name: 'Mouse Wheel Scroll & Zoom', shortcut: 'Wheel / Ctrl+Wheel' },
];

export const DOC_TOOLS_MANIFEST: ToolFeatureItem[] = [
  { description: 'Multi-page document management with Letter and A4 paper sizes, portrait/landscape orientation, and margin presets', id: 'pagination', name: 'Dynamic Pagination' },
  { description: 'Complete typographic hierarchy (H1, H2, H3, normal body, small text) with font family and line height controls', id: 'typography', name: 'Typography & Hierarchy' },
  { description: 'Bold (Ctrl+B), italic (Ctrl+I), underline (Ctrl+U), strikethrough, text color, and highlight color', id: 'formatting', name: 'Text Formatting' },
  { description: 'Bulleted lists, numbered sequential lists, and interactive checkbox task lists', id: 'lists', name: 'Lists & Checklists' },
  { description: 'Accentuated blockquotes for quotes or callouts, and thematic horizontal dividers', id: 'blockquotes', name: 'Blockquotes & Dividers' },
  { description: 'Customizable tables with cell editing, row/column operations, and header formatting', id: 'tables', name: 'Document Tables' },
  { description: 'Image insertion with alignment and caption support within the document body', id: 'images', name: 'Images & Media' },
  { description: 'Direct one-click export of document pages as visual cards onto a new infinite whiteboard', id: 'send-to-board', name: 'Send to Whiteboard' },
  { description: 'Real-time multi-user collaborative editing with instant presence synchronization', id: 'collaboration', name: 'Real-time Collaboration' },
  { description: 'Export to PDF (.pdf), Microsoft Word (.doc), Markdown (.md), Plain Text (.txt), HTML (.html), and project JSON', id: 'export-doc', name: 'Multi-format Document Export' },
  { description: 'Natural vertical document scrolling with mouse wheel; document zoom in/out with Ctrl + mouse wheel', id: 'doc-wheel-navigation', name: 'Mouse Wheel Scroll & Zoom', shortcut: 'Wheel / Ctrl+Wheel' },
];

export const SPRITEBOARD_TOOLS_MANIFEST: CanvasCategoryManifest[] = [
  {
    canvasType: 'board',
    description: 'Two-dimensional infinite whiteboard unifying freehand drawing, geometric shapes, sticky notes, mind maps, concept maps, flowcharts, tables, pixel art, and live collaboration.',
    diagramsAndSchemas: SUPPORTED_DIAGRAM_TYPES,
    features: BOARD_TOOLS_MANIFEST,
    id: 'board-manifest',
    name: 'Infinite Whiteboard (Virtual Board)',
  },
  {
    canvasType: 'doc',
    description: 'Structured rich text document processor supporting independent pages, professional formatting, tables, and multi-format document publishing.',
    features: DOC_TOOLS_MANIFEST,
    id: 'doc-manifest',
    name: 'Rich Document Editor (Doc)',
  },
];
