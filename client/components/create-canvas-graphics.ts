export function getDocSvg(type: string): string {
  switch (type) {
    case 'digital':
      return `<svg viewBox="0 0 180 110" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="20" y="10" width="140" height="90" rx="8" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5"/>
        <rect x="32" y="24" width="60" height="8" rx="4" fill="#3b82f6"/>
        <rect x="32" y="40" width="116" height="5" rx="2.5" fill="#cbd5e1"/>
        <rect x="32" y="52" width="98" height="5" rx="2.5" fill="#cbd5e1"/>
        <rect x="32" y="64" width="110" height="5" rx="2.5" fill="#cbd5e1"/>
        <rect x="32" y="76" width="75" height="5" rx="2.5" fill="#e2e8f0"/>
        <circle cx="142" cy="28" r="6" fill="#3b82f6" fill-opacity="0.3"/>
      </svg>`;
    case 'a4':
      return `<svg viewBox="0 0 180 110" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="52" y="8" width="76" height="94" rx="5" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5"/>
        <rect x="62" y="20" width="40" height="6" rx="3" fill="#6366f1"/>
        <rect x="62" y="34" width="56" height="4" rx="2" fill="#cbd5e1"/>
        <rect x="62" y="44" width="50" height="4" rx="2" fill="#cbd5e1"/>
        <rect x="62" y="54" width="56" height="4" rx="2" fill="#cbd5e1"/>
        <rect x="62" y="64" width="38" height="4" rx="2" fill="#e2e8f0"/>
        <rect x="62" y="76" width="56" height="14" rx="3" fill="#f8fafc" stroke="#cbd5e1" stroke-width="0.75"/>
      </svg>`;
    case 'letter':
      return `<svg viewBox="0 0 180 110" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="48" y="12" width="84" height="86" rx="5" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5"/>
        <rect x="58" y="24" width="44" height="6" rx="3" fill="#8b5cf6"/>
        <rect x="58" y="38" width="64" height="4" rx="2" fill="#cbd5e1"/>
        <rect x="58" y="48" width="58" height="4" rx="2" fill="#cbd5e1"/>
        <rect x="58" y="58" width="64" height="4" rx="2" fill="#cbd5e1"/>
        <rect x="58" y="68" width="40" height="4" rx="2" fill="#e2e8f0"/>
        <circle cx="118" cy="27" r="4" fill="#8b5cf6" fill-opacity="0.4"/>
      </svg>`;
    case 'a3':
      return `<svg viewBox="0 0 180 110" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="25" y="14" width="130" height="82" rx="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5"/>
        <rect x="37" y="24" width="45" height="6" rx="3" fill="#0ea5e9"/>
        <rect x="37" y="38" width="48" height="4" rx="2" fill="#cbd5e1"/>
        <rect x="37" y="48" width="44" height="4" rx="2" fill="#cbd5e1"/>
        <rect x="37" y="58" width="48" height="4" rx="2" fill="#cbd5e1"/>
        <rect x="95" y="38" width="48" height="42" rx="4" fill="#f8fafc" stroke="#cbd5e1" stroke-width="0.75"/>
        <rect x="101" y="46" width="36" height="3" rx="1.5" fill="#7dd3fc"/>
        <rect x="101" y="54" width="28" height="3" rx="1.5" fill="#7dd3fc"/>
      </svg>`;
    case 'legal':
      return `<svg viewBox="0 0 180 110" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="56" y="5" width="68" height="100" rx="5" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5"/>
        <rect x="66" y="16" width="36" height="5" rx="2.5" fill="#059669"/>
        <rect x="66" y="28" width="48" height="3.5" rx="1.75" fill="#cbd5e1"/>
        <rect x="66" y="37" width="44" height="3.5" rx="1.75" fill="#cbd5e1"/>
        <rect x="66" y="46" width="48" height="3.5" rx="1.75" fill="#cbd5e1"/>
        <rect x="66" y="55" width="40" height="3.5" rx="1.75" fill="#cbd5e1"/>
        <rect x="66" y="64" width="48" height="3.5" rx="1.75" fill="#cbd5e1"/>
        <rect x="66" y="73" width="30" height="3.5" rx="1.75" fill="#e2e8f0"/>
        <line x1="66" y1="88" x2="94" y2="88" stroke="#059669" stroke-width="1.2" stroke-linecap="round"/>
      </svg>`;
    case 'a5':
      return `<svg viewBox="0 0 180 110" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="55" y="16" width="70" height="78" rx="5" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5"/>
        <rect x="65" y="26" width="32" height="5" rx="2.5" fill="#d97706"/>
        <rect x="65" y="38" width="50" height="3.5" rx="1.75" fill="#cbd5e1"/>
        <rect x="65" y="47" width="44" height="3.5" rx="1.75" fill="#cbd5e1"/>
        <rect x="65" y="56" width="50" height="3.5" rx="1.75" fill="#cbd5e1"/>
        <rect x="65" y="65" width="28" height="3.5" rx="1.75" fill="#e2e8f0"/>
      </svg>`;
    default:
      return `<svg viewBox="0 0 180 110" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="48" y="10" width="84" height="90" rx="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5"/>
        <rect x="60" y="24" width="44" height="6" rx="3" fill="#6366f1"/>
        <rect x="60" y="38" width="60" height="4" rx="2" fill="#cbd5e1"/>
        <rect x="60" y="48" width="52" height="4" rx="2" fill="#cbd5e1"/>
        <rect x="60" y="58" width="58" height="4" rx="2" fill="#cbd5e1"/>
      </svg>`;
  }
}

