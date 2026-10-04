export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface AiUsageMetadata {
  completionTokens: number;
  model: string;
  promptTokens: number;
  totalTokens: number;
}

export interface StudioOutlineProposal {
  canvasType: 'board' | 'doc' | 'presentation' | 'sheet' | 'social' | 'video';
  customizationSuggestions?: string[];
  goal?: string;
  items: Array<{
    description?: string;
    details?: string[];
    subtitle?: string;
    title: string;
  }>;
  summary: string;
  targetFormatLabel: string;
  title: string;
}

export interface UserContext {
  email?: string;
  id?: number;
  isAuthenticated: boolean;
  sessionId?: string;
  username?: string;
}

export type MindMapDiagramType =
  | 'conceptmap'
  | 'decisiontree'
  | 'fishbone'
  | 'flowchart'
  | 'kanban'
  | 'matrix'
  | 'mindmap'
  | 'orgchart'
  | 'timeline';

export type MindMapMode = 'checklist' | 'expand' | 'full';

export interface MindMapNodeItem {
  color?: string;
  icon?: string;
  id: string;
  isTask?: boolean;
  linkingPhrase?: string;
  parentId: string | null;
  shape?: string;
  text: string;
}

export interface MindMapResult {
  nodes: MindMapNodeItem[];
  rootText: string;
  title: string;
  usage?: AiUsageMetadata;
}

export type DocAction =
  | 'change_tone'
  | 'continue'
  | 'fix_grammar'
  | 'generate'
  | 'improve'
  | 'summarize'
  | 'translate';

export type DocTone =
  | 'casual'
  | 'concise'
  | 'creative'
  | 'formal'
  | 'inspiring'
  | 'professional';

export interface DocContentResult {
  html: string;
  text: string;
  usage?: AiUsageMetadata;
}

export type BoardType =
  | 'brainstorm'
  | 'conceptmap'
  | 'custom'
  | 'decisiontree'
  | 'fishbone'
  | 'flowchart'
  | 'kanban'
  | 'matrix'
  | 'mindmap'
  | 'orgchart'
  | 'retro'
  | 'swot'
  | 'timeline';

export interface BoardElementsResult {
  elements: any[];
  title: string;
  usage?: AiUsageMetadata;
}

export type PresentationTone =
  | 'creative'
  | 'educational'
  | 'minimal'
  | 'pitch'
  | 'professional';

export interface PresentationSlide {
  background?: { color: string; dotColor?: string; type: 'blank' | 'dark' | 'dots' | 'solid' };
  elements: any[];
  name: string;
}

export interface PresentationResult {
  slides: PresentationSlide[];
  title: string;
  usage?: AiUsageMetadata;
}
