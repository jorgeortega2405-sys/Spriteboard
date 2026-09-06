import { loadTemplate } from '../../services/template.service.js';
import { createSidebar } from '../../components/sidebar.component.js';
import { t, translateElement } from '../../services/i18n.service.js';

const HELP_SECTIONS_DATA = {
  terms: {
    titleKey: 'help_center.terms_title',
    defaultTitle: 'Términos y condiciones',
    subtitleKey: 'help_center.terms_subtitle',
    defaultSubtitle: 'Condiciones generales de uso, derechos y responsabilidades en el uso de la plataforma Spriteboard.',
  },
  privacy: {
    titleKey: 'help_center.privacy_title',
    defaultTitle: 'Política de privacidad',
    subtitleKey: 'help_center.privacy_subtitle',
    defaultSubtitle: 'Información sobre la recopilación, almacenamiento y protección rigurosa de tus datos personales.',
  },
  cookies: {
    titleKey: 'help_center.cookies_title',
    defaultTitle: 'Política de cookies',
    subtitleKey: 'help_center.cookies_subtitle',
    defaultSubtitle: 'Detalle de las cookies técnicas, analíticas y de preferencias empleadas en la aplicación.',
  },
  legal_notice: {
    titleKey: 'help_center.legal_title',
    defaultTitle: 'Aviso legal',
    subtitleKey: 'help_center.legal_subtitle',
    defaultSubtitle: 'Identificación corporativa, titularidad legal del servicio y marco normativo aplicable.',
  },
  billing: {
    titleKey: 'help_center.billing_title',
    defaultTitle: 'Condiciones de facturación',
    subtitleKey: 'help_center.billing_subtitle',
    defaultSubtitle: 'Condiciones de contratación recurrente, procesamiento seguro de pagos, impuestos y cancelaciones.',
  },
  support: {
    titleKey: 'help_center.support_title',
    defaultTitle: 'Ayuda y comentarios',
    subtitleKey: 'help_center.support_subtitle',
    defaultSubtitle: 'Centro de asistencia, resolución de dudas frecuentes y recepción de comentarios para mejorar la plataforma.',
  },
};

export async function createHelpView(sectionKey = 'terms') {
  const container = await loadTemplate('/views/help/help-section.html');

  // Insertar la barra lateral (sidebar)
  const sidebar = await createSidebar();
  container.prepend(sidebar);

  const sectionData = HELP_SECTIONS_DATA[sectionKey] || HELP_SECTIONS_DATA.terms;
  const titleEl = container.querySelector('[data-ref="help-title"]');
  const subtitleEl = container.querySelector('[data-ref="help-subtitle"]');

  if (titleEl) {
    titleEl.setAttribute('data-i18n', sectionData.titleKey);
    titleEl.textContent = t(sectionData.titleKey) || sectionData.defaultTitle;
  }

  if (subtitleEl) {
    subtitleEl.setAttribute('data-i18n', sectionData.subtitleKey);
    subtitleEl.textContent = t(sectionData.subtitleKey) || sectionData.defaultSubtitle;
  }

  translateElement(container);

  return container;
}