export function getDocTemplateSvg(templateId: string): string {
  switch (templateId) {
    case 'business_report':
      return `<svg viewBox="0 0 180 110" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="42" y="10" width="96" height="90" rx="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5"/>
        <rect x="52" y="20" width="48" height="5" rx="2.5" fill="#3b82f6"/>
        <rect x="52" y="32" width="76" height="18" rx="3" fill="#eff6ff" stroke="#bfdbfe" stroke-width="0.75"/>
        <rect x="58" y="38" width="40" height="3" rx="1.5" fill="#3b82f6"/>
        <rect x="58" y="44" width="56" height="3" rx="1.5" fill="#93c5fd"/>
        <rect x="52" y="56" width="76" height="34" rx="3" fill="#f8fafc" stroke="#e2e8f0" stroke-width="0.75"/>
        <rect x="58" y="62" width="30" height="3" rx="1.5" fill="#3b82f6"/>
        <rect x="58" y="70" width="64" height="2" rx="1" fill="#94a3b8"/>
      </svg>`;
    case 'formal_letter':
      return `<svg viewBox="0 0 180 110" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="42" y="10" width="96" height="90" rx="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5"/>
        <rect x="52" y="20" width="35" height="5" rx="2.5" fill="var(--text-primary, #334155)"/>
        <rect x="52" y="32" width="76" height="1" fill="#cbd5e1"/>
        <rect x="52" y="40" width="50" height="3" rx="1.5" fill="#64748b"/>
        <rect x="52" y="48" width="76" height="2" rx="1" fill="#94a3b8"/>
        <rect x="52" y="54" width="70" height="2" rx="1" fill="#cbd5e1"/>
        <rect x="52" y="60" width="60" height="2" rx="1" fill="#cbd5e1"/>
        <line x1="52" y1="78" x2="85" y2="78" stroke="var(--text-primary, #334155)" stroke-width="1"/>
        <rect x="52" y="82" width="40" height="3" rx="1.5" fill="var(--text-primary, #334155)"/>
      </svg>`;
    case 'meeting_minutes':
      return `<svg viewBox="0 0 180 110" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="42" y="10" width="96" height="90" rx="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5"/>
        <rect x="52" y="20" width="42" height="5" rx="2.5" fill="#059669"/>
        <circle cx="56" cy="34" r="2.5" fill="#059669"/>
        <rect x="64" y="32" width="60" height="4" rx="2" fill="#a7f3d0"/>
        <circle cx="56" cy="44" r="2.5" fill="#059669"/>
        <rect x="64" y="42" width="52" height="4" rx="2" fill="#a7f3d0"/>
        <circle cx="56" cy="54" r="2.5" fill="#059669"/>
        <rect x="64" y="52" width="58" height="4" rx="2" fill="#a7f3d0"/>
        <rect x="52" y="66" width="76" height="22" rx="4" fill="#ecfdf5" stroke="#a7f3d0" stroke-width="0.75"/>
      </svg>`;
    case 'resume_cv':
      return `<svg viewBox="0 0 180 110" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="48" y="10" width="84" height="90" rx="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5"/>
        <circle cx="64" cy="26" r="8" fill="#fdf2f8" stroke="#ec4899" stroke-width="1"/>
        <rect x="78" y="20" width="44" height="4" rx="2" fill="#ec4899"/>
        <rect x="78" y="28" width="32" height="3" rx="1.5" fill="#fbcfe8"/>
        <rect x="58" y="42" width="64" height="1" fill="#fbcfe8"/>
        <rect x="58" y="48" width="30" height="3.5" rx="1.75" fill="#ec4899"/>
        <rect x="58" y="56" width="64" height="3" rx="1.5" fill="#cbd5e1"/>
        <rect x="58" y="63" width="56" height="3" rx="1.5" fill="#e2e8f0"/>
      </svg>`;
    case 'project_proposal':
      return `<svg viewBox="0 0 180 110" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="36" y="10" width="108" height="90" rx="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5"/>
        <rect x="46" y="20" width="50" height="5" rx="2.5" fill="#8b5cf6"/>
        <rect x="46" y="32" width="88" height="28" rx="3" fill="#f5f3ff" stroke="#ddd6fe" stroke-width="0.75"/>
        <rect x="52" y="38" width="45" height="3" rx="1.5" fill="#8b5cf6"/>
        <rect x="52" y="45" width="65" height="3" rx="1.5" fill="#c4b5fd"/>
        <rect x="46" y="68" width="88" height="22" rx="3" fill="#f8fafc" stroke="#e2e8f0" stroke-width="0.75"/>
      </svg>`;
    case 'software_spec':
      return `<svg viewBox="0 0 180 110" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="40" y="10" width="100" height="90" rx="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5"/>
        <rect x="50" y="20" width="45" height="5" rx="2.5" fill="#0284c7"/>
        <rect x="50" y="32" width="80" height="3" rx="1.5" fill="#7dd3fc"/>
        <rect x="50" y="40" width="70" height="3" rx="1.5" fill="#cbd5e1"/>
        <rect x="50" y="52" width="80" height="36" rx="3" fill="#f0f9ff" stroke="#bae6fd" stroke-width="0.75"/>
      </svg>`;
    case 'company_policy':
      return `<svg viewBox="0 0 180 110" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="42" y="10" width="96" height="90" rx="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5"/>
        <rect x="52" y="20" width="40" height="5" rx="2.5" fill="#d97706"/>
        <rect x="52" y="32" width="76" height="3" rx="1.5" fill="#fde68a"/>
        <rect x="52" y="42" width="65" height="3" rx="1.5" fill="#cbd5e1"/>
        <rect x="52" y="52" width="72" height="3" rx="1.5" fill="#cbd5e1"/>
      </svg>`;
    case 'service_contract':
      return `<svg viewBox="0 0 180 110" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="42" y="10" width="96" height="90" rx="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5"/>
        <rect x="52" y="20" width="55" height="5" rx="2.5" fill="#475569"/>
        <rect x="52" y="32" width="76" height="2.5" rx="1" fill="#94a3b8"/>
        <rect x="52" y="40" width="70" height="2.5" rx="1" fill="#cbd5e1"/>
        <rect x="52" y="48" width="60" height="2.5" rx="1" fill="#cbd5e1"/>
      </svg>`;
    case 'internal_newsletter':
      return `<svg viewBox="0 0 180 110" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="36" y="10" width="108" height="90" rx="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5"/>
        <rect x="46" y="18" width="88" height="24" rx="4" fill="#10b981"/>
        <rect x="52" y="26" width="40" height="4" rx="2" fill="#ffffff"/>
        <rect x="46" y="50" width="40" height="38" rx="3" fill="#f0fdf4" stroke="#bbf7d0" stroke-width="0.75"/>
        <rect x="92" y="50" width="42" height="38" rx="3" fill="#f0fdf4" stroke="#bbf7d0" stroke-width="0.75"/>
      </svg>`;
    default:
      return getDocSvg('letter');
  }
}

export function getBoardSvg(type: string = 'dots'): string {
  return `<svg viewBox="0 0 180 110" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="15" y="10" width="150" height="90" rx="8" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5"/>
    <g fill="#cbd5e1" opacity="0.8">
      <circle cx="35" cy="30" r="1.5"/><circle cx="55" cy="30" r="1.5"/><circle cx="75" cy="30" r="1.5"/><circle cx="95" cy="30" r="1.5"/><circle cx="115" cy="30" r="1.5"/><circle cx="135" cy="30" r="1.5"/><circle cx="155" cy="30" r="1.5"/>
      <circle cx="35" cy="50" r="1.5"/><circle cx="55" cy="50" r="1.5"/><circle cx="75" cy="50" r="1.5"/><circle cx="95" cy="50" r="1.5"/><circle cx="115" cy="50" r="1.5"/><circle cx="135" cy="50" r="1.5"/><circle cx="155" cy="50" r="1.5"/>
      <circle cx="35" cy="70" r="1.5"/><circle cx="55" cy="70" r="1.5"/><circle cx="75" cy="70" r="1.5"/><circle cx="95" cy="70" r="1.5"/><circle cx="115" cy="70" r="1.5"/><circle cx="135" cy="70" r="1.5"/><circle cx="155" cy="70" r="1.5"/>
      <circle cx="35" cy="90" r="1.5"/><circle cx="55" cy="90" r="1.5"/><circle cx="75" cy="90" r="1.5"/><circle cx="95" cy="90" r="1.5"/><circle cx="115" cy="90" r="1.5"/><circle cx="135" cy="90" r="1.5"/><circle cx="155" cy="90" r="1.5"/>
    </g>
    <rect x="40" y="32" width="38" height="34" rx="4" fill="#fef08a" stroke="#facc15" stroke-width="1"/>
    <rect x="46" y="38" width="22" height="3" rx="1.5" fill="#ca8a04"/>
    <rect x="46" y="45" width="26" height="2" rx="1" fill="#eab308"/>
    <rect x="46" y="50" width="18" height="2" rx="1" fill="#eab308"/>
    <rect x="105" y="44" width="40" height="34" rx="4" fill="#bae6fd" stroke="#38bdf8" stroke-width="1"/>
    <rect x="111" y="50" width="26" height="3" rx="1.5" fill="#0284c7"/>
    <rect x="111" y="57" width="28" height="2" rx="1" fill="#38bdf8"/>
    <path d="M78 49 C90 49, 92 61, 105 61" stroke="#6366f1" stroke-width="1.5" stroke-dasharray="3 3"/>
  </svg>`;
}

const DIAGRAM_DOTS_BASE = `
  <rect x="15" y="10" width="150" height="90" rx="8" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5"/>
  <g fill="#cbd5e1" opacity="0.6">
    <circle cx="35" cy="30" r="1.2"/><circle cx="55" cy="30" r="1.2"/><circle cx="75" cy="30" r="1.2"/><circle cx="95" cy="30" r="1.2"/><circle cx="115" cy="30" r="1.2"/><circle cx="135" cy="30" r="1.2"/><circle cx="155" cy="30" r="1.2"/>
    <circle cx="35" cy="50" r="1.2"/><circle cx="55" cy="50" r="1.2"/><circle cx="75" cy="50" r="1.2"/><circle cx="95" cy="50" r="1.2"/><circle cx="115" cy="50" r="1.2"/><circle cx="135" cy="50" r="1.2"/><circle cx="155" cy="50" r="1.2"/>
    <circle cx="35" cy="70" r="1.2"/><circle cx="55" cy="70" r="1.2"/><circle cx="75" cy="70" r="1.2"/><circle cx="95" cy="70" r="1.2"/><circle cx="115" cy="70" r="1.2"/><circle cx="135" cy="70" r="1.2"/><circle cx="155" cy="70" r="1.2"/>
    <circle cx="35" cy="90" r="1.2"/><circle cx="55" cy="90" r="1.2"/><circle cx="75" cy="90" r="1.2"/><circle cx="95" cy="90" r="1.2"/><circle cx="115" cy="90" r="1.2"/><circle cx="135" cy="90" r="1.2"/><circle cx="155" cy="90" r="1.2"/>
  </g>
`;

