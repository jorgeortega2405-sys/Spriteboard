export interface ElementCategoryTile {
  category: string;
  dataRef: string;
  html: string;
  label: string;
}

export const ELEMENT_CATEGORY_TILES: ElementCategoryTile[] = [
  {
    category: 'stickies',
    dataRef: 'btn-category-stickies',
    html: `
      <div class="element-category-card__stack" data-ref="category-stack-stickies">
        <div class="element-category-card__layer element-category-card__layer--back element-category-card__layer--stickies-back">
          <svg class="element-category-card__svg" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="6" y="6" width="60" height="60" rx="16" fill="url(#cva-grad-sticky-back)" />
            <path d="M46 50L66 50L66 30Z" fill="#047857" opacity="0.35" />
            <path d="M46 50L66 30L46 30Z" fill="#34d399" />
            <defs>
              <linearGradient id="cva-grad-sticky-back" x1="6" y1="6" x2="66" y2="66" gradientUnits="userSpaceOnUse">
                <stop stop-color="#34d399" />
                <stop offset="0.5" stop-color="#10b981" />
                <stop offset="1" stop-color="#059669" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div class="element-category-card__layer element-category-card__layer--front element-category-card__layer--stickies-front">
          <svg class="element-category-card__svg" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="6" y="6" width="60" height="60" rx="16" fill="url(#cva-grad-sticky-front)" />
            <rect x="6.5" y="6.5" width="59" height="59" rx="15.5" stroke="rgba(255,255,255,0.4)" stroke-width="1" />
            <path d="M18 18H54C55.1 18 56 18.9 56 20V42L44 54H20C18.9 54 18 53.1 18 52V18Z" fill="#FFFBEB" />
            <rect x="23" y="24" width="22" height="3" rx="1.5" fill="#FBBF24" />
            <rect x="23" y="30" width="26" height="3" rx="1.5" fill="#FDE68A" />
            <rect x="23" y="36" width="16" height="3" rx="1.5" fill="#FDE68A" />
            <path d="M44 42L56 42L44 54Z" fill="#B45309" opacity="0.25" />
            <path d="M44 42L56 42C54 46 50 52 44 54L44 42Z" fill="url(#cva-grad-sticky-fold)" />
            <defs>
              <linearGradient id="cva-grad-sticky-front" x1="6" y1="6" x2="66" y2="66" gradientUnits="userSpaceOnUse">
                <stop stop-color="#FEF08A" />
                <stop offset="0.3" stop-color="#FDE047" />
                <stop offset="1" stop-color="#F59E0B" />
              </linearGradient>
              <linearGradient id="cva-grad-sticky-fold" x1="44" y1="42" x2="56" y2="54" gradientUnits="userSpaceOnUse">
                <stop stop-color="#FB7185" />
                <stop offset="1" stop-color="#E11D48" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>
      <span class="element-category-card__label">Notas adhesivas</span>
    `,
    label: 'Notas adhesivas',
  },
  {
    category: 'shapes',
    dataRef: 'btn-category-shapes',
    html: `
      <div class="element-category-card__stack" data-ref="category-stack-shapes">
        <div class="element-category-card__layer element-category-card__layer--back element-category-card__layer--shapes-back">
          <svg class="element-category-card__svg" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="6" y="6" width="60" height="60" rx="16" fill="url(#cva-grad-shapes-back)" />
            <path d="M48 14L50.5 19.5L56 20.5L52 24.5L53 30L48 27L43 30L44 24.5L40 20.5L45.5 19.5Z" fill="#F97316" />
            <line x1="36" y1="46" x2="58" y2="46" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" />
            <circle cx="58" cy="46" r="4.5" fill="#FFFFFF" />
            <defs>
              <linearGradient id="cva-grad-shapes-back" x1="6" y1="6" x2="66" y2="66" gradientUnits="userSpaceOnUse">
                <stop stop-color="#2DD4BF" />
                <stop offset="0.5" stop-color="#06B6D4" />
                <stop offset="1" stop-color="#0284C7" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div class="element-category-card__layer element-category-card__layer--front element-category-card__layer--shapes-front">
          <svg class="element-category-card__svg" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="6" y="6" width="60" height="60" rx="16" fill="url(#cva-grad-shapes-front)" />
            <rect x="6.5" y="6.5" width="59" height="59" rx="15.5" stroke="rgba(255,255,255,0.4)" stroke-width="1" />
            <path d="M26 20L35 25L32 36H18L15 25L26 20Z" fill="rgba(255,255,255,0.78)" />
            <path d="M48 24C49 22.5 51 22.5 52 24L59 36C60 37.5 59 39.5 57 39.5H43C41 39.5 40 37.5 41 36L48 24Z" fill="url(#cva-grad-pink-triangle)" />
            <g fill="#0F172A" opacity="0.85">
              <circle cx="20" cy="48" r="2.2" />
              <circle cx="26" cy="48" r="2.2" />
              <circle cx="32" cy="48" r="2.2" />
              <circle cx="38" cy="48" r="2.2" />
              <circle cx="44" cy="48" r="2.2" />
              <circle cx="50" cy="48" r="2.2" />
            </g>
            <defs>
              <linearGradient id="cva-grad-shapes-front" x1="6" y1="6" x2="66" y2="66" gradientUnits="userSpaceOnUse">
                <stop stop-color="#22D3EE" />
                <stop offset="0.4" stop-color="#06B6D4" />
                <stop offset="1" stop-color="#0284C7" />
              </linearGradient>
              <linearGradient id="cva-grad-pink-triangle" x1="41" y1="23" x2="59" y2="39" gradientUnits="userSpaceOnUse">
                <stop stop-color="#F472B6" />
                <stop offset="1" stop-color="#EC4899" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>
      <span class="element-category-card__label">Formas</span>
    `,
    label: 'Formas',
  },
  {
    category: 'stickers',
    dataRef: 'btn-category-stickers',
    html: `
      <div class="element-category-card__stack" data-ref="category-stack-stickers">
        <div class="element-category-card__layer element-category-card__layer--back element-category-card__layer--stickers-back">
          <svg class="element-category-card__svg" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="6" y="6" width="60" height="60" rx="16" fill="url(#cva-grad-stickers-back)" />
            <path d="M48 14L49.8 19.2L55 21L49.8 22.8L48 28L46.2 22.8L41 21L46.2 19.2Z" fill="#FFFFFF" />
            <path d="M56 32L57.2 35.5L60.5 36.5L57.2 37.5L56 41L54.8 37.5L51.5 36.5L54.8 35.5Z" fill="#FEF08A" />
            <defs>
              <linearGradient id="cva-grad-stickers-back" x1="6" y1="6" x2="66" y2="66" gradientUnits="userSpaceOnUse">
                <stop stop-color="#FDE047" />
                <stop offset="0.5" stop-color="#FBBF24" />
                <stop offset="1" stop-color="#F59E0B" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div class="element-category-card__layer element-category-card__layer--front element-category-card__layer--stickers-front">
          <svg class="element-category-card__svg" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="6" y="6" width="60" height="60" rx="16" fill="url(#cva-grad-stickers-front)" />
            <rect x="6.5" y="6.5" width="59" height="59" rx="15.5" stroke="rgba(255,255,255,0.4)" stroke-width="1" />
            <path d="M22 47C26 43 32 45 36 49C29 53 23 51 22 47Z" fill="#10B981" />
            <path d="M50 47C46 43 40 45 36 49C43 53 49 51 50 47Z" fill="#10B981" />
            <circle cx="36" cy="33" r="14" fill="#FBBF24" />
            <path d="M36 17L38.5 22.5L44.5 21L43.5 27L49 28.5L45.5 33L49 37.5L43.5 39L44.5 45L38.5 43.5L36 49L33.5 43.5L27.5 45L28.5 39L23 37.5L26.5 33L23 28.5L28.5 27L27.5 21L33.5 22.5Z" fill="url(#cva-grad-sunflower-petals)" />
            <circle cx="36" cy="33" r="7.5" fill="url(#cva-grad-sunflower-center)" />
            <circle cx="36" cy="33" r="5.5" fill="#78350F" opacity="0.6" />
            <defs>
              <linearGradient id="cva-grad-stickers-front" x1="6" y1="6" x2="66" y2="66" gradientUnits="userSpaceOnUse">
                <stop stop-color="#FB923C" />
                <stop offset="0.4" stop-color="#F97316" />
                <stop offset="1" stop-color="#EF4444" />
              </linearGradient>
              <linearGradient id="cva-grad-sunflower-petals" x1="23" y1="17" x2="49" y2="49" gradientUnits="userSpaceOnUse">
                <stop stop-color="#FEF08A" />
                <stop offset="0.5" stop-color="#FDE047" />
                <stop offset="1" stop-color="#F59E0B" />
              </linearGradient>
              <linearGradient id="cva-grad-sunflower-center" x1="30" y1="27" x2="42" y2="39" gradientUnits="userSpaceOnUse">
                <stop stop-color="#92400E" />
                <stop offset="1" stop-color="#451A03" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>
      <span class="element-category-card__label">Figuras</span>
    `,
    label: 'Figuras',
  },
  {
    category: 'diagrams',
    dataRef: 'btn-category-diagrams',
    html: `
      <div class="element-category-card__stack" data-ref="category-stack-diagrams">
        <div class="element-category-card__layer element-category-card__layer--back element-category-card__layer--diagrams-back">
          <svg class="element-category-card__svg" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="6" y="6" width="60" height="60" rx="16" fill="url(#cva-grad-diagrams-back)" />
            <path d="M42 20H52C54 20 55 21 55 23V32" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" />
            <rect x="48" y="32" width="14" height="10" rx="4" fill="#FFFFFF" />
            <defs>
              <linearGradient id="cva-grad-diagrams-back" x1="6" y1="6" x2="66" y2="66" gradientUnits="userSpaceOnUse">
                <stop stop-color="#E879F9" />
                <stop offset="0.5" stop-color="#C084FC" />
                <stop offset="1" stop-color="#9333EA" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div class="element-category-card__layer element-category-card__layer--front element-category-card__layer--diagrams-front">
          <svg class="element-category-card__svg" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="6" y="6" width="60" height="60" rx="16" fill="url(#cva-grad-diagrams-front)" />
            <rect x="6.5" y="6.5" width="59" height="59" rx="15.5" stroke="rgba(255,255,255,0.4)" stroke-width="1" />
            <path d="M36 26V35M36 35H25V42M36 35H47V42" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
            <rect x="27" y="17" width="18" height="11" rx="5.5" fill="#FFFFFF" />
            <rect x="30" y="21" width="12" height="3" rx="1.5" fill="#4F46E5" />
            <rect x="17" y="42" width="16" height="12" rx="4" fill="#C7D2FE" />
            <rect x="20" y="46" width="10" height="2.5" rx="1.2" fill="#3730A3" />
            <rect x="39" y="42" width="16" height="12" rx="4" fill="#A5F3FC" />
            <rect x="42" y="46" width="10" height="2.5" rx="1.2" fill="#0E7490" />
            <defs>
              <linearGradient id="cva-grad-diagrams-front" x1="6" y1="6" x2="66" y2="66" gradientUnits="userSpaceOnUse">
                <stop stop-color="#818CF8" />
                <stop offset="0.4" stop-color="#6366F1" />
                <stop offset="1" stop-color="#4F46E5" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>
      <span class="element-category-card__label">Diagramas</span>
    `,
    label: 'Diagramas',
  },
  {
    category: 'tables',
    dataRef: 'btn-category-tables',
    html: `
      <div class="element-category-card__stack" data-ref="category-stack-tables">
        <div class="element-category-card__layer element-category-card__layer--back">
          <svg class="element-category-card__svg" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="6" y="6" width="60" height="60" rx="16" fill="url(#cva-grad-tables-back)" />
            <rect x="18" y="18" width="36" height="36" rx="4" stroke="#ffffff" stroke-width="2" stroke-opacity="0.5" />
            <defs>
              <linearGradient id="cva-grad-tables-back" x1="6" y1="6" x2="66" y2="66" gradientUnits="userSpaceOnUse">
                <stop stop-color="#0284c7" />
                <stop offset="1" stop-color="#0369a1" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div class="element-category-card__layer element-category-card__layer--front">
          <svg class="element-category-card__svg" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="6" y="6" width="60" height="60" rx="16" fill="url(#cva-grad-tables-front)" />
            <rect x="6.5" y="6.5" width="59" height="59" rx="15.5" stroke="rgba(255,255,255,0.4)" stroke-width="1" />
            <rect x="16" y="16" width="40" height="40" rx="6" fill="#ffffff" fill-opacity="0.9" />
            <rect x="16" y="16" width="40" height="12" rx="6" fill="#38bdf8" />
            <line x1="16" y1="28" x2="56" y2="28" stroke="#0284c7" stroke-width="1" />
            <line x1="16" y1="42" x2="56" y2="42" stroke="#e2e8f0" stroke-width="1.5" />
            <line x1="29" y1="16" x2="29" y2="56" stroke="#e2e8f0" stroke-width="1.5" />
            <line x1="43" y1="16" x2="43" y2="56" stroke="#e2e8f0" stroke-width="1.5" />
            <defs>
              <linearGradient id="cva-grad-tables-front" x1="6" y1="6" x2="66" y2="66" gradientUnits="userSpaceOnUse">
                <stop stop-color="#38bdf8" />
                <stop offset="0.5" stop-color="#0284c7" />
                <stop offset="1" stop-color="#0369a1" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>
      <span class="element-category-card__label">Tablas</span>
    `,
    label: 'Tablas',
  },
  {
    category: 'charts',
    dataRef: 'btn-category-charts',
    html: `
      <div class="element-category-card__stack" data-ref="category-stack-charts">
        <div class="element-category-card__layer element-category-card__layer--back">
          <svg class="element-category-card__svg" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="6" y="6" width="60" height="60" rx="16" fill="url(#cva-grad-charts-back)" />
            <path d="M18 48L32 34L44 42L56 22" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity="0.4" />
            <defs>
              <linearGradient id="cva-grad-charts-back" x1="6" y1="6" x2="66" y2="66" gradientUnits="userSpaceOnUse">
                <stop stop-color="#8b5cf6" />
                <stop offset="1" stop-color="#6d28d9" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div class="element-category-card__layer element-category-card__layer--front">
          <svg class="element-category-card__svg" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="6" y="6" width="60" height="60" rx="16" fill="url(#cva-grad-charts-front)" />
            <rect x="6.5" y="6.5" width="59" height="59" rx="15.5" stroke="rgba(255,255,255,0.4)" stroke-width="1" />
            <rect x="18" y="36" width="7" height="18" rx="3.5" fill="#ffffff" />
            <rect x="29" y="24" width="7" height="30" rx="3.5" fill="#facc15" />
            <rect x="40" y="30" width="7" height="24" rx="3.5" fill="#38bdf8" />
            <rect x="51" y="18" width="7" height="36" rx="3.5" fill="#4ade80" />
            <path d="M18 32L29 20L40 26L54 14" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
            <circle cx="54" cy="14" r="3" fill="#ffffff" />
            <defs>
              <linearGradient id="cva-grad-charts-front" x1="6" y1="6" x2="66" y2="66" gradientUnits="userSpaceOnUse">
                <stop stop-color="#a855f7" />
                <stop offset="0.5" stop-color="#8b5cf6" />
                <stop offset="1" stop-color="#7c3aed" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>
      <span class="element-category-card__label">Gráficas</span>
    `,
    label: 'Gráficas',
  },
  {
    category: 'frames',
    dataRef: 'btn-category-frames',
    html: `
      <div class="element-category-card__stack" data-ref="category-stack-frames">
        <div class="element-category-card__layer element-category-card__layer--back">
          <svg class="element-category-card__svg" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="6" y="6" width="60" height="60" rx="16" fill="url(#cva-grad-frames-back)" />
            <rect x="18" y="18" width="36" height="36" rx="8" stroke="#ffffff" stroke-width="2" stroke-dasharray="4 4" opacity="0.4" />
            <defs>
              <linearGradient id="cva-grad-frames-back" x1="6" y1="6" x2="66" y2="66" gradientUnits="userSpaceOnUse">
                <stop stop-color="#0284c7" />
                <stop offset="1" stop-color="#0369a1" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div class="element-category-card__layer element-category-card__layer--front">
          <svg class="element-category-card__svg" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="6" y="6" width="60" height="60" rx="16" fill="url(#cva-grad-frames-front)" />
            <rect x="6.5" y="6.5" width="59" height="59" rx="15.5" stroke="rgba(255,255,255,0.4)" stroke-width="1" />
            <rect x="16" y="16" width="40" height="40" rx="8" fill="#ffffff" fill-opacity="0.9" />
            <rect x="20" y="20" width="32" height="32" rx="4" fill="#38bdf8" />
            <circle cx="28" cy="28" r="3" fill="#fef08a" />
            <path d="M20 44 Q28 34 36 38 Q44 42 52 32 L52 52 L20 52 Z" fill="#679c16" />
            <defs>
              <linearGradient id="cva-grad-frames-front" x1="6" y1="6" x2="66" y2="66" gradientUnits="userSpaceOnUse">
                <stop stop-color="#38bdf8" />
                <stop offset="0.5" stop-color="#0284c7" />
                <stop offset="1" stop-color="#0369a1" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>
      <span class="element-category-card__label">Marcos</span>
    `,
    label: 'Marcos',
  },
  {
    category: 'grids',
    dataRef: 'btn-category-grids',
    html: `
      <div class="element-category-card__stack" data-ref="category-stack-grids">
        <div class="element-category-card__layer element-category-card__layer--back">
          <svg class="element-category-card__svg" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="6" y="6" width="60" height="60" rx="16" fill="url(#cva-grad-grids-back)" />
            <rect x="18" y="18" width="16" height="36" rx="4" fill="#ffffff" opacity="0.25" />
            <rect x="38" y="18" width="16" height="36" rx="4" fill="#ffffff" opacity="0.25" />
            <defs>
              <linearGradient id="cva-grad-grids-back" x1="6" y1="6" x2="66" y2="66" gradientUnits="userSpaceOnUse">
                <stop stop-color="#6366f1" />
                <stop offset="1" stop-color="#4338ca" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div class="element-category-card__layer element-category-card__layer--front">
          <svg class="element-category-card__svg" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="6" y="6" width="60" height="60" rx="16" fill="url(#cva-grad-grids-front)" />
            <rect x="6.5" y="6.5" width="59" height="59" rx="15.5" stroke="rgba(255,255,255,0.4)" stroke-width="1" />
            <rect x="16" y="16" width="18" height="18" rx="4" fill="#ffffff" fill-opacity="0.9" />
            <rect x="38" y="16" width="18" height="18" rx="4" fill="#c7d2fe" />
            <rect x="16" y="38" width="18" height="18" rx="4" fill="#a5b4fc" />
            <rect x="38" y="38" width="18" height="18" rx="4" fill="#ffffff" fill-opacity="0.9" />
            <defs>
              <linearGradient id="cva-grad-grids-front" x1="6" y1="6" x2="66" y2="66" gradientUnits="userSpaceOnUse">
                <stop stop-color="#818cf8" />
                <stop offset="0.5" stop-color="#6366f1" />
                <stop offset="1" stop-color="#4f46e5" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>
      <span class="element-category-card__label">Cuadrícula</span>
    `,
    label: 'Cuadrícula',
  },
  {
    category: 'mockups',
    dataRef: 'btn-category-mockups',
    html: `
      <div class="element-category-card__stack" data-ref="category-stack-mockups">
        <div class="element-category-card__layer element-category-card__layer--back">
          <svg class="element-category-card__svg" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="6" y="6" width="60" height="60" rx="16" fill="url(#cva-grad-mockups-back)" />
            <rect x="16" y="24" width="40" height="26" rx="4" fill="#ffffff" opacity="0.3" />
            <defs>
              <linearGradient id="cva-grad-mockups-back" x1="6" y1="6" x2="66" y2="66" gradientUnits="userSpaceOnUse">
                <stop stop-color="#ec4899" />
                <stop offset="1" stop-color="#be185d" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div class="element-category-card__layer element-category-card__layer--front">
          <svg class="element-category-card__svg" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="6" y="6" width="60" height="60" rx="16" fill="url(#cva-grad-mockups-front)" />
            <rect x="6.5" y="6.5" width="59" height="59" rx="15.5" stroke="rgba(255,255,255,0.4)" stroke-width="1" />
            <rect x="15" y="22" width="34" height="22" rx="3" fill="#ffffff" fill-opacity="0.85" />
            <rect x="18" y="25" width="28" height="16" rx="1" fill="#38bdf8" />
            <path d="M12 44H52C53.1 44 54 44.9 54 46V47H10V46C10 44.9 10.9 44 12 44Z" fill="#e2e8f0" />
            <rect x="42" y="26" width="16" height="28" rx="4" fill="#1e293b" />
            <rect x="43.5" y="28" width="13" height="24" rx="2.5" fill="#fb7185" />
            <circle cx="50" cy="50" r="1" fill="#ffffff" />
            <defs>
              <linearGradient id="cva-grad-mockups-front" x1="6" y1="6" x2="66" y2="66" gradientUnits="userSpaceOnUse">
                <stop stop-color="#f43f5e" />
                <stop offset="0.5" stop-color="#e11d48" />
                <stop offset="1" stop-color="#be123c" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>
      <span class="element-category-card__label">Mockups</span>
    `,
    label: 'Mockups',
  },
  {
    category: '3d',
    dataRef: 'btn-category-3d',
    html: `
      <div class="element-category-card__stack" data-ref="category-stack-3d">
        <div class="element-category-card__layer element-category-card__layer--back">
          <svg class="element-category-card__svg" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="6" y="6" width="60" height="60" rx="16" fill="url(#cva-grad-3d-back)" />
            <circle cx="36" cy="36" r="18" stroke="#ffffff" stroke-width="2" stroke-dasharray="4 4" opacity="0.35" />
            <defs>
              <linearGradient id="cva-grad-3d-back" x1="6" y1="6" x2="66" y2="66" gradientUnits="userSpaceOnUse">
                <stop stop-color="#14b8a6" />
                <stop offset="1" stop-color="#0f766e" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div class="element-category-card__layer element-category-card__layer--front">
          <svg class="element-category-card__svg" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="6" y="6" width="60" height="60" rx="16" fill="url(#cva-grad-3d-front)" />
            <rect x="6.5" y="6.5" width="59" height="59" rx="15.5" stroke="rgba(255,255,255,0.4)" stroke-width="1" />
            <g transform="translate(36, 36)">
              <path d="M0 -18L16 -9L0 0L-16 -9Z" fill="#a7f3d0" />
              <path d="M-16 -9L0 0V18L-16 9Z" fill="#34d399" />
              <path d="M0 0L16 -9V9L0 18Z" fill="#059669" />
            </g>
            <defs>
              <linearGradient id="cva-grad-3d-front" x1="6" y1="6" x2="66" y2="66" gradientUnits="userSpaceOnUse">
                <stop stop-color="#10b981" />
                <stop offset="0.5" stop-color="#059669" />
                <stop offset="1" stop-color="#047857" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>
      <span class="element-category-card__label">Elementos 3D</span>
    `,
    label: 'Elementos 3D',
  },
  {
    category: 'pixel-grid',
    dataRef: 'btn-category-pixel-grid',
    html: `
      <div class="element-category-card__stack" data-ref="category-stack-pixel-grid">
        <div class="element-category-card__layer element-category-card__layer--back">
          <svg class="element-category-card__svg" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="6" y="6" width="60" height="60" rx="16" fill="url(#cva-grad-pixel-back)" />
            <defs>
              <linearGradient id="cva-grad-pixel-back" x1="6" y1="6" x2="66" y2="66" gradientUnits="userSpaceOnUse">
                <stop stop-color="#8b5cf6" />
                <stop offset="1" stop-color="#6d28d9" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div class="element-category-card__layer element-category-card__layer--front">
          <svg class="element-category-card__svg" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="6" y="6" width="60" height="60" rx="16" fill="url(#cva-grad-pixel-front)" />
            <rect x="6.5" y="6.5" width="59" height="59" rx="15.5" stroke="rgba(255,255,255,0.4)" stroke-width="1" />
            <rect x="18" y="18" width="8" height="8" rx="1" fill="#ffffff" />
            <rect x="28" y="18" width="8" height="8" rx="1" fill="#c4b5fd" />
            <rect x="38" y="18" width="8" height="8" rx="1" fill="#ffffff" />
            <rect x="48" y="18" width="8" height="8" rx="1" fill="#a78bfa" />
            <rect x="18" y="28" width="8" height="8" rx="1" fill="#c4b5fd" />
            <rect x="28" y="28" width="8" height="8" rx="1" fill="#7c3aed" />
            <rect x="38" y="28" width="8" height="8" rx="1" fill="#7c3aed" />
            <rect x="48" y="28" width="8" height="8" rx="1" fill="#c4b5fd" />
            <rect x="18" y="38" width="8" height="8" rx="1" fill="#ffffff" />
            <rect x="28" y="38" width="8" height="8" rx="1" fill="#7c3aed" />
            <rect x="38" y="38" width="8" height="8" rx="1" fill="#7c3aed" />
            <rect x="48" y="38" width="8" height="8" rx="1" fill="#ffffff" />
            <rect x="18" y="48" width="8" height="8" rx="1" fill="#a78bfa" />
            <rect x="28" y="48" width="8" height="8" rx="1" fill="#c4b5fd" />
            <rect x="38" y="48" width="8" height="8" rx="1" fill="#ffffff" />
            <rect x="48" y="48" width="8" height="8" rx="1" fill="#c4b5fd" />
            <defs>
              <linearGradient id="cva-grad-pixel-front" x1="6" y1="6" x2="66" y2="66" gradientUnits="userSpaceOnUse">
                <stop stop-color="#a855f7" />
                <stop offset="0.5" stop-color="#8b5cf6" />
                <stop offset="1" stop-color="#6d28d9" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>
      <span class="element-category-card__label">Píxel Art</span>
    `,
    label: 'Píxel Art',
  },
];

export function renderElementCategoryTilesHtml(): string {
  return ELEMENT_CATEGORY_TILES.map((tile) => `
    <button type="button" class="element-category-card" data-ref="${tile.dataRef}" data-category="${tile.category}">
      ${tile.html}
    </button>
  `).join('\n');
}
