import { DocTemplatePreset } from './doc.types.js';

export const DOC_TEMPLATES: DocTemplatePreset[] = [
  {
    badge: 'Popular',
    description: 'Clean blank canvas with standard margins, ready for rich unstructured writing.',
    icon: 'article',
    id: 'blank',
    initialPages: [
      {
        contentHtml: '<p><br></p>',
        id: 'page_1',
      },
    ],
    name: 'Blank Document',
    settings: {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: 11,
      lineHeight: 1.5,
      margins: { bottom: 96, left: 96, right: 96, top: 96 },
      orientation: 'portrait',
      paperSize: 'letter',
      showPageNumbers: true,
      viewMode: 'paginated',
      zoom: 1,
    },
  },
];

export function getDocTemplateById(id?: string | null): DocTemplatePreset {
  if (!id) return DOC_TEMPLATES[0];
  return DOC_TEMPLATES.find((t) => t.id === id) || DOC_TEMPLATES[0];
}
