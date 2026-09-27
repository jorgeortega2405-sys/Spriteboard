import { CHART_CATALOG } from '../board/board-charts-panel.component.js';
import { ChartType } from '../board/board.types.js';

export function generateChartSvg(chartType: ChartType, customTitle?: string): string {
  const item = CHART_CATALOG.find((c) => c.type === chartType);
  const title = customTitle || item?.name || 'Gráfica';

  let chartVisual = '';

  switch (chartType) {
    case 'bar-horizontal':
    case 'bar-categorical-horizontal':
    case 'bar-grouped-horizontal':
      chartVisual = `
        <text x="50" y="115" fill="#94a3b8" font-size="13" font-family="Inter, system-ui, sans-serif">Categoría A</text>
        <rect x="140" y="100" width="340" height="20" rx="4" fill="#3b82f6"/>
        <text x="490" y="115" fill="#f8fafc" font-size="12" font-family="Inter, system-ui, sans-serif">85%</text>

        <text x="50" y="165" fill="#94a3b8" font-size="13" font-family="Inter, system-ui, sans-serif">Categoría B</text>
        <rect x="140" y="150" width="280" height="20" rx="4" fill="#a855f7"/>
        <text x="430" y="165" fill="#f8fafc" font-size="12" font-family="Inter, system-ui, sans-serif">70%</text>

        <text x="50" y="215" fill="#94a3b8" font-size="13" font-family="Inter, system-ui, sans-serif">Categoría C</text>
        <rect x="140" y="200" width="380" height="20" rx="4" fill="#10b981"/>
        <text x="530" y="215" fill="#f8fafc" font-size="12" font-family="Inter, system-ui, sans-serif">95%</text>

        <text x="50" y="265" fill="#94a3b8" font-size="13" font-family="Inter, system-ui, sans-serif">Categoría D</text>
        <rect x="140" y="250" width="220" height="20" rx="4" fill="#f59e0b"/>
        <text x="370" y="265" fill="#f8fafc" font-size="12" font-family="Inter, system-ui, sans-serif">55%</text>
      `;
      break;

    case 'pie':
    case 'donut':
      chartVisual = `
        <circle cx="210" cy="190" r="85" fill="none" stroke="#3b82f6" stroke-width="44" stroke-dasharray="190 534"/>
        <circle cx="210" cy="190" r="85" fill="none" stroke="#a855f7" stroke-width="44" stroke-dasharray="140 534" stroke-dashoffset="-190"/>
        <circle cx="210" cy="190" r="85" fill="none" stroke="#10b981" stroke-width="44" stroke-dasharray="110 534" stroke-dashoffset="-330"/>
        <circle cx="210" cy="190" r="85" fill="none" stroke="#f59e0b" stroke-width="44" stroke-dasharray="94 534" stroke-dashoffset="-440"/>
        <text x="210" y="196" fill="#f8fafc" font-size="18" font-weight="700" text-anchor="middle" font-family="Inter, system-ui, sans-serif">100%</text>

        <g transform="translate(360, 130)">
          <rect x="0" y="0" width="12" height="12" rx="3" fill="#3b82f6"/>
          <text x="20" y="11" fill="#cbd5e1" font-size="13" font-family="Inter, system-ui, sans-serif">Producto A (36%)</text>

          <rect x="0" y="30" width="12" height="12" rx="3" fill="#a855f7"/>
          <text x="20" y="41" fill="#cbd5e1" font-size="13" font-family="Inter, system-ui, sans-serif">Producto B (26%)</text>

          <rect x="0" y="60" width="12" height="12" rx="3" fill="#10b981"/>
          <text x="20" y="71" fill="#cbd5e1" font-size="13" font-family="Inter, system-ui, sans-serif">Producto C (21%)</text>

          <rect x="0" y="90" width="12" height="12" rx="3" fill="#f59e0b"/>
          <text x="20" y="101" fill="#cbd5e1" font-size="13" font-family="Inter, system-ui, sans-serif">Producto D (17%)</text>
        </g>
      `;
      break;

    case 'line':
    case 'area':
      chartVisual = `
        <line x1="60" y1="260" x2="520" y2="260" stroke="#334155" stroke-width="1.5"/>
        <line x1="60" y1="200" x2="520" y2="200" stroke="#334155" stroke-dasharray="4 4" stroke-width="1"/>
        <line x1="60" y1="140" x2="520" y2="140" stroke="#334155" stroke-dasharray="4 4" stroke-width="1"/>

        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.4"/>
            <stop offset="100%" stop-color="#3b82f6" stop-opacity="0.0"/>
          </linearGradient>
        </defs>

        <path d="M 80 230 Q 140 130 200 170 T 320 110 T 440 150 T 500 90 L 500 260 L 80 260 Z" fill="url(#areaGrad)"/>
        <path d="M 80 230 Q 140 130 200 170 T 320 110 T 440 150 T 500 90" fill="none" stroke="#3b82f6" stroke-width="3.5" stroke-linecap="round"/>

        <circle cx="80" cy="230" r="5" fill="#3b82f6" stroke="#0f172a" stroke-width="2"/>
        <circle cx="200" cy="170" r="5" fill="#3b82f6" stroke="#0f172a" stroke-width="2"/>
        <circle cx="320" cy="110" r="5" fill="#3b82f6" stroke="#0f172a" stroke-width="2"/>
        <circle cx="440" cy="150" r="5" fill="#3b82f6" stroke="#0f172a" stroke-width="2"/>
        <circle cx="500" cy="90" r="5" fill="#3b82f6" stroke="#0f172a" stroke-width="2"/>

        <text x="80" y="280" fill="#94a3b8" font-size="12" text-anchor="middle" font-family="Inter, system-ui, sans-serif">Ene</text>
        <text x="200" y="280" fill="#94a3b8" font-size="12" text-anchor="middle" font-family="Inter, system-ui, sans-serif">Feb</text>
        <text x="320" y="280" fill="#94a3b8" font-size="12" text-anchor="middle" font-family="Inter, system-ui, sans-serif">Mar</text>
        <text x="440" y="280" fill="#94a3b8" font-size="12" text-anchor="middle" font-family="Inter, system-ui, sans-serif">Abr</text>
        <text x="500" y="280" fill="#94a3b8" font-size="12" text-anchor="middle" font-family="Inter, system-ui, sans-serif">May</text>
      `;
      break;

    default:
      chartVisual = `
        <line x1="60" y1="260" x2="520" y2="260" stroke="#334155" stroke-width="1.5"/>
        <line x1="60" y1="200" x2="520" y2="200" stroke="#334155" stroke-dasharray="4 4" stroke-width="1"/>
        <line x1="60" y1="140" x2="520" y2="140" stroke="#334155" stroke-dasharray="4 4" stroke-width="1"/>

        <rect x="90" y="160" width="48" height="100" rx="6" fill="#3b82f6"/>
        <rect x="180" y="110" width="48" height="150" rx="6" fill="#a855f7"/>
        <rect x="270" y="80" width="48" height="180" rx="6" fill="#10b981"/>
        <rect x="360" y="140" width="48" height="120" rx="6" fill="#f59e0b"/>
        <rect x="450" y="95" width="48" height="165" rx="6" fill="#06b6d4"/>

        <text x="114" y="280" fill="#94a3b8" font-size="12" text-anchor="middle" font-family="Inter, system-ui, sans-serif">Q1</text>
        <text x="204" y="280" fill="#94a3b8" font-size="12" text-anchor="middle" font-family="Inter, system-ui, sans-serif">Q2</text>
        <text x="294" y="280" fill="#94a3b8" font-size="12" text-anchor="middle" font-family="Inter, system-ui, sans-serif">Q3</text>
        <text x="384" y="280" fill="#94a3b8" font-size="12" text-anchor="middle" font-family="Inter, system-ui, sans-serif">Q4</text>
        <text x="474" y="280" fill="#94a3b8" font-size="12" text-anchor="middle" font-family="Inter, system-ui, sans-serif">Total</text>
      `;
      break;
  }

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 580 340" width="580" height="340">
      <rect width="580" height="340" rx="16" fill="#0f172a" fill-opacity="0.92" stroke="#334155" stroke-width="2"/>
      <circle cx="28" cy="36" r="6" fill="#ef4444"/>
      <circle cx="44" cy="36" r="6" fill="#f59e0b"/>
      <circle cx="60" cy="36" r="6" fill="#10b981"/>
      <text x="80" y="42" fill="#f8fafc" font-size="16" font-weight="700" font-family="Inter, system-ui, sans-serif">${title}</text>
      ${chartVisual}
    </svg>
  `.trim();
}
