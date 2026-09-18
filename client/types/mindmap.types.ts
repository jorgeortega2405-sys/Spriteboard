export type DiagramSubtype =
  | 'conceptmap'
  | 'decisiontree'
  | 'fishbone'
  | 'flowchart'
  | 'kanban'
  | 'matrix'
  | 'mindmap'
  | 'orgchart'
  | 'timeline';

export type DiagramCategory =
  | 'all'
  | 'analysis'
  | 'ideation'
  | 'planning'
  | 'processes'
  | 'structure';

export type SmartHandleDirection = 'bottom' | 'left' | 'right' | 'top';

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
  subtype?: DiagramSubtype;
  theme: MindMapTheme;
  type: 'mindmap';
  version: 1;
}

export interface DiagramCategoryInfo {
  icon: string;
  id: DiagramCategory;
  name: string;
}

export const DIAGRAM_CATEGORIES: DiagramCategoryInfo[] = [
  { icon: 'grid_view', id: 'all', name: 'Todos' },
  { icon: 'psychology', id: 'ideation', name: 'Ideación' },
  { icon: 'account_tree', id: 'processes', name: 'Procesos' },
  { icon: 'calendar_month', id: 'planning', name: 'Planificación' },
  { icon: 'analytics', id: 'analysis', name: 'Estrategia' },
  { icon: 'lan', id: 'structure', name: 'Equipos' },
];

export interface DiagramSubtypeInfo {
  badge?: string;
  category: DiagramCategory;
  description: string;
  icon: string;
  id: DiagramSubtype;
  isEnabled: boolean;
  name: string;
}

export const DIAGRAM_SUBTYPES: DiagramSubtypeInfo[] = [
  {
    badge: 'Popular',
    category: 'ideation',
    description: 'Ramificación y asociación libre de ideas alrededor de un concepto central.',
    icon: 'psychology',
    id: 'mindmap',
    isEnabled: true,
    name: 'Mapa Mental',
  },
  {
    category: 'ideation',
    description: 'Red de conceptos interconectados mediante proposiciones y frases de enlace verbales.',
    icon: 'hub',
    id: 'conceptmap',
    isEnabled: true,
    name: 'Mapa Conceptual',
  },
  {
    badge: 'Procesos',
    category: 'processes',
    description: 'Diagramación de procesos paso a paso, decisiones lógicas Sí/No y algoritmos.',
    icon: 'account_tree',
    id: 'flowchart',
    isEnabled: true,
    name: 'Diagrama de Flujo',
  },
  {
    category: 'processes',
    description: 'Bifurcaciones de decisiones probabilísticas, ramas condicionales y resultados derivados.',
    icon: 'call_split',
    id: 'decisiontree',
    isEnabled: true,
    name: 'Árbol de Decisiones',
  },
  {
    badge: 'Ágil',
    category: 'planning',
    description: 'Columnas y tarjetas para gestión visual de tareas, flujos de trabajo y sprints.',
    icon: 'view_kanban',
    id: 'kanban',
    isEnabled: true,
    name: 'Tablero Kanban',
  },
  {
    badge: 'Nuevo',
    category: 'planning',
    description: 'Eje cronológico horizontal para hitos, fases temporales y entregables de proyectos.',
    icon: 'timeline',
    id: 'timeline',
    isEnabled: true,
    name: 'Línea de Tiempo (Roadmap)',
  },
  {
    badge: 'Nuevo',
    category: 'analysis',
    description: 'Análisis de causa-efecto (6M) con espina central y categorías de diagnóstico.',
    icon: 'pest_control',
    id: 'fishbone',
    isEnabled: true,
    name: 'Diagrama de Ishikawa',
  },
  {
    badge: 'Nuevo',
    category: 'analysis',
    description: 'Cuadrantes estratégicos 2x2 para análisis FODA, priorización Eisenhower o Impacto/Esfuerzo.',
    icon: 'dashboard_customize',
    id: 'matrix',
    isEnabled: true,
    name: 'Matriz 2x2 (FODA)',
  },
  {
    category: 'structure',
    description: 'Estructuras jerárquicas empresariales, roles de mando y organigramas de equipos.',
    icon: 'lan',
    id: 'orgchart',
    isEnabled: true,
    name: 'Organigrama',
  },
];
