function renderCardHtml(type: 'canvas' | 'template' = 'canvas', index = 0, isWide = false): string {
  const wideClass = isWide ? ' skeleton-card--template-wide' : '';
  const typeClass = type === 'template' ? 'skeleton-card--template' : 'skeleton-card--canvas';
  const badgeWidth = type === 'template' ? '60px' : '76px';
  return `
    <div class="skeleton-card ${typeClass}${wideClass}" data-ref="skeleton-card" style="--card-index: ${index};">
      <div class="skeleton-card__header" data-ref="skeleton-card-header">
        <div class="skeleton-card__badge-pill" data-ref="skeleton-card-badge" style="width: ${badgeWidth};"></div>
        <div class="skeleton-card__badge-pill" data-ref="skeleton-card-badge" style="width: 36px;"></div>
      </div>
      <div class="skeleton-card__footer" data-ref="skeleton-card-footer">
        <div class="skeleton-card__line skeleton-card__line--title" data-ref="skeleton-card-title"></div>
        <div class="skeleton-card__line skeleton-card__line--subtitle" data-ref="skeleton-card-subtitle"></div>
      </div>
    </div>
  `;
}

function renderGridCardsHtml(count = 8, type: 'canvas' | 'template' = 'canvas'): string {
  const cards: string[] = [];
  for (let i = 0; i < count; i++) {
    const isWide = type === 'template' && (i === 1 || i === 5);
    cards.push(renderCardHtml(type, i, isWide));
  }
  return cards.join('');
}

function renderTableRowsHtml(count = 6): string {
  const rows: string[] = [];
  for (let i = 0; i < count; i++) {
    rows.push(`
      <tr class="skeleton-table-row" data-ref="skeleton-trash-row" style="--row-index: ${i};">
        <td><div class="skeleton-cell" data-ref="skeleton-trash-cell" style="width: 65%;"></div></td>
        <td><div class="skeleton-cell" data-ref="skeleton-trash-cell" style="width: 50%;"></div></td>
        <td><div class="skeleton-cell" data-ref="skeleton-trash-cell" style="width: 55%;"></div></td>
        <td><div class="skeleton-cell" data-ref="skeleton-trash-cell" style="width: 45%;"></div></td>
        <td><div class="skeleton-cell" data-ref="skeleton-trash-cell" style="width: 40px;"></div></td>
      </tr>
    `);
  }
  return rows.join('');
}

const SKELETON_TOPBAR_HTML = `
  <header class="general-content-top layout-header" data-ref="skeleton-topbar">
    <div class="top-left layout-header__left">
      <div class="skeleton" style="width: 38px; height: 38px; border-radius: var(--radius-md); margin-right: 12px;"></div>
      <div class="skeleton skeleton--title" style="width: 120px; height: 24px; margin: 0;"></div>
    </div>
    <div class="top-center layout-header__center">
      <div class="skeleton" style="width: 425px; max-width: 100%; height: 40px; border-radius: var(--radius-md);"></div>
    </div>
    <div class="top-right layout-header__right">
      <div class="skeleton skeleton--avatar" style="width: 40px; height: 40px; border-radius: 50%;"></div>
    </div>
  </header>
`;

