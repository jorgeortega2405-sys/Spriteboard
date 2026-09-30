import { openUpgradeModal } from '../components/upgrade-modal.component.js';
import { API_ROUTES } from './api-routes.js';
import { hasFeature } from './plans.config.js';
import { currentUser, getApi } from '../services/api.service.js';
import { canPublishTemplates } from '../types/auth.types.js';
import { loadStylesheet } from '../utils/dom.util.js';

export interface RouteContext {
  params: Record<string, string>;
  path: string;
  previousPath: string;
  query: URLSearchParams;
}

export type RouteHandler = (ctx: RouteContext) => Promise<HTMLElement[] | null>;

export interface RouteDefinition {
  handler: RouteHandler;
  id: string;
  isAuthMode?: boolean;
  match: (path: string) => boolean | Record<string, string>;
}

export const APP_ROUTES: RouteDefinition[] = [
  {
    id: 'auth-2fa',
    isAuthMode: true,
    match: (path) => path === '/login/verification-aditional',
    handler: async () => {
      const { createLogin2FAView } = await import('../views/auth.view.js');
      return [await createLogin2FAView()];
    },
  },
  {
    id: 'auth-register-stage2',
    isAuthMode: true,
    match: (path) => path === '/register/aditional-data',
    handler: async () => {
      const { createRegisterStage2View } = await import('../views/auth.view.js');
      return [await createRegisterStage2View()];
    },
  },
  {
    id: 'auth-register-stage3',
    isAuthMode: true,
    match: (path) => path === '/register/verification-account',
    handler: async () => {
      const { createRegisterStage3View } = await import('../views/auth.view.js');
      return [await createRegisterStage3View()];
    },
  },
  {
    id: 'auth-register',
    isAuthMode: true,
    match: (path) => path === '/register',
    handler: async () => {
      const { createRegisterStage1View } = await import('../views/auth.view.js');
      return [await createRegisterStage1View()];
    },
  },
  {
    id: 'auth-forgot-password',
    isAuthMode: true,
    match: (path) => path === '/forgot-password',
    handler: async () => {
      const { createForgotPasswordView } = await import('../views/auth.view.js');
      return [await createForgotPasswordView()];
    },
  },
  {
    id: 'auth-reset-password',
    isAuthMode: true,
    match: (path) => path === '/reset-password',
    handler: async () => {
      const { createResetPasswordView } = await import('../views/auth.view.js');
      return [await createResetPasswordView()];
    },
  },
  {
    id: 'auth-login',
    isAuthMode: true,
    match: (path) => path === '/login' || path.startsWith('/login/'),
    handler: async () => {
      const { createLoginView } = await import('../views/auth.view.js');
      return [await createLoginView()];
    },
  },
  {
    id: 'ai-studio',
    match: (path) => path === '/ia' || path === '/ai',
    handler: async () => {
      if (!currentUser) {
        window.history.replaceState({}, '', '/login');
        const { createLoginView } = await import('../views/auth.view.js');
        return [await createLoginView()];
      }
      await loadStylesheet('/css/components/component-ai-studio.css');
      const { createAiStudioView } = await import('../views/ai-studio.view.js');
      return [await createAiStudioView()];
    },
  },
  {
    id: 'brand',
    match: (path) => path === '/brand' || path === '/marca',
    handler: async (ctx) => {
      if (!currentUser) {
        window.history.replaceState({}, '', '/login');
        const { createLoginView } = await import('../views/auth.view.js');
        return [await createLoginView()];
      }
      if (!hasFeature('brand_kits', currentUser)) {
        window.history.replaceState({}, '', ctx.previousPath || '/');
        openUpgradeModal('business');
        return null;
      }
      await loadStylesheet('/css/components/component-brand.css');
      const { createBrandView } = await import('../views/brand.view.js');
      return [await createBrandView()];
    },
  },
  {
    id: 'teams',
    match: (path) => path === '/teams',
    handler: async (ctx) => {
      if (!currentUser) {
        window.history.replaceState({}, '', '/login');
        const { createLoginView } = await import('../views/auth.view.js');
        return [await createLoginView()];
      }
      if (!hasFeature('teams', currentUser)) {
        window.history.replaceState({}, '', ctx.previousPath || '/');
        openUpgradeModal('business');
        return null;
      }
      const { createTeamsView } = await import('../views/teams.view.js');
      return [await createTeamsView()];
    },
  },
  {
    id: 'templates-my',
    match: (path) => path === '/templates/my-templates',
    handler: async () => {
      if (!currentUser || !canPublishTemplates(currentUser)) {
        window.history.replaceState({}, '', '/templates');
      }
      const { createTemplatesView } = await import('../views/templates.view.js');
      return [await createTemplatesView()];
    },
  },
  {
    id: 'templates',
    match: (path) => path === '/templates',
    handler: async () => {
      const { createTemplatesView } = await import('../views/templates.view.js');
      return [await createTemplatesView()];
    },
  },
  {
    id: 'designer',
    match: (path) => path === '/designer' || (path.startsWith('/designer') && path !== '/designer/apply'),
    handler: async () => {
      if (!currentUser) {
        window.history.replaceState({}, '', '/login');
        const { createLoginView } = await import('../views/auth.view.js');
        return [await createLoginView()];
      }
      if (!canPublishTemplates(currentUser)) {
        window.history.replaceState({}, '', '/creators');
        await loadStylesheet('/css/components/component-creators.css');
        const { createCreatorsView } = await import('../views/creators.view.js');
        return [await createCreatorsView()];
      }
      const { createDesignerView } = await import('../views/designer.view.js');
      return [await createDesignerView()];
    },
  },
  {
    id: 'creators-apply',
    match: (path) => path === '/creators/apply' || path === '/apply-designer' || path === '/designer/apply',
    handler: async () => {
      if (!currentUser) {
        window.history.replaceState({}, '', '/login');
        const { createLoginView } = await import('../views/auth.view.js');
        return [await createLoginView()];
      }
      await loadStylesheet('/css/components/component-creators.css');
      const { createDesignerApplyView } = await import('../views/designer-apply.view.js');
      return [await createDesignerApplyView()];
    },
  },
  {
    id: 'creators',
    match: (path) => path === '/creators',
    handler: async () => {
      await loadStylesheet('/css/components/component-creators.css');
      const { createCreatorsView } = await import('../views/creators.view.js');
      return [await createCreatorsView()];
    },
  },
  {
    id: 'search',
    match: (path) => path === '/search',
    handler: async () => {
      const { createSearchView } = await import('../views/search.view.js');
      return [await createSearchView()];
    },
  },
  {
    id: 'shared',
    match: (path) => path === '/shared',
    handler: async () => {
      if (!currentUser) {
        window.history.replaceState({}, '', '/login');
        const { createLoginView } = await import('../views/auth.view.js');
        return [await createLoginView()];
      }
      const { createSharedView } = await import('../views/shared.view.js');
      return [await createSharedView()];
    },
  },
  {
    id: 'your-apps',
    match: (path) => path === '/your-apps',
    handler: async () => {
      const { createYourAppsView } = await import('../views/your-apps.view.js');
      return [await createYourAppsView()];
    },
  },
  {
    id: 'trash',
    match: (path) => path === '/trash',
    handler: async () => {
      const { createTrashView } = await import('../views/trash.view.js');
      return [await createTrashView()];
    },
  },
  {
    id: 'upgrade',
    match: (path) => path === '/upgrade',
    handler: async () => {
      const { createUpgradeView } = await import('../views/upgrade.view.js');
      return [await createUpgradeView()];
    },
  },
  {
    id: 'sales-contact',
    match: (path) => path === '/contact/sales' || path === '/sales',
    handler: async () => {
      const { createSalesContactView } = await import('../views/sales-contact.view.js');
      return [await createSalesContactView()];
    },
  },
  {
    id: 'settings',
    match: (path) => path.startsWith('/settings'),
    handler: async ({ path }) => {
      const { createAccessibilityView, createBillingView, createGuestSettingsView, createPublicProfileSettingsView, createPurchasesView, createSecurityView, createYourAccountView } = await import('../views/settings.view.js');
      if (!currentUser) {
        if (path !== '/settings/guest') {
          window.history.replaceState({}, '', '/settings/guest');
        }
        return [await createGuestSettingsView()];
      }

      if (path === '/settings' || path === '/settings/guest') {
        window.history.replaceState({}, '', '/settings/your-account');
      }
      const subPath = path === '/settings' || path === '/settings/guest' ? '/settings/your-account' : path;
      switch (subPath) {
        case '/settings/profile':
        case '/settings/public-profile':
          return [await createPublicProfileSettingsView()];
        case '/settings/security':
        case '/settings/login-and-security':
          return [await createSecurityView()];
        case '/settings/billing':
          return [await createBillingView()];
        case '/settings/purchases':
          return [await createPurchasesView()];
        case '/settings/accessibility':
          return [await createAccessibilityView()];
        case '/settings/your-account':
        default:
          return [await createYourAccountView()];
      }
    },
  },
  {
    id: 'help-legal',
    match: (path) => path.startsWith('/help') || path.startsWith('/legal'),
    handler: async ({ path }) => {
      const { createHelpView } = await import('../views/help.view.js');
      let tab = 'terms';
      if (path === '/help/privacy' || path === '/legal/privacy') tab = 'privacy';
      else if (path === '/help/cookies' || path === '/legal/cookies') tab = 'cookies';
      else if (path === '/help/legal-notice' || path === '/legal/legal-notice' || path === '/help/legal') tab = 'legal_notice';
      else if (path === '/help/billing' || path === '/legal/billing') tab = 'billing';
      else if (path === '/help/support' || path === '/help/feedback' || path === '/help/contact') tab = 'support';
      return [await createHelpView(tab)];
    },
  },
  {
    id: 'download',
    match: (path) => path === '/download' || path === '/download/' || path.startsWith('/download/'),
    handler: async ({ path }) => {
      await loadStylesheet('/css/components/component-download.css');
      const { createDownloadView, detectClientOs } = await import('../views/download.view.js');
      let targetOs: 'windows' | 'mac' | 'chromebook' = 'windows';
      if (path === '/download' || path === '/download/') {
        targetOs = detectClientOs();
        window.history.replaceState({}, '', `/download/${targetOs}`);
      } else if (path === '/download/mac') {
        targetOs = 'mac';
      } else if (path === '/download/chromebook') {
        targetOs = 'chromebook';
      } else {
        targetOs = 'windows';
      }
      return [await createDownloadView(targetOs)];
    },
  },
  {
    id: 'home',
    match: (path) => path === '/' || path === '',
    handler: async () => {
      const { createHomeView } = await import('../views/home.view.js');
      return [await createHomeView()];
    },
  },
  {
    id: 'folder',
    match: (path) => path.startsWith('/folder/'),
    handler: async ({ path }) => {
      const folderUuid = path.split('/folder/')[1]?.split('/')[0] || '';
      const { createFolderView } = await import('../views/folder.view.js');
      return [await createFolderView(folderUuid)];
    },
  },
  {
    id: 'canvas-design',
    match: (path) =>
      path === '/design' || path === '/design/' || path.startsWith('/design/') ||
      path === '/board' || path === '/board/' || path.startsWith('/board/') ||
      path === '/doc' || path === '/doc/' || path.startsWith('/doc/') ||
      path === '/presentation' || path === '/presentation/' || path.startsWith('/presentation/'),
    handler: async ({ path }) => {
      const match = path.match(/^\/(?:design|board|doc|presentation)(?:\/([a-zA-Z0-9_-]+))?/);
      const canvasUuid = match?.[1] || '';
      if (!canvasUuid) {
        window.history.replaceState({}, '', '/');
        const { createHomeView } = await import('../views/home.view.js');
        return [await createHomeView()];
      }
      if (!path.startsWith(`/design/${canvasUuid}`)) {
        window.history.replaceState({}, '', `/design/${canvasUuid}`);
      }
      const { createDesignView } = await import('../views/design.view.js');
      return [await createDesignView(canvasUuid)];
    },
  },
  {
    id: 'user-profile',
    match: (path) => path.startsWith('/p/'),
    handler: async ({ path }) => {
      const username = path.substring(3).split('/')[0].trim();
      if (!username) {
        window.history.replaceState({}, '', '/templates');
        const { createTemplatesView } = await import('../views/templates.view.js');
        return [await createTemplatesView()];
      }
      const { createProfileView } = await import('../views/profile.view.js');
      return [await createProfileView(username)];
    },
  },
  {
    id: 'share-or-slug',
    match: (path) => path.startsWith('/s/') || path.startsWith('/share/') || /^\/[a-zA-Z0-9_-]{3,50}$/.test(path),
    handler: async ({ path }) => {
      const slug = path.startsWith('/s/')
        ? path.slice(3)
        : path.startsWith('/share/')
        ? path.slice(7)
        : path.slice(1);
      let resolvedUuid: string | null = null;
      try {
        const res = await getApi(API_ROUTES.canvases.resolveSlug(slug));
        if (res.ok) {
          const data = await res.json();
          if (data?.uuid) {
            resolvedUuid = data.uuid;
          }
        }
      } catch {}

      if (resolvedUuid) {
        const targetPath = `/design/${resolvedUuid}`;
        window.history.replaceState({}, '', targetPath);
        const { createDesignView } = await import('../views/design.view.js');
        return [await createDesignView(resolvedUuid)];
      }

      const { createErrorView } = await import('../views/error.view.js');
      return [await createErrorView({
        code: '404',
        description: `La ruta "${path}" no existe o ha sido movida.`,
        title: 'Página no encontrada',
      })];
    },
  },
];

export function findRoute(path: string): RouteDefinition | undefined {
  return APP_ROUTES.find((route) => {
    const res = route.match(path);
    return res === true || (typeof res === 'object' && res !== null);
  });
}
