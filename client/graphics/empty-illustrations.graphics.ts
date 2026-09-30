export type EmptyIllustrationKey =
  | 'advertisements'
  | 'backups'
  | 'billing'
  | 'canvas'
  | 'canvases'
  | 'chat'
  | 'cloud'
  | 'default'
  | 'error'
  | 'explore'
  | 'gallery'
  | 'invites'
  | 'library'
  | 'logs'
  | 'members'
  | 'messages'
  | 'notifications'
  | 'payment'
  | 'purchases'
  | 'receipt'
  | 'reports'
  | 'roles'
  | 'sanctions'
  | 'search'
  | 'snapshots'
  | 'subscriptions'
  | 'team'
  | 'teams'
  | 'template'
  | 'templates'
  | 'trash'
  | 'upload'
  | 'users';

export const EMPTY_ILLUSTRATIONS: Record<string, string> = {
  canvas: `<svg class="component-empty-state-svg" viewBox="0 0 140 140" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="illCanvasBoard" x1="30" y1="30" x2="110" y2="105" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#52525b"/>
        <stop offset="50%" stop-color="#3f3f46"/>
        <stop offset="100%" stop-color="#27272a"/>
      </linearGradient>
      <linearGradient id="illCanvasBrush" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#a1a1aa"/>
        <stop offset="100%" stop-color="#52525b"/>
      </linearGradient>
    </defs>
    <path d="M42 60 L30 124 M98 60 L110 124 M70 50 L70 124" stroke="var(--text-tertiary, #52525b)" stroke-width="4" stroke-linecap="round" opacity="0.4"/>
    <rect x="34" y="34" width="72" height="64" rx="10" fill="url(#illCanvasBoard)" stroke="#52525b" stroke-width="1.5"/>
    <rect x="39" y="39" width="62" height="54" rx="7" fill="var(--bg-surface, #18181b)"/>
    <rect x="46" y="46" width="10" height="10" rx="2" fill="#71717a"/>
    <rect x="58" y="46" width="10" height="10" rx="2" fill="#a1a1aa"/>
    <rect x="70" y="46" width="10" height="10" rx="2" fill="#52525b"/>
    <rect x="82" y="46" width="10" height="10" rx="2" fill="#3f3f46"/>
    <rect x="46" y="58" width="10" height="10" rx="2" fill="#d4d4d8"/>
    <rect x="58" y="58" width="10" height="10" rx="2" fill="#71717a"/>
    <rect x="70" y="58" width="10" height="10" rx="2" fill="#e4e4e7"/>
    <rect x="82" y="58" width="10" height="10" rx="2" fill="#52525b"/>
    <rect x="46" y="70" width="10" height="10" rx="2" fill="#3f3f46"/>
    <rect x="58" y="70" width="10" height="10" rx="2" fill="#52525b"/>
    <rect x="70" y="70" width="10" height="10" rx="2" fill="#a1a1aa"/>
    <rect x="82" y="70" width="10" height="10" rx="2" fill="#71717a"/>
    <g transform="rotate(32 94 40)">
      <rect x="88" y="16" width="6" height="42" rx="3" fill="url(#illCanvasBrush)"/>
      <rect x="87" y="54" width="8" height="6" rx="1.5" fill="#e4e4e7"/>
      <path d="M87 60 C87 66 95 66 95 60 Z" fill="#71717a"/>
    </g>
    <g>
      <path d="M112 30 L113.5 34.5 L118 36 L113.5 37.5 L112 42 L110.5 37.5 L106 36 L110.5 34.5 Z" fill="#e4e4e7"/>
      <path d="M26 48 L27 51 L30 52 L27 53 L26 56 L25 53 L22 52 L25 51 Z" fill="#a1a1aa"/>
      <path d="M102 96 L103 98 L105 99 L103 100 L102 102 L101 100 L99 99 L101 98 Z" fill="#71717a"/>
    </g>
  </svg>`,

  trash: `<svg class="component-empty-state-svg" viewBox="0 0 140 140" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="illTrashCan" x1="40" y1="56" x2="100" y2="120" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#52525b"/>
        <stop offset="45%" stop-color="#3f3f46"/>
        <stop offset="100%" stop-color="#18181b"/>
      </linearGradient>
      <linearGradient id="illTrashLid" x1="30" y1="20" x2="80" y2="60" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#71717a"/>
        <stop offset="50%" stop-color="#52525b"/>
        <stop offset="100%" stop-color="#27272a"/>
      </linearGradient>
      <linearGradient id="illTrashLight" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="illTrashWing" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#f4f4f5"/>
        <stop offset="100%" stop-color="#a1a1aa"/>
      </linearGradient>
      <linearGradient id="illTrashLowWing" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#d4d4d8"/>
        <stop offset="100%" stop-color="#71717a"/>
      </linearGradient>
    </defs>
    <path d="M46 62 L52 116 C52.5 122 87.5 122 88 116 L94 62 Z" fill="url(#illTrashCan)"/>
    <rect x="55" y="66" width="5" height="48" rx="2.5" fill="rgba(255,255,255,0.12)"/>
    <rect x="67.5" y="66" width="5" height="50" rx="2.5" fill="rgba(255,255,255,0.2)"/>
    <rect x="80" y="66" width="5" height="48" rx="2.5" fill="rgba(0,0,0,0.3)"/>
    <ellipse cx="70" cy="62" rx="25" ry="7" fill="#27272a"/>
    <ellipse cx="70" cy="62" rx="22" ry="5.5" fill="#18181b"/>
    <ellipse cx="70" cy="62" rx="16" ry="3.5" fill="#3f3f46" opacity="0.6"/>
    <g transform="rotate(-24 46 44)">
      <ellipse cx="64" cy="46" rx="28" ry="7" fill="url(#illTrashLid)"/>
      <path d="M38 46 C38 36 90 36 90 46 Z" fill="url(#illTrashLid)"/>
      <path d="M42 43 C46 38 82 38 86 43" stroke="url(#illTrashLight)" stroke-width="2" stroke-linecap="round" fill="none"/>
      <path d="M58 35 C58 30 70 30 70 35" stroke="#e4e4e7" stroke-width="3" stroke-linecap="round" fill="none"/>
    </g>
    <g transform="translate(90, 36)">
      <path d="M-1 -1 C-6 -8 -13 -6 -10 1 C-8 4 -3 2 -1 0 Z" fill="url(#illTrashWing)"/>
      <path d="M1 -1 C6 -8 13 -6 10 1 C8 4 3 2 1 0 Z" fill="url(#illTrashWing)"/>
      <path d="M-1 1 C-6 5 -10 9 -6 11 C-3 11 -1 5 -1 1 Z" fill="url(#illTrashLowWing)"/>
      <path d="M1 1 C6 5 10 9 6 11 C3 11 1 5 1 1 Z" fill="url(#illTrashLowWing)"/>
      <ellipse cx="0" cy="1" rx="1.5" ry="5.5" fill="#27272a"/>
    </g>
    <g>
      <path d="M108 24 L109.5 28.5 L114 30 L109.5 31.5 L108 36 L106.5 31.5 L102 30 L106.5 28.5 Z" fill="#e4e4e7"/>
      <path d="M30 42 L31 45 L34 46 L31 47 L30 50 L29 47 L26 46 L29 45 Z" fill="#a1a1aa"/>
      <path d="M84 18 L85 20 L87 21 L85 22 L84 24 L83 22 L81 21 L83 20 Z" fill="#71717a"/>
    </g>
  </svg>`,

  search: `<svg class="component-empty-state-svg" viewBox="0 0 140 140" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="illSearchGlass" x1="30" y1="26" x2="86" y2="82" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.12"/>
        <stop offset="100%" stop-color="#71717a" stop-opacity="0.05"/>
      </linearGradient>
      <linearGradient id="illSearchRim" x1="28" y1="24" x2="88" y2="84" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#a1a1aa"/>
        <stop offset="50%" stop-color="#71717a"/>
        <stop offset="100%" stop-color="#3f3f46"/>
      </linearGradient>
      <linearGradient id="illSearchHandle" x1="76" y1="76" x2="114" y2="114" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#71717a"/>
        <stop offset="50%" stop-color="#52525b"/>
        <stop offset="100%" stop-color="#27272a"/>
      </linearGradient>
    </defs>
    <circle cx="58" cy="54" r="38" stroke="var(--border-color, #3f3f46)" stroke-width="1.5" stroke-dasharray="4 4" opacity="0.4"/>
    <path d="M80 76 L110 106" stroke="url(#illSearchHandle)" stroke-width="12" stroke-linecap="round"/>
    <path d="M80 76 L110 106" stroke="#a1a1aa" stroke-width="4" stroke-linecap="round" opacity="0.4"/>
    <circle cx="110" cy="106" r="6" fill="#27272a"/>
    <circle cx="58" cy="54" r="30" fill="url(#illSearchGlass)" stroke="url(#illSearchRim)" stroke-width="6"/>
    <path d="M38 42 C44 34 54 30 66 32" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-opacity="0.5" fill="none"/>
    <circle cx="54" cy="50" r="3.5" fill="#e4e4e7"/>
    <circle cx="68" cy="60" r="2.5" fill="#a1a1aa"/>
    <circle cx="48" cy="62" r="2" fill="#71717a"/>
    <g>
      <path d="M106 28 L107.5 32.5 L112 34 L107.5 35.5 L106 40 L104.5 35.5 L100 34 L104.5 32.5 Z" fill="#e4e4e7"/>
      <path d="M22 66 L23 69 L26 70 L23 71 L22 74 L21 71 L18 70 L21 69 Z" fill="#a1a1aa"/>
      <path d="M84 18 L85 20 L87 21 L85 22 L84 24 L83 22 L81 21 L83 20 Z" fill="#71717a"/>
    </g>
  </svg>`,

  snapshots: `<svg class="component-empty-state-svg" viewBox="0 0 140 140" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="illPhotoGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#52525b"/>
        <stop offset="50%" stop-color="#3f3f46"/>
        <stop offset="100%" stop-color="#18181b"/>
      </linearGradient>
    </defs>
    <g transform="rotate(-12 60 70)">
      <rect x="36" y="32" width="58" height="68" rx="8" fill="var(--bg-surface-alt, #27272a)" stroke="var(--border-color, #3f3f46)" stroke-width="1.5"/>
      <rect x="42" y="38" width="46" height="42" rx="5" fill="#3f3f46" opacity="0.4"/>
    </g>
    <g transform="rotate(8 72 70)">
      <rect x="42" y="30" width="60" height="72" rx="8" fill="var(--bg-surface, #18181b)" stroke="var(--border-color, #3f3f46)" stroke-width="1.5"/>
      <rect x="48" y="36" width="48" height="46" rx="5" fill="url(#illPhotoGrad)"/>
      <circle cx="80" cy="48" r="5" fill="#e4e4e7"/>
      <path d="M48 76 L62 58 L72 68 L82 54 L96 76 Z" fill="rgba(255,255,255,0.18)"/>
      <path d="M58 76 L70 62 L80 72 L96 76 Z" fill="rgba(255,255,255,0.28)"/>
      <circle cx="88" cy="88" r="7" fill="#52525b"/>
      <path d="M88 86 C87 84 84 84 84 86 C84 88 88 91 88 91 C88 91 92 88 92 86 C92 84 89 84 88 86 Z" fill="#ffffff"/>
    </g>
    <g>
      <path d="M112 24 L113.5 28.5 L118 30 L113.5 31.5 L112 36 L110.5 31.5 L106 30 L110.5 28.5 Z" fill="#e4e4e7"/>
      <path d="M26 40 L27 43 L30 44 L27 45 L26 48 L25 45 L22 44 L25 43 Z" fill="#a1a1aa"/>
    </g>
  </svg>`,

  explore: `<svg class="component-empty-state-svg" viewBox="0 0 140 140" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="illGlobeGrad" x1="30" y1="30" x2="110" y2="110" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#52525b"/>
        <stop offset="50%" stop-color="#3f3f46"/>
        <stop offset="100%" stop-color="#18181b"/>
      </linearGradient>
      <linearGradient id="illRingGrad" x1="20" y1="70" x2="120" y2="70" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#a1a1aa"/>
        <stop offset="50%" stop-color="#71717a"/>
        <stop offset="100%" stop-color="#3f3f46"/>
      </linearGradient>
    </defs>
    <circle cx="70" cy="68" r="32" fill="url(#illGlobeGrad)" stroke="#52525b" stroke-width="1.5"/>
    <rect x="56" y="52" width="10" height="8" rx="2" fill="rgba(255,255,255,0.2)"/>
    <rect x="68" y="56" width="16" height="10" rx="3" fill="rgba(255,255,255,0.15)"/>
    <rect x="52" y="68" width="14" height="12" rx="3" fill="rgba(255,255,255,0.2)"/>
    <rect x="72" y="74" width="12" height="8" rx="2" fill="rgba(255,255,255,0.15)"/>
    <ellipse cx="70" cy="68" rx="54" ry="16" stroke="url(#illRingGrad)" stroke-width="3.5" transform="rotate(-22 70 68)" opacity="0.8"/>
    <g>
      <path d="M116 26 L117.5 30.5 L122 32 L117.5 33.5 L116 38 L114.5 33.5 L110 32 L114.5 30.5 Z" fill="#e4e4e7"/>
      <path d="M24 44 L25 47 L28 48 L25 49 L24 52 L23 49 L20 48 L23 47 Z" fill="#a1a1aa"/>
      <path d="M96 102 L97 104 L99 105 L97 106 L96 108 L95 106 L93 105 L95 104 Z" fill="#71717a"/>
    </g>
  </svg>`,

  users: `<svg class="component-empty-state-svg" viewBox="0 0 140 140" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="illUserGradMain" x1="35" y1="35" x2="105" y2="105" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#52525b"/>
        <stop offset="50%" stop-color="#3f3f46"/>
        <stop offset="100%" stop-color="#27272a"/>
      </linearGradient>
      <linearGradient id="illUserGradBack" x1="30" y1="20" x2="80" y2="80" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#3f3f46"/>
        <stop offset="100%" stop-color="#18181b"/>
      </linearGradient>
    </defs>
    <g opacity="0.6">
      <circle cx="48" cy="46" r="14" fill="url(#illUserGradBack)" stroke="#52525b" stroke-width="1.5"/>
      <path d="M28 84 C28 70 38 68 48 68 C58 68 68 70 68 84 Z" fill="url(#illUserGradBack)" stroke="#52525b" stroke-width="1.5"/>
    </g>
    <g opacity="0.6">
      <circle cx="92" cy="46" r="14" fill="url(#illUserGradBack)" stroke="#52525b" stroke-width="1.5"/>
      <path d="M72 84 C72 70 82 68 92 68 C102 68 112 70 112 84 Z" fill="url(#illUserGradBack)" stroke="#52525b" stroke-width="1.5"/>
    </g>
    <circle cx="70" cy="50" r="18" fill="url(#illUserGradMain)" stroke="#71717a" stroke-width="2"/>
    <circle cx="70" cy="46" r="6" fill="#e4e4e7" opacity="0.8"/>
    <path d="M44 98 C44 80 56 76 70 76 C84 76 96 80 96 98 Z" fill="url(#illUserGradMain)" stroke="#71717a" stroke-width="2"/>
    <rect x="62" y="82" width="16" height="4" rx="2" fill="#e4e4e7" opacity="0.5"/>
    <g>
      <path d="M116 28 L117.5 32.5 L122 34 L117.5 35.5 L116 40 L114.5 35.5 L110 34 L114.5 32.5 Z" fill="#e4e4e7"/>
      <path d="M22 46 L23 49 L26 50 L23 51 L22 54 L21 51 L18 50 L21 49 Z" fill="#a1a1aa"/>
      <path d="M102 96 L103 98 L105 99 L103 100 L102 102 L101 100 L99 99 L101 98 Z" fill="#71717a"/>
    </g>
  </svg>`,

  subscriptions: `<svg class="component-empty-state-svg" viewBox="0 0 140 140" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="illCardGradSub" x1="25" y1="35" x2="115" y2="95" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#71717a"/>
        <stop offset="50%" stop-color="#52525b"/>
        <stop offset="100%" stop-color="#27272a"/>
      </linearGradient>
    </defs>
    <rect x="30" y="42" width="80" height="54" rx="10" fill="url(#illCardGradSub)" stroke="#71717a" stroke-width="2"/>
    <rect x="30" y="54" width="80" height="10" fill="#18181b"/>
    <rect x="42" y="74" width="16" height="12" rx="3" fill="#e4e4e7" opacity="0.7"/>
    <g transform="translate(86, 78)">
      <path d="M0 -8 L2.4 -2.5 L8.5 -2.5 L3.6 1.2 L5.5 7 L0 3.5 L-5.5 7 L-3.6 1.2 L-8.5 -2.5 L-2.4 -2.5 Z" fill="#fbbf24"/>
    </g>
    <g>
      <path d="M116 24 L117.5 28.5 L122 30 L117.5 31.5 L116 36 L114.5 31.5 L110 30 L114.5 28.5 Z" fill="#e4e4e7"/>
      <path d="M22 46 L23 49 L26 50 L23 51 L22 54 L21 51 L18 50 L21 49 Z" fill="#a1a1aa"/>
      <path d="M98 104 L99 106 L101 107 L99 108 L98 110 L97 108 L95 107 L97 106 Z" fill="#71717a"/>
    </g>
  </svg>`,

  backups: `<svg class="component-empty-state-svg" viewBox="0 0 140 140" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="illCloudGrad" x1="30" y1="20" x2="110" y2="85" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#71717a"/>
        <stop offset="50%" stop-color="#52525b"/>
        <stop offset="100%" stop-color="#27272a"/>
      </linearGradient>
      <linearGradient id="illDiscGrad" x1="40" y1="70" x2="100" y2="110" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#52525b"/>
        <stop offset="100%" stop-color="#18181b"/>
      </linearGradient>
    </defs>
    <path d="M48 58 C42 58 36 63 36 70 C36 76 40 80 46 80 L94 80 C100 80 106 75 106 69 C106 63 101 58 95 58 C94 51 88 46 81 46 C77 46 73 48 70 51 C67 46 61 43 55 46 C50 48 48 53 48 58 Z" fill="url(#illCloudGrad)" stroke="#71717a" stroke-width="2"/>
    <path d="M42 90 L42 102 C42 108 98 108 98 102 L98 90 Z" fill="url(#illDiscGrad)" stroke="#52525b" stroke-width="1.5"/>
    <ellipse cx="70" cy="90" rx="28" ry="6" fill="#3f3f46" stroke="#71717a" stroke-width="1.5"/>
    <circle cx="88" cy="98" r="2" fill="#22c55e"/>
    <g>
      <path d="M116 24 L117.5 28.5 L122 30 L117.5 31.5 L116 36 L114.5 31.5 L110 30 L114.5 28.5 Z" fill="#e4e4e7"/>
      <path d="M24 40 L25 43 L28 44 L25 45 L24 48 L23 45 L20 44 L23 43 Z" fill="#a1a1aa"/>
    </g>
  </svg>`,

  messages: `<svg class="component-empty-state-svg" viewBox="0 0 140 140" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="illChatBubbleGrad" x1="20" y1="30" x2="100" y2="100" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#71717a"/>
        <stop offset="50%" stop-color="#52525b"/>
        <stop offset="100%" stop-color="#27272a"/>
      </linearGradient>
    </defs>
    <path d="M34 40 C34 32 42 26 52 26 L96 26 C106 26 114 32 114 40 L114 74 C114 82 106 88 96 88 L64 88 L46 102 L48 88 C38 88 34 82 34 74 Z" fill="url(#illChatBubbleGrad)" stroke="#71717a" stroke-width="2"/>
    <circle cx="56" cy="56" r="4" fill="#e4e4e7"/>
    <circle cx="74" cy="56" r="4" fill="#d4d4d8"/>
    <circle cx="92" cy="56" r="4" fill="#a1a1aa"/>
    <g>
      <path d="M118 24 L119.5 28.5 L124 30 L119.5 31.5 L118 36 L116.5 31.5 L112 30 L116.5 28.5 Z" fill="#e4e4e7"/>
      <path d="M22 46 L23 49 L26 50 L23 51 L22 54 L21 51 L18 50 L21 49 Z" fill="#a1a1aa"/>
    </g>
  </svg>`,

  roles: `<svg class="component-empty-state-svg" viewBox="0 0 140 140" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="illShieldGrad" x1="40" y1="26" x2="100" y2="114" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#71717a"/>
        <stop offset="50%" stop-color="#52525b"/>
        <stop offset="100%" stop-color="#27272a"/>
      </linearGradient>
    </defs>
    <path d="M70 28 L104 42 L104 74 C104 96 88 112 70 118 C52 112 36 96 36 74 L36 42 Z" fill="url(#illShieldGrad)" stroke="#71717a" stroke-width="2"/>
    <path d="M70 48 L73 57 L82 57 L75 62 L78 71 L70 66 L62 71 L65 62 L58 57 L67 57 Z" fill="#fbbf24"/>
    <g>
      <path d="M116 26 L117.5 30.5 L122 32 L117.5 33.5 L116 38 L114.5 33.5 L110 32 L114.5 30.5 Z" fill="#e4e4e7"/>
      <path d="M22 48 L23 51 L26 52 L23 53 L22 56 L21 53 L18 52 L21 51 Z" fill="#a1a1aa"/>
    </g>
  </svg>`,

  invites: `<svg class="component-empty-state-svg" viewBox="0 0 140 140" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="illEnvelopeGrad" x1="30" y1="40" x2="110" y2="100" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#71717a"/>
        <stop offset="50%" stop-color="#52525b"/>
        <stop offset="100%" stop-color="#27272a"/>
      </linearGradient>
    </defs>
    <rect x="32" y="44" width="76" height="52" rx="8" fill="url(#illEnvelopeGrad)" stroke="#71717a" stroke-width="2"/>
    <path d="M32 48 L70 74 L108 48" stroke="#d4d4d8" stroke-width="2" stroke-linejoin="round" fill="none"/>
    <path d="M34 94 L58 72 M106 94 L82 72" stroke="rgba(255,255,255,0.18)" stroke-width="1.5"/>
    <g>
      <path d="M116 24 L117.5 28.5 L122 30 L117.5 31.5 L116 36 L114.5 31.5 L110 30 L114.5 28.5 Z" fill="#e4e4e7"/>
      <path d="M22 42 L23 45 L26 46 L23 47 L22 50 L21 47 L18 46 L21 45 Z" fill="#a1a1aa"/>
    </g>
  </svg>`,

  logs: `<svg class="component-empty-state-svg" viewBox="0 0 140 140" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="illConsoleGrad" x1="30" y1="30" x2="110" y2="110" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#3f3f46"/>
        <stop offset="100%" stop-color="#18181b"/>
      </linearGradient>
    </defs>
    <rect x="30" y="36" width="80" height="68" rx="8" fill="url(#illConsoleGrad)" stroke="#52525b" stroke-width="2"/>
    <rect x="30" y="36" width="80" height="16" rx="8" fill="#27272a"/>
    <circle cx="40" cy="44" r="3" fill="#ef4444"/>
    <circle cx="50" cy="44" r="3" fill="#eab308"/>
    <circle cx="60" cy="44" r="3" fill="#22c55e"/>
    <path d="M40 64 L48 70 L40 76" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <line x1="54" y1="76" x2="72" y2="76" stroke="#e4e4e7" stroke-width="2" stroke-linecap="round"/>
    <line x1="40" y1="88" x2="94" y2="88" stroke="#71717a" stroke-width="2" stroke-linecap="round" stroke-dasharray="4 4"/>
    <g>
      <path d="M118 24 L119.5 28.5 L124 30 L119.5 31.5 L118 36 L116.5 31.5 L112 30 L116.5 28.5 Z" fill="#e4e4e7"/>
    </g>
  </svg>`,

  advertisements: `<svg class="component-empty-state-svg" viewBox="0 0 140 140" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="illAdHornGrad" x1="30" y1="35" x2="110" y2="105" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#71717a"/>
        <stop offset="50%" stop-color="#52525b"/>
        <stop offset="100%" stop-color="#27272a"/>
      </linearGradient>
    </defs>
    <path d="M42 66 L52 50 L94 36 L94 94 L52 80 L42 80 Z" fill="url(#illAdHornGrad)" stroke="#71717a" stroke-width="2"/>
    <path d="M52 80 L56 106 L68 106 L64 80" fill="#3f3f46" stroke="#71717a" stroke-width="1.5"/>
    <ellipse cx="94" cy="65" rx="6" ry="29" fill="#52525b" stroke="#71717a" stroke-width="2"/>
    <path d="M106 52 C110 58 110 72 106 78 M114 44 C122 54 122 76 114 86" stroke="#a1a1aa" stroke-width="2" stroke-linecap="round" fill="none"/>
    <g>
      <path d="M118 22 L119.5 26.5 L124 28 L119.5 29.5 L118 34 L116.5 29.5 L112 28 L116.5 26.5 Z" fill="#e4e4e7"/>
    </g>
  </svg>`,

  sanctions: `<svg class="component-empty-state-svg" viewBox="0 0 140 140" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="illLockGrad" x1="40" y1="45" x2="100" y2="105" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#71717a"/>
        <stop offset="50%" stop-color="#52525b"/>
        <stop offset="100%" stop-color="#27272a"/>
      </linearGradient>
    </defs>
    <path d="M50 56 L50 44 C50 33 59 24 70 24 C81 24 90 33 90 44 L90 56" stroke="#a1a1aa" stroke-width="5" stroke-linecap="round" fill="none"/>
    <rect x="42" y="56" width="56" height="48" rx="10" fill="url(#illLockGrad)" stroke="#71717a" stroke-width="2"/>
    <circle cx="70" cy="76" r="5" fill="#e4e4e7"/>
    <path d="M70 81 L70 90" stroke="#e4e4e7" stroke-width="3" stroke-linecap="round"/>
    <g>
      <path d="M116 24 L117.5 28.5 L122 30 L117.5 31.5 L116 36 L114.5 31.5 L110 30 L114.5 28.5 Z" fill="#e4e4e7"/>
      <path d="M22 46 L23 49 L26 50 L23 51 L22 54 L21 51 L18 50 L21 49 Z" fill="#a1a1aa"/>
    </g>
  </svg>`,

  reports: `<svg class="component-empty-state-svg" viewBox="0 0 140 140" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="illFlagGrad" x1="30" y1="30" x2="100" y2="100" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#71717a"/>
        <stop offset="50%" stop-color="#52525b"/>
        <stop offset="100%" stop-color="#27272a"/>
      </linearGradient>
    </defs>
    <line x1="44" y1="28" x2="44" y2="114" stroke="#71717a" stroke-width="4" stroke-linecap="round"/>
    <path d="M46 32 L98 48 L46 68 Z" fill="url(#illFlagGrad)" stroke="#71717a" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="44" cy="26" r="4" fill="#fbbf24"/>
    <g>
      <path d="M116 24 L117.5 28.5 L122 30 L117.5 31.5 L116 36 L114.5 31.5 L110 30 L114.5 28.5 Z" fill="#e4e4e7"/>
    </g>
  </svg>`,

  notifications: `<svg class="component-empty-state-svg" viewBox="0 0 140 140" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="illBellGrad" x1="35" y1="30" x2="105" y2="100" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#71717a"/>
        <stop offset="50%" stop-color="#52525b"/>
        <stop offset="100%" stop-color="#27272a"/>
      </linearGradient>
    </defs>
    <path d="M70 28 C64 28 60 32 60 37 L60 40 C48 44 42 54 42 70 L36 84 L104 84 L98 70 C98 54 92 44 80 40 L80 37 C80 32 76 28 70 28 Z" fill="url(#illBellGrad)" stroke="#71717a" stroke-width="2"/>
    <path d="M60 92 C60 98 64 102 70 102 C76 102 80 98 80 92 Z" fill="#fbbf24"/>
    <circle cx="94" cy="40" r="6" fill="#ef4444"/>
    <g>
      <path d="M118 24 L119.5 28.5 L124 30 L119.5 31.5 L118 36 L116.5 31.5 L112 30 L116.5 28.5 Z" fill="#e4e4e7"/>
      <path d="M22 46 L23 49 L26 50 L23 51 L22 54 L21 51 L18 50 L21 49 Z" fill="#a1a1aa"/>
    </g>
  </svg>`,

  error: `<svg class="component-empty-state-svg" viewBox="0 0 140 140" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="illErrorDoc" x1="30" y1="26" x2="105" y2="105" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#71717a"/>
        <stop offset="50%" stop-color="#52525b"/>
        <stop offset="100%" stop-color="#27272a"/>
      </linearGradient>
    </defs>
    <rect x="36" y="28" width="68" height="84" rx="10" fill="url(#illErrorDoc)" stroke="#71717a" stroke-width="2"/>
    <circle cx="70" cy="62" r="14" fill="#ef4444" opacity="0.2"/>
    <circle cx="70" cy="62" r="12" stroke="#ef4444" stroke-width="2"/>
    <path d="M70 54 L70 64" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="70" cy="70" r="1.5" fill="#ef4444"/>
    <line x1="48" y1="88" x2="92" y2="88" stroke="#71717a" stroke-width="2" stroke-linecap="round"/>
    <line x1="48" y1="96" x2="76" y2="96" stroke="#52525b" stroke-width="2" stroke-linecap="round"/>
    <g>
      <path d="M116 24 L117.5 28.5 L122 30 L117.5 31.5 L116 36 L114.5 31.5 L110 30 L114.5 28.5 Z" fill="#e4e4e7"/>
    </g>
  </svg>`,
};

