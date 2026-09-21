import { API_ROUTES } from '../config/api-routes.js';
import { getApi } from '../services/api.service.js';
import { renderIcons } from '../services/icon.service.js';
import { CanvasMetricsData } from '../types/canvas.types.js';

let activeCanvasMetricsModal: { close: () => void } | null = null;

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return '0 s';
  if (seconds < 60) return `${seconds} s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) {
    return secs > 0 ? `${mins} min ${secs} s` : `${mins} min`;
  }
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hours} h ${remMins} min` : `${hours} h`;
}

function formatDateTime(isoStr: string): string {
  if (!isoStr) return '-';
  try {
    const d = new Date(isoStr);
    const dateStr = d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    return `${dateStr} a las ${timeStr}`;
  } catch {
    return isoStr;
  }
}

export function openCanvasMetricsModal(canvasUuid: string, canvasName: string): void {
  if (activeCanvasMetricsModal) {
    activeCanvasMetricsModal.close();
  }

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.setAttribute('data-ref', 'modal-canvas-metrics-backdrop');

  backdrop.innerHTML = `
    <div class="modal-container" data-ref="modal-canvas-metrics-container">
      <button type="button" class="modal-close-btn" data-ref="btn-modal-close" aria-label="Cerrar ventana">
        <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
      </button>
      <div class="modal-card modal-card--create-canvas no-padding" data-ref="modal-card-canvas-metrics">
        <div class="modal-card__drag-zone" data-ref="modal-drag-zone" aria-hidden="true">
          <div class="modal-card__drag-handle"></div>
        </div>

        <div class="modal-create-canvas__sidebar" data-ref="modal-metrics-sidebar">
          <div class="modal-create-canvas__sidebar-top" data-ref="modal-metrics-sidebar-top">
            <div class="component-top-left" data-ref="modal-metrics-top-left">
              <h1 class="component-top-title">Métricas</h1>
            </div>
          </div>
          <div class="modal-create-canvas__sidebar-bottom" data-ref="modal-metrics-sidebar-bottom">
            <div class="menu-panel__list" data-ref="modal-metrics-nav-list">
              <button type="button" class="menu-item is-active" data-ref="tab-metrics-views">
                <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#visibility"></use></svg>
                <span class="menu-item__text">Vistas</span>
              </button>
            </div>
          </div>
        </div>

        <div class="modal-create-canvas__body" data-ref="modal-metrics-body">
          <div class="modal-create-canvas__body-top" data-ref="modal-metrics-body-top">
            <div class="component-top-left">
              <h2 class="component-top-title" data-ref="metrics-canvas-name">${escapeHtml(canvasName)}</h2>
            </div>
          </div>

          <div class="modal-create-canvas__body-bottom" data-ref="modal-metrics-body-bottom">
            <div class="metrics-loading-state" data-ref="metrics-loading-state" style="display: flex; flex-direction: column; gap: 16px; width: 100%; padding: 8px 0;">
              <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;">
                <div class="skeleton" style="height: 72px; border-radius: 12px;"></div>
                <div class="skeleton" style="height: 72px; border-radius: 12px;"></div>
                <div class="skeleton" style="height: 72px; border-radius: 12px;"></div>
              </div>
              <div class="skeleton" style="height: 200px; border-radius: 14px; width: 100%;"></div>
            </div>

            <div class="metrics-content-container" data-ref="metrics-content" style="display: none; flex-direction: column; gap: 20px; width: 100%;">
              <div class="metrics-summary-grid" data-ref="metrics-summary-grid">
                <div class="metrics-stat-card" data-ref="card-unique-viewers">
                  <div class="metrics-stat-card__icon-box">
                    <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#group"></use></svg>
                  </div>
                  <div class="metrics-stat-card__info">
                    <span class="metrics-stat-card__label">Total de personas</span>
                    <span class="metrics-stat-card__value" data-ref="val-unique-viewers">0</span>
                  </div>
                </div>

                <div class="metrics-stat-card" data-ref="card-total-views">
                  <div class="metrics-stat-card__icon-box">
                    <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#visibility"></use></svg>
                  </div>
                  <div class="metrics-stat-card__info">
                    <span class="metrics-stat-card__label">Total de visualizaciones</span>
                    <span class="metrics-stat-card__value" data-ref="val-total-views">0</span>
                  </div>
                </div>

                <div class="metrics-stat-card" data-ref="card-avg-duration">
                  <div class="metrics-stat-card__icon-box">
                    <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#timer"></use></svg>
                  </div>
                  <div class="metrics-stat-card__info">
                    <span class="metrics-stat-card__label">Tiempo promedio</span>
                    <span class="metrics-stat-card__value" data-ref="val-avg-duration">0 s</span>
                  </div>
                </div>
              </div>

              <div class="metrics-section" data-ref="section-registered-viewers">
                <div class="metrics-section__header">
                  <h3 class="preset-category__title">Espectadores registrados</h3>
                  <p class="settings-item__desc">Usuarios registrados con cuenta que han visualizado este lienzo.</p>
                </div>
                <div class="metrics-table-wrapper" data-ref="wrapper-registered-viewers">
                  <table class="metrics-table" data-ref="table-registered-viewers">
                    <thead>
                      <tr>
                        <th class="col-user">Usuario</th>
                        <th class="col-date">Última visita</th>
                        <th class="col-duration">Tiempo acumulado</th>
                        <th class="col-views">Visualizaciones</th>
                      </tr>
                    </thead>
                    <tbody data-ref="tbody-registered-viewers"></tbody>
                  </table>
                  <div class="metrics-table-empty" data-ref="empty-registered-viewers" style="display: none;">
                    <p class="settings-item__desc" style="text-align: center; margin: 0;">Aún no hay espectadores registrados en este lienzo.</p>
                  </div>
                </div>
              </div>

              <div class="metrics-section" data-ref="section-recent-views">
                <div class="metrics-section__header">
                  <h3 class="preset-category__title">Registro de actividad reciente</h3>
                  <p class="settings-item__desc">Historial en tiempo real de quién visualizó el lienzo, a qué hora y duración.</p>
                </div>
                <div class="metrics-table-wrapper" data-ref="wrapper-recent-views">
                  <table class="metrics-table" data-ref="table-recent-views">
                    <thead>
                      <tr>
                        <th class="col-user">Espectador</th>
                        <th class="col-date">Fecha y hora</th>
                        <th class="col-duration">Duración</th>
                      </tr>
                    </thead>
                    <tbody data-ref="tbody-recent-views"></tbody>
                  </table>
                  <div class="metrics-table-empty" data-ref="empty-recent-views" style="display: none;">
                    <p class="settings-item__desc" style="text-align: center; margin: 0;">No hay historial de visitas registrado todavía.</p>
                  </div>
                </div>
              </div>
            </div>

            <div class="banner banner--danger" data-ref="metrics-error-banner" style="display: none; margin-top: 16px;"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);
  document.body.classList.add('modal-open');
  renderIcons(backdrop);

  requestAnimationFrame(() => {
    backdrop.classList.add('is-visible');
  });

  const loadingEl = backdrop.querySelector<HTMLElement>('[data-ref="metrics-loading-state"]');
  const contentEl = backdrop.querySelector<HTMLElement>('[data-ref="metrics-content"]');
  const errorBanner = backdrop.querySelector<HTMLElement>('[data-ref="metrics-error-banner"]');
  const titleNameEl = backdrop.querySelector<HTMLElement>('[data-ref="metrics-canvas-name"]');

  const valUniqueViewers = backdrop.querySelector<HTMLElement>('[data-ref="val-unique-viewers"]');
  const valTotalViews = backdrop.querySelector<HTMLElement>('[data-ref="val-total-views"]');
  const valAvgDuration = backdrop.querySelector<HTMLElement>('[data-ref="val-avg-duration"]');

  const tableRegisteredViewers = backdrop.querySelector<HTMLElement>('[data-ref="table-registered-viewers"]');
  const tbodyRegisteredViewers = backdrop.querySelector<HTMLElement>('[data-ref="tbody-registered-viewers"]');
  const emptyRegisteredViewers = backdrop.querySelector<HTMLElement>('[data-ref="empty-registered-viewers"]');

  const tableRecentViews = backdrop.querySelector<HTMLElement>('[data-ref="table-recent-views"]');
  const tbodyRecentViews = backdrop.querySelector<HTMLElement>('[data-ref="tbody-recent-views"]');
  const emptyRecentViews = backdrop.querySelector<HTMLElement>('[data-ref="empty-recent-views"]');

  const showError = (msg: string) => {
    if (loadingEl) loadingEl.style.display = 'none';
    if (contentEl) contentEl.style.display = 'none';
    if (errorBanner) {
      errorBanner.textContent = msg;
      errorBanner.style.display = 'block';
    }
  };

  const renderMetricsData = (metrics: CanvasMetricsData) => {
    if (titleNameEl && metrics.canvas_name) {
      titleNameEl.textContent = metrics.canvas_name;
    }

    if (valUniqueViewers) {
      valUniqueViewers.textContent = metrics.unique_viewers.toLocaleString('es-ES');
    }
    if (valTotalViews) {
      valTotalViews.textContent = metrics.total_views.toLocaleString('es-ES');
    }
    if (valAvgDuration) {
      valAvgDuration.textContent = formatDuration(metrics.avg_duration_seconds);
    }

    if (tbodyRegisteredViewers && emptyRegisteredViewers && tableRegisteredViewers) {
      if (!metrics.viewers || metrics.viewers.length === 0) {
        tbodyRegisteredViewers.innerHTML = '';
        tableRegisteredViewers.style.display = 'none';
        emptyRegisteredViewers.style.display = 'flex';
      } else {
        tableRegisteredViewers.style.display = 'table';
        emptyRegisteredViewers.style.display = 'none';
        tbodyRegisteredViewers.innerHTML = metrics.viewers
          .map((v) => {
            const fallbackAvatar = API_ROUTES.avatar(v.username);
            const avatarSrc = v.avatar_url || fallbackAvatar;
            return `
              <tr data-ref="viewer-row-${v.user_id}">
                <td class="col-user">
                  <div class="metrics-user-cell">
                    <div class="metrics-user-avatar">
                      <img class="avatar-preview-img image-lazy-fade" src="${avatarSrc}" alt="${escapeHtml(v.username)}" referrerpolicy="no-referrer" onload="this.classList.add('image-loaded')" onerror="this.onerror=null; this.src='${fallbackAvatar}'; this.classList.add('image-loaded')" />
                    </div>
                    <span class="metrics-user-name">${escapeHtml(v.username)}</span>
                  </div>
                </td>
                <td class="col-date">${formatDateTime(v.last_viewed_at)}</td>
                <td class="col-duration">${formatDuration(v.total_duration_seconds)}</td>
                <td class="col-views">
                  <span class="metrics-views-badge">${v.views_count} ${v.views_count === 1 ? 'vista' : 'vistas'}</span>
                </td>
              </tr>
            `;
          })
          .join('');
      }
    }

    if (tbodyRecentViews && emptyRecentViews && tableRecentViews) {
      if (!metrics.recent_views || metrics.recent_views.length === 0) {
        tbodyRecentViews.innerHTML = '';
        tableRecentViews.style.display = 'none';
        emptyRecentViews.style.display = 'flex';
      } else {
        tableRecentViews.style.display = 'table';
        emptyRecentViews.style.display = 'none';
        tbodyRecentViews.innerHTML = metrics.recent_views
          .map((view) => {
            const fallbackAvatar = API_ROUTES.avatar(view.username);
            const avatarSrc = view.avatar_url || fallbackAvatar;
            return `
              <tr data-ref="recent-row-${view.id}">
                <td class="col-user">
                  <div class="metrics-user-cell">
                    <div class="metrics-user-avatar">
                      ${
                        view.is_registered
                          ? `<img class="avatar-preview-img image-lazy-fade" src="${avatarSrc}" alt="${escapeHtml(view.username)}" referrerpolicy="no-referrer" onload="this.classList.add('image-loaded')" onerror="this.onerror=null; this.src='${fallbackAvatar}'; this.classList.add('image-loaded')" />`
                          : `<div class="metrics-user-icon-device"><svg class="component-icon" aria-hidden="true"><use href="/icons.svg#devices"></use></svg></div>`
                      }
                    </div>
                    <span class="metrics-user-name">${escapeHtml(view.username)}</span>
                  </div>
                </td>
                <td class="col-date">${formatDateTime(view.viewed_at)}</td>
                <td class="col-duration">${formatDuration(view.duration_seconds)}</td>
              </tr>
            `;
          })
          .join('');
      }
    }

    renderIcons(contentEl || backdrop);
  };

  const fetchMetrics = async () => {
    if (loadingEl) loadingEl.style.display = 'flex';
    if (contentEl) contentEl.style.display = 'none';
    if (errorBanner) errorBanner.style.display = 'none';

    try {
      const response = await getApi(API_ROUTES.canvases.metrics(canvasUuid));
      if (!response.ok) {
        showError('No se pudieron obtener las estadísticas del lienzo.');
        return;
      }
      const data = (await response.json()) as { metrics: CanvasMetricsData };
      if (!data || !data.metrics) {
        showError('No se pudieron obtener las estadísticas del lienzo.');
        return;
      }
      renderMetricsData(data.metrics);
      if (loadingEl) loadingEl.style.display = 'none';
      if (contentEl) contentEl.style.display = 'flex';
    } catch {
      showError('Ocurrió un error al cargar las estadísticas del lienzo.');
    }
  };

  void fetchMetrics();

  const card = backdrop.querySelector<HTMLElement>('[data-ref="modal-card-canvas-metrics"]');
  const dragZone = backdrop.querySelector<HTMLElement>('[data-ref="modal-drag-zone"]');
  let startY = 0;
  let currentY = 0;
  let startTime = 0;
  let isDragging = false;
  let activePointerId: number | null = null;
  let isClosing = false;

  const detachPointerListeners = () => {
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);
  };

  const onPointerDown = (e: PointerEvent) => {
    if (isClosing || !card) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    isDragging = true;
    activePointerId = e.pointerId;
    startY = e.clientY;
    currentY = startY;
    startTime = performance.now();

    try {
      (dragZone || card).setPointerCapture(activePointerId);
    } catch (_) {}

    card.style.transition = 'none';
    backdrop.style.transition = 'none';

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!isDragging || (activePointerId !== null && e.pointerId !== activePointerId)) return;
    currentY = e.clientY;
    const diff = currentY - startY;

    if (card) {
      if (diff > 0) {
        card.style.transform = `translateY(${diff}px)`;
        const progress = Math.min(diff / 240, 1);
        backdrop.style.opacity = `${Math.max(0.2, 1 - progress * 0.8)}`;
      } else {
        const rubberDiff = Math.max(diff * 0.15, -24);
        card.style.transform = `translateY(${rubberDiff}px)`;
      }
    }
  };

  const onPointerUp = (e: PointerEvent) => {
    if (!isDragging || (activePointerId !== null && e.pointerId !== activePointerId)) return;
    isDragging = false;
    detachPointerListeners();

    try {
      if (activePointerId !== null) {
        (dragZone || card)?.releasePointerCapture(activePointerId);
      }
    } catch (_) {}
    activePointerId = null;

    const diff = currentY - startY;
    const elapsed = Math.max(1, performance.now() - startTime);
    const velocity = diff / elapsed;

    if (diff > 80 || (diff > 25 && velocity > 0.45)) {
      closeModal();
    } else {
      backdrop.style.transition = 'opacity 0.25s ease';
      backdrop.style.opacity = '1';
      if (card) {
        card.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)';
        card.style.transform = '';
      }
    }
  };

  dragZone?.addEventListener('pointerdown', onPointerDown);
  dragZone?.addEventListener('lostpointercapture', onPointerUp);

  const closeModal = () => {
    if (isClosing) return;
    isClosing = true;

    backdrop.classList.remove('is-visible');
    document.removeEventListener('keydown', onKeyDown);
    detachPointerListeners();
    dragZone?.removeEventListener('pointerdown', onPointerDown);
    dragZone?.removeEventListener('lostpointercapture', onPointerUp);

    setTimeout(() => {
      if (backdrop.parentNode) {
        backdrop.parentNode.removeChild(backdrop);
      }
      document.body.classList.remove('modal-open');
      if (activeCanvasMetricsModal === modalInstance) {
        activeCanvasMetricsModal = null;
      }
    }, 200);
  };

  const modalInstance = { close: closeModal };
  activeCanvasMetricsModal = modalInstance;

  const closeBtn = backdrop.querySelector<HTMLElement>('[data-ref="btn-modal-close"]');
  closeBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    closeModal();
  });

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) {
      e.preventDefault();
      closeModal();
    }
  });

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeModal();
    }
  };
  document.addEventListener('keydown', onKeyDown);
}
