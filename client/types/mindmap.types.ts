export interface MindMapConnection {
  arrow?: boolean;
  color?: string;
  fromId: string;
  id: string;
  label?: string;
  style?: 'curved' | 'orthogonal' | 'straight';
  toId: string;
}

export interface MindMapNode {
  color: string;
  customPos?: boolean;
  fontSize?: number;
  height?: number;
  icon?: string;
  id: string;
  isCollapsed?: boolean;
  isDone?: boolean;
  isFree?: boolean;
  isTask?: boolean;
  linkingPhrase?: string;
  orderIndex: number;
  parentId: string | null;
  shape?: 'diamond' | 'document' | 'parallelogram' | 'pill' | 'rect' | 'rounded' | 'sticky' | 'underline';
  text: string;
  textColor?: string;
  width?: number;
  x: number;
  y: number;
}

export interface MindMapTheme {
  backgroundColor: string;
  branchColors: string[];
  dotColor?: string;
  fontFamily: string;
  layoutDirection?: 'radial' | 'top-down';
  lineStyle: 'curved' | 'orthogonal' | 'straight';
  nodeShape: 'diamond' | 'document' | 'parallelogram' | 'pill' | 'rect' | 'rounded' | 'sticky' | 'underline';
}

export interface MindMapPoint {
  x: number;
  y: number;
}

export interface MindMapCamera {
  x: number;
  y: number;
  zoom: number;
}

export interface MindMapProject {
  camera: MindMapCamera;
  connections?: MindMapConnection[];
  nodes: Record<string, MindMapNode>;
  rootId: string;
  subtype?: 'conceptmap' | 'flowchart' | 'kanban' | 'mindmap' | 'orgchart';
  theme: MindMapTheme;
  type: 'mindmap';
  version: 1;
}

export interface DiagramSubtypeInfo {
  badge?: string;
  description: string;
  icon: string;
  id: 'conceptmap' | 'flowchart' | 'kanban' | 'mindmap' | 'orgchart';
  isEnabled: boolean;
  name: string;
}

export const DIAGRAM_SUBTYPES: DiagramSubtypeInfo[] = [
  {
    description: 'Ramificación y asociación libre de ideas alrededor de un concepto central.',
    icon: 'psychology',
    id: 'mindmap',
    isEnabled: true,
    name: 'Mapa Mental',
  },
  {
    description: 'Red de conceptos interconectados mediante proposiciones y frases de enlace.',
    icon: 'hub',
    id: 'conceptmap',
    isEnabled: true,
    name: 'Mapa Conceptual',
  },
  {
    badge: 'Próximamente',
    description: 'Columnas y tarjetas para gestión visual de tareas y flujo de trabajo.',
    icon: 'view_kanban',
    id: 'kanban',
    isEnabled: false,
    name: 'Tablero Kanban',
  },
  {
    description: 'Diagramación de procesos paso a paso, decisiones lógicas y algoritmos.',
    icon: 'account_tree',
    id: 'flowchart',
    isEnabled: true,
    name: 'Diagrama de Flujo',
  },
  {
    badge: 'Próximamente',
    description: 'Estructuras jerárquicas empresariales, roles de equipo y organigramas.',
    icon: 'lan',
    id: 'orgchart',
    isEnabled: false,
    name: 'Organigrama',
  },
];