export function getDiagramSvg(subtype: string): string {
  switch (subtype) {
    case 'mindmap':
      return `<svg viewBox="0 0 180 110" fill="none" xmlns="http://www.w3.org/2000/svg">
        ${DIAGRAM_DOTS_BASE}
        <path d="M90 55 C65 55 60 30 38 30" stroke="#6366f1" stroke-width="2"/>
        <path d="M90 55 C65 55 60 80 38 80" stroke="#3b82f6" stroke-width="2"/>
        <path d="M90 55 C115 55 120 30 142 30" stroke="#10b981" stroke-width="2"/>
        <path d="M90 55 C115 55 120 80 142 80" stroke="#f59e0b" stroke-width="2"/>
        <rect x="68" y="42" width="44" height="26" rx="13" fill="#6366f1"/>
        <rect x="76" y="52" width="28" height="6" rx="3" fill="#ffffff"/>
        <rect x="20" y="20" width="36" height="20" rx="6" fill="#e0e7ff" stroke="#6366f1" stroke-width="1.5"/>
        <rect x="20" y="70" width="36" height="20" rx="6" fill="#dbeafe" stroke="#3b82f6" stroke-width="1.5"/>
        <rect x="124" y="20" width="36" height="20" rx="6" fill="#d1fae5" stroke="#10b981" stroke-width="1.5"/>
        <rect x="124" y="70" width="36" height="20" rx="6" fill="#fef3c7" stroke="#f59e0b" stroke-width="1.5"/>
      </svg>`;
    case 'flowchart':
      return `<svg viewBox="0 0 180 110" fill="none" xmlns="http://www.w3.org/2000/svg">
        ${DIAGRAM_DOTS_BASE}
        <rect x="20" y="44" width="32" height="22" rx="11" fill="#10b981" stroke="#059669" stroke-width="1.5"/>
        <path d="M52 55 L70 55" stroke="#64748b" stroke-width="1.5"/>
        <polygon points="90,38 108,55 90,72 72,55" fill="#fef3c7" stroke="#f59e0b" stroke-width="1.5"/>
        <path d="M108 55 L128 55" stroke="#64748b" stroke-width="1.5"/>
        <rect x="128" y="44" width="36" height="22" rx="4" fill="#e0e7ff" stroke="#6366f1" stroke-width="1.5"/>
        <path d="M90 72 L90 88 L146 88 L146 66" stroke="#64748b" stroke-width="1.5" fill="none"/>
      </svg>`;
    case 'kanban':
      return `<svg viewBox="0 0 180 110" fill="none" xmlns="http://www.w3.org/2000/svg">
        ${DIAGRAM_DOTS_BASE}
        <rect x="22" y="16" width="38" height="78" rx="4" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1"/>
        <rect x="71" y="16" width="38" height="78" rx="4" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1"/>
        <rect x="120" y="16" width="38" height="78" rx="4" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1"/>
        <rect x="27" y="22" width="20" height="4" rx="2" fill="#64748b"/>
        <rect x="76" y="22" width="20" height="4" rx="2" fill="#3b82f6"/>
        <rect x="125" y="22" width="20" height="4" rx="2" fill="#10b981"/>
        <rect x="26" y="32" width="30" height="18" rx="3" fill="#ffffff" stroke="#e2e8f0"/>
        <rect x="26" y="54" width="30" height="18" rx="3" fill="#ffffff" stroke="#e2e8f0"/>
        <rect x="75" y="32" width="30" height="24" rx="3" fill="#ffffff" stroke="#3b82f6" stroke-width="1.2"/>
        <rect x="124" y="32" width="30" height="18" rx="3" fill="#ffffff" stroke="#e2e8f0"/>
      </svg>`;
    case 'timeline':
      return `<svg viewBox="0 0 180 110" fill="none" xmlns="http://www.w3.org/2000/svg">
        ${DIAGRAM_DOTS_BASE}
        <line x1="20" y1="55" x2="160" y2="55" stroke="#6366f1" stroke-width="2"/>
        <circle cx="45" cy="55" r="5" fill="#6366f1"/>
        <rect x="28" y="24" width="34" height="18" rx="4" fill="#e0e7ff" stroke="#6366f1" stroke-width="1"/>
        <circle cx="90" cy="55" r="5" fill="#ec4899"/>
        <rect x="73" y="68" width="34" height="18" rx="4" fill="#fce7f3" stroke="#ec4899" stroke-width="1"/>
        <circle cx="135" cy="55" r="5" fill="#10b981"/>
        <rect x="118" y="24" width="34" height="18" rx="4" fill="#d1fae5" stroke="#10b981" stroke-width="1"/>
      </svg>`;
    case 'org_chart':
      return `<svg viewBox="0 0 180 110" fill="none" xmlns="http://www.w3.org/2000/svg">
        ${DIAGRAM_DOTS_BASE}
        <rect x="68" y="15" width="44" height="22" rx="4" fill="#6366f1"/>
        <rect x="76" y="23" width="28" height="6" rx="3" fill="#ffffff"/>
        <path d="M90 37 V52 M42 52 H138 M42 52 V65 M90 52 V65 M138 52 V65" stroke="#94a3b8" stroke-width="1.5"/>
        <rect x="22" y="65" width="40" height="22" rx="4" fill="#e0e7ff" stroke="#6366f1" stroke-width="1"/>
        <rect x="70" y="65" width="40" height="22" rx="4" fill="#e0e7ff" stroke="#6366f1" stroke-width="1"/>
        <rect x="118" y="65" width="40" height="22" rx="4" fill="#e0e7ff" stroke="#6366f1" stroke-width="1"/>
      </svg>`;
    case 'concept_map':
      return `<svg viewBox="0 0 180 110" fill="none" xmlns="http://www.w3.org/2000/svg">
        ${DIAGRAM_DOTS_BASE}
        <ellipse cx="90" cy="30" rx="28" ry="15" fill="#8b5cf6" fill-opacity="0.15" stroke="#8b5cf6" stroke-width="1.5"/>
        <ellipse cx="45" cy="80" rx="26" ry="14" fill="#3b82f6" fill-opacity="0.15" stroke="#3b82f6" stroke-width="1.5"/>
        <ellipse cx="135" cy="80" rx="26" ry="14" fill="#10b981" fill-opacity="0.15" stroke="#10b981" stroke-width="1.5"/>
        <path d="M74 42 L56 68 M106 42 L124 68 M71 80 L109 80" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="3 3"/>
      </svg>`;
    case 'fishbone':
      return `<svg viewBox="0 0 180 110" fill="none" xmlns="http://www.w3.org/2000/svg">
        ${DIAGRAM_DOTS_BASE}
        <line x1="25" y1="55" x2="135" y2="55" stroke="#0284c7" stroke-width="2.5"/>
        <polygon points="135,38 160,55 135,72" fill="#0284c7"/>
        <line x1="50" y1="25" x2="70" y2="55" stroke="#0ea5e9" stroke-width="2"/>
        <line x1="95" y1="25" x2="115" y2="55" stroke="#0ea5e9" stroke-width="2"/>
        <line x1="50" y1="85" x2="70" y2="55" stroke="#0ea5e9" stroke-width="2"/>
        <line x1="95" y1="85" x2="115" y2="55" stroke="#0ea5e9" stroke-width="2"/>
        <rect x="35" y="16" width="26" height="12" rx="3" fill="#e0f2fe"/>
        <rect x="80" y="16" width="26" height="12" rx="3" fill="#e0f2fe"/>
        <rect x="35" y="82" width="26" height="12" rx="3" fill="#e0f2fe"/>
        <rect x="80" y="82" width="26" height="12" rx="3" fill="#e0f2fe"/>
      </svg>`;
    case 'venn':
      return `<svg viewBox="0 0 180 110" fill="none" xmlns="http://www.w3.org/2000/svg">
        ${DIAGRAM_DOTS_BASE}
        <circle cx="70" cy="55" r="35" fill="#6366f1" fill-opacity="0.3" stroke="#6366f1" stroke-width="2"/>
        <circle cx="110" cy="55" r="35" fill="#ec4899" fill-opacity="0.3" stroke="#ec4899" stroke-width="2"/>
        <path d="M90 26 C98 34, 102 44, 102 55 C102 66, 98 76, 90 84 C82 76, 78 66, 78 55 C78 44, 82 34, 90 26 Z" fill="#8b5cf6" fill-opacity="0.5"/>
      </svg>`;
    default:
      return `<svg viewBox="0 0 180 110" fill="none" xmlns="http://www.w3.org/2000/svg">
        ${DIAGRAM_DOTS_BASE}
        <rect x="30" y="25" width="40" height="26" rx="6" fill="#6366f1"/>
        <rect x="110" y="25" width="40" height="26" rx="6" fill="#3b82f6"/>
        <rect x="70" y="65" width="40" height="26" rx="6" fill="#10b981"/>
        <path d="M70 38 H110 M50 51 V78 H70 M130 51 V78 H110" stroke="#94a3b8" stroke-width="1.5"/>
      </svg>`;
  }
}

