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
        <rect x="52" y="20" width="35" height="5" rx="2.5" fill="#334155"/>
        <rect x="52" y="32" width="76" height="1" fill="#cbd5e1"/>
        <rect x="52" y="40" width="50" height="3" rx="1.5" fill="#64748b"/>
        <rect x="52" y="48" width="76" height="2" rx="1" fill="#94a3b8"/>
        <rect x="52" y="54" width="70" height="2" rx="1" fill="#cbd5e1"/>
        <rect x="52" y="60" width="60" height="2" rx="1" fill="#cbd5e1"/>
        <line x1="52" y1="78" x2="85" y2="78" stroke="#334155" stroke-width="1"/>
        <rect x="52" y="82" width="40" height="3" rx="1.5" fill="#334155"/>
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
        <rect x="24" y="35" width="70" height="7" rx="3.5" fill="#1e293b"/>
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
        <rect x="48" y="30" width="60" height="7" rx="3.5" fill="#1e293b"/>
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
        <rect x="70" y="22" width="40" height="6" rx="3" fill="#1e293b"/>
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
        <rect x="24" y="35" width="70" height="7" rx="3.5" fill="#1e293b"/>
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
        <rect x="62" y="18" width="45" height="4" rx="2" fill="#1e293b"/>
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
        <rect x="64" y="52" width="55" height="6" rx="3" fill="#1e293b"/>
        <rect x="64" y="62" width="38" height="4" rx="2" fill="#94a3b8"/>
        <rect x="126" y="54" width="28" height="12" rx="3" fill="#1877f2"/>
      </svg>`;
    default:
      return `<svg viewBox="0 0 180 110" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="36" y="10" width="108" height="90" rx="6" fill="#ffffff" stroke="#1877f2" stroke-width="1.5"/>
        <circle cx="50" cy="24" r="6" fill="#1877f2"/>
        <rect x="62" y="20" width="50" height="4" rx="2" fill="#1e293b"/>
        <rect x="44" y="36" width="92" height="48" rx="4" fill="#eff6ff" stroke="#bfdbfe" stroke-width="0.75"/>
      </svg>`;
  }
}

export function getSheetSvg(): string {
  return `<svg viewBox="0 0 180 110" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="15" y="10" width="150" height="90" rx="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5"/>
    <rect x="16" y="11" width="148" height="16" rx="5 5 0 0" fill="#f8fafc"/>
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


