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
    coloredGlyph: '<defs><linearGradient id="g-pizarron-infinito" x1="16" y1="2" x2="16" y2="30" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#29CD9E"/><stop offset="1" stop-color="#00C48C"/></linearGradient></defs><rect x="2" y="2" width="28" height="28" rx="8.5" fill="url(#g-pizarron-infinito)"/><path d="M18 8.5h3a2.5 2.5 0 0 1 2.5 2.5v3M14 23.5h-3A2.5 2.5 0 0 1 8.5 21v-3" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><rect x="12.75" y="12.75" width="6.5" height="6.5" rx="1.75" fill="#FFFFFF"/>',
    fill: '#00C48C',
    viewBox: '0 0 32 32',
    whiteGlyph: '<rect x="2" y="2" width="28" height="28" rx="8.5" fill="#ffffff"/>',
  },
  sheet: {
    coloredGlyph: '<defs><linearGradient id="g-hoja-de-calculo" x1="16" y1="2" x2="16" y2="30" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#39A0FF"/><stop offset="1" stop-color="#138EFF"/></linearGradient><clipPath id="cp-hoja"><rect x="7.9" y="7.9" width="16.2" height="16.2" rx="3.1"/></clipPath></defs><rect x="2" y="2" width="28" height="28" rx="8.5" fill="url(#g-hoja-de-calculo)"/><g clip-path="url(#cp-hoja)"><rect x="7" y="7" width="18" height="6.5" fill="#FFFFFF" fill-opacity=".38"/><path d="M7 13.5h18M7 19h18M13.5 7v18" stroke="#FFFFFF" stroke-width="1.8"/></g><rect x="7.9" y="7.9" width="16.2" height="16.2" rx="3.1" stroke="#FFFFFF" stroke-width="1.8"/>',
    fill: '#138EFF',
    viewBox: '0 0 32 32',
    whiteGlyph: '<rect x="2" y="2" width="28" height="28" rx="8.5" fill="#ffffff"/>',
  },
  presentation: {
    coloredGlyph: '<defs><linearGradient id="g-presentacion" x1="16" y1="2" x2="16" y2="30" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#FF7A2D"/><stop offset="1" stop-color="#FF6105"/></linearGradient></defs><rect x="2" y="2" width="28" height="28" rx="8.5" fill="url(#g-presentacion)"/><rect x="7" y="7" width="18" height="13" rx="3" fill="#FFFFFF"/><circle cx="16" cy="13.5" r="3.6" stroke="#FF6105" stroke-width="1.6"/><path d="M16 13.5V9.9A3.6 3.6 0 0 1 19.6 13.5Z" fill="#FF6105"/><path d="M16 20v3.5M12.5 24.5h7" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round"/>',
    fill: '#FF6105',
    viewBox: '0 0 32 32',
    whiteGlyph: '<rect x="2" y="2" width="28" height="28" rx="8.5" fill="#ffffff"/>',
  },
  social: {
    coloredGlyph: '<defs><linearGradient id="g-redes-sociales" x1="16" y1="2" x2="16" y2="30" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#FF5A68"/><stop offset="1" stop-color="#FF3B4B"/></linearGradient></defs><rect x="2" y="2" width="28" height="28" rx="8.5" fill="url(#g-redes-sociales)"/><path d="M11 7h10a5 5 0 0 1 5 5v5a5 5 0 0 1-5 5h-2.4L16 25.2 13.4 22H11a5 5 0 0 1-5-5v-5a5 5 0 0 1 5-5Z" fill="#FFFFFF"/><path d="M16 18c-3.8-2.6-4.5-4.4-4.5-5.6 0-1.4 1.1-2.4 2.4-2.4.9 0 1.7.5 2.1 1.3.4-.8 1.2-1.3 2.1-1.3 1.3 0 2.4 1 2.4 2.4 0 1.2-.7 3-4.5 5.6Z" fill="#FF3B4B"/>',
    fill: '#FF3B4B',
    viewBox: '0 0 32 32',
    whiteGlyph: '<rect x="2" y="2" width="28" height="28" rx="8.5" fill="#ffffff"/>',
  },
  doc: {
    coloredGlyph: '<defs><linearGradient id="g-documento" x1="16" y1="2" x2="16" y2="30" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#39B2C1"/><stop offset="1" stop-color="#13A3B5"/></linearGradient></defs><rect x="2" y="2" width="28" height="28" rx="8.5" fill="url(#g-documento)"/><rect x="8" y="6" width="16" height="20" rx="3.5" fill="#FFFFFF"/><rect x="11.5" y="9.5" width="9" height="2" rx="1" fill="#13A3B5"/><rect x="11.5" y="13" width="6" height="1.6" rx=".8" fill="#13A3B5" fill-opacity=".55"/><circle cx="19.3" cy="17" r="1.3" fill="#13A3B5"/><path d="M11.5 22.5l3.1-3.8 2.2 2.4 1.6-1.8 3.1 3.2Z" fill="#13A3B5" stroke="#13A3B5" stroke-width="1" stroke-linejoin="round"/>',
    fill: '#13A3B5',
    viewBox: '0 0 32 32',
    whiteGlyph: '<rect x="2" y="2" width="28" height="28" rx="8.5" fill="#ffffff"/>',
  },
  template: {
    coloredGlyph: '<defs><linearGradient id="g-plantillas" x1="16" y1="2" x2="16" y2="30" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#915AF0"/><stop offset="1" stop-color="#7C3AED"/></linearGradient></defs><rect x="2" y="2" width="28" height="28" rx="8.5" fill="url(#g-plantillas)"/><rect x="8" y="8" width="16" height="5" rx="1.75" fill="#FFFFFF"/><rect x="8" y="15.5" width="7" height="8.5" rx="1.75" fill="#FFFFFF"/><rect x="17" y="15.5" width="7" height="3.5" rx="1.75" fill="#FFFFFF" fill-opacity=".72"/><rect x="17" y="20.5" width="7" height="3.5" rx="1.75" fill="#FFFFFF" fill-opacity=".72"/>',
    fill: '#7C3AED',
    viewBox: '0 0 32 32',
    whiteGlyph: '<rect x="2" y="2" width="28" height="28" rx="8.5" fill="#ffffff"/>',
  },
  marketing: {
    coloredGlyph: '<defs><linearGradient id="g-marketing" x1="16" y1="2" x2="16" y2="30" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#F43F5E"/><stop offset="1" stop-color="#E11D48"/></linearGradient></defs><rect x="2" y="2" width="28" height="28" rx="8.5" fill="url(#g-marketing)"/><path d="M7 8h18v11H7z" fill="#FFFFFF" fill-opacity=".25"/><path d="M7 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V7z" stroke="#FFFFFF" stroke-width="1.8"/><path d="M10 25h12M16 22v3" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round"/>',
    fill: '#F43F5E',
    viewBox: '0 0 32 32',
    whiteGlyph: '<rect x="2" y="2" width="28" height="28" rx="8.5" fill="#ffffff"/>',
  },
  business: {
    coloredGlyph: '<defs><linearGradient id="g-negocios" x1="16" y1="2" x2="16" y2="30" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#4F46E5"/><stop offset="1" stop-color="#3730A3"/></linearGradient></defs><rect x="2" y="2" width="28" height="28" rx="8.5" fill="url(#g-negocios)"/><path d="M12 9a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2h-8V9Z" fill="#FFFFFF" fill-opacity=".45"/><rect x="6.5" y="11" width="19" height="13" rx="3" fill="#FFFFFF"/><path d="M6.5 15h19M14.5 15v2.5a.5.5 0 0 0 .5.5h2a.5.5 0 0 0 .5-.5V15" stroke="#3730A3" stroke-width="1.6" stroke-linecap="round"/>',
    fill: '#4F46E5',
    viewBox: '0 0 32 32',
    whiteGlyph: '<rect x="2" y="2" width="28" height="28" rx="8.5" fill="#ffffff"/>',
  },
  video: {
    coloredGlyph: '<defs><linearGradient id="g-video" x1="16" y1="2" x2="16" y2="30" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#E64165"/><stop offset="1" stop-color="#E11D48"/></linearGradient></defs><rect x="2" y="2" width="28" height="28" rx="8.5" fill="url(#g-video)"/><rect x="6" y="9.5" width="14.5" height="13" rx="3.5" fill="#FFFFFF"/><path d="M22.5 14.3l2.9-1.9a.8.8 0 0 1 1.2.7v5.8a.8.8 0 0 1-1.2.7l-2.9-1.9Z" fill="#FFFFFF"/><path d="M12.4 13.8v4.4l3.7-2.2Z" fill="#E11D48" stroke="#E11D48" stroke-width="1.4" stroke-linejoin="round"/>',
    fill: '#E11D48',
    viewBox: '0 0 32 32',
    whiteGlyph: '<rect x="2" y="2" width="28" height="28" rx="8.5" fill="#ffffff"/>',
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
  if (normalized === 'business' || normalized === 'negocios' || normalized === 'work') return CANVAS_ICONS.business;
  if (normalized === 'presentation' || normalized === 'presentations') return CANVAS_ICONS.presentation;
  if (normalized === 'doc' || normalized === 'docs' || normalized === 'document') return CANVAS_ICONS.doc;
  if (normalized === 'sheet' || normalized === 'sheets' || normalized === 'spreadsheet') return CANVAS_ICONS.sheet;
  if (normalized === 'social' || normalized === 'socials') return CANVAS_ICONS.social;
  if (normalized === 'marketing' || normalized === 'print' || normalized === 'marketings') return CANVAS_ICONS.marketing;
  if (normalized === 'video' || normalized === 'videos') return CANVAS_ICONS.video;
  return CANVAS_ICONS.board;
}

