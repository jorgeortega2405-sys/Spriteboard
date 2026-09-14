const FALLBACK_TIER_COLORS: Record<string, string> = {
  free: '#9ca3af',
  plus: '#22c55e',
  pro: '#3b82f6',
  ultra: 'conic-gradient(from 295deg, #E92D18 0% 28%, #306EE2 28% 57%, #249A41 57% 85%, #CD9308 85% 100%)',
  business: 'conic-gradient(from 295deg, #8b5cf6 0% 28%, #ec4899 28% 57%, #3b82f6 57% 85%, #6366f1 85% 100%)',
  negocios: 'conic-gradient(from 295deg, #8b5cf6 0% 28%, #ec4899 28% 57%, #3b82f6 57% 85%, #6366f1 85% 100%)',
  docentes: 'conic-gradient(from 295deg, #8b5cf6 0% 28%, #ec4899 28% 57%, #3b82f6 57% 85%, #6366f1 85% 100%)',
  teachers: 'conic-gradient(from 295deg, #8b5cf6 0% 28%, #ec4899 28% 57%, #3b82f6 57% 85%, #6366f1 85% 100%)',
  escuelas: 'conic-gradient(from 295deg, #8b5cf6 0% 28%, #ec4899 28% 57%, #3b82f6 57% 85%, #6366f1 85% 100%)',
  schools: 'conic-gradient(from 295deg, #8b5cf6 0% 28%, #ec4899 28% 57%, #3b82f6 57% 85%, #6366f1 85% 100%)',
  education: 'conic-gradient(from 295deg, #8b5cf6 0% 28%, #ec4899 28% 57%, #3b82f6 57% 85%, #6366f1 85% 100%)',
  universidades: 'conic-gradient(from 295deg, #f59e0b 0% 28%, #d97706 28% 57%, #8b5cf6 57% 85%, #fbbf24 85% 100%)',
  universities: 'conic-gradient(from 295deg, #f59e0b 0% 28%, #d97706 28% 57%, #8b5cf6 57% 85%, #fbbf24 85% 100%)',
};

export function getFallbackTierColor(tier?: string): string {
  const normalized = (tier || 'free').toLowerCase();
  return FALLBACK_TIER_COLORS[normalized] || FALLBACK_TIER_COLORS.free;
}

export function applyAvatarTier(el: HTMLElement | null, tier?: string, color?: string): void {
  if (!el) return;
  const normalizedTier = (tier || 'free').toLowerCase();
  el.setAttribute('data-tier', normalizedTier);
  const tierColor = color || getFallbackTierColor(normalizedTier);
  el.style.setProperty('--avatar-tier-bg', tierColor);
}
