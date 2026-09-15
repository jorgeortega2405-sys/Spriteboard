import { t } from './i18n.service.js';

export interface BottomBannerAction {
  className?: string;
  dataRef?: string;
  label: string;
  onClick?: (dismiss: () => void) => void | Promise<void>;
}

export interface BottomBannerOptions {
  actions?: BottomBannerAction[];
  description?: string;
  id: string;
  position?: 'center' | 'left' | 'right';
  title: string;
  width?: '1024px' | '465px' | string;
}

const activeBanners = new Map<string, { dismiss: () => void; element: HTMLElement }>();

export function showBottomBanner(options: BottomBannerOptions): () => void {
  const { actions = [], description = '', id, position = 'center', title, width = '1024px' } = options;

  if (activeBanners.has(id)) {
    activeBanners.get(id)?.dismiss();
  }

  const bannerEl = document.createElement('div');
  const widthModifier = width === '465px' ? 'bottom-message-banner--w-465' : 'bottom-message-banner--w-1024';
  const posModifier = `bottom-message-banner--${position}`;

  bannerEl.className = `bottom-message-banner ${posModifier} ${widthModifier}`;
  bannerEl.setAttribute('data-ref', `bottom-banner-${id}`);

  bannerEl.innerHTML = `
    <div class="bottom-message-banner__content" data-ref="bottom-banner-content">
      <h3 class="bottom-message-banner__title" data-ref="bottom-banner-title">${title}</h3>
      ${description ? `<p class="bottom-message-banner__desc" data-ref="bottom-banner-desc">${description}</p>` : ''}
    </div>
    <div class="bottom-message-banner__actions" data-ref="bottom-banner-actions"></div>
  `;

  const actionsContainer = bannerEl.querySelector<HTMLElement>('[data-ref="bottom-banner-actions"]');

  let isDismissed = false;
  const dismiss = () => {
    if (isDismissed) return;
    isDismissed = true;
    bannerEl.classList.remove('is-active');
    setTimeout(() => {
      bannerEl.remove();
      if (activeBanners.get(id)?.element === bannerEl) {
        activeBanners.delete(id);
      }
    }, 280);
  };

  actions.forEach((act) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = act.className || 'component-button component-button--h38 component-button--outline';
    if (act.dataRef) {
      btn.setAttribute('data-ref', act.dataRef);
    }
    btn.textContent = act.label;
    btn.addEventListener('click', () => {
      if (act.onClick) {
        void act.onClick(dismiss);
      } else {
        dismiss();
      }
    });
    actionsContainer?.appendChild(btn);
  });

  document.body.appendChild(bannerEl);
  requestAnimationFrame(() => {
    bannerEl.classList.add('is-active');
  });

  activeBanners.set(id, { dismiss, element: bannerEl });
  return dismiss;
}

export function hideBottomBanner(id: string): void {
  const active = activeBanners.get(id);
  if (active) {
    active.dismiss();
  }
}

export function initCookieBanner(): void {
  const savedConsent = localStorage.getItem('sb_cookie_consent');
  if (savedConsent) return;

  const bannerTitle = t('cookies.banner_title') || 'Preferencias de cookies y privacidad';
  const bannerDesc =
    t('cookies.banner_desc') ||
    'Utilizamos cookies y tecnologías similares para mejorar tu experiencia, analizar el rendimiento de la plataforma y personalizar funciones esenciales. Puedes aceptar todas las cookies, rechazar las no esenciales o administrar tus preferencias.';

  showBottomBanner({
    id: 'cookies-consent',
    position: 'center',
    width: '1024px',
    title: bannerTitle,
    description: bannerDesc,
    actions: [
      {
        label: t('cookies.btn_manage') || 'Administrar',
        className: 'component-button component-button--h38 component-button--outline',
        dataRef: 'btn-cookies-manage',
        onClick: () => {},
      },
      {
        label: t('cookies.btn_reject') || 'Rechazar cookies',
        className: 'component-button component-button--h38 component-button--outline',
        dataRef: 'btn-cookies-reject',
        onClick: (dismiss) => {
          localStorage.setItem('sb_cookie_consent', 'rejected');
          dismiss();
        },
      },
      {
        label: t('cookies.btn_accept') || 'Aceptar cookies',
        className: 'component-button component-button--h38 component-button--black',
        dataRef: 'btn-cookies-accept',
        onClick: (dismiss) => {
          localStorage.setItem('sb_cookie_consent', 'accepted');
          dismiss();
        },
      },
    ],
  });
}