export const SKELETON_TEMPLATES: Record<string, string> = {
  'cards-layout': `
    <div class="layout-root" data-ref="skeleton-cards-root" style="width: 100%; height: 100%; display: flex; flex-direction: column;">
      ${SKELETON_TOPBAR_HTML}
      <div class="layout-content skeleton-container" data-ref="skeleton-home-view">
        <div class="component-wrapper component-wrapper--full" data-ref="skeleton-home-wrapper">
          <div class="component-top" data-ref="skeleton-component-top">
            <div class="component-top-left" data-ref="skeleton-component-top-left">
              <div class="skeleton skeleton--title" style="width: 220px; height: 26px; margin: 0;"></div>
            </div>
            <div class="component-top-right" data-ref="skeleton-component-top-right">
              <div class="skeleton" style="width: 40px; height: 40px; border-radius: var(--radius-md);"></div>
            </div>
          </div>
          <div class="component-bottom component-bottom--no-padding" data-ref="skeleton-component-bottom">
            <div class="layout-body layout-body--scrollable layout-scrollable" data-ref="skeleton-home-scrollable">
              <div class="canvas-section" data-ref="skeleton-canvas-section">
                <div class="canvas-grid" data-ref="skeleton-canvas-grid">
                  ${renderGridCardsHtml(8, 'canvas')}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,

  'cards-layout-bottom': `
    <div class="layout-content skeleton-container" data-ref="skeleton-home-view">
      <div class="component-wrapper component-wrapper--full" data-ref="skeleton-home-wrapper">
        <div class="component-top" data-ref="skeleton-component-top">
          <div class="component-top-left" data-ref="skeleton-component-top-left">
            <div class="skeleton skeleton--title" style="width: 220px; height: 26px; margin: 0;"></div>
          </div>
          <div class="component-top-right" data-ref="skeleton-component-top-right">
            <div class="skeleton" style="width: 40px; height: 40px; border-radius: var(--radius-md);"></div>
          </div>
        </div>
        <div class="component-bottom component-bottom--no-padding" data-ref="skeleton-component-bottom">
          <div class="layout-body layout-body--scrollable layout-scrollable" data-ref="skeleton-home-scrollable">
            <div class="canvas-section" data-ref="skeleton-canvas-section">
              <div class="canvas-grid" data-ref="skeleton-canvas-grid">
                ${renderGridCardsHtml(8, 'canvas')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,

  'centered-form': `
    <div class="layout-content" data-ref="skeleton-centered-form-view">
      <div class="login-container" data-ref="skeleton-centered-form-container">
        <div class="login-header-logo" data-ref="skeleton-centered-form-logo" style="pointer-events: none;">
          <div class="skeleton skeleton--circle" style="width: 38px; height: 38px;"></div>
        </div>

        <div class="card card--w-400" data-ref="skeleton-centered-form-card">
          <div class="card__header" data-ref="skeleton-centered-form-header">
            <div class="skeleton skeleton--title" style="width: 200px; height: 28px; margin: 0;"></div>
            <div class="skeleton skeleton--subtitle" style="width: 320px; max-width: 100%; height: 16px; margin: 0;"></div>
          </div>

          <div class="card__body" data-ref="skeleton-centered-form-body">
            <div class="skeleton skeleton--input" style="height: 55px; border-radius: var(--radius-md); margin: 0;"></div>
            <div class="skeleton skeleton--input" style="height: 55px; border-radius: var(--radius-md); margin: 0;"></div>
            <div class="skeleton skeleton--btn" style="height: 55px; border-radius: var(--radius-md); margin: 0;"></div>
            <div class="skeleton skeleton--btn" style="height: 55px; border-radius: var(--radius-md); margin: 0;"></div>
            <div class="skeleton skeleton--text skeleton--w-50 skeleton--mx-auto" style="height: 14px; margin: 4px auto 0 auto;"></div>
          </div>
        </div>
      </div>
    </div>
  `,

  'grouped-layout': `
    <div class="layout-root" data-ref="skeleton-grouped-view" style="width: 100%; height: 100%; display: flex; flex-direction: column;">
      ${SKELETON_TOPBAR_HTML}

      <div class="layout-content" data-ref="skeleton-content-area">
        <div class="layout-body layout-body--scrollable layout-scrollable" data-ref="skeleton-body-area">
          <div class="grouped-flow-layout" data-ref="skeleton-grouped-layout">
            <div class="grouped-header-card" data-ref="skeleton-grouped-header">
              <div class="skeleton skeleton--title" style="width: 220px; height: 24px; margin: 0 auto;"></div>
              <div class="skeleton skeleton--subtitle" style="width: 380px; max-width: 90%; height: 14px; margin: 8px auto 0 auto;"></div>
            </div>

            <div class="grouped-items-card" data-ref="skeleton-grouped-card-1">
              <div class="grouped-row-item--stacked" data-ref="skeleton-grouped-item-1">
                <div style="display: flex; flex-direction: column; gap: 6px; width: 100%;">
                  <div class="skeleton skeleton--title" style="width: 160px; height: 18px; margin: 0;"></div>
                  <div class="skeleton skeleton--text" style="width: 320px; max-width: 90%; height: 13px; margin: 0;"></div>
                </div>
                <div class="skeleton" style="width: 100%; max-width: 265px; height: 42px; border-radius: var(--radius-md); margin-top: 4px;"></div>
              </div>
            </div>

            <div class="grouped-items-card" data-ref="skeleton-grouped-card-2">
              <div class="grouped-row-item" data-ref="skeleton-grouped-item-2">
                <div style="display: flex; flex-direction: column; gap: 6px; flex: 1;">
                  <div class="skeleton skeleton--title" style="width: 180px; height: 18px; margin: 0;"></div>
                  <div class="skeleton skeleton--text" style="width: 300px; max-width: 90%; height: 13px; margin: 0;"></div>
                </div>
                <div class="skeleton" style="width: 44px; height: 24px; border-radius: 24px; flex-shrink: 0;"></div>
              </div>

              <div class="menu-divider"></div>

              <div class="grouped-row-item" data-ref="skeleton-grouped-item-3">
                <div style="display: flex; flex-direction: column; gap: 6px; flex: 1;">
                  <div class="skeleton skeleton--title" style="width: 150px; height: 18px; margin: 0;"></div>
                  <div class="skeleton skeleton--text" style="width: 280px; max-width: 90%; height: 13px; margin: 0;"></div>
                </div>
                <div class="skeleton" style="width: 44px; height: 24px; border-radius: 24px; flex-shrink: 0;"></div>
              </div>

              <div class="menu-divider"></div>

              <div class="grouped-row-item" data-ref="skeleton-grouped-item-4">
                <div style="display: flex; flex-direction: column; gap: 6px; flex: 1;">
                  <div class="skeleton skeleton--title" style="width: 190px; height: 18px; margin: 0;"></div>
                  <div class="skeleton skeleton--text" style="width: 260px; max-width: 90%; height: 13px; margin: 0;"></div>
                </div>
                <div class="skeleton" style="width: 44px; height: 24px; border-radius: 24px; flex-shrink: 0;"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,

  'grouped-layout-bottom': `
    <div class="layout-content skeleton-container" data-ref="skeleton-content-area">
      <div class="layout-body layout-body--scrollable layout-scrollable" data-ref="skeleton-body-area">
        <div class="grouped-flow-layout" data-ref="skeleton-grouped-layout">
          <div class="grouped-header-card" data-ref="skeleton-grouped-header">
            <div class="skeleton skeleton--title" style="width: 220px; height: 24px; margin: 0 auto;"></div>
            <div class="skeleton skeleton--subtitle" style="width: 380px; max-width: 90%; height: 14px; margin: 8px auto 0 auto;"></div>
          </div>

          <div class="grouped-items-card" data-ref="skeleton-grouped-card-1">
            <div class="grouped-row-item--stacked" data-ref="skeleton-grouped-item-1">
              <div style="display: flex; flex-direction: column; gap: 6px; width: 100%;">
                <div class="skeleton skeleton--title" style="width: 160px; height: 18px; margin: 0;"></div>
                <div class="skeleton skeleton--text" style="width: 320px; max-width: 90%; height: 13px; margin: 0;"></div>
              </div>
              <div class="skeleton" style="width: 100%; max-width: 265px; height: 42px; border-radius: var(--radius-md); margin-top: 4px;"></div>
            </div>
          </div>

          <div class="grouped-items-card" data-ref="skeleton-grouped-card-2">
            <div class="grouped-row-item" data-ref="skeleton-grouped-item-2">
              <div style="display: flex; flex-direction: column; gap: 6px; flex: 1;">
                <div class="skeleton skeleton--title" style="width: 180px; height: 18px; margin: 0;"></div>
                <div class="skeleton skeleton--text" style="width: 300px; max-width: 90%; height: 13px; margin: 0;"></div>
              </div>
              <div class="skeleton" style="width: 44px; height: 24px; border-radius: 24px; flex-shrink: 0;"></div>
            </div>

            <div class="menu-divider"></div>

            <div class="grouped-row-item" data-ref="skeleton-grouped-item-3">
              <div style="display: flex; flex-direction: column; gap: 6px; flex: 1;">
                <div class="skeleton skeleton--title" style="width: 150px; height: 18px; margin: 0;"></div>
                <div class="skeleton skeleton--text" style="width: 280px; max-width: 90%; height: 13px; margin: 0;"></div>
              </div>
              <div class="skeleton" style="width: 44px; height: 24px; border-radius: 24px; flex-shrink: 0;"></div>
            </div>

            <div class="menu-divider"></div>

            <div class="grouped-row-item" data-ref="skeleton-grouped-item-4">
              <div style="display: flex; flex-direction: column; gap: 6px; flex: 1;">
                <div class="skeleton skeleton--title" style="width: 190px; height: 18px; margin: 0;"></div>
                <div class="skeleton skeleton--text" style="width: 260px; max-width: 90%; height: 13px; margin: 0;"></div>
              </div>
              <div class="skeleton" style="width: 44px; height: 24px; border-radius: 24px; flex-shrink: 0;"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,

  'search-layout': `
    <div class="layout-root" data-ref="skeleton-search-root" style="width: 100%; height: 100%; display: flex; flex-direction: column;">
      ${SKELETON_TOPBAR_HTML}
      <div class="layout-content skeleton-container" data-ref="skeleton-search-view">
        <div class="component-wrapper component-wrapper--full" data-ref="skeleton-search-wrapper">
          <div class="component-top" data-ref="skeleton-search-top">
            <div class="component-top-left component-top-left--full" data-ref="skeleton-search-top-left">
              <div style="display: flex; gap: 8px; align-items: center;">
                <div class="skeleton" style="width: 85px; height: 32px; border-radius: 20px;"></div>
                <div class="skeleton" style="width: 110px; height: 32px; border-radius: 20px;"></div>
                <div class="skeleton" style="width: 100px; height: 32px; border-radius: 20px;"></div>
              </div>
            </div>
          </div>
          <div class="component-bottom component-bottom--no-padding" data-ref="skeleton-search-bottom">
            <div class="layout-body layout-body--scrollable layout-scrollable" data-ref="skeleton-search-scrollable">
              <div class="search-content-wrapper" data-ref="skeleton-search-content" style="padding: 24px;">
                <div class="search-section" data-ref="skeleton-section-canvases">
                  <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
                    <div class="skeleton" style="width: 24px; height: 24px; border-radius: 6px;"></div>
                    <div class="skeleton skeleton--title" style="width: 140px; height: 20px; margin: 0;"></div>
                  </div>
                  <div class="canvas-grid" data-ref="skeleton-search-canvases-grid">
                    ${renderGridCardsHtml(4, 'canvas')}
                  </div>
                </div>
                <div class="search-section" data-ref="skeleton-section-templates" style="margin-top: 32px;">
                  <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
                    <div class="skeleton" style="width: 24px; height: 24px; border-radius: 6px;"></div>
                    <div class="skeleton skeleton--title" style="width: 190px; height: 20px; margin: 0;"></div>
                  </div>
                  <div class="templates-grid" data-ref="skeleton-search-templates-grid">
                    ${renderGridCardsHtml(4, 'template')}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,

  'search-layout-bottom': `
    <div class="layout-content skeleton-container" data-ref="skeleton-search-view">
      <div class="component-wrapper component-wrapper--full" data-ref="skeleton-search-wrapper">
        <div class="component-top" data-ref="skeleton-search-top">
          <div class="component-top-left component-top-left--full" data-ref="skeleton-search-top-left">
            <div style="display: flex; gap: 8px; align-items: center;">
              <div class="skeleton" style="width: 85px; height: 32px; border-radius: 20px;"></div>
              <div class="skeleton" style="width: 110px; height: 32px; border-radius: 20px;"></div>
              <div class="skeleton" style="width: 100px; height: 32px; border-radius: 20px;"></div>
            </div>
          </div>
        </div>
        <div class="component-bottom component-bottom--no-padding" data-ref="skeleton-search-bottom">
          <div class="layout-body layout-body--scrollable layout-scrollable" data-ref="skeleton-search-scrollable">
            <div class="search-content-wrapper" data-ref="skeleton-search-content" style="padding: 24px;">
              <div class="search-section" data-ref="skeleton-section-canvases">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
                  <div class="skeleton" style="width: 24px; height: 24px; border-radius: 6px;"></div>
                  <div class="skeleton skeleton--title" style="width: 140px; height: 20px; margin: 0;"></div>
                </div>
                <div class="canvas-grid" data-ref="skeleton-search-canvases-grid">
                  ${renderGridCardsHtml(4, 'canvas')}
                </div>
              </div>
              <div class="search-section" data-ref="skeleton-section-templates" style="margin-top: 32px;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
                  <div class="skeleton" style="width: 24px; height: 24px; border-radius: 6px;"></div>
                  <div class="skeleton skeleton--title" style="width: 190px; height: 20px; margin: 0;"></div>
                </div>
                <div class="templates-grid" data-ref="skeleton-search-templates-grid">
                  ${renderGridCardsHtml(4, 'template')}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,

  'templates-layout': `
    <div class="layout-root" data-ref="skeleton-templates-root" style="width: 100%; height: 100%; display: flex; flex-direction: column;">
      ${SKELETON_TOPBAR_HTML}
      <div class="layout-content skeleton-container" data-ref="skeleton-templates-view">
        <div class="component-wrapper component-wrapper--full" data-ref="skeleton-templates-wrapper">
          <div class="component-top" data-ref="skeleton-templates-top">
            <div class="component-top-left component-top-left--full" data-ref="skeleton-templates-top-left">
              <div class="component-tags-carousel-wrapper" data-ref="skeleton-tags-carousel" style="display: flex; gap: 8px; align-items: center; overflow: hidden; width: 100%;">
                <div class="skeleton" style="width: 80px; height: 32px; border-radius: 20px; flex-shrink: 0;"></div>
                <div class="skeleton" style="width: 105px; height: 32px; border-radius: 20px; flex-shrink: 0;"></div>
                <div class="skeleton" style="width: 95px; height: 32px; border-radius: 20px; flex-shrink: 0;"></div>
                <div class="skeleton" style="width: 115px; height: 32px; border-radius: 20px; flex-shrink: 0;"></div>
                <div class="skeleton" style="width: 90px; height: 32px; border-radius: 20px; flex-shrink: 0;"></div>
                <div class="skeleton" style="width: 100px; height: 32px; border-radius: 20px; flex-shrink: 0;"></div>
              </div>
            </div>
          </div>
          <div class="component-bottom component-bottom--no-padding" data-ref="skeleton-templates-bottom">
            <div class="layout-body layout-body--scrollable layout-scrollable" data-ref="skeleton-templates-scrollable">
              <div class="canvas-section" data-ref="skeleton-templates-section">
                <div class="templates-grid" data-ref="skeleton-templates-grid">
                  ${renderGridCardsHtml(8, 'template')}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,

  'templates-layout-bottom': `
    <div class="layout-content skeleton-container" data-ref="skeleton-templates-view">
      <div class="component-wrapper component-wrapper--full" data-ref="skeleton-templates-wrapper">
        <div class="component-top" data-ref="skeleton-templates-top">
          <div class="component-top-left component-top-left--full" data-ref="skeleton-templates-top-left">
            <div class="component-tags-carousel-wrapper" data-ref="skeleton-tags-carousel" style="display: flex; gap: 8px; align-items: center; overflow: hidden; width: 100%;">
              <div class="skeleton" style="width: 80px; height: 32px; border-radius: 20px; flex-shrink: 0;"></div>
              <div class="skeleton" style="width: 105px; height: 32px; border-radius: 20px; flex-shrink: 0;"></div>
              <div class="skeleton" style="width: 95px; height: 32px; border-radius: 20px; flex-shrink: 0;"></div>
              <div class="skeleton" style="width: 115px; height: 32px; border-radius: 20px; flex-shrink: 0;"></div>
              <div class="skeleton" style="width: 90px; height: 32px; border-radius: 20px; flex-shrink: 0;"></div>
              <div class="skeleton" style="width: 100px; height: 32px; border-radius: 20px; flex-shrink: 0;"></div>
            </div>
          </div>
        </div>
        <div class="component-bottom component-bottom--no-padding" data-ref="skeleton-templates-bottom">
          <div class="layout-body layout-body--scrollable layout-scrollable" data-ref="skeleton-templates-scrollable">
            <div class="canvas-section" data-ref="skeleton-templates-section">
              <div class="templates-grid" data-ref="skeleton-templates-grid">
                ${renderGridCardsHtml(8, 'template')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,

  'trash-layout': `
    <div class="layout-root" data-ref="skeleton-trash-root" style="width: 100%; height: 100%; display: flex; flex-direction: column;">
      ${SKELETON_TOPBAR_HTML}
      <div class="layout-content skeleton-container" data-ref="skeleton-trash-view">
        <div class="component-wrapper component-wrapper--full" data-ref="skeleton-trash-wrapper">
          <div class="component-top" data-ref="skeleton-trash-top">
            <div class="component-top-left" data-ref="skeleton-trash-top-left">
              <div class="skeleton skeleton--title" style="width: 210px; height: 26px; margin: 0;"></div>
            </div>
            <div class="component-top-right" data-ref="skeleton-trash-top-right">
              <div style="display: flex; gap: 8px;">
                <div class="skeleton" style="width: 40px; height: 40px; border-radius: var(--radius-md);"></div>
                <div class="skeleton" style="width: 40px; height: 40px; border-radius: var(--radius-md);"></div>
              </div>
            </div>
          </div>
          <div class="component-bottom component-bottom--no-padding" data-ref="skeleton-trash-bottom">
            <div class="component-table-wrapper" data-ref="skeleton-trash-table-wrapper" style="padding: 16px;">
              <table class="component-table" data-ref="skeleton-trash-table">
                <thead class="component-table__head">
                  <tr>
                    <th style="width: 30%;"><div class="skeleton" style="width: 70px; height: 16px; border-radius: 4px;"></div></th>
                    <th style="width: 20%;"><div class="skeleton" style="width: 90px; height: 16px; border-radius: 4px;"></div></th>
                    <th style="width: 20%;"><div class="skeleton" style="width: 110px; height: 16px; border-radius: 4px;"></div></th>
                    <th style="width: 15%;"><div class="skeleton" style="width: 110px; height: 16px; border-radius: 4px;"></div></th>
                    <th style="width: 15%;"><div class="skeleton" style="width: 60px; height: 16px; border-radius: 4px;"></div></th>
                  </tr>
                </thead>
                <tbody class="component-table__body">
                  ${renderTableRowsHtml(6)}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,

  'trash-layout-bottom': `
    <div class="layout-content skeleton-container" data-ref="skeleton-trash-view">
      <div class="component-wrapper component-wrapper--full" data-ref="skeleton-trash-wrapper">
        <div class="component-top" data-ref="skeleton-trash-top">
          <div class="component-top-left" data-ref="skeleton-trash-top-left">
            <div class="skeleton skeleton--title" style="width: 210px; height: 26px; margin: 0;"></div>
          </div>
          <div class="component-top-right" data-ref="skeleton-trash-top-right">
            <div style="display: flex; gap: 8px;">
              <div class="skeleton" style="width: 40px; height: 40px; border-radius: var(--radius-md);"></div>
              <div class="skeleton" style="width: 40px; height: 40px; border-radius: var(--radius-md);"></div>
            </div>
          </div>
        </div>
        <div class="component-bottom component-bottom--no-padding" data-ref="skeleton-trash-bottom">
          <div class="component-table-wrapper" data-ref="skeleton-trash-table-wrapper" style="padding: 16px;">
            <table class="component-table" data-ref="skeleton-trash-table">
              <thead class="component-table__head">
                <tr>
                  <th style="width: 30%;"><div class="skeleton" style="width: 70px; height: 16px; border-radius: 4px;"></div></th>
                  <th style="width: 20%;"><div class="skeleton" style="width: 90px; height: 16px; border-radius: 4px;"></div></th>
                  <th style="width: 20%;"><div class="skeleton" style="width: 110px; height: 16px; border-radius: 4px;"></div></th>
                  <th style="width: 15%;"><div class="skeleton" style="width: 110px; height: 16px; border-radius: 4px;"></div></th>
                  <th style="width: 15%;"><div class="skeleton" style="width: 60px; height: 16px; border-radius: 4px;"></div></th>
                </tr>
              </thead>
              <tbody class="component-table__body">
                ${renderTableRowsHtml(6)}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `,
};

export function getSkeletonTemplate(name: string): string {
  return SKELETON_TEMPLATES[name] || SKELETON_TEMPLATES['cards-layout'];
}

export default SKELETON_TEMPLATES;