export function getPixelSvg(type: string, size?: number): string {
  if (type === 'pixel-infinite') {
    return `<svg viewBox="0 0 180 110" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="15" y="10" width="150" height="90" rx="8" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5"/>
      <g stroke="#6366f1" stroke-width="2" fill="none">
        <path d="M55 55 C42 36, 24 36, 24 55 C24 74, 42 74, 55 55 Z"/>
        <path d="M55 55 C68 74, 86 74, 86 55 C86 36, 68 36, 55 55 Z"/>
      </g>
      <rect x="105" y="25" width="16" height="16" rx="2" fill="#818cf8"/>
      <rect x="125" y="25" width="16" height="16" rx="2" fill="#a5b4fc"/>
      <rect x="105" y="45" width="16" height="16" rx="2" fill="#c7d2fe"/>
      <rect x="125" y="45" width="16" height="16" rx="2" fill="#818cf8"/>
      <rect x="105" y="65" width="16" height="16" rx="2" fill="#6366f1"/>
      <rect x="125" y="65" width="16" height="16" rx="2" fill="#4f46e5"/>
    </svg>`;
  }

  if (type === 'custom') {
    return `<svg viewBox="0 0 180 110" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="15" y="10" width="150" height="90" rx="8" stroke="#a855f7" stroke-width="1.5" stroke-dasharray="4 4" fill="#ffffff"/>
      <circle cx="90" cy="52" r="18" fill="#f5f3ff" stroke="#d8b4fe" stroke-width="1"/>
      <path d="M90 42 V62 M80 52 H100" stroke="#a855f7" stroke-width="2.5" stroke-linecap="round"/>
      <text x="90" y="84" font-size="9" font-weight="bold" fill="#a855f7" text-anchor="middle" font-family="sans-serif">W × H</text>
    </svg>`;
  }

  const s = size || 32;
  if (s <= 16) {
    return `<svg viewBox="0 0 180 110" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="15" y="10" width="150" height="90" rx="8" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5"/>
      <rect x="58" y="22" width="64" height="64" rx="4" fill="#ffffff" stroke="#e2e8f0" stroke-width="1"/>
      <g opacity="0.6">
        <rect x="58" y="22" width="16" height="16" fill="#f8fafc"/><rect x="90" y="22" width="16" height="16" fill="#f8fafc"/>
        <rect x="74" y="38" width="16" height="16" fill="#f8fafc"/><rect x="106" y="38" width="16" height="16" fill="#f8fafc"/>
        <rect x="58" y="54" width="16" height="16" fill="#f8fafc"/><rect x="90" y="54" width="16" height="16" fill="#f8fafc"/>
        <rect x="74" y="70" width="16" height="16" fill="#f8fafc"/><rect x="106" y="70" width="16" height="16" fill="#f8fafc"/>
      </g>
      <rect x="74" y="36" width="8" height="8" fill="#f43f5e"/>
      <rect x="82" y="36" width="8" height="8" fill="#f43f5e"/>
      <rect x="90" y="36" width="8" height="8" fill="#f43f5e"/>
      <rect x="98" y="36" width="8" height="8" fill="#f43f5e"/>
      <rect x="74" y="44" width="8" height="8" fill="#fb7185"/>
      <rect x="82" y="44" width="8" height="8" fill="#fda4af"/>
      <rect x="90" y="44" width="8" height="8" fill="#fb7185"/>
      <rect x="98" y="44" width="8" height="8" fill="#f43f5e"/>
      <rect x="82" y="52" width="8" height="8" fill="#f43f5e"/>
      <rect x="90" y="52" width="8" height="8" fill="#f43f5e"/>
      <rect x="86" y="60" width="8" height="8" fill="#e11d48"/>
    </svg>`;
  }

  if (s <= 32) {
    return `<svg viewBox="0 0 180 110" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="15" y="10" width="150" height="90" rx="8" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5"/>
      <rect x="54" y="18" width="72" height="72" rx="4" fill="#ffffff" stroke="#e2e8f0" stroke-width="1"/>
      <g opacity="0.6">
        <rect x="54" y="18" width="18" height="18" fill="#f8fafc"/><rect x="90" y="18" width="18" height="18" fill="#f8fafc"/>
        <rect x="72" y="36" width="18" height="18" fill="#f8fafc"/><rect x="108" y="36" width="18" height="18" fill="#f8fafc"/>
        <rect x="54" y="54" width="18" height="18" fill="#f8fafc"/><rect x="90" y="54" width="18" height="18" fill="#f8fafc"/>
        <rect x="72" y="72" width="18" height="18" fill="#f8fafc"/><rect x="108" y="72" width="18" height="18" fill="#f8fafc"/>
      </g>
      <rect x="70" y="28" width="10" height="10" fill="#38bdf8"/>
      <rect x="80" y="28" width="10" height="10" fill="#38bdf8"/>
      <rect x="90" y="28" width="10" height="10" fill="#38bdf8"/>
      <rect x="100" y="28" width="10" height="10" fill="#38bdf8"/>
      <rect x="70" y="38" width="10" height="10" fill="#0284c7"/>
      <rect x="80" y="38" width="10" height="10" fill="#bae6fd"/>
      <rect x="90" y="38" width="10" height="10" fill="#38bdf8"/>
      <rect x="100" y="38" width="10" height="10" fill="#0284c7"/>
      <rect x="80" y="48" width="10" height="10" fill="#f59e0b"/>
      <rect x="90" y="48" width="10" height="10" fill="#f59e0b"/>
      <rect x="70" y="58" width="10" height="10" fill="#10b981"/>
      <rect x="100" y="58" width="10" height="10" fill="#10b981"/>
      <rect x="80" y="68" width="10" height="10" fill="#6366f1"/>
      <rect x="90" y="68" width="10" height="10" fill="#6366f1"/>
    </svg>`;
  }

  if (s <= 64) {
    return `<svg viewBox="0 0 180 110" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="15" y="10" width="150" height="90" rx="8" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5"/>
      <rect x="50" y="15" width="80" height="80" rx="4" fill="#ffffff" stroke="#e2e8f0" stroke-width="1"/>
      <path d="M50 35 H130 M50 55 H130 M50 75 H130" stroke="#f1f5f9" stroke-width="1"/>
      <path d="M70 15 V95 M90 15 V95 M110 15 V95" stroke="#f1f5f9" stroke-width="1"/>
      <circle cx="90" cy="55" r="18" fill="#ec4899"/>
      <rect x="76" y="46" width="8" height="8" fill="#fbcfe8"/>
      <rect x="96" y="46" width="8" height="8" fill="#fbcfe8"/>
      <rect x="86" y="60" width="8" height="4" fill="#be185d"/>
    </svg>`;
  }

  if (s <= 128) {
    return `<svg viewBox="0 0 180 110" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="15" y="10" width="150" height="90" rx="8" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5"/>
      <rect x="46" y="12" width="88" height="86" rx="6" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1"/>
      <circle cx="70" cy="32" r="8" fill="#f59e0b"/>
      <polygon points="56,76 75,50 95,66 115,44 124,76" fill="#10b981" fill-opacity="0.25" stroke="#059669" stroke-width="1.5" stroke-linejoin="round"/>
    </svg>`;
  }

  if (s <= 256) {
    return `<svg viewBox="0 0 180 110" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="15" y="10" width="150" height="90" rx="8" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5"/>
      <rect x="42" y="10" width="96" height="90" rx="6" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1"/>
      <rect x="48" y="16" width="84" height="52" rx="4" fill="#ffffff" stroke="#e2e8f0" stroke-width="1"/>
      <circle cx="68" cy="34" r="8" fill="#a855f7" fill-opacity="0.4"/>
      <polygon points="52,60 74,40 92,54 116,36 124,60" fill="#06b6d4" fill-opacity="0.35" stroke="#0284c7" stroke-width="1.2" stroke-linejoin="round"/>
      <rect x="48" y="74" width="84" height="18" rx="3" fill="#ffffff" stroke="#e2e8f0" stroke-width="1"/>
      <circle cx="60" cy="83" r="3" fill="#f43f5e"/>
      <circle cx="72" cy="83" r="3" fill="#3b82f6"/>
      <circle cx="84" cy="83" r="3" fill="#10b981"/>
    </svg>`;
  }

  return `<svg viewBox="0 0 180 110" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="15" y="10" width="150" height="90" rx="8" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5"/>
    <rect x="38" y="8" width="104" height="94" rx="6" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1"/>
    <rect x="46" y="16" width="88" height="62" rx="4" fill="#ffffff" stroke="#e2e8f0" stroke-width="1"/>
    <path d="M52 65 Q70 30 90 55 T126 45" stroke="#f59e0b" stroke-width="2.5" fill="none"/>
    <circle cx="118" cy="30" r="7" fill="#6366f1"/>
    <rect x="46" y="84" width="88" height="10" rx="2" fill="#ffffff" stroke="#e2e8f0" stroke-width="1"/>
  </svg>`;
}

