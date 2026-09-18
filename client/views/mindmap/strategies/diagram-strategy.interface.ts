import { DiagramSubtype, MindMapCamera, MindMapNode, MindMapProject, MindMapTheme } from '../../../types/mindmap.types.js';

export interface ComputedNodeLayout {
  childrenIds: string[];
  color: string;
  depth: number;
  fontSize: number;
  height: number;
  icon?: string;
  id: string;
  isCollapsed: boolean;
  isDone?: boolean;
  isFree?: boolean;
  isTask?: boolean;
  linkingPhrase?: string;
  orderIndex: number;
  parentId: string | null;
  shape: 'diamond' | 'document' | 'parallelogram' | 'pill' | 'rect' | 'rounded' | 'sticky' | 'underline';
  side: 'bottom' | 'center' | 'left' | 'right';
  text: string;
  textColor: string;
  width: number;
  x: number;
  y: number;
}

export interface QuickToolAction {
  actionId: string;
  icon: string;
  label: string;
  shortcut?: string;
  tooltip: string;
}

export interface DiagramStrategy {
  computeLayout(project: MindMapProject): Map<string, ComputedNodeLayout>;
  drawCustomBackground?(
    ctx: CanvasRenderingContext2D,
    layoutMap: Map<string, ComputedNodeLayout>,
    camera: MindMapCamera,
    canvasW: number,
    canvasH: number,
    rootId: string
  ): void;
  drawCustomConnections?(
    ctx: CanvasRenderingContext2D,
    layoutMap: Map<string, ComputedNodeLayout>,
    camera: MindMapCamera,
    canvasW: number,
    canvasH: number,
    theme: MindMapTheme
  ): boolean;
  getDefaultNodeConfig(): Partial<MindMapNode>;
  getInitialProject(rootText: string): MindMapProject;
  getQuickTools(): QuickToolAction[];
  id: DiagramSubtype;
}
