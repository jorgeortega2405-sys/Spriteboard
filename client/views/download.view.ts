import { navigate } from '../app-router.js';
import { loadTemplate } from '../services/template.service.js';
import { ViewController } from '../types/common.types.js';

export type TargetOs = 'windows' | 'mac' | 'chromebook';

export function detectClientOs(): TargetOs {
  const ua = (navigator.userAgent || '').toLowerCase();
  const platform = ((navigator as any).userAgentData?.platform || navigator.platform || '').toLowerCase();

  if (ua.includes('cros') || ua.includes('chromebook')) {
    return 'chromebook';
  }
  if (platform.includes('mac') || ua.includes('macintosh') || ua.includes('mac os x')) {
    return 'mac';
  }
  return 'windows';
}

class DownloadViewController implements ViewController {
  private abortController: AbortController | null = null;
  private container: HTMLElement;
  private currentOs: TargetOs;

  constructor(container: HTMLElement, os: TargetOs) {
    this.container = container;
    this.currentOs = os;
  }

  public init(): void {
    this.abortController = new AbortController();
    this.renderOsView();
    this.bindEvents();
  }

  private renderOsView(): void {
    const isDesktopApp = Boolean((window as unknown as { spriteDesktop?: { isDesktop?: boolean } }).spriteDesktop?.isDesktop);
    const titleEl = this.container.querySelector<HTMLElement>('[data-ref="download-title"]');
    const descEl = this.container.querySelector<HTMLElement>('[data-ref="download-desc"]');
    const sectionWindows = this.container.querySelector<HTMLElement>('[data-ref="section-windows"]');
    const sectionMac = this.container.querySelector<HTMLElement>('[data-ref="section-mac"]');
    const sectionChromebook = this.container.querySelector<HTMLElement>('[data-ref="section-chromebook"]');
    const sectionInstalled = this.container.querySelector<HTMLElement>('[data-ref="section-installed"]');
    const dividerEl = this.container.querySelector<HTMLElement>('[data-ref="download-divider"]');
    const footerEl = this.container.querySelector<HTMLElement>('[data-ref="download-footer"]');
    const footerContainer = this.container.querySelector<HTMLElement>('[data-ref="footer-links-container"]');

    if (isDesktopApp) {
      if (titleEl) titleEl.textContent = 'Spriteboard para Escritorio';
      if (descEl) descEl.textContent = 'Estás ejecutando la aplicación nativa de Spriteboard.';
      if (sectionWindows) sectionWindows.style.display = 'none';
      if (sectionMac) sectionMac.style.display = 'none';
      if (sectionChromebook) sectionChromebook.style.display = 'none';
      if (sectionInstalled) sectionInstalled.style.display = 'flex';
      if (dividerEl) dividerEl.style.display = 'none';
      if (footerEl) footerEl.style.display = 'none';
      return;
    }

    if (sectionInstalled) sectionInstalled.style.display = 'none';
    if (dividerEl) dividerEl.style.display = '';
    if (footerEl) footerEl.style.display = '';

    if (titleEl) {
      if (this.currentOs === 'windows') {
        titleEl.textContent = 'Spriteboard for Windows';
      } else if (this.currentOs === 'mac') {
        titleEl.textContent = 'Spriteboard for Mac';
      } else {
        titleEl.textContent = 'Spriteboard for Chromebook';
      }
    }

    if (descEl) {
      if (this.currentOs === 'windows') {
        descEl.textContent = 'Your favorite design tool available as a desktop app for Windows.';
      } else if (this.currentOs === 'mac') {
        descEl.textContent = 'Your favorite design tool available as a desktop app for Mac.';
      } else {
        descEl.textContent = 'Your favorite design tool available for Chromebook.';
      }
    }

    if (sectionWindows) sectionWindows.style.display = this.currentOs === 'windows' ? 'flex' : 'none';
    if (sectionMac) sectionMac.style.display = this.currentOs === 'mac' ? 'flex' : 'none';
    if (sectionChromebook) sectionChromebook.style.display = this.currentOs === 'chromebook' ? 'flex' : 'none';

    if (footerContainer) {
      footerContainer.innerHTML = '';
      const otherOptions: { label: string; os: TargetOs; path: string }[] = [];

      if (this.currentOs !== 'windows') {
        otherOptions.push({ label: 'Windows', os: 'windows', path: '/download/windows' });
      }
      if (this.currentOs !== 'mac') {
        otherOptions.push({ label: 'Mac OS', os: 'mac', path: '/download/mac' });
      }
      if (this.currentOs !== 'chromebook') {
        otherOptions.push({ label: 'Chromebook', os: 'chromebook', path: '/download/chromebook' });
      }

      otherOptions.forEach((opt, idx) => {
        const link = document.createElement('a');
        link.className = 'download-page__link';
        link.setAttribute('data-ref', `link-download-${opt.os}`);
        link.setAttribute('href', opt.path);
        link.textContent = opt.label;
        link.addEventListener('click', (e) => {
          e.preventDefault();
          navigate(opt.path);
        });

        footerContainer.appendChild(link);
        if (idx < otherOptions.length - 1) {
          footerContainer.appendChild(document.createTextNode(', '));
        }
      });
    }
  }

  public bindEvents(): void {
    const signal = this.abortController?.signal;

    const btnOpenHomeInstalled = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-open-home-installed"]');
    btnOpenHomeInstalled?.addEventListener(
      'click',
      () => {
        navigate('/');
      },
      { signal }
    );

    const btnCheckUpdates = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-check-updates-installed"]');
    btnCheckUpdates?.addEventListener(
      'click',
      () => {
        const spriteDesktop = (window as unknown as { spriteDesktop?: { checkForUpdates?: (manual?: boolean) => void } }).spriteDesktop;
        if (spriteDesktop?.checkForUpdates) {
          spriteDesktop.checkForUpdates(true);
        }
      },
      { signal }
    );

    const btnDownloadWindows = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-download-windows"]');
    btnDownloadWindows?.addEventListener(
      'click',
      () => {
        const textSpan = btnDownloadWindows.querySelector<HTMLElement>('[data-ref="btn-download-text"]');
        if (textSpan) {
          textSpan.textContent = 'Iniciando descarga...';
          setTimeout(() => {
            textSpan.textContent = 'Download Spriteboard for Windows';
          }, 3000);
        }
        window.location.href = '/api/download/windows';
      },
      { signal }
    );

    const btnOpenWebMac = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-open-web-mac"]');
    btnOpenWebMac?.addEventListener(
      'click',
      () => {
        navigate('/');
      },
      { signal }
    );

    const btnOpenWebChromebook = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-open-web-chromebook"]');
    btnOpenWebChromebook?.addEventListener(
      'click',
      () => {
        navigate('/');
      },
      { signal }
    );
  }

  public destroy(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }
}

export async function createDownloadView(os: TargetOs): Promise<HTMLElement> {
  const container = await loadTemplate('/views/download/download.html');
  const controller = new DownloadViewController(container, os);
  controller.init();
  (container as any).__controller = controller;
  return container;
}
