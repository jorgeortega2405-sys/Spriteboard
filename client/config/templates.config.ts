export interface PresetVariant {
  height: number;
  imagePath?: string;
  label: string;
  width: number;
}

export interface PresetItem {
  aspectType: 'compact' | 'large' | 'square' | 'standard' | 'tall' | 'wide';
  authorAvatar?: string | null;
  authorName?: string;
  boardTemplateId?: string;
  canvasData?: any;
  canvasType?: 'board' | 'doc' | 'presentation';
  categoryKey: string;
  categoryName: string;
  description?: string;
  docTemplateId?: string;
  height: number;
  id: string;
  imagePath: string;
  isPremium?: boolean;
  isTemplate: boolean;
  masterPath?: string;
  name: string;
  pageImages?: string[];
  pages?: Array<{ id: string; name: string; imagePath?: string }>;
  pixelTemplateId?: string;
  presentationTemplateId?: string;
  tags?: string[];
  templateUuid?: string;
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
  { defaultName: 'My templates', iconName: 'palette', id: 'my-templates', nameKey: 'templates.tab_my_templates' },
];

export const ALL_PRESETS: PresetItem[] = [
  {
    aspectType: 'wide',
    authorName: 'Spriteboard Oficial',
    boardTemplateId: 'tmpl-board-retro',
    canvasType: 'board',
    categoryKey: 'board',
    categoryName: 'Whiteboard',
    height: 1080,
    id: 'tmpl-board-retro',
    imagePath: '/assets/templates/boards/retro.svg',
    isTemplate: true,
    name: 'Agile Sprint Retrospective',
    pageImages: [
      '/assets/templates/boards/retro.svg',
      '/assets/templates/boards/retro-2.svg',
      '/assets/templates/boards/retro-3.svg',
    ],
    tags: ['retro', 'retrospective', 'agile', 'scrum', 'sprint', 'whiteboard', 'sticky notes', 'team'],
    width: 1920,
  },
  {
    aspectType: 'wide',
    authorName: 'Spriteboard Oficial',
    boardTemplateId: 'tmpl-board-roadmap',
    canvasType: 'board',
    categoryKey: 'board',
    categoryName: 'Whiteboard',
    height: 1080,
    id: 'tmpl-board-roadmap',
    imagePath: '/assets/templates/boards/roadmap.svg',
    isPremium: true,
    isTemplate: true,
    name: 'Product Roadmap & Milestones',
    pageImages: [
      '/assets/templates/boards/roadmap.svg',
      '/assets/templates/boards/roadmap-2.svg',
      '/assets/templates/boards/roadmap-3.svg',
    ],
    tags: ['roadmap', 'product', 'milestones', 'planning', 'quarterly', 'strategy', 'whiteboard'],
    width: 1920,
  },
  {
    aspectType: 'wide',
    authorName: 'Spriteboard Oficial',
    boardTemplateId: 'tmpl-board-journey',
    canvasType: 'board',
    categoryKey: 'board',
    categoryName: 'Whiteboard',
    height: 1080,
    id: 'tmpl-board-journey',
    imagePath: '/assets/templates/boards/journey.svg',
    isTemplate: true,
    name: 'Customer Experience Journey Map',
    pageImages: [
      '/assets/templates/boards/journey.svg',
      '/assets/templates/boards/journey-2.svg',
      '/assets/templates/boards/journey-3.svg',
    ],
    tags: ['journey', 'customer', 'ux', 'experience', 'empathy', 'discovery', 'user research', 'whiteboard'],
    width: 1920,
  },
  {
    aspectType: 'wide',
    authorName: 'Spriteboard Oficial',
    boardTemplateId: 'tmpl-pres-pitch',
    canvasType: 'presentation',
    categoryKey: 'presentation',
    categoryName: 'Presentation',
    height: 720,
    id: 'tmpl-pres-pitch',
    imagePath: '/assets/templates/presentations/pitch.svg',
    isTemplate: true,
    name: 'Startup Investor Pitch Deck',
    pageImages: [
      '/assets/templates/presentations/pitch.svg',
      '/assets/templates/presentations/pitch-2.svg',
      '/assets/templates/presentations/pitch-3.svg',
    ],
    presentationTemplateId: 'tmpl-pres-pitch',
    tags: ['pitch', 'deck', 'investor', 'startup', 'funding', 'presentation', 'slides'],
    width: 1280,
  },
  {
    aspectType: 'wide',
    authorName: 'Spriteboard Oficial',
    boardTemplateId: 'tmpl-pres-qbr',
    canvasType: 'presentation',
    categoryKey: 'presentation',
    categoryName: 'Presentation',
    height: 720,
    id: 'tmpl-pres-qbr',
    imagePath: '/assets/templates/presentations/qbr.svg',
    isPremium: true,
    isTemplate: true,
    name: 'Quarterly Business Review (QBR)',
    pageImages: [
      '/assets/templates/presentations/qbr.svg',
      '/assets/templates/presentations/qbr-2.svg',
      '/assets/templates/presentations/qbr-3.svg',
    ],
    presentationTemplateId: 'tmpl-pres-qbr',
    tags: ['qbr', 'business', 'quarterly', 'metrics', 'review', 'kpi', 'presentation', 'slides'],
    width: 1280,
  },
  {
    aspectType: 'wide',
    authorName: 'Spriteboard Oficial',
    boardTemplateId: 'tmpl-pres-launch',
    canvasType: 'presentation',
    categoryKey: 'presentation',
    categoryName: 'Presentation',
    height: 720,
    id: 'tmpl-pres-launch',
    imagePath: '/assets/templates/presentations/launch.svg',
    isPremium: true,
    isTemplate: true,
    name: 'Product Feature Launch',
    pageImages: [
      '/assets/templates/presentations/launch.svg',
      '/assets/templates/presentations/launch-2.svg',
      '/assets/templates/presentations/launch-3.svg',
    ],
    presentationTemplateId: 'tmpl-pres-launch',
    tags: ['launch', 'product', 'feature', 'announcement', 'architecture', 'presentation', 'slides'],
    width: 1280,
  },
  {
    aspectType: 'standard',
    authorName: 'Spriteboard Oficial',
    canvasType: 'doc',
    categoryKey: 'doc',
    categoryName: 'Document',
    docTemplateId: 'tmpl-doc-proposal',
    height: 1056,
    id: 'tmpl-doc-proposal',
    imagePath: '/assets/templates/docs/proposal.svg',
    isTemplate: true,
    name: 'Executive Project Proposal',
    pageImages: [
      '/assets/templates/docs/proposal.svg',
      '/assets/templates/docs/proposal-2.svg',
      '/assets/templates/docs/proposal-3.svg',
    ],
    tags: ['proposal', 'executive', 'project', 'business', 'document', 'scope', 'charter'],
    width: 816,
  },
  {
    aspectType: 'standard',
    authorName: 'Spriteboard Oficial',
    canvasType: 'doc',
    categoryKey: 'doc',
    categoryName: 'Document',
    docTemplateId: 'tmpl-doc-rfc',
    height: 1056,
    id: 'tmpl-doc-rfc',
    imagePath: '/assets/templates/docs/rfc.svg',
    isPremium: true,
    isTemplate: true,
    name: 'Technical Architecture RFC',
    pageImages: [
      '/assets/templates/docs/rfc.svg',
      '/assets/templates/docs/rfc-2.svg',
      '/assets/templates/docs/rfc-3.svg',
    ],
    tags: ['rfc', 'architecture', 'technical', 'engineering', 'spec', 'design doc', 'document'],
    width: 816,
  },
  {
    aspectType: 'standard',
    authorName: 'Spriteboard Oficial',
    canvasType: 'doc',
    categoryKey: 'doc',
    categoryName: 'Document',
    docTemplateId: 'tmpl-doc-meeting',
    height: 1056,
    id: 'tmpl-doc-meeting',
    imagePath: '/assets/templates/docs/meeting.svg',
    isTemplate: true,
    name: 'Sprint Planning & Decision Log',
    pageImages: [
      '/assets/templates/docs/meeting.svg',
      '/assets/templates/docs/meeting-2.svg',
      '/assets/templates/docs/meeting-3.svg',
    ],
    tags: ['meeting', 'minutes', 'decisions', 'sprint', 'notes', 'action items', 'document'],
    width: 816,
  },
];