export function getTemplateVariantSvg(w: number, h: number, imgPath?: string | null): string {
  if (imgPath) {
    return `<img src="${imgPath}" alt="${w}x${h}" style="width: 100%; height: 100%; object-fit: contain; border-radius: 8px;" />`;
  }
  return `<svg viewBox="0 0 180 110" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="35" y="15" width="110" height="80" rx="6" fill="#6366f1" fill-opacity="0.08" stroke="#6366f1" stroke-width="1.5"/>
    <rect x="50" y="28" width="80" height="40" rx="4" fill="#6366f1" fill-opacity="0.15"/>
    <text x="90" y="82" font-size="11" font-weight="600" fill="#6366f1" text-anchor="middle" font-family="sans-serif">${w} × ${h} px</text>
  </svg>`;
}

export function getPresentationSvg(format: string): string {
  switch (format) {
    case '16_9':
      return `<svg viewBox="0 0 180 110" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="14" y="15" width="152" height="80" rx="6" fill="#ffffff" stroke="#6366f1" stroke-width="1.5"/>
        <rect x="24" y="25" width="36" height="5" rx="2.5" fill="#6366f1"/>
        <rect x="24" y="35" width="70" height="7" rx="3.5" fill="var(--text-primary, #1e293b)"/>
        <rect x="24" y="47" width="50" height="4" rx="2" fill="#94a3b8"/>
        <rect x="24" y="58" width="60" height="26" rx="4" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1"/>
        <rect x="30" y="64" width="40" height="3" rx="1.5" fill="#6366f1"/>
        <rect x="30" y="71" width="48" height="2.5" rx="1.25" fill="#cbd5e1"/>
        <rect x="30" y="76" width="35" height="2.5" rx="1.25" fill="#cbd5e1"/>
        <rect x="92" y="58" width="64" height="26" rx="4" fill="#eef2ff" stroke="#c7d2fe" stroke-width="1"/>
        <circle cx="106" cy="71" r="6" fill="#6366f1" fill-opacity="0.3"/>
        <rect x="118" y="66" width="30" height="3" rx="1.5" fill="#4338ca"/>
        <rect x="118" y="73" width="24" height="2.5" rx="1.25" fill="#818cf8"/>
      </svg>`;
    case 'fhd':
      return `<svg viewBox="0 0 180 110" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="14" y="15" width="152" height="80" rx="6" fill="#0f172a" stroke="#38bdf8" stroke-width="1.5"/>
        <rect x="24" y="24" width="30" height="4" rx="2" fill="#38bdf8"/>
        <rect x="24" y="32" width="75" height="8" rx="4" fill="#f8fafc"/>
        <rect x="24" y="44" width="55" height="3.5" rx="1.75" fill="#94a3b8"/>
        <rect x="24" y="54" width="38" height="30" rx="3" fill="#1e293b" stroke="#334155" stroke-width="0.75"/>
        <rect x="28" y="59" width="20" height="3" rx="1.5" fill="#38bdf8"/>
        <rect x="28" y="66" width="30" height="2" rx="1" fill="#64748b"/>
        <rect x="68" y="54" width="38" height="30" rx="3" fill="#1e293b" stroke="#334155" stroke-width="0.75"/>
        <rect x="72" y="59" width="22" height="3" rx="1.5" fill="#818cf8"/>
        <rect x="72" y="66" width="30" height="2" rx="1" fill="#64748b"/>
        <rect x="112" y="54" width="44" height="30" rx="3" fill="#1e293b" stroke="#334155" stroke-width="0.75"/>
        <circle cx="134" cy="69" r="7" fill="#f43f5e" fill-opacity="0.3" stroke="#f43f5e" stroke-width="1"/>
      </svg>`;
    case '4_3':
      return `<svg viewBox="0 0 180 110" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="36" y="10" width="108" height="90" rx="6" fill="#ffffff" stroke="#f59e0b" stroke-width="1.5"/>
        <rect x="48" y="20" width="36" height="5" rx="2.5" fill="#f59e0b"/>
        <rect x="48" y="30" width="60" height="7" rx="3.5" fill="var(--text-primary, #1e293b)"/>
        <rect x="48" y="42" width="45" height="4" rx="2" fill="#94a3b8"/>
        <rect x="48" y="52" width="84" height="38" rx="4" fill="#fffbeb" stroke="#fde68a" stroke-width="1"/>
        <rect x="56" y="60" width="35" height="3.5" rx="1.75" fill="#b45309"/>
        <rect x="56" y="68" width="68" height="2.5" rx="1.25" fill="#d97706"/>
        <rect x="56" y="74" width="55" height="2.5" rx="1.25" fill="#d97706"/>
      </svg>`;
    case 'mobile':
      return `<svg viewBox="0 0 180 110" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="62" y="6" width="56" height="98" rx="7" fill="#ffffff" stroke="#ec4899" stroke-width="1.5"/>
        <rect x="70" y="14" width="22" height="4" rx="2" fill="#ec4899"/>
        <rect x="70" y="22" width="40" height="6" rx="3" fill="var(--text-primary, #1e293b)"/>
        <rect x="70" y="32" width="30" height="3" rx="1.5" fill="#94a3b8"/>
        <rect x="70" y="40" width="40" height="32" rx="4" fill="#fdf2f8" stroke="#fbcfe8" stroke-width="1"/>
        <circle cx="90" cy="56" r="8" fill="#ec4899" fill-opacity="0.3"/>
        <rect x="70" y="78" width="40" height="18" rx="3" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1"/>
        <rect x="74" y="83" width="32" height="2.5" rx="1.25" fill="#cbd5e1"/>
        <rect x="74" y="88" width="24" height="2.5" rx="1.25" fill="#cbd5e1"/>
      </svg>`;
    default:
      return `<svg viewBox="0 0 180 110" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="14" y="15" width="152" height="80" rx="6" fill="#ffffff" stroke="#6366f1" stroke-width="1.5"/>
        <rect x="24" y="25" width="36" height="5" rx="2.5" fill="#6366f1"/>
        <rect x="24" y="35" width="70" height="7" rx="3.5" fill="var(--text-primary, #1e293b)"/>
        <rect x="24" y="47" width="50" height="4" rx="2" fill="#94a3b8"/>
      </svg>`;
  }
}

export function getSocialSvg(format: string): string {
  switch (format) {
    case 'facebook_post':
      return `<svg viewBox="0 0 180 110" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="36" y="8" width="108" height="94" rx="6" fill="#ffffff" stroke="#1877f2" stroke-width="1.5"/>
        <circle cx="50" cy="22" r="6" fill="#1877f2"/>
        <rect x="62" y="18" width="45" height="4" rx="2" fill="var(--text-primary, #1e293b)"/>
        <rect x="62" y="24" width="28" height="3" rx="1.5" fill="#94a3b8"/>
        <rect x="44" y="34" width="92" height="48" rx="4" fill="#eff6ff" stroke="#bfdbfe" stroke-width="0.75"/>
        <circle cx="90" cy="54" r="10" fill="#1877f2" fill-opacity="0.25"/>
        <path d="M86 54 L90 58 L96 50" stroke="#1877f2" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        <line x1="44" y1="88" x2="136" y2="88" stroke="#e2e8f0" stroke-width="1"/>
        <circle cx="54" cy="94" r="3" fill="#1877f2"/>
        <circle cx="68" cy="94" r="3" fill="#64748b"/>
        <circle cx="82" cy="94" r="3" fill="#64748b"/>
      </svg>`;
    case 'facebook_cover':
      return `<svg viewBox="0 0 180 110" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="15" y="32" width="150" height="56" rx="6" fill="#ffffff" stroke="#1877f2" stroke-width="1.5"/>
        <rect x="16" y="33" width="148" height="54" rx="5" fill="#f0f7ff"/>
        <circle cx="42" cy="60" r="14" fill="#ffffff" stroke="#1877f2" stroke-width="1.5"/>
        <circle cx="42" cy="60" r="8" fill="#1877f2" fill-opacity="0.3"/>
        <rect x="64" y="52" width="55" height="6" rx="3" fill="var(--text-primary, #1e293b)"/>
        <rect x="64" y="62" width="38" height="4" rx="2" fill="#94a3b8"/>
        <rect x="126" y="54" width="28" height="12" rx="3" fill="#1877f2"/>
      </svg>`;
    default:
      return `<svg viewBox="0 0 180 110" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="36" y="10" width="108" height="90" rx="6" fill="#ffffff" stroke="#1877f2" stroke-width="1.5"/>
        <circle cx="50" cy="24" r="6" fill="#1877f2"/>
        <rect x="62" y="20" width="50" height="4" rx="2" fill="var(--text-primary, #1e293b)"/>
        <rect x="44" y="36" width="92" height="48" rx="4" fill="#eff6ff" stroke="#bfdbfe" stroke-width="0.75"/>
      </svg>`;
  }
}