EMPTY_ILLUSTRATIONS.canvases = EMPTY_ILLUSTRATIONS.canvas;
EMPTY_ILLUSTRATIONS.default = EMPTY_ILLUSTRATIONS.canvas;
EMPTY_ILLUSTRATIONS.teams = EMPTY_ILLUSTRATIONS.users;
EMPTY_ILLUSTRATIONS.team = EMPTY_ILLUSTRATIONS.users;
EMPTY_ILLUSTRATIONS.members = EMPTY_ILLUSTRATIONS.users;
EMPTY_ILLUSTRATIONS.purchases = EMPTY_ILLUSTRATIONS.subscriptions;
EMPTY_ILLUSTRATIONS.billing = EMPTY_ILLUSTRATIONS.subscriptions;
EMPTY_ILLUSTRATIONS.receipt = EMPTY_ILLUSTRATIONS.subscriptions;
EMPTY_ILLUSTRATIONS.payment = EMPTY_ILLUSTRATIONS.subscriptions;
EMPTY_ILLUSTRATIONS.cloud = EMPTY_ILLUSTRATIONS.backups;
EMPTY_ILLUSTRATIONS.upload = EMPTY_ILLUSTRATIONS.backups;
EMPTY_ILLUSTRATIONS.gallery = EMPTY_ILLUSTRATIONS.snapshots;
EMPTY_ILLUSTRATIONS.templates = EMPTY_ILLUSTRATIONS.snapshots;
EMPTY_ILLUSTRATIONS.template = EMPTY_ILLUSTRATIONS.snapshots;
EMPTY_ILLUSTRATIONS.library = EMPTY_ILLUSTRATIONS.snapshots;
EMPTY_ILLUSTRATIONS.chat = EMPTY_ILLUSTRATIONS.messages;

export function getEmptyIllustration(key: string | EmptyIllustrationKey): string {
  const normalizedKey = (key || 'default').toLowerCase().trim();
  return EMPTY_ILLUSTRATIONS[normalizedKey] || EMPTY_ILLUSTRATIONS.default;
}