export function getCategoryBadgeIconSvg(category: string, className = 'component-badge__icon'): string {
  const def = resolveCanvasIconDef(category);
  return `<svg class="${className}" viewBox="${def.viewBox}" fill="none" aria-hidden="true">${def.coloredGlyph}</svg>`;
}

export function getCategoryMenuSvg(category: string, className = 'menu-item__icon menu-item__icon--colored'): string {
  const def = resolveCanvasIconDef(category);
  return `<svg class="${className}" viewBox="${def.viewBox}" fill="none" aria-hidden="true">${def.coloredGlyph}</svg>`;
}

export function getCanvasTypeIconSvg(canvasType?: string, unit?: string, className = 'canvas-card__meta-icon canvas-card__meta-icon--colored'): string {
  const def = resolveCanvasIconDef(canvasType, unit);
  return `<svg class="${className}" viewBox="${def.viewBox}" fill="none" aria-hidden="true">${def.coloredGlyph}</svg>`;
}

export function getSocialPlatformBadgeIconSvg(platform: string, className = 'component-badge__icon component-badge__icon--colored'): string {
  const p = platform.toLowerCase().trim();
  switch (p) {
    case 'facebook':
      return `<svg class="${className}" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M21.5 12.058c0-5.28-4.253-9.558-9.5-9.558s-9.5 4.279-9.5 9.558c0 4.771 3.473 8.725 8.016 9.442v-6.68H8.104v-2.762h2.412V9.952c0-2.395 1.417-3.718 3.588-3.718 1.04 0 2.126.186 2.126.186v2.352h-1.198c-1.18 0-1.548.738-1.548 1.494v1.792h2.635l-.421 2.763h-2.214V21.5c4.543-.717 8.016-4.67 8.016-9.442z" fill="#1877F2"/></svg>`;
    case 'instagram':
      return `<svg class="${className}" viewBox="0 0 24 24" fill="none" aria-hidden="true"><defs><linearGradient id="g-badge-social-ig" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stop-color="#f09433"/><stop offset="30%" stop-color="#e6683c"/><stop offset="60%" stop-color="#dc2743"/><stop offset="80%" stop-color="#cc2366"/><stop offset="100%" stop-color="#bc1888"/></linearGradient></defs><path d="M12 3c-2.44 0-2.75.01-3.71.05-.96.05-1.61.2-2.19.42a4.4 4.4 0 0 0-1.59 1.04c-.5.5-.8 1-1.04 1.6a6.6 6.6 0 0 0-.42 2.18C3.01 9.25 3 9.56 3 12s.01 2.75.05 3.71c.05.96.2 1.61.42 2.19.23.59.54 1.09 1.04 1.59s1 .8 1.6 1.04a6.6 6.6 0 0 0 2.18.42c.96.04 1.27.05 3.71.05s2.75-.01 3.71-.05c.96-.05 1.61-.2 2.19-.42a4.4 4.4 0 0 0 1.59-1.04c.5-.5.8-1 1.04-1.6a6.6 6.6 0 0 0 .42-2.18c.04-.96.05-1.27.05-3.71s-.01-2.75-.05-3.71a6.62 6.62 0 0 0-.42-2.19 4.4 4.4 0 0 0-1.04-1.59c-.5-.5-1-.8-1.6-1.04a6.6 6.6 0 0 0-2.18-.42C14.75 3.01 14.44 3 12 3zm0 1.62c2.4 0 2.69.01 3.64.05.87.04 1.35.2 1.67.31.42.17.72.36 1.03.68.32.31.51.61.68 1.03.12.32.27.8.3 1.67.05.95.06 1.24.06 3.64 0 2.4-.01 2.69-.06 3.64-.04.87-.19 1.35-.31 1.67-.17.42-.36.72-.68 1.03-.31.32-.62.51-1.03.68-.32.12-.8.27-1.68.3-.95.05-1.24.06-3.64.06-2.41 0-2.7-.01-3.65-.06a5.12 5.12 0 0 1-1.67-.31 2.8 2.8 0 0 1-1.04-.68 2.75 2.75 0 0 1-.67-1.03c-.13-.32-.27-.8-.32-1.68-.03-.94-.04-1.24-.04-3.63 0-2.4 0-2.7.04-3.65.05-.87.2-1.36.32-1.67.15-.43.36-.72.67-1.04a2.67 2.67 0 0 1 1.04-.67c.31-.13.78-.27 1.66-.32.96-.03 1.24-.04 3.65-.04l.03.02zm0 2.76a4.62 4.62 0 1 0 0 9.24 4.62 4.62 0 0 0 0-9.24zM12 15a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm5.88-7.8a1.08 1.08 0 1 1-2.16 0 1.08 1.08 0 0 1 2.16 0z" fill="url(#g-badge-social-ig)"/></svg>`;
    case 'linkedin':
      return `<svg class="${className}" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M18.337 18.338H15.67V14.16c0-.996-.019-2.278-1.387-2.278-1.39 0-1.602 1.085-1.602 2.206v4.249h-2.666v-8.59h2.559v1.174h.037c.356-.676 1.227-1.388 2.526-1.388 2.701 0 3.2 1.779 3.2 4.092v4.712zM7.005 8.574a1.548 1.548 0 1 1-.003-3.095 1.548 1.548 0 0 1 .003 3.095zm-1.337 9.764H8.34v-8.59H5.668v8.59zM19.667 3H4.327C3.597 3 3 3.58 3 4.297V19.7c0 .718.596 1.3 1.328 1.3h15.339C20.4 21 21 20.418 21 19.7V4.297C21 3.58 20.4 3 19.667 3z" fill="#0A66C2"/></svg>`;
    case 'pinterest':
      return `<svg class="${className}" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M16 2.67a13.33 13.33 0 0 0-4.86 25.75c-.12-1.06-.22-2.68.05-3.83l1.56-6.63s-.4-.8-.4-1.98c0-1.85 1.08-3.23 2.41-3.23 1.14 0 1.7.85 1.7 1.87 0 1.15-.74 2.86-1.11 4.44-.32 1.33.66 2.41 1.97 2.41 2.37 0 4.2-2.5 4.2-6.1 0-3.2-2.3-5.43-5.58-5.43a5.77 5.77 0 0 0-6.02 5.79c0 1.14.44 2.37 1 3.04.1.13.12.25.09.38l-.37 1.52c-.06.24-.2.3-.45.17-1.66-.77-2.7-3.2-2.7-5.16 0-4.2 3.05-8.07 8.8-8.07 4.63 0 8.22 3.3 8.22 7.7 0 4.6-2.9 8.3-6.91 8.3-1.36 0-2.63-.7-3.06-1.54l-.83 3.17a14.9 14.9 0 0 1-1.66 3.5A13.33 13.33 0 1 0 16 2.67" fill="#E60023"/></svg>`;
    case 'tiktok':
      return `<svg class="${className}" viewBox="0 0 512 512" fill="none" aria-hidden="true"><rect width="512" height="512" rx="100" fill="#000000"/><path d="M404.243 167.606v-13.149a86.013 86.013 0 0 1-45.689-13.059 86.29 86.29 0 0 0 45.689 26.208Zm-85.11-84.566a88.225 88.225 0 0 1-.946-7.094V68h-62.114v246.764c-.099 28.763-23.433 52.057-52.212 52.057a51.979 51.979 0 0 1-23.49-5.572c9.54 12.526 24.605 20.612 41.563 20.612 28.774 0 52.112-23.291 52.213-52.058V83.04h44.986ZM219.71 215.634v-13.998a115.232 115.232 0 0 0-15.662-1.064c-63.043-.001-114.147 51.127-114.147 114.192 0 39.538 20.085 74.384 50.605 94.881-20.13-20.586-32.533-48.764-32.533-79.844 0-62.261 49.805-112.887 111.737-114.167Z" fill="#25F4EE"/><path d="M336.259 203.729c24.254 17.345 53.966 27.551 86.057 27.551v-61.781a87.06 87.06 0 0 1-18.073-1.892v48.631c-32.088 0-61.796-10.206-86.057-27.551v126.078c0 63.071-51.104 114.196-114.141 114.196-23.52 0-45.381-7.114-63.542-19.315 20.727 21.203 49.633 34.356 81.611 34.356 63.041 0 114.147-51.125 114.147-114.198V203.729h-.002Zm22.294-62.33c-12.395-13.548-20.533-31.057-22.294-50.413V83.04h-17.126c4.31 24.601 19.014 45.62 39.42 58.359ZM180.374 361.247a52.034 52.034 0 0 1-10.651-31.624c0-28.846 23.375-52.235 52.213-52.235a52.31 52.31 0 0 1 15.839 2.448v-63.162a115.014 115.014 0 0 0-18.065-1.041v49.162a52.249 52.249 0 0 0-15.846-2.447c-28.839 0-52.212 23.387-52.212 52.236 0 20.399 11.683 38.06 28.722 46.663Z" fill="#FE2C55"/><path d="M318.187 188.686c24.26 17.345 53.969 27.551 86.057 27.551v-48.631c-17.912-3.817-33.768-13.182-45.69-26.207-20.407-12.741-35.11-33.759-39.421-58.36h-44.986v246.762c-.102 28.767-23.437 52.061-52.213 52.061-16.957 0-32.022-8.087-41.563-20.615-17.038-8.603-28.721-26.265-28.721-46.661 0-28.848 23.373-52.236 52.212-52.236 5.525 0 10.85.86 15.846 2.446v-49.162c-61.929 1.28-111.736 51.906-111.736 114.168 0 31.081 12.403 59.258 32.533 79.845 18.16 12.2 40.022 19.315 63.542 19.315 63.038 0 114.141-51.128 114.141-114.197V188.686h-.001Z" fill="#FFFFFF"/></svg>`;
    case 'x':
    case 'twitter':
      return `<svg class="${className}" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M13.713 10.622 20.413 3h-1.588l-5.818 6.618L8.36 3H3l7.027 10.007L3 21h1.588l6.144-6.989L15.64 21H21l-7.287-10.378Zm-2.175 2.474-.713-.997L5.16 4.17H7.6l4.571 6.4.712.996 5.943 8.319h-2.439l-4.85-6.788Z" fill="currentColor"/></svg>`;
    case 'whatsapp':
      return `<svg class="${className}" viewBox="0 0 24 24" fill="none" aria-hidden="true"><defs><linearGradient id="g-badge-social-wa" x1="12" y1="1" x2="12" y2="23" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#2fe675"/><stop offset="100%" stop-color="#128c7e"/></linearGradient></defs><path d="m1.24 20.44 1.38-5.012a9.638 9.638 0 0 1-1.298-4.834C1.322 5.259 5.687.92 11.041.92c2.602 0 5.04 1.01 6.875 2.835a9.591 9.591 0 0 1 2.844 6.843c0 5.334-4.365 9.674-9.719 9.674h-.005a9.76 9.76 0 0 1-4.644-1.178L1.24 20.44z" fill="url(#g-badge-social-wa)"/><path d="M8.483 6.4c-.189-.418-.387-.428-.566-.433-.146-.005-.315-.005-.484-.005-.17 0-.44.063-.673.313-.232.25-.881.856-.881 2.091 0 1.23.905 2.423 1.03 2.591.127.168 1.748 2.779 4.309 3.783 2.13.837 2.565.669 3.025.625.465-.043 1.49-.605 1.704-1.192.208-.586.208-1.086.145-1.192-.063-.106-.232-.168-.484-.293-.252-.125-1.49-.731-1.723-.818-.232-.086-.402-.125-.566.125-.17.25-.654.813-.8.981-.144.168-.294.188-.546.063-.252-.125-1.065-.39-2.028-1.245-.75-.664-1.259-1.486-1.404-1.736-.145-.25-.014-.384.111-.51.112-.11.252-.293.378-.437.126-.144.17-.25.252-.418.082-.168.043-.313-.02-.438s-.556-1.36-.779-1.855z" fill="#FFFFFF"/></svg>`;
    case 'youtube':
      return `<svg class="${className}" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M19.822 5.626c.843.225 1.574.9 1.799 1.742.505 2.08.505 7.756 0 9.779-.225.843-.956 1.517-1.799 1.742-2.08.562-13.6.562-15.623 0-.843-.225-1.573-.899-1.798-1.742-.562-2.192-.506-7.643 0-9.779.225-.843.955-1.517 1.798-1.742 2.192-.562 13.713-.506 15.623 0zm-9.834 9.61V9.28l5.226 2.979-5.226 2.978z" fill="#FF0000"/><polygon points="9.988,9.28 15.214,12.259 9.988,15.236" fill="#FFFFFF"/></svg>`;
    default:
      return '';
  }
}