export function getSheetSvg(): string {
  return `<svg viewBox="0 0 180 110" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="15" y="10" width="150" height="90" rx="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5"/>
    <rect x="16" y="11" width="148" height="16" rx="5" fill="#f8fafc"/>
    <rect x="22" y="15" width="18" height="8" rx="2" fill="#e2e8f0"/>
    <text x="46" y="22" font-family="sans-serif" font-size="7" font-weight="bold" font-style="italic" fill="#7c3aed">f(x)</text>
    <rect x="60" y="15" width="98" height="8" rx="2" fill="#ffffff" stroke="#e2e8f0" stroke-width="0.75"/>
    <rect x="16" y="27" width="148" height="12" fill="#f1f5f9"/>
    <rect x="16" y="27" width="20" height="72" fill="#f8fafc"/>
    <line x1="16" y1="27" x2="164" y2="27" stroke="#cbd5e1" stroke-width="1"/>
    <line x1="16" y1="39" x2="164" y2="39" stroke="#cbd5e1" stroke-width="1"/>
    <line x1="16" y1="54" x2="164" y2="54" stroke="#e2e8f0" stroke-width="0.75"/>
    <line x1="16" y1="69" x2="164" y2="69" stroke="#e2e8f0" stroke-width="0.75"/>
    <line x1="16" y1="84" x2="164" y2="84" stroke="#e2e8f0" stroke-width="0.75"/>
    <line x1="36" y1="27" x2="36" y2="99" stroke="#cbd5e1" stroke-width="1"/>
    <line x1="68" y1="27" x2="68" y2="99" stroke="#e2e8f0" stroke-width="0.75"/>
    <line x1="100" y1="27" x2="100" y2="99" stroke="#e2e8f0" stroke-width="0.75"/>
    <line x1="132" y1="27" x2="132" y2="99" stroke="#e2e8f0" stroke-width="0.75"/>
    <rect x="36" y="27" width="32" height="12" fill="#ede9fe"/>
    <rect x="16" y="39" width="20" height="15" fill="#ede9fe"/>
    <rect x="36" y="39" width="32" height="15" fill="#faf5ff" stroke="#7c3aed" stroke-width="1.5"/>
    <rect x="66" y="52" width="3" height="3" fill="#7c3aed"/>
    <rect x="74" y="44" width="18" height="4" rx="2" fill="#cbd5e1"/>
    <rect x="106" y="44" width="20" height="4" rx="2" fill="#cbd5e1"/>
    <rect x="42" y="60" width="20" height="4" rx="2" fill="#cbd5e1"/>
    <rect x="74" y="60" width="15" height="4" rx="2" fill="#cbd5e1"/>
    <rect x="106" y="60" width="22" height="4" rx="2" fill="#cbd5e1"/>
    <rect x="42" y="74" width="18" height="4" rx="2" fill="#7c3aed" fill-opacity="0.3"/>
  </svg>`;
}

export interface CanvasIconDef {
  fill: string;
  viewBox: string;
  whiteGlyph: string;
  coloredGlyph: string;
}

