export interface PresetVariant {
  height: number;
  imagePath?: string;
  label: string;
  width: number;
}

export interface PresetItem {
  aspectType: 'compact' | 'large' | 'square' | 'standard' | 'tall' | 'wide';
  boardTemplateId?: string;
  canvasType?: 'board' | 'doc' | 'presentation';
  categoryKey: string;
  categoryName: string;
  docTemplateId?: string;
  height: number;
  id: string;
  imagePath: string;
  isTemplate: boolean;
  masterPath?: string;
  name: string;
  pixelTemplateId?: string;
  presentationTemplateId?: string;
  tags?: string[];
  variants?: PresetVariant[];
  width: number;
}

export interface TemplateCategory {
  defaultName: string;
  iconName: string;
  id: string;
  nameKey: string;
}

export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  { defaultName: 'For you', iconName: 'auto_awesome', id: 'all', nameKey: 'templates.all_categories' },
  { defaultName: 'Whiteboards', iconName: 'dashboard', id: 'board', nameKey: 'templates.filter_board' },
  { defaultName: 'Presentations', iconName: 'slideshow', id: 'presentation', nameKey: 'templates.filter_presentation' },
  { defaultName: 'Documents', iconName: 'description', id: 'doc', nameKey: 'templates.filter_doc' },
];

export const ALL_PRESETS: PresetItem[] = [
  {
    aspectType: 'wide',
    boardTemplateId: 'tmpl-board-retro',
    canvasType: 'board',
    categoryKey: 'board',
    categoryName: 'Whiteboard',
    height: 1080,
    id: 'tmpl-board-retro',
    imagePath: '/assets/templates/boards/retro.svg',
    isTemplate: true,
    name: 'Agile Sprint Retrospective',
    tags: ['retro', 'retrospective', 'agile', 'scrum', 'sprint', 'whiteboard', 'sticky notes', 'team'],
    width: 1920,
  },
  {
    aspectType: 'wide',
    boardTemplateId: 'tmpl-board-roadmap',
    canvasType: 'board',
    categoryKey: 'board',
    categoryName: 'Whiteboard',
    height: 1080,
    id: 'tmpl-board-roadmap',
    imagePath: '/assets/templates/boards/roadmap.svg',
    isTemplate: true,
    name: 'Product Roadmap & Milestones',
    tags: ['roadmap', 'product', 'milestones', 'planning', 'quarterly', 'strategy', 'whiteboard'],
    width: 1920,
  },
  {
    aspectType: 'wide',
    boardTemplateId: 'tmpl-board-journey',
    canvasType: 'board',
    categoryKey: 'board',
    categoryName: 'Whiteboard',
    height: 1080,
    id: 'tmpl-board-journey',
    imagePath: '/assets/templates/boards/journey.svg',
    isTemplate: true,
    name: 'Customer Experience Journey Map',
    tags: ['journey', 'customer', 'ux', 'experience', 'empathy', 'discovery', 'user research', 'whiteboard'],
    width: 1920,
  },
  {
    aspectType: 'wide',
    boardTemplateId: 'tmpl-pres-pitch',
    canvasType: 'presentation',
    categoryKey: 'presentation',
    categoryName: 'Presentation',
    height: 720,
    id: 'tmpl-pres-pitch',
    imagePath: '/assets/templates/presentations/pitch.svg',
    isTemplate: true,
    name: 'Startup Investor Pitch Deck',
    presentationTemplateId: 'tmpl-pres-pitch',
    tags: ['pitch', 'deck', 'investor', 'startup', 'funding', 'presentation', 'slides'],
    width: 1280,
  },
  {
    aspectType: 'wide',
    boardTemplateId: 'tmpl-pres-qbr',
    canvasType: 'presentation',
    categoryKey: 'presentation',
    categoryName: 'Presentation',
    height: 720,
    id: 'tmpl-pres-qbr',
    imagePath: '/assets/templates/presentations/qbr.svg',
    isTemplate: true,
    name: 'Quarterly Business Review (QBR)',
    presentationTemplateId: 'tmpl-pres-qbr',
    tags: ['qbr', 'business', 'quarterly', 'metrics', 'review', 'kpi', 'presentation', 'slides'],
    width: 1280,
  },
  {
    aspectType: 'wide',
    boardTemplateId: 'tmpl-pres-launch',
    canvasType: 'presentation',
    categoryKey: 'presentation',
    categoryName: 'Presentation',
    height: 720,
    id: 'tmpl-pres-launch',
    imagePath: '/assets/templates/presentations/launch.svg',
    isTemplate: true,
    name: 'Product Feature Launch',
    presentationTemplateId: 'tmpl-pres-launch',
    tags: ['launch', 'product', 'feature', 'announcement', 'architecture', 'presentation', 'slides'],
    width: 1280,
  },
  {
    aspectType: 'standard',
    canvasType: 'doc',
    categoryKey: 'doc',
    categoryName: 'Document',
    docTemplateId: 'tmpl-doc-proposal',
    height: 1056,
    id: 'tmpl-doc-proposal',
    imagePath: '/assets/templates/docs/proposal.svg',
    isTemplate: true,
    name: 'Executive Project Proposal',
    tags: ['proposal', 'executive', 'project', 'business', 'document', 'scope', 'charter'],
    width: 816,
  },
  {
    aspectType: 'standard',
    canvasType: 'doc',
    categoryKey: 'doc',
    categoryName: 'Document',
    docTemplateId: 'tmpl-doc-rfc',
    height: 1056,
    id: 'tmpl-doc-rfc',
    imagePath: '/assets/templates/docs/rfc.svg',
    isTemplate: true,
    name: 'Technical Architecture RFC',
    tags: ['rfc', 'architecture', 'technical', 'engineering', 'spec', 'design doc', 'document'],
    width: 816,
  },
  {
    aspectType: 'standard',
    canvasType: 'doc',
    categoryKey: 'doc',
    categoryName: 'Document',
    docTemplateId: 'tmpl-doc-meeting',
    height: 1056,
    id: 'tmpl-doc-meeting',
    imagePath: '/assets/templates/docs/meeting.svg',
    isTemplate: true,
    name: 'Sprint Planning & Decision Log',
    tags: ['meeting', 'minutes', 'decisions', 'sprint', 'notes', 'action items', 'document'],
    width: 816,
  },
];
