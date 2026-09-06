/**
 * Vista de Historial de Compras (/settings/purchases)
 * Layout Tabular: component-top (título + buscador flotante) y component-bottom (tabla)
 * CERO atributos id, orden estricto de atributos, sin console.*
 */

import { loadTemplate } from '../../services/template.service.js';
import { createSidebar } from '../../components/sidebar.component.js';
import { t, translateElement } from '../../services/i18n.service.js';
import { getPurchaseHistoryApi, escapeHtml } from '../../services/api.service.js';

export async function createPurchasesView() {
  const container = await loadTemplate('/views/settings/purchases.html');
  translateElement(container);

  // Insertar la barra lateral (sidebar) dentro del contenedor
  const sidebar = await createSidebar();
  container.prepend(sidebar);

  const tbody = container.querySelector('[data-ref="purchases-tbody"]');
  const tableWrapper = container.querySelector('[data-ref="purchases-table-wrapper"]');
  const tableEl = container.querySelector('[data-ref="purchases-table"]');
  const emptyState = container.querySelector('[data-ref="purchases-empty-state"]');
  const emptyText = container.querySelector('[data-ref="purchases-empty-text"]');

  // Elementos de la barra de búsqueda flotante
  const btnToggleSearch = container.querySelector('[data-ref="btn-toggle-search"]');
  const searchToolbar = container.querySelector('[data-ref="search-toolbar"]');
  const searchInput = container.querySelector('[data-ref="purchases-search-input"]');
  const btnClearSearch = container.querySelector('[data-ref="btn-clear-search"]');

  let allPurchases = [];
  let isSearchActive = false;

  // Toggle de la toolbar de búsqueda flotante
  const toggleSearchToolbar = (forceState) => {
    isSearchActive = forceState !== undefined ? forceState : !isSearchActive;

    if (searchToolbar) {
      searchToolbar.classList.toggle('is-active', isSearchActive);
      searchToolbar.classList.toggle('is-hidden', !isSearchActive);
    }

    if (btnToggleSearch) {
      btnToggleSearch.classList.toggle('is-active', isSearchActive);
    }

    if (isSearchActive && searchInput) {
      setTimeout(() => {
        searchInput.focus();
      }, 50);
    }
  };

  btnToggleSearch?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleSearchToolbar();
  });

  // Cerrar buscador al hacer clic fuera
  document.addEventListener('click', (e) => {
    if (!isSearchActive) return;
    if (searchToolbar && !searchToolbar.contains(e.target) && btnToggleSearch && !btnToggleSearch.contains(e.target)) {
      toggleSearchToolbar(false);
    }
  });

  // Cerrar con tecla Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isSearchActive) {
      toggleSearchToolbar(false);
    }
  });

  // Botón para limpiar campo de búsqueda
  btnClearSearch?.addEventListener('click', (e) => {
    e.preventDefault();
    if (searchInput) {
      searchInput.value = '';
      btnClearSearch.style.display = 'none';
      renderRows(allPurchases);
      searchInput.focus();
    }
  });

  // Filtrado en vivo al escribir en el buscador
  searchInput?.addEventListener('input', () => {
    const query = searchInput.value.trim().toLowerCase();
    if (btnClearSearch) {
      btnClearSearch.style.display = query.length > 0 ? 'inline-flex' : 'none';
    }

    if (!query) {
      renderRows(allPurchases);
      return;
    }

    const filtered = allPurchases.filter((p) => {
      const planName = (p.plan_id || '').toLowerCase();
      const periodName = (p.billing_period || '').toLowerCase();
      const status = (p.status || '').toLowerCase();
      const amount = String(p.amount_total || '');
      const refId = String(p.stripe_subscription_id || p.stripe_payment_intent_id || p.stripe_session_id || p.id || '').toLowerCase();

      return (
        planName.includes(query) ||
        periodName.includes(query) ||
        status.includes(query) ||
        amount.includes(query) ||
        refId.includes(query)
      );
    });

    renderRows(filtered, true);
  });

  // Renderizar filas de la tabla
  const renderRows = (purchases, isSearchResult = false) => {
    if (!tbody) return;

    if (purchases.length === 0) {
      if (tableEl) tableEl.style.display = 'none';
      if (emptyState) emptyState.style.display = 'flex';
      if (emptyText) {
        emptyText.textContent = isSearchResult
          ? (t('settings.purchases.search_no_results') || 'No se encontraron compras que coincidan con la búsqueda.')
          : (t('settings.purchases.empty_desc') || 'Aún no has realizado ninguna compra o suscripción en Spriteboard.');
      }
      return;
    }

    if (tableEl) tableEl.style.display = 'table';
    if (emptyState) emptyState.style.display = 'none';

    tbody.innerHTML = '';
    purchases.forEach((p) => {
      const row = document.createElement('tr');
      row.setAttribute('data-ref', `purchase-row-${p.id}`);

      const planName = (p.plan_id || 'Pro').toUpperCase();
      const periodName = p.billing_period === 'yearly'
        ? (t('upgrade.billing_yearly') || 'Anual')
        : (t('upgrade.billing_monthly') || 'Mensual');
      const amount = Number(p.amount_total || 0).toFixed(2);
      const currency = (p.currency || 'USD').toUpperCase();

      let dateFormatted = '-';
      if (p.created_at) {
        try {
          const d = new Date(p.created_at);
          dateFormatted = d.toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });
        } catch (_) {}
      }

      const statusText = p.status === 'completed'
        ? (t('settings.purchases.status_completed') || 'Completado')
        : (t(`settings.purchases.status_${p.status}`) || p.status);

      const refId = p.stripe_subscription_id || p.stripe_payment_intent_id || p.stripe_session_id || `#${p.id}`;
      const shortRef = refId.length > 20 ? `${refId.slice(0, 10)}...${refId.slice(-6)}` : refId;

      row.innerHTML = `
        <td data-ref="cell-date-${p.id}">
          <span class="component-badge component-badge--sm" data-ref="badge-date-${p.id}">${escapeHtml(dateFormatted)}</span>
        </td>
        <td data-ref="cell-plan-${p.id}">
          <span class="component-badge component-badge--sm" data-ref="badge-plan-${p.id}">
            <span class="material-symbols-rounded">workspace_premium</span>
            <span>Spriteboard ${escapeHtml(planName)}</span>
          </span>
        </td>
        <td data-ref="cell-period-${p.id}">
          <span class="component-badge component-badge--sm" data-ref="badge-period-${p.id}">${escapeHtml(periodName)}</span>
        </td>
        <td data-ref="cell-amount-${p.id}">
          <span class="component-badge component-badge--sm" data-ref="badge-amount-${p.id}">${escapeHtml(currency)} $${escapeHtml(amount)}</span>
        </td>
        <td data-ref="cell-status-${p.id}">
          <span class="component-badge component-badge--sm" data-ref="badge-status-${p.id}">${escapeHtml(statusText)}</span>
        </td>
        <td class="text-right" data-ref="cell-ref-${p.id}">
          <span class="component-badge component-badge--sm" data-ref="badge-ref-${p.id}" data-tooltip="${escapeHtml(refId)}">${escapeHtml(shortRef)}</span>
        </td>
      `;

      tbody.appendChild(row);
    });
  };

  // Cargar datos del backend
  const loadPurchases = async () => {
    try {
      const res = await getPurchaseHistoryApi();
      allPurchases = res.purchases || [];
      renderRows(allPurchases);
    } catch (_) {
      allPurchases = [];
      renderRows([]);
    }
  };

  await loadPurchases();

  return container;
}