export const CANVAS_ICONS: Record<string, CanvasIconDef> = {
  board: {
    coloredGlyph: '<path fill="#00C48C" d="M4.288 6.285C3 7.92 3 10.313 3 15.1v1.8c0 4.787 0 7.18 1.288 8.815a6 6 0 0 0 .997.997C6.92 28 9.313 28 14.1 28h3.8c4.787 0 7.18 0 8.815-1.288.37-.292.705-.627.997-.997C29 24.08 29 21.687 29 16.9v-1.8c0-4.787 0-7.18-1.288-8.815a6 6 0 0 0-.997-.997C25.08 4 22.687 4 17.9 4h-3.8C9.313 4 6.92 4 5.285 5.288a6 6 0 0 0-.997.997Z"/><path fill="#ffffff" d="M21.996 13.437c.006.829.676 1.5 1.504 1.5a1.49 1.49 0 0 0 1.495-1.5c-.024-2.14-.156-3.84-.874-4.558s-2.44-.85-4.59-.874a1.49 1.49 0 0 0-1.5 1.495c0 .828.672 1.498 1.5 1.504a49.94 49.94 0 0 1 1.878.04c.143.031.29.083.377.17.087.088.139.235.17.378.023.468.035 1.133.04 1.845ZM10.004 18.5A1.507 1.507 0 0 0 8.5 17a1.49 1.49 0 0 0-1.495 1.5c.024 2.158.155 3.903.874 4.621.717.718 2.418.85 4.558.874a1.49 1.49 0 0 0 1.5-1.495c0-.828-.671-1.498-1.5-1.504a46.623 46.623 0 0 1-1.845-.04c-.143-.031-.29-.083-.378-.17-.087-.087-.138-.233-.17-.376a49.106 49.106 0 0 1-.04-1.91Z"/>',
    fill: '#00C48C',
    viewBox: '0 0 32 32',
    whiteGlyph: '<path fill="#ffffff" d="M4.288 6.285C3 7.92 3 10.313 3 15.1v1.8c0 4.787 0 7.18 1.288 8.815a6 6 0 0 0 .997.997C6.92 28 9.313 28 14.1 28h3.8c4.787 0 7.18 0 8.815-1.288.37-.292.705-.627.997-.997C29 24.08 29 21.687 29 16.9v-1.8c0-4.787 0-7.18-1.288-8.815a6 6 0 0 0-.997-.997C25.08 4 22.687 4 17.9 4h-3.8C9.313 4 6.92 4 5.285 5.288a6 6 0 0 0-.997.997Z"/>',
  },
  sheet: {
    coloredGlyph: '<path fill="#138EFF" d="M3 15.1c0-4.787 0-7.18 1.288-8.815a6 6 0 0 1 .997-.997C6.92 4 9.313 4 14.1 4h3.8c4.787 0 7.18 0 8.815 1.288a6 6 0 0 1 .997.997C29 7.92 29 10.313 29 15.1v1.8c0 4.787 0 7.18-1.288 8.815-.292.37-.627.705-.997.997C25.08 28 22.687 28 17.9 28h-3.8c-4.787 0-7.18 0-8.815-1.288a6 6 0 0 1-.997-.997C3 24.08 3 21.687 3 16.9v-1.8Z"/><path fill="#ffffff" d="M7.004 12.333c.018-1.609.116-2.525.64-3.19a3 3 0 0 1 .499-.499C8.895 8.051 9.968 8.004 12 8v4.333H7.004ZM7 13.833v4.334h5v-4.334H7Zm.004 5.834c.018 1.609.116 2.525.64 3.19.146.186.313.353.499.499.752.593 1.825.64 3.857.644v-4.333H7.004ZM13.5 24h5.95c2.393 0 3.59 0 4.407-.644.186-.146.353-.314.499-.499.524-.665.622-1.581.64-3.19H13.5V24ZM25 18.167v-4.334H13.5v4.334H25Zm-.004-5.834c-.018-1.609-.116-2.525-.64-3.19a3 3 0 0 0-.499-.499C23.105 8.051 22.032 8.004 20 8v4.333h4.996ZM18.5 8h-5v4.333h5V8Z"/>',
    fill: '#138EFF',
    viewBox: '0 0 32 32',
    whiteGlyph: '<path fill="#ffffff" d="M3 15.1c0-4.787 0-7.18 1.288-8.815a6 6 0 0 1 .997-.997C6.92 4 9.313 4 14.1 4h3.8c4.787 0 7.18 0 8.815 1.288a6 6 0 0 1 .997.997C29 7.92 29 10.313 29 15.1v1.8c0 4.787 0 7.18-1.288 8.815-.292.37-.627.705-.997.997C25.08 28 22.687 28 17.9 28h-3.8c-4.787 0-7.18 0-8.815-1.288a6 6 0 0 1-.997-.997C3 24.08 3 21.687 3 16.9v-1.8Z"/>',
  },
  presentation: {
    coloredGlyph: '<path fill="#FF6105" d="M29 13c0 3.738 0 5.608-.804 7A6.002 6.002 0 0 1 26 22.196c-1.21.699-2.78.79-5.623.802l3.192 5.233a.5.5 0 0 1-.426.76L19.507 29a.5.5 0 0 1-.433-.247l-2.643-4.512a.5.5 0 0 0-.862 0l-2.644 4.512a.5.5 0 0 1-.432.247l-3.608-.008a.5.5 0 0 1-.426-.759l3.17-5.234c-2.847-.012-4.418-.103-5.629-.802A6 6 0 0 1 3.804 20C3 18.608 3 16.738 3 13s0-5.608.804-7A6 6 0 0 1 6 3.804C7.392 3 9.262 3 13 3h6c3.738 0 5.608 0 7 .804A6.001 6.001 0 0 1 28.196 6C29 7.392 29 9.262 29 13Z"/><path fill="#ffffff" d="M22.508 11.516a5 5 0 0 0-5-5v5h5ZM16 8h-.031a5 5 0 1 0 5 5H16V8Z"/>',
    fill: '#FF6105',
    viewBox: '0 0 32 32',
    whiteGlyph: '<path fill="#ffffff" d="M29 13c0 3.738 0 5.608-.804 7A6.002 6.002 0 0 1 26 22.196c-1.21.699-2.78.79-5.623.802l3.192 5.233a.5.5 0 0 1-.426.76L19.507 29a.5.5 0 0 1-.433-.247l-2.643-4.512a.5.5 0 0 0-.862 0l-2.644 4.512a.5.5 0 0 1-.432.247l-3.608-.008a.5.5 0 0 1-.426-.759l3.17-5.234c-2.847-.012-4.418-.103-5.629-.802A6 6 0 0 1 3.804 20C3 18.608 3 16.738 3 13s0-5.608.804-7A6 6 0 0 1 6 3.804C7.392 3 9.262 3 13 3h6c3.738 0 5.608 0 7 .804A6.001 6.001 0 0 1 28.196 6C29 7.392 29 9.262 29 13Z"/>',
  },
  social: {
    coloredGlyph: '<path fill="#FF3B4B" d="M29 13.752c0 4.213 0 6.32-1.011 7.833a6 6 0 0 1-1.656 1.656c-1.351.903-3.176 1-6.552 1.01l-2.055 3.508c-.773 1.319-2.68 1.319-3.452 0L12.22 24.25c-3.376-.01-5.2-.107-6.552-1.01a6.001 6.001 0 0 1-1.656-1.656C3 20.072 3 17.965 3 13.752s0-6.32 1.011-7.833a6 6 0 0 1 1.656-1.656C7.18 3.252 9.287 3.252 13.5 3.252h5c4.213 0 6.32 0 7.833 1.011.656.438 1.218 1 1.656 1.656C29 7.432 29 9.539 29 13.752Z"/><path fill="#ffffff" d="M21.702 14.459c.207-.31.38-.655.483-1 .07-.276.138-.586.104-.897a3.311 3.311 0 0 0-3.31-3.31c-1.311 0-2.45.793-2.966 1.896h-.035a3.298 3.298 0 0 0-2.965-1.896c-.897 0-1.69.345-2.276.931a3.487 3.487 0 0 0-.966 1.828c-.034.172-.069.344-.069.551 0 .31.07.621.173.931.103.38.276.724.517 1.035l.035.034v.035c.068.103.172.241.31.414.62.827 1.965 2.31 4.586 4.24h1.414c3.38-2.482 4.655-4.24 4.965-4.792Z"/>',
    fill: '#FF3B4B',
    viewBox: '0 0 32 32',
    whiteGlyph: '<path fill="#ffffff" d="M29 13.752c0 4.213 0 6.32-1.011 7.833a6 6 0 0 1-1.656 1.656c-1.351.903-3.176 1-6.552 1.01l-2.055 3.508c-.773 1.319-2.68 1.319-3.452 0L12.22 24.25c-3.376-.01-5.2-.107-6.552-1.01a6.001 6.001 0 0 1-1.656-1.656C3 20.072 3 17.965 3 13.752s0-6.32 1.011-7.833a6 6 0 0 1 1.656-1.656C7.18 3.252 9.287 3.252 13.5 3.252h5c4.213 0 6.32 0 7.833 1.011.656.438 1.218 1 1.656 1.656C29 7.432 29 9.539 29 13.752Z"/>',
  },
  doc: {
    coloredGlyph: '<path fill="#13A3B5" d="M16 3c4.691 0 7.037 0 8.653 1.24a6 6 0 0 1 1.107 1.107C27 6.963 27 9.31 27 14v4c0 4.691 0 7.037-1.24 8.653-.32.416-.691.788-1.107 1.107C23.037 29 20.69 29 16 29c-4.691 0-7.037 0-8.653-1.24a6 6 0 0 1-1.107-1.107C5 25.037 5 22.69 5 18v-4c0-4.691 0-7.037 1.24-8.653A6 6 0 0 1 7.347 4.24C8.963 3 11.31 3 16 3Z"/><path fill="#ffffff" d="M21.63 25H10.465c-1.307 0-1.793-1.274-1.12-2.316l1.493-2.355c.635-1.042 2.277-1.042 2.912 0l.71 1.12 2.315-3.667c.634-1.043 2.277-1.043 2.912 0l3.062 4.902c.672 1.042.149 2.316-1.12 2.316ZM23 8.5A1.5 1.5 0 0 0 21.5 7h-11a1.5 1.5 0 1 0 0 3h11A1.5 1.5 0 0 0 23 8.5Zm-1.5 3a1.5 1.5 0 0 1 0 3h-11a1.5 1.5 0 0 1 0-3h11Zm-9.5 6a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0Z"/>',
    fill: '#13A3B5',
    viewBox: '0 0 32 32',
    whiteGlyph: '<path fill="#ffffff" d="M16 3c4.691 0 7.037 0 8.653 1.24a6 6 0 0 1 1.107 1.107C27 6.963 27 9.31 27 14v4c0 4.691 0 7.037-1.24 8.653-.32.416-.691.788-1.107 1.107C23.037 29 20.69 29 16 29c-4.691 0-7.037 0-8.653-1.24a6 6 0 0 1-1.107-1.107C5 25.037 5 22.69 5 18v-4c0-4.691 0-7.037 1.24-8.653A6 6 0 0 1 7.347 4.24C8.963 3 11.31 3 16 3Z"/>',
  },
  template: {
    coloredGlyph: '<path fill="#7C3AED" d="M4 8a4 4 0 0 1 4-4h16a4 4 0 0 1 4 4v16a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8Z"/><path fill="#ffffff" d="M8 6.5a1.5 1.5 0 0 0-1.5 1.5v4.5a1.5 1.5 0 0 0 1.5 1.5h16a1.5 1.5 0 0 0 1.5-1.5V8a1.5 1.5 0 0 0-1.5-1.5H8Zm0 10a1.5 1.5 0 0 0-1.5 1.5v4.5a1.5 1.5 0 0 0 1.5 1.5h6a1.5 1.5 0 0 0 1.5-1.5V18a1.5 1.5 0 0 0-1.5-1.5H8Zm10 0a1.5 1.5 0 0 0-1.5 1.5v4.5a1.5 1.5 0 0 0 1.5 1.5h6a1.5 1.5 0 0 0 1.5-1.5V18a1.5 1.5 0 0 0-1.5-1.5h-6Z"/>',
    fill: '#7C3AED',
    viewBox: '0 0 32 32',
    whiteGlyph: '<path fill="#ffffff" d="M4 8a4 4 0 0 1 4-4h16a4 4 0 0 1 4 4v16a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8Z"/>',
  },
  photos: {
    coloredGlyph: '<path fill="#A855F7" d="M4 8a4 4 0 0 1 4-4h16a4 4 0 0 1 4 4v16a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8Z"/><path fill="#ffffff" d="M8 6.5a1.5 1.5 0 0 0-1.5 1.5v16a1.5 1.5 0 0 0 1.5 1.5h16a1.5 1.5 0 0 0 1.5-1.5V8a1.5 1.5 0 0 0-1.5-1.5H8Zm3 4a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Zm-2.7 13.2 5.2-6.5a1.5 1.5 0 0 1 2.34 0l2.36 2.95 2.8-3.73a1.5 1.5 0 0 1 2.4 0l4.3 5.74a1.2 1.2 0 0 1-.96 1.94H9.26a1.2 1.2 0 0 1-.96-1.9Z"/>',
    fill: '#A855F7',
    viewBox: '0 0 32 32',
    whiteGlyph: '<path fill="#ffffff" d="M4 8a4 4 0 0 1 4-4h16a4 4 0 0 1 4 4v16a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8Z"/>',
  },
  'custom-size': {
    coloredGlyph: '<path fill="#8B5CF6" d="M5 9a4 4 0 0 1 4-4h14a4 4 0 0 1 4 4v14a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V9Z"/><path fill="#ffffff" d="M9 7.5a1.5 1.5 0 0 0-1.5 1.5v3.5a1 1 0 1 0 2 0v-2h2a1 1 0 1 0 0-2H9Zm14 0h-2a1 1 0 1 0 0 2h2v2a1 1 0 1 0 2 0V9a1.5 1.5 0 0 0-1.5-1.5ZM7.5 23a1.5 1.5 0 0 0 1.5 1.5h2a1 1 0 1 0 0-2H9v-2a1 1 0 1 0-2 0V23Zm17 0v-2a1 1 0 1 0-2 0v2h-2a1 1 0 1 0 0 2h2a1.5 1.5 0 0 0 1.5-1.5Z"/>',
    fill: '#8B5CF6',
    viewBox: '0 0 32 32',
    whiteGlyph: '<path fill="#ffffff" d="M5 9a4 4 0 0 1 4-4h14a4 4 0 0 1 4 4v14a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V9Z"/>',
  },
  upload: {
    coloredGlyph: '<g transform="translate(4, 4)"><path fill="#0EA5E9" d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/><path fill="#ffffff" d="M14 13v4h-4v-4H7l5-5 5 5h-3z"/></g>',
    fill: '#0EA5E9',
    viewBox: '0 0 32 32',
    whiteGlyph: '<g transform="translate(4, 4)"><path fill="#ffffff" d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/></g>',
  },
  video: {
    coloredGlyph: '<path fill="#E11D48" d="M25.874 18.503c-.033 3.118-.218 4.89-1.232 6.174a5.771 5.771 0 0 1-.96.959c-1.572 1.239-3.876 1.239-8.484 1.239h-.53c-4.607 0-6.91 0-8.483-1.239a5.772 5.772 0 0 1-.96-.959c-1.24-1.571-1.24-3.872-1.24-8.475v-.53c0-4.602 0-6.903 1.24-8.475.281-.356.603-.678.96-.958C7.758 5 10.061 5 14.67 5h.53c4.607 0 6.91 0 8.483 1.239.357.28.679.602.96.958 1.014 1.285 1.199 3.057 1.232 6.175l3.612-2.114a.962.962 0 0 1 1.449.83v7.698a.962.962 0 0 1-1.449.83l-3.612-2.113Z"/><path fill="#ffffff" d="M12.89 20.693l5.482-3.167c1.498-.851 1.498-2.213.034-3.064l-5.516-3.167c-1.464-.85-2.69-.136-2.69 1.566v6.265c0 1.703 1.192 2.418 2.69 1.567Z"/>',
    fill: '#E11D48',
    viewBox: '0 0 32 32',
    whiteGlyph: '<path fill="#ffffff" d="M25.874 18.503c-.033 3.118-.218 4.89-1.232 6.174a5.771 5.771 0 0 1-.96.959c-1.572 1.239-3.876 1.239-8.484 1.239h-.53c-4.607 0-6.91 0-8.483-1.239a5.772 5.772 0 0 1-.96-.959c-1.24-1.571-1.24-3.872-1.24-8.475v-.53c0-4.602 0-6.903 1.24-8.475.281-.356.603-.678.96-.958C7.758 5 10.061 5 14.67 5h.53c4.607 0 6.91 0 8.483 1.239.357.28.679.602.96.958 1.014 1.285 1.199 3.057 1.232 6.175l3.612-2.114a.962.962 0 0 1 1.449.83v7.698a.962.962 0 0 1-1.449.83l-3.612-2.113Z"/>',
  },
  more: {
    coloredGlyph: '<circle cx="7" cy="16" r="2.5" fill="currentColor"/><circle cx="16" cy="16" r="2.5" fill="currentColor"/><circle cx="25" cy="16" r="2.5" fill="currentColor"/>',
    fill: 'currentColor',
    viewBox: '0 0 32 32',
    whiteGlyph: '<circle cx="7" cy="16" r="2.5" fill="currentColor"/><circle cx="16" cy="16" r="2.5" fill="currentColor"/><circle cx="25" cy="16" r="2.5" fill="currentColor"/>',
  },
};

