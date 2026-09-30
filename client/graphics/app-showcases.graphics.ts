import { SpriteboardApp } from '../types/apps.types.js';

export function getAppShowcaseSvg(app: SpriteboardApp): string {
  switch (app.id) {
    case 'qr-code':
      return `
        <svg viewBox="0 0 600 380" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: 100%;">
          <defs>
            <linearGradient id="app-qr-bg" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#0284c7"/>
              <stop offset="100%" stop-color="#0369a1"/>
            </linearGradient>
          </defs>
          <rect width="600" height="380" fill="url(#app-qr-bg)"/>
          <circle cx="520" cy="70" r="140" fill="#ffffff" fill-opacity="0.08"/>
          <circle cx="80" cy="320" r="120" fill="#38bdf8" fill-opacity="0.15"/>
          <g transform="translate(200, 45)">
            <rect width="200" height="290" rx="20" fill="#ffffff" filter="drop-shadow(0 16px 32px rgba(0,0,0,0.22))"/>
            <rect x="25" y="25" width="150" height="150" rx="12" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1.5"/>
            <rect x="38" y="38" width="38" height="38" rx="6" fill="#0284c7"/>
            <rect x="46" y="46" width="22" height="22" rx="3" fill="#ffffff"/>
            <rect x="52" y="52" width="10" height="10" rx="1.5" fill="#0284c7"/>
            <rect x="124" y="38" width="38" height="38" rx="6" fill="#0284c7"/>
            <rect x="132" y="46" width="22" height="22" rx="3" fill="#ffffff"/>
            <rect x="138" y="52" width="10" height="10" rx="1.5" fill="#0284c7"/>
            <rect x="38" y="124" width="38" height="38" rx="6" fill="#0284c7"/>
            <rect x="46" y="132" width="22" height="22" rx="3" fill="#ffffff"/>
            <rect x="52" y="138" width="10" height="10" rx="1.5" fill="#0284c7"/>
            <rect x="88" y="45" width="12" height="12" rx="3" fill="#0284c7"/>
            <rect x="104" y="45" width="12" height="12" rx="3" fill="#0284c7"/>
            <rect x="88" y="65" width="12" height="12" rx="3" fill="#0284c7"/>
            <rect x="104" y="88" width="12" height="12" rx="3" fill="#0284c7"/>
            <rect x="124" y="88" width="12" height="12" rx="3" fill="#0284c7"/>
            <rect x="144" y="88" width="12" height="12" rx="3" fill="#0284c7"/>
            <rect x="88" y="124" width="12" height="12" rx="3" fill="#0284c7"/>
            <rect x="104" y="136" width="12" height="12" rx="3" fill="#0284c7"/>
            <rect x="124" y="124" width="16" height="16" rx="3" fill="#0284c7"/>
            <rect x="148" y="142" width="14" height="14" rx="3" fill="#0284c7"/>
            <rect x="35" y="200" width="130" height="12" rx="6" fill="#0284c7" fill-opacity="0.8"/>
            <rect x="55" y="222" width="90" height="8" rx="4" fill="#94a3b8"/>
            <rect x="45" y="246" width="110" height="26" rx="13" fill="#0284c7"/>
            <text x="100" y="263" fill="#ffffff" font-size="10.5" font-weight="bold" font-family="sans-serif" text-anchor="middle">ESCANEAR</text>
          </g>
        </svg>
      `;
    case 'youtube':
      return `
        <svg viewBox="0 0 600 380" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: 100%;">
          <defs>
            <linearGradient id="app-yt-bg" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#18181b"/>
              <stop offset="100%" stop-color="#27272a"/>
            </linearGradient>
            <linearGradient id="app-yt-glow" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#ef4444"/>
              <stop offset="100%" stop-color="#b91c1c"/>
            </linearGradient>
          </defs>
          <rect width="600" height="380" fill="url(#app-yt-bg)"/>
          <circle cx="300" cy="190" r="160" fill="#ef4444" fill-opacity="0.12"/>
          <g transform="translate(85, 45)">
            <rect width="430" height="290" rx="18" fill="#09090b" stroke="#3f3f46" stroke-width="2" filter="drop-shadow(0 20px 40px rgba(0,0,0,0.5))"/>
            <rect x="24" y="24" width="160" height="12" rx="6" fill="#ffffff" fill-opacity="0.9"/>
            <rect x="24" y="42" width="100" height="8" rx="4" fill="#a1a1aa"/>
            <rect x="360" y="22" width="46" height="20" rx="5" fill="#ef4444"/>
            <text x="383" y="36" fill="#ffffff" font-size="10" font-weight="bold" font-family="sans-serif" text-anchor="middle">4K HD</text>
            <circle cx="215" cy="145" r="42" fill="url(#app-yt-glow)" filter="drop-shadow(0 8px 24px rgba(239, 68, 68, 0.45))"/>
            <polygon points="205,128 205,162 235,145" fill="#ffffff"/>
            <rect x="24" y="245" width="382" height="6" rx="3" fill="#3f3f46"/>
            <rect x="24" y="245" width="240" height="6" rx="3" fill="#ef4444"/>
            <circle cx="264" cy="248" r="7" fill="#ffffff"/>
          </g>
        </svg>
      `;
    case 'google-drive':
      return `
        <svg viewBox="0 0 600 380" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: 100%;">
          <defs>
            <linearGradient id="app-gd-bg" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#0369a1"/>
              <stop offset="100%" stop-color="#075985"/>
            </linearGradient>
          </defs>
          <rect width="600" height="380" fill="url(#app-gd-bg)"/>
          <circle cx="500" cy="90" r="140" fill="#38bdf8" fill-opacity="0.15"/>
          <g transform="translate(80, 55)">
            <g transform="translate(0, 30)">
              <rect width="200" height="180" rx="16" fill="#ffffff" filter="drop-shadow(0 14px 28px rgba(0,0,0,0.18))"/>
              <rect x="24" y="24" width="48" height="48" rx="12" fill="#e0f2fe"/>
              <path d="M38 44L48 54L58 44" stroke="#0284c7" stroke-width="3" stroke-linecap="round"/>
              <rect x="24" y="92" width="130" height="10" rx="5" fill="#0f172a"/>
              <rect x="24" y="112" width="90" height="8" rx="4" fill="#94a3b8"/>
              <rect x="24" y="132" width="60" height="18" rx="9" fill="#f0fdf4"/>
              <text x="54" y="145" fill="#16a34a" font-size="10" font-weight="bold" font-family="sans-serif" text-anchor="middle">SYNC</text>
            </g>
            <g transform="translate(230, 0)">
              <rect width="210" height="220" rx="18" fill="#ffffff" filter="drop-shadow(0 20px 40px rgba(0,0,0,0.25))"/>
              <g transform="translate(73, 28)">
                <path d="M22 44L11 25L25 5H41L30 25L22 44Z" fill="#22c55e"/>
                <path d="M55 44H22L30 28H63L55 44Z" fill="#eab308"/>
                <path d="M41 5L63 38L55 52L33 22L41 5Z" fill="#3b82f6"/>
              </g>
              <rect x="35" y="110" width="140" height="10" rx="5" fill="#0f172a"/>
              <rect x="45" y="130" width="120" height="8" rx="4" fill="#94a3b8"/>
              <rect x="35" y="156" width="140" height="34" rx="10" fill="#0284c7"/>
              <text x="105" y="178" fill="#ffffff" font-size="12" font-weight="bold" font-family="sans-serif" text-anchor="middle">Conectar Drive</text>
            </g>
          </g>
        </svg>
      `;
    case 'google-photos':
      return `
        <svg viewBox="0 0 600 380" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: 100%;">
          <defs>
            <linearGradient id="app-gp-bg" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#334155"/>
              <stop offset="100%" stop-color="#1e293b"/>
            </linearGradient>
          </defs>
          <rect width="600" height="380" fill="url(#app-gp-bg)"/>
          <circle cx="140" cy="110" r="120" fill="#ea4335" fill-opacity="0.12"/>
          <circle cx="480" cy="270" r="130" fill="#4285f4" fill-opacity="0.12"/>
          <g transform="translate(100, 45)">
            <g transform="translate(0, 30) rotate(-6)">
              <rect width="180" height="210" rx="14" fill="#ffffff" stroke="#e2e8f0" stroke-width="4" filter="drop-shadow(0 14px 28px rgba(0,0,0,0.3))"/>
              <rect x="10" y="10" width="160" height="140" rx="8" fill="#38bdf8"/>
              <circle cx="50" cy="50" r="16" fill="#fef08a"/>
              <polygon points="12,150 70,80 120,125 140,105 170,150" fill="#047857"/>
              <rect x="20" y="170" width="100" height="8" rx="4" fill="#64748b"/>
            </g>
            <g transform="translate(200, 0) rotate(4)">
              <rect width="195" height="235" rx="16" fill="#ffffff" stroke="#ffffff" stroke-width="4" filter="drop-shadow(0 20px 40px rgba(0,0,0,0.35))"/>
              <rect x="10" y="10" width="175" height="155" rx="10" fill="#f8fafc"/>
              <g transform="translate(58, 45)">
                <path d="M28 8C28 8 28 22 28 22H14C14 14.27 20.27 8 28 8Z" fill="#ea4335"/>
                <path d="M48 28C48 28 34 28 34 28V14C41.73 14 48 20.27 48 28Z" fill="#fbbc05"/>
                <path d="M28 48C28 48 28 34 28 34H42C42 41.73 35.73 48 28 48Z" fill="#34a853"/>
                <path d="M8 28C8 28 22 28 22 28V42C14.27 42 8 35.73 8 28Z" fill="#4285f4"/>
              </g>
              <rect x="25" y="180" width="110" height="10" rx="5" fill="#0f172a"/>
              <rect x="25" y="200" width="70" height="8" rx="4" fill="#94a3b8"/>
            </g>
          </g>
        </svg>
      `;
    case 'google-maps':
      return `
        <svg viewBox="0 0 600 380" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: 100%;">
          <defs>
            <linearGradient id="app-gm-bg" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#064e3b"/>
              <stop offset="100%" stop-color="#065f46"/>
            </linearGradient>
          </defs>
          <rect width="600" height="380" fill="url(#app-gm-bg)"/>
          <g transform="translate(65, 35)">
            <rect width="470" height="310" rx="18" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="1.5" filter="drop-shadow(0 20px 40px rgba(0,0,0,0.35))"/>
            <path d="M0 110 Q 110 170 220 100 T 470 120 L 470 0 L 0 0 Z" fill="#bae6fd"/>
            <rect x="280" y="170" width="160" height="100" rx="10" fill="#bbf7d0"/>
            <path d="M0 200 H 470" stroke="#ffffff" stroke-width="16"/>
            <path d="M160 0 V 310" stroke="#ffffff" stroke-width="16"/>
            <path d="M330 0 V 310" stroke="#ffffff" stroke-width="12"/>
            <path d="M0 90 H 160" stroke="#ffffff" stroke-width="12"/>
            <path d="M0 200 H 470" stroke="#fbbf24" stroke-width="4"/>
            <circle cx="250" cy="180" r="38" fill="#ef4444" fill-opacity="0.2"/>
            <circle cx="250" cy="180" r="24" fill="#ef4444" fill-opacity="0.35"/>
            <g transform="translate(226, 140)">
              <path d="M24 0C10.74 0 0 10.74 0 24C0 42 24 62 24 62C24 62 48 42 48 24C48 10.74 37.26 0 24 0Z" fill="#ea4335" filter="drop-shadow(0 6px 12px rgba(0,0,0,0.3))"/>
              <circle cx="24" cy="22" r="9" fill="#ffffff"/>
            </g>
            <rect x="28" y="240" width="180" height="42" rx="8" fill="#ffffff" filter="drop-shadow(0 6px 12px rgba(0,0,0,0.12))"/>
            <rect x="42" y="252" width="100" height="8" rx="4" fill="#0f172a"/>
            <rect x="42" y="266" width="60" height="6" rx="3" fill="#94a3b8"/>
          </g>
        </svg>
      `;
    default:
      return `
        <svg viewBox="0 0 600 380" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: 100%;">
          <rect width="600" height="380" fill="${app.bannerColor || '#6366f1'}"/>
          <circle cx="300" cy="190" r="100" fill="#ffffff" fill-opacity="0.15"/>
          <g transform="translate(256, 146)">
            ${app.iconSvg || `<svg class="component-icon" style="width: 88px; height: 88px;"><use href="/icons.svg#${app.icon}"></use></svg>`}
          </g>
        </svg>
      `;
  }
}
