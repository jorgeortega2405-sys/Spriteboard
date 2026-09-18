import fs from 'fs';
import path from 'path';

const BASE_DIR = path.join(process.cwd(), 'public', 'assets', 'templates');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function generateDotGrid(w = 400, h = 240, step = 20, dotColor = '#cbd5e1') {
  let dots = '';
  for (let x = 10; x < w; x += step) {
    for (let y = 10; y < h; y += step) {
      dots += `<circle cx="${x}" cy="${y}" r="1.2" fill="${dotColor}"/>`;
    }
  }
  return `<g opacity="0.85">${dots}</g>`;
}

function svgWrap(content, w = 400, h = 240) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%" height="100%">
  <rect width="${w}" height="${h}" fill="#ffffff" stroke="#e2e8f0" stroke-width="1"/>
  ${content}
</svg>`;
}

const BOARD_TEMPLATES = {
  'brainstorm': {
    title: 'Lluvia de Ideas y Notas',
    subtitle: 'Espacio libre para notas rápidas',
    elementsSvg: `
      <g transform="rotate(-2 80 80)">
        <rect x="40" y="45" width="85" height="85" rx="4" fill="#fef08a" stroke="#eab308" stroke-width="1"/>
        <rect x="50" y="58" width="50" height="6" rx="2" fill="#854d0e"/>
        <rect x="50" y="70" width="65" height="3" rx="1.5" fill="#a16207"/>
        <rect x="50" y="78" width="55" height="3" rx="1.5" fill="#a16207"/>
        <rect x="50" y="86" width="40" height="3" rx="1.5" fill="#a16207"/>
      </g>
      <g transform="rotate(3 180 90)">
        <rect x="145" y="55" width="85" height="85" rx="4" fill="#bae6fd" stroke="#0284c7" stroke-width="1"/>
        <rect x="155" y="68" width="55" height="6" rx="2" fill="#0369a1"/>
        <rect x="155" y="80" width="65" height="3" rx="1.5" fill="#0284c7"/>
        <rect x="155" y="88" width="60" height="3" rx="1.5" fill="#0284c7"/>
        <rect x="155" y="96" width="45" height="3" rx="1.5" fill="#0284c7"/>
      </g>
      <g transform="rotate(-1 290 85)">
        <rect x="250" y="50" width="85" height="85" rx="4" fill="#bbf7d0" stroke="#16a34a" stroke-width="1"/>
        <rect x="260" y="63" width="50" height="6" rx="2" fill="#15803d"/>
        <rect x="260" y="75" width="65" height="3" rx="1.5" fill="#16a34a"/>
        <rect x="260" y="83" width="55" height="3" rx="1.5" fill="#16a34a"/>
        <rect x="260" y="91" width="40" height="3" rx="1.5" fill="#16a34a"/>
      </g>
      <g transform="rotate(2 130 180)">
        <rect x="90" y="145" width="85" height="75" rx="4" fill="#fbcfe8" stroke="#db2777" stroke-width="1"/>
        <rect x="100" y="157" width="50" height="5" rx="2" fill="#be185d"/>
        <rect x="100" y="168" width="60" height="3" rx="1.5" fill="#db2777"/>
        <rect x="100" y="176" width="45" height="3" rx="1.5" fill="#db2777"/>
      </g>
      <g transform="rotate(-3 240 180)">
        <rect x="200" y="145" width="85" height="75" rx="4" fill="#fed7aa" stroke="#ea580c" stroke-width="1"/>
        <rect x="210" y="157" width="50" height="5" rx="2" fill="#c2410c"/>
        <rect x="210" y="168" width="60" height="3" rx="1.5" fill="#ea580c"/>
        <rect x="210" y="176" width="45" height="3" rx="1.5" fill="#ea580c"/>
      </g>
      <path d="M125 100 Q150 120 170 110" stroke="#6366f1" stroke-width="1.5" stroke-dasharray="3 3" fill="none"/>
      <path d="M230 110 Q250 130 270 100" stroke="#6366f1" stroke-width="1.5" stroke-dasharray="3 3" fill="none"/>
    `
  },
  'retro': {
    title: 'Retrospectiva Ágil',
    subtitle: 'Qué funcionó, qué no y acciones',
    elementsSvg: `
      <rect x="25" y="30" width="105" height="185" rx="6" fill="#f8fafc" stroke="#10b981" stroke-width="1.5"/>
      <rect x="35" y="42" width="70" height="6" rx="2" fill="#059669"/>
      <rect x="35" y="58" width="85" height="42" rx="3" fill="#dcfce7" stroke="#86efac" stroke-width="1"/>
      <rect x="42" y="68" width="60" height="3" rx="1" fill="#15803d"/>
      <rect x="42" y="76" width="45" height="3" rx="1" fill="#16a34a"/>
      <rect x="35" y="110" width="85" height="42" rx="3" fill="#dcfce7" stroke="#86efac" stroke-width="1"/>
      <rect x="42" y="120" width="55" height="3" rx="1" fill="#15803d"/>
      <rect x="42" y="128" width="40" height="3" rx="1" fill="#16a34a"/>

      <rect x="147" y="30" width="105" height="185" rx="6" fill="#f8fafc" stroke="#f59e0b" stroke-width="1.5"/>
      <rect x="157" y="42" width="70" height="6" rx="2" fill="#d97706"/>
      <rect x="157" y="58" width="85" height="42" rx="3" fill="#fef3c7" stroke="#fde68a" stroke-width="1"/>
      <rect x="164" y="68" width="60" height="3" rx="1" fill="#b45309"/>
      <rect x="164" y="76" width="45" height="3" rx="1" fill="#d97706"/>

      <rect x="270" y="30" width="105" height="185" rx="6" fill="#f8fafc" stroke="#6366f1" stroke-width="1.5"/>
      <rect x="280" y="42" width="70" height="6" rx="2" fill="#4f46e5"/>
      <rect x="280" y="58" width="85" height="42" rx="3" fill="#e0e7ff" stroke="#c7d2fe" stroke-width="1"/>
      <rect x="287" y="68" width="60" height="3" rx="1" fill="#3730a3"/>
      <rect x="287" y="76" width="50" height="3" rx="1" fill="#4f46e5"/>
      <rect x="280" y="110" width="85" height="42" rx="3" fill="#e0e7ff" stroke="#c7d2fe" stroke-width="1"/>
      <rect x="287" y="120" width="55" height="3" rx="1" fill="#3730a3"/>
      <rect x="287" y="128" width="40" height="3" rx="1" fill="#4f46e5"/>
    `
  },
  'kanban': {
    title: 'Tablero Kanban de Tareas',
    subtitle: 'Por hacer, En progreso y Hecho',
    elementsSvg: `
      <rect x="20" y="30" width="85" height="185" rx="6" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1"/>
      <rect x="30" y="42" width="50" height="5" rx="2" fill="#475569"/>
      <rect x="28" y="56" width="69" height="36" rx="3" fill="#ffffff" stroke="#e2e8f0" stroke-width="1"/>
      <rect x="34" y="64" width="45" height="3" rx="1" fill="#334155"/>
      <rect x="28" y="98" width="69" height="36" rx="3" fill="#ffffff" stroke="#e2e8f0" stroke-width="1"/>
      <rect x="34" y="106" width="40" height="3" rx="1" fill="#334155"/>

      <rect x="115" y="30" width="85" height="185" rx="6" fill="#eff6ff" stroke="#93c5fd" stroke-width="1"/>
      <rect x="125" y="42" width="55" height="5" rx="2" fill="#2563eb"/>
      <rect x="123" y="56" width="69" height="36" rx="3" fill="#ffffff" stroke="#bfdbfe" stroke-width="1"/>
      <rect x="129" y="64" width="48" height="3" rx="1" fill="#1e40af"/>
      <rect x="129" y="72" width="30" height="2" rx="1" fill="#3b82f6"/>

      <rect x="210" y="30" width="85" height="185" rx="6" fill="#fefce8" stroke="#fde047" stroke-width="1"/>
      <rect x="220" y="42" width="55" height="5" rx="2" fill="#ca8a04"/>
      <rect x="218" y="56" width="69" height="36" rx="3" fill="#ffffff" stroke="#fef08a" stroke-width="1"/>
      <rect x="224" y="64" width="45" height="3" rx="1" fill="#854d0e"/>

      <rect x="305" y="30" width="80" height="185" rx="6" fill="#f0fdf4" stroke="#86efac" stroke-width="1"/>
      <rect x="315" y="42" width="45" height="5" rx="2" fill="#16a34a"/>
      <rect x="313" y="56" width="64" height="36" rx="3" fill="#ffffff" stroke="#bbf7d0" stroke-width="1"/>
      <rect x="319" y="64" width="40" height="3" rx="1" fill="#166534"/>
      <rect x="319" y="72" width="25" height="2" rx="1" fill="#22c55e"/>
    `
  },
  'empathy': {
    title: 'Mapa de Empatía del Usuario',
    subtitle: 'Qué piensa, dice, hace y siente',
    elementsSvg: `
      <circle cx="200" cy="120" r="32" fill="#e0e7ff" stroke="#6366f1" stroke-width="2"/>
      <circle cx="200" cy="112" r="12" fill="#6366f1"/>
      <path d="M185 136 Q200 126 215 136" stroke="#6366f1" stroke-width="2" fill="none"/>
      
      <rect x="30" y="30" width="130" height="75" rx="6" fill="#f8fafc" stroke="#38bdf8" stroke-width="1.5"/>
      <text x="42" y="50" font-family="system-ui, sans-serif" font-size="9" font-weight="700" fill="#0284c7">¿QUÉ PIENSA Y SIENTE?</text>
      <rect x="42" y="60" width="95" height="26" rx="3" fill="#bae6fd" stroke="#7dd3fc" stroke-width="1"/>

      <rect x="240" y="30" width="130" height="75" rx="6" fill="#f8fafc" stroke="#a855f7" stroke-width="1.5"/>
      <text x="252" y="50" font-family="system-ui, sans-serif" font-size="9" font-weight="700" fill="#7e22ce">¿QUÉ VE?</text>
      <rect x="252" y="60" width="95" height="26" rx="3" fill="#f3e8ff" stroke="#d8b4fe" stroke-width="1"/>

      <rect x="30" y="135" width="130" height="75" rx="6" fill="#f8fafc" stroke="#10b981" stroke-width="1.5"/>
      <text x="42" y="155" font-family="system-ui, sans-serif" font-size="9" font-weight="700" fill="#047857">¿QUÉ DICE Y HACE?</text>
      <rect x="42" y="165" width="95" height="26" rx="3" fill="#d1fae5" stroke="#6ee7b7" stroke-width="1"/>

      <rect x="240" y="135" width="130" height="75" rx="6" fill="#f8fafc" stroke="#f59e0b" stroke-width="1.5"/>
      <text x="252" y="155" font-family="system-ui, sans-serif" font-size="9" font-weight="700" fill="#b45309">¿QUÉ OYE?</text>
      <rect x="252" y="165" width="95" height="26" rx="3" fill="#fef3c7" stroke="#fde68a" stroke-width="1"/>
    `
  },
  'journey': {
    title: 'Customer Journey Map',
    subtitle: 'Fases, acciones y emociones',
    elementsSvg: `
      <line x1="40" y1="130" x2="360" y2="130" stroke="#cbd5e1" stroke-width="2" stroke-dasharray="4 4"/>
      <path d="M40 140 Q120 90 200 150 T360 80" stroke="#6366f1" stroke-width="3" fill="none"/>
      
      <circle cx="80" cy="118" r="8" fill="#3b82f6"/>
      <circle cx="160" cy="120" r="8" fill="#10b981"/>
      <circle cx="240" cy="155" r="8" fill="#f59e0b"/>
      <circle cx="320" cy="95" r="8" fill="#6366f1"/>

      <rect x="50" y="35" width="60" height="35" rx="4" fill="#eff6ff" stroke="#bfdbfe" stroke-width="1"/>
      <text x="56" y="50" font-family="system-ui, sans-serif" font-size="7" font-weight="700" fill="#1d4ed8">Descubrimiento</text>
      
      <rect x="130" y="35" width="60" height="35" rx="4" fill="#f0fdf4" stroke="#bbf7d0" stroke-width="1"/>
      <text x="136" y="50" font-family="system-ui, sans-serif" font-size="7" font-weight="700" fill="#15803d">Evaluación</text>

      <rect x="210" y="35" width="60" height="35" rx="4" fill="#fefce8" stroke="#fef08a" stroke-width="1"/>
      <text x="222" y="50" font-family="system-ui, sans-serif" font-size="7" font-weight="700" fill="#a16207">Compra</text>

      <rect x="290" y="35" width="60" height="35" rx="4" fill="#fdf2f8" stroke="#fbcfe8" stroke-width="1"/>
      <text x="298" y="50" font-family="system-ui, sans-serif" font-size="7" font-weight="700" fill="#be185d">Retención</text>

      <rect x="50" y="175" width="60" height="35" rx="4" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1"/>
      <rect x="130" y="175" width="60" height="35" rx="4" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1"/>
      <rect x="210" y="175" width="60" height="35" rx="4" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1"/>
      <rect x="290" y="175" width="60" height="35" rx="4" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1"/>
    `
  },
  'business': {
    title: 'Canvas Modelo de Negocio',
    subtitle: 'Propuesta de valor y bloques clave',
    elementsSvg: `
      <rect x="20" y="25" width="70" height="130" rx="4" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1"/>
      <text x="26" y="38" font-family="system-ui, sans-serif" font-size="7" font-weight="700" fill="#334155">Socios Clave</text>

      <rect x="95" y="25" width="70" height="62" rx="4" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1"/>
      <text x="101" y="38" font-family="system-ui, sans-serif" font-size="7" font-weight="700" fill="#334155">Actividades</text>
      <rect x="95" y="92" width="70" height="63" rx="4" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1"/>
      <text x="101" y="105" font-family="system-ui, sans-serif" font-size="7" font-weight="700" fill="#334155">Recursos</text>

      <rect x="170" y="25" width="70" height="130" rx="4" fill="#eff6ff" stroke="#3b82f6" stroke-width="1.5"/>
      <text x="176" y="38" font-family="system-ui, sans-serif" font-size="7" font-weight="700" fill="#1d4ed8">Propuesta Valor</text>
      <rect x="178" y="55" width="54" height="28" rx="2" fill="#dbeafe"/>

      <rect x="245" y="25" width="70" height="62" rx="4" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1"/>
      <text x="251" y="38" font-family="system-ui, sans-serif" font-size="7" font-weight="700" fill="#334155">Relaciones</text>
      <rect x="245" y="92" width="70" height="63" rx="4" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1"/>
      <text x="251" y="105" font-family="system-ui, sans-serif" font-size="7" font-weight="700" fill="#334155">Canales</text>

      <rect x="320" y="25" width="60" height="130" rx="4" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1"/>
      <text x="324" y="38" font-family="system-ui, sans-serif" font-size="7" font-weight="700" fill="#334155">Clientes</text>

      <rect x="20" y="162" width="175" height="52" rx="4" fill="#fef2f2" stroke="#fca5a5" stroke-width="1"/>
      <text x="26" y="176" font-family="system-ui, sans-serif" font-size="7" font-weight="700" fill="#991b1b">Estructura de Costes</text>

      <rect x="205" y="162" width="175" height="52" rx="4" fill="#f0fdf4" stroke="#86efac" stroke-width="1"/>
      <text x="211" y="176" font-family="system-ui, sans-serif" font-size="7" font-weight="700" fill="#166534">Fuentes de Ingresos</text>
    `
  },
  'matrix': {
    title: 'Matriz Impacto vs Esfuerzo',
    subtitle: 'Priorización estratégica de proyectos',
    elementsSvg: `
      <line x1="200" y1="20" x2="200" y2="220" stroke="#94a3b8" stroke-width="2"/>
      <line x1="20" y1="120" x2="380" y2="120" stroke="#94a3b8" stroke-width="2"/>

      <rect x="30" y="28" width="160" height="84" rx="4" fill="#dcfce7" fill-opacity="0.5"/>
      <text x="40" y="44" font-family="system-ui, sans-serif" font-size="9" font-weight="700" fill="#15803d">QUICK WINS (Alto I / Bajo E)</text>
      <rect x="40" y="55" width="50" height="40" rx="3" fill="#fef08a" stroke="#facc15" stroke-width="1"/>
      <rect x="100" y="60" width="50" height="40" rx="3" fill="#bbf7d0" stroke="#4ade80" stroke-width="1"/>

      <rect x="210" y="28" width="160" height="84" rx="4" fill="#eff6ff" fill-opacity="0.5"/>
      <text x="220" y="44" font-family="system-ui, sans-serif" font-size="9" font-weight="700" fill="#1d4ed8">ESTRATÉGICOS (Alto I / Alto E)</text>
      <rect x="220" y="55" width="50" height="40" rx="3" fill="#bae6fd" stroke="#38bdf8" stroke-width="1"/>

      <rect x="30" y="128" width="160" height="84" rx="4" fill="#fefce8" fill-opacity="0.5"/>
      <text x="40" y="144" font-family="system-ui, sans-serif" font-size="9" font-weight="700" fill="#a16207">RELLENOS (Bajo I / Bajo E)</text>
      <rect x="40" y="155" width="50" height="40" rx="3" fill="#fed7aa" stroke="#fb923c" stroke-width="1"/>

      <rect x="210" y="128" width="160" height="84" rx="4" fill="#fef2f2" fill-opacity="0.5"/>
      <text x="220" y="144" font-family="system-ui, sans-serif" font-size="9" font-weight="700" fill="#b91c1c">DESCARTAR (Bajo I / Alto E)</text>
      <rect x="220" y="155" width="50" height="40" rx="3" fill="#fecaca" stroke="#f87171" stroke-width="1"/>
    `
  },
  'wireframe': {
    title: 'Muro de Bocetos y Wireframes',
    subtitle: 'Componentes UI y pantallas visuales',
    elementsSvg: `
      <rect x="40" y="30" width="140" height="180" rx="8" fill="#ffffff" stroke="#64748b" stroke-width="1.5"/>
      <rect x="40" y="30" width="140" height="24" rx="8" fill="#f1f5f9"/>
      <circle cx="52" cy="42" r="3" fill="#cbd5e1"/>
      <circle cx="60" cy="42" r="3" fill="#cbd5e1"/>
      <circle cx="68" cy="42" r="3" fill="#cbd5e1"/>
      <rect x="52" y="65" width="116" height="40" rx="4" fill="#e2e8f0"/>
      <line x1="52" y1="65" x2="168" y2="105" stroke="#94a3b8" stroke-width="1"/>
      <line x1="168" y1="65" x2="52" y2="105" stroke="#94a3b8" stroke-width="1"/>
      <rect x="52" y="115" width="65" height="6" rx="2" fill="#64748b"/>
      <rect x="52" y="128" width="116" height="4" rx="1" fill="#cbd5e1"/>
      <rect x="52" y="136" width="95" height="4" rx="1" fill="#cbd5e1"/>
      <rect x="52" y="155" width="50" height="18" rx="4" fill="#3b82f6"/>

      <rect x="220" y="30" width="140" height="180" rx="8" fill="#ffffff" stroke="#64748b" stroke-width="1.5"/>
      <rect x="220" y="30" width="140" height="24" rx="8" fill="#f1f5f9"/>
      <circle cx="232" cy="42" r="3" fill="#cbd5e1"/>
      <rect x="232" y="65" width="52" height="52" rx="4" fill="#e2e8f0"/>
      <rect x="296" y="65" width="52" height="52" rx="4" fill="#e2e8f0"/>
      <rect x="232" y="130" width="116" height="60" rx="4" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1"/>
    `
  },
  'roadmap': {
    title: 'Roadmap Trimestral Visual',
    subtitle: 'Planificación de metas Q1 a Q4',
    elementsSvg: `
      <rect x="25" y="30" width="80" height="180" rx="6" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1"/>
      <rect x="35" y="40" width="60" height="14" rx="3" fill="#dbeafe"/>
      <text x="50" y="50" font-family="system-ui, sans-serif" font-size="8" font-weight="700" fill="#1d4ed8">Q1</text>
      <rect x="32" y="64" width="66" height="42" rx="4" fill="#3b82f6"/>
      <rect x="32" y="116" width="66" height="35" rx="4" fill="#93c5fd"/>

      <rect x="115" y="30" width="80" height="180" rx="6" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1"/>
      <rect x="125" y="40" width="60" height="14" rx="3" fill="#dcfce7"/>
      <text x="140" y="50" font-family="system-ui, sans-serif" font-size="8" font-weight="700" fill="#15803d">Q2</text>
      <rect x="122" y="64" width="66" height="55" rx="4" fill="#10b981"/>

      <rect x="205" y="30" width="80" height="180" rx="6" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1"/>
      <rect x="215" y="40" width="60" height="14" rx="3" fill="#fef3c7"/>
      <text x="230" y="50" font-family="system-ui, sans-serif" font-size="8" font-weight="700" fill="#b45309">Q3</text>
      <rect x="212" y="64" width="66" height="42" rx="4" fill="#f59e0b"/>
      <rect x="212" y="116" width="66" height="42" rx="4" fill="#fde047"/>

      <rect x="295" y="30" width="80" height="180" rx="6" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1"/>
      <rect x="305" y="40" width="60" height="14" rx="3" fill="#f3e8ff"/>
      <text x="320" y="50" font-family="system-ui, sans-serif" font-size="8" font-weight="700" fill="#7e22ce">Q4</text>
      <rect x="302" y="64" width="66" height="50" rx="4" fill="#8b5cf6"/>
    `
  },
  'swot': {
    title: 'Análisis FODA Colaborativo',
    subtitle: 'Fortalezas, Oportunidades, Debilidades y Amenazas',
    elementsSvg: `
      <rect x="25" y="25" width="165" height="90" rx="6" fill="#f0fdf4" stroke="#86efac" stroke-width="1.5"/>
      <text x="35" y="42" font-family="system-ui, sans-serif" font-size="10" font-weight="700" fill="#15803d">FORTALEZAS</text>
      <rect x="35" y="52" width="45" height="45" rx="3" fill="#bbf7d0" stroke="#4ade80" stroke-width="1"/>
      <rect x="90" y="52" width="45" height="45" rx="3" fill="#bbf7d0" stroke="#4ade80" stroke-width="1"/>

      <rect x="210" y="25" width="165" height="90" rx="6" fill="#eff6ff" stroke="#93c5fd" stroke-width="1.5"/>
      <text x="220" y="42" font-family="system-ui, sans-serif" font-size="10" font-weight="700" fill="#1d4ed8">OPORTUNIDADES</text>
      <rect x="220" y="52" width="45" height="45" rx="3" fill="#bae6fd" stroke="#38bdf8" stroke-width="1"/>
      <rect x="275" y="52" width="45" height="45" rx="3" fill="#bae6fd" stroke="#38bdf8" stroke-width="1"/>

      <rect x="25" y="125" width="165" height="90" rx="6" fill="#fefce8" stroke="#fde047" stroke-width="1.5"/>
      <text x="35" y="142" font-family="system-ui, sans-serif" font-size="10" font-weight="700" fill="#a16207">DEBILIDADES</text>
      <rect x="35" y="152" width="45" height="45" rx="3" fill="#fed7aa" stroke="#fb923c" stroke-width="1"/>
      <rect x="90" y="152" width="45" height="45" rx="3" fill="#fed7aa" stroke="#fb923c" stroke-width="1"/>

      <rect x="210" y="125" width="165" height="90" rx="6" fill="#fef2f2" stroke="#fca5a5" stroke-width="1.5"/>
      <text x="220" y="142" font-family="system-ui, sans-serif" font-size="10" font-weight="700" fill="#b91c1c">AMENAZAS</text>
      <rect x="220" y="152" width="45" height="45" rx="3" fill="#fecaca" stroke="#f87171" stroke-width="1"/>
      <rect x="275" y="152" width="45" height="45" rx="3" fill="#fecaca" stroke="#f87171" stroke-width="1"/>
    `
  }
};

function generateBoardSvgs() {
  const dir = path.join(BASE_DIR, 'boards');
  ensureDir(dir);
  Object.entries(BOARD_TEMPLATES).forEach(([id, data]) => {
    const content = generateDotGrid() + data.elementsSvg;
    fs.writeFileSync(path.join(dir, `${id}.svg`), svgWrap(content));
  });
}

function generateMindmapSvgs() {
  const dir = path.join(BASE_DIR, 'mindmaps');
  ensureDir(dir);
  const colors = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#8b5cf6', '#ea580c', '#14b8a6', '#f43f5e'];
  const titles = [
    'Lluvia de Ideas de Innovación',
    'Planificación Estratégica',
    'Estructura de Conocimiento',
    'Lanzamiento de Producto',
    'Análisis de Soluciones',
    'Objetivos y Hábitos',
    'Marketing y Contenidos',
    'Arquitectura de Información',
    'Metodología de Investigación',
    'Síntesis y Resumen'
  ];

  titles.forEach((title, idx) => {
    const c = colors[idx % colors.length];
    const content = `
      ${generateDotGrid()}
      <rect x="135" y="103" width="130" height="34" rx="17" fill="${c}"/>
      <text x="200" y="124" font-family="system-ui, sans-serif" font-size="9" font-weight="700" fill="#ffffff" text-anchor="middle">${title.slice(0, 18)}</text>
      
      <path d="M265 120 C300 120, 310 70, 330 70" stroke="${c}" stroke-width="2.5" fill="none"/>
      <rect x="310" y="56" width="70" height="24" rx="12" fill="#ffffff" stroke="${c}" stroke-width="1.5"/>
      <text x="345" y="72" font-family="system-ui, sans-serif" font-size="8" font-weight="600" fill="${c}" text-anchor="middle">Fase 1</text>

      <path d="M265 120 C300 120, 310 170, 330 170" stroke="${c}" stroke-width="2.5" fill="none"/>
      <rect x="310" y="158" width="70" height="24" rx="12" fill="#ffffff" stroke="${c}" stroke-width="1.5"/>
      <text x="345" y="174" font-family="system-ui, sans-serif" font-size="8" font-weight="600" fill="${c}" text-anchor="middle">Fase 2</text>

      <path d="M135 120 C100 120, 90 70, 70 70" stroke="${c}" stroke-width="2.5" fill="none"/>
      <rect x="20" y="56" width="70" height="24" rx="12" fill="#ffffff" stroke="${c}" stroke-width="1.5"/>
      <text x="55" y="72" font-family="system-ui, sans-serif" font-size="8" font-weight="600" fill="${c}" text-anchor="middle">Idea A</text>

      <path d="M135 120 C100 120, 90 170, 70 170" stroke="${c}" stroke-width="2.5" fill="none"/>
      <rect x="20" y="158" width="70" height="24" rx="12" fill="#ffffff" stroke="${c}" stroke-width="1.5"/>
      <text x="55" y="174" font-family="system-ui, sans-serif" font-size="8" font-weight="600" fill="${c}" text-anchor="middle">Idea B</text>
    `;
    fs.writeFileSync(path.join(dir, `mindmap_${idx + 1}.svg`), svgWrap(content));
  });
}

function generateConceptmapSvgs() {
  const dir = path.join(BASE_DIR, 'conceptmaps');
  ensureDir(dir);
  const titles = [
    'Redes y Computación',
    'Metodologías Ágiles',
    'Ecosistemas y Biología',
    'Inteligencia Artificial',
    'Mercados Financieros',
    'Sistema Nervioso',
    'Filosofía y Lógica',
    'Estructuras de Datos',
    'Teoría de Comunicación',
    'Mecánica Clásica'
  ];

  titles.forEach((title, idx) => {
    const content = `
      ${generateDotGrid()}
      <rect x="135" y="25" width="130" height="34" rx="6" fill="#0284c7"/>
      <text x="200" y="46" font-family="system-ui, sans-serif" font-size="9" font-weight="700" fill="#ffffff" text-anchor="middle">${title.slice(0, 20)}</text>

      <line x1="170" y1="59" x2="110" y2="120" stroke="#0284c7" stroke-width="1.5"/>
      <rect x="125" y="82" width="40" height="14" rx="3" fill="#ffffff" stroke="#e0f2fe" stroke-width="1"/>
      <text x="145" y="92" font-family="system-ui, sans-serif" font-size="7" font-weight="600" fill="#0369a1" text-anchor="middle">contiene</text>

      <line x1="230" y1="59" x2="290" y2="120" stroke="#0284c7" stroke-width="1.5"/>
      <rect x="245" y="82" width="40" height="14" rx="3" fill="#ffffff" stroke="#e0f2fe" stroke-width="1"/>
      <text x="265" y="92" font-family="system-ui, sans-serif" font-size="7" font-weight="600" fill="#0369a1" text-anchor="middle">aplica en</text>

      <rect x="50" y="120" width="115" height="30" rx="6" fill="#38bdf8"/>
      <text x="107" y="139" font-family="system-ui, sans-serif" font-size="8" font-weight="700" fill="#ffffff" text-anchor="middle">Fundamento A</text>

      <rect x="235" y="120" width="115" height="30" rx="6" fill="#38bdf8"/>
      <text x="292" y="139" font-family="system-ui, sans-serif" font-size="8" font-weight="700" fill="#ffffff" text-anchor="middle">Fundamento B</text>

      <line x1="107" y1="150" x2="107" y2="185" stroke="#38bdf8" stroke-width="1.5"/>
      <rect x="50" y="185" width="115" height="26" rx="4" fill="#e0f2fe" stroke="#38bdf8" stroke-width="1"/>
      <text x="107" y="201" font-family="system-ui, sans-serif" font-size="8" font-weight="600" fill="#0369a1" text-anchor="middle">Subconcepto 1</text>

      <line x1="292" y1="150" x2="292" y2="185" stroke="#38bdf8" stroke-width="1.5"/>
      <rect x="235" y="185" width="115" height="26" rx="4" fill="#e0f2fe" stroke="#38bdf8" stroke-width="1"/>
      <text x="292" y="201" font-family="system-ui, sans-serif" font-size="8" font-weight="600" fill="#0369a1" text-anchor="middle">Subconcepto 2</text>
    `;
    fs.writeFileSync(path.join(dir, `conceptmap_${idx + 1}.svg`), svgWrap(content));
  });
}

function generateFlowchartSvgs() {
  const dir = path.join(BASE_DIR, 'flowcharts');
  ensureDir(dir);
  const titles = [
    'Registro y Login',
    'Checkout de Pagos',
    'Tickets de Soporte',
    'Pipeline CI/CD',
    'Contratación RRHH',
    'Canalización ETL',
    'Aprobación Compras',
    'Algoritmo Búsqueda',
    'Control de Calidad',
    'Devoluciones E-Com'
  ];

  titles.forEach((title, idx) => {
    const content = `
      ${generateDotGrid()}
      <rect x="155" y="20" width="90" height="26" rx="13" fill="#10b981"/>
      <text x="200" y="37" font-family="system-ui, sans-serif" font-size="9" font-weight="700" fill="#ffffff" text-anchor="middle">Inicio</text>

      <line x1="200" y1="46" x2="200" y2="70" stroke="#64748b" stroke-width="2"/>

      <rect x="140" y="70" width="120" height="30" rx="4" fill="#3b82f6"/>
      <text x="200" y="89" font-family="system-ui, sans-serif" font-size="8" font-weight="700" fill="#ffffff" text-anchor="middle">${title.slice(0, 18)}</text>

      <line x1="200" y1="100" x2="200" y2="125" stroke="#64748b" stroke-width="2"/>

      <polygon points="200,125 245,150 200,175 155,150" fill="#f59e0b"/>
      <text x="200" y="153" font-family="system-ui, sans-serif" font-size="8" font-weight="700" fill="#ffffff" text-anchor="middle">¿Válido?</text>

      <line x1="245" y1="150" x2="300" y2="150" stroke="#10b981" stroke-width="2"/>
      <line x1="300" y1="150" x2="300" y2="190" stroke="#10b981" stroke-width="2"/>
      <rect x="255" y="190" width="90" height="26" rx="13" fill="#10b981"/>
      <text x="300" y="207" font-family="system-ui, sans-serif" font-size="8" font-weight="700" fill="#ffffff" text-anchor="middle">Aprobado</text>

      <line x1="155" y1="150" x2="100" y2="150" stroke="#ef4444" stroke-width="2"/>
      <line x1="100" y1="150" x2="100" y2="190" stroke="#ef4444" stroke-width="2"/>
      <rect x="55" y="190" width="90" height="26" rx="13" fill="#ef4444"/>
      <text x="100" y="207" font-family="system-ui, sans-serif" font-size="8" font-weight="700" fill="#ffffff" text-anchor="middle">Rechazado</text>
    `;
    fs.writeFileSync(path.join(dir, `flowchart_${idx + 1}.svg`), svgWrap(content));
  });
}

function generateDocSvgs() {
  const dir = path.join(BASE_DIR, 'docs');
  ensureDir(dir);
  const titles = [
    { title: 'Documento en blanco', color: '#6366f1' },
    { title: 'Informe Ejecutivo', color: '#3b82f6' },
    { title: 'Carta Formal', color: '#0f172a' },
    { title: 'Minuta de Reunión', color: '#059669' },
    { title: 'Currículum Vitae', color: '#ec4899' },
    { title: 'Propuesta Comercial', color: '#8b5cf6' },
    { title: 'Especificación SRS', color: '#0284c7' },
    { title: 'Manual de Políticas', color: '#d97706' },
    { title: 'Contrato de Servicios', color: '#475569' },
    { title: 'Boletín Interno', color: '#10b981' },
  ];

  titles.forEach((t, idx) => {
    const content = `
      <rect x="110" y="15" width="180" height="210" rx="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="1"/>
      <rect x="125" y="30" width="70" height="7" rx="2" fill="${t.color}"/>
      <rect x="125" y="44" width="150" height="3" rx="1" fill="#94a3b8"/>
      <rect x="125" y="52" width="135" height="3" rx="1" fill="#cbd5e1"/>
      <rect x="125" y="60" width="145" height="3" rx="1" fill="#cbd5e1"/>

      <rect x="125" y="76" width="150" height="36" rx="3" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1"/>
      <line x1="125" y1="88" x2="275" y2="88" stroke="#e2e8f0" stroke-width="1"/>
      <rect x="132" y="81" width="40" height="3" rx="1" fill="${t.color}"/>
      <rect x="132" y="95" width="60" height="3" rx="1" fill="#64748b"/>

      <rect x="125" y="125" width="150" height="3" rx="1" fill="#cbd5e1"/>
      <rect x="125" y="133" width="140" height="3" rx="1" fill="#cbd5e1"/>
      <rect x="125" y="141" width="145" height="3" rx="1" fill="#cbd5e1"/>
      <rect x="125" y="149" width="110" height="3" rx="1" fill="#cbd5e1"/>

      <line x1="125" y1="185" x2="195" y2="185" stroke="#94a3b8" stroke-width="1"/>
      <rect x="125" y="192" width="55" height="4" rx="1" fill="${t.color}"/>
    `;
    fs.writeFileSync(path.join(dir, `doc_${idx + 1}.svg`), svgWrap(content));
  });
}

function generatePixelSvgs() {
  const dir = path.join(BASE_DIR, 'pixels');
  ensureDir(dir);
  const titles = [
    { id: 'hero', name: 'Caballero Héroe', iconSvg: `
      <rect x="160" y="60" width="80" height="80" rx="4" fill="#3b82f6"/>
      <rect x="180" y="75" width="40" height="15" fill="#fde047"/>
      <rect x="175" y="140" width="50" height="40" fill="#1e40af"/>
    `},
    { id: 'potions', name: 'Pociones Mágicas', iconSvg: `
      <rect x="130" y="70" width="40" height="70" rx="10" fill="#ec4899"/>
      <rect x="145" y="55" width="10" height="15" fill="#f472b6"/>
      <rect x="230" y="70" width="40" height="70" rx="10" fill="#10b981"/>
      <rect x="245" y="55" width="10" height="15" fill="#34d399"/>
    `},
    { id: 'coins', name: 'Monedas y Gemas', iconSvg: `
      <circle cx="160" cy="110" r="30" fill="#facc15" stroke="#ca8a04" stroke-width="3"/>
      <text x="160" y="118" font-family="monospace" font-size="24" font-weight="900" fill="#713f12" text-anchor="middle">$</text>
      <polygon points="240,80 270,105 240,140 210,105" fill="#06b6d4" stroke="#0891b2" stroke-width="2"/>
    `},
    { id: 'weapons', name: 'Espadas Legendarias', iconSvg: `
      <line x1="150" y1="160" x2="250" y2="60" stroke="#94a3b8" stroke-width="8" stroke-linecap="round"/>
      <line x1="175" y1="155" x2="195" y2="135" stroke="#f59e0b" stroke-width="12" stroke-linecap="round"/>
      <circle cx="150" cy="160" r="6" fill="#d97706"/>
    `},
    { id: 'creature', name: 'Monstruito Slime', iconSvg: `
      <ellipse cx="200" cy="130" rx="55" ry="40" fill="#22c55e"/>
      <circle cx="180" cy="120" r="8" fill="#ffffff"/>
      <circle cx="182" cy="120" r="4" fill="#0f172a"/>
      <circle cx="220" cy="120" r="8" fill="#ffffff"/>
      <circle cx="222" cy="120" r="4" fill="#0f172a"/>
    `},
    { id: 'tiles', name: 'Tiles de Mazmorra', iconSvg: `
      <rect x="130" y="60" width="60" height="60" fill="#94a3b8" stroke="#475569" stroke-width="2"/>
      <rect x="210" y="60" width="60" height="60" fill="#64748b" stroke="#334155" stroke-width="2"/>
      <rect x="170" y="130" width="60" height="60" fill="#78716c" stroke="#44403c" stroke-width="2"/>
    `},
    { id: 'plants', name: 'Árboles Pixel', iconSvg: `
      <rect x="190" y="120" width="20" height="50" fill="#78350f"/>
      <circle cx="200" cy="95" r="45" fill="#16a34a"/>
      <circle cx="180" cy="85" r="25" fill="#22c55e"/>
    `},
    { id: 'hearts', name: 'Corazones de Vida', iconSvg: `
      <path d="M160 90 C160 70, 130 70, 130 95 C130 120, 160 140, 160 140 C160 140, 190 120, 190 95 C190 70, 160 70, 160 90 Z" fill="#ef4444"/>
      <path d="M240 90 C240 70, 210 70, 210 95 C210 120, 240 140, 240 140 C240 140, 270 120, 270 95 C270 70, 240 70, 240 90 Z" fill="#f87171"/>
    `},
    { id: 'vehicle', name: 'Nave Arcade', iconSvg: `
      <polygon points="200,60 235,140 200,125 165,140" fill="#6366f1"/>
      <polygon points="200,75 220,125 200,118 180,125" fill="#38bdf8"/>
    `},
    { id: 'ui', name: 'Iconos y Glifos', iconSvg: `
      <rect x="140" y="75" width="40" height="40" rx="6" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="2"/>
      <circle cx="160" cy="95" r="8" fill="#6366f1"/>
      <rect x="220" y="75" width="40" height="40" rx="6" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="2"/>
      <rect x="232" y="87" width="16" height="16" rx="2" fill="#10b981"/>
    `}
  ];

  titles.forEach((t, idx) => {
    let checker = '';
    for (let x = 60; x < 340; x += 16) {
      for (let y = 30; y < 210; y += 16) {
        const isAlt = ((x / 16) + (y / 16)) % 2 === 0;
        checker += `<rect x="${x}" y="${y}" width="16" height="16" fill="${isAlt ? '#f8fafc' : '#ffffff'}"/>`;
      }
    }
    const content = `
      <rect x="60" y="30" width="280" height="180" rx="4" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5"/>
      ${checker}
      ${t.iconSvg}
    `;
    fs.writeFileSync(path.join(dir, `pixel_${idx + 1}.svg`), svgWrap(content));
  });
}

function main() {
  generateBoardSvgs();
  generateMindmapSvgs();
  generateConceptmapSvgs();
  generateFlowchartSvgs();
  generateDocSvgs();
  generatePixelSvgs();
  process.stdout.write('60 templates generated successfully.\\n');
}

main();