export function getVideoSvg(format = '16_9'): string {
  if (format === '9_16') {
    return `<svg viewBox="0 0 180 110" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="62" y="8" width="56" height="94" rx="6" fill="#1e1b4b" stroke="#4338ca" stroke-width="1.5"/>
      <rect x="68" y="16" width="44" height="60" rx="3" fill="#312e81"/>
      <polygon points="86,38 86,54 100,46" fill="#f43f5e"/>
      <rect x="68" y="82" width="28" height="4" rx="2" fill="#e2e8f0"/>
      <circle cx="106" cy="84" r="3" fill="#f43f5e"/>
    </svg>`;
  }
  if (format === '1_1') {
    return `<svg viewBox="0 0 180 110" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="48" y="13" width="84" height="84" rx="6" fill="#1e1b4b" stroke="#4338ca" stroke-width="1.5"/>
      <rect x="56" y="21" width="68" height="52" rx="3" fill="#312e81"/>
      <polygon points="86,39 86,55 100,47" fill="#f43f5e"/>
      <rect x="56" y="81" width="40" height="4" rx="2" fill="#e2e8f0"/>
      <circle cx="114" cy="83" r="3" fill="#f43f5e"/>
    </svg>`;
  }
  return `<svg viewBox="0 0 180 110" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="20" y="16" width="140" height="78" rx="6" fill="#1e1b4b" stroke="#4338ca" stroke-width="1.5"/>
    <rect x="28" y="24" width="124" height="48" rx="3" fill="#312e81"/>
    <polygon points="85,38 85,58 103,48" fill="#f43f5e"/>
    <rect x="28" y="78" width="50" height="4" rx="2" fill="#e2e8f0"/>
    <circle cx="144" cy="80" r="3" fill="#f43f5e"/>
  </svg>`;
}

export function resolveCanvasIconDef(typeOrCategory?: string, unit?: string): CanvasIconDef {
  const normalized = (typeOrCategory || unit || 'board').toLowerCase().trim();
  if (normalized === 'templates' || normalized === 'template') return CANVAS_ICONS.template;
  if (normalized === 'custom' || normalized === 'custom-size' || normalized === 'custom_size') return CANVAS_ICONS['custom-size'];
  if (normalized === 'photos' || normalized === 'photo') return CANVAS_ICONS.photos;
  if (normalized === 'upload' || normalized === 'uploads') return CANVAS_ICONS.upload;
  if (normalized === 'presentation' || normalized === 'presentations') return CANVAS_ICONS.presentation;
  if (normalized === 'doc' || normalized === 'docs' || normalized === 'document') return CANVAS_ICONS.doc;
  if (normalized === 'sheet' || normalized === 'sheets' || normalized === 'spreadsheet') return CANVAS_ICONS.sheet;
  if (normalized === 'social' || normalized === 'socials') return CANVAS_ICONS.social;
  if (normalized === 'video' || normalized === 'videos') return CANVAS_ICONS.video;
  if (normalized === 'more') return CANVAS_ICONS.more;
  return CANVAS_ICONS.board;
}

export function getCategoryBadgeIconSvg(category: string, className = 'component-badge__icon'): string {
  const def = resolveCanvasIconDef(category);
  return `<svg class="${className}" viewBox="${def.viewBox}" aria-hidden="true">${def.coloredGlyph}</svg>`;
}

export function getCategoryMenuSvg(category: string, className = 'menu-item__icon menu-item__icon--colored'): string {
  const def = resolveCanvasIconDef(category);
  return `<svg class="${className}" viewBox="${def.viewBox}" aria-hidden="true">${def.coloredGlyph}</svg>`;
}

export function getCanvasTypeIconSvg(canvasType?: string, unit?: string, className = 'canvas-card__meta-icon canvas-card__meta-icon--colored'): string {
  const def = resolveCanvasIconDef(canvasType, unit);
  return `<svg class="${className}" viewBox="${def.viewBox}" aria-hidden="true">${def.coloredGlyph}</svg>`;
}



